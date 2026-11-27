import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const [endpoint, tabId, input, dist] = process.argv.slice(2);
const staticRoot = dist && resolve(dist);
const target = new URL(endpoint);
if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1') throw new Error('CDP deve ser local');
const scenarios = JSON.parse(await readFile(input, 'utf8'));
const tabs = await (await fetch(new URL('/json/list', target))).json();
const tab = tabs.find((entry) => entry.id === tabId && entry.type === 'page');
const origin = new URL(tab.url).origin;
if (origin !== 'https://pelegrini.t2a.ia.br' && !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
  throw new Error('Selecione uma aba dedicada da Pelegrini');
}
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

const commands = new Map();
let requests = new Map();
let sequence = 0;
const round = (number) => Math.round(number ?? 0);
const header = (headers, key) => Object.entries(headers).find(([name]) => name.toLowerCase() === key)?.[1];
const elapsed = (end, start) => Number.isFinite(end) && Number.isFinite(start) ? round(end - start) : null;

function safePath(raw) {
  const url = new URL(raw);
  if (url.pathname === '/functions/v1/api-proxy' || url.pathname === '/api-proxy') {
    return (url.searchParams.get('path') ?? '/api-proxy').split('?')[0];
  }
  return url.pathname.replace(/\/[\da-f]{8}-[\da-f-]{27}(?=\/|$)/gi, '/:id');
}

function timing(headers) {
  const value = String(header(headers, 'server-timing') ?? '');
  return Object.fromEntries(Array.from(value.matchAll(/(?:^|,)\s*(db|sql|auth|api|serialize|queue|source|local);\s*dur=(\d+(?:\.\d+)?)/gi),
    ([, name, duration]) => [name.toLowerCase(), Number(duration)]));
}

ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const pending = commands.get(message.id);
    if (!pending) return;
    commands.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result);
    return;
  }
  const p = message.params;
  if (!p) return;
  if (message.method === 'Fetch.requestPaused') {
    void serveStatic(p);
    return;
  }
  const r = requests.get(p.requestId);
  switch (message.method) {
    case 'Network.requestWillBeSent': {
      const kind = p.type;
      if (!['XHR', 'Fetch', 'Document', 'Script', 'Stylesheet', 'Preflight'].includes(kind)) break;
      requests.set(p.requestId, { path: safePath(p.request.url), kind, startedAt: p.timestamp * 1000, transfer: 0, decoded: 0 });
      break;
    }
    case 'Network.responseReceived': {
      if (!r) break;
      const response = p.response;
      r.responseAt = p.timestamp * 1000;
      r.status = response.status;
      r.fromCache = Boolean(response.fromDiskCache || response.fromServiceWorker || r.fromCache);
      r.encoding = header(response.headers, 'content-encoding');
      r.timing = timing(response.headers);
      r.asOf = header(response.headers, 'x-data-as-of');
      break;
    }
    case 'Network.requestServedFromCache':
      if (r) r.fromCache = true;
      break;
    case 'Network.dataReceived':
      if (r) r.decoded += p.dataLength;
      break;
    case 'Network.loadingFinished':
      if (r) { r.finishedAt = p.timestamp * 1000; r.transfer = p.encodedDataLength; }
      break;
    case 'Network.loadingFailed':
      if (r) { r.finishedAt = p.timestamp * 1000; r.failed = true; }
      break;
  }
});

function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    commands.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function serveStatic({ request, requestId, resourceType }) {
  const url = new URL(request.url);
  try {
    if (url.origin === origin && request.method === 'GET') {
      const path = resourceType === 'Document' ? '/index.html' : url.pathname;
      const filename = resolve(staticRoot, '.' + path);
      const filesystemAsset = path.startsWith('/assets/');
      const type = path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : null;
      if (filename.startsWith(staticRoot + sep) && (path === '/index.html' || (filesystemAsset && type))) {
        const body = await readFile(filename);
        await call('Fetch.fulfillRequest', {
          requestId, responseCode: 200, body: body.toString('base64'),
          responseHeaders: [
            { name: 'Content-Type', value: type ?? 'text/html; charset=utf-8' },
            { name: 'Cache-Control', value: 'no-store' },
          ],
        });
        return;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Falha ao carregar um artefato local do teste');
  }
  await call('Fetch.continueRequest', { requestId });
}

async function read(expression) {
  const answer = await call('Runtime.evaluate', { expression, returnByValue: true });
  return answer.result?.value;
}

async function click(label) {
  const matched = await read(`(() => {
    const label = ${JSON.stringify(label)};
    const items = [...document.querySelectorAll('button, a, [role="tab"], [role="option"], [role="checkbox"]')];
    const item = items.find(x => (x.getAttribute('aria-label') || x.textContent).trim() === label && x.getClientRects().length);
    if (!item) return {error: 'Controle ausente'};
    if (item.disabled || item.getAttribute('aria-disabled') === 'true') return {error: 'Controle desabilitado'};
    item.scrollIntoView({block:'nearest'});
    const r = item.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  })()`);
  if (!Array.isArray(matched)) throw new Error(`${matched?.error ?? 'Controle ausente'}: ${label}`);
  const [x, y] = matched;
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function metrics() {
  return Object.fromEntries((await call('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value * 1000]));
}

async function state(s) {
  return await read(`(() => {
    const body = document.body?.innerText ?? '';
    const includes = text => body.toLocaleLowerCase('pt-BR').includes(text.toLocaleLowerCase('pt-BR'));
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim();
    const selector = ${JSON.stringify(s.selector ?? null)};
    return {
      origin: location.origin,
      path: location.pathname,
      isLogin: !!document.querySelector('input[type="password"]'),
      denied: /Acesso Negado|Você não tem permissão para acessar/i.test(body),
      fault: ${JSON.stringify(s.error ?? [])}.some(includes),
      ready: ${JSON.stringify(s.ready)}.every(includes) &&
        ${JSON.stringify(s.hide ?? [])}.every(text => !includes(text)) &&
        (!selector || [...document.querySelectorAll(selector)].some(x => x.getClientRects().length)) &&
        (${JSON.stringify(s.activeTab ?? null)} === null || activeTab === ${JSON.stringify(s.activeTab ?? null)}),
      time: performance.now(),
      timeOrigin: performance.timeOrigin,
    };
  })()`);
}

function summarize(captured, readyAt) {
  const paths = new Map();
  const firstRequest = Math.min(...Array.from(captured.values(), r => r.startedAt));
  for (const r of captured.values()) {
    const path = `${r.kind} ${r.path}`;
    const group = paths.get(path) ?? { path, count: 0, bytes: 0, decoded: 0 };
    group.count += 1;
    group.firstRequestMs = Math.min(group.firstRequestMs ?? Infinity, round(r.startedAt - firstRequest));
    group.bytes += r.transfer;
    group.decoded += r.decoded;
    if (r.fromCache) group.cached = (group.cached ?? 0) + 1;
    if (!r.finishedAt) group.pending = (group.pending ?? 0) + 1;
    group.maxMs = Math.max(group.maxMs ?? 0, elapsed(r.finishedAt, r.startedAt) ?? 0);
    group.maxWaitMs = Math.max(group.maxWaitMs ?? 0, elapsed(r.responseAt, r.startedAt) ?? 0);
    group.maxTransferMs = Math.max(group.maxTransferMs ?? 0, elapsed(r.finishedAt, r.responseAt) ?? 0);
    group.status = Array.from(new Set([...(group.status ?? []), r.status ?? (r.failed ? 'failed' : 'pending')]));
    if (Object.keys(r.timing ?? {}).length) group.serverTimingMs = r.timing;
    if (r.encoding) group.encoding = r.encoding;
    const source = Date.parse(r.asOf ?? '');
    if (Number.isFinite(source)) group.maxAgeMs = Math.max(group.maxAgeMs ?? 0, readyAt - source);
    paths.set(path, group);
  }
  return [...paths.values()].sort((a, b) => b.maxMs - a.maxMs);
}

await call('Network.enable');
await call('Page.enable');
await call('Performance.enable');
if (staticRoot) await call('Fetch.enable', { patterns: [
  { urlPattern: origin + '/*', resourceType: 'Document', requestStage: 'Request' },
  { urlPattern: origin + '/assets/*', requestStage: 'Request' },
] });
try {
  for (const s of scenarios) {
    try {
      await call('Network.setCacheDisabled', { cacheDisabled: Boolean(s.cold) });
      await call('Network.setBypassServiceWorker', { bypass: Boolean(s.cold) });
      for (const label of s.setup ?? []) { await click(label); await delay(160); }
      const before = await metrics();
      const previous = await state(s);
      const started = performance.now();
      requests = new Map();
      if (s.path) {
        const url = new URL(s.path, origin);
        if (url.origin !== origin) throw new Error('Navegação fora do portal');
        if (url.pathname === previous?.path && !url.search) await call('Page.reload', { ignoreCache: Boolean(s.cold) });
        else await call('Page.navigate', { url: url.href });
      } else {
        await click(s.click);
      }
      let result;
      let outcome = 'timeout';
      let readySince;
      while (performance.now() - started < (s.timeoutMs ?? 45_000)) {
        result = await state(s);
        if (result?.origin && result.origin !== origin) { outcome = 'redirected'; break; }
        if ((!s.path || result?.timeOrigin !== previous?.timeOrigin) && (!s.path || result?.path === s.path)) {
          if (result?.isLogin) { outcome = 'login'; break; }
          if (result?.denied) { outcome = 'denied'; break; }
          if (result?.fault) { outcome = 'upstream_error'; break; }
          const calls = [...requests.values()].filter(r => (s.requests ?? []).some(path => r.path === path));
          if (result?.ready && (!s.requests?.length || (calls.length && calls.every(r => r.finishedAt)))) {
            readySince ??= performance.now();
            if (performance.now() - readySince >= (s.settleMs ?? 0)) { outcome = 'ready'; break; }
          } else readySince = undefined;
        }
        await delay(100);
      }
      const observedMs = round(performance.now() - started);
      const after = await metrics();
      const mainThreadMs = {};
      for (const name of ['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration']) {
        const amount = elapsed(after[name], before[name]);
        if (amount !== null && amount >= 0) mainThreadMs[name] = amount;
      }
      const cut = result ? round(result.timeOrigin + result.time) : Date.now();
      const metricText = outcome === 'ready' && s.metricSelector
        ? await read(`document.querySelector(${JSON.stringify(s.metricSelector)})?.innerText`) : null;
      console.log(JSON.stringify({ name: s.name, outcome, path: result?.path, cold: Boolean(s.cold),
        localBuild: Boolean(staticRoot), observedMs,
        metricsHash: metricText ? createHash('sha256').update(metricText).digest('hex') : undefined,
        navigationMs: s.path && result?.path === s.path && result.timeOrigin !== previous?.timeOrigin ? round(result.time) : null,
        mainThreadMs, requests: summarize(requests, cut) }));
    } catch (error) {
      console.log(JSON.stringify({ name: s.name, outcome: 'benchmark_error', message: error.message }));
    }
  }
} finally {
  if (staticRoot) {
    await call('Fetch.disable');
    await call('Page.navigate', { url: origin + '/' });
  }
  await call('Network.setCacheDisabled', { cacheDisabled: false });
  await call('Network.setBypassServiceWorker', { bypass: false });
  ws.close();
}

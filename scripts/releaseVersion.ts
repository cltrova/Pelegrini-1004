import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';

const baseline = JSON.parse(readFileSync(new URL('../release-version.json', import.meta.url), 'utf8'));
const origins = ['https://pelegrini.t2a.ia.br', 'https://www.pelegrini.t2a.ia.br'];

function ordinal(version: string): number {
  if (!/^[1-9]\d*\.(?:[0-9]|1[0-5])\.(?:[0-9]|1[0-5])$/.test(version)) {
    throw new Error(`Versao invalida: ${version}. Use tres numeros; os dois ultimos de 0 a 15.`);
  }
  const [major, minor, patch] = version.split('.').map(Number);
  const value = (major - 1) * 256 + minor * 16 + patch;
  if (!Number.isSafeInteger(value)) throw new Error('Versao fora do limite numerico.');
  return value;
}

function fromOrdinal(value: number): string {
  return `${Math.floor(value / 256) + 1}.${Math.floor((value % 256) / 16)}.${value % 16}`;
}

async function publishedVersion(origin: string): Promise<string | null> {
  const response = await fetch(`${origin}/app-version.json?build=${Date.now()}`, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.text();
  // A primeira entrega ainda nao tem manifesto; o roteamento SPA pode devolver HTML.
  if (response.status === 404 || (response.ok && body.trimStart().startsWith('<'))) return null;
  if (!response.ok) throw new Error(`${origin}: HTTP ${response.status}`);
  const manifest = JSON.parse(body);
  ordinal(manifest.version);
  return manifest.version;
}

export async function releaseVersionConfig(productionBuild: boolean) {
  let version = baseline.version as string;
  const floor = ordinal(version);
  if (productionBuild) {
    const results = await Promise.allSettled(origins.map(publishedVersion));
    const versions = results.flatMap((result) =>
      result.status === 'fulfilled' && result.value ? [ordinal(result.value)] : [],
    );
    if (versions.length) {
      version = fromOrdinal(Math.max(floor - 1, ...versions) + 1);
    } else if (process.env.PELEGRINI_VERSION_BOOTSTRAP !== '1' ||
      results.some((result) => result.status === 'rejected')) {
      throw new Error('Nao foi possivel consultar a versao publicada. Build interrompido para evitar repetir ou retroceder a versao.');
    }
  }

  let commit: string | null = null;
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* Builds de arquivo sem Git. */ }
  const manifest = { version, commit, builtAt: new Date().toISOString() };
  const plugin: Plugin = {
    name: 'pelegrini-release-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify(manifest, null, 2) + '\n' });
    },
  };
  console.log(`Pelegrini ${version}`);
  return { define: { __APP_VERSION__: JSON.stringify(version) }, plugin };
}

import { defineConfig, loadEnv, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";
import { releaseVersionConfig } from './scripts/releaseVersion';
import { assertProductionSupabaseConfig } from './scripts/validateSupabaseConfig';

async function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function shouldReturnEmptyOnFailure(proxyPath: string): boolean {
  const normalizedPath = proxyPath.startsWith("/") ? proxyPath : `/${proxyPath}`;
  return (
    normalizedPath.includes("/comercial/totais") ||
    normalizedPath.includes("/comercial/produtos") ||
    normalizedPath.includes("/comercial/pedidos") ||
    normalizedPath.includes("/comercial/devolucoes") ||
    normalizedPath.includes("/comercial/clientes") ||
    normalizedPath.includes("/comercial/agrupado")
  );
}

function sendFallback(res: ServerResponse, proxyPath: string, upstreamStatus?: number, upstreamBody?: string) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("x-proxy-upstream-error", "true");
  if (upstreamStatus) res.setHeader("x-proxy-upstream-status", String(upstreamStatus));
  if (upstreamBody) res.setHeader("x-proxy-upstream-body", upstreamBody.slice(0, 1000));
  res.end(proxyPath.includes("/comercial/totais") ? "{}" : "[]");
}

function resolveUpstreamHostHeader(endpoint: string): string | null {
  try {
    const host = new URL(endpoint).hostname;
    return host === "187.77.203.16" ? "rsys.cyft.com.br" : null;
  } catch {
    return null;
  }
}

function isJsonResponse(body: string) {
  const trimmed = body.trimStart();
  if (!trimmed) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function localApiProxyPlugin() {
  return {
    name: "local-api-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api-proxy", async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const requestUrl = new URL(req.url || "", "http://localhost");
          const endpoint = requestUrl.searchParams.get("endpoint") || "";
          const proxyPath = requestUrl.searchParams.get("path") || "";

          if (!endpoint || !proxyPath) {
            sendJson(res, 400, { error: "Parametros endpoint e path sao obrigatorios." });
            return;
          }

          const upstreamUrl = `${endpoint.replace(/\/+$/, "")}/${proxyPath.replace(/^\/+/, "")}`;
          const headers = new Headers();
          headers.set("content-type", "application/json");
          headers.set("accept", "application/json");
          const hostHeader = resolveUpstreamHostHeader(endpoint);
          if (hostHeader) headers.set("host", hostHeader);

          const method = req.method || "GET";
          const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);
          const upstream = await fetch(upstreamUrl, { method, headers, body });
          const responseBody = Buffer.from(await upstream.arrayBuffer());
          const responseText = responseBody.toString("utf8");

          if (!upstream.ok && shouldReturnEmptyOnFailure(proxyPath)) {
            sendFallback(res, proxyPath, upstream.status, responseText);
            return;
          }

          if (upstream.ok && shouldReturnEmptyOnFailure(proxyPath) && !isJsonResponse(responseText)) {
            sendFallback(res, proxyPath, upstream.status, responseText);
            return;
          }

          res.statusCode = upstream.status;
          upstream.headers.forEach((value, key) => {
            if (["content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())) return;
            res.setHeader(key, value);
          });
          res.setHeader("x-local-api-proxy-url", upstreamUrl);
          res.end(responseBody);
        } catch (error) {
          const requestUrl = new URL(req.url || "", "http://localhost");
          const proxyPath = requestUrl.searchParams.get("path") || "";
          if (proxyPath && shouldReturnEmptyOnFailure(proxyPath)) {
            sendFallback(res, proxyPath, 502, error instanceof Error ? error.message : "Falha no proxy local.");
            return;
          }
          sendJson(res, 502, {
            error: error instanceof Error ? error.message : "Falha no proxy local.",
          });
        }
      });
    },
  };
}

// Keep the static imports needed on the first Produtos screen in a few files.
function chunksIniciais(): NonNullable<import('rollup').OutputOptions['manualChunks']> {
  let chunks: Map<string, string> | undefined;
  return (id, { getModuleIds, getModuleInfo }) => {
    if (!chunks) {
      const modulos = [...getModuleIds()];
      const dependencias = (...arquivos: string[]) => {
        const encontrados = new Set<string>();
        const pendentes = modulos.filter(modulo => arquivos.some(arquivo => modulo.endsWith(arquivo)));
        while (pendentes.length) {
          const modulo = pendentes.pop()!;
          if (encontrados.has(modulo)) continue;
          encontrados.add(modulo);
          pendentes.push(...(getModuleInfo(modulo)?.importedIds ?? []));
        }
        return encontrados;
      };
      const entrada = dependencias('/src/main.tsx', '/src/pages/visitas/VisitasApp.tsx');
      const portal = dependencias('/src/App.tsx');
      const produtos = dependencias('/src/pages/comercial/ProdutosPage.tsx');
      chunks = new Map();
      for (const modulo of new Set([...portal, ...produtos])) {
        if (/\.css(?:\?|$)/.test(modulo)) continue;
        chunks.set(modulo, entrada.has(modulo) ? 'entrada-comum' : portal.has(modulo) ? 'portal' : 'produtos');
      }
    }
    return chunks.get(id);
  };
}

// https://vitejs.dev/config/
export default defineConfig(async ({ command, mode }) => {
  const productionBuild = command === 'build' && mode === 'production';
  if (productionBuild) assertProductionSupabaseConfig(loadEnv(mode, process.cwd(), 'VITE_'));
  const release = await releaseVersionConfig(productionBuild);
  return {
  define: release.define,
  build: productionBuild ? {
    rollupOptions: { output: { onlyExplicitManualChunks: true, manualChunks: chunksIniciais() } },
  } : undefined,
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/ia/': process.env.PELEGRINI_AI_TARGET || 'http://127.0.0.1:4319',
      ...(process.env.PELEGRINI_RELATORIOS_TARGET && {
        '/api/comercial/preparado/': process.env.PELEGRINI_RELATORIOS_TARGET,
      }),
      ...(process.env.VISITAS_API_TARGET && {
        '/operacional/visitas/': process.env.VISITAS_API_TARGET,
      }),
    },
  },
  plugins: [react(), localApiProxyPlugin(), release.plugin],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react-day-picker", "date-fns", "date-fns/locale"],
  },
  };
});

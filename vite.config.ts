import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

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
    normalizedPath.includes("/comercial/agrupado") ||
    normalizedPath.includes("/financeiro/dre") ||
    normalizedPath.includes("/financeiro/variacao") ||
    normalizedPath.includes("/financeiro/duplicatas") ||
    normalizedPath.includes("/financeiro/resumo") ||
    normalizedPath.includes("/financeiro/fluxo-caixa") ||
    normalizedPath.includes("/operacional/estoque")
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

function isJsonResponse(contentType: string | null, body: string) {
  const normalizedType = (contentType || "").toLowerCase();
  if (normalizedType.includes("application/json")) return true;
  const trimmed = body.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function localApiProxyPlugin() {
  return {
    name: "local-api-proxy",
    configureServer(server: any) {
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

          const method = req.method || "GET";
          const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);
          const upstream = await fetch(upstreamUrl, { method, headers, body });
          const responseBody = Buffer.from(await upstream.arrayBuffer());
          const responseText = responseBody.toString("utf8");

          if (!upstream.ok && shouldReturnEmptyOnFailure(proxyPath)) {
            sendFallback(res, proxyPath, upstream.status, responseText);
            return;
          }

          if (upstream.ok && shouldReturnEmptyOnFailure(proxyPath) && !isJsonResponse(upstream.headers.get("content-type"), responseText)) {
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

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), localApiProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react-day-picker", "date-fns", "date-fns/locale"],
  },
});

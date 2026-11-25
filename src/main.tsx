import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/operacional-square.css";
import "./styles/comercial-square.css";
import "./styles/financeiro-square.css";
import { installStaleBundleRecovery } from "./utils/staleBundleRecovery";
import { isLocalPreviewEnabled } from "./config/localPreview";
import { consultarSessaoVisitas } from "./pages/visitas/visitasApi";

installStaleBundleRecovery(window, {
  reload: () => window.location.reload(),
  storage: window.sessionStorage,
});

// Sync marker to trigger external preview rebuilds when needed.
const root = createRoot(document.getElementById("root")!);
const pathname = window.location.pathname.replace(/\/$/, "");
const isVisitas = pathname === "/visitas";

async function iniciar() {
  if (!isVisitas && !isLocalPreviewEnabled()) {
    const sessao = await consultarSessaoVisitas(undefined, AbortSignal.timeout?.(1500)).catch(() => null);
    if (sessao) {
      window.location.replace('/visitas');
      return;
    }
  }

  const { default: App } = await (isVisitas ? import("./pages/visitas/VisitasApp") : import("./App"));
  root.render(<App />);
}

void iniciar();

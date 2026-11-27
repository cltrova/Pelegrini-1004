import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/operacional-square.css";
import "./styles/comercial-square.css";
import "./styles/financeiro-square.css";
import "./styles/management-workspace.css";
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
  const redirecionamento = !isVisitas && !isLocalPreviewEnabled()
    ? consultarSessaoVisitas(undefined, AbortSignal.timeout?.(1500)).catch(() => null).then(sessao => {
      if (!sessao) return false;
      window.location.replace('/visitas');
      return true;
    })
    : Promise.resolve(false);

  const [{ default: App }, redirecionado] = await Promise.all([
    isVisitas ? import("./pages/visitas/VisitasApp") : import("./App"),
    redirecionamento,
  ]);
  if (!redirecionado) root.render(<App />);
}

void iniciar();

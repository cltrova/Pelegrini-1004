import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/operacional-square.css";
import "./styles/comercial-square.css";
import "./styles/financeiro-square.css";
import { installStaleBundleRecovery } from "./utils/staleBundleRecovery";

installStaleBundleRecovery(window, {
  reload: () => window.location.reload(),
  storage: window.sessionStorage,
});

// Sync marker to trigger external preview rebuilds when needed.
const root = createRoot(document.getElementById("root")!);
const pathname = window.location.pathname.replace(/\/$/, "");
const isVisitas = pathname === "/visitas" || pathname === "/comercial/visitas";
const entry = isVisitas ? import("./pages/visitas/VisitasApp") : import("./App");
void entry.then(({ default: App }) => root.render(<App />));

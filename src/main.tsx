import { createRoot } from "react-dom/client";
import App from "./App.tsx";
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
createRoot(document.getElementById("root")!).render(<App />);

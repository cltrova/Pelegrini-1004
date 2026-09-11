import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/operacional-square.css";

// Sync marker to trigger external preview rebuilds when needed.
createRoot(document.getElementById("root")!).render(<App />);

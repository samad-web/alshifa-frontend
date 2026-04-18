import { initSentry } from './lib/sentry';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/tokens.css";
import "./i18n";

initSentry();

createRoot(document.getElementById("root")!).render(<App />);

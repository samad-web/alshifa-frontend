import { initSentry } from './lib/sentry';
import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";
import "./styles/tokens.css";
import "./i18n";

initSentry();

// Register the service worker. `autoUpdate` mode handles reload on SW update
// automatically; we also listen for offline readiness to surface a toast.
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      // Fires once per user device when the service worker is cached.
      // "It just works" — silent success.
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);

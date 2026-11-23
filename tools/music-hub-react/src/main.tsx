import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { markAppWindow, rememberAppWindow, restoreAppWindow } from "./appWindow";
import "./index.css";
import { registerServiceWorker } from "./pwa";

registerServiceWorker();
markAppWindow(); // an installed app window keeps the page at least 1090 px wide (index.css)
restoreAppWindow(); // opens at the size it had last time (at least 1090 x 600 the first time, as the current page does)
rememberAppWindow(); // and keeps its size when you resize it

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { growAppWindow, markAppWindow } from "./appWindow";
import "./index.css";
import { registerServiceWorker } from "./pwa";

registerServiceWorker();
markAppWindow(); // an installed app window keeps the page at least 1090 px wide (index.css)
growAppWindow(); // and opens at least 1090 x 600, as the current page does

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

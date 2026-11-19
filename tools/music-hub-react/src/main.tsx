import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Slice 1 has no screen yet: it is the data and filter layer (src/data) with its tests.
// The table, search box and filters arrive in slice 2.
function App() {
  return <p>Music Hub (React): slice 1, the data layer. Run <code>npm test</code>.</p>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main>
      <h1>WhyNoRun</h1>
    </main>
    <footer>
      whynorun {__VERSION__} ·{" "}
      <a href="THIRD_PARTY_LICENSES.md">Third-party licences</a>
    </footer>
  </StrictMode>,
);

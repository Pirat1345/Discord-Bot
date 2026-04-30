import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { languagesReady } from "./i18n";

languagesReady.then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});

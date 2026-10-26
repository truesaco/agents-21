import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { initTheme } from "./components/theme.js";

// Set <html data-theme> before the first render so the app never paints in the wrong theme.
initTheme();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

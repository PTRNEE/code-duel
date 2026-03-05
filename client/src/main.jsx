import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { BattleProvider } from "./context/BattleContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <BattleProvider>
      <App />
    </BattleProvider>
  </ThemeProvider>
);
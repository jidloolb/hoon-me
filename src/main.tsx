import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { loadStore } from "./store";
import "./index.css";

loadStore();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 오프라인 실행: 빌드본에서만 service worker 등록
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import AppUpdate from "./components/AppUpdate";
import "./index.css";

const Admin = lazy(() => import("./pages/Admin"));
const Account = lazy(() => import("./pages/Account"));

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AppUpdate />
    <Suspense fallback={<div className="route-loading">Loading Bright Accessories…</div>}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/account" element={<Account />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

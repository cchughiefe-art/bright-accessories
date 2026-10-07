import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import AppUpdate from "./components/AppUpdate";
import SplashIntro from "./components/SplashIntro";
import "./index.css";

const Admin = lazy(() => import("./pages/Admin"));
const Account = lazy(() => import("./pages/Account"));
const Download = lazy(() => import("./pages/Download"));

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <SplashIntro />
    <AppUpdate />
    <Suspense fallback={<div className="route-loading">Loading Bright Accessories…</div>}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/account" element={<Account />} />
        <Route path="/download" element={<Download />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Admin from "./pages/Admin";
import Account from "./pages/Account";
import AppUpdate from "./components/AppUpdate";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AppUpdate />
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/account" element={<Account />} />
    </Routes>
  </BrowserRouter>
);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./index.css";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { NewEstimate } from "./pages/NewEstimate";
import { EstimateDetail } from "./pages/EstimateDetail";
import { History } from "./pages/History";
import { ImportPage } from "./pages/ImportPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nyt-estimat" element={<NewEstimate />} />
          <Route path="/estimat/:id" element={<EstimateDetail />} />
          <Route path="/historik" element={<History />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

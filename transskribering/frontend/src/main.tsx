import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { AppShell } from "./components/AppShell";
import { UploadPage } from "./pages/UploadPage";
import { StatusPage } from "./pages/StatusPage";
import { ResultPage } from "./pages/ResultPage";
import { HistoryPage } from "./pages/HistoryPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/jobs/:id/status" element={<StatusPage />} />
          <Route path="/jobs/:id" element={<ResultPage />} />
          <Route path="/historik" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  </React.StrictMode>
);

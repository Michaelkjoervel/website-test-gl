import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import "./index.css";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { NewEstimate } from "./pages/NewEstimate";
import { EstimateDetail } from "./pages/EstimateDetail";
import { History } from "./pages/History";
import { ImportPage } from "./pages/ImportPage";
import { BusinessCase } from "./pages/BusinessCase";
import { Univers } from "./pages/Univers";
import { NewVisualization } from "./pages/NewVisualization";
import { Visualizations } from "./pages/Visualizations";
import { VisualizationDetail } from "./pages/VisualizationDetail";
import { AuthProvider } from "./components/AuthProvider";
import { RequireAuth } from "./components/RequireAuth";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Fuldskærms kundevendt præsentation – uden for app-skallen (offentlig) */}
          <Route path="/forretningscase/:id" element={<BusinessCase />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nyt-estimat" element={<NewEstimate />} />
            <Route path="/estimat/:id" element={<EstimateDetail />} />
            <Route path="/historik" element={<History />} />
            <Route path="/import" element={<ImportPage />} />
            {/* Visualiseringsunivers – kræver login når det er slået til */}
            <Route path="/univers" element={<RequireAuth><Univers /></RequireAuth>} />
            <Route path="/ny-visualisering" element={<RequireAuth><NewVisualization /></RequireAuth>} />
            <Route path="/visualiseringer" element={<RequireAuth><Visualizations /></RequireAuth>} />
            <Route path="/visualisering/:id" element={<RequireAuth><VisualizationDetail /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  </React.StrictMode>,
);

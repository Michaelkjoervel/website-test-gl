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
import { PricingAdmin } from "./pages/PricingAdmin";
import { AuthProvider } from "./components/AuthProvider";
import { RequireAuth } from "./components/RequireAuth";
import { PricingProvider } from "./components/PricingProvider";

// Hele appen er lukket: alt kræver login (når Supabase er konfigureret),
// og det fortrolige prisgrundlag hentes først EFTER login via
// PricingProvider. Uden login vises kun login-skærmen.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <RequireAuth>
        <PricingProvider>
          <HashRouter>
            <Routes>
              {/* Fuldskærms kundevendt præsentation – uden for app-skallen */}
              <Route path="/forretningscase/:id" element={<BusinessCase />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/nyt-estimat" element={<NewEstimate />} />
                <Route path="/estimat/:id" element={<EstimateDetail />} />
                <Route path="/historik" element={<History />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/prisdata" element={<PricingAdmin />} />
                <Route path="/univers" element={<Univers />} />
                <Route path="/ny-visualisering" element={<NewVisualization />} />
                <Route path="/visualiseringer" element={<Visualizations />} />
                <Route path="/visualisering/:id" element={<VisualizationDetail />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </PricingProvider>
      </RequireAuth>
    </AuthProvider>
  </React.StrictMode>,
);

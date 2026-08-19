// =============================================================================
// app/App · Ruter
// -----------------------------------------------------------------------------
// HashRouter, fordi appen serveres statisk under en understi (GitHub Pages) —
// præcis som resten af green lights værktøjer.
//
// Selve samtalen (/session/:id) ligger UDEN FOR app-skallen. Under en øvelse
// skal der ikke være en sidebar at kigge på.
// =============================================================================

import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./Shell";
import { AuthProvider, RequireAuth } from "../lib/auth";
import { ToastHost } from "../ui/primitives";

import { Home } from "../pages/Home";
import { TrainingSetup } from "../pages/TrainingSetup";
import { LiveSession } from "../pages/LiveSession";
import { Debrief } from "../pages/Debrief";
import { History } from "../pages/History";
import { Development } from "../pages/Development";
import { Materials } from "../pages/Materials";
import { MaterialDetail } from "../pages/MaterialDetail";
import { ManagerDashboard } from "../pages/ManagerDashboard";
import { ManagerSeller } from "../pages/ManagerSeller";
import { ManualLibrary } from "../pages/ManualLibrary";
import { VoiceCheck } from "../pages/VoiceCheck";

export function App() {
  return (
    <AuthProvider>
      <ToastHost>
        <RequireAuth>
          <HashRouter>
            <Routes>
              {/* Fuldskærms samtale — bevidst uden app-skal */}
              <Route path="/session/:sessionId" element={<LiveSession />} />

              <Route element={<Shell />}>
                <Route path="/" element={<Home />} />
                <Route path="/traening/:modeId" element={<TrainingSetup />} />
                <Route path="/debriefing/:sessionId" element={<Debrief />} />
                <Route path="/historik" element={<History />} />
                <Route path="/udvikling" element={<Development />} />
                <Route path="/materiale" element={<Materials />} />
                <Route path="/materiale/:documentId" element={<MaterialDetail />} />
                <Route path="/manual" element={<ManualLibrary />} />
                <Route path="/stemmetest" element={<VoiceCheck />} />
                <Route path="/ledelse" element={<ManagerDashboard />} />
                <Route path="/ledelse/:initials" element={<ManagerSeller />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </RequireAuth>
      </ToastHost>
    </AuthProvider>
  );
}

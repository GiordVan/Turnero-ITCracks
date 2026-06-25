import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import KioskoPage from './pages/KioskoPage';
import ReservarPage from './pages/ReservarPage';
import MisTurnosPage from './pages/MisTurnosPage';
import TurnosPage from './pages/admin/TurnosPage';
import ConfigPage from './pages/admin/ConfigPage';
import NotificacionesPage from './pages/admin/NotificacionesPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Público */}
          <Route path="/kiosko" element={<KioskoPage />} />
          <Route path="/kiosko/reservar" element={<ReservarPage />} />
          <Route path="/kiosko/mis-turnos" element={<MisTurnosPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Admin */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Navigate to="/admin/turnos" replace />} />
              <Route path="/admin/turnos" element={<TurnosPage />} />
              <Route path="/admin/config" element={<ConfigPage />} />
              <Route path="/admin/notificaciones" element={<NotificacionesPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/kiosko" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

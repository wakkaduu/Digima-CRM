import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { PasswordPage } from './pages/PasswordPage';
import { SubmitPaymentPage } from './pages/SubmitPaymentPage';

// Admin-only screens are split out of the main bundle.
const AdminPendingPage = lazy(() => import('./pages/AdminPendingPage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));

export function App() {
  return (
    <Suspense fallback={<p className="page hint">Loading…</p>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/password" element={<PasswordPage />} />
        </Route>
        {/* Strict roles: sales submit payments, admins approve them. */}
        <Route element={<RequireAuth roles={['sales']} />}>
          <Route path="/" element={<SubmitPaymentPage />} />
        </Route>
        <Route element={<RequireAuth roles={['admin']} />}>
          <Route path="/admin" element={<AdminPendingPage />} />
          <Route path="/setup" element={<SetupPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

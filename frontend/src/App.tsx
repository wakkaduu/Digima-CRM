import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './components/RequireAuth';
import { Skeleton } from './components/ui/States';
import { LoginPage } from './pages/LoginPage';
import { MyPaymentsPage } from './pages/MyPaymentsPage';
import { ForbiddenPage, NotFoundPage } from './pages/NotFoundPage';
import { PasswordPage } from './pages/PasswordPage';
import { SubmitPaymentPage } from './pages/SubmitPaymentPage';

// Admin-only screens are split out of the main bundle.
const AdminPendingPage = lazy(() => import('./pages/AdminPendingPage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));

function PageFallback() {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/password" element={<PasswordPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        {/* Strict roles: sales submit payments, admins approve them. */}
        <Route element={<RequireAuth roles={['sales']} />}>
          <Route path="/" element={<Navigate to="/payments/new" replace />} />
          <Route path="/payments/new" element={<SubmitPaymentPage />} />
          <Route path="/payments" element={<MyPaymentsPage />} />
        </Route>
        <Route element={<RequireAuth roles={['admin']} />}>
          <Route path="/admin/:id?" element={<AdminPendingPage />} />
          <Route path="/setup" element={<SetupPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

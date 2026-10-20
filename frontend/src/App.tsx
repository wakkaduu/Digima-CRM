import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { RequireAuth } from './components/RequireAuth';
import { PageSkeleton } from './components/ui/Skeletons';
import { LoginPage } from './pages/LoginPage';
import { MyPaymentsPage } from './pages/MyPaymentsPage';
import { ForbiddenPage, NotFoundPage } from './pages/NotFoundPage';
import { PasswordPage } from './pages/PasswordPage';
import { SubmitPaymentPage } from './pages/SubmitPaymentPage';

// Admin-only screens are split out of the main bundle.
const AdminPendingPage = lazy(() => import('./pages/AdminPendingPage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage'));
const EstimatesPage = lazy(() => import('./pages/EstimatesPage'));
const EstimateDetailPage = lazy(() => import('./pages/EstimateDetailPage'));

/** Old URLs keep working: bookmarks, and the OAuth redirect URL that QuickBooks may still hold. */
function Redirect({ to }: { to: (id?: string) => string }) {
  const { id } = useParams();
  const { search } = useLocation();
  return <Navigate to={to(id) + search} replace />;
}

export function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/password" element={<PasswordPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        {/* Strict roles: sales submit payments, admins approve them. */}
        <Route element={<RequireAuth roles={['sales']} />}>
          <Route path="/payments/new" element={<SubmitPaymentPage />} />
          <Route path="/payments" element={<MyPaymentsPage />} />
        </Route>
        <Route element={<RequireAuth roles={['sales', 'admin']} />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/estimates" element={<EstimatesPage />} />
          <Route path="/estimates/:id" element={<EstimateDetailPage />} />
        </Route>
        <Route element={<RequireAuth roles={['admin']} />}>
          <Route path="/payments/review/:id?" element={<AdminPendingPage />} />
          <Route path="/settings/integrations" element={<SetupPage />} />
          <Route path="/admin/:id?" element={<Redirect to={(id) => (id ? `/payments/review/${id}` : '/payments/review')} />} />
          <Route path="/setup" element={<Redirect to={() => '/settings/integrations'} />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

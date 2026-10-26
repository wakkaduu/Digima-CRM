import { useMe } from '../api/auth';
import { AdminDashboard } from '../components/dashboard/AdminDashboard';
import { ExecutiveDashboard } from '../components/dashboard/ExecutiveDashboard';
import { SalesDashboard } from '../components/dashboard/SalesDashboard';
import { PageHeader } from '../components/ui/PageHeader';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/** "Good morning" / "afternoon" / "evening" by the hour in the company's timezone. */
export function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(now));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

const today = () => new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });

/** Role-based home: sales see their payments and next steps, admins see the review queue and QuickBooks health, SuperAdmins an overview. */
export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { data: me } = useMe();
  if (!me) return null;
  // The SuperAdmin overview is titled by what it is and carries its own header (the finding replaces the date).
  if (me.role === 'superadmin') return <ExecutiveDashboard />;
  const first = me.name.split(/\s+/)[0];

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${first}`}
        description={today()}
      />
      {me.role === 'admin' ? <AdminDashboard /> : <SalesDashboard />}
    </div>
  );
}

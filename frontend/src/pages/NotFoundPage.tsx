import { Link } from 'react-router';
import { Compass, ShieldAlert } from 'lucide-react';
import { useMe, homePath } from '../api/auth';
import { buttonClass } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';
import { useDocumentTitle } from '../lib/useDocumentTitle';

function Home() {
  const { data: user } = useMe();
  return (
    <Link to={user ? homePath(user) : '/login'} className={buttonClass({ variant: 'primary' })}>
      Go to your home page
    </Link>
  );
}

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <EmptyState icon={Compass} title="Page not found" action={<Home />}>
      The page you are looking for does not exist or has moved.
    </EmptyState>
  );
}

export function ForbiddenPage() {
  useDocumentTitle('No access');
  return (
    <EmptyState icon={ShieldAlert} title="You do not have access to this page" action={<Home />}>
      Ask an admin if you think you should.
    </EmptyState>
  );
}

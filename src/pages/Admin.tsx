import { useAdmin } from '@/contexts/AdminContext';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

const AdminPage = () => {
  const { isAuthenticated } = useAdmin();

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
};

export default AdminPage;

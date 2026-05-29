import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageLoader } from './ui/Spinner';
import useAuthStore from '../store/authStore';

export default function ProtectedRoute() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const admin = useAuthStore((state) => state.admin);

  if (status === 'idle' || status === 'loading') {
    return <FullPageLoader />;
  }

  if (status !== 'authenticated' || !admin) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

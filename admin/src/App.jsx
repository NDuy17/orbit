import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { FullPageLoader } from './components/ui/Spinner';
import ToastViewport from './components/ui/ToastViewport';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import useAuthStore from './store/authStore';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastViewport />
    </ErrorBoundary>
  );
}

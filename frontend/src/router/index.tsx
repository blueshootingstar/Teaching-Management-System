import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import Login from '../pages/Login';
import MainLayout from '../layouts/MainLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import StudentDashboard from '../pages/student/StudentDashboard';
import TeacherDashboard from '../pages/teacher/TeacherDashboard';
import type { CurrentUser, UserRole } from '../types';

function getUser(): CurrentUser | null {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function RoleRoute({ role, children }: { role: UserRole; children: ReactNode }) {
  const token = localStorage.getItem('token');
  const user = getUser();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return <MainLayout>{children}</MainLayout>;
}

function HomeRedirect() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <Login /> },
  { path: '/admin', element: <RoleRoute role="admin"><AdminDashboard /></RoleRoute> },
  { path: '/student', element: <RoleRoute role="student"><StudentDashboard /></RoleRoute> },
  { path: '/teacher', element: <RoleRoute role="teacher"><TeacherDashboard /></RoleRoute> },
  { path: '*', element: <Navigate to="/" replace /> }
]);

export default router;

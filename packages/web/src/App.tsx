import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api, setToken, clearToken } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { StudentDashboard } from './pages/student/Dashboard';
import { StudentChat } from './pages/student/Chat';
import { CourseDashboard } from './pages/student/CourseDashboard';
import { ProfessorDashboard } from './pages/professor/Dashboard';
import { ProfessorTickets } from './pages/professor/Tickets';
import { CourseSetup } from './pages/professor/CourseSetup';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then((res) => setUser(res.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (token: string, user: User) => {
    setToken(token);
    setUser(user);
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <nav style={{ background: '#1a1a2e', color: 'white', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Course Agent</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>{user.name} ({user.role})</span>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ fontSize: 12 }}>Logout</button>
        </div>
      </nav>
      <div style={{ padding: 20 }}>
        <Routes>
          {user.role === 'student' ? (
            <>
              <Route path="/" element={<StudentDashboard />} />
              <Route path="/course/:courseId" element={<CourseDashboard />} />
              <Route path="/course/:courseId/chat" element={<StudentChat />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<ProfessorDashboard />} />
              <Route path="/course/:courseId/setup" element={<CourseSetup />} />
              <Route path="/course/:courseId/tickets" element={<ProfessorTickets />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

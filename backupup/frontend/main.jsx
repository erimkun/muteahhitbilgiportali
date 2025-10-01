import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './pages/App.jsx';
import AdminApp from './pages/AdminApp.jsx';
import Login from './pages/Login.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Profile from './pages/Profile.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import NotFoundHandler from './components/NotFoundHandler.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={
          <ProtectedRoute>
            <Login />
          </ProtectedRoute>
        } />
        <Route path="/admin/login" element={
          <ProtectedRoute>
            <AdminLogin />
          </ProtectedRoute>
        } />
        
        {/* Protected routes */}
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        
        {/* App routes with authentication check */}
        <Route path="/app" element={<Navigate to="/app/1" replace />} />
        <Route path="/app/:projectId" element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        } />
        
        {/* Admin routes with authentication and authorization check */}
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/:projectId" element={
          <ProtectedRoute>
            <AdminApp />
          </ProtectedRoute>
        } />
        
        {/* Catch-all 404 route - handles authentication-based redirects */}
        <Route path="*" element={<NotFoundHandler />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
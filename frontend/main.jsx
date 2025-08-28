import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './pages/App.jsx';
import AdminApp from './pages/AdminApp.jsx';
import Login from './pages/Login.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
  <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/app" element={<Navigate to="/app/1" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/1" replace />} />
        <Route path="/app/:projectId" element={<App />} />
        <Route path="/admin/:projectId" element={<AdminApp />} />
      </Routes>
  </BrowserRouter>
  </StrictMode>
);
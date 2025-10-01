import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminViewer from '../components/admin/AdminViewer';
import Toolbox from '../components/admin/Toolbox';
import MeasureTool from '../components/admin/MeasureTool';
import AreaSelectTool from '../components/admin/AreaSelectTool';
import AutoAreaClipper from '../components/admin/AutoAreaClipper';
import BuildingPositioner from '../components/admin/BuildingPositioner';
import BoxSelectionTool from '../components/admin/BoxSelectionTool';
import { CesiumProvider } from '../context/CesiumContext';
import { useEffect, useState } from 'react';
import LogoPositioner from '../components/admin/LogoPositioner';
import { checkAuthStatus } from '../utils/authUtils';
import { createApiUrl } from '../config/api';

export default function AdminApp() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [adminVerified, setAdminVerified] = useState(false);
  const [users,setUsers] = useState([]);
  const [showUsers,_setShowUsers] = useState(false);
  
  // Additional authentication check specific to admin access
  useEffect(() => {
    async function verifyAdminAccess() {
      try {
        const { isAuthenticated, isAdmin } = await checkAuthStatus();
        
        if (!isAuthenticated) {
          navigate('/login', { replace: true });
          return;
        }
        
        if (!isAdmin) {
          navigate('/profile', { replace: true });
          return;
        }
        
        setAdminVerified(true);
      } catch (error) {
        console.error('Admin access verification failed:', error);
        navigate('/profile', { replace: true });
      }
    }

    verifyAdminAccess();
  }, [navigate]);

  const loadUsers = async () => {
    try {
      const res = await fetch(createApiUrl('admin/users'), { credentials: 'include' });
      const usersData = await res.json();
      setUsers(usersData);
    } catch (error) {
      console.error('Kullanıcılar yüklenemedi:', error);
    }
  };

  useEffect(() => { 
    if (showUsers) {
      loadUsers();
    }
  }, [showUsers]);

  useEffect(() => {
    // Event listeners for user management
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
      addBtn.onclick = async () => {
        const phone = document.getElementById('newPhone').value.trim();
        const password = document.getElementById('newPass').value.trim();
        const project_id = document.getElementById('newProj').value.trim();
        const name = document.getElementById('newName').value.trim();
        
        if (!phone || !password) {
          alert('Telefon ve parola gerekli');
          return;
        }
        
        try {
          const res = await fetch(createApiUrl('admin/users'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone, password, project_id: project_id || null, name })
          });
          
          if (!res.ok) {
            const error = await res.json();
            alert('Hata: ' + (error.error || 'Bilinmeyen hata'));
            return;
          }
          
          // Clear form
          document.getElementById('newPhone').value = '';
          document.getElementById('newPass').value = '';
          document.getElementById('newProj').value = '';
          document.getElementById('newName').value = '';
          
          // Reload users
          loadUsers();
        } catch (error) {
          alert('Hata: ' + error.message);
        }
      };
    }

    // Event listeners for save/delete buttons
    const handleSave = async (userId) => {
      const row = document.querySelector(`tr[data-user-id="${userId}"]`);
      if (!row) return;
      
      const fields = {};
      row.querySelectorAll('input,select').forEach(el => {
        const field = el.getAttribute('data-f');
        if (!field) return;
        const value = el.value;
        if (value !== '') {
          fields[field] = field === 'is_active' ? (value === '1') : value;
        }
      });
      
      if (!Object.keys(fields).length) {
        alert('Değişiklik yok');
        return;
      }
      
      try {
        const res = await fetch(createApiUrl(`admin/users/${userId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(fields)
        });
        
        if (!res.ok) {
          const error = await res.json();
          alert('Hata: ' + (error.error || 'Bilinmeyen hata'));
          return;
        }
        
        loadUsers();
      } catch (error) {
        alert('Hata: ' + error.message);
      }
    };

    const handleDelete = async (userId) => {
      if (!confirm('Kullanıcı silinsin mi?')) return;
      
      try {
        const res = await fetch(createApiUrl(`admin/users/${userId}`), {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (!res.ok) {
          const error = await res.json();
          alert('Hata: ' + (error.error || 'Bilinmeyen hata'));
          return;
        }
        
        loadUsers();
      } catch (error) {
        alert('Hata: ' + error.message);
      }
    };

    // Attach event listeners to save/delete buttons
    document.addEventListener('click', (e) => {
      if (e.target.getAttribute('data-act') === 'save') {
        const userId = e.target.closest('tr').getAttribute('data-user-id');
        handleSave(userId);
      } else if (e.target.getAttribute('data-act') === 'del') {
        const userId = e.target.closest('tr').getAttribute('data-user-id');
        handleDelete(userId);
      }
    });

    return () => {
      // Cleanup event listeners if needed
    };
  }, [users]);

  // Show loading while verifying admin access
  if (!adminVerified) {
    return (
      <div className="w-full h-screen bg-gray-900 dark overflow-hidden relative flex items-center justify-center">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2 text-sm">Admin yetkisi kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  return (
    <CesiumProvider projectId={Number(projectId) || 1}>
      <div className="w-full h-screen bg-neutral-900 text-white relative overflow-hidden">
        <div className="absolute top-2 left-2 z-50 flex gap-2">
          <button onClick={() => navigate(`/app/${Number(projectId) || 1}`)} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs">App'e dön</button>
        </div>
        {!showUsers && <>
          <AdminViewer projectId={Number(projectId) || 1} />
          <MeasureTool />
          <AreaSelectTool />
          <BoxSelectionTool />
          <AutoAreaClipper />
          <BuildingPositioner />
          <LogoPositioner />
          <Toolbox />
        </>}
        {showUsers && <div className="absolute inset-0 overflow-auto p-6 bg-neutral-950/95">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Kullanıcı Yönetimi</h2>
            
            {/* Yeni Kullanıcı Ekleme Formu */}
            <div className="bg-neutral-800/50 p-4 rounded-lg mb-6 border border-white/10">
              <h3 className="text-lg font-medium mb-3">Yeni Kullanıcı Ekle</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input 
                  id="newPhone" 
                  placeholder="Telefon" 
                  className="px-3 py-2 rounded bg-neutral-700 border border-white/10 text-white placeholder-white/50"
                />
                <input 
                  id="newPass" 
                  placeholder="Parola" 
                  type="password"
                  className="px-3 py-2 rounded bg-neutral-700 border border-white/10 text-white placeholder-white/50"
                />
                <input 
                  id="newProj" 
                  placeholder="Proje ID" 
                  type="number"
                  className="px-3 py-2 rounded bg-neutral-700 border border-white/10 text-white placeholder-white/50"
                />
                <input 
                  id="newName" 
                  placeholder="Ad (opsiyonel)" 
                  className="px-3 py-2 rounded bg-neutral-700 border border-white/10 text-white placeholder-white/50"
                />
              </div>
              <button 
                id="addBtn" 
                className="mt-3 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                Kullanıcı Ekle
              </button>
            </div>

            {/* Kullanıcı Listesi */}
            <div className="bg-neutral-800/50 rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-700/50">
                  <tr className="text-left text-white/80">
                    <th className="p-3">ID</th>
                    <th className="p-3">Telefon</th>
                    <th className="p-3">Ad</th>
                    <th className="p-3">Proje</th>
                    <th className="p-3">Aktif</th>
                    <th className="p-3">Yeni Parola</th>
                    <th className="p-3">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} data-user-id={u.id} className="border-t border-white/10 hover:bg-neutral-700/30">
                      <td className="p-3">{u.id}</td>
                      <td className="p-3">{u.phone}</td>
                      <td className="p-3">
                        <input 
                          value={u.name || ''} 
                          data-f="name" 
                          className="w-full px-2 py-1 rounded bg-neutral-600 border border-white/10 text-white text-sm"
                          placeholder="Ad"
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          value={u.project_id || ''} 
                          data-f="project_id" 
                          type="number" 
                          className="w-20 px-2 py-1 rounded bg-neutral-600 border border-white/10 text-white text-sm"
                          placeholder="Proje"
                        />
                      </td>
                      <td className="p-3">
                        <select 
                          data-f="is_active" 
                          className="px-2 py-1 rounded bg-neutral-600 border border-white/10 text-white text-sm"
                        >
                          <option value="1" selected={u.is_active}>Evet</option>
                          <option value="0" selected={!u.is_active}>Hayır</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input 
                          placeholder="(değiştir)" 
                          type="password" 
                          data-f="password" 
                          className="w-24 px-2 py-1 rounded bg-neutral-600 border border-white/10 text-white text-sm"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button 
                            data-act="save" 
                            className="px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-medium"
                          >
                            Kaydet
                          </button>
                          <button 
                            data-act="del" 
                            className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium"
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>}
      </div>
    </CesiumProvider>
  );
}

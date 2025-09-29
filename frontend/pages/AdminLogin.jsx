import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KentasLogoWhite from '/KentasLogoWhite.png';
import { createApiUrl } from '../config/api';

export default function AdminLogin(){
  const [phone,setPhone] = useState('');
  const [password,setPassword] = useState('');
  const [error,setError] = useState(null);
  const [loading,setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e){
    e.preventDefault();
    setError(null);
    if(!phone || !password) { setError('Telefon ve parola gerekli'); return; }
    setLoading(true);
    try{
      const res = await fetch(createApiUrl('admin/login'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ phone, password }) });
      const js = await res.json();
      if(!res.ok){ setError(js.error || 'Giriş başarısız'); }
      else { navigate('/profile'); }
    }catch(err){ setError(err.message); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-neutral-900/60 p-6 rounded-xl border border-white/10">
        <div className="flex flex-col items-center gap-2">
          <img src={KentasLogoWhite} alt="logo" className="h-16" />
          <h2 className="text-lg font-semibold">Admin Paneli</h2>
        </div>
        <div>
          <label className="text-sm text-white/70">Telefon</label>
          <input className="mt-1 w-full px-3 py-2 rounded bg-neutral-800 border border-white/10 focus:outline-none" value={phone} onChange={e=>setPhone(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-white/70">Parola</label>
          <input type="password" className="mt-1 w-full px-3 py-2 rounded bg-neutral-800 border border-white/10 focus:outline-none" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">{loading? 'Giriş...' : 'Giriş Yap'}</button>
      </form>
    </div>
  );
}

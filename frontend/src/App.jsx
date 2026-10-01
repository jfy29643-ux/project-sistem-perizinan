import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardSiswa from './pages/DashboardSiswa';
import DashboardGuruPiket from './pages/DashboardGuruPiket'; // 1. IMPORT DASHBOARD GURU PIKET
import DashboardSatpam from './pages/DashboardSatpam'; // <-- TAMBAHKAN INI (Sesuaikan path foldernya jika berbeda)
import DashboardAdmin from './pages/DashboardAdmin'; 
import Login from './pages/Login.jsx';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('siswa');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const savedToken = localStorage.getItem('token');
      if (savedUser && savedToken) {
        setUserData(savedUser);
        setUsername(savedUser.nama_pengguna || savedUser.username || '');
        setRole(String(savedUser.peran || 'siswa').toLowerCase().replace(/[\s-]/g, '_'));
        setIsLoggedIn(true);
      }
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } finally {
      setAuthReady(true);
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setUsername(user?.nama_pengguna || user?.username || '');
    setRole(String(user?.peran || 'siswa').toLowerCase().replace(/[\s-]/g, '_'));
    setUserData(user);
    setIsLoggedIn(true);
  };

  const getDashboardPath = () => {
    if (role === 'siswa') return '/DashboardSiswa';
    if (role.includes('guru') || role.includes('piket')) return '/DashboardGuruPiket';
    if (role.includes('satpam')) return '/DashboardSatpam';
    if (role.includes('admin')) return '/DashboardAdmin';
    return '/Login';
  };

  useEffect(() => {
    const targetPath = isLoggedIn ? getDashboardPath() : '/Login';
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [isLoggedIn, role, location.pathname, navigate]);

  if (!authReady) return null;

  // Jika sudah login dan perannya siswa, tampilkan DashboardSiswa
  if (isLoggedIn && (userData?.peran === 'siswa' || role === 'siswa')) {
    return (
      <DashboardSiswa 
        user={userData || { nama_lengkap: username, peran: role }} 
        onLogout={() => {
          setIsLoggedIn(false);
          setUserData(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }} 
      />
    );
  }

  // 2. JIKA SUDAH LOGIN DAN PERANNYA GURU / GURU PIKET, TAMPILKAN DASHBOARD GURU PIKET
  if (isLoggedIn && (userData?.peran?.toLowerCase().includes('guru') || role.includes('guru') || role.includes('piket'))) {
    return (
      <DashboardGuruPiket 
        user={userData || { nama_lengkap: username, peran: role }} 
        onLogout={() => {
          setIsLoggedIn(false);
          setUserData(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }} 
      />
    );
  }

  // 3. TAMBAHKAN KONDISI INI AGAR SATPAM MEMBUKA DASHBOARD SATPAM (Bukan teks selamat datang)
  if (isLoggedIn && (userData?.peran?.toLowerCase().includes('satpam') || role.includes('satpam'))) {
    return (
      <DashboardSatpam 
        user={userData || { nama_lengkap: username, peran: role }} 
        onLogout={() => {
          setIsLoggedIn(false);
          setUserData(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }} 
      />
    );
  }

  // 2. JIKA SUDAH LOGIN DAN PERANNYA ADMIN/ ADMIN, TAMPILKAN DASHBOARD ADMIN
  if (isLoggedIn && (userData?.peran?.toLowerCase().includes('admin') || role.includes('admin'))) {
    return (
      <DashboardAdmin 
        user={userData || { nama_lengkap: username, peran: role }} 
        onLogout={() => {
          setIsLoggedIn(false);
          setUserData(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }} 
      />
    );
  }


  // Jika sudah login tapi role lain (cadangan)
  if (isLoggedIn) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1>Selamat Datang, {userData?.nama_lengkap || username}!</h1>
        <p>Peran Anda: <b>{userData?.peran || role}</b></p>
        <button 
          onClick={() => {
            setIsLoggedIn(false);
            setUserData(null);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }}
          style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Keluar (Logout)
        </button>
      </div>
    );
  }

  return <Login onLoginSuccess={handleLoginSuccess} />;
}
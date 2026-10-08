const getDynamicApiUrl = (defaultPort = '5000') => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return `http://localhost:${defaultPort}`;
  }
  return ''; // Kosongkan agar langsung menggunakan URL fallback Vercel di bawah
};

// Tambahkan /api di akhir URL agar sesuai dengan backend Express Anda
export const AUTH_API_URL = 
  import.meta.env.VITE_AUTH_API_URL || 'https://project-sistem-perizinan-auth-servi.vercel.app/';

export const PENGAJUAN_API_URL = 
  import.meta.env.VITE_API_URL || 'https://project-sistem-perizinan.vercel.app/api';
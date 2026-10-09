// ======================================================
// SATU-SATUNYA TEMPAT MENGATUR ALAMAT BACKEND
// - Dibuka di localhost -> backend lokal (port 5001)
// - Dibuka di Vercel    -> backend Vercel
// ======================================================
const isLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const alamat = isLocalhost
  ? 'http://localhost:5001'
  : import.meta.env.VITE_API_URL || 'https://pengajuan-smkn-compreng-api.vercel.app';

// hapus tanda "/" di akhir supaya tidak jadi "//"
export const API_URL = alamat.replace(/\/+$/, '');

// nama lama dipertahankan supaya file lain tidak error
export const AUTH_API_URL = API_URL;
export const PENGAJUAN_API_URL = API_URL;

// ======================================================
// fetch yang otomatis membawa token login.
// Kalau server menjawab 401 (token salah / habis), pengguna
// otomatis dikeluarkan dan diarahkan ke halaman login.
// ======================================================
export const getToken = () =>
  (typeof localStorage !== 'undefined' && localStorage.getItem('token')) ||
  (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('token')) ||
  '';

export const authFetch = async (url, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    ['token', 'user', 'activeRole'].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    window.location.reload();
  }

  return response;
};

const apiUrl = (configuredUrl, fallbackUrl) => {
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (import.meta.env.DEV) return 'http://localhost:5002'; // Disesuaikan ke port 5002 sesuai config Vite Anda
  return fallbackUrl;
};

// Menggunakan URL backend Vercel utama Anda yang aktif
export const AUTH_API_URL = apiUrl(
  import.meta.env.VITE_AUTH_API_URL,
  'https://project-sistem-perizinan-auth-servi.vercel.app'
);

export const PENGAJUAN_API_URL = apiUrl(
  import.meta.env.VITE_API_URL,
  'https://project-sistem-perizinan-auth-servi.vercel.app'
);
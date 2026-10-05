const apiUrl = (configuredUrl, fallbackUrl) => {
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (import.meta.env.DEV) return 'http://localhost:5000/api';
  return fallbackUrl; 
};

export const AUTH_API_URL = '/api';

export const PENGAJUAN_API_URL = apiUrl(
  import.meta.env.VITE_API_URL,
  'https://project-sistem-perizinan-auth-service.vercel.app/api'
);
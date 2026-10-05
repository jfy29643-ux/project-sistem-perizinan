const apiUrl = (configuredUrl, fallbackUrl) => {
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (import.meta.env.DEV) return 'http://localhost:5000/api'; // Sesuaikan port lokal backend Anda jika sedang testing di laptop
  return fallbackUrl; // Langsung mengarah ke URL Vercel Backend Anda secara otomatis
};

export const AUTH_API_URL = apiUrl(
  import.meta.env.VITE_AUTH_API_URL,
  'https://project-sistem-perizinan-auth-service.vercel.app/api'
);

export const PENGAJUAN_API_URL = apiUrl(
  import.meta.env.VITE_API_URL,
  'https://project-sistem-perizinan-auth-service.vercel.app/api'
);
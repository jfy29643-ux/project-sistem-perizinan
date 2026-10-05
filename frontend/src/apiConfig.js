const localApiUrl = (port) =>
  import.meta.env.DEV ? '/api' : `http://${window.location.hostname}:${port}/api`;

export const AUTH_API_URL =
  import.meta.env.VITE_AUTH_API_URL || localApiUrl(5000);

export const PENGAJUAN_API_URL =
  import.meta.env.VITE_API_URL || localApiUrl(5002);
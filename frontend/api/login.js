const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://kkjaqqbrwuhukoqpqfsg.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY || 'sb_publishable_VxkqGw4BjPI9KR1hdRo-fg_3SKQx7rx';

export default async function login(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  const namaPengguna = String(req.body?.nama_pengguna || req.body?.username || '').trim();
  const kataSandi = String(req.body?.kata_sandi || req.body?.password || '').trim();

  if (!namaPengguna || !kataSandi) {
    return res.status(400).json({ success: false, message: 'Nama pengguna dan kata sandi wajib diisi.' });
  }

  try {
    const query = new URLSearchParams({
      select: '*',
      nama_pengguna: `ilike.${namaPengguna}`,
      kata_sandi: `eq.${kataSandi}`
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pengguna?${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Login database request failed:', response.status);
      return res.status(503).json({ success: false, message: 'Layanan login sedang bermasalah. Coba lagi nanti.' });
    }

    const users = await response.json();
    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Nama pengguna atau kata sandi salah.' });
    }

    const { kata_sandi: _kataSandi, ...user } = users[0];
    return res.status(200).json({ success: true, message: 'Login Berhasil', user });
  } catch (error) {
    console.error('Login request failed:', error);
    return res.status(503).json({ success: false, message: 'Layanan login tidak dapat dihubungi. Coba lagi nanti.' });
  }
};
// Jalankan SEKALI dari folder auth-service:  node scripts/hash-passwords.js
// Mengubah semua kata sandi teks biasa di tabel "pengguna" menjadi hash.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  auth: { persistSession: false }
});

const hash = (password) =>
  new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${salt.toString('base64')}$${key.toString('base64')}`)
    );
  });

(async () => {
  const { data, error } = await supabase.from('pengguna').select('id_pengguna, nama_pengguna, kata_sandi');
  if (error) throw error;

  let diubah = 0;
  for (const u of data) {
    if (!u.kata_sandi || String(u.kata_sandi).startsWith('scrypt$')) continue;
    const { error: e } = await supabase
      .from('pengguna')
      .update({ kata_sandi: await hash(String(u.kata_sandi)) })
      .eq('id_pengguna', u.id_pengguna);
    if (e) console.error('Gagal:', u.nama_pengguna, e.message);
    else { diubah++; console.log('OK  :', u.nama_pengguna); }
  }
  console.log(`Selesai. ${diubah} akun di-hash dari ${data.length} akun.`);
})().catch((e) => { console.error(e.message); process.exit(1); });

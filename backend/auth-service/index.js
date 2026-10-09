const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ======================================================
// SERVER
// ======================================================
const port = Number(process.env.PORT) || 5001;
const host = process.env.HOST || '0.0.0.0';

// ======================================================
// CORS: hanya website resmi + localhost yang boleh memanggil API
// ======================================================
const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true; // tes langsung (browser tab / curl)
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    // frontend resmi + preview deployment milik project yang sama
    if (/^https:\/\/pengajuan-smkn-compreng(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true;
    if (/^https:\/\/project-sistem-perizinan[a-z0-9-]*\.vercel\.app$/i.test(origin)) return true;
    return extraOrigins.includes(origin);
};

app.use(cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma', 'Expires'],
    maxAge: 86400
}));

// Header keamanan dasar
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    res.setHeader('Cache-Control', 'no-store');
    next();
});

app.use(express.json({ limit: '100kb' }));

// ======================================================
// SUPABASE
// ======================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL / SUPABASE_KEY belum diisi!');
}

const supabase = createClient(
    SUPABASE_URL || 'https://invalid.supabase.co',
    SUPABASE_KEY || 'invalid-key',
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// ======================================================
// HELPER UMUM
// ======================================================
const ok = (res, body, status = 200) => res.status(status).json(body);

// Pesan error detail hanya masuk log server, pengguna cukup lihat pesan umum.
const fail = (res, status, message, err) => {
    if (err) console.error(message, '->', err.message || err);
    return res.status(status).json({ success: false, message });
};

const pick = (obj, keys) => {
    const hasil = {};
    keys.forEach((k) => {
        if (obj && obj[k] !== undefined) hasil[k] = obj[k];
    });
    return hasil;
};

const normalisasiPeran = (peran) =>
    String(peran || '').trim().toLowerCase().replace(/[\s/-]+/g, '_');

const jenisPeran = (peran) => {
    const p = normalisasiPeran(peran);
    if (p.includes('admin')) return 'admin';
    if (p.includes('satpam')) return 'satpam';
    if (p.includes('guru') || p.includes('piket')) return 'guru';
    if (p === 'siswa') return 'siswa';
    return 'lainnya';
};

// ======================================================
// PASSWORD: di-hash dengan scrypt (bawaan Node.js, tanpa library tambahan)
// ======================================================
const scryptAsync = (password, salt) =>
    new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
            err ? reject(err) : resolve(key)
        );
    });

const hashPassword = async (password) => {
    const salt = crypto.randomBytes(16);
    const key = await scryptAsync(password, salt);
    return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
};

const sudahDiHash = (tersimpan) => String(tersimpan || '').startsWith('scrypt$');

const samaAman = (a, b) => {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

const cekPassword = async (input, tersimpan) => {
    if (!tersimpan) return false;
    if (sudahDiHash(tersimpan)) {
        const [, saltB64, keyB64] = String(tersimpan).split('$');
        if (!saltB64 || !keyB64) return false;
        const key = await scryptAsync(input, Buffer.from(saltB64, 'base64'));
        return samaAman(key.toString('base64'), keyB64);
    }
    // Akun lama yang kata sandinya masih teks biasa
    return samaAman(input, tersimpan);
};

// ======================================================
// TOKEN LOGIN (JWT HS256, berlaku 12 jam)
// ======================================================
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_TTL_DETIK = 12 * 60 * 60;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET belum diisi atau kurang dari 32 karakter!');
}

const b64url = (input) => Buffer.from(input).toString('base64url');

const buatToken = (payload) => {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const sekarang = Math.floor(Date.now() / 1000);
    const body = b64url(JSON.stringify({ ...payload, iat: sekarang, exp: sekarang + JWT_TTL_DETIK }));
    const ttd = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${ttd}`;
};

const bacaToken = (token) => {
    if (!JWT_SECRET || JWT_SECRET.length < 32) return null;
    const bagian = String(token || '').split('.');
    if (bagian.length !== 3) return null;
    const [header, body, ttd] = bagian;
    try {
        const h = JSON.parse(Buffer.from(header, 'base64url').toString());
        if (h.alg !== 'HS256') return null;
        const seharusnya = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
        if (!samaAman(ttd, seharusnya)) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
};

// Middleware: wajib login
const wajibLogin = (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = bacaToken(token);
    if (!payload) {
        return fail(res, 401, 'Sesi login tidak valid atau sudah habis. Silakan login ulang.');
    }
    req.user = { ...payload, jenis: jenisPeran(payload.peran) };
    next();
};

// Middleware: batasi berdasarkan peran (admin selalu boleh)
const wajibPeran = (...jenisDiizinkan) => (req, res, next) => {
    if (req.user.jenis === 'admin' || jenisDiizinkan.includes(req.user.jenis)) return next();
    return fail(res, 403, 'Anda tidak memiliki akses untuk fitur ini.');
};

// ======================================================
// PEMBATAS PERCOBAAN LOGIN (per IP + nama pengguna, 10x / 15 menit)
// Catatan: disimpan di memori, jadi sifatnya "sebisanya" di Vercel.
// ======================================================
const percobaanLogin = new Map();
const BATAS_LOGIN = 10;
const JENDELA_LOGIN_MS = 15 * 60 * 1000;

const kunciLogin = (req, nama) => `${req.ip}|${String(nama).toLowerCase()}`;

const loginTerkunci = (kunci) => {
    const rec = percobaanLogin.get(kunci);
    if (!rec) return false;
    if (rec.reset < Date.now()) {
        percobaanLogin.delete(kunci);
        return false;
    }
    return rec.jumlah >= BATAS_LOGIN;
};

const catatLoginGagal = (kunci) => {
    const sekarang = Date.now();
    const rec = percobaanLogin.get(kunci);
    if (!rec || rec.reset < sekarang) {
        percobaanLogin.set(kunci, { jumlah: 1, reset: sekarang + JENDELA_LOGIN_MS });
    } else {
        rec.jumlah += 1;
    }
    if (percobaanLogin.size > 5000) percobaanLogin.clear();
};

// ======================================================
// HOME & HEALTH CHECK
// ======================================================
app.get('/', (req, res) => {
    ok(res, {
        success: true,
        message: 'Server Backend Sistem Perizinan Aktif',
        status: 'online',
        waktu: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    ok(res, {
        success: true,
        ok: true,
        message: 'Backend API aktif',
        konfigurasi: {
            supabase: Boolean(SUPABASE_URL && SUPABASE_KEY),
            jwt: Boolean(JWT_SECRET && JWT_SECRET.length >= 32)
        },
        waktu: new Date().toISOString()
    });
});

// ======================================================
// LOGIN
// ======================================================
app.post('/api/login', async (req, res) => {
    try {
        const body = req.body || {};
        const namaPengguna = String(body.nama_pengguna || body.username || '').trim();
        const kataSandi = String(body.kata_sandi || body.password || '').trim();

        if (!namaPengguna || !kataSandi) {
            return fail(res, 400, 'Nama pengguna dan kata sandi wajib diisi!');
        }
        if (namaPengguna.length > 100 || kataSandi.length > 200) {
            return fail(res, 400, 'Input terlalu panjang.');
        }
        if (!JWT_SECRET || JWT_SECRET.length < 32) {
            return fail(res, 500, 'Server belum dikonfigurasi dengan benar (JWT_SECRET).');
        }

        const kunci = kunciLogin(req, namaPengguna);
        if (loginTerkunci(kunci)) {
            return fail(res, 429, 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.');
        }

        // Cari nama pengguna (tidak peka huruf besar/kecil), karakter khusus di-escape
        const pola = namaPengguna.replace(/[\\%_]/g, (c) => `\\${c}`);
        const { data: kandidat, error } = await supabase
            .from('pengguna')
            .select('*')
            .ilike('nama_pengguna', pola)
            .limit(5);

        if (error) return fail(res, 500, 'Terjadi kesalahan pada database.', error);

        const pengguna = (kandidat || []).find(
            (u) => String(u.nama_pengguna).toLowerCase() === namaPengguna.toLowerCase()
        );

        const cocok = pengguna ? await cekPassword(kataSandi, pengguna.kata_sandi) : false;

        if (!pengguna || !cocok) {
            catatLoginGagal(kunci);
            return fail(res, 401, 'Nama pengguna atau kata sandi salah!');
        }

        percobaanLogin.delete(kunci);

        // Akun lama (teks biasa) otomatis diubah menjadi hash saat berhasil login
        if (!sudahDiHash(pengguna.kata_sandi)) {
            try {
                const hash = await hashPassword(kataSandi);
                await supabase
                    .from('pengguna')
                    .update({ kata_sandi: hash })
                    .eq('id_pengguna', pengguna.id_pengguna);
            } catch (e) {
                console.error('Gagal meng-hash kata sandi lama:', e.message);
            }
        }

        const { kata_sandi: _dibuang, ...userTanpaPassword } = pengguna;
        const token = buatToken({
            sub: pengguna.id_pengguna,
            nama_pengguna: pengguna.nama_pengguna,
            nama_lengkap: pengguna.nama_lengkap || '',
            peran: pengguna.peran || ''
        });

        return ok(res, {
            success: true,
            message: 'Login Berhasil',
            user: userTanpaPassword,
            token
        });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

// Semua endpoint di bawah ini wajib login
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    return wajibLogin(req, res, next);
});

// ======================================================
// 1. PENGAJUAN IZIN (Siswa, Guru, Admin, Satpam)
// ======================================================
const KOLOM_SISWA = [
    'nama_lengkap', 'kelas', 'jenis_kelamin', 'jenis_izin', 'alasan',
    'tanggal', 'waktu_mulai', 'waktu_selesai', 'keterangan'
];
const KOLOM_ADMIN = [...KOLOM_SISWA, 'status', 'catatan_verifikasi'];

const statusMenunggu = (row) => String(row?.status || 'menunggu').toLowerCase().includes('menunggu');

const milikSiswa = (row, user) =>
    String(row.id_pengguna) === String(user.sub) ||
    (row.nama_lengkap &&
        String(row.nama_lengkap).trim().toLowerCase() ===
        String(user.nama_lengkap || '').trim().toLowerCase());

// Satpam butuh format { success, data } dan info verifikasi satpam
const bentukDataSatpam = (row) => {
    const catatan = String(row.catatan_verifikasi || '');
    const lower = catatan.toLowerCase();
    let verifikasi_satpam = null;
    if (lower.includes('ditolak oleh satpam')) {
        verifikasi_satpam = { status_verifikasi: 'Ditolak', catatan_verifikasi: catatan };
    } else if (lower.includes('disetujui oleh satpam')) {
        verifikasi_satpam = { status_verifikasi: 'Disetujui', catatan_verifikasi: catatan };
    }
    return { ...row, verifikasi_satpam };
};

app.get('/pengajuan', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .order('id_pengajuan', { ascending: false });

        if (error) return fail(res, 500, 'Gagal mengambil data pengajuan.', error);

        let hasil = data || [];

        if (req.user.jenis === 'siswa') {
            hasil = hasil.filter((row) => milikSiswa(row, req.user));
        }

        if (String(req.query.role || '').toLowerCase() === 'satpam') {
            if (!['satpam', 'admin'].includes(req.user.jenis)) {
                return fail(res, 403, 'Anda tidak memiliki akses untuk fitur ini.');
            }
            return ok(res, { success: true, data: hasil.map(bentukDataSatpam) });
        }

        return ok(res, hasil);
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

app.post('/pengajuan', wajibPeran('siswa'), async (req, res) => {
    try {
        const data = pick(req.body, KOLOM_SISWA);
        const baris = {
            ...data,
            id_pengguna: req.user.sub,
            status: 'Menunggu'
        };

        const { data: hasil, error } = await supabase
            .from('pengajuan_izin')
            .insert([baris])
            .select();

        if (error) return fail(res, 400, 'Gagal membuat pengajuan.', error);

        return ok(res, { success: true, message: 'Pengajuan berhasil dikirim', data: hasil }, 201);
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

// Ambil 1 pengajuan + cek kepemilikan (dipakai PUT & DELETE)
const ambilPengajuanMilikSiswa = async (req, res) => {
    const { data: row, error } = await supabase
        .from('pengajuan_izin')
        .select('*')
        .eq('id_pengajuan', req.params.id)
        .maybeSingle();

    if (error) {
        fail(res, 500, 'Gagal membaca data pengajuan.', error);
        return null;
    }
    if (!row) {
        fail(res, 404, 'Pengajuan tidak ditemukan.');
        return null;
    }
    if (req.user.jenis === 'siswa') {
        if (!milikSiswa(row, req.user)) {
            fail(res, 403, 'Anda hanya dapat mengubah pengajuan milik sendiri.');
            return null;
        }
        if (!statusMenunggu(row)) {
            fail(res, 409, 'Pengajuan yang sudah diverifikasi tidak dapat diubah atau dihapus.');
            return null;
        }
    }
    return row;
};

app.put('/pengajuan/:id', wajibPeran('siswa'), async (req, res) => {
    try {
        const row = await ambilPengajuanMilikSiswa(req, res);
        if (!row) return;

        const boleh = req.user.jenis === 'admin' ? KOLOM_ADMIN : KOLOM_SISWA;
        const perubahan = pick(req.body, boleh);

        if (Object.keys(perubahan).length === 0) {
            return fail(res, 400, 'Tidak ada data yang diubah.');
        }

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .update(perubahan)
            .eq('id_pengajuan', req.params.id)
            .select();

        if (error) return fail(res, 400, 'Gagal mengupdate pengajuan.', error);

        return ok(res, { success: true, message: 'Berhasil diupdate', data });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

app.delete('/pengajuan/:id', wajibPeran('siswa'), async (req, res) => {
    try {
        const row = await ambilPengajuanMilikSiswa(req, res);
        if (!row) return;

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .delete()
            .eq('id_pengajuan', req.params.id)
            .select();

        if (error) return fail(res, 400, 'Gagal menghapus pengajuan.', error);

        return ok(res, { success: true, message: 'Berhasil dihapus', data });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

// ======================================================
// 2. VERIFIKASI SATPAM (dipakai DashboardSatpam)
// ======================================================
// Satpam menyetujui / menolak pengajuan yang sudah diverifikasi Guru Piket
app.post('/pengajuan/:id/verifikasi', wajibPeran('satpam'), async (req, res) => {
    try {
        const statusMentah = String((req.body || {}).status || '').toLowerCase();
        let status = '';
        if (statusMentah.includes('tolak')) status = 'Ditolak';
        else if (statusMentah.includes('setuju')) status = 'Disetujui';

        if (!status) return fail(res, 400, 'Status harus "Disetujui" atau "Ditolak".');

        const { data: row, error: errBaca } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .eq('id_pengajuan', req.params.id)
            .maybeSingle();

        if (errBaca) return fail(res, 500, 'Gagal membaca data pengajuan.', errBaca);
        if (!row) return fail(res, 404, 'Pengajuan tidak ditemukan.');

        const catatanLama = String(row.catatan_verifikasi || '').toLowerCase();
        if (catatanLama.includes('oleh satpam')) {
            return fail(res, 409, 'Pengajuan ini sudah diverifikasi oleh Satpam.');
        }
        if (!catatanLama.includes('disetujui oleh guru')) {
            return fail(res, 409, 'Pengajuan belum disetujui oleh Guru Piket.');
        }

        const catatan = status === 'Disetujui' ? 'Disetujui oleh Satpam' : 'Ditolak oleh Satpam';

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .update({ status, catatan_verifikasi: catatan })
            .eq('id_pengajuan', req.params.id)
            .select();

        if (error) return fail(res, 400, 'Gagal menyimpan verifikasi Satpam.', error);

        return ok(res, { success: true, message: 'Verifikasi Satpam berhasil disimpan', data });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

// Notifikasi untuk Satpam: pengajuan yang baru saja disetujui Guru Piket
// dan belum diproses Satpam (hanya yang diverifikasi dalam 2 menit terakhir)
app.get('/notifikasi', wajibPeran('satpam'), async (req, res) => {
    try {
        const batas = new Date(Date.now() - 2 * 60 * 1000).toISOString();

        const { data: verif, error } = await supabase
            .from('verifikasi_pengajuan')
            .select('id_verifikasi_pengajuan, id_pengajuan, status_verifikasi, tanggal_verifikasi')
            .gte('tanggal_verifikasi', batas)
            .order('tanggal_verifikasi', { ascending: false })
            .limit(20);

        if (error) return fail(res, 500, 'Gagal mengambil notifikasi.', error);
        if (!verif || verif.length === 0) return ok(res, { success: true, data: [] });

        const ids = [...new Set(verif.map((v) => v.id_pengajuan))];

        const { data: pengajuan, error: errP } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .in('id_pengajuan', ids);

        if (errP) return fail(res, 500, 'Gagal mengambil notifikasi.', errP);

        const perId = new Map((pengajuan || []).map((p) => [String(p.id_pengajuan), p]));

        const data = verif
            .map((v) => ({ v, p: perId.get(String(v.id_pengajuan)) }))
            .filter(({ p }) => {
                if (!p) return false;
                // hanya yang sudah disetujui Guru Piket & belum diproses Satpam
                return String(p.catatan_verifikasi || '').toLowerCase().includes('disetujui oleh guru');
            })
            .map(({ v, p }) => ({
                id_pengajuan: p.id_pengajuan,
                nama_lengkap: p.nama_lengkap,
                kelas: p.kelas,
                notification_key: `v${v.id_verifikasi_pengajuan}`,
                tanggal_verifikasi: v.tanggal_verifikasi
            }));

        return ok(res, { success: true, data });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

// ======================================================
// 3. DASHBOARD GURU PIKET
// ======================================================
app.get('/verifikasi-pengajuan', wajibPeran('guru'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .order('id_pengajuan', { ascending: false });

        if (error) return fail(res, 500, 'Gagal mengambil data pengajuan.', error);

        return ok(res, data || []);
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

app.patch('/verifikasi-pengajuan/:id/status', wajibPeran('guru'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, total_izin } = req.body || {};

        const statusMentah = String(status || '').toLowerCase();
        let statusFinal = '';
        if (statusMentah.includes('tolak')) statusFinal = 'Ditolak';
        else if (statusMentah.includes('setuju')) statusFinal = 'Disetujui';
        if (!statusFinal) return fail(res, 400, 'Status harus "Disetujui" atau "Ditolak".');

        // id guru diambil dari token login, bukan dari kiriman browser
        const idGuru = Number(req.user.sub) || 1;
        // catatan dibuat oleh server (bukan dari browser) agar Satpam bisa mengenalinya
        const catatan = statusFinal === 'Disetujui' ? 'Disetujui oleh Guru Piket' : 'Ditolak oleh Guru Piket';

        const { error: updateError } = await supabase
            .from('pengajuan_izin')
            .update({ status: statusFinal, catatan_verifikasi: catatan })
            .eq('id_pengajuan', id);

        if (updateError) return fail(res, 400, 'Gagal update pengajuan.', updateError);

        const { data: verifData, error: verifError } = await supabase
            .from('verifikasi_pengajuan')
            .insert([
                {
                    id_pengajuan: Number(id),
                    id_guru: idGuru,
                    status_verifikasi: statusFinal,
                    catatan_verifikasi: catatan,
                    tanggal_verifikasi: new Date().toISOString(),
                    total_izin: Number(total_izin) || 1
                }
            ])
            .select();

        if (verifError) return fail(res, 400, 'Gagal menyimpan ke verifikasi_pengajuan.', verifError);

        return ok(res, {
            success: true,
            message: 'Status verifikasi berhasil disimpan ke verifikasi_pengajuan',
            data: verifData
        });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

// ======================================================
// 4. ENDPOINT SATPAM (tambahan)
// ======================================================
app.get('/satpam/izin-keluar', wajibPeran('satpam'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .or('status.ilike.%Disetujui%,status.ilike.%Setuju%')
            .order('tanggal', { ascending: false });

        if (error) return fail(res, 500, 'Gagal mengambil data izin keluar.', error);

        return ok(res, data || []);
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

app.patch('/satpam/catat-waktu/:id', wajibPeran('satpam'), async (req, res) => {
    try {
        const { waktu_keluar_riil, waktu_kembali_riil, status_kehadiran } = req.body || {};

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .update({ waktu_keluar_riil, waktu_kembali_riil, status_kehadiran })
            .eq('id_pengajuan', req.params.id)
            .select();

        if (error) return fail(res, 400, 'Gagal mencatat waktu satpam.', error);

        return ok(res, { success: true, message: 'Catatan waktu satpam berhasil disimpan', data });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

// ======================================================
// 5. ENDPOINT ADMIN
// ======================================================
app.get('/admin/statistik', wajibPeran(), async (req, res) => {
    try {
        const { data, error } = await supabase.from('pengajuan_izin').select('*');
        if (error) return fail(res, 500, 'Gagal mengambil statistik.', error);

        const semua = data || [];
        const cari = (kata) => semua.filter((i) => String(i.status).toLowerCase().includes(kata)).length;

        return ok(res, {
            success: true,
            statistik: {
                total_izin: semua.length,
                total_disetujui: cari('setuju'),
                total_menunggu: cari('menunggu')
            },
            data: semua
        });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

app.get('/admin/pengguna', wajibPeran(), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengguna')
            .select('id_pengguna, nama_lengkap, nama_pengguna, peran, kelas');

        if (error) return fail(res, 500, 'Gagal mengambil data pengguna.', error);

        return ok(res, data || []);
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

app.post('/admin/pengguna', wajibPeran(), async (req, res) => {
    try {
        const input = pick(req.body, ['nama_lengkap', 'nama_pengguna', 'kata_sandi', 'peran', 'kelas']);

        if (!input.nama_pengguna || !input.kata_sandi || !input.peran) {
            return fail(res, 400, 'Nama pengguna, kata sandi, dan peran wajib diisi.');
        }
        if (String(input.kata_sandi).length < 6) {
            return fail(res, 400, 'Kata sandi minimal 6 karakter.');
        }

        input.kata_sandi = await hashPassword(String(input.kata_sandi));

        const { data, error } = await supabase
            .from('pengguna')
            .insert([input])
            .select('id_pengguna, nama_lengkap, nama_pengguna, peran, kelas');

        if (error) return fail(res, 400, 'Gagal menambahkan pengguna.', error);

        return ok(res, { success: true, message: 'Pengguna berhasil ditambahkan', data }, 201);
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

app.delete('/admin/pengguna/:id', wajibPeran(), async (req, res) => {
    try {
        if (String(req.params.id) === String(req.user.sub)) {
            return fail(res, 400, 'Anda tidak dapat menghapus akun sendiri.');
        }

        const { data, error } = await supabase
            .from('pengguna')
            .delete()
            .eq('id_pengguna', req.params.id)
            .select('id_pengguna');

        if (error) return fail(res, 400, 'Gagal menghapus pengguna.', error);

        return ok(res, { success: true, message: 'Pengguna berhasil dihapus', data });
    } catch (err) {
        return fail(res, 500, 'Terjadi kesalahan pada server.', err);
    }
});

// ======================================================
// 404 & ERROR HANDLER
// ======================================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        return fail(res, 400, 'Format data yang dikirim tidak valid.');
    }
    return fail(res, 500, 'Terjadi kesalahan pada server.', err);
});

// ======================================================
// SERVER LOKAL & VERCEL EXPORT
// ======================================================
if (!process.env.VERCEL) {
    app.listen(port, host, () => {
        console.log('========================================');
        console.log('🚀 BACKEND SISTEM PERIZINAN AKTIF');
        console.log('========================================');
        console.log(`Local  : http://localhost:${port}`);
        console.log('========================================');
    });
}

module.exports = app;

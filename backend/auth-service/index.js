const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ======================================================
// SERVER
// ======================================================
const port = Number(process.env.PORT) || 5001;
const host = process.env.HOST || '0.0.0.0';

// ======================================================
// CORS Konfigurasi
// ======================================================
const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    if (/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(origin)) return true;
    return extraOrigins.includes(origin);
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json());

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
    SUPABASE_KEY || 'invalid-key'
);

// ======================================================
// HOME & HEALTH CHECK
// ======================================================
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server Backend Sistem Perizinan Aktif',
        status: 'online',
        database: SUPABASE_URL ? 'Supabase configured' : 'Supabase belum dikonfigurasi',
        waktu: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        ok: true,
        message: 'Backend API aktif',
        waktu: new Date().toISOString()
    });
});

// ======================================================
// LOGIN
// ======================================================
app.post('/api/login', async (req, res) => {
    try {
        const body = req.body || {};
        let nama_pengguna = body.nama_pengguna || body.username || '';
        let kata_sandi = body.kata_sandi || body.password || '';

        nama_pengguna = String(nama_pengguna).trim();
        kata_sandi = String(kata_sandi).trim();

        if (!nama_pengguna || !kata_sandi) {
            return res.status(400).json({
                success: false,
                message: 'Nama pengguna dan kata sandi wajib diisi!'
            });
        }

        const { data, error } = await supabase
            .from('pengguna')
            .select('*')
            .ilike('nama_pengguna', nama_pengguna)
            .eq('kata_sandi', kata_sandi)
            .maybeSingle();

        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Database Error: ' + error.message
            });
        }

        if (data) {
            const { kata_sandi: passwordTidakDikirim, ...userTanpaPassword } = data;
            return res.status(200).json({
                success: true,
                message: 'Login Berhasil',
                user: userTanpaPassword,
                token: 'dummy-jwt-token-auth'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Nama pengguna atau kata sandi salah!'
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Server Error: ' + err.message
        });
    }
});

// ======================================================
// 1. ENDPOINT PENGAJUAN (Siswa & Umum)
// ======================================================
app.get('/pengajuan', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengajuan_izin') 
            .select('*')
            .order('id_pengajuan', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        return res.status(200).json(data || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/pengajuan', async (req, res) => {
    try {
        const body = req.body || {};
        const { data, error } = await supabase
            .from('pengajuan_izin')
            .insert([body])
            .select();

        if (error) {
            return res.status(400).json({ success: false, message: 'Gagal membuat pengajuan: ' + error.message });
        }

        return res.status(201).json({ success: true, message: 'Pengajuan berhasil dikirim', data });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
});

app.put('/pengajuan/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .update(body)
            .eq('id_pengajuan', id)
            .select();

        if (error) {
            return res.status(400).json({ success: false, message: 'Gagal mengupdate: ' + error.message });
        }

        return res.status(200).json({ success: true, message: 'Berhasil diupdate', data });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
});

app.delete('/pengajuan/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .delete()
            .eq('id_pengajuan', id)
            .select();

        if (error) {
            return res.status(400).json({ success: false, message: 'Gagal menghapus: ' + error.message });
        }

        return res.status(200).json({ success: true, message: 'Berhasil dihapus', data });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});


// ======================================================
// 2. ENDPOINT KHUSUS DASHBOARD GURU PIKET
// ======================================================
// Mengambil data untuk tabel verifikasi_pengajuan (atau gabungan data pengajuan)
app.get('/verifikasi-pengajuan', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .order('id_pengajuan', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        return res.status(200).json(data || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Mengubah status izin siswa dan menyimpan rekamannya ke tabel verifikasi_pengajuan
app.patch('/verifikasi-pengajuan/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, catatan_verifikasi, id_guru, total_izin } = req.body;

        // 1. Update status pada tabel pengajuan_izin
        const { error: updateError } = await supabase
            .from('pengajuan_izin')
            .update({ 
                status: status, 
                catatan_verifikasi: catatan_verifikasi || '' 
            })
            .eq('id_pengajuan', id);

        if (updateError) {
            return res.status(400).json({ success: false, message: 'Gagal update pengajuan: ' + updateError.message });
        }

        // 2. INSERT data ke tabel verifikasi_pengajuan sesuai kolom yang diminta
        const { data: verifData, error: verifError } = await supabase
            .from('verifikasi_pengajuan')
            .insert([
                {
                    id_pengajuan: Number(id),
                    id_guru: Number(id_guru) || 1,
                    status_verifikasi: status,
                    catatan_verifikasi: catatan_verifikasi || '',
                    tanggal_verifikasi: new Date().toISOString(),
                    total_izin: Number(total_izin) || 1
                }
            ])
            .select();

        if (verifError) {
            return res.status(400).json({ success: false, message: 'Gagal menyimpan ke verifikasi_pengajuan: ' + verifError.message });
        }

        return res.status(200).json({ success: true, message: 'Status verifikasi berhasil disimpan ke verifikasi_pengajuan', data: verifData });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
});


// ======================================================
// 3. ENDPOINT KHUSUS DASHBOARD SATPAM
// ======================================================
// Memantau izin keluar/masuk siswa yang sudah disetujui
app.get('/satpam/izin-keluar', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .or('status.ilike.%Disetujui%,status.ilike.%Setuju%')
            .order('tanggal', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        return res.status(200).json(data || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Mencatat waktu keluar / kembali siswa yang divalidasi oleh Satpam
app.patch('/satpam/catat-waktu/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { waktu_keluar_riil, waktu_kembali_riil, status_kehadiran } = req.body;

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .update({
                waktu_keluar_riil: waktu_keluar_riil,
                waktu_kembali_riil: waktu_kembali_riil,
                status_kehadiran: status_kehadiran
            })
            .eq('id_pengajuan', id)
            .select();

        if (error) {
            return res.status(400).json({ success: false, message: 'Gagal mencatat waktu satpam: ' + error.message });
        }

        return res.status(200).json({ success: true, message: 'Catatan waktu satpam berhasil disimpan', data });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
});


// ======================================================
// 4. ENDPOINT KHUSUS DASHBOARD ADMIN
// ======================================================
// Mengambil ringkasan statistik lengkap untuk Admin
app.get('/admin/statistik', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengajuan_izin')
            .select('*');

        if (error) throw error;

        const totalIzin = data.length;
        const totalDisetujui = data.filter(i => String(i.status).toLowerCase().includes('setuju')).length;
        const totalMenunggu = data.filter(i => String(i.status).toLowerCase().includes('menunggu')).length;

        return res.status(200).json({
            success: true,
            statistik: {
                total_izin: totalIzin,
                total_disetujui: totalDisetujui,
                total_menunggu: totalMenunggu
            },
            data: data
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Manajemen Pengguna (Admin dapat melihat daftar akun pengguna/guru/satpam/siswa)
app.get('/admin/pengguna', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengguna')
            .select('id_pengguna, nama_lengkap, nama_pengguna, peran, kelas');

        if (error) throw error;

        return res.status(200).json(data || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/admin/pengguna', async (req, res) => {
    try {
        const body = req.body || {};
        const { data, error } = await supabase
            .from('pengguna')
            .insert([body])
            .select();

        if (error) throw error;

        return res.status(201).json({ success: true, message: 'Pengguna berhasil ditambahkan', data });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/admin/pengguna/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('pengguna')
            .delete()
            .eq('id_pengguna', id)
            .select();

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Pengguna berhasil dihapus', data });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});


// ======================================================
// 404 HANDLER
// ======================================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint tidak ditemukan',
        path: req.originalUrl
    });
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
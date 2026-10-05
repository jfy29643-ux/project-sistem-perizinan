const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT) || 5002;
const host = process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------
// CORS: Konfigurasi bersih & aman (Tanpa PathError)
// ---------------------------------------------------------------
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true
}));

app.use(express.json());

// ---------------------------------------------------------------
// Supabase Setup
// ---------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL / SUPABASE_KEY belum diisi di environment variable!');
}

const supabase = createClient(SUPABASE_URL || 'http://invalid', SUPABASE_KEY || 'invalid');

// Inisialisasi Data Pengguna Default yang aman
const initDb = async () => {
    try {
        const defaultUsers = [
            { nama_lengkap: 'Administrator', nama_pengguna: 'admin', kata_sandi: '12345', peran: 'admin' },
            { nama_lengkap: 'naplihah', nama_pengguna: 'nap', kata_sandi: '123456', peran: 'siswa' },
            { nama_lengkap: 'jevarine', nama_pengguna: 'jep', kata_sandi: 'abcde', peran: 'admin' }
        ];

        for (const user of defaultUsers) {
            const { data, error } = await supabase.from('pengguna').select('*').eq('nama_pengguna', user.nama_pengguna);
            if (!error && (!data || data.length === 0)) {
                await supabase.from('pengguna').insert([user]);
            }
        }
        console.log('✅ Inisialisasi data pengguna di Supabase berhasil!');
    } catch (err) {
        console.warn('⚠️ Catatan Inisialisasi DB:', err.message);
    }
};

if (SUPABASE_URL && SUPABASE_KEY) {
    initDb();
}

app.get('/', (req, res) => {
    res.status(200).send('Server Backend Pengajuan Izin Aktif dan Terhubung ke Supabase!');
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ ok: true, waktu: new Date().toISOString() });
});

// --- ROUTE LOGIN ---
app.post('/api/login', async (req, res) => {
    try {
        const body = req.body || {};
        let nama_pengguna = body.nama_pengguna || body.username;
        let kata_sandi = body.kata_sandi || body.password;

        nama_pengguna = nama_pengguna ? String(nama_pengguna).trim() : '';
        kata_sandi = kata_sandi ? String(kata_sandi).trim() : '';

        if (!nama_pengguna || !kata_sandi) {
            return res.status(400).json({ success: false, message: 'Nama pengguna dan kata sandi wajib diisi!' });
        }

        const { data, error } = await supabase
            .from('pengguna')
            .select('*')
            .ilike('nama_pengguna', nama_pengguna)
            .eq('kata_sandi', kata_sandi);

        if (error) {
            console.error('Database Error pada Login:', error.message);
            return res.status(500).json({ success: false, message: 'Database Error: ' + error.message });
        }

        if (data && data.length > 0) {
            const { kata_sandi: _hapus, ...userTanpaSandi } = data[0];
            return res.status(200).json({ success: true, message: 'Login Berhasil', user: userTanpaSandi });
        }

        return res.status(401).json({ success: false, message: 'Nama pengguna atau kata sandi salah!' });
    } catch (err) {
        console.error('Server Exception pada Login:', err.message);
        return res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
});

// Jalankan secara lokal jika di komputer
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, host, () => {
        console.log(`🚀 Server Backend aktif!`);
        console.log(`   Buka di komputer : http://localhost:${port}/api/health`);
    });
}

// Wajib untuk Vercel (Serverless)
module.exports = app;
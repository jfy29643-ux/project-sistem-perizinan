const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ======================================================
// SERVER (Diatur default ke port 5001 untuk Auth Service)
// ======================================================
const port = 5001;
const host = process.env.HOST || '0.0.0.0';

// ======================================================
// CORS Konfigurasi yang Lebih Aman untuk Vercel & Development
// ======================================================
const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true; // Postman, curl, server-to-server
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    if (/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(origin)) return true;
    return extraOrigins.includes(origin);
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Origin tidak diizinkan oleh CORS: ' + origin));
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
    console.error(
        '❌ SUPABASE_URL / SUPABASE_KEY belum diisi!'
    );
}

const supabase = createClient(
    SUPABASE_URL || 'https://invalid.supabase.co',
    SUPABASE_KEY || 'invalid-key'
);

// ======================================================
// INISIALISASI USER DEFAULT
// ======================================================
const initDb = async () => {
    try {
        const defaultUsers = [
            {
                nama_lengkap: 'Administrator',
                nama_pengguna: 'admin',
                kata_sandi: '12345',
                peran: 'admin'
            },
            {
                nama_lengkap: 'naplihah',
                nama_pengguna: 'nap',
                kata_sandi: '123456',
                peran: 'siswa'
            },
            {
                nama_lengkap: 'jevarine',
                nama_pengguna: 'jep',
                kata_sandi: 'abcde',
                peran: 'admin'
            }
        ];

        for (const user of defaultUsers) {
            const { data, error } = await supabase
                .from('pengguna')
                .select('id_pengguna')
                .eq('nama_pengguna', user.nama_pengguna)
                .maybeSingle();

            if (error) {
                console.warn(
                    `⚠️ Gagal mengecek user ${user.nama_pengguna}:`,
                    error.message
                );
                continue;
            }

            if (!data) {
                const { error: insertError } = await supabase
                    .from('pengguna')
                    .insert([user]);

                if (insertError) {
                    console.warn(
                        `⚠️ Gagal membuat user ${user.nama_pengguna}:`,
                        insertError.message
                    );
                }
            }
        }

        console.log('✅ Inisialisasi pengguna selesai.');
    } catch (err) {
        console.warn(
            '⚠️ Catatan Inisialisasi DB:',
            err.message
        );
    }
};

// Jalankan inisialisasi jika environment Supabase tersedia
if (SUPABASE_URL && SUPABASE_KEY) {
    initDb();
}

// ======================================================
// HOME
// ======================================================
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server Backend Auth Sistem Perizinan Aktif',
        status: 'online',
        database: SUPABASE_URL ? 'Supabase configured' : 'Supabase belum dikonfigurasi',
        waktu: new Date().toISOString()
    });
});

// ======================================================
// HEALTH CHECK
// ======================================================
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        ok: true,
        message: 'Backend Auth API aktif',
        waktu: new Date().toISOString()
    });
});

// ======================================================
// LOGIN
// ======================================================
app.post('/api/login', async (req, res) => {
    try {
        const body = req.body || {};

        let nama_pengguna =
            body.nama_pengguna ||
            body.username ||
            '';

        let kata_sandi =
            body.kata_sandi ||
            body.password ||
            '';

        nama_pengguna = String(nama_pengguna).trim();
        kata_sandi = String(kata_sandi).trim();

        // Validasi input
        if (!nama_pengguna || !kata_sandi) {
            return res.status(400).json({
                success: false,
                message: 'Nama pengguna dan kata sandi wajib diisi!'
            });
        }

        // Cek database
        const { data, error } = await supabase
            .from('pengguna')
            .select('*')
            .ilike('nama_pengguna', nama_pengguna)
            .eq('kata_sandi', kata_sandi)
            .maybeSingle();

        if (error) {
            console.error(
                '❌ Database Error pada Login:',
                error.message
            );

            return res.status(500).json({
                success: false,
                message: 'Database Error: ' + error.message
            });
        }

        // User ditemukan
        if (data) {
            const {
                kata_sandi: passwordTidakDikirim,
                ...userTanpaPassword
            } = data;

            return res.status(200).json({
                success: true,
                message: 'Login Berhasil',
                user: userTanpaPassword,
                token: 'dummy-jwt-token-auth'
            });
        }

        // User tidak ditemukan
        return res.status(401).json({
            success: false,
            message: 'Nama pengguna atau kata sandi salah!'
        });

    } catch (err) {
        console.error(
            '❌ Server Exception pada Login:',
            err.message
        );

        return res.status(500).json({
            success: false,
            message: 'Server Error: ' + err.message
        });
    }
});

// ======================================================
// 404
// ======================================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint tidak ditemukan',
        path: req.originalUrl
    });
});

// ======================================================
// SERVER LOKAL
// ======================================================
if (!process.env.VERCEL) {
    app.listen(port, host, () => {
        console.log('========================================');
        console.log('🚀 BACKEND AUTH SISTEM PERIZINAN AKTIF');
        console.log('========================================');
        console.log(`Local  : http://localhost:${port}`);
        console.log(`Health : http://localhost:${port}/api/health`);
        console.log('========================================');
    });
}

// ======================================================
// VERCEL
// ======================================================
module.exports = app;
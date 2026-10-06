const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

const port = Number(process.env.PORT) || 5002;
const host = process.env.HOST || '0.0.0.0';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: false
}));

app.options(/.*/, cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(
    SUPABASE_URL || 'https://invalid.supabase.co',
    SUPABASE_KEY || 'invalid-key'
);

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server Backend Sistem Perizinan Aktif',
        status: 'online',
        waktu: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        ok: true,
        message: 'Backend API aktif'
    });
});

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
                user: userTanpaPassword
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Nama pengguna atau kata sandi salah!'
        });

    } xcatch (err) {
        return res.status(500).json({
            success: false,
            message: 'Server Error: ' + err.message
        });
    }
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint tidak ditemukan',
        path: req.originalUrl
    });
});

module.exports = app;

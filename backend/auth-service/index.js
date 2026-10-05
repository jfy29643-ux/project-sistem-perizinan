const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT) || 5000;
const host = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkjaqqbrwuhukoqpqfsg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_VxkqGw4BjPI9KR1hdRo-fg_3SKQx7rx';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function tanggalLokal(nilaiTanggal) {
    const [tahun, bulan, hari] = String(nilaiTanggal || '').split('T')[0].split('-').map(Number);
    return tahun && bulan && hari ? new Date(tahun, bulan - 1, hari) : new Date('invalid');
}

function adaDiMinggu(tanggal, tanggalAcuan) {
    const tanggalObj = tanggalLokal(tanggal);
    const acuanObj = tanggalLokal(tanggalAcuan);
    if (Number.isNaN(tanggalObj.getTime()) || Number.isNaN(acuanObj.getTime())) return false;
    const hari = acuanObj.getDay() || 7;
    const awalMinggu = new Date(acuanObj);
    awalMinggu.setDate(acuanObj.getDate() - hari + 1);
    awalMinggu.setHours(0, 0, 0, 0);
    const akhirMinggu = new Date(awalMinggu);
    akhirMinggu.setDate(awalMinggu.getDate() + 7);
    return tanggalObj >= awalMinggu && tanggalObj < akhirMinggu;
}

const initDb = async () => {
    try {
        const defaultUsers = [
            { nama_lengkap: 'Administrator', nama_pengguna: 'admin', kata_sandi: '12345', peran: 'admin' },
            { nama_lengkap: 'naplihah', nama_pengguna: 'nap', kata_sandi: '123456', peran: 'siswa' },
            { nama_lengkap: 'jevarine', nama_pengguna: 'jep', kata_sandi: 'abcde', peran: 'admin' }
        ];

        for (const user of defaultUsers) {
            const { data } = await supabase.from('pengguna').select('*').eq('nama_pengguna', user.nama_pengguna);
            if (!data || data.length === 0) {
                await supabase.from('pengguna').insert([user]);
            }
        }
        console.log('✅ Inisialisasi data pengguna di Supabase berhasil!');
    } catch (err) {
        console.error('❌ Error Inisialisasi:', err.message);
    }
};

initDb();

app.get('/', (req, res) => {
    res.send('Server Backend Pengajuan Izin Aktif dan Terhubung ke Supabase!');
});

// --- ROUTE LOGIN & REGISTER ---
app.post('/api/login', async (req, res) => {
    let nama_pengguna = req.body.nama_pengguna || req.body.username;
    let kata_sandi = req.body.kata_sandi || req.body.password;
    
    nama_pengguna = nama_pengguna ? nama_pengguna.trim() : '';
    kata_sandi = kata_sandi ? kata_sandi.trim() : '';

    try {
        const { data, error } = await supabase
            .from('pengguna')
            .select('*')
            .ilike('nama_pengguna', nama_pengguna)
            .eq('kata_sandi', kata_sandi);

        if (error) throw error;

        if (data && data.length > 0) {
            return res.json({ success: true, message: 'Login Berhasil', user: data[0] });
        } else {
            return res.status(401).json({ success: false, message: 'Nama pengguna atau kata sandi salah!' });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
    }
});

app.listen(port, host, () => {
    console.log(`🚀 Server Backend Berjalan aktif di http://${host}:${port}`);
});
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

const port = Number(process.env.PORT) || 5002;

app.use(cors());
app.use(express.json());

const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    'https://kkjaqqbrwuhukoqpqfsg.supabase.co';

const SUPABASE_KEY =
    process.env.SUPABASE_KEY ||
    'sb_publishable_VxkqGw4BjPI9KR1hdRo-fg_3SKQx7rx';

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================================
// FUNGSI TANGGAL
// ============================================================

function tanggalLokal(nilaiTanggal) {
    const [tahun, bulan, hari] =
        String(nilaiTanggal || '')
            .split('T')[0]
            .split('-')
            .map(Number);

    return tahun && bulan && hari
        ? new Date(tahun, bulan - 1, hari)
        : new Date('invalid');
}


// ============================================================
// CEK MINGGU
// ============================================================

function adaDiMinggu(tanggal, tanggalAcuan) {
    const tanggalObj = tanggalLokal(tanggal);
    const acuanObj = tanggalLokal(tanggalAcuan);

    if (
        Number.isNaN(tanggalObj.getTime()) ||
        Number.isNaN(acuanObj.getTime())
    ) {
        return false;
    }

    const hari = acuanObj.getDay() || 7;
    const awalMinggu = new Date(acuanObj);

    awalMinggu.setDate(
        acuanObj.getDate() - hari + 1
    );
    awalMinggu.setHours(0, 0, 0, 0);

    const akhirMinggu = new Date(awalMinggu);
    akhirMinggu.setDate(
        akhirMinggu.getDate() + 7
    );

    return (
        tanggalObj >= awalMinggu &&
        tanggalObj < akhirMinggu
    );
}


// ============================================================
// TENTUKAN SEMESTER & TAHUN AJARAN
// ============================================================

function tentukanSemester(tanggal) {
    const date = tanggalLokal(tanggal);
    const bulan = date.getMonth() + 1;
    return bulan >= 7 ? 'Ganjil' : 'Genap';
}

function tentukanTahunAjaran(tanggal) {
    const date = tanggalLokal(tanggal);
    const tahun = date.getFullYear();
    const bulan = date.getMonth() + 1;
    return bulan >= 7 ? `${tahun}/${tahun + 1}` : `${tahun - 1}/${tahun}`;
}

function tanggalMulaiSemester(semester, tahunAjaran) {
    const tahunAwal = Number(String(tahunAjaran).split('/')[0]);
    return semester === 'Ganjil' ? `${tahunAwal}-07-01` : `${tahunAwal + 1}-01-01`;
}

function tanggalSelesaiSemester(semester, tahunAjaran) {
    const tahunAwal = Number(String(tahunAjaran).split('/')[0]);
    return semester === 'Ganjil' ? `${tahunAwal + 1}-01-01` : `${tahunAwal + 1}-07-01`;
}


// ============================================================
// MEMBUAT / MENGAMBIL REKAP SEMESTER
// ============================================================

async function ambilAtauBuatRekap(tanggal) {
    const semester = tentukanSemester(tanggal);
    const tahunAjaran = tentukanTahunAjaran(tanggal);

    const { data: rekapLama, error: errorCari } = await supabase
        .from('rekap_izin_keluar')
        .select('*')
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .limit(1);

    if (errorCari) throw errorCari;
    if (rekapLama && rekapLama.length > 0) return rekapLama[0];

    const { data: rekapBaru, error: errorInsert } = await supabase
        .from('rekap_izin_keluar')
        .insert([
            {
                semester,
                tahun_ajaran: tahunAjaran,
                tanggal_mulai: tanggalMulaiSemester(semester, tahunAjaran),
                tanggal_selesai: tanggalSelesaiSemester(semester, tahunAjaran)
            }
        ])
        .select()
        .single();

    if (errorInsert) throw errorInsert;
    return rekapBaru;
}


// ============================================================
// UPDATE DETAIL REKAP SISWA
// ============================================================

async function updateDetailRekap(pengajuan) {
    if (!pengajuan || !pengajuan.id_pengajuan) return;

    const idSiswa = Number(pengajuan.id_pengguna);
    if (!Number.isInteger(idSiswa)) return;

    const rekap = await ambilAtauBuatRekap(pengajuan.tanggal);

    const { data: pengajuanSiswa, error: errorPengajuan } = await supabase
        .from('pengajuan_izin')
        .select('id_pengajuan, id_pengguna, tanggal, status')
        .eq('id_pengguna', idSiswa);

    if (errorPengajuan) throw errorPengajuan;

    const tanggalAwal = tanggalLokal(rekap.tanggal_mulai);
    const tanggalAkhir = tanggalLokal(rekap.tanggal_selesai);

    const jumlahIzin = (pengajuanSiswa || [])
        .filter(item => {
            const tanggal = tanggalLokal(item.tanggal);
            return tanggal >= tanggalAwal && tanggal < tanggalAkhir;
        })
        .length;

    const { data: detailLama, error: errorDetail } = await supabase
        .from('detail_rekap')
        .select('*')
        .eq('id_rekap', rekap.id_rekap)
        .eq('id_siswa', idSiswa)
        .limit(1);

    if (errorDetail) throw errorDetail;

    if (detailLama && detailLama.length > 0) {
        await supabase
            .from('detail_rekap')
            .update({ jumlah_izin: jumlahIzin })
            .eq('id_detail', detailLama[0].id_detail);
        return;
    }

    await supabase
        .from('detail_rekap')
        .insert([{ id_rekap: rekap.id_rekap, id_siswa: idSiswa, jumlah_izin: jumlahIzin }]);
}

async function sinkronkanSemuaRekap() {
    try {
        const { data: semuaPengajuan } = await supabase
            .from('pengajuan_izin')
            .select('id_pengajuan, id_pengguna, tanggal, status');

        if (!semuaPengajuan) return;
        for (const pengajuan of semuaPengajuan) {
            await updateDetailRekap(pengajuan).catch(() => {});
        }
    } catch (err) {
        console.warn('⚠️ Sinkronisasi rekap gagal:', err.message);
    }
}


// ============================================================
// PENCATATAN KELUAR / MASUK
// ============================================================

async function buatPencatatanKeluar(pengajuan, idSatpam, status) {
    if (!pengajuan || !pengajuan.id_pengajuan || status !== 'Disetujui') return;

    const { data: dataLama } = await supabase
        .from('pencatatan_keluar_masuk')
        .select('*')
        .eq('id_pengajuan', pengajuan.id_pengajuan)
        .limit(1);

    if (dataLama && dataLama.length > 0) return;

    await supabase.from('pencatatan_keluar_masuk').insert([
        {
            id_pengajuan: pengajuan.id_pengajuan,
            id_satpam: Number(idSatpam) || null,
            jenis: 'Keluar',
            waktu: new Date().toISOString(),
            keterangan: 'Disetujui oleh Satpam'
        }
    ]);
}


// ============================================================
// ROUTE UTAMA
// ============================================================

app.get('/', (req, res) => {
    res.send('Server Backend Pengajuan Izin Aktif dan Terhubung ke Supabase!');
});


// ============================================================
// GET SEMUA PENGAJUAN (DIPERBAIKI)
// ============================================================

app.get('/api/pengajuan', async (req, res) => {
    try {
        const { data: pengajuanList, error: errPengajuan } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .order('id_pengajuan', { ascending: false });

        if (errPengajuan) throw errPengajuan;

        const { data: verifikasiGuruList } = await supabase
            .from('verifikasi_pengajuan')
            .select('*');

        const { data: verifikasiSatpamList } = await supabase
            .from('verifikasi_izin')
            .select('*');

        const formattedData = (pengajuanList || []).map(item => {
            const verifGuru = (verifikasiGuruList || []).find(v => v.id_pengajuan === item.id_pengajuan);
            const verifSatpam = (verifikasiSatpamList || []).find(v => v.id_pengajuan === item.id_pengajuan);

            let statusFinal = item.status || 'Menunggu Konfirmasi';
            let catatanFinal = item.keterangan || '-';

            if (verifSatpam && verifSatpam.status_verifikasi) {
                statusFinal = verifSatpam.status_verifikasi;
                catatanFinal = verifSatpam.catatan || (statusFinal === 'Ditolak' ? 'Ditolak oleh Satpam' : 'Disetujui oleh Satpam');
            } else if (verifGuru && verifGuru.status_verifikasi) {
                statusFinal = verifGuru.status_verifikasi;
                catatanFinal = verifGuru.catatan_verifikasi || (statusFinal === 'Ditolak' ? 'Ditolak oleh Guru Piket' : 'Disetujui oleh Guru Piket');
            }

            return {
                ...item,
                nama_lengkap: item.nama_lengkap || '-',
                kelas: item.kelas || '-',
                status: statusFinal,
                catatan_verifikasi: catatanFinal
            };
        });

        return res.json({ success: true, data: formattedData });
    } catch (err) {
        console.error('❌ ERROR GET PENGAJUAN:', err.message);
        return res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
});


// ============================================================
// NOTIFIKASI (DIPERBAIKI)
// ============================================================

app.get('/api/notifikasi', async (req, res) => {
    try {
        const role = String(req.query.role || '').trim().toLowerCase();
        
        const { data: pengajuanList, error } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .order('id_pengajuan', { ascending: false })
            .limit(20);

        if (error) throw error;

        const notifikasi = (pengajuanList || []).map(item => ({
            notification_key: String(item.id_pengajuan),
            id_pengajuan: item.id_pengajuan,
            nama_lengkap: item.nama_lengkap || 'Siswa',
            kelas: item.kelas || '-',
            jenis_izin: item.jenis_izin || 'Keluar Sekolah',
            tanggal: item.tanggal || '-',
            status: item.status || 'Menunggu Konfirmasi',
            message: `Pengajuan izin baru dari ${item.nama_lengkap || 'Siswa'} (${item.kelas || '-'}) berstatus: ${item.status || 'Menunggu Konfirmasi'}.`
        }));

        return res.json({ success: true, role, total: notifikasi.length, data: notifikasi });
    } catch (err) {
        console.error('❌ ERROR NOTIFIKASI:', err.message);
        return res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi: ' + err.message });
    }
});


// ============================================================
// HAPUS & EDIT PENGAJUAN
// ============================================================

app.delete('/api/pengajuan/:idPengajuan', async (req, res) => {
    try {
        const idPengajuan = Number(req.params.idPengajuan);
        await supabase.from('pencatatan_keluar_masuk').delete().eq('id_pengajuan', idPengajuan);
        await supabase.from('verifikasi_izin').delete().eq('id_pengajuan', idPengajuan);
        await supabase.from('verifikasi_pengajuan').delete().eq('id_pengajuan', idPengajuan);
        await supabase.from('pengajuan_izin').delete().eq('id_pengajuan', idPengajuan);

        await sinkronkanSemuaRekap();
        return res.json({ success: true, message: 'Data pengajuan berhasil dihapus.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Gagal menghapus: ' + err.message });
    }
});

app.put('/api/pengajuan/:idPengajuan', async (req, res) => {
    try {
        const idPengajuan = Number(req.params.idPengajuan);
        const { nama_lengkap, kelas, jenis_kelamin, jenis_izin, alasan, tanggal, waktu_mulai, waktu_selesai, keterangan } = req.body;

        const payload = {
            nama_lengkap: nama_lengkap ? nama_lengkap.trim() : '-',
            kelas: kelas ? kelas.trim() : '-',
            jenis_kelamin: jenis_kelamin || '-',
            jenis_izin: jenis_izin || 'Keluar Sekolah',
            alasan: alasan || 'Lainnya',
            tanggal: tanggal || new Date().toISOString().split('T')[0],
            waktu_mulai: waktu_mulai || '-',
            waktu_selesai: waktu_selesai || '-',
            keterangan: keterangan || '-'
        };

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .update(payload)
            .eq('id_pengajuan', idPengajuan)
            .select()
            .single();

        if (error) throw error;
        await updateDetailRekap(data);

        return res.json({ success: true, message: 'Pengajuan diperbarui.', data });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Gagal memperbarui: ' + err.message });
    }
});


// ============================================================
// VERIFIKASI GURU / SATPAM (OTOMATIS UPDATE STATUS)
// ============================================================

app.post('/api/pengajuan/:idPengajuan/verifikasi', async (req, res) => {
    try {
        const idPengajuan = Number(req.params.idPengajuan);
        const { status, role, id_guru, id_satpam } = req.body;

        if (!Number.isInteger(idPengajuan)) {
            return res.status(400).json({ success: false, message: 'ID pengajuan tidak valid.' });
        }

        const roleLower = String(role || '').trim().toLowerCase();
        const statusSimpan = (status === 'Tidak Disetujui' || status === 'Ditolak') ? 'Ditolak' : (status || 'Disetujui');
        const guruId = Number(id_guru) || null;
        const satpamId = Number(id_satpam) || null;

        const { data: pengajuan, error: errorPengajuan } = await supabase
            .from('pengajuan_izin')
            .select('*')
            .eq('id_pengajuan', idPengajuan)
            .single();

        if (errorPengajuan) throw errorPengajuan;

        const { error: errUpdateStatus } = await supabase
            .from('pengajuan_izin')
            .update({ status: statusSimpan })
            .eq('id_pengajuan', idPengajuan);

        if (errUpdateStatus) throw errUpdateStatus;

        if (roleLower.includes('guru')) {
            const catatanFinal = statusSimpan === 'Ditolak' ? 'Ditolak oleh Guru Piket' : 'Disetujui oleh Guru Piket';

            const { data, error } = await supabase
                .from('verifikasi_pengajuan')
                .upsert(
                    [{
                        id_pengajuan: idPengajuan,
                        id_guru: guruId,
                        status_verifikasi: statusSimpan,
                        catatan_verifikasi: catatanFinal,
                        tanggal_verifikasi: new Date().toISOString()
                    }],
                    { onConflict: 'id_pengajuan' }
                )
                .select()
                .single();

            if (error) throw error;
            await updateDetailRekap(pengajuan);

            return res.json({
                success: true,
                message: `Verifikasi Guru Piket berhasil disimpan (${statusSimpan}).`,
                data
            });
        }

        if (roleLower.includes('satpam')) {
            const catatanFinal = statusSimpan === 'Ditolak' ? 'Ditolak oleh Satpam' : 'Disetujui oleh Satpam';

            const { data, error } = await supabase
                .from('verifikasi_izin')
                .upsert(
                    [{
                        id_pengajuan: idPengajuan,
                        id_satpam: satpamId,
                        status_verifikasi: statusSimpan,
                        catatan: catatanFinal,
                        tanggal_verifikasi: new Date().toISOString()
                    }],
                    { onConflict: 'id_pengajuan' }
                )
                .select()
                .single();

            if (error) throw error;

            if (statusSimpan === 'Disetujui') {
                await buatPencatatanKeluar(pengajuan, satpamId, statusSimpan).catch(() => {});
            }

            await updateDetailRekap(pengajuan);

            return res.json({
                success: true,
                message: `Verifikasi Satpam berhasil disimpan (${statusSimpan}).`,
                data
            });
        }

        return res.status(400).json({ success: false, message: 'Role verifikasi tidak dikenali.' });

    } catch (err) {
        console.error('❌ ERROR VERIFIKASI:', err.message);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan verifikasi: ' + err.message });
    }
});


// ============================================================
// POST PENGAJUAN BARU
// ============================================================

app.post('/api/pengajuan', async (req, res) => {
    try {
        const {
            id_pengguna, nama_lengkap, kelas, jenis_kelamin,
            jenis_izin, alasan, tanggal, waktu_mulai,
            waktu_selesai, kieterangan, keterangan
        } = req.body;

        const tanggalPengajuan = tanggal || new Date().toISOString().split('T')[0];
        const idSiswaFinal = parseInt(id_pengguna, 10) || 32;
        const ketFinal = keterangan || kieterangan || '-';

        const payload = {
            id_pengguna: idSsiswaFinal = idSiswaFinal,
            nama_lengkap: nama_lengkap ? nama_lengkap.trim() : '-',
            kelas: kelas ? kelas.trim() : '-',
            jenis_kelamin: jenis_kelamin || '-',
            jenis_izin: jenis_izin || 'Keluar Sekolah',
            alasan: alasan || 'Lainnya',
            tanggal: tanggalPengajuan,
            waktu_mulai: waktu_mulai || '-',
            waktu_selesai: waktu_selesai || '-',
            keterangan: ketFinal,
            status: 'Menunggu Konfirmasi'
        };

        const { data, error } = await supabase
            .from('pengajuan_izin')
            .insert([payload])
            .select();

        if (error) throw error;
        const pengajuanBaru = data[0];

        await updateDetailRekap(pengajuanBaru).catch(() => {});

        return res.status(201).json({
            success: true,
            message: 'Pengajuan berhasil disimpan!',
            data: pengajuanBaru
        });

    } catch (err) {
        console.error('❌ ERROR INSERT PENGAJUAN:', err.message);
        return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
    }
});


// ============================================================
// JALANKAN SERVER (DIPERBAIKI AGAR LINK KLIK DI TERMINAL)
// ============================================================

app.listen(port, async () => {
    console.log(`🚀 Server Backend aktif! Silakan klik tautan di bawah ini:`);
    console.log(`   http://localhost:${port}`);
    console.log(`   http://127.0.0.1:${port}`);
    await sinkronkanSemuaRekap();
});
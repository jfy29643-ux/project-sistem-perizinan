import React, { useEffect, useState } from 'react';

export default function DashboardSiswa({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('laporan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // State form pengajuan
  const [namaLengkap, setNamaLengkap] = useState(user?.nama_lengkap || 'NAPLIHAH');
  const [kelas, setKelas] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState('Laki-laki');
  const [jenisIzin, setJenisIzin] = useState('Keluar Sekolah');
  const [alasan, setAlasan] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [waktuMulai, setWaktuMulai] = useState('');
  const [waktuSelesai, setWaktuSelesai] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // State interaktif grafik & edit
  const [tanggalTerpilih, setTanggalTerpilih] = useState('');
  const [hariTerpilih, setHariTerpilih] = useState('');
  const [bulanTerpilih, setBulanTerpilih] = useState(null);
  const [bulanGrafik, setBulanGrafik] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [idYangDiedit, setIdYangDiedit] = useState(null);
  
  const [daftarIzin, setDaftarIzin] = useState([]);
  const [waktuSekarang, setWaktuSekarang] = useState(new Date());

  const namaAkun =
    user?.nama_pengguna ||
    user?.username ||
    'Pengguna';

  // Perbaikan fungsi normalisasi agar presisi mendeteksi format YYYY-MM-DD
  function normalisasiTanggal(nilai) {
    if (!nilai) return '';
    const str = String(nilai).trim();
    if (str.includes('T')) {
      return str.split('T')[0];
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const tahun = d.getFullYear();
      const bulan = String(d.getMonth() + 1).padStart(2, '0');
      const hari = String(d.getDate()).padStart(2, '0');
      return `${tahun}-${bulan}-${hari}`;
    }
    return str.split('T')[0];
  }

  const ambilDataIzin = async () => {
    try {
      setLoadingData(true);
      const response = await fetch('http://localhost:5001/pengajuan');
      const result = await response.json();
      if (Array.isArray(result)) {
        setDaftarIzin(result);
      } else if (result && Array.isArray(result.data)) {
        setDaftarIzin(result.data);
      }
    } catch (error) {
      console.error('Gagal mengambil data dari database:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    ambilDataIzin();
    // Auto-refresh data setiap 5 detik agar grafik langsung sync setelah submit
    const interval = setInterval(ambilDataIzin, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setWaktuSekarang(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // SUBMIT ATAU UPDATE KE DATABASE
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    const dataPayload = {
      id_pengguna: user?.id || user?.id_pengguna || 1,
      nama_lengkap: namaLengkap,
      kelas: kelas,
      jenis_izin: jenisIzin,
      alasan: alasan,
      tanggal: tanggal,
      waktu_mulai: waktuMulai,
      waktu_selesai: waktuSelesai,
      keterangan: alasan || 'Menunggu konfirmasi',
      status: 'Menunggu',
      jenis_kelamin: jenisKelamin
    };

    try {
      let url = 'http://localhost:5001/pengajuan';
      let method = 'POST';

      if (isEditing && idYangDiedit) {
        url = `http://localhost:5001/pengajuan/${idYangDiedit}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataPayload),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({
          text: isEditing ? 'Pengajuan izin berhasil diupdate!' : 'Pengajuan izin berhasil dikirim ke database!',
          type: 'success'
        });
        setKelas('');
        setAlasan('');
        setTanggal('');
        setWaktuMulai('');
        setWaktuSelesai('');
        setIsEditing(false);
        setIdYangDiedit(null);
        await ambilDataIzin(); // Segera ambil data terbaru
        setActiveMenu('laporan');
      } else {
        throw new Error(result.message || 'Gagal menyimpan pengajuan');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({
        text: 'Gagal memproses pengajuan: ' + error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setIsEditing(true);
    setIdYangDiedit(item.id_pengajuan || item.id);
    setNamaLengkap(item.nama_lengkap || '');
    setKelas(item.kelas || '');
    setJenisKelamin(item.jenis_kelamin || 'Laki-laki');
    setJenisIzin(item.jenis_izin || 'Keluar Sekolah');
    setAlasan(item.alasan || item.keterangan || '');
    setTanggal(normalisasiTanggal(item.tanggal));
    setWaktuMulai(item.waktu_mulai || '');
    setWaktuSelesai(item.waktu_selesai || '');
    setActiveMenu('pengajuan');
  };

  const handleHapus = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      try {
        const response = await fetch(`http://localhost:5001/pengajuan/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setDaftarIzin((prevData) =>
            prevData.filter((item) => String(item.id_pengajuan || item.id) !== String(id))
          );
          alert('Data berhasil dihapus!');
        } else {
          alert('Gagal menghapus data dari database.');
        }
      } catch (error) {
        console.error('Error hapus:', error);
      }
    }
  };

  // Grafik Tanggal dengan urutan dari tanggal 07 di kiri sampai 01 di kanan
  const getDaftarTanggalDariData = () => {
    const tahun = 2026;
    const bulan = '10'; // Oktober
    
    // Menggunakan (7 - index) agar urutannya mundur dari 07 ke 01
    return Array.from({ length: 7 }, (_, index) => {
      const hariVal = 7 - index; // 7, 6, 5, 4, 3, 2, 1
      const hari = String(hariVal).padStart(2, '0');
      const full = `${tahun}-${bulan}-${hari}`;
      const label = `${hari}/${bulan}/${tahun}`;
      return { full, label };
    });
  };

  const daftarTanggalGrafik = getDaftarTanggalDariData();

  const hitungIzinPerTanggal = (tanggalTarget) => {
    const tglNormTarget = normalisasiTanggal(tanggalTarget);
    return daftarIzin.filter((item) => normalisasiTanggal(item.tanggal) === tglNormTarget).length;
  };

  const jenisIzinSakit = (jenis) => String(jenis || '').trim().toLowerCase().includes('sakit');
  const hitungWarnaIzin = (data) => ({
    sakit: data.filter((item) => jenisIzinSakit(item.jenis_izin)).length,
    izin: data.filter((item) => !jenisIzinSakit(item.jenis_izin)).length
  });

  const dataDetailTanggal = tanggalTerpilih
    ? daftarIzin.filter((item) => normalisasiTanggal(item.tanggal) === normalisasiTanggal(tanggalTerpilih))
    : [];

  const maxCount = Math.max(...daftarTanggalGrafik.map((item) => hitungIzinPerTanggal(item.full)), 1);

  function statusPengajuan(status) {
    const nilai = String(status || '').toLowerCase().trim();
    if (nilai.includes('tolak') || nilai.includes('rejected')) return 'Ditolak';
    if (nilai.includes('setuju') || nilai.includes('approved') || nilai.includes('selesai') || nilai.includes('terima') || nilai === '1' || nilai === 'true') return 'Disetujui';
    return 'Menunggu Konfirmasi';
  }

  const hitungKelompok = (items, getKey) =>
    Object.entries(
      items.reduce((rekap, item) => {
        const key = getKey(item) || 'Tidak diketahui';
        rekap[key] = (rekap[key] || 0) + 1;
        return rekap;
      }, {})
    ).sort((a, b) => b[1] - a[1]);

  const rekapJenisKelamin = hitungKelompok(daftarIzin, (item) => item.jenis_kelamin);
  const rekapKelas = hitungKelompok(daftarIzin, (item) => item.kelas);

  const bulanLaporan = `${waktuSekarang.getFullYear()}-${String(waktuSekarang.getMonth() + 1).padStart(2, '0')}-01`;
  const [tahunLaporan, bulanLaporanNomor] = (bulanGrafik || bulanLaporan).split('-').map(Number);
  const daftarHari = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const rekapMingguan = daftarHari.map((namaHari, indexHari) => {
    const dataHari = daftarIzin.filter((item) => {
      const tanggalItem = normalisasiTanggal(item.tanggal);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalItem)) return false;
      const [tahun, bulan, hari] = tanggalItem.split('-').map(Number);
      const tanggalObj = new Date(tahun, bulan - 1, hari);
      const hariSenin = (tanggalObj.getDay() + 6) % 7;
      return tahun === tahunLaporan && bulan === bulanLaporanNomor && hariSenin === indexHari;
    });
    return { label: namaHari, data: dataHari };
  });

  const maxMingguan = Math.max(...rekapMingguan.map((item) => item.data.length), 1);
  const dataHariTerpilih = hariTerpilih ? (rekapMingguan.find((item) => item.label === hariTerpilih)?.data || []) : [];

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const jumlahHariDalamBulan = new Date(tahunLaporan, bulanLaporanNomor, 0).getDate();
  const tanggalAwalGrafik = `01 ${namaBulan[bulanLaporanNomor - 1]} ${tahunLaporan}`;
  const tanggalAkhirGrafik = `${jumlahHariDalamBulan} ${namaBulan[bulanLaporanNomor - 1]} ${tahunLaporan}`;

  const rekapBulanan = namaBulan.map((nama, indexBulan) => ({
    nama,
    index: indexBulan,
    data: daftarIzin.filter((item) => {
      const tanggalItem = normalisasiTanggal(item.tanggal);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalItem)) return false;
      const [tahun, bulan] = tanggalItem.split('-').map(Number);
      return tahun === tahunLaporan && bulan === indexBulan + 1;
    })
  }));

  const maxBulanan = Math.max(...rekapBulanan.map((item) => item.data.length), 1);
  const dataBulanTerpilih = bulanTerpilih !== null ? (rekapBulanan.find((item) => item.index === bulanTerpilih)?.data || []) : [];

  const totalJenisKelamin = rekapJenisKelamin.reduce((total, [, jumlah]) => total + jumlah, 0);
  let sudutDonat = 0;
  const gradientJenisKelamin = rekapJenisKelamin
    .map(([label, jumlah]) => {
      const sudutAwal = sudutDonat;
      sudutDonat += (jumlah / Math.max(totalJenisKelamin, 1)) * 360;
      const warna = String(label).toLowerCase().includes('perempuan') ? '#ec4899' : '#3b82f6';
      return `${warna} ${sudutAwal}deg ${sudutDonat}deg`;
    })
    .join(', ');

  const koordinatBulanan = rekapBulanan.map((item, index) => ({
    x: 20 + index * 60,
    y: 170 - (item.data.length / maxBulanan) * 130
  }));

  const jalurBulanan = koordinatBulanan.reduce((jalur, titik, index) => {
    if (index === 0) return `M ${titik.x} ${titik.y}`;
    const sebelumnya = koordinatBulanan[index - 1];
    const kontrolKiri = sebelumnya.x + (titik.x - sebelumnya.x) / 2;
    return `${jalur} C ${kontrolKiri} ${sebelumnya.y}, ${kontrolKiri} ${titik.y}, ${titik.x} ${titik.y}`;
  }, '');

  const gayaBadgeJenisKelamin = (label) => {
    const nilai = String(label || '').toLowerCase();
    if (nilai.includes('perempuan') || nilai.includes('wanita')) {
      return { backgroundColor: '#fce7f3', color: '#be185d' };
    }
    return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* SIDEBAR */}
      <div style={{ width: '260px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', top: 0, left: 0, zIndex: 100, borderRight: '1px solid #e2e8f0' }}>
        
        {/* HEADER SIDEBAR DENGAN LOGO SEKOLAH */}
        <div style={{ padding: '1.25rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img 
            src="/logo sekolah.jpeg" 
            alt="Logo Sekolah" 
            style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
          />
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: '#1e293b' }}>Dashboard Siswa</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>Portal Siswa</p>
          </div>
        </div>

        <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button onClick={() => { setActiveMenu('pengajuan'); setIsEditing(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: activeMenu === 'pengajuan' ? '#2563eb' : 'transparent', color: activeMenu === 'pengajuan' ? '#fff' : '#334155', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>
            ➕ Form Pengajuan
          </button>
          <button onClick={() => setActiveMenu('laporan')} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: activeMenu === 'laporan' ? '#2563eb' : 'transparent', color: activeMenu === 'laporan' ? '#fff' : '#334155', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>
            📊 Laporan Izin Siswa
          </button>
        </div>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onLogout} style={{ width: '100%', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '0.7rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>
            🚪 Keluar Akun
          </button>
        </div>
      </div>

      {/* KONTEN UTAMA */}
      <div style={{ marginLeft: '260px', flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>Dashboard Siswa - Sistem Perizinan</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Login sebagai: <b>{namaAkun}</b></div>
        </div>

        <div style={{ padding: '2rem', boxSizing: 'border-box' }}>
          {message.text && (
            <div style={{ backgroundColor: message.type === 'success' ? '#d1fae5' : '#fee2e2', color: message.type === 'success' ? '#065f46' : '#b91c1c', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
              {message.text}
            </div>
          )}

          {activeMenu === 'pengajuan' ? (
            <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                {isEditing ? 'EDIT PENGAJUAN IZIN' : 'FORM PENGAJUAN IZIN'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.4rem' }}>NAMA LENGKAP</label>
                  <input type="text" value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} required style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.7rem', boxSizing: 'border-box', backgroundColor: '#f8fafc' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.4rem' }}>KELAS</label>
                  <input type="text" value={kelas} onChange={(e) => setKelas(e.target.value)} placeholder="Contoh: XII RPL 1" required style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.7rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.4rem' }}>JENIS KELAMIN</label>
                  <select value={jenisKelamin} onChange={(e) => setJenisKelamin(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.7rem', backgroundColor: '#fff', boxSizing: 'border-box' }}>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.4rem' }}>JENIS IZIN</label>
                  <select value={jenisIzin} onChange={(e) => setJenisIzin(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.7rem', backgroundColor: '#fff', boxSizing: 'border-box' }}>
                    <option value="Keluar Sekolah">Keluar Sekolah</option>
                    <option value="Pulang Cepat">Pulang Cepat</option>
                    <option value="Dispen Kegiatan">Dispen Kegiatan</option>
                    <option value="Sakit">Sakit</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.4rem' }}>ALASAN / KETERANGAN</label>
                  <input type="text" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: Sakit perut / keperluan mendesak" required style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.7rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.4rem' }}>TANGGAL</label>
                  <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.7rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.4rem' }}>WAKTU MULAI</label>
                    <input type="time" value={waktuMulai} onChange={(e) => setWaktuMulai(e.target.value)} required style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.7rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.4rem' }}>WAKTU SELESAI</label>
                    <input type="time" value={waktuSelesai} onChange={(e) => setWaktuSelesai(e.target.value)} required style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.7rem', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {isEditing && (
                    <button type="button" onClick={() => { setIsEditing(false); setActiveMenu('laporan'); }} style={{ flex: 1, backgroundColor: '#64748b', color: '#ffffff', fontWeight: 'bold', padding: '0.8rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                      Batal
                    </button>
                  )}
                  <button type="submit" disabled={loading} style={{ flex: 2, backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 'bold', padding: '0.8rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                    {loading ? 'Menyimpan...' : isEditing ? 'Update Pengajuan' : 'Kirim Pengajuan'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* REKAPITULASI TANGGAL */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem 2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 'bold', color: '#1e293b' }}>1. Rekapitulasi Jumlah Izin (Berdasarkan Tanggal)</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Klik salah satu tanggal pada grafik untuk melihat rincian.</p>
                <div style={{ position: 'relative', height: '220px', marginTop: '2.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundImage: 'linear-gradient(to bottom, transparent 49.5%, #e2e8f0 50%, transparent 50.5%)', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '0 1rem 1.75rem 2.25rem' }}>
                  {daftarTanggalGrafik.map((tglItem) => {
                    const count = hitungIzinPerTanggal(tglItem.full);
                    const dataTanggal = daftarIzin.filter((item) => normalisasiTanggal(item.tanggal) === normalisasiTanggal(tglItem.full));
                    const jumlahWarna = hitungWarnaIzin(dataTanggal);
                    const barHeight = count > 0 ? Math.max((count / maxCount) * 100, 25) : 0;

                    return (
                      <div key={tglItem.full} onClick={() => setTanggalTerpilih(tglItem.full)} style={{ width: '36px', height: '100%', position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ width: '36px', height: `${barHeight}%`, minHeight: count > 0 ? '30px' : '0px', backgroundColor: '#e5e7eb', display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px', overflow: 'hidden' }}>
                          {jumlahWarna.izin > 0 && <div style={{ height: `${(jumlahWarna.izin / count) * 100}%`, width: '100%', backgroundColor: '#3b82f6' }} />}
                          {jumlahWarna.sakit > 0 && <div style={{ height: `${(jumlahWarna.sakit / count) * 100}%`, width: '100%', backgroundColor: '#10b981' }} />}
                        </div>
                        <span style={{ position: 'absolute', bottom: '-18px', fontSize: '0.62rem', color: '#64748b', whiteSpace: 'nowrap' }}>{tglItem.label}</span>
                      </div>
                    );
                  })}
                </div>

                {tanggalTerpilih && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#1e293b' }}>Detail Izin Tanggal: {tanggalTerpilih}</h4>
                    {dataDetailTanggal.length === 0 ? (
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Tidak ada izin pada tanggal ini.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Nama</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Kelas</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Jenis Kelamin</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Jenis Izin</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Alasan / Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataDetailTanggal.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9', fontWeight: '600' }}>{item.nama_lengkap}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.kelas}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.jenis_kelamin}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.jenis_izin}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.alasan || item.keterangan}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* GRAFIK JENIS KELAMIN & KELAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#1e293b' }}>Grafik Jenis Kelamin</h3>
                  {rekapJenisKelamin.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Belum ada data.</p>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ width: '135px', height: '135px', flex: '0 0 135px', borderRadius: '50%', background: `conic-gradient(${gradientJenisKelamin})`, display: 'grid', placeItems: 'center' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
                      </div>
                      <div style={{ display: 'grid', gap: '0.55rem', fontSize: '0.78rem', color: '#475569' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ec4899' }} />
                          <span>Perempuan</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                          <span>Laki-laki</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#1e293b' }}>Grafik Berdasarkan Kelas</h3>
                  {rekapKelas.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Belum ada data.</p>
                  ) : (
                    rekapKelas.map(([label, total]) => (
                      <div key={label} style={{ marginBottom: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', marginBottom: '4px' }}>
                          <span>{label}</span>
                          <strong>{total}</strong>
                        </div>
                        <div style={{ height: '12px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${(total / Math.max(...rekapKelas.map((item) => item[1]))) * 100}%`, height: '100%', backgroundColor: '#6366f1', borderRadius: '999px' }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* GRAFIK MINGGUAN */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem 2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: '#1e293b' }}>
                  Grafik Mingguan: {tanggalAwalGrafik} sampai {tanggalAkhirGrafik} (Klik bar hari)
                </h3>
                <div style={{ position: 'relative', height: '190px', display: 'flex', alignItems: 'flex-end', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 1rem 0.5rem 2.25rem', marginTop: '1rem' }}>
                  {rekapMingguan.map((minggu) => {
                    const total = minggu.data.length;
                    const jumlahWarna = hitungWarnaIzin(minggu.data);
                    const barHeight = total ? Math.max((total / maxMingguan) * 82, 10) : 0;

                    return (
                      <div key={minggu.label} onClick={() => setHariTerpilih(hariTerpilih === minggu.label ? '' : minggu.label)} style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ width: 'min(52px, 80%)', height: `${barHeight}%`, minHeight: barHeight > 0 ? '4px' : '0', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '5px 5px 0 0', border: hariTerpilih === minggu.label ? '2px solid #2563eb' : 'none' }}>
                          <div style={{ height: `${total ? (jumlahWarna.izin / total) * 100 : 0}%`, backgroundColor: '#2563eb' }} />
                          <div style={{ height: `${total ? (jumlahWarna.sakit / total) * 100 : 0}%`, backgroundColor: '#16a34a' }} />
                        </div>
                        <span style={{ marginTop: '8px', fontSize: '0.72rem', color: hariTerpilih === minggu.label ? '#2563eb' : '#64748b', fontWeight: hariTerpilih === minggu.label ? 'bold' : 'normal' }}>{minggu.label}</span>
                      </div>
                    );
                  })}
                </div>

                {hariTerpilih && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#1e293b' }}>Detail Izin Hari: {hariTerpilih}</h4>
                    {dataHariTerpilih.length === 0 ? (
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Tidak ada izin pada hari {hariTerpilih}.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Nama</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Kelas</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Jenis Kelamin</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Tanggal</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Jenis Izin</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Alasan / Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataHariTerpilih.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9', fontWeight: '600' }}>{item.nama_lengkap}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.kelas}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.jenis_kelamin}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{normalisasiTanggal(item.tanggal)}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.jenis_izin}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.alasan || item.keterangan}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* GRAFIK BULANAN */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem 2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: '#1e293b' }}>Grafik Bulanan (Klik titik bulan)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <svg viewBox="0 0 740 220" width="100%" height="220" role="img" style={{ minWidth: '680px', overflow: 'visible' }}>
                    <line x1="20" y1="40" x2="20" y2="170" stroke="#cbd5e1" />
                    <line x1="20" y1="170" x2="710" y2="170" stroke="#cbd5e1" />
                    <path d={jalurBulanan} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {rekapBulanan.map((bulan) => {
                      const x = 20 + bulan.index * 60;
                      const y = 170 - (bulan.data.length / maxBulanan) * 130;
                      const isSelected = bulanTerpilih === bulan.index;
                      return (
                        <g key={bulan.nama} onClick={() => setBulanTerpilih(isSelected ? null : bulan.index)} style={{ cursor: 'pointer' }}>
                          <circle cx={x} cy={y} r={isSelected ? "8" : "6"} fill="#f59e0b" stroke={isSelected ? "#2563eb" : "#ffffff"} strokeWidth={isSelected ? "3" : "2"} />
                          <text x={x} y="195" textAnchor="middle" fontSize="10" fill={isSelected ? "#2563eb" : "#64748b"} fontWeight={isSelected ? "bold" : "normal"}>{bulan.nama.slice(0, 3)}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {bulanTerpilih !== null && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#1e293b' }}>Detail Izin Bulan: {namaBulan[bulanTerpilih]}</h4>
                    {dataBulanTerpilih.length === 0 ? (
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Tidak ada izin pada bulan {namaBulan[bulanTerpilih]}.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Nama</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Kelas</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Jenis Kelamin</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Tanggal</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Jenis Izin</th>
                            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Alasan / Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataBulanTerpilih.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9', fontWeight: '600' }}>{item.nama_lengkap}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.kelas}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.jenis_kelamin}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{normalisasiTanggal(item.tanggal)}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.jenis_izin}</td>
                              <td style={{ padding: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>{item.alasan || item.keterangan}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* DEBUG INFO */}
              <div style={{ padding: '10px', backgroundColor: '#e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#334155' }}>
                Status Data: {loadingData ? 'Memuat dari database...' : `Berhasil memuat ${daftarIzin.length} data izin dari server.`}
              </div>

              {/* SEMUA RIWAYAT DENGAN TOMBOL EDIT & HAPUS */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem 2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>Semua Riwayat Pengajuan Izin</h3>
                {daftarIzin.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Belum ada data izin yang tersedia.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {daftarIzin.map((item, idx) => (
                      <div key={item.id_pengajuan || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem 1.25rem', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#0f172a' }}>{item.nama_lengkap}</span>
                            <span style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{item.kelas}</span>
                            <span style={{ ...gayaBadgeJenisKelamin(item.jenis_kelamin), fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{item.jenis_kelamin || '-'}</span>
                            <span style={{ backgroundColor: jenisIzinSakit(item.jenis_izin) ? '#dcfce7' : '#dbeafe', color: jenisIzinSakit(item.jenis_izin) ? '#166534' : '#1d4ed8', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{item.jenis_izin}</span>
                            <span style={{ backgroundColor: statusPengajuan(item.status) === 'Disetujui' ? '#dcfce7' : '#fef3c7', color: statusPengajuan(item.status) === 'Disetujui' ? '#166534' : '#92400e', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{statusPengajuan(item.status)}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>📅 {normalisasiTanggal(item.tanggal)}</span>
                            <span>⏰ {item.waktu_mulai} - {item.waktu_selesai}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>"{item.keterangan || item.alasan}"</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleEdit(item)} style={{ backgroundColor: '#dbeafe', color: '#1e40af', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button>
                          <button onClick={() => handleHapus(item.id_pengajuan || item.id)} style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>Hapus</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { API_URL, authFetch } from './apiConfig';

const sel = { padding: '0.7rem', borderBottom: '1px solid #f1f5f9', textAlign: 'left' };

function TabelDetail({ data, tampilTanggal, formatTanggal }) {
  return (
    <div className="rt-wrap" style={{ width: '100%', overflowX: 'auto', overflowY: 'auto', maxHeight: '360px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      <table className="rt" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: tampilTanggal ? '640px' : '560px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
            {['Nama', 'Kelas', 'Jenis Kelamin', ...(tampilTanggal ? ['Tanggal'] : []), 'Jenis Izin', 'Alasan / Keterangan'].map((judul) => (
              <th key={judul} style={{ padding: '0.7rem', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#f8fafc', whiteSpace: 'nowrap' }}>{judul}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={item.id_pengajuan || item.id || idx}>
              <td data-label="Nama" style={{ ...sel, fontWeight: '600' }}>{item.nama_lengkap}</td>
              <td data-label="Kelas" style={sel}>{item.kelas}</td>
              <td data-label="Jenis Kelamin" style={sel}>{item.jenis_kelamin}</td>
              {tampilTanggal && <td data-label="Tanggal" style={sel}>{formatTanggal(item.tanggal)}</td>}
              <td data-label="Jenis Izin" style={sel}>{item.jenis_izin}</td>
              <td data-label="Alasan" style={sel}>{item.alasan || item.keterangan}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Grafik statistik yang SAMA PERSIS dengan Dashboard Siswa (tanpa riwayat izin).
// Dipakai oleh Dashboard Guru Piket dan Dashboard Satpam.
function GrafikStatistik({ daftarIzin = [] }) {
  const [tanggalTerpilih, setTanggalTerpilih] = useState('');
  const [hariTerpilih, setHariTerpilih] = useState('');
  const [bulanTerpilih, setBulanTerpilih] = useState(null);
  const [bulanGrafik] = useState('');
  const [waktuSekarang] = useState(() => new Date());

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

  // Grafik Tanggal dengan urutan dari tanggal 07 di kiri sampai 01 di kanan
  const getDaftarTanggalDariData = () => {
    const tahun = waktuSekarang.getFullYear();
    const bulan = String(waktuSekarang.getMonth() + 1).padStart(2, '0');
    
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

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* REKAPITULASI TANGGAL */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem clamp(1rem, 4vw, 2rem)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 'bold', color: '#1e293b' }}>1. Rekapitulasi Jumlah Izin (Berdasarkan Tanggal)</h4>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Klik salah satu tanggal pada grafik untuk melihat rincian.</p>
        <div style={{ position: 'relative', height: '220px', marginTop: '2.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundImage: 'linear-gradient(to bottom, transparent 49.5%, #e2e8f0 50%, transparent 50.5%)', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '0 1rem 1.75rem 2.25rem' }}>
          {daftarTanggalGrafik.map((tglItem) => {
            const count = hitungIzinPerTanggal(tglItem.full);
            const dataTanggal = daftarIzin.filter((item) => normalisasiTanggal(item.tanggal) === normalisasiTanggal(tglItem.full));
            const jumlahWarna = hitungWarnaIzin(dataTanggal);
            const barHeight = count > 0 ? Math.max((count / maxCount) * 100, 25) : 0;

            return (
              <div key={tglItem.full} onClick={() => setTanggalTerpilih(tglItem.full)} style={{ flex: '1 1 0', maxWidth: '36px', minWidth: 0, height: '100%', position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                <div style={{ width: '100%', height: `${barHeight}%`, minHeight: count > 0 ? '30px' : '0px', backgroundColor: '#e5e7eb', display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px', overflow: 'hidden' }}>
                  {jumlahWarna.izin > 0 && <div style={{ height: `${(jumlahWarna.izin / count) * 100}%`, width: '100%', backgroundColor: '#3b82f6' }} />}
                  {jumlahWarna.sakit > 0 && <div style={{ height: `${(jumlahWarna.sakit / count) * 100}%`, width: '100%', backgroundColor: '#10b981' }} />}
                </div>
                <span style={{ position: 'absolute', bottom: '-18px', fontSize: '0.62rem', color: '#64748b', whiteSpace: 'nowrap' }}>{tglItem.label.slice(0, 5)}</span>
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
              <TabelDetail data={dataDetailTanggal} tampilTanggal={false} formatTanggal={normalisasiTanggal} />
            )}
          </div>
        )}
      </div>

      {/* GRAFIK JENIS KELAMIN & KELAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
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
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem clamp(1rem, 4vw, 2rem)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: '#1e293b' }}>
          Grafik Mingguan: {tanggalAwalGrafik} sampai {tanggalAkhirGrafik} (Klik bar hari)
        </h3>
        <div style={{ position: 'relative', height: '190px', display: 'flex', alignItems: 'flex-end', gap: 'clamp(0.2rem, 1.5vw, 1rem)', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 clamp(0.3rem, 2vw, 1rem) 0.5rem', marginTop: '1rem' }}>
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
                <span style={{ marginTop: '8px', fontSize: '0.72rem', color: hariTerpilih === minggu.label ? '#2563eb' : '#64748b', fontWeight: hariTerpilih === minggu.label ? 'bold' : 'normal' }} title={minggu.label}>{minggu.label.slice(0, 3)}</span>
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
              <TabelDetail data={dataHariTerpilih} tampilTanggal formatTanggal={normalisasiTanggal} />
            )}
          </div>
        )}
      </div>

      {/* GRAFIK BULANAN */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem clamp(1rem, 4vw, 2rem)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: '#1e293b' }}>Grafik Bulanan (Klik titik bulan)</h3>
        <div style={{ width: '100%' }}>
          <svg viewBox="0 0 740 220" role="img" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <line x1="20" y1="40" x2="20" y2="170" stroke="#cbd5e1" />
            <line x1="20" y1="170" x2="710" y2="170" stroke="#cbd5e1" />
            <path d={jalurBulanan} fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {rekapBulanan.map((bulan) => {
              const x = 20 + bulan.index * 60;
              const y = 170 - (bulan.data.length / maxBulanan) * 130;
              const isSelected = bulanTerpilih === bulan.index;
              return (
                <g key={bulan.nama} onClick={() => setBulanTerpilih(isSelected ? null : bulan.index)} style={{ cursor: 'pointer' }}>
                  <circle cx={x} cy={y} r="22" fill="transparent" />
                  <circle cx={x} cy={y} r={isSelected ? "11" : "8"} fill="#f59e0b" stroke={isSelected ? "#2563eb" : "#ffffff"} strokeWidth={isSelected ? "4" : "3"} />
                  <text x={x} y="200" textAnchor="middle" fontSize="15" fill={isSelected ? "#2563eb" : "#64748b"} fontWeight={isSelected ? "bold" : "normal"}>{bulan.nama.slice(0, 3)}</text>
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
              <TabelDetail data={dataBulanTerpilih} tampilTanggal formatTanggal={normalisasiTanggal} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardGuruPiket({ user, onLogout }) {
  const [daftarIzin, setDaftarIzin] = useState([]);
  const [activeMenu, setActiveMenu] = useState('verifikasi');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [jenisIzinTerpilih, setJenisIzinTerpilih] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // senyap = true  -> refresh di belakang layar (tanpa "Memuat...", tabel tidak berkedip/bergeser)
  // senyap = false -> dipakai saat pertama buka & tombol "Muat Ulang"
  const muatDataDariDatabase = async ({ senyap = false } = {}) => {
    if (!senyap) {
      setLoading(true);
      setErrorMessage('');
    }
    try {
      const response = await authFetch(`${API_URL}/pengajuan`);
      const result = await response.json();

      if (response.ok) {
        const dataBaru = Array.isArray(result) ? result : (result.data || []);
        // Kalau isinya sama persis, jangan ganti state supaya tampilan tidak ikut bergerak
        setDaftarIzin((lama) => (JSON.stringify(lama) === JSON.stringify(dataBaru) ? lama : dataBaru));
      } else if (!senyap) {
        setErrorMessage(result.message || 'Gagal memuat data dari database.');
      }
    } catch (error) {
      console.error('Gagal terhubung ke server:', error);
      if (!senyap) setErrorMessage('Terjadi kesalahan koneksi ke server.');
    } finally {
      if (!senyap) setLoading(false);
    }
  };

  useEffect(() => {
    muatDataDariDatabase();
    // Pembaruan otomatis hanya di belakang layar, dan dilewati kalau tab sedang tidak dilihat
    const intervalSync = setInterval(() => {
      if (!document.hidden) muatDataDariDatabase({ senyap: true });
    }, 10000);
    return () => clearInterval(intervalSync);
  }, []);

  const verifikasiPengajuan = async (item, status) => {
    const idItem = item.id || item.id_pengajuan || item.id_izin;
    const catatanVerifikasi = status === 'Disetujui' ? 'Disetujui oleh Guru Piket' : 'Ditolak oleh Guru Piket';

    try {
      const response = await authFetch(`${API_URL}/verifikasi-pengajuan/${idItem}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: status,
          catatan_verifikasi: catatanVerifikasi,
          id_guru: user?.id_pengguna || user?.id || 1,
          total_izin: item.total_izin_hitung || 1
        })
      });

      const result = await response.json();

      if (response.ok) {
        setActionMessage(`Pengajuan ${item.nama_lengkap || item.nama || 'siswa'} berhasil ${status.toLowerCase()}.`);
        muatDataDariDatabase({ senyap: true });
        setTimeout(() => setActionMessage(''), 4000);
      } else {
        setErrorMessage(result.message || 'Gagal memproses verifikasi.');
      }
    } catch (err) {
      console.error('Error verifikasi:', err);
      setErrorMessage('Terjadi kesalahan saat menghubungi server.');
    }
  };

  const jumlahPending = daftarIzin.filter((item) => {
    const status = String(item.status || '').toLowerCase();
    return status.includes('menunggu') || status === 'pending' || !item.status;
  }).length;

  const dataTerfilter = jenisIzinTerpilih
    ? daftarIzin.filter((item) => (item.jenis_izin || 'Tidak diketahui') === jenisIzinTerpilih)
    : daftarIzin;

  const formatTanggal = (tanggal) => String(tanggal || '-').split('T')[0];
  const normalisasiTanggal = (tanggal) => String(tanggal || '').split('T')[0];
  
  // ============================================================
  // DOWNLOAD EXCEL
  // Membuat file Excel (.xls) langsung di browser dari data izin
  // ============================================================
  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const downloadExcel = () => {
    if (!daftarIzin.length) {
      setErrorMessage('Belum ada data izin yang bisa diunduh.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    const kolom = [
      'No',
      'Nama Siswa',
      'Kelas',
      'Jenis Kelamin',
      'Jenis Izin',
      'Tanggal',
      'Alasan',
      'Status',
      'Catatan Verifikasi',
    ];

    const baris = daftarIzin.map((item, index) => [
      index + 1,
      item.nama_lengkap || item.nama || '-',
      item.kelas || '-',
      item.jenis_kelamin || '-',
      item.jenis_izin || '-',
      formatTanggal(item.tanggal),
      item.alasan || item.keterangan || '-',
      item.status || '-',
      item.catatan_verifikasi || '-',
    ]);

    const tabelHtml =
      '<table border="1">' +
      '<thead><tr>' +
      kolom.map((k) => `<th style="background:#1769a5;color:#ffffff;">${escapeHtml(k)}</th>`).join('') +
      '</tr></thead><tbody>' +
      baris
        .map((r) => '<tr>' + r.map((c) => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>')
        .join('') +
      '</tbody></table>';

    const dokumen =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="UTF-8">' +
      '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
      '<x:Name>Data Izin Siswa</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>' +
      '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
      '</head><body>' + tabelHtml + '</body></html>';

    // \uFEFF = BOM supaya huruf/karakter Indonesia tampil benar di Excel
    const blob = new Blob(['\uFEFF' + dokumen], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });

    const tglFile = new Date().toISOString().split('T')[0];
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-izin-siswa-${tglFile}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setActionMessage('File Excel berhasil diunduh.');
    setTimeout(() => setActionMessage(''), 4000);
  };

  return (
    <div className="dashboard-guru-container" style={styles.dashboardContainer}>
      <button
        type="button"
        className="mobile-dots-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={mobileMenuOpen}
      >
        ⋮
      </button>

      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 95
          }}
        />
      )}

      <div className={`sidebar-guru ${mobileMenuOpen ? 'sidebar-open' : ''}`} style={styles.sidebar}>
        <div>
          <div style={styles.sidebarHeader}>
            <div style={{ ...styles.logoBox, padding: '4px', backgroundColor: '#f3f4f6' }}>
              <img 
                src="logo_sekolah-removebg-preview.png" 
                alt="Logo SMK Negeri Compreng" 
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }} 
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div>
              <h3 style={styles.sidebarTitle}>Guru Piket</h3>
              <p style={styles.sidebarSubtitle}>SMK NEGERI COMPRENG</p>
            </div>
          </div>

          <div style={styles.menuList}>
            <button 
              onClick={() => { setActiveMenu('verifikasi'); setMobileMenuOpen(false); }} 
              style={{ 
                ...styles.menuItem, 
                ...(activeMenu === 'verifikasi' ? styles.menuItemActive : styles.menuItemNormal),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>Verifikasi Izin</span>
              {jumlahPending > 0 && (
                <span style={styles.badgeNotif}>{jumlahPending}</span>
              )}
            </button>
            <button onClick={() => { setActiveMenu('grafik'); setMobileMenuOpen(false); }} style={{ ...styles.menuItem, ...(activeMenu === 'grafik' ? styles.menuItemActive : styles.menuItemNormal) }}>
              Grafik Statistik
            </button>
          </div>
        </div>

        <div style={styles.sidebarFooter}>
          <button type="button" onClick={downloadExcel} style={styles.downloadButton}>Download Excel</button>
          <button onClick={onLogout} style={styles.logoutButton}>Keluar</button>
        </div>
      </div>

      <div className="main-content-guru" style={styles.mainContent}>
        <div style={activeMenu === 'grafik' ? { ...styles.contentCard, backgroundColor: 'transparent', border: 'none', boxShadow: 'none', padding: 0 } : styles.contentCard}>
          {activeMenu !== 'grafik' && (
          <div style={styles.contentHeaderRow}>
            <div>
              <h1 style={styles.pageTitle}>
                {activeMenu === 'verifikasi' ? 'Verifikasi Pengajuan Izin' : 'Grafik Statistik Izin Siswa'}
              </h1>
              <p style={styles.pageSubtitle}>
                {activeMenu === 'verifikasi' ? 'Kelola dan setujui pengajuan izin keluar masuk siswa.' : 'Rekapitulasi lengkap data perizinan siswa.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {jumlahPending > 0 && activeMenu === 'verifikasi' && (
                <div style={styles.topBannerNotification}>
                  ⚠️ Ada <strong>{jumlahPending}</strong> pengajuan siswa baru yang perlu diverifikasi!
                </div>
              )}
              <button onClick={() => muatDataDariDatabase()} disabled={loading} style={{ ...styles.reloadButton, minWidth: '104px' }}>
                {loading ? 'Memuat...' : 'Muat Ulang'}
              </button>
            </div>
          </div>
          )}

          <style>{`
            @media screen and (max-width: 768px) {
              .sidebar-guru {
                left: -280px !important;
                transition: left 0.3s ease-in-out;
                width: min(260px, 85vw) !important;
                height: 100dvh !important;
                overflow-y: auto !important;
                padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px)) !important;
              }
              .sidebar-guru.sidebar-open {
                left: 0 !important;
              }
              .main-content-guru {
                margin-left: 0 !important;
                padding: 16px !important;
                padding-top: 64px !important;
              }
            }
          `}</style>

          {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}
          {actionMessage && <div style={styles.successMessage}>{actionMessage}</div>}

          {activeMenu === 'grafik' && (
            <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem clamp(1rem, 4vw, 2rem)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Grafik Statistik Aktivitas Izin</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    Rekapitulasi jumlah izin berdasarkan tanggal, jenis kelamin, kelas, mingguan, dan bulanan.
                  </p>
                </div>
                <button onClick={() => muatDataDariDatabase()} disabled={loading} style={{ ...styles.reloadButton, minWidth: '104px' }}>
                  {loading ? 'Memuat...' : 'Muat Ulang'}
                </button>
              </div>

              {/* Grafik & tabel detail: komponen yang sama persis dengan Dashboard Siswa */}
              <GrafikStatistik daftarIzin={daftarIzin} />
            </div>
          )}

          {activeMenu === 'verifikasi' && (
            <div className="rt-wrap" style={styles.tableWrapper}>
              <table className="rt" style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>NAMA SISWA</th>
                    <th style={styles.th}>KELAS</th>
                    <th style={styles.th}>JENIS IZIN</th>
                    <th style={styles.th}>KETERANGAN</th>
                    <th style={styles.th}>TANGGAL</th>
                    <th style={styles.th}>AKSI / STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && daftarIzin.length === 0 ? (
                    <tr><td colSpan="7" style={styles.emptyData}>Memuat data...</td></tr>
                  ) : dataTerfilter.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={styles.emptyData}>Belum ada data pengajuan izin tersimpan.</td>
                    </tr>
                  ) : (
                    dataTerfilter.map((item, index) => {
                      const idItem = item.id || item.id_pengajuan || item.id_izin || index;
                      const statusItem = String(item.status || '').toLowerCase();
                      const isMenunggu = statusItem.includes('menunggu') || statusItem === 'pending' || !item.status;

                      return (
                        <tr key={idItem} style={styles.tableBodyRow}>
                          <td data-label="ID" style={styles.td}>{idItem}</td>
                          <td data-label="Nama Siswa" style={styles.td}>{item.nama_lengkap || item.nama || '-'}</td>
                          <td data-label="Kelas" style={styles.td}>{item.kelas || '-'}</td>
                          <td data-label="Jenis Izin" style={styles.td}>{item.jenis_izin || '-'}</td>
                          <td data-label="Keterangan" style={styles.td}>{item.catatan_verifikasi || item.keterangan || item.alasan || '-'}</td>
                          <td data-label="Tanggal" style={styles.td}>{formatTanggal(item.tanggal)}</td>
                          <td data-label="Aksi / Status" style={{ ...styles.td, ...styles.statusCell }}>
                            {!isMenunggu ? (
                              <span style={{ fontWeight: 'bold', color: statusItem.includes('disetujui') ? '#16a34a' : '#dc2626' }}>
                                {item.status}
                              </span>
                            ) : (
                              <div style={styles.actionGroup}>
                                <button
                                  onClick={() => verifikasiPengajuan(item, 'Disetujui')}
                                  style={styles.approveButton}
                                >
                                  Setujui
                                </button>
                                <button
                                  onClick={() => verifikasiPengajuan(item, 'Ditolak')}
                                  style={styles.rejectButton}
                                >
                                  Tolak
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  badgeNotif: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '9999px',
  },
  topBannerNotification: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '0.4rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.8rem',
    border: '1px solid #f59e0b',
  },
  dashboardContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'hidden'
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#ffffff',
    color: '#111827',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'fixed',
    height: '100vh',
    top: 0,
    left: 0,
    padding: '1.5rem 1rem',
    boxSizing: 'border-box',
    zIndex: 100,
    borderRight: '1px solid #e5e7eb',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '1.5rem',
  },
  logoBox: {
    width: '40px',
    height: '40px',
    backgroundColor: '#f59e0b',
    borderRadius: '8px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.2rem',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#111827',
  },
  sidebarSubtitle: {
    margin: '2px 0 0 0',
    fontSize: '0.65rem',
    color: '#6b7280',
  },
  menuList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  menuItemActive: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    textAlign: 'left',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  menuItemNormal: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: 'transparent',
    color: '#4b5563',
    border: 'none',
    borderRadius: '0.5rem',
    textAlign: 'left',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  sidebarFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  downloadButton: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#059669',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  logoutButton: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  mainContent: {
    marginLeft: '260px',
    flex: 1,
    padding: '2rem',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: '1rem',
    padding: '2rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e5e7eb',
    boxSizing: 'border-box',
    width: '100%',
  },
  contentHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '12px',
  },
  pageTitle: {
    margin: '0 0 0.25rem 0',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#111827',
  },
  pageSubtitle: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  reloadButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    fontWeight: '500',
    color: '#374151',
    cursor: 'pointer',
  },
  errorMessage: {
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    fontSize: '0.875rem',
  },
  successMessage: {
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontSize: '0.875rem',
  },
  statisticsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    backgroundColor: '#f1f5f9',
    padding: '16px',
    borderRadius: '12px',
  },
  chartPanel: {
    position: 'relative',
    marginBottom: '0.5rem',
    padding: '1.25rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.75rem',
    backgroundColor: '#f8fafc',
    boxSizing: 'border-box',
    overflowX: 'auto',
  },
  dateChart: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: '0.75rem',
    height: '220px',
    padding: '1rem 1rem 0.5rem',
    border: '1px solid #e2e8f0',
    borderRadius: '0.5rem',
    minWidth: '320px',
  },
  dateBarColumn: {
    position: 'relative',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  dateBar: {
    width: 'min(40px, 75%)',
  },
  dateLabel: {
    marginTop: '0.5rem',
    color: '#64748b',
    fontSize: '0.62rem',
    whiteSpace: 'nowrap',
  },
  detailBlock: {
    marginTop: '1.25rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
    overflowX: 'auto',
  },
  detailTitle: {
    margin: '0 0 0.75rem',
    color: '#1e293b',
    fontSize: '0.9rem',
  },
  mutedText: {
    margin: 0,
    color: '#94a3b8',
    fontSize: '0.8rem',
  },
  detailTable: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#475569',
    fontSize: '0.78rem',
    textAlign: 'left',
    minWidth: '500px',
  },
  sectionTitle: {
    margin: '0 0 1rem',
    fontSize: '1rem',
    color: '#111827',
  },
  statusCell: {
    fontWeight: '600',
  },
  actionGroup: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  approveButton: {
    padding: '0.35rem 0.55rem',
    border: 'none',
    borderRadius: '0.35rem',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  rejectButton: {
    padding: '0.35rem 0.55rem',
    border: 'none',
    borderRadius: '0.35rem',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cardGrafik: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    overflowX: 'auto',
  },
  btnTutupTabel: {
    padding: '0.35rem 0.75rem',
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
  },
  trHeadGrafik: {
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
  },
  thGrafik: {
    padding: '12px 14px',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    color: '#475569',
  },
  trBody: {
    borderBottom: '1px solid #f1f5f9',
  },
  tdGrafik: {
    padding: '12px 14px',
    color: '#334155',
  },
  tableWrapper: {
    overflowX: 'auto',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    minWidth: '650px',
  },
  tableHeaderRow: {
    backgroundColor: '#111827',
    color: '#ffffff',
  },
  th: {
    padding: '0.875rem 1rem',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  td: {
    padding: '1rem',
    fontSize: '0.875rem',
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
  },
  tableBodyRow: {
    backgroundColor: '#ffffff',
  },
  emptyData: {
    padding: '2rem',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '0.875rem',
  },
};
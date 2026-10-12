import React, { useState, useEffect, useRef } from 'react';
import { PENGAJUAN_API_URL as API_URL, authFetch } from './apiConfig';

const getDateOnly = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const formatTanggal = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return getDateOnly(value);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const getJamKembaliValue = (item) => {
  if (!item) return '-';

  return (
    item.waktu_selesai ||
    item.jam_kembali ||
    item.estimasi_kembali ||
    item.jam_datang_kembali ||
    item.waktu_kembali ||
    item.rencana_kembali ||
    item.jam ||
    '-'
  );
};

const getStatusVerifikasiSatpam = (item) => {
  const statusNested = String(
    item?.verifikasi_satpam?.status_verifikasi || ''
  ).trim().toLowerCase();

  if (statusNested.includes('tolak')) return 'Ditolak';
  if (statusNested.includes('setuju')) return 'Disetujui';

  const catatan = String(item?.catatan_verifikasi || '').trim().toLowerCase();

  if (catatan.includes('ditolak oleh satpam')) return 'Ditolak';
  if (catatan.includes('disetujui oleh satpam')) return 'Disetujui';

  return '';
};

const getStatusVerifikasiGuru = (item) => {
  const catatan = String(item?.catatan_verifikasi || '').toLowerCase();
  if (catatan.includes('ditolak oleh guru')) return 'Ditolak';
  if (catatan.includes('disetujui oleh guru')) return 'Disetujui';
  return '';
};

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

export default function DashboardSatpam({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('verifikasi');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dataIzin, setDataIzin] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState(null);
  const [actionType, setActionType] = useState('');
  const [catatanInput, setCatatanInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [notifikasiSatpam, setNotifikasiSatpam] = useState([]);
  // Menyimpan notifikasi yang sudah pernah tampil supaya tidak muncul berulang
  const notifSudahTampilRef = useRef(new Set());

  useEffect(() => {
    notifikasiSatpam.forEach((n) => notifSudahTampilRef.current.add(n.id));
  }, [notifikasiSatpam]);

  // Notifikasi otomatis hilang setelah 5 detik.
  useEffect(() => {
    if (notifikasiSatpam.length === 0) return;

    const timers = notifikasiSatpam.map((notifikasi) =>
      setTimeout(() => {
        setNotifikasiSatpam((prev) =>
          prev.filter((item) => item.id !== notifikasi.id)
        );
      }, 5000)
    );

    return () => timers.forEach(clearTimeout);
  }, [notifikasiSatpam]);

  // senyap = true -> refresh di belakang layar (tabel tidak berkedip / bergeser)
  const fetchPengajuan = async ({ senyap = false } = {}) => {
    try {
      if (!senyap) setLoading(true);
      const response = await authFetch(`${API_URL}/pengajuan?role=satpam`);
      const result = await response.json();

      if (response.ok && result.success) {
        const dataBaru = Array.isArray(result.data) ? result.data : [];
        // Kalau isinya sama persis, jangan ganti state supaya tampilan tidak ikut bergerak
        setDataIzin((lama) => (JSON.stringify(lama) === JSON.stringify(dataBaru) ? lama : dataBaru));
      } else {
        console.error('Gagal mengambil data:', result.message);
      }
    } catch (error) {
      console.error('Kesalahan koneksi ke server backend:', error);
    } finally {
      if (!senyap) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPengajuan();
  }, []);

  // ================= NOTIFIKASI SATPAM =================
  useEffect(() => {
    let aktif = true;

    const cekNotifikasiSatpam = async () => {
      try {
        const response = await authFetch(
          `${API_URL}/notifikasi?role=satpam&_notif=${Date.now()}`,
          {
            method: 'GET',
            cache: 'no-store'
          }
        );

        const result = await response.json();

        if (!aktif || !response.ok || !result.success) return;

        const dataNotifikasi = Array.isArray(result.data) ? result.data : [];

        if (dataNotifikasi.length > 0) {
          setNotifikasiSatpam((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            
            const notifikasiBaru = dataNotifikasi
              .map((item) => {
                const namaSiswa = item.nama_lengkap || item.nama_siswa || item.nama || 'Siswa';
                const idPengajuan = item.id_pengajuan || item.id;
                return {
                  id: `satpam-${item.notification_key || idPengajuan || Math.random()}`,
                  id_pengajuan: idPengajuan,
                  text: `Siswa ${namaSiswa} sudah di verifikasi oleh Guru Piket.`
                };
              })
              .filter((item) => {
                if (existingIds.has(item.id) || notifSudahTampilRef.current.has(item.id)) return false;
                
                // CEK KETAT: Jika pengajuan ini sudah disetujui/ditolak oleh satpam di tabel, jangan tampilkan notif!
                if (item.id_pengajuan) {
                  const targetData = dataIzin.find(
                    (d) => String(d.id_pengajuan) === String(item.id_pengajuan)
                  );
                  if (targetData) {
                    const status = getStatusVerifikasiSatpam(targetData);
                    if (status === 'Disetujui' || status === 'Ditolak') {
                      return false; // Abaikan notifikasi karena sudah diproses
                    }
                  }
                }
                return true;
              });

            if (notifikasiBaru.length === 0) return prev;
            // Hanya ambil 1 notifikasi paling atas/baru agar tidak menumpuk
            return [...notifikasiBaru, ...prev].slice(0, 1);
          });
        }
      } catch (error) {
        if (aktif) {
          console.error('Gagal mengecek notifikasi Satpam:', error);
        }
      }
    };

    // Panggil fetch pertama kali
    cekNotifikasiSatpam();

    // Cek berkala setiap 5 detik
    const interval = setInterval(cekNotifikasiSatpam, 5000);

    return () => {
      aktif = false;
      clearInterval(interval);
    };
  }, [dataIzin]); // Bergantung pada dataIzin agar status terbaru langsung memfilter notifikasi

  const handleOpenModal = (item, type) => {
    setSelectedItem(item);
    setActionType(type);

    if (type === 'setuju') {
      setCatatanInput('Disetujui oleh Satpam');
    } else {
      setCatatanInput('Ditolak oleh Satpam');
    }

    setIsModalOpen(true);
  };

  const handleSaveVerifikasi = async () => {
    if (!selectedItem) return;

    const statusFinal = actionType === 'setuju' ? 'Disetujui' : 'Ditolak';
    const catatanFinal = actionType === 'setuju' ? 'Disetujui oleh Satpam' : 'Ditolak oleh Satpam';
    const idSatpamAktif = user?.id_satpam || user?.id_pengguna || user?.id || null;

    try {
      const response = await authFetch(
        `${API_URL}/pengajuan/${selectedItem.id_pengajuan}/verifikasi`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: statusFinal,
            catatan_verifikasi: catatanFinal,
            role: 'satpam',
            id_satpam: idSatpamAktif
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setDataIzin((prevData) =>
          prevData.map((item) => {
            if (item.id_pengajuan === selectedItem.id_pengajuan) {
              return {
                ...item,
                status: statusFinal,
                catatan_verifikasi: catatanFinal,
                verifikasi_satpam: {
                  status_verifikasi: statusFinal,
                  catatan_verifikasi: catatanFinal
                }
              };
            }
            return item;
          })
        );

        // Hapus notifikasi yang bersesuaian dengan id_pengajuan ini agar langsung hilang
        setNotifikasiSatpam((prev) => 
          prev.filter((notif) => String(notif.id_pengajuan) !== String(selectedItem.id_pengajuan))
        );

        setIsModalOpen(false);
        setSelectedItem(null);
        setCatatanInput('');
        setActionType('');
        fetchPengajuan({ senyap: true });
      } else {
        alert('Gagal menyimpan ke database: ' + (result.message || 'Terjadi kesalahan'));
      }
    } catch (error) {
      console.error('Error koneksi:', error);
      alert('Tidak dapat terhubung ke server backend.');
    }
  };

  const logoSekolahUrl = 'logo sekolah.jpeg';

  return (
    <div className="dashboard-satpam-root" style={styles.container}>
      <button
        className="mobile-dots-btn"
        type="button"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={mobileMenuOpen}
      >
        ⋮
      </button>
      {mobileMenuOpen && (
        <button
          className="mobile-dashboard-overlay"
          type="button"
          aria-label="Tutup menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      {/* SIDEBAR */}
      <aside className={`dashboard-satpam-sidebar${mobileMenuOpen ? ' sidebar-open' : ''}`} style={styles.sidebar}>
        <div>
          <div style={styles.sidebarHeader}>
            <img src={logoSekolahUrl} alt="Logo Sekolah" style={styles.logoImg} />
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>Satpam Sekolah</h2>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>SMK NEGERI COMPRENG</p>
            </div>
          </div>

          <nav style={{ padding: '15px' }}>
            <button
              onClick={() => { setActiveMenu('verifikasi'); setMobileMenuOpen(false); }}
              style={{
                ...styles.navButton,
                backgroundColor: activeMenu === 'verifikasi' ? '#2563eb' : 'transparent',
                color: activeMenu === 'verifikasi' ? '#fff' : '#334155'
              }}
            >
              Verifikasi Izin
            </button>

            <button
              onClick={() => { setActiveMenu('statistik'); setMobileMenuOpen(false); }}
              style={{
                ...styles.navButton,
                backgroundColor: activeMenu === 'statistik' ? '#2563eb' : 'transparent',
                color: activeMenu === 'statistik' ? '#fff' : '#334155'
              }}
            >
              Grafik Statistik
            </button>
          </nav>
        </div>

        <div style={{ padding: '15px', borderTop: '1px solid #e2e8f0' }}>
          <button style={styles.btnExcel} onClick={() => alert('Fitur download Excel')}>
            Download Excel
          </button>
          <button style={styles.btnLogout} onClick={onLogout}>
            Keluar
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="dashboard-satpam-main" style={styles.main}>
        <header style={styles.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Logged in as: <strong>{user?.nama_lengkap || user?.username || 'Bella'}</strong>
            </span>
          </div>
        </header>

        {/* ======================================================== */}
        {/* FLOATING POP-UP NOTIFIKASI (POSISI ATAS TENGAH/KANAN)    */}
        {/* ======================================================== */}
        {notifikasiSatpam.length > 0 && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '55%',
              transform: 'translateX(-50%)',
              zIndex: 999999,
              width: '420px',
              maxWidth: 'calc(100vw - 40px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              pointerEvents: 'none'
            }}
          >
            {notifikasiSatpam.map((notifikasi) => (
              <div
                key={notifikasi.id}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '13px',
                  animation: 'satpamNotifMasuk 0.3s ease-out',
                  pointerEvents: 'auto',
                  position: 'relative'
                }}
              >
                {/* Ikon Lonceng */}
                <span style={{ fontSize: '18px', lineHeight: 1, marginTop: '2px' }}>🔔</span>
                
                <div style={{ flex: 1, lineHeight: '1.4' }}>
                  <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '3px' }}>
                    Izin Keluar Masuk Siswa
                  </div>
                  <div style={{ color: '#475569' }}>{notifikasi.text}</div>
                </div>

                {/* Tombol Tutup (X) */}
                <button
                  onClick={() =>
                    setNotifikasiSatpam((prev) =>
                      prev.filter((item) => item.id !== notifikasi.id)
                    )
                  }
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    color: '#94a3b8',
                    padding: '0'
                  }}
                  title="Tutup"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <style>{`
          @keyframes satpamNotifMasuk {
            from { opacity: 0; transform: translate(-50%, -20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
        `}</style>

        <div style={styles.contentBody}>
          {activeMenu === 'verifikasi' ? (
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Verifikasi Pengajuan Izin</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    Kelola dan setujui pengajuan izin keluar masuk siswa.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button style={styles.btnReload} onClick={() => fetchPengajuan()}>
                    Muat Ulang
                  </button>
                </div>
              </div>

              <div className="rt-wrap" style={{ width: '100%', overflowX: 'auto' }}>
                <table className="rt" style={styles.table}>
                  <thead>
                    <tr style={styles.trHead}>
                      <th style={styles.th}>ID</th>
                      <th style={styles.th}>Nama Siswa</th>
                      <th style={styles.th}>Kelas</th>
                      <th style={styles.th}>Jenis Izin</th>
                      <th style={styles.th}>Jam Kembali (Pengajuan)</th>
                      <th style={styles.th}>Catatan Verifikasi</th>
                      <th style={styles.th}>Tanggal</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Aksi / Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && dataIzin.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                          Memuat data dari database...
                        </td>
                      </tr>
                    ) : dataIzin.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                          Belum ada data izin.
                        </td>
                      </tr>
                    ) : (
                      dataIzin.map((row) => {
                        const statusSatpam = getStatusVerifikasiSatpam(row);
                        const sudahDiverifikasiSatpam = Boolean(statusSatpam);
                        const statusGuru = getStatusVerifikasiGuru(row);

                        return (
                          <tr key={row.id_pengajuan} style={styles.trBody}>
                            <td data-label="ID" style={styles.td}>{row.id_pengajuan}</td>
                            <td data-label="Nama Siswa" style={{ ...styles.td, fontWeight: '600', color: '#0f172a' }}>{row.nama_lengkap}</td>
                            <td data-label="Kelas" style={styles.td}>{row.kelas}</td>
                            <td data-label="Jenis Izin" style={styles.td}>{row.jenis_izin}</td>
                            <td data-label="Jam Kembali" style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>
                              {getJamKembaliValue(row)}
                            </td>
                            <td data-label="Catatan Verifikasi" style={{ ...styles.td, fontStyle: 'italic', color: '#64748b' }}>
                              {row.catatan_verifikasi || 'Belum diverifikasi oleh Satpam'}
                            </td>
                            <td data-label="Tanggal" style={styles.td}>{String(row.tanggal || '').split('T')[0]}</td>
                            <td data-label="Aksi / Status" style={{ ...styles.td, textAlign: 'center' }}>
                              {sudahDiverifikasiSatpam ? (
                                statusSatpam === 'Disetujui' ? (
                                  <span style={styles.badgeSuccess}>Disetujui</span>
                                ) : (
                                  <span style={styles.badgeDanger}>Ditolak</span>
                                )
                              ) : statusGuru === 'Disetujui' ? (
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button onClick={() => handleOpenModal(row, 'setuju')} style={styles.btnSetuju}>
                                    Setujui
                                  </button>
                                  <button onClick={() => handleOpenModal(row, 'tolak')} style={styles.btnTolak}>
                                    Tolak
                                  </button>
                                </div>
                              ) : statusGuru === 'Ditolak' ? (
                                <span style={styles.badgeDanger}>Ditolak Guru Piket</span>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                  Menunggu Guru Piket
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ ...styles.card, border: 'none', padding: '1.5rem clamp(1rem, 4vw, 2rem)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Grafik Statistik Aktivitas Izin</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Rekapitulasi jumlah izin berdasarkan tanggal, jenis kelamin, kelas, mingguan, dan bulanan.
                    </p>
                  </div>
                  <button style={styles.btnReload} onClick={() => fetchPengajuan()}>
                    Muat Ulang
                  </button>
                </div>
              </div>

              {/* Grafik & tabel detail: komponen yang sama persis dengan Dashboard Siswa */}
              <GrafikStatistik daftarIzin={dataIzin} />
            </div>
          )}
        </div>
      </main>

      {/* MODAL VERIFIKASI */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#1e293b' }}>
              Konfirmasi Verifikasi ({actionType === 'setuju' ? 'Setujui' : 'Tolak'})
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '5px' }}>
              Siswa: <strong>{selectedItem?.nama_lengkap}</strong> ({selectedItem?.kelas})
            </p>
            <p style={{ fontSize: '13px', color: '#2563eb', fontWeight: 'bold', marginBottom: '15px' }}>
              Jam Kembali (Pengajuan Siswa): {getJamKembaliValue(selectedItem)}
            </p>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#475569' }}>
              Catatan Verifikasi Satpam
            </label>
            <textarea
              value={catatanInput}
              onChange={(e) => setCatatanInput(e.target.value)}
              rows="3"
              style={styles.textarea}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedItem(null);
                }}
                style={styles.btnBatal}
              >
                Batal
              </button>
              <button
                onClick={handleSaveVerifikasi}
                style={{
                  ...styles.btnSimpan,
                  backgroundColor: actionType === 'setuju' ? '#16a34a' : '#dc2626'
                }}
              >
                Simpan ke Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLE
// ============================================================

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#f1f5f9',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden'
  },
  sidebar: {
    width: '250px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRight: '1px solid #e2e8f0'
  },
  sidebarHeader: {
    padding: '20px 20px 15px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoImg: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '1px solid #cbd5e1',
    flexShrink: 0
  },
  navButton: {
    width: '100%',
    padding: '12px 15px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '6px'
  },
  btnExcel: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginBottom: '8px'
  },
  btnLogout: {
    width: '100%',
    padding: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#dc2626',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto'
  },
  topbar: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 30px',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexShrink: 0
  },
  contentBody: {
    padding: '30px',
    width: '100%',
    boxSizing: 'border-box'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
    width: '100%',
    boxSizing: 'border-box'
  },
  btnReload: {
    padding: '8px 15px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#fff',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  },
  btnTutupTabel: {
    padding: '6px 12px',
    backgroundColor: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#475569'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px'
  },
  trHead: {
    backgroundColor: '#0b132b',
    color: '#ffffff',
    borderBottom: '2px solid #1e293b'
  },
  th: {
    padding: '12px 14px',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    color: '#ffffff'
  },
  trHeadGrafik: {
    backgroundColor: '#f8fafc',
    color: '#334155',
    borderBottom: '2px solid #e2e8f0'
  },
  thGrafik: {
    padding: '12px 14px',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    color: '#475569'
  },
  trBody: {
    borderBottom: '1px solid #f1f5f9'
  },
  td: {
    padding: '12px 14px',
    color: '#334155',
    whiteSpace: 'nowrap'
  },
  badgeSuccess: {
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 'bold',
    display: 'inline-block'
  },
  badgeDanger: {
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 'bold',
    display: 'inline-block'
  },
  btnSetuju: {
    backgroundColor: '#16a34a',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  btnTolak: {
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: '25px',
    borderRadius: '12px',
    width: '400px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none'
  },
  btnBatal: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#e2e8f0',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    color: '#475569'
  },
  btnSimpan: {
    flex: 1,
    padding: '10px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};
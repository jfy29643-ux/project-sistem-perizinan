import React, { useState, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { API_URL, authFetch } from './apiConfig';

const HARI_LABEL = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PENUH = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const getDateOnly = (value) => (value ? String(value).split('T')[0] : '');

const toYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isSakit = (item) => String(item?.jenis_izin || '').toLowerCase().includes('sakit');

// 0 = Senin ... 6 = Minggu (-1 kalau tanggal tidak valid)
const getIndexHari = (value) => {
  const tgl = getDateOnly(value);
  if (!tgl) return -1;
  const d = new Date(`${tgl}T00:00:00`);
  if (Number.isNaN(d.getTime())) return -1;
  const i = d.getDay();
  return i === 0 ? 6 : i - 1;
};

// Kelompokkan per siswa. Dipakai untuk tabel detail grafik.
// perTanggal = true  -> 1 baris per siswa per tanggal (grafik tanggal & mingguan)
// perTanggal = false -> 1 baris per siswa (grafik bulanan)
const kelompokkanSiswa = (list, perTanggal = true) => {
  const map = {};
  (list || []).forEach((item) => {
    const nama = item.nama_lengkap || item.nama || 'Tanpa Nama';
    const kelas = item.kelas || '-';
    const tgl = getDateOnly(item.tanggal);
    const key = perTanggal ? `${nama}_${kelas}_${tgl}` : `${nama}_${kelas}`;
    const alasan = item.alasan || item.keterangan || item.jenis_izin || '-';
    const jenis = isSakit(item) ? 'Sakit' : 'Izin';

    if (!map[key]) {
      map[key] = {
        nama,
        kelas,
        jenis_kelamin: item.jenis_kelamin || '-',
        tanggal: tgl,
        total_izin: 0,
        alasan_list: [],
        jenis_list: [],
      };
    }
    const row = map[key];
    row.total_izin += 1;
    if (!row.alasan_list.includes(alasan)) row.alasan_list.push(alasan);
    if (!row.jenis_list.includes(jenis)) row.jenis_list.push(jenis);
  });

  return Object.values(map).map((row) => ({
    ...row,
    alasan: row.alasan_list.join(', '),
    jenis: row.jenis_list.join(', '),
  }));
};

export default function DashboardGuruPiket({ user, onLogout }) {
  const [daftarIzin, setDaftarIzin] = useState([]);
  const [activeMenu, setActiveMenu] = useState('verifikasi');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [jenisIzinTerpilih, setJenisIzinTerpilih] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState(null);
  const [selectedMonthlyIndex, setSelectedMonthlyIndex] = useState(null);
  const [tanggalSekarang, setTanggalSekarang] = useState(() => new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTanggalSekarang(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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
  
  const tahunIni = tanggalSekarang.getFullYear();

  // Data untuk tabel detail saat grafik diklik
  const dataTabelTanggal = kelompokkanSiswa(
    daftarIzin.filter((item) => getDateOnly(item.tanggal) === selectedDate),
    true
  );

  const dataTabelMingguan = kelompokkanSiswa(
    daftarIzin.filter(
      (item) => selectedWeeklyDay !== null && getIndexHari(item.tanggal) === selectedWeeklyDay.index
    ),
    true
  );

  const dataTabelBulanan = kelompokkanSiswa(
    daftarIzin.filter((item) => {
      if (selectedMonthlyIndex === null) return false;
      const tgl = getDateOnly(item.tanggal);
      if (!tgl) return false;
      const d = new Date(`${tgl}T00:00:00`);
      return d.getFullYear() === tahunIni && d.getMonth() === selectedMonthlyIndex.index;
    }),
    false
  );

  // ============================================================
  // GRAFIK (Chart.js) - tanggal, mingguan, bulanan
  // Klik batang / titik -> tabel siswa yang izin muncul di bawah grafik
  // ============================================================
  useEffect(() => {
    if (activeMenu !== 'grafik') return;

    const opsiLegend = {
      legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 8, font: { size: 10 }, padding: 10 } },
    };
    const skalaY = { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { borderDash: [4, 4] } };
    const skalaX = { grid: { display: false } };
    const charts = [];

    // --- Grafik Tanggal: tanggal 07 sampai 01 pada bulan berjalan (sama seperti Satpam) ---
    const tahunSkrg = tanggalSekarang.getFullYear();
    const bulanSkrg = String(tanggalSekarang.getMonth() + 1).padStart(2, '0');
    const labelTanggal = Array.from({ length: 7 }, (_, i) => `${tahunSkrg}-${bulanSkrg}-${String(7 - i).padStart(2, '0')}`);
    const tanggalIzin = labelTanggal.map(
      (t) => daftarIzin.filter((it) => getDateOnly(it.tanggal) === t && !isSakit(it)).length
    );
    const tanggalSakit = labelTanggal.map(
      (t) => daftarIzin.filter((it) => getDateOnly(it.tanggal) === t && isSakit(it)).length
    );

    const ctxTanggal = document.getElementById('gpChartTanggal')?.getContext('2d');
    if (ctxTanggal) {
      charts.push(new Chart(ctxTanggal, {
        type: 'bar',
        data: {
          labels: labelTanggal,
          datasets: [
            { label: 'Izin', data: tanggalIzin, backgroundColor: '#2563eb', borderRadius: 4, maxBarThickness: 35 },
            { label: 'Sakit', data: tanggalSakit, backgroundColor: '#10b981', borderRadius: 4, maxBarThickness: 35 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements && elements.length > 0) setSelectedDate(labelTanggal[elements[0].index]);
          },
          scales: { y: skalaY, x: skalaX },
          plugins: opsiLegend,
        },
      }));
    }

    // --- Grafik Jenis Kelamin ---
    let jmlPerempuan = 0;
    let jmlLaki = 0;
    daftarIzin.forEach((item) => {
      const jk = String(item.jenis_kelamin || '').trim().toLowerCase();
      if (jk.startsWith('p')) jmlPerempuan += 1;
      else if (jk.startsWith('l')) jmlLaki += 1;
    });
    const ctxKelamin = document.getElementById('gpChartKelamin')?.getContext('2d');
    if (ctxKelamin) {
      charts.push(new Chart(ctxKelamin, {
        type: 'doughnut',
        data: {
          labels: ['Perempuan', 'Laki-laki'],
          datasets: [{ data: [jmlPerempuan, jmlLaki], backgroundColor: ['#db2777', '#3b82f6'], borderWidth: 0 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: opsiLegend },
      }));
    }

    // --- Grafik Berdasarkan Kelas ---
    const hitungKelas = {};
    daftarIzin.forEach((item) => {
      const kls = item.kelas || 'Lainnya';
      hitungKelas[kls] = (hitungKelas[kls] || 0) + 1;
    });
    const labelKelas = Object.keys(hitungKelas);
    const ctxKelas = document.getElementById('gpChartKelas')?.getContext('2d');
    if (ctxKelas) {
      charts.push(new Chart(ctxKelas, {
        type: 'bar',
        data: {
          labels: labelKelas.length > 0 ? labelKelas : ['-'],
          datasets: [{
            label: 'Jumlah',
            data: labelKelas.length > 0 ? labelKelas.map((k) => hitungKelas[k]) : [0],
            backgroundColor: '#8b5cf6',
            borderRadius: 4,
            maxBarThickness: 35,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { borderDash: [4, 4] } },
            y: { grid: { display: false } },
          },
          plugins: { legend: { display: false } },
        },
      }));
    }

    // --- Grafik Mingguan: Senin - Minggu ---
    const mingguIzin = [0, 0, 0, 0, 0, 0, 0];
    const mingguSakit = [0, 0, 0, 0, 0, 0, 0];
    daftarIzin.forEach((item) => {
      const idx = getIndexHari(item.tanggal);
      if (idx < 0) return;
      if (isSakit(item)) mingguSakit[idx] += 1;
      else mingguIzin[idx] += 1;
    });

    const ctxMingguan = document.getElementById('gpChartMingguan')?.getContext('2d');
    if (ctxMingguan) {
      charts.push(new Chart(ctxMingguan, {
        type: 'bar',
        data: {
          labels: HARI_LABEL,
          datasets: [
            { label: 'Izin', data: mingguIzin, backgroundColor: '#2563eb', borderRadius: 4, maxBarThickness: 35 },
            { label: 'Sakit', data: mingguSakit, backgroundColor: '#10b981', borderRadius: 4, maxBarThickness: 35 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements && elements.length > 0) {
              const index = elements[0].index;
              setSelectedWeeklyDay({ index, name: HARI_LABEL[index] });
            }
          },
          scales: { y: skalaY, x: skalaX },
          plugins: opsiLegend,
        },
      }));
    }

    // --- Grafik Bulanan: Jan - Des tahun berjalan ---
    const nilaiBulan = BULAN_SINGKAT.map((_, m) =>
      daftarIzin.filter((item) => {
        const tgl = getDateOnly(item.tanggal);
        if (!tgl) return false;
        const d = new Date(`${tgl}T00:00:00`);
        return d.getFullYear() === tahunIni && d.getMonth() === m;
      }).length
    );

    const ctxBulanan = document.getElementById('gpChartBulanan')?.getContext('2d');
    if (ctxBulanan) {
      charts.push(new Chart(ctxBulanan, {
        type: 'line',
        data: {
          labels: BULAN_SINGKAT,
          datasets: [{
            label: 'Jumlah Izin',
            data: nilaiBulan,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.12)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements && elements.length > 0) {
              const index = elements[0].index;
              setSelectedMonthlyIndex({ index, name: BULAN_SINGKAT[index] });
            }
          },
          scales: { y: skalaY, x: skalaX },
          plugins: opsiLegend,
        },
      }));
    }

    return () => charts.forEach((c) => c.destroy());
  }, [activeMenu, daftarIzin, tanggalSekarang]);

  // Tabel detail yang dipakai bersama oleh ketiga grafik
  const renderTabelDetail = (judul, rows, onTutup, tampilkanTanggal = false) => (
    <div style={styles.cardGrafik}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{judul}</h3>
        <button type="button" onClick={onTutup} style={styles.btnTutupTabel}>Tutup Tabel</button>
      </div>
      <div className="rt-wrap" style={styles.tableWrapper}>
        <table className="rt" style={styles.detailTable}>
          <thead>
            <tr style={styles.trHeadGrafik}>
              <th style={styles.thGrafik}>Nama</th>
              <th style={styles.thGrafik}>Kelas</th>
              <th style={styles.thGrafik}>Jenis Kelamin</th>
              <th style={styles.thGrafik}>Jenis</th>
              <th style={styles.thGrafik}>Alasan</th>
              {tampilkanTanggal && <th style={styles.thGrafik}>Tanggal</th>}
              <th style={styles.thGrafik}>Total Izin</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={tampilkanTanggal ? 7 : 6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={`${row.nama}-${row.kelas}-${row.tanggal}-${idx}`} style={styles.trBody}>
                  <td data-label="Nama" style={{ ...styles.tdGrafik, fontWeight: '600', color: '#0f172a' }}>{row.nama}</td>
                  <td data-label="Kelas" style={styles.tdGrafik}>{row.kelas}</td>
                  <td data-label="Jenis Kelamin" style={styles.tdGrafik}>{row.jenis_kelamin}</td>
                  <td data-label="Jenis" style={styles.tdGrafik}>{row.jenis}</td>
                  <td data-label="Alasan" style={styles.tdGrafik}>{row.alasan}</td>
                  {tampilkanTanggal && <td data-label="Tanggal" style={styles.tdGrafik}>{row.tanggal || '-'}</td>}
                  <td data-label="Total Izin" style={styles.tdGrafik}>{row.total_izin}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

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
        <div style={styles.contentCard}>
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
                padding: 12px !important;
                padding-top: 64px !important;
              }
            }
          `}</style>

          {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}
          {actionMessage && <div style={styles.successMessage}>{actionMessage}</div>}

          {activeMenu === 'grafik' && (
            <div style={styles.statisticsStack}>
              <div style={styles.cardGrafik}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Grafik Statistik Aktivitas Izin</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Rekapitulasi jumlah izin berdasarkan tanggal, jenis kelamin, kelas, mingguan, dan bulanan.
                </p>
              </div>

              {/* GRAFIK TANGGAL */}
              <div style={styles.cardGrafik}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b' }}>Rekapitulasi Jumlah Izin Berdasarkan Tanggal</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Klik tanggal atau warna pada grafik untuk melihat tabel detail pengajuan.</p>
                <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                  <canvas id="gpChartTanggal" />
                </div>
              </div>
              {selectedDate &&
                renderTabelDetail(`Detail Izin Tanggal ${selectedDate}`, dataTabelTanggal, () => setSelectedDate(null))}

              {/* GRAFIK KELAMIN & KELAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div style={styles.cardGrafik}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1e293b' }}>Grafik Jenis Kelamin</h3>
                  <div style={{ position: 'relative', height: '220px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <canvas id="gpChartKelamin" />
                  </div>
                </div>
                <div style={styles.cardGrafik}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1e293b' }}>Grafik Berdasarkan Kelas</h3>
                  <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                    <canvas id="gpChartKelas" />
                  </div>
                </div>
              </div>

              {/* GRAFIK MINGGUAN */}
              <div style={styles.cardGrafik}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b' }}>Grafik Mingguan</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
                  Jumlah pengajuan izin dan sakit dari hari Senin sampai Minggu. Klik batang grafik untuk melihat detail.
                </p>
                <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                  <canvas id="gpChartMingguan" />
                </div>
              </div>
              {selectedWeeklyDay !== null &&
                renderTabelDetail(
                  `Detail Izin Hari ${selectedWeeklyDay.name}`,
                  dataTabelMingguan,
                  () => setSelectedWeeklyDay(null),
                  true
                )}

              {/* GRAFIK BULANAN */}
              <div style={styles.cardGrafik}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b' }}>Grafik Bulanan</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
                  Jumlah pengajuan izin berdasarkan bulan pada tahun berjalan. Klik titik bulan untuk melihat detail tabel bulanan.
                </p>
                <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                  <canvas id="gpChartBulanan" />
                </div>
              </div>
              {selectedMonthlyIndex !== null &&
                renderTabelDetail(
                  `Detail Izin Bulan ${BULAN_PENUH[selectedMonthlyIndex.index]}`,
                  dataTabelBulanan,
                  () => setSelectedMonthlyIndex(null)
                )}
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
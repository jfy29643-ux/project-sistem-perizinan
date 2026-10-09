import React, { useState, useEffect } from 'react';
import { API_URL, authFetch } from './apiConfig';

const getSiswaUnik = (dataArray) => {
  const mapData = {};
  (dataArray || []).forEach((item) => {
    const key = `${item.nama_lengkap || item.nama}-${item.kelas}-${item.jenis_kelamin}`;
    if (!mapData[key]) {
      mapData[key] = { ...item, total_izin_hitung: 0 };
    }
    mapData[key].total_izin_hitung += 1;
  });
  return Object.values(mapData);
};

export default function DashboardGuruPiket({ user, onLogout }) {
  const [daftarIzin, setDaftarIzin] = useState([]);
  const [activeMenu, setActiveMenu] = useState('verifikasi');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [jenisIzinTerpilih, setJenisIzinTerpilih] = useState('');
  const [tanggalTerpilih, setTanggalTerpilih] = useState('');
  const [bulanTerpilih, setBulanTerpilih] = useState('');
  const [tanggalSekarang, setTanggalSekarang] = useState(() => new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTanggalSekarang(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const muatDataDariDatabase = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await authFetch(`${API_URL}/pengajuan`);
      const result = await response.json();
      
      if (response.ok) {
        setDaftarIzin(Array.isArray(result) ? result : (result.data || []));
      } else {
        setErrorMessage(result.message || 'Gagal memuat data dari database.');
        setDaftarIzin([]);
      }
    } catch (error) {
      console.error('Gagal terhubung ke server:', error);
      setErrorMessage('Terjadi kesalahan koneksi ke server.');
      setDaftarIzin([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muatDataDariDatabase();
    const intervalSync = setInterval(muatDataDariDatabase, 5000);
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
        muatDataDariDatabase();
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
  
  const hariMinggu = [
    { label: 'Senin', index: 1 },
    { label: 'Selasa', index: 2 },
    { label: 'Rabu', index: 3 },
    { label: 'Kamis', index: 4 },
    { label: 'Jumat', index: 5 },
    { label: 'Sabtu', index: 6 },
    { label: 'Minggu', index: 0 },
  ];

  const hitungIzinPerHari = (dayIndex) => {
    return daftarIzin.filter((item) => {
      if (!item.tanggal) return false;
      const d = new Date(item.tanggal);
      return d.getDay() === dayIndex;
    }).length;
  };

  const maxHari = Math.max(...hariMinggu.map(h => hitungIzinPerHari(h.index)), 1);

  const daftarBulan = [
    { label: 'Jan', index: 1 },
    { label: 'Feb', index: 2 },
    { label: 'Mar', index: 3 },
    { label: 'Apr', index: 4 },
    { label: 'Mei', index: 5 },
    { label: 'Jun', index: 6 },
    { label: 'Jul', index: 7 },
    { label: 'Agu', index: 8 },
    { label: 'Sep', index: 9 },
    { label: 'Okt', index: 10 },
    { label: 'Nov', index: 11 },
    { label: 'Des', index: 12 },
  ];

  const hitungIzinPerBulan = (bulanIndex) => {
    const tahunIni = new Date().getFullYear();
    return daftarIzin.filter((item) => {
      if (!item.tanggal) return false;
      const d = new Date(item.tanggal);
      return d.getFullYear() === tahunIni && (d.getMonth() + 1) === bulanIndex;
    }).length;
  };

  const maxBulan = Math.max(...daftarBulan.map(b => hitungIzinPerBulan(b.index)), 1);

  const dataDetailTanggal = tanggalTerpilih
    ? daftarIzin.filter((item) => normalisasiTanggal(item.tanggal) === tanggalTerpilih)
    : [];

  const dataDetailBulan = bulanTerpilih
    ? daftarIzin.filter((item) => {
        if (!item.tanggal) return false;
        const d = new Date(item.tanggal);
        return (d.getMonth() + 1) === Number(bulanTerpilih);
      })
    : [];

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
              <button onClick={muatDataDariDatabase} disabled={loading} style={styles.reloadButton}>
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
              {/* Grafik Mingguan */}
              <div style={styles.chartPanel}>
                <div>
                  <h2 style={styles.sectionTitle}>Grafik Mingguan: 01 Oktober 2026 sampai 31 Oktober 2026 (Klik bar hari)</h2>
                </div>

                <div style={styles.dateChart}>
                  {hariMinggu.map((hari) => { 
                    const total = hitungIzinPerHari(hari.index);
                    const tinggi = total ? (total / maxHari) * 100 : 0; 
                    const itemMatch = daftarIzin.find(i => i.tanggal && new Date(i.tanggal).getDay() === hari.index);
                    const tanggalStr = itemMatch ? normalisasiTanggal(itemMatch.tanggal) : '';

                    return (
                      <div key={hari.label} style={styles.dateBarColumn}>
                        <div 
                          style={{ 
                            ...styles.dateBar, 
                            height: `${tinggi}%`, 
                            backgroundColor: '#2563eb',
                            borderRadius: '6px 6px 0 0',
                            cursor: tanggalStr ? 'pointer' : 'default'
                          }}
                        />
                        <span 
                          onClick={() => tanggalStr && setTanggalTerpilih(tanggalStr)} 
                          style={{ ...styles.dateLabel, cursor: tanggalStr ? 'pointer' : 'default' }}
                        >
                          {hari.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {tanggalTerpilih && (
                  <div style={styles.detailBlock}>
                    <h3 style={styles.detailTitle}>Detail Izin Tanggal {tanggalTerpilih}</h3>
                    {dataDetailTanggal.length === 0 ? (
                      <p style={styles.mutedText}>Tidak ada izin pada tanggal ini.</p>
                    ) : (
                      <div style={styles.tableWrapper}>
                        <table cellPadding="10" style={styles.detailTable}>
                          <thead>
                            <tr>
                              <th>Nama</th>
                              <th>Kelas</th>
                              <th>Jenis Kelamin</th>
                              <th>Jenis Izin</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSiswaUnik(dataDetailTanggal).map((item, index) => (
                              <tr key={`${item.id || index}-${item.nama_lengkap}`}>
                                <td>{item.nama_lengkap || item.nama || '-'}</td>
                                <td>{item.kelas || '-'}</td>
                                <td>{item.jenis_kelamin || '-'}</td>
                                <td>{item.jenis_izin || '-'}</td>
                                <td>{item.status || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Grafik Bulanan dengan SVG Line */}
              <div style={styles.chartPanel}>
                <div>
                  <h2 style={styles.sectionTitle}>Grafik Bulanan (Klik titik bulan)[cite: 12]</h2>
                </div>

                <div style={{ position: 'relative', height: '220px', padding: '1rem 1rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minWidth: '320px' }}>
                  {/* Garis SVG Kurva Bulanan */}
                  <svg style={{ position: 'absolute', top: '1rem', left: '1rem', width: 'calc(100% - 2rem)', height: '160px', overflow: 'visible', pointerEvents: 'none' }}>
                    <path
                      d={(() => {
                        const count = daftarBulan.length;
                        const points = daftarBulan.map((bulan, i) => {
                          const total = hitungIzinPerBulan(bulan.index);
                          const x = (i / (count - 1)) * 100;
                          const y = 140 - (total / maxBulan) * 110;
                          return { x, y };
                        });
                        return points.reduce((acc, p, i) => (i === 0 ? `M ${p.x}% ${p.y}px` : `${acc} L ${p.x}% ${p.y}px`), '');
                      })()}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                    />
                  </svg>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '100%', zIndex: 2 }}>
                    {daftarBulan.map((bulan) => {
                      const total = hitungIzinPerBulan(bulan.index);
                      return (
                        <div key={bulan.label} style={{ position: 'relative', display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <div 
                            onClick={() => setBulanTerpilih(bulan.index)}
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: '#f59e0b',
                              cursor: 'pointer',
                              transform: total > 0 ? 'scale(1.4)' : 'scale(1)',
                              transition: 'transform 0.2s',
                              marginBottom: '10px',
                              boxShadow: '0 0 0 3px #fff'
                            }}
                            title={`${bulan.label}: ${total} izin`}
                          />
                          <span 
                            onClick={() => setBulanTerpilih(bulan.index)}
                            style={{ ...styles.dateLabel, cursor: 'pointer' }}
                          >
                            {bulan.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {bulanTerpilih && (
                  <div style={styles.detailBlock}>
                    <h3 style={styles.detailTitle}>Detail Izin Bulan {daftarBulan.find(b => b.index === Number(bulanTerpilih))?.label}</h3>
                    {dataDetailBulan.length === 0 ? (
                      <p style={styles.mutedText}>Tidak ada izin pada bulan ini.</p>
                    ) : (
                      <div style={styles.tableWrapper}>
                        <table cellPadding="10" style={styles.detailTable}>
                          <thead>
                            <tr>
                              <th>Nama</th>
                              <th>Kelas</th>
                              <th>Jenis Kelamin</th>
                              <th>Jenis Izin</th>
                              <th>Tanggal</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSiswaUnik(dataDetailBulan).map((item, index) => (
                              <tr key={`${item.id || index}-${item.nama_lengkap}`}>
                                <td>{item.nama_lengkap || item.nama || '-'}</td>
                                <td>{item.kelas || '-'}</td>
                                <td>{item.jenis_kelamin || '-'}</td>
                                <td>{item.jenis_izin || '-'}</td>
                                <td>{formatTanggal(item.tanggal)}</td>
                                <td>{item.status || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'verifikasi' && (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
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
                  {loading ? (
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
                          <td style={styles.td}>{idItem}</td>
                          <td style={styles.td}>{item.nama_lengkap || item.nama || '-'}</td>
                          <td style={styles.td}>{item.kelas || '-'}</td>
                          <td style={styles.td}>{item.jenis_izin || '-'}</td>
                          <td style={styles.td}>{item.catatan_verifikasi || item.keterangan || item.alasan || '-'}</td>
                          <td style={styles.td}>{formatTanggal(item.tanggal)}</td>
                          <td style={{ ...styles.td, ...styles.statusCell }}>
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
    gap: '1.5rem',
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
import React, { useState, useEffect, useRef } from 'react';

const API_URL = 'http://127.0.0.1:5002/api';

// Fungsi pembantu untuk menggabungkan siswa kembar dan menghitung total izinnya
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
  const [processingId, setProcessingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [jenisIzinTerpilih, setJenisIzinTerpilih] = useState('');
  const [tanggalTerpilih, setTanggalTerpilih] = useState('');
  const [filterJenisIzinTanggal, setFilterJenisIzinTanggal] = useState(null);
  const [hariTerpilih, setHariTerpilih] = useState('');
  const [bulanTerpilih, setBulanTerpilih] = useState(null);
  const [bulanGrafik, setBulanGrafik] = useState('');
  const [grafikHover, setGrafikHover] = useState(null);
  const [notifikasiGuru, setNotifikasiGuru] = useState([]);
  const [tanggalSekarang, setTanggalSekarang] = useState(() => new Date());
  
  // State untuk tombol menu sidebar khusus tampilan mobile (HP)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // State untuk modal pop-up interaktif pengajuan baru
  const [popupPengajuanBaru, setPopupPengajuanBaru] = useState(null);

  const pengajuanDiketahuiGuruRef = useRef(new Set());

  useEffect(() => {
    const interval = setInterval(() => setTanggalSekarang(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  
 // Notifikasi guru otomatis hilang setelah 5 detik.
useEffect(() => {
  if (notifikasiGuru.length === 0) return;
  const timers = notifikasiGuru.map((notifikasi) => 
    setTimeout(() => {
      setNotifikasiGuru((prev) => prev.filter((item) => item.id !== notifikasi.id));
    }, 5000)
  );
  return () => timers.forEach(clearTimeout);
}, [notifikasiGuru]);

  const muatDataIzin = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_URL}/pengajuan?_reload=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Data pengajuan gagal dimuat.');
      }
      const dataTerbaru = Array.isArray(result.data) ? result.data : [];
      setDaftarIzin(dataTerbaru);

      // Tandai semua pengajuan yang sudah disetujui/ditolak/bukan berstatus menunggu agar tidak muncul notifikasi lagi
      dataTerbaru.forEach((item) => {
        const statusItem = String(item.status || '').toLowerCase();
        if (item.id_pengajuan && statusItem && statusItem !== 'menunggu konfirmasi' && statusItem !== 'menunggu') {
          pengajuanDiketahuiGuruRef.current.add(String(item.id_pengajuan));
        }
      });
    } catch (error) {
      console.error('Gagal memuat data pengajuan:', error);
      setErrorMessage('Data pengajuan belum dapat dimuat dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muatDataIzin();
  }, []);

  // ================= NOTIFIKASI GURU PIKET & MODAL POP-UP MENGAMBANG =================
  useEffect(() => {
    let aktif = true;

    const inisialisasiDanCekNotifikasi = async () => {
      try {
        const response = await fetch(
          `${API_URL}/notifikasi?role=guru&_notif=${Date.now()}`,
          {
            method: 'GET',
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );

        const result = await response.json();

        if (!aktif || !response.ok || !result.success) return;
        const dataNotifikasi = Array.isArray(result.data) ? result.data : [];
        const diketahui = pengajuanDiketahuiGuruRef.current;

        // Filter hanya notifikasi yang status pengajuannya masih "Menunggu Konfirmasi" / belum pernah diketahui
        let notifikasiBaru = dataNotifikasi.filter((item) => {
          if (item?.id_pengajuan == null) return false;
          const idStr = String(item.id_pengajuan);
          if (diketahui.has(idStr)) return false;

          const statusItem = String(item.status || '').toLowerCase();
          if (statusItem && statusItem !== 'menunggu konfirmasi' && statusItem !== 'menunggu') {
            diketahui.add(idStr);
            return false;
          }
          return true;
        });

        if (notifikasiBaru.length > 0) {
          const itemTerbaru = notifikasiBaru[notifikasiBaru.length - 1];
          setPopupPengajuanBaru(itemTerbaru);

          notifikasiBaru.forEach((item) => {
            diketahui.add(String(item.id_pengajuan));
          });

          setNotifikasiGuru((prev) => [
            ...notifikasiBaru.map((item) => ({
              id: `guru-${item.id_pengajuan}-${Date.now()}-${Math.random()}`,
              text:
                item.message ||
                `Siswa ${item.nama_lengkap || item.nama || 'siswa'} telah mengajukan izin keluar.`
            })),
            ...prev
          ].slice(0, 5));

          muatDataIzin();
        }
      } catch (error) {
        if (aktif) {
          console.error('Gagal mengecek notifikasi Guru Piket:', error);
        }
      }
    };

    inisialisasiDanCekNotifikasi();
    const interval = setInterval(inisialisasiDanCekNotifikasi, 3000);

    return () => {
      aktif = false;
      clearInterval(interval);
    };
  }, []);

  const verifikasiPengajuan = async (item, status) => {
    setProcessingId(item.id_pengajuan);
    setErrorMessage('');
    setActionMessage('');
    try {
      const response = await fetch(`${API_URL}/pengajuan/${item.id_pengajuan}/verifikasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          role: 'guru',
          id_guru: user?.id_guru || user?.id_pengguna || user?.id || null,
          catatan_verifikasi: status === 'Disetujui'
            ? 'Disetujui oleh Guru Piket'
            : 'Ditolak oleh Guru Piket'
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Verifikasi gagal disimpan.');
      }
      
      // Masukkan ke daftar diketahui agar notifikasinya tidak muncul lagi
      pengajuanDiketahuiGuruRef.current.add(String(item.id_pengajuan));
      
      setDaftarIzin((dataLama) => dataLama.map((data) => (
        data.id_pengajuan === item.id_pengajuan
          ? { ...data, status, catatan_verifikasi: result.data?.catatan_verifikasi || '-' }
          : data
      )));
      setActionMessage(`Pengajuan ${item.nama_lengkap || 'siswa'} berhasil ${status.toLowerCase()}.`);
    } catch (error) {
      console.error('Gagal menyimpan verifikasi:', error);
      setErrorMessage(error.message || 'Verifikasi gagal disimpan.');
    } finally {
      setProcessingId(null);
    }
  };

  const dataTerfilter = jenisIzinTerpilih
    ? daftarIzin.filter((item) => (item.jenis_izin || 'Tidak diketahui') === jenisIzinTerpilih)
    : daftarIzin;

  const formatTanggal = (tanggal) => String(tanggal || '-').split('T')[0];
  const normalisasiTanggal = (tanggal) => String(tanggal || '').split('T')[0];
  const tahunData = tanggalSekarang.getFullYear();
  const bulanData = tanggalSekarang.getMonth() + 1;
  const daftarTanggalGrafik = Array.from({ length: 7 }, (_, index) => {
    const tanggal = new Date(tahunData, bulanData - 1, index + 1);
    const tahun = tanggal.getFullYear();
    const bulan = String(tanggal.getMonth() + 1).padStart(2, '0');
    const hari = String(tanggal.getDate()).padStart(2, '0');
    return { full: `${tahun}-${bulan}-${hari}`, label: `${hari}/${bulan}/${tahun}` };
  });
  const hitungIzinPerTanggal = (tanggal) => daftarIzin.filter((item) => normalisasiTanggal(item.tanggal) === tanggal).length;
  const maxTanggal = Math.max(...daftarTanggalGrafik.map((item) => hitungIzinPerTanggal(item.full)), 1);
  
  const dataMentahDetailTanggal = tanggalTerpilih
    ? daftarIzin.filter((item) => normalisasiTanggal(item.tanggal) === tanggalTerpilih)
    : [];

  const dataDetailTanggal = dataMentahDetailTanggal.filter((item) => {
    const jenis = String(item.jenis_izin || '').toLowerCase();
    const isSakit = jenis.includes('sakit');
    if (filterJenisIzinTanggal === 'sakit') return isSakit;
    if (filterJenisIzinTanggal === 'izin') return !isSakit;
    return true;
  });

  const rekapJenisKelamin = Object.entries(daftarIzin.reduce((rekap, item) => {
    const jenis = item.jenis_kelamin || item.gender || 'Tidak ada';
    rekap[jenis] = (rekap[jenis] || 0) + 1;
    return rekap;
  }, {}));
  const warnaGender = (label) => {
    const nilai = String(label).toLowerCase();
    if (nilai.includes('perempuan') || nilai.includes('wanita')) return '#ec4899';
    if (nilai.includes('laki') || nilai.includes('pria')) return '#3b82f6';
    return '#94a3b8';
  };
  let sudutGender = 0;
  const gradientGender = rekapJenisKelamin.map(([label, jumlah]) => {
    const awal = sudutGender;
    sudutGender += (jumlah / Math.max(daftarIzin.length, 1)) * 360;
    return `${warnaGender(label)} ${awal}deg ${sudutGender}deg`;
  }).join(', ');
  const rekapKelas = Object.entries(daftarIzin.reduce((rekap, item) => {
    const kelas = item.kelas || 'Tidak diketahui';
    rekap[kelas] = (rekap[kelas] || 0) + 1;
    return rekap;
  }, {})).sort((a, b) => b[1] - a[1]);

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const bulanLaporan = `${tanggalSekarang.getFullYear()}-${String(tanggalSekarang.getMonth() + 1).padStart(2, '0')}-01`;
  const [tahunLaporan, bulanLaporanNomor] = (bulanGrafik || bulanLaporan).split('-').map(Number);
  
  const jumlahHariDalamBulan = new Date(tahunLaporan, bulanLaporanNomor, 0).getDate();
  const namaBulanTeks = namaBulan[bulanLaporanNomor - 1] || '';
  const formatRentangTanggalMingguan = `01 s.d. ${jumlahHariDalamBulan} ${namaBulanTeks} ${tahunLaporan}`;

  const daftarHari = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const rekapMingguan = daftarHari.map((namaHari, indexHari) => {
    const dataHari = daftarIzin.filter((item) => {
      const tanggal = normalisasiTanggal(item.tanggal);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return false;
      const [tahun, bulan, hari] = tanggal.split('-').map(Number);
      const hariDalamMinggu = (new Date(tahun, bulan - 1, hari).getDay() + 6) % 7;
      return tahun === tahunLaporan && bulan === bulanLaporanNomor && hariDalamMinggu === indexHari;
    });

    let sakit = 0;
    let izinLain = 0;
    dataHari.forEach((item) => {
      const jenis = String(item.jenis_izin || '').toLowerCase();
      if (jenis.includes('sakit')) {
        sakit += 1;
      } else {
        izinLain += 1;
      }
    });

    return {
      label: namaHari,
      data: dataHari,
      sakit,
      izinLain,
      total: dataHari.length
    };
  });
  
  const maxMingguan = Math.max(...rekapMingguan.map((item) => item.total), 1);
  const dataHariTerpilih = rekapMingguan.find((item) => item.label === hariTerpilih)?.data || [];
  const rekapBulanan = namaBulan.map((nama, indexBulan) => ({
    nama,
    index: indexBulan,
    data: daftarIzin.filter((item) => {
      const tanggal = normalisasiTanggal(item.tanggal);
      return tanggal.startsWith(`${tahunLaporan}-${String(indexBulan + 1).padStart(2, '0')}`);
    })
  }));
  const maxBulanan = Math.max(...rekapBulanan.map((item) => item.data.length), 1);
  const dataBulanTerpilih = bulanTerpilih === null ? [] : rekapBulanan[bulanTerpilih].data;
  const koordinatBulanan = rekapBulanan.map((item, index) => ({ x: 20 + index * 60, y: 170 - (item.data.length / maxBulanan) * 130 }));
  const jalurBulanan = koordinatBulanan.reduce((jalur, titik, index) => {
    if (index === 0) return `M ${titik.x} ${titik.y}`;
    const sebelumnya = koordinatBulanan[index - 1];
    const controleX = sebelumnya.x + (titik.x - sebelumnya.x) / 2;
    return `${jalur} C ${controleX} ${sebelumnya.y}, ${controleX} ${titik.y}, ${titik.x} ${titik.y}`;
  }, '');

  return (
    <div className="dashboard-guru-container" style={styles.dashboardContainer}>
      {/* Tombol Hamburger Khusus Tampilan Mobile (HP) */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{
          display: 'none',
          position: 'fixed',
          top: '12px',
          left: '12px',
          zIndex: 110,
          padding: '0.5rem 0.75rem',
          backgroundColor: '#111827',
          color: '#fff',
          border: 'none',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          cursor: 'pointer'
        }}
      >
        {mobileMenuOpen ? 'Tutup Menu' : 'Menu ☰'}
      </button>

      {/* Overlay untuk menggelapkan latar belakang saat sidebar HP terbuka */}
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
              />
            </div>
            <div>
              <h3 style={styles.sidebarTitle}>Guru Piket</h3>
              <p style={styles.sidebarSubtitle}>SMK NEGERI COMPRENG</p>
            </div>
          </div>

          <div style={styles.menuList}>
            <button onClick={() => { setActiveMenu('verifikasi'); setMobileMenuOpen(false); }} style={{ ...styles.menuItem, ...(activeMenu === 'verifikasi' ? styles.menuItemActive : styles.menuItemNormal) }}>
              Verifikasi Izin
            </button>
            <button onClick={() => { setActiveMenu('grafik'); setMobileMenuOpen(false); }} style={{ ...styles.menuItem, ...(activeMenu === 'grafik' ? styles.menuItemActive : styles.menuItemNormal) }}>
              Grafik Statistik
            </button>
          </div>
        </div>

        <div style={styles.sidebarFooter}>
          <button style={styles.downloadButton}>Download Excel</button>
          <button onClick={onLogout} style={styles.logoutButton}>Keluar</button>
        </div>
      </div>

      <div className="main-content-guru" style={styles.mainContent}>
        <div style={styles.contentCard}>
          <div style={styles.contentHeaderRow}>
            <div>
              <h1 style={styles.pageTitle}>Verifikasi Pengajuan Izin</h1>
              <p style={styles.pageSubtitle}>Kelola dan setujui pengajuan izin keluar masuk siswa.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={muatDataIzin} disabled={loading} style={styles.reloadButton}>
                {loading ? 'Memuat...' : 'Muat Ulang'}
              </button>
            </div>
          </div>

          {/* ================= MODAL POP-UP MENGAMBANG DI TENGAH LAYAR ================= */}
          {popupPengajuanBaru && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10000,
              padding: '1rem',
              boxSizing: 'border-box'
            }}>
              <div style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '420px',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                animation: 'modalMasuk 0.25s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  <div style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    backgroundColor: '#dbeafe',
                    color: '#2563eb',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 'bold'
                  }}>
                    🔔
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827' }}>Pengajuan Izin Baru!</h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>Ada siswa yang mengajukan izin keluar.</p>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '0.875rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#334151', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 6px 0' }}><strong>Nama:</strong> {popupPengajuanBaru.nama_lengkap || popupPengajuanBaru.nama || '-'}</p>
                  <p style={{ margin: '0 0 6px 0' }}><strong>Kelas:</strong> {popupPengajuanBaru.kelas || '-'}</p>
                  <p style={{ margin: '0 0 0 0' }}><strong>Jenis Izin:</strong> {popupPengajuanBaru.jenis_izin || 'Izin Keluar'}</p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setPopupPengajuanBaru(null)}
                    style={{
                      flex: 1,
                      padding: '0.65rem',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenu('verifikasi');
                      setPopupPengajuanBaru(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.65rem',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Lihat & Verifikasi
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= BANNER NOTIFIKASI MELAYANG (DI ATAS) ================= */}
          {notifikasiGuru.length > 0 && (
            <div
              style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                width: 'min(390px, calc(100vw - 40px))',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                pointerEvents: 'none'
              }}
            >
              {notifikasiGuru.map((notifikasi) => (
                <div
                  key={notifikasi.id}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    border: '1px solid #bfdbfe',
                    borderLeft: '5px solid #2563eb',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    boxShadow: '0 8px 25px rgba(15, 23, 42, 0.18)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '13px',
                    animation: 'guruNotifMasuk 0.3s ease-out',
                    pointerEvents: 'auto'
                  }}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>🔔</span>
                  <div style={{ flex: 1, lineHeight: '1.5' }}>
                    <div style={{ fontWeight: '700', marginBottom: '3px' }}>Izin Keluar Masuk Siswa</div>
                    <div>{notifikasi.text}</div>
                  </div>
                  <button
                    onClick={() => setNotifikasiGuru((prev) => prev.filter((item) => item.id !== notifikasi.id))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '20px', lineHeight: 1, color: '#64748b', padding: '0 2px' }}
                    title="Tutup"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <style>{`
            @keyframes guruNotifMasuk {
              from { opacity: 0; transform: translate(-50%, -20px); }
              to { opacity: 1; transform: translate(-50%, 0); }
            }
            @keyframes modalMasuk {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            
            /* CSS Responsif Khusus HP / Layar Kecil agar tidak acak-acakan */
            @media screen and (max-width: 768px) {
              .sidebar-guru {
                left: -260px !important;
                transition: left 0.3s ease-in-out;
              }
              .sidebar-guru.sidebar-open {
                left: 0 !important;
              }
              .main-content-guru {
                margin-left: 0 !important;
                padding: 12px !important;
                padding-top: 55px !important;
              }
              .mobile-menu-toggle {
                display: block !important;
              }
              .two-column-grid-responsive {
                grid-template-columns: 1fr !important;
              }
              .content-card-responsive {
                padding: 1rem !important;
              }
            }
          `}</style>

          {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}
          {actionMessage && <div style={styles.successMessage}>{actionMessage}</div>}

          {activeMenu === 'grafik' && (
            <div style={styles.statisticsStack}>
              <div style={styles.chartPanel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h2 style={styles.sectionTitle}>Rekapitulasi Jumlah Izin Berdasarkan Tanggal</h2>
                    <p style={styles.sectionSubtitle}>Klik tanggal atau warna pada grafik untuk melihat tabel detail pengajuan.</p>
                  </div>
                </div>

                <div style={styles.dateChart}>
                  {daftarTanggalGrafik.slice().reverse().map((tanggal) => { 
                    const dataTanggal = daftarIzin.filter((item) => normalisasiTanggal(item.tanggal) === tanggal.full);
                    const total = dataTanggal.length; 
                    const tinggi = total ? Math.max((total / maxTanggal) * 100, 12) : 0; 
                    
                    const jumlahSakit = dataTanggal.filter(item => String(item.jenis_izin || '').toLowerCase().includes('sakit')).length;
                    const jumlahIzin = total - jumlahSakit;

                    const tinggiSakit = total ? (jumlahSakit / total) * 100 : 0;
                    const tinggiIzin = total ? (jumlahIzin / total) * 100 : 0;

                    return (
                      <div key={tanggal.full} style={styles.dateBarColumn}>
                        <div 
                          style={{ 
                            ...styles.dateBar, 
                            height: `${tinggi}%`, 
                            minHeight: total ? '4px' : '0', 
                            display: 'flex', 
                            flexDirection: 'column',
                            backgroundColor: 'transparent',
                            borderRadius: '6px 6px 0 0',
                            overflow: 'hidden',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={() => setGrafikHover({ key: `tanggal-${tanggal.full}`, text: `${tanggal.label}: ${total} izin` })} 
                          onMouseLeave={() => setGrafikHover(null)}
                        >
                          {jumlahIzin > 0 && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setTanggalTerpilih(tanggal.full);
                                setFilterJenisIzinTanggal('izin');
                              }}
                              title={`Klik untuk lihat data Izin`}
                              style={{ width: '100%', height: `${tinggiIzin}%`, backgroundColor: '#2563eb', cursor: 'pointer' }} 
                            />
                          )}
                          {jumlahSakit > 0 && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setTanggalTerpilih(tanggal.full);
                                setFilterJenisIzinTanggal('sakit');
                              }}
                              title={`Klik untuk lihat data Sakit`}
                              style={{ width: '100%', height: `${tinggiSakit}%`, backgroundColor: '#16a34a', cursor: 'pointer' }} 
                            />
                          )}
                        </div>
                        <span 
                          onClick={() => {
                            setTanggalTerpilih(tanggal.full);
                            setFilterJenisIzinTanggal(null);
                          }} 
                          style={{ ...styles.dateLabel, cursor: 'pointer' }}
                        >
                          {tanggal.label}
                        </span>
                        {grafikHover?.key === `tanggal-${tanggal.full}` && <span style={styles.chartTooltip}>{grafikHover.text}</span>}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '15px' }}>
                  <div style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#2563eb', borderRadius: '2px' }} /> Izin
                  </div>
                  <div style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#16a34a', borderRadius: '2px' }} /> Sakit
                  </div>
                </div>

                {tanggalTerpilih && (
                  <div style={styles.detailBlock}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <h3 style={styles.detailTitle}>
                        Detail Izin Tanggal {tanggalTerpilih}
                      </h3>
                      {filterJenisIzinTanggal && (
                        <button 
                          onClick={() => setFilterJenisIzinTanggal(null)} 
                          style={{ fontSize: '11px', padding: '3px 8px', cursor: 'pointer', background: '#e2e8f0', border: 'none', borderRadius: '4px' }}
                        >
                          Reset Filter Warna
                        </button>
                      )}
                    </div>
                    {dataDetailTanggal.length === 0 ? (
                      <p style={styles.mutedText}>Tidak ada izin pada tanggal ini untuk kategori tersebut.</p>
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
                              <th>Total Izin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSiswaUnik(dataDetailTanggal).map((item, index) => (
                              <tr key={`${item.id_pengajuan || index}-${item.nama_lengkap}`}>
                                <td>{item.nama_lengkap || '-'}</td>
                                <td>{item.kelas || '-'}</td>
                                <td>{item.jenis_kelamin || '-'}</td>
                                <td>{item.jenis_izin || '-'}</td>
                                <td>{item.status || '-'}</td>
                                <td>{item.total_izin_hitung}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="two-column-grid-responsive" style={styles.twoColumnGrid}>
                <div style={styles.chartPanel}>
                  <h2 style={styles.sectionTitle}>Grafik Jenis Kelamin</h2>
                  {rekapJenisKelamin.length === 0 ? <p style={styles.mutedText}>Belum ada data.</p> : (
                    <div style={styles.genderLayout}>
                      <div title="Grafik jenis kelamin" onMouseEnter={() => setGrafikHover({ key: 'gender', text: 'Perbandingan jenis kelamin siswa' })} onMouseLeave={() => setGrafikHover(null)} onTouchStart={() => setGrafikHover({ key: 'gender', text: 'Perbandingan jenis kelamin siswa' })} style={{ ...styles.genderDonut, background: `conic-gradient(${gradientGender})` }}><div style={styles.genderDonutCenter} /></div>
                      <div style={styles.legendList}>{rekapJenisKelamin.map(([label, jumlah]) => <div key={label} style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: warnaGender(label) }} />{label}: {jumlah}</div>)}</div>
                      {grafikHover?.key === 'gender' && <span style={styles.chartTooltip}>{grafikHover.text}</span>}
                    </div>
                  )}
                </div>
                <div style={styles.chartPanel}>
                  <h2 style={styles.sectionTitle}>Grafik Berdasarkan Kelas</h2>
                  {rekapKelas.length === 0 ? <p style={styles.mutedText}>Belum ada data.</p> : rekapKelas.map(([kelas, total]) => <div key={kelas} title={`${kelas}: ${total} izin`} onMouseEnter={() => setGrafikHover({ key: `kelas-${kelas}`, text: `${kelas}: ${total} izin` })} onMouseLeave={() => setGrafikHover(null)} onTouchStart={() => setGrafikHover({ key: `kelas-${kelas}`, text: `${kelas}: ${total} izin` })} style={styles.classRow}><div style={styles.classLabel}><span>{kelas}</span><strong>{total}</strong></div><div style={{ ...styles.classTrack, position: 'relative' }}><span style={{ ...styles.classBar, width: `${(total / rekapKelas[0][1]) * 100}%` }} /></div></div>)}
                  {grafikHover?.key?.startsWith('kelas-') && <span style={styles.chartTooltip}>{grafikHover.text}</span>}
                </div>
              </div>

              <div style={styles.chartPanel}>
                <div style={styles.chartHeadingRow}>
                  <div>
                    <h2 style={styles.sectionTitle}>Grafik Mingguan ({formatRentangTanggalMingguan})</h2>
                    <p style={styles.sectionSubtitle}>Klik hari untuk melihat tabel pengajuan.</p>
                  </div>
                </div>

                <div style={styles.weekChart}>
                  {rekapMingguan.map((minggu) => { 
                    const total = minggu.total; 
                    const tinggiSakit = total ? (minggu.sakit / maxMingguan) * 100 : 0;
                    const tinggiIzinLain = total ? (minggu.izinLain / maxMingguan) * 100 : 0;

                    return (
                      <button 
                        key={minggu.label} 
                        onClick={() => setHariTerpilih(minggu.label)} 
                        onMouseEnter={() => setGrafikHover({ key: `minggu-${minggu.label}`, text: `${minggu.label}: ${total} izin (Sakit: ${minggu.sakit}, Izin: ${minggu.izinLain})` })} 
                        onMouseLeave={() => setGrafikHover(null)} 
                        onTouchStart={() => setGrafikHover({ key: `minggu-${minggu.label}`, text: `${minggu.label}: ${total} izin (Sakit: ${minggu.sakit}, Izin: ${minggu.izinLain})` })} 
                        style={styles.weekBarColumn}
                      >
                        <span style={{ 
                          ...styles.weekBar, 
                          width: 'min(40px, 75%)', 
                          display: 'flex',
                          flexDirection: 'column', 
                          height: `${Math.max(tinggiSakit + tinggiIzinLain, total ? 12 : 0)}%`,
                          minHeight: total ? '4px' : '0',
                          backgroundColor: 'transparent',
                          borderRadius: '4px 4px 0 0',
                          overflow: 'hidden'
                        }}>
                          <span style={{ 
                            width: '100%', 
                            height: `${total ? (minggu.izinLain / total) * 100 : 0}%`, 
                            backgroundColor: '#2563eb' 
                          }} />
                          <span style={{ 
                            width: '100%', 
                            height: `${total ? (minggu.sakit / total) * 100 : 0}%`, 
                            backgroundColor: '#16a34a' 
                          }} />
                        </span>
                        <span style={styles.weekLabel}>{minggu.label}</span>
                      </button>
                    );
                  })}
                  {grafikHover?.key?.startsWith('minggu-') && <span style={styles.chartTooltip}>{grafikHover.text}</span>}
                </div>

                {hariTerpilih && (
                  <div style={styles.detailBlock}>
                    <h3 style={styles.detailTitle}>Detail {hariTerpilih}</h3>
                    <div style={styles.tableWrapper}>
                      <table cellPadding="10" style={styles.detailTable}>
                        <thead>
                          <tr>
                            <th>Nama</th>
                            <th>Kelas</th>
                            <th>Jenis Kelamin</th>
                            <th>Tanggal</th>
                            <th>Total Izin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getSiswaUnik(dataHariTerpilih).map((item, index) => (
                            <tr key={`${hariTerpilih}-${item.id_pengajuan || index}`}>
                              <td>{item.nama_lengkap || '-'}</td>
                              <td>{item.kelas || '-'}</td>
                              <td>{item.jenis_kelamin || '-'}</td>
                              <td>{formatTanggal(item.tanggal)}</td>
                              <td>{item.total_izin_hitung}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.chartPanel}>
                <h2 style={styles.sectionTitle}>Grafik Bulanan</h2>
                <p style={styles.sectionSubtitle}>Klik titik bulan untuk melihat tabel detail pengajuan.</p>
                <div style={styles.lineChartWrapper}>
                  <svg viewBox="0 0 740 220" width="100%" height="220" role="img" aria-label="Grafik jumlah izin bulanan" style={styles.lineChart}>
                    <line x1="20" y1="40" x2="20" y2="170" stroke="#cbd5e1" />
                    <line x1="20" y1="170" x2="710" y2="170" stroke="#cbd5e1" />
                    <line x1="20" y1="105" x2="710" y2="105" stroke="#e2e8f0" strokeDasharray="4 4" />
                    <path d={jalurBulanan} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {rekapBulanan.map((bulan) => { 
                      const titik = koordinatBulanan[bulan.index]; 
                      return (
                        <g key={bulan.nama} title={`${bulan.nama}: ${bulan.data.length} izin`} onClick={() => setBulanTerpilih(bulan.index)} onMouseEnter={() => setGrafikHover({ key: `bulan-${bulan.index}`, text: `${bulan.nama}: ${bulan.data.length} izin` })} onMouseLeave={() => setGrafikHover(null)} onTouchStart={() => setGrafikHover({ key: `bulan-${bulan.index}`, text: `${bulan.nama}: ${bulan.data.length} izin` })} style={{ cursor: 'pointer' }}>
                          <circle cx={titik.x} cy={titik.y} r={bulanTerpilih === bulan.index ? 8 : 6} fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                          <text x={titik.x} y="195" textAnchor="middle" fontSize="10" fill="#64748b">{bulan.nama.slice(0, 3)}</text>
                        </g>
                      ); 
                    })}
                  </svg>
                  {grafikHover?.key?.startsWith('bulan-') && <span style={styles.chartTooltip}>{grafikHover.text}</span>}
                </div>
                {bulanTerpilih !== null && (
                  <div style={styles.detailBlock}>
                    <h3 style={styles.detailTitle}>Detail Bulan {namaBulan[bulanTerpilih]}</h3>
                    {dataBulanTerpilih.length === 0 ? (
                      <p style={styles.mutedText}>Belum ada data pada bulan ini.</p>
                    ) : (
                      <div style={styles.tableWrapper}>
                        <table cellPadding="10" style={styles.detailTable}>
                          <thead>
                            <tr>
                              <th>Nama</th>
                              <th>Kelas</th>
                              <th>Jenis Kelamin</th>
                              <th>Tanggal</th>
                              <th>Total Izin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSiswaUnik(dataBulanTerpilih).map((item, index) => (
                              <tr key={`bulan-${item.id_pengajuan || index}`}>
                                <td>{item.nama_lengkap || '-'}</td>
                                <td>{item.kelas || '-'}</td>
                                <td>{item.jenis_kelamin || '-'}</td>
                                <td>{formatTanggal(item.tanggal)}</td>
                                <td>{item.total_izin_hitung}</td>
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
              {jenisIzinTerpilih && <button onClick={() => setJenisIzinTerpilih('')} style={styles.clearFilterButton}>Tampilkan Semua Pengajuan</button>}
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>NAMA SISWA</th>
                    <th style={styles.th}>KELAS / JURUSAN</th>
                    <th style={styles.th}>JENIS IZIN</th>
                    <th style={styles.th}>CATATAN VERIFIKASI</th>
                    <th style={styles.th}>TANGGAL</th>
                    <th style={styles.th}>AKSI / STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="7" style={styles.emptyData}>Memuat data pengajuan...</td></tr>
                  ) : dataTerfilter.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={styles.emptyData}>
                        {jenisIzinTerpilih ? 'Tidak ada pengajuan untuk jenis izin ini.' : 'Belum ada data pengajuan izin saat ini.'}
                      </td>
                    </tr>
                  ) : (
                    dataTerfilter.map((item, index) => (
                      <tr key={item.id_pengajuan || index} style={styles.tableBodyRow}>
                        <td style={styles.td}>{item.id_pengajuan || '-'}</td>
                        <td style={styles.td}>{item.nama_lengkap || '-'}</td>
                        <td style={styles.td}>{item.kelas}</td>
                        <td style={styles.td}>{item.jenis_izin}</td>
                        <td style={styles.td}>{item.catatan_verifikasi || item.keterangan || item.alasan || '-'}</td>
                        <td style={styles.td}>{formatTanggal(item.tanggal)}</td>
                        <td style={{ ...styles.td, ...styles.statusCell }}>
                          {item.status && item.status !== 'Menunggu Konfirmasi' && <span>{item.status}</span>}
                          {(!item.status || item.status === 'Menunggu Konfirmasi') && (
                            <div style={styles.actionGroup}>
                              <button
                                onClick={() => verifikasiPengajuan(item, 'Disetujui')}
                                disabled={processingId === item.id_pengajuan}
                                style={styles.approveButton}
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => verifikasiPengajuan(item, 'Ditolak')}
                                disabled={processingId === item.id_pengajuan}
                                style={styles.rejectButton}
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
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

// ================= STYLING CSS TERGABUNG (INLINE STYLES) =================
const styles = {
  dashboardContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'hidden'
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#ffffff', // Diubah menjadi putih
    color: '#111827', // Teks diubah menjadi gelap agar kontras di latar putih
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
    borderRight: '1px solid #e5e7eb', // Tambahan garis pembatas tipis agar rapi
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid #e5e7eb', // Disesuaikan dengan tema putih
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
    color: '#111827', // Diubah jadi gelap
  },
  sidebarSubtitle: {
    margin: '2px 0 0 0',
    fontSize: '0.65rem',
    color: '#6b7280', // Diubah jadi abu-abu agar pas
    letterSpacing: '0.5px',
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
    color: '#4b5563', // Diubah jadi abu gelap agar terlihat di latar putih
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
    marginBottom: '1.5rem',
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
    backgroundImage: 'linear-gradient(to bottom, transparent 49.5%, #e2e8f0 50%, transparent 50.5%)',
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
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  dateBar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 'min(40px, 75%)',
    minHeight: '4px',
    paddingTop: '0.25rem',
    borderRadius: '4px 4px 0 0',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: '700',
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
    lineHeight: '1.4',
    textAlign: 'left',
    minWidth: '500px',
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '1.5rem',
  },
  genderLayout: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    flexWrap: 'wrap',
  },
  genderDonut: {
    display: 'grid',
    flex: '0 0 135px',
    placeItems: 'center',
    width: '135px',
    height: '135px',
    borderRadius: '50%',
  },
  genderDonutCenter: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
  },
  legendList: {
    display: 'grid',
    gap: '0.55rem',
    color: '#475569',
    fontSize: '0.78rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  classRow: {
    marginBottom: '0.8rem',
  },
  classLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
    color: '#475569',
    fontSize: '0.78rem',
  },
  classTrack: {
    display: 'block',
    height: '12px',
    overflow: 'hidden',
    borderRadius: '999px',
    backgroundColor: '#e2e8f0',
  },
  classBar: {
    display: 'block',
    height: '100%',
    borderRadius: '999px',
    backgroundColor: '#6366f1',
  },
  chartHeadingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  weekChart: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: '1rem',
    height: '190px',
    padding: '0 1rem 0.5rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundImage: 'linear-gradient(to bottom, transparent 24.5%, #e2e8f0 25%, transparent 25.5%), linear-gradient(to bottom, transparent 49.5%, #e2e8f0 50%, transparent 50.5%), linear-gradient(to bottom, transparent 74.5%, #e2e8f0 75%, transparent 75.5%)',
    minWidth: '320px',
  },
  weekBarColumn: {
    position: 'relative',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  weekBar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 'min(40px, 75%)',
    minHeight: '4px',
    paddingTop: '0.25rem',
    borderRadius: '4px 4px 0 0',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: '700',
  },
  weekLabel: {
    marginTop: '0.5rem',
    color: '#64748b',
    fontSize: '0.72rem',
  },
  lineChartWrapper: {
    position: 'relative',
    overflowX: 'auto',
  },
  chartTooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '6px',
    zIndex: 20,
    minWidth: '120px',
    padding: '0.4rem 0.6rem',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '0.5rem',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.28)',
    fontSize: '0.7rem',
    fontWeight: '600',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  lineChart: {
    minWidth: '680px',
    overflow: 'visible',
  },
  sectionTitle: {
    margin: '0 0 0.25rem',
    fontSize: '1rem',
    color: '#111827',
  },
  sectionSubtitle: {
    margin: '0 0 1rem',
    fontSize: '0.8rem',
    color: '#6b7280',
  },
  clearFilterButton: {
    marginBottom: '0.75rem',
    padding: '0.45rem 0.75rem',
    border: '1px solid #bfdbfe',
    borderRadius: '0.4rem',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  statusCell: {
    fontWeight: '600',
    color: '#92400e',
  },
  actionGroup: {
    display: 'flex',
    gap: '0.4rem',
    marginTop: '0.5rem',
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
    letterSpacing: '0.05em',
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
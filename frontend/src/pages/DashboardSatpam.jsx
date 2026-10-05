import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5002/api`;

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

const getJenisIzinLabel = (item) => {
  const jenis = String(item?.jenis_izin || '').toLowerCase();
  return jenis.includes('sakit') ? 'Sakit' : 'Izin';
};

const groupDataBySiswa = (listData) => {
  const map = {};
  listData.forEach((item) => {
    const nama = item.nama_lengkap || 'Tanpa Nama';
    const kelas = item.kelas || '-';
    const tgl = getDateOnly(item.tanggal);
    const key = `${nama}_${kelas}_${tgl}`;

    if (!map[key]) {
      map[key] = {
        ...item,
        total_izin: 1,
        alasan_list: [item.alasan || item.jenis_izin || '-']
      };
    } else {
      map[key].total_izin += 1;
      const currentAlasan = item.alasan || item.jenis_izin || '-';
      if (!map[key].alasan_list.includes(currentAlasan)) {
        map[key].alasan_list.push(currentAlasan);
      }
    }
  });

  return Object.values(map).map((item) => ({
    ...item,
    alasan: item.alasan_list.join(', ')
  }));
};

const groupDataBySiswaBulanan = (listData) => {
  const map = {};
  listData.forEach((item) => {
    const nama = item.nama_lengkap || 'Tanpa Nama';
    const kelas = item.kelas || '-';
    const key = `${nama}_${kelas}`;

    if (!map[key]) {
      map[key] = {
        ...item,
        total_izin: 1,
        alasan_list: [item.alasan || item.jenis_izin || '-']
      };
    } else {
      map[key].total_izin += 1;
      const currentAlasan = item.alasan || item.jenis_izin || '-';
      if (!map[key].alasan_list.includes(currentAlasan)) {
        map[key].alasan_list.push(currentAlasan);
      }
    }
  });

  return Object.values(map).map((item) => ({
    ...item,
    alasan: item.alasan_list.join(', ')
  }));
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

export default function DashboardSatpam({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('verifikasi');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dataIzin, setDataIzin] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState(null);
  const [actionType, setActionType] = useState('');
  const [catatanInput, setCatatanInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState(null);
  const [selectedMonthlyIndex, setSelectedMonthlyIndex] = useState(null);
  const [notifikasiSatpam, setNotifikasiSatpam] = useState([]);
  const [tanggalSekarang, setTanggalSekarang] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTanggalSekarang(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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

  const fetchPengajuan = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/pengajuan?role=satpam`);
      const result = await response.json();

      if (response.ok && result.success) {
        setDataIzin(Array.isArray(result.data) ? result.data : []);
      } else {
        console.error('Gagal mengambil data:', result.message);
      }
    } catch (error) {
      console.error('Kesalahan koneksi ke server backend:', error);
    } finally {
      setLoading(false);
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
        const response = await fetch(
          `${API_URL}/notifikasi?role=satpam&_notif=${Date.now()}`,
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
                if (existingIds.has(item.id)) return false;
                
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

    // Cek berkala setiap 2 detik
    const interval = setInterval(cekNotifikasiSatpam, 2000);

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
      const response = await fetch(
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
      } else {
        alert('Gagal menyimpan ke database: ' + (result.message || 'Terjadi kesalahan'));
      }
    } catch (error) {
      console.error('Error koneksi:', error);
      alert('Tidak dapat terhubung ke server backend.');
    }
  };

  useEffect(() => {
    if (activeMenu !== 'statistik') return;

    const year = tanggalSekarang.getFullYear();
    const month = String(tanggalSekarang.getMonth() + 1).padStart(2, '0');
    const rawLabels = Array.from({ length: 7 }, (_, index) => {
      const day = String(7 - index).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });
    const rawIzinVal = [];
    const rawSakitVal = [];

    rawLabels.forEach((tglStr) => {
      let countIzin = 0;
      let countSakit = 0;

      dataIzin.forEach((item) => {
        const itemTgl = String(item.tanggal || '').split('T')[0];
        if (itemTgl === tglStr) {
          const jenis = String(item.jenis_izin || '').toLowerCase();
          if (jenis.includes('sakit')) countSakit++;
          else countIzin++;
        }
      });

      rawIzinVal.push(countIzin);
      rawSakitVal.push(countSakit);
    });

    const ctxTanggal = document.getElementById('barChartTanggal')?.getContext('2d');
    let chartTanggal = null;
    if (ctxTanggal) {
      chartTanggal = new Chart(ctxTanggal, {
        type: 'bar',
        data: {
          labels: rawLabels,
          datasets: [
            { label: 'Izin', data: rawIzinVal, backgroundColor: '#2563eb', borderRadius: 4, maxBarThickness: 35 },
            { label: 'Sakit', data: rawSakitVal, backgroundColor: '#10b981', borderRadius: 4, maxBarThickness: 35 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements && elements.length > 0) setSelectedDate(rawLabels[elements[0].index]);
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { borderDash: [4, 4] } },
            x: { grid: { display: false } }
          },
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 8, font: { size: 10 }, padding: 10 } } }
        }
      });
    }

    let countPerempuan = 0;
    let countLaki = 0;
    dataIzin.forEach((item) => {
      const jk = String(item.jenis_kelamin || '').toLowerCase();
      if (jk.includes('p') || jk.includes('perempuan')) countPerempuan++;
      else if (jk.includes('l') || jk.includes('laki')) countLaki++;
    });

    const ctxKelamin = document.getElementById('doughnutJenisKelamin')?.getContext('2d');
    let chartKelamin = null;
    if (ctxKelamin) {
      chartKelamin = new Chart(ctxKelamin, {
        type: 'doughnut',
        data: {
          labels: ['Perempuan', 'Laki-laki'],
          datasets: [{ data: [countPerempuan, countLaki], backgroundColor: ['#db2777', '#3b82f6'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 8, font: { size: 10 }, padding: 10 } } } }
      });
    }

    const kelasCounts = {};
    dataIzin.forEach((item) => {
      const kls = item.kelas || 'Lainnya';
      kelasCounts[kls] = (kelasCounts[kls] || 0) + 1;
    });

    const labelsKelas = Object.keys(kelasCounts);
    const dataKelasVal = labelsKelas.map((kls) => kelasCounts[kls]);

    const ctxKelas = document.getElementById('barChartKelas')?.getContext('2d');
    let chartKelas = null;
    if (ctxKelas) {
      chartKelas = new Chart(ctxKelas, {
        type: 'bar',
        data: {
          labels: labelsKelas.length > 0 ? labelsKelas : ['-'],
          datasets: [{ label: 'Jumlah', data: dataKelasVal.length > 0 ? dataKelasVal : [0], backgroundColor: '#8b5cf6', borderRadius: 4, maxBarThickness: 35 }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { borderDash: [4, 4] } },
            y: { grid: { display: false } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    const weeklyLabels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const weeklyIzin = [0, 0, 0, 0, 0, 0, 0];
    const weeklySakit = [0, 0, 0, 0, 0, 0, 0];

    dataIzin.forEach((item) => {
      const itemDateStr = getDateOnly(item.tanggal);
      if (!itemDateStr) return;
      const itemDate = new Date(itemDateStr + 'T00:00:00');
      let dayIndex = itemDate.getDay();
      dayIndex = dayIndex === 0 ? 6 : dayIndex - 1;

      if (getJenisIzinLabel(item) === 'Sakit') weeklySakit[dayIndex]++;
      else weeklyIzin[dayIndex]++;
    });

    const ctxMingguan = document.getElementById('barChartMingguan')?.getContext('2d');
    let chartMingguan = null;
    if (ctxMingguan) {
      chartMingguan = new Chart(ctxMingguan, {
        type: 'bar',
        data: {
          labels: weeklyLabels,
          datasets: [
            { label: 'Izin', data: weeklyIzin, backgroundColor: '#2563eb', borderRadius: 4, maxBarThickness: 35 },
            { label: 'Sakit', data: weeklySakit, backgroundColor: '#10b981', borderRadius: 4, maxBarThickness: 35 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements && elements.length > 0) {
              const index = elements[0].index;
              setSelectedWeeklyDay({ index: index, name: weeklyLabels[index] });
            }
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { borderDash: [4, 4] } },
            x: { grid: { display: false } }
          },
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 8, font: { size: 10 }, padding: 10 } } }
        }
      });
    }

    const monthlyLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthlyValues = [];

    for (let m = 0; m < 12; m++) {
      let count = 0;
      dataIzin.forEach((item) => {
        const itemDate = getDateOnly(item.tanggal);
        if (!itemDate) return;
        const itemObj = new Date(itemDate + 'T00:00:00');
        if (itemObj.getFullYear() === year && itemObj.getMonth() === m) count++;
      });
      monthlyValues.push(count);
    }

    const ctxBulanan = document.getElementById('barChartBulanan')?.getContext('2d');
    let chartBulanan = null;
    if (ctxBulanan) {
      chartBulanan = new Chart(ctxBulanan, {
        type: 'line',
        data: {
          labels: monthlyLabels,
          datasets: [{ label: 'Jumlah Izin', data: monthlyValues, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.12)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements && elements.length > 0) {
              const index = elements[0].index;
              setSelectedMonthlyIndex({ index: index, name: monthlyLabels[index] });
            }
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { borderDash: [4, 4] } },
            x: { grid: { display: false } }
          },
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 8, font: { size: 10 }, padding: 10 } } }
        }
      });
    }

    return () => {
      if (chartTanggal) chartTanggal.destroy();
      if (chartKelamin) chartKelamin.destroy();
      if (chartKelas) chartKelas.destroy();
      if (chartMingguan) chartMingguan.destroy();
      if (chartBulanan) chartBulanan.destroy();
    };
  }, [activeMenu, dataIzin, tanggalSekarang]);

  const filteredDateData = groupDataBySiswa(
    dataIzin.filter(item => String(item.tanggal || '').split('T')[0] === selectedDate)
  );

  const filteredWeeklyData = groupDataBySiswa(
    dataIzin.filter(item => {
      if (selectedWeeklyDay === null) return false;
      const itemDateStr = getDateOnly(item.tanggal);
      if (!itemDateStr) return false;
      const itemDate = new Date(itemDateStr + 'T00:00:00');
      let dayIndex = itemDate.getDay();
      dayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      return dayIndex === selectedWeeklyDay.index;
    })
  );

  const monthlyLabelsFull = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  const filteredMonthlyData = groupDataBySiswaBulanan(
    dataIzin.filter(item => {
      if (selectedMonthlyIndex === null) return false;
      const itemDateStr = getDateOnly(item.tanggal);
      if (!itemDateStr) return false;
      const itemDate = new Date(itemDateStr + 'T00:00:00');
      const todayYear = new Date().getFullYear();
      return itemDate.getFullYear() === todayYear && itemDate.getMonth() === selectedMonthlyIndex.index;
    })
  );

  const logoSekolahUrl = 'logo sekolah.jpeg';

  return (
    <div className="dashboard-satpam-root" style={styles.container}>
      <button
        className="mobile-dashboard-menu"
        type="button"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? 'Tutup' : 'Menu ☰'}
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
                  <button style={styles.btnReload} onClick={fetchPengajuan}>
                    Muat Ulang
                  </button>
                </div>
              </div>

              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={styles.table}>
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
                    {loading ? (
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

                        return (
                          <tr key={row.id_pengajuan} style={styles.trBody}>
                            <td style={styles.td}>{row.id_pengajuan}</td>
                            <td style={{ ...styles.td, fontWeight: '600', color: '#0f172a' }}>{row.nama_lengkap}</td>
                            <td style={styles.td}>{row.kelas}</td>
                            <td style={styles.td}>{row.jenis_izin}</td>
                            <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>
                              {getJamKembaliValue(row)}
                            </td>
                            <td style={{ ...styles.td, fontStyle: 'italic', color: '#64748b' }}>
                              {row.catatan_verifikasi || 'Belum diverifikasi oleh Satpam'}
                            </td>
                            <td style={styles.td}>{String(row.tanggal || '').split('T')[0]}</td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              {sudahDiverifikasiSatpam ? (
                                statusSatpam === 'Disetujui' ? (
                                  <span style={styles.badgeSuccess}>Disetujui</span>
                                ) : (
                                  <span style={styles.badgeDanger}>Ditolak</span>
                                )
                              ) : (
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button onClick={() => handleOpenModal(row, 'setuju')} style={styles.btnSetuju}>
                                    Setujui
                                  </button>
                                  <button onClick={() => handleOpenModal(row, 'tolak')} style={styles.btnTolak}>
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
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Grafik Statistik Aktivitas Izin</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Rekapitulasi jumlah izin berdasarkan tanggal, jenis kelamin, kelas, mingguan, dan bulanan.
                    </p>
                  </div>
                  <button style={styles.btnReload} onClick={fetchPengajuan}>
                    Muat Ulang
                  </button>
                </div>
              </div>

              {/* GRAFIK TANGGAL */}
              <div style={styles.card}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b' }}>
                  Rekapitulasi Jumlah Izin Berdasarkan Tanggal
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
                  Klik tanggal atau warna pada grafik untuk melihat tabel detail pengajuan.
                </p>
                <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                  <canvas id="barChartTanggal" />
                </div>
              </div>

              {selectedDate && (
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
                      Detail Izin Tanggal {selectedDate}
                    </h3>
                    <button onClick={() => setSelectedDate(null)} style={styles.btnTutupTabel}>
                      Tutup Tabel
                    </button>
                  </div>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.trHeadGrafik}>
                          <th style={styles.thGrafik}>Nama</th>
                          <th style={styles.thGrafik}>Kelas</th>
                          <th style={styles.thGrafik}>Jenis Kelamin</th>
                          <th style={styles.thGrafik}>Alasan</th>
                          <th style={styles.thGrafik}>Total Izin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDateData.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Tidak ada data.</td></tr>
                        ) : (
                          filteredDateData.map((row, idx) => (
                            <tr key={idx} style={styles.trBody}>
                              <td style={{ ...styles.td, fontWeight: '600', color: '#0f172a' }}>{row.nama_lengkap}</td>
                              <td style={styles.td}>{row.kelas}</td>
                              <td style={styles.td}>{row.jenis_kelamin || '-'}</td>
                              <td style={styles.td}>{row.alasan}</td>
                              <td style={styles.td}>{row.total_izin}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* GRAFIK KELAMIN & KELAS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={styles.card}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1e293b' }}>Grafik Jenis Kelamin</h3>
                  <div style={{ position: 'relative', height: '220px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <canvas id="doughnutJenisKelamin" />
                  </div>
                </div>
                <div style={styles.card}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1e293b' }}>Grafik Berdasarkan Kelas</h3>
                  <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                    <canvas id="barChartKelas" />
                  </div>
                </div>
              </div>

              {/* GRAFIK MINGGUAN */}
              <div style={styles.card}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b' }}>Grafik Mingguan</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
                  Jumlah pengajuan izin dan sakit dari hari Senin sampai Minggu. Klik batang grafik untuk melihat detail.
                </p>
                <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                  <canvas id="barChartMingguan" />
                </div>
              </div>

              {selectedWeeklyDay !== null && (
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
                      Detail Izin Hari {selectedWeeklyDay.name}
                    </h3>
                    <button onClick={() => setSelectedWeeklyDay(null)} style={styles.btnTutupTabel}>
                      Tutup Tabel
                    </button>
                  </div>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.trHeadGrafik}>
                          <th style={styles.thGrafik}>Nama</th>
                          <th style={styles.thGrafik}>Kelas</th>
                          <th style={styles.thGrafik}>Jenis Kelamin</th>
                          <th style={styles.thGrafik}>Alasan</th>
                          <th style={styles.thGrafik}>Total Izin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWeeklyData.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Tidak ada data.</td></tr>
                        ) : (
                          filteredWeeklyData.map((row, idx) => (
                            <tr key={idx} style={styles.trBody}>
                              <td style={{ ...styles.td, fontWeight: '600', color: '#0f172a' }}>{row.nama_lengkap}</td>
                              <td style={styles.td}>{row.kelas}</td>
                              <td style={styles.td}>{row.jenis_kelamin || '-'}</td>
                              <td style={styles.td}>{row.alasan}</td>
                              <td style={styles.td}>{row.total_izin}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* GRAFIK BULANAN */}
              <div style={styles.card}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b' }}>Grafik Bulanan</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
                  Jumlah pengajuan izin berdasarkan bulan pada tahun berjalan. Klik titik bulan untuk melihat detail tabel bulanan.
                </p>
                <div style={{ position: 'relative', height: '260px', width: '100%' }}>
                  <canvas id="barChartBulanan" />
                </div>
              </div>

              {selectedMonthlyIndex !== null && (
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
                      Detail Izin Bulan {monthlyLabelsFull[selectedMonthlyIndex.index]}
                    </h3>
                    <button onClick={() => setSelectedMonthlyIndex(null)} style={styles.btnTutupTabel}>
                      Tutup Tabel
                    </button>
                  </div>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.trHeadGrafik}>
                          <th style={styles.thGrafik}>Nama</th>
                          <th style={styles.thGrafik}>Kelas</th>
                          <th style={styles.thGrafik}>Jenis Kelamin</th>
                          <th style={styles.thGrafik}>Alasan / Jenis Izin</th>
                          <th style={styles.thGrafik}>Total Izin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMonthlyData.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Tidak ada data.</td></tr>
                        ) : (
                          filteredMonthlyData.map((row, idx) => (
                            <tr key={idx} style={styles.trBody}>
                              <td style={{ ...styles.td, fontWeight: '600', color: '#0f172a' }}>{row.nama_lengkap}</td>
                              <td style={styles.td}>{row.kelas}</td>
                              <td style={styles.td}>{row.jenis_kelamin || '-'}</td>
                              <td style={styles.td}>{row.alasan}</td>
                              <td style={styles.td}>{row.total_izin}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
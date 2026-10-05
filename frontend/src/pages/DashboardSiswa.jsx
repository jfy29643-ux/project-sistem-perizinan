import React, { useEffect, useState, useRef } from 'react';
import { PENGAJUAN_API_URL as API_URL } from '../apiConfig';

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
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [tanggalTerpilih, setTanggalTerpilih] = useState('');
  const [hariTerpilih, setHariTerpilih] = useState('');
  const [bulanTerpilih, setBulanTerpilih] = useState(null);
  const [bulanGrafik, setBulanGrafik] = useState('');
  const [grafikHover, setGrafikHover] = useState(null);
  const [jenisIzinTerpilih, setJenisIzinTerpilih] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [idYangDiedit, setIdYangDiedit] = useState(null);
  const [daftarIzin, setDaftarIzin] = useState([]);
  const [notifikasiSiswa, setNotifikasiSiswa] = useState([]);
  const [waktuSekarang, setWaktuSekarang] = useState(new Date());
  const chartRef = useRef(null);

  // Fungsi untuk menangani klik pada batang grafik
  const handleChartClick = (event) => {
    const chart = chartRef.current;
    if (!chart) return;

    const elements = getElementsAtEventForMode(
      chart,
      event,
      { intersect: true },
      true
    );

    if (elements.length > 0) {
      const element = elements[0];
      const datasetIndex = element.datasetIndex;
      const dataIndex = element.index;

      const clickedDate = chart.data.labels[dataIndex];
      const clickedJenis = chart.data.datasets[datasetIndex].label;

      setTanggalTerpilih(clickedDate);
      setJenisIzinTerpilih(clickedJenis);
    }
  };

  if (!daftarIzin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Memuat data...
      </div>
    );
  }

  const namaAkun =
    user?.nama_pengguna ||
    user?.username ||
    'Pengguna';

  useEffect(() => {
    let masihAktif = true;

    const kunciStatus = `status-pengajuan-${
      user?.id ||
      user?.id_pengguna ||
      user?.nama_pengguna ||
      user?.username ||
      'siswa'
    }`;

    async function muatDataIzin() {
      try {
        const response = await fetch(`${API_URL}/pengajuan`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Gagal memuat data izin.'
          );
        }

        const semuaData = Array.isArray(result.data)
          ? result.data
          : [];

        let statusSebelumnya = {};

        try {
          statusSebelumnya = JSON.parse(
            localStorage.getItem(kunciStatus) || '{}'
          );
        } catch {
          statusSebelumnya = {};
        }

        const idSiswa = user?.id || user?.id_pengguna;

        // Ambil hanya data milik siswa yang sedang login.
        const dataMilikSiswa = semuaData.filter((item) => {
          const cocokId =
            idSiswa != null &&
            item.id_pengguna != null &&
            String(item.id_pengguna) === String(idSiswa);

          const cocokNama =
            String(item.nama_lengkap || item.nama || '')
              .trim()
              .toLowerCase() ===
            String(namaLengkap || '')
              .trim()
              .toLowerCase();

          return cocokId || cocokNama;
        });

        const kunciNotifikasi = `notifikasi-status-pengajuan-${
          user?.id ||
          user?.id_pengguna ||
          user?.nama_pengguna ||
          user?.username ||
          'siswa'
        }`;

        let notifikasiTerkirim = {};
        try {
          notifikasiTerkirim = JSON.parse(
            localStorage.getItem(kunciNotifikasi) || '{}'
          );
        } catch {
          notifikasiTerkirim = {};
        }

        const statusFinal = (status) => {
          const nilai = String(status || '').toLowerCase();
          return (
            nilai.includes('setuju') ||
            nilai.includes('approved') ||
            nilai.includes('tolak') ||
            nilai.includes('rejected') ||
            nilai.includes('selesai')
          );
        };

        const dataBerubah = dataMilikSiswa.find((item) => {
          const idPengajuan = String(item.id_pengajuan);
          const statusSekarang = String(
            item.status || 'Menunggu Konfirmasi'
          );
          const statusLama = statusSebelumnya[idPengajuan];
          const statusSudahDinotifikasi =
            notifikasiTerkirim[idPengajuan] === statusSekarang;

          const statusBerubah =
            statusLama && statusLama !== statusSekarang;

          const statusFinalBelumDinotifikasi =
            statusFinal(statusSekarang) &&
            !statusSudahDinotifikasi;

          return (
            statusFinal(statusSekarang) &&
            (statusBerubah || statusFinalBelumDinotifikasi)
          );
        });

        const statusTerbaru = semuaData.reduce(
          (rekap, item) => {
            rekap[item.id_pengajuan] =
              item.status || 'Menunggu Konfirmasi';
            return rekap;
          },
          {}
        );

        localStorage.setItem(
          kunciStatus,
          JSON.stringify(statusTerbaru)
        );

        if (!masihAktif) return;

        setDaftarIzin(semuaData);

        if (dataBerubah) {
          const statusNilai = String(
            dataBerubah.status || ''
          ).toLowerCase();

          const statusLabel =
            statusNilai.includes('tolak') || statusNilai.includes('rejected')
              ? 'ditolak'
              : 'disetujui';

          const idPengajuan = String(dataBerubah.id_pengajuan);
          const statusSekarang = String(
            dataBerubah.status || 'Menunggu Konfirmasi'
          );

          notifikasiTerkirim[idPengajuan] = statusSekarang;
          localStorage.setItem(
            kunciNotifikasi,
            JSON.stringify(notifikasiTerkirim)
          );

          const teksNotifikasi =
            `Pengajuan ${dataBerubah.jenis_izin || 'izin'} ` +
            `tanggal ${String(dataBerubah.tanggal || '').split('T')[0]} ` +
            `telah ${statusLabel} oleh Guru Piket.`;

          setMessage({
            text: `Notifikasi: ${teksNotifikasi}`,
            type: statusLabel === 'disetujui' ? 'success' : 'error'
          });

          tambahNotifikasiSiswa(
            teksNotifikasi,
            statusLabel === 'disetujui' ? 'success' : 'error'
          );
        }
      } catch (error) {
        console.error(
          'Gagal memuat data izin:',
          error
        );

        if (masihAktif) {
          setMessage({
            text: 'Data izin belum dapat dimuat dari server.',
            type: 'error'
          });
        }
      } finally {
        if (masihAktif) {
          setLoadingData(false);
        }
      }
    }

    muatDataIzin();

    const intervalPembaruan = setInterval(
      muatDataIzin,
      10000
    );

    return () => {
      masihAktif = false;
      clearInterval(intervalPembaruan);
    };
  }, [user]);

  // ================= NOTIFIKASI & COUNTDOWN SISWA =================
  useEffect(() => {
    const timer = setInterval(() => setWaktuSekarang(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const tambahNotifikasiSiswa = (teks, type = 'info') => {
    setNotifikasiSiswa((prev) => [
      { id: Date.now() + Math.random(), text: teks, type },
      ...prev
    ].slice(0, 5));
  };

  useEffect(() => {
    if (notifikasiSiswa.length === 0) return;
    const timers = notifikasiSiswa.map((notifikasi) =>
      setTimeout(() => {
        setNotifikasiSiswa((prev) =>
          prev.filter((item) => item.id !== notifikasi.id)
        );
      }, 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifikasiSiswa]);

  const izinDisetujuiYangAkanKembali = daftarIzin
    .filter((item) => statusPengajuan(item.status) === 'Disetujui')
    .map((item) => {
      const tanggalItem = normalisasiTanggal(item.tanggal);
      const waktu = String(item.waktu_selesai || '').trim();
      if (!tanggalItem || !waktu) return null;
      const waktuNormal = waktu.length === 5 ? `${waktu}:00` : waktu;
      const target = new Date(`${tanggalItem}T${waktuNormal}`);
      if (Number.isNaN(target.getTime())) return null;
      return { item, target };
    })
    .filter(Boolean)
    .sort((a, b) => a.target - b.target);

  const izinBerikutnya = izinDisetujuiYangAkanKembali.find(
    ({ target }) => target.getTime() > waktuSekarang.getTime()
  );

  const formatCountdown = (selisihMs) => {
    const totalDetik = Math.max(0, Math.floor(selisihMs / 1000));
    const jam = Math.floor(totalDetik / 3600);
    const menit = Math.floor((totalDetik % 3600) / 60);
    const detik = totalDetik % 60;
    return `${jam} jam ${menit} menit ${detik} detik`;
  };

  const handleTutupNotifikasiSiswa = (id) => {
    setNotifikasiSiswa((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage({ text: '', type: '' });

    const dataPengajuan = {
      id_pengguna:
        user?.id ||
        user?.id_pengguna ||
        1,
      nama_lengkap: namaLengkap,
      kelas: kelas,
      jenis_izin: jenisIzin,
      alasan: alasan,
      tanggal: tanggal,
      waktu_mulai: waktuMulai,
      waktu_selesai: waktuSelesai,
      keterangan:
        alasan || 'Menunggu konfirmasi',
      status: 'Menunggu',
      jenis_kelamin: jenisKelamin
    };

    try {
      const response = await fetch(
        `${API_URL}/pengajuan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dataPengajuan)
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage({
          text: 'Pengajuan izin berhasil disimpan ke database!',
          type: 'success'
        });

        setDaftarIzin([
          {
            id_pengajuan:
              result.data?.id_pengajuan ||
              Date.now(),
            ...dataPengajuan
          },
          ...daftarIzin
        ]);

        setKelas('');
        setAlasan('');
        setTanggal('');
        setWaktuMulai('');
        setWaktuSelesai('');
      } else {
        setMessage({
          text:
            result.message ||
            'Gagal menyimpan pengajuan ke database.',
          type: 'error'
        });
      }
    } catch (err) {
      console.error(err);

      setMessage({
        text: 'Gagal terhubung ke server backend.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!idYangDiedit) {
      setMessage({
        text: 'Data yang akan diedit tidak ditemukan.',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    const dataUpdate = {
      id_pengguna:
        user?.id ||
        user?.id_pengguna ||
        1,
      nama_lengkap: namaLengkap,
      kelas: kelas,
      jenis_izin: jenisIzin,
      alasan: alasan,
      tanggal: tanggal,
      waktu_mulai: waktuMulai,
      waktu_selesai: waktuSelesai,
      keterangan:
        alasan || 'Menunggu konfirmasi',
      jenis_kelamin: jenisKelamin
    };

    try {
      const response = await fetch(
        `${API_URL}/pengajuan/${idYangDiedit}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dataUpdate)
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setDaftarIzin((prevData) =>
          prevData.map((item) =>
            String(item.id_pengajuan) ===
            String(idYangDiedit)
              ? {
                  ...item,
                  ...dataUpdate,
                  id_pengajuan:
                    item.id_pengajuan
                }
              : item
          )
        );

        setMessage({
          text: 'Data pengajuan berhasil diperbarui!',
          type: 'success'
        });

        setIsEditing(false);
        setIdYangDiedit(null);

        setKelas('');
        setAlasan('');
        setTanggal('');
        setWaktuMulai('');
        setWaktuSelesai('');
      } else {
        setMessage({
          text:
            result.message ||
            'Gagal memperbarui data pengajuan.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error(
        'Gagal memperbarui data:',
        error
      );

      setMessage({
        text: 'Gagal terhubung ke server backend.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleHapus = async (id) => {
    if (
      window.confirm(
        'Apakah Anda yakin ingin menghapus data ini?'
      )
    ) {
      try {
        const response = await fetch(
          `${API_URL}/pengajuan/${id}`,
          {
            method: 'DELETE'
          }
        );

        const result = await response.json();

        if (response.ok && result.success) {
          setDaftarIzin((prevData) =>
            prevData.filter(
              (item) =>
                String(
                  item.id_pengajuan || item.id
                ) !== String(id)
            )
          );

          alert('Data berhasil dihapus!');
        } else {
          alert(
            'Gagal menghapus data dari server: ' +
              (result.message ||
                'Terjadi kesalahan')
          );
        }
      } catch (error) {
        console.error(
          'Error saat menghapus:',
          error
        );

        alert(
          'Terjadi kesalahan koneksi saat menghapus data.'
        );
      }
    }
  };

  function normalisasiTanggal(nilai) {
    return String(nilai || '').split('T')[0];
  }

  const getDaftarTanggalDariData = () => {
    const tanggalSekarang = waktuSekarang;
    const tahun = tanggalSekarang.getFullYear();
    const bulan = String(tanggalSekarang.getMonth() + 1).padStart(
      2,
      '0'
    );

    return Array.from(
      { length: 7 },
      (_, index) => {
        const tglAngka = 7 - index;
        const hr = String(tglAngka).padStart(
          2,
          '0'
        );

        return {
          full: `${tahun}-${bulan}-${hr}`,
          label: `${hr}/${bulan}/${tahun}`
        };
      }
    );
  };

  const daftarTanggalGrafik =
    getDaftarTanggalDariData();

  const hitungIzinPerTanggal = (tanggal) => {
    return daftarIzin.filter(
      (item) =>
        normalisasiTanggal(item.tanggal) ===
        tanggal
    ).length;
  };

  const isSakit = (jenisIzin) =>
    String(jenisIzin || '')
      .trim()
      .toLowerCase()
      .includes('sakit');

  const hitungWarnaIzin = (data) => ({
    sakit: data.filter((item) =>
      isSakit(item.jenis_izin)
    ).length,

    izin: data.filter(
      (item) =>
        !isSakit(item.jenis_izin)
    ).length
  });

  const dataDetailTanggal = tanggalTerpilih
    ? Object.values(
        daftarIzin
          .filter((item) => {
            const cocokTanggal =
              normalisasiTanggal(
                item.tanggal
              ) === tanggalTerpilih;

            let cocokJenis = true;

            if (jenisIzinTerpilih === 'Sakit') {
              cocokJenis = isSakit(item.jenis_izin);
            } else if (jenisIzinTerpilih === 'Izin') {
              cocokJenis = !isSakit(item.jenis_izin);
            }

            return (
              cocokTanggal &&
              cocokJenis
            );
          })
          .reduce((rekap, item) => {
            const kunci = `${
              item.nama_lengkap || item.nama || '-'
            }_${item.kelas || '-'}_${
              item.jenis_kelamin || item.gender || '-'
            }_${item.alasan || '-'}`;

            if (!rekap[kunci]) {
              rekap[kunci] = {
                nama:
                  item.nama_lengkap ||
                  item.nama ||
                  '-',

                kelas:
                  item.kelas || '-',

                jenisKelamin:
                  item.jenis_kelamin ||
                  item.gender ||
                  '-',

                jenis_izin:
                  item.jenis_izin ||
                  '-',

                alasan:
                  item.alasan || '-',

                total: 0
              };
            }

            rekap[kunci].total += 1;

            return rekap;
          }, {})
      )
    : [];

  const maxCount = Math.max(
    ...daftarTanggalGrafik.map(
      (item) =>
        hitungIzinPerTanggal(item.full)
    ),
    1
  );

  // ================= PERBAIKAN UTAMA DI SINI =================
  function statusPengajuan(status) {
    const nilai = String(status || '').toLowerCase().trim();

    // Memeriksa berbagai variasi kata dari database/backend guru piket
    if (
      nilai.includes('tolak') || 
      nilai.includes('rejected') || 
      nilai.includes('tidak')
    ) {
      return 'Ditolak';
    }

    if (
      nilai.includes('setuju') || 
      nilai.includes('approved') || 
      nilai.includes('selesai') ||
      nilai.includes('terima') ||
      nilai === '1' ||
      nilai === 'true'
    ) {
      return 'Disetujui';
    }

    return 'Menunggu Konfirmasi';
  }

  const hitungKelompok = (
    items,
    getKey
  ) =>
    Object.entries(
      items.reduce((rekap, item) => {
        const key =
          getKey(item) ||
          'Tidak diketahui';

        rekap[key] =
          (rekap[key] || 0) + 1;

        return rekap;
      }, {})
    ).sort(
      (a, b) => b[1] - a[1]
    );

  const rekapJenisKelamin =
    hitungKelompok(
      daftarIzin,
      (item) =>
        item.jenis_kelamin ||
        item.gender
    );

  const rekapKelas =
    hitungKelompok(
      daftarIzin,
      (item) => item.kelas
    );

  const tanggalTerbaru = [
    ...daftarIzin
  ]
    .map((item) =>
      normalisasiTanggal(
        item.tanggal
      )
    )
    .filter((item) =>
      /^\d{4}-\d{2}-\d{2}$/.test(item)
    )
    .sort()
    .at(-1);

  const bulanLaporan = `${waktuSekarang.getFullYear()}-${String(waktuSekarang.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    tahunLaporan,
    bulanLaporanNomor
  ] = (
    bulanGrafik ||
    bulanLaporan
  )
    .split('-')
    .map(Number);

  const daftarHari = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu'
  ];

  const rekapMingguan =
    daftarHari.map(
      (namaHari, indexHari) => {
        const dataHari =
          daftarIzin.filter(
            (item) => {
              const tanggalItem =
                normalisasiTanggal(
                  item.tanggal
                );

              if (
                !/^\d{4}-\d{2}-\d{2}$/.test(
                  tanggalItem
                )
              )
                return false;

              const [
                tahun,
                bulan,
                hari
              ] = tanggalItem
                .split('-')
                .map(Number);

              const tanggalObj =
                new Date(
                  tahun,
                  bulan - 1,
                  hari
                );

              const hariSenin =
                (tanggalObj.getDay() +
                  6) %
                7;

              return (
                tahun ===
                  tahunLaporan &&
                bulan ===
                  bulanLaporanNomor &&
                hariSenin ===
                  indexHari
              );
            }
          );

        return {
          label: namaHari,
          data: dataHari
        };
      }
    );

  const maxMingguan = Math.max(
    ...rekapMingguan.map(
      (item) =>
        item.data.length
    ),
    1
  );

  const dataHariTerpilihMentah =
    rekapMingguan.find(
      (item) =>
        item.label ===
        hariTerpilih
    )?.data || [];

  const dataHariTerpilih =
    Object.values(
      dataHariTerpilihMentah.reduce(
        (rekap, item) => {
          const nama =
            item.nama_lengkap ||
            item.nama ||
            '-';

          const kelas =
            item.kelas || '-';

          const jenisKelamin =
            item.jenis_kelamin ||
            item.gender ||
            '-';

          const kunci =
            `${nama}|${kelas}|${jenisKelamin}`;

          if (!rekap[kunci]) {
            rekap[kunci] = {
              nama_lengkap: nama,
              kelas,
              jenis_kelamin:
                jenisKelamin,
              tanggalList: [],
              total: 0
            };
          }

          const tanggalItem =
            normalisasiTanggal(
              item.tanggal
            );

          if (
            tanggalItem &&
            !rekap[kunci].tanggalList.includes(
              tanggalItem
            )
          ) {
            rekap[kunci].tanggalList.push(
              tanggalItem
            );
          }

          rekap[kunci].total += 1;

          return rekap;
        },
        {}
      )
    );

  const namaBulan = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember'
  ];

  const jumlahHariDalamBulan =
    new Date(
      tahunLaporan,
      bulanLaporanNomor,
      0
    ).getDate();

  const tanggalAwalGrafik =
    `01 ${
      namaBulan[
        bulanLaporanNomor - 1
      ]
    } ${tahunLaporan}`;

  const tanggalAkhirGrafik =
    `${jumlahHariDalamBulan} ${
      namaBulan[
        bulanLaporanNomor - 1
      ]
    } ${tahunLaporan}`;

  const rekapBulanan =
    namaBulan.map(
      (nama, indexBulan) => ({
        nama,
        index: indexBulan,
        data: daftarIzin.filter(
          (item) => {
            const tanggalItem =
              normalisasiTanggal(
                item.tanggal
              );

            if (
              !/^\d{4}-\d{2}-\d{2}$/.test(
                tanggalItem
              )
            )
              return false;

            const [
              tahun,
              bulan
            ] = tanggalItem
              .split('-')
              .map(Number);

            return (
              tahun ===
                tahunLaporan &&
              bulan ===
                indexBulan + 1
            );
          }
        )
      })
    );

  const maxBulanan = Math.max(
    ...rekapBulanan.map(
      (item) =>
        item.data.length
    ),
    1
  );

  const dataBulanTerpilihMentah =
    bulanTerpilih === null
      ? []
      : rekapBulanan[
          bulanTerpilih
        ].data;

  const dataBulanTerpilih =
    Object.values(
      dataBulanTerpilihMentah.reduce(
        (rekap, item) => {
          const nama =
            item.nama_lengkap ||
            item.nama ||
            '-';

          const kelas =
            item.kelas || '-';

          const kunci =
            `${nama}|${kelas}`;

          if (!rekap[kunci]) {
            rekap[kunci] = {
              nama_lengkap: nama,
              kelas,
              tanggalList: [],
              total: 0
            };
          }

          const tanggalItem =
            normalisasiTanggal(
              item.tanggal
            );

          if (
            tanggalItem &&
            !rekap[kunci].tanggalList.includes(
              tanggalItem
            )
          ) {
            rekap[kunci].tanggalList.push(
              tanggalItem
            );
          }

          rekap[kunci].total += 1;

          return rekap;
        },
        {}
      )
    );

  const koordinatBulanan =
    rekapBulanan.map(
      (item, index) => ({
        x:
          20 + index * 60,

        y:
          170 -
          (item.data.length /
            maxBulanan) *
            130
      })
    );

  const jalurBulanan =
    koordinatBulanan.reduce(
      (
        jalur,
        titik,
        index
      ) => {
        if (index === 0)
          return `M ${titik.x} ${titik.y}`;

        const sebelumnya =
          koordinatBulanan[
            index - 1
          ];

        const kontrolKiri =
          sebelumnya.x +
          (titik.x -
            sebelumnya.x) /
            2;

        return `${jalur} C ${kontrolKiri} ${sebelumnya.y}, ${kontrolKiri} ${titik.y}, ${titik.x} ${titik.y}`;
      },
      ''
    );

  const totalJenisKelamin =
    rekapJenisKelamin.reduce(
      (
        total,
        [, jumlah]
      ) =>
        total + jumlah,
      0
    );

  let sudutDonat = 0;

  const warnaUntukJenisKelamin = (
    label
  ) => {
    const nilai =
      String(label).toLowerCase();

    if (
      nilai.includes(
        'perempuan'
      ) ||
      nilai.includes('wanita')
    )
      return '#ec4899';

    if (
      nilai.includes('laki') ||
      nilai.includes('pria')
    )
      return '#3b82f6';

    return '#94a3b8';
  };

  const gayaBadgeJenisKelamin = (
    label
  ) => {
    const nilai =
      String(
        label || ''
      ).toLowerCase();

    if (
      nilai.includes(
        'perempuan'
      ) ||
      nilai.includes('wanita')
    ) {
      return {
        backgroundColor:
          '#fce7f3',
        color: '#be185d'
      };
    }

    if (
      nilai.includes('laki') ||
      nilai.includes('pria')
    ) {
      return {
        backgroundColor:
          '#dbeafe',
        color: '#1d4ed8'
      };
    }

    return {
      backgroundColor:
        '#f1f5f9',
      color: '#475569'
    };
  };

  const gradientJenisKelamin =
    rekapJenisKelamin
      .map(
        ([label, jumlah]) => {
          const sudutAwal =
            sudutDonat;

          sudutDonat +=
            (jumlah /
              Math.max(
                totalJenisKelamin,
                1
              )) *
            360;

          return `${warnaUntukJenisKelamin(
            label
          )} ${sudutAwal}deg ${sudutDonat}deg`;
        }
      )
      .join(', ');

  const dataTabelDetail =
    daftarIzin.filter(
      (item) => {
        const cocokTanggal =
          normalisasiTanggal(
            item.tanggal
          ) === tanggalTerpilih;

        const cocokJenis =
          jenisIzinTerpilih
            ? item.jenisIzin ===
              jenisIzinTerpilih
            : true;

        return (
          cocokTanggal &&
          cocokJenis
        );
      }
    );

  return (
    <div
      className="dashboard-siswa-root"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#f1f5f9',
        fontFamily:
          'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* ================= SIDEBAR (WARNA PUTIH) ================= */}
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
      <div
        className={`dashboard-siswa-sidebar${mobileMenuOpen ? ' sidebar-open' : ''}`}
        style={{
          width: '260px',
          backgroundColor: '#ffffff',
          color: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          top: 0,
          left: 0,
          zIndex: 100,
          borderRight: '1px solid #e2e8f0'
        }}
      >
        <div
          style={{
            padding:
              '1.5rem 1.25rem',
            borderBottom:
              '1px solid #e2e8f0'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <img
              src="/logo_sekolah-removebg-preview.png"
              alt="Logo sekolah"
              style={{
                width: '38px',
                height: '38px',
                objectFit: 'contain',
                borderRadius: '6px',
                backgroundColor:
                  '#f1f5f9',
                padding: '3px',
                flexShrink: 0
              }}
            />

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  color: '#1e293b'
                }}
              >
                Dashboard Siswa
              </h3>

              <p
                style={{
                  margin:
                    '2px 0 0 0',
                  fontSize: '0.7rem',
                  color: '#64748b'
                }}
              >
                Portal Siswa
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            padding:
              '1.25rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            flex: 1
          }}
        >
          <button
            onClick={() =>
              setActiveMenu(
                'pengajuan'
              )
            }
            style={{
              width: '100%',
              textAlign: 'left',
              padding:
                '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor:
                activeMenu ===
                'pengajuan'
                  ? '#2563eb'
                  : 'transparent',
              color: activeMenu === 'pengajuan' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span>➕</span>
            Form Pengajuan
          </button>

          <button
            onClick={() =>
              setActiveMenu(
                'laporan'
              )
            }
            style={{
              width: '100%',
              textAlign: 'left',
              padding:
                '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor:
                activeMenu ===
                'laporan'
                  ? '#2563eb'
                  : 'transparent',
              color: activeMenu === 'laporan' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span>📊</span>
            Laporan Izin Siswa
          </button>
        </div>

        <div
          style={{
            padding:
              '1rem 1.25rem',
            borderTop:
              '1px solid #e2e8f0'
          }}
        >
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              backgroundColor:
                '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '0.7rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'center',
              gap: '8px'
            }}
          >
            <span>🚪</span>
            Keluar Akun
          </button>
        </div>
      </div>

      {/* ================= KONTEN UTAMA ================= */}
      <div
        className="dashboard-siswa-main"
        style={{
          marginLeft: '260px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        {/* HEADER */}
        <div
          style={{
            backgroundColor:
              '#ffffff',
            borderBottom:
              '1px solid #e2e8f0',
            padding:
              '1rem 2rem',
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: '#1e293b'
            }}
          >
            Dashboard Siswa -
            Sistem Perizinan
          </div>

          <div
            style={{
              fontSize: '0.85rem',
              color: '#64748b'
            }}
          >
            Login sebagai:{' '}
            <b>{namaAkun}</b>
          </div>
        </div>

        {/* ISI KONTEN */}
        <div
          style={{
            padding: '2rem',
            boxSizing:
              'border-box'
          }}
        >
          {message.text && (
            <div
              style={{
                backgroundColor:
                  message.type ===
                  'success'
                    ? '#d1fae5'
                    : '#fee2e2',
                color:
                  message.type ===
                  'success'
                    ? '#065f46'
                    : '#b91c1c',
                padding:
                  '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom:
                  '1.5rem',
                fontSize: '0.9rem',
                textAlign: 'center',
                border: `1px solid ${
                  message.type ===
                  'success'
                    ? '#34d399'
                    : '#f87171'
                }`
              }}
            >
              {message.text}
            </div>
          )}


          {notifikasiSiswa.length > 0 && (
            <div
              style={{
                position: 'fixed',
               top: '20px',                  // Menempel di bagian atas layar dengan jarak 20px
left: '50%',
transform: 'translateX(-50%)', // Membuat posisinya tetap di tengah secara horizontal
                zIndex: 9999,
                width: 'min(390px, calc(100vw - 40px))',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                pointerEvents: 'none'
              }}
            >
              {notifikasiSiswa.map((notifikasi) => (
                <div
                  key={notifikasi.id}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    border: `1px solid ${notifikasi.type === 'success' ? '#a7f3d0' : '#bfdbfe'}`,
                    borderLeft: `5px solid ${notifikasi.type === 'success' ? '#16a34a' : '#2563eb'}`,
                    padding: '14px 16px',
                    borderRadius: '10px',
                    boxShadow: '0 8px 25px rgba(15, 23, 42, 0.18)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '13px',
                    animation: 'siswaNotifMasuk 0.3s ease-out',
                    pointerEvents: 'auto'
                  }}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>🔔</span>
                  <div style={{ flex: 1, lineHeight: '1.5' }}>
                    <div style={{ fontWeight: '700', marginBottom: '3px' }}>Notifikasi Baru</div>
                    <div>{notifikasi.text}</div>
                  </div>
                  <button
                    onClick={() => handleTutupNotifikasiSiswa(notifikasi.id)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '20px', lineHeight: 1, color: '#64748b', padding: '0 2px' }}
                    title="Tutup"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <style>{`
            @keyframes siswaNotifMasuk {
              from { opacity: 0; transform: translateX(30px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>

          {izinBerikutnya && (
            <div
              style={{
                backgroundColor: '#fff7ed',
                color: '#9a3412',
                border: '1px solid #fed7aa',
                padding: '1rem',
                borderRadius: '10px',
                marginBottom: '1.5rem',
                fontSize: '0.9rem'
              }}
            >
              🔔 <strong>Pengingat waktu kembali:</strong> kamu harus kembali ke sekolah dalam{' '}
              <strong>{formatCountdown(izinBerikutnya.target.getTime() - waktuSekarang.getTime())}</strong>.
              <div style={{ marginTop: '4px', fontSize: '0.82rem' }}>
                Waktu kembali: <strong>{izinBerikutnya.item.waktu_selesai}</strong>
              </div>
            </div>
          )}

          {activeMenu ===
          'pengajuan' ? (
            /* ================= MENU FORM PENGAJUAN ================= */
            <div
              style={{
                maxWidth: '700px',
                margin: '0 auto',
                backgroundColor:
                  '#ffffff',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow:
                  '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  marginBottom:
                    '1.5rem',
                  borderBottom:
                    '1px solid #f1f5f9',
                  paddingBottom:
                    '0.75rem'
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize:
                      '1rem',
                    fontWeight:
                      'bold',
                    color:
                      '#1e293b'
                  }}
                >
                  {isEditing
                    ? 'EDIT PENGAJUAN IZIN'
                    : 'FORM PENGAJUAN IZIN'}
                </h3>
              </div>

              <form
                onSubmit={
                  isEditing
                    ? handleUpdate
                    : handleSubmit
                }
              >
                <div
                  style={{
                    marginBottom:
                      '1rem'
                  }}
                >
                  <label
                    style={{
                      display:
                        'block',
                      fontSize:
                        '0.75rem',
                      fontWeight:
                        'bold',
                      color:
                        '#4b5563',
                      marginBottom:
                        '0.4rem',
                      textTransform:
                        'uppercase'
                    }}
                  >
                    NAMA LENGKAP
                  </label>

                  <input
                    type="text"
                    value={
                      namaLengkap
                    }
                    onChange={(e) =>
                      setNamaLengkap(
                        e.target.value
                      )
                    }
                    required
                    style={{
                      width: '100%',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '6px',
                      padding:
                        '0.7rem',
                      fontSize:
                        '0.9rem',
                      outline: 'none',
                      boxSizing:
                        'border-box',
                      backgroundColor:
                        '#f8fafc'
                    }}
                  />
                </div>

                <div
                  style={{
                    marginBottom:
                      '1rem'
                  }}
                >
                  <label
                    style={{
                      display:
                        'block',
                      fontSize:
                        '0.75rem',
                      fontWeight:
                        'bold',
                      color:
                        '#4b5563',
                      marginBottom:
                        '0.4rem',
                      textTransform:
                        'uppercase'
                    }}
                  >
                    KELAS
                  </label>

                  <input
                    type="text"
                    value={kelas}
                    onChange={(e) =>
                      setKelas(
                        e.target.value
                      )
                    }
                    placeholder="Contoh: XII RPL 1"
                    required
                    style={{
                      width: '100%',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '6px',
                      padding:
                        '0.7rem',
                      fontSize:
                        '0.9rem',
                      outline: 'none',
                      boxSizing:
                        'border-box'
                    }}
                  />
                </div>

                <div
                  style={{
                    marginBottom:
                      '1rem'
                  }}
                >
                  <label
                    style={{
                      display:
                        'block',
                      fontSize:
                        '0.75rem',
                      fontWeight:
                        'bold',
                      color:
                        '#4b5563',
                      marginBottom:
                        '0.4rem',
                      textTransform:
                        'uppercase'
                    }}
                  >
                    JENIS KELAMIN
                  </label>

                  <select
                    value={
                      jenisKelamin
                    }
                    onChange={(e) =>
                      setJenisKelamin(
                        e.target.value
                      )
                    }
                    style={{
                      width: '100%',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '6px',
                      padding:
                        '0.7rem',
                      fontSize:
                        '0.9rem',
                      outline: 'none',
                      backgroundColor:
                        '#fff',
                      cursor:
                        'pointer',
                      boxSizing:
                        'border-box'
                    }}
                  >
                    <option value="Laki-laki">
                      Laki-laki
                    </option>
                    <option value="Perempuan">
                      Perempuan
                    </option>
                  </select>
                </div>

                <div
                  style={{
                    marginBottom:
                      '1rem'
                  }}
                >
                  <label
                    style={{
                      display:
                        'block',
                      fontSize:
                        '0.75rem',
                      fontWeight:
                        'bold',
                      color:
                        '#4b5563',
                      marginBottom:
                        '0.4rem',
                      textTransform:
                        'uppercase'
                    }}
                  >
                    JENIS IZIN
                  </label>

                  <select
                    value={
                      jenisIzin
                    }
                    onChange={(e) =>
                      setJenisIzin(
                        e.target.value
                      )
                    }
                    style={{
                      width: '100%',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '6px',
                      padding:
                        '0.7rem',
                      fontSize:
                        '0.9rem',
                      outline: 'none',
                      backgroundColor:
                        '#fff',
                      cursor:
                        'pointer',
                      boxSizing:
                        'border-box'
                    }}
                  >
                    <option value="Keluar Sekolah">
                      Keluar Sekolah
                    </option>
                    <option value="Pulang Cepat">
                      Pulang Cepat
                    </option>
                    <option value="Dispen Kegiatan">
                      Dispen Kegiatan
                    </option>
                    <option value="Sakit">
                      Sakit
                    </option>
                  </select>
                </div>

                <div
                  style={{
                    marginBottom:
                      '1rem'
                  }}
                >
                  <label
                    style={{
                      display:
                        'block',
                      fontSize:
                        '0.75rem',
                      fontWeight:
                        'bold',
                      color:
                        '#4b5563',
                      marginBottom:
                        '0.4rem',
                      textTransform:
                        'uppercase'
                    }}
                  >
                    ALASAN /
                    KETERANGAN
                  </label>

                  <input
                    type="text"
                    value={alasan}
                    onChange={(e) =>
                      setAlasan(
                        e.target.value
                      )
                    }
                    placeholder="Contoh: Sakit perut / keperluan mendesak"
                    required
                    style={{
                      width: '100%',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '6px',
                      padding:
                        '0.7rem',
                      fontSize:
                        '0.9rem',
                      outline: 'none',
                      boxSizing:
                        'border-box'
                    }}
                  />
                </div>

                <div
                  style={{
                    marginBottom:
                      '1rem'
                  }}
                >
                  <label
                    style={{
                      display:
                        'block',
                      fontSize:
                        '0.75rem',
                      fontWeight:
                        'bold',
                      color:
                        '#4b5563',
                      marginBottom:
                        '0.4rem',
                      textTransform:
                        'uppercase'
                    }}
                  >
                    TANGGAL
                  </label>

                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) =>
                      setTanggal(
                        e.target.value
                      )
                    }
                    required
                    style={{
                      width: '100%',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '6px',
                      padding:
                        '0.7rem',
                      fontSize:
                        '0.9rem',
                      outline: 'none',
                      boxSizing:
                        'border-box'
                    }}
                  />
                </div>

                <div
                  style={{
                    display:
                      'grid',
                    gridTemplateColumns:
                      '1fr 1fr',
                    gap: '1rem',
                    marginBottom:
                      '1.5rem'
                  }}
                >
                  <div>
                    <label
                      style={{
                        display:
                          'block',
                        fontSize:
                          '0.75rem',
                        fontWeight:
                          'bold',
                        color:
                          '#4b5563',
                        marginBottom:
                          '0.4rem',
                        textTransform:
                          'uppercase'
                      }}
                    >
                      WAKTU MULAI
                    </label>

                    <input
                      type="time"
                      value={
                        waktuMulai
                      }
                      onChange={(e) =>
                        setWaktuMulai(
                          e.target.value
                        )
                      }
                      required
                      style={{
                        width: '100%',
                        border:
                          '1px solid #cbd5e1',
                        borderRadius:
                          '6px',
                        padding:
                          '0.7rem',
                        fontSize:
                          '0.9rem',
                        outline:
                          'none',
                        boxSizing:
                          'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display:
                          'block',
                        fontSize:
                          '0.75rem',
                        fontWeight:
                          'bold',
                        color:
                          '#4b5563',
                        marginBottom:
                          '0.4rem',
                        textTransform:
                          'uppercase'
                      }}
                    >
                      WAKTU SELESAI
                    </label>

                    <input
                      type="time"
                      value={
                        waktuSelesai
                      }
                      onChange={(e) =>
                        setWaktuSelesai(
                          e.target.value
                        )
                      }
                      required
                      style={{
                        width: '100%',
                        border:
                          '1px solid #cbd5e1',
                        borderRadius:
                          '6px',
                        padding:
                          '0.7rem',
                        fontSize:
                          '0.9rem',
                        outline:
                          'none',
                        boxSizing:
                          'border-box'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    backgroundColor:
                      '#2563eb',
                    color: '#ffffff',
                    fontWeight:
                      'bold',
                    padding:
                      '0.8rem',
                    borderRadius:
                      '6px',
                    border: 'none',
                    cursor:
                      'pointer',
                    fontSize:
                      '0.95rem'
                  }}
                >
                  {loading
                    ? isEditing
                      ? 'Menyimpan Perubahan...'
                      : 'Menyimpan...'
                    : isEditing
                    ? 'Simpan Perubahan'
                    : 'Kirim Pengajuan'}
                </button>

                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(
                        false
                      );
                      setIdYangDiedit(
                        null
                      );
                      setKelas('');
                      setAlasan('');
                      setTanggal('');
                      setWaktuMulai(
                        ''
                      );
                      setWaktuSelesai(
                        ''
                      );
                    }}
                    style={{
                      width: '100%',
                      backgroundColor:
                        '#e5e7eb',
                      color: '#374151',
                      fontWeight:
                        'bold',
                      padding:
                        '0.8rem',
                      borderRadius:
                        '6px',
                      border: 'none',
                      cursor:
                        'pointer',
                      fontSize:
                        '0.95rem',
                      marginTop:
                        '0.6rem'
                    }}
                  >
                    Batal Edit
                  </button>
                )}
              </form>
            </div>
          ) : (
            /* ================= MENU LAPORAN & GRAFIK ================= */
            <div
              style={{
                maxWidth: '950px',
                margin: '0 auto',
                display: 'flex',
                flexDirection:
                  'column',
                gap: '1.5rem'
              }}
            >
              {/* BAGIAN 1 */}
              <div
                style={{
                  backgroundColor:
                    '#ffffff',
                  borderRadius:
                    '12px',
                  padding:
                    '1.5rem 2rem',
                  boxShadow:
                    '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'flex-start',
                    marginBottom:
                      '0.5rem'
                  }}
                >
                  <div>
                    <h4
                      style={{
                        margin:
                          '0 0 4px 0',
                        fontSize:
                          '0.95rem',
                        fontWeight:
                          'bold',
                        color:
                          '#1e293b'
                      }}
                    >
                      1. Rekapitulasi Jumlah Izin (Berdasarkan Tanggal)
                    </h4>

                    <p
                      style={{
                        margin: 0,
                        fontSize:
                          '0.75rem',
                        color:
                          '#64748b'
                      }}
                    >
                      Klik salah satu tanggal pada grafik untuk melihat rincian mingguan.
                    </p>
                  </div>

                  <span
                    style={{
                      backgroundColor:
                        '#f1f5f9',
                      color:
                        '#475569',
                      fontSize:
                        '0.75rem',
                      padding:
                        '4px 10px',
                      borderRadius:
                        '4px',
                      fontWeight:
                        '500'
                    }}
                  >
                    Langkah 1
                  </span>
                </div>

                <div
                  style={{
                    position:
                      'relative',
                    height:
                      '220px',
                    marginTop:
                      '2.5rem',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius:
                      '8px',
                    backgroundImage:
                      'linear-gradient(to bottom, transparent 49.5%, #e2e8f0 50%, transparent 50.5%)',
                    display:
                      'flex',
                    justifyContent:
                      'space-around',
                    alignItems:
                      'flex-end',
                    padding:
                      '0 1rem 1.75rem 2.25rem'
                  }}
                >
                  {loadingData ? (
                    <div
                      style={{
                        position:
                          'absolute',
                        inset: 0,
                        display:
                          'grid',
                        placeItems:
                          'center',
                        color:
                          '#64748b',
                        fontSize:
                          '0.85rem'
                      }}
                    >
                      Memuat data izin...
                    </div>
                  ) : (
                    <>
                      {Array.from(
                        {
                          length:
                            maxCount +
                            1
                        },
                        (
                          _,
                          index
                        ) =>
                          maxCount -
                          index
                      ).map(
                        (nilai) => (
                          <span
                            key={
                              nilai
                            }
                            style={{
                              position:
                                'absolute',
                              left:
                                '0.45rem',
                              bottom: `${
                                (nilai /
                                  maxCount) *
                                100
                              }%`,
                              transform:
                                'translateY(50%)',
                              fontSize:
                                '0.7rem',
                              color:
                                '#94b897'
                            }}
                          >
                            {nilai}
                          </span>
                        )
                      )}

                      {[
                        ...daftarTanggalGrafik
                      ].map(
                        (tglItem) => {
                          const count =
                            hitungIzinPerTanggal(
                              tglItem.full
                            );

                          const dataTanggal =
                            daftarIzin.filter(
                              (item) =>
                                normalisasiTanggal(
                                  item.tanggal
                                ) ===
                                tglItem.full
                            );

                          const jumlahWarna =
                            hitungWarnaIzin(
                              dataTanggal
                            );

                          const heightPercent =
                            maxCount >
                            0
                              ? (count /
                                  maxCount) *
                                100
                              : 0;

                          const barHeight =
                            count >
                            0
                              ? Math.max(
                                  heightPercent,
                                  25
                                )
                              : 0;

                          return (
                            <div
                              key={
                                tglItem.full
                              }
                              onClick={() => {
                                setTanggalTerpilih(
                                  tglItem.full
                                );
                                setJenisIzinTerpilih(null);
                              }}
                              onMouseEnter={() =>
                                setGrafikHover(
                                  {
                                    key: `tanggal-${tglItem.full}`
                                  }
                                )
                              }
                              style={{
                                width:
                                  '36px',
                                height:
                                  '100%',
                                position:
                                  'relative',
                                cursor:
                                  'pointer',
                                display:
                                  'flex',
                                flexDirection:
                                  'column',
                                justifyContent:
                                  'flex-end',
                                alignItems:
                                  'center'
                              }}
                            >
                              <div
                                style={{
                                  width:
                                    '36px',
                                  height: `${barHeight}%`,
                                  minHeight:
                                    count >
                                    0
                                      ? '30px'
                                      : '0px',
                                  backgroundColor:
                                    '#e5e7eb',
                                  display:
                                    'flex',
                                  flexDirection:
                                    'column-reverse',
                                  borderRadius:
                                    '4px',
                                  overflow:
                                    'hidden'
                                }}
                              >
                                {jumlahWarna.izin >
                                  0 && (
                                  <div
                                    style={{
                                      height: `${
                                        (jumlahWarna.izin /
                                          count) *
                                        100
                                      }%`,
                                      width:
                                        '100%',
                                      backgroundColor:
                                        '#3b82f6',
                                      cursor:
                                        'pointer'
                                    }}
                                    onClick={(
                                      e
                                    ) => {
                                      e.stopPropagation();
                                      setTanggalTerpilih(
                                        tglItem.full
                                      );
                                      setJenisIzinTerpilih(
                                        'Izin'
                                      );
                                    }}
                                  />
                                )}

                                {jumlahWarna.sakit >
                                  0 && (
                                  <div
                                    style={{
                                      height: `${
                                        (jumlahWarna.sakit /
                                          count) *
                                        100
                                      }%`,
                                      width:
                                        '100%',
                                      backgroundColor:
                                        '#10b981',
                                      cursor:
                                        'pointer'
                                    }}
                                    onClick={(
                                      e
                                    ) => {
                                      e.stopPropagation();
                                      setTanggalTerpilih(
                                        tglItem.full
                                      );
                                      setJenisIzinTerpilih(
                                        'Sakit'
                                      );
                                    }}
                                  />
                                )}
                              </div>

                              <span
                                style={{
                                  position:
                                    'absolute',
                                  bottom:
                                    '-18px',
                                  fontSize:
                                    '0.62rem',
                                  color:
                                    '#64748b',
                                  whiteSpace:
                                    'nowrap',
                                  lineHeight:
                                    '1'
                                }}
                              >
                                {
                                  tglItem.label
                                }
                              </span>
                            </div>
                          );
                        }
                      )}
                    </>
                  )}
                </div>

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'center',
                    gap: '1.25rem',
                    marginTop:
                      '0.9rem',
                    color:
                      '#64748b',
                    fontSize:
                      '0.72rem'
                  }}
                >
                  <span
                    style={{
                      display:
                        'inline-flex',
                      alignItems:
                        'center',
                      gap:
                        '0.35rem'
                    }}
                  >
                    <i
                      style={{
                        width:
                          '10px',
                        height:
                          '10px',
                        borderRadius:
                          '3px',
                        backgroundColor:
                          '#2563eb'
                      }}
                    />
                    Izin
                  </span>

                  <span
                    style={{
                      display:
                        'inline-flex',
                      alignItems:
                        'center',
                      gap:
                        '0.35rem'
                    }}
                  >
                    <i
                      style={{
                        width:
                          '10px',
                        height:
                          '10px',
                        borderRadius:
                          '3px',
                        backgroundColor:
                          '#16a34a'
                      }}
                    />
                    Sakit
                  </span>
                </div>

                {tanggalTerpilih && (
                  <div
                    style={{
                      marginTop:
                        '1.5rem',
                      borderTop:
                        '1px solid #e2e8f0',
                      paddingTop:
                        '1rem'
                    }}
                  >
                    <h4
                      style={{
                        margin:
                          '0 0 0.75rem',
                        fontSize:
                          '0.95rem',
                        color:
                          '#1e293b'
                      }}
                    >
                      Detail Izin Tanggal{' '}
                      {
                        tanggalTerpilih
                      }
                    </h4>

                    {dataDetailTanggal.length ===
                    0 ? (
                      <p
                        style={{
                          margin: 0,
                          color:
                            '#94a3b8',
                          fontSize:
                            '0.85rem'
                        }}
                      >
                        Tidak ada izin pada tanggal ini.
                      </p>
                    ) : (
                      <div
                        style={{
                          overflowX:
                            'auto'
                        }}
                      >
                        <table
                          style={{
                            width:
                              '100%',
                            borderCollapse:
                              'collapse',
                            fontSize:
                              '0.8rem'
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor:
                                  '#f8fafc',
                                color:
                                  '#475569'
                              }}
                            >
                              <th
                                style={{
                                  padding:
                                    '0.7rem',
                                  textAlign:
                                    'left',
                                  borderBottom:
                                    '1px solid #e2e8f0'
                                }}
                              >
                                Nama
                              </th>

                              <th
                                style={{
                                  padding:
                                    '0.7rem',
                                  textAlign:
                                    'left',
                                  borderBottom:
                                    '1px solid #e2e8f0'
                                }}
                              >
                                Kelas
                              </th>

                              <th
                                style={{
                                  padding:
                                    '0.7rem',
                                  textAlign:
                                    'left',
                                  borderBottom:
                                    '1px solid #e2e8f0'
                                }}
                              >
                                Jenis Kelamin
                              </th>

                              <th
                                style={{
                                  padding:
                                    '0.7rem',
                                  textAlign:
                                    'center',
                                  borderBottom:
                                    '1px solid #e2e8f0'
                                }}
                              >
                                Total Izin
                              </th>

                              <th
                                style={{
                                  padding:
                                    '0.7rem',
                                  textAlign:
                                    'center',
                                  borderBottom:
                                    '1px solid #e2e8f0'
                                }}
                              >
                                Alasan
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {dataDetailTanggal.map(
                              (
                                item
                              ) => (
                                <tr
                                  key={`${item.nama}-${item.kelas}-${item.jenisKelamin}`}
                                >
                                  <td
                                    style={{
                                      padding:
                                        '0.7rem',
                                      borderBottom:
                                        '1px solid #f1f5f9',
                                      fontWeight:
                                        '600'
                                    }}
                                  >
                                    {
                                      item.nama
                                    }
                                  </td>

                                  <td
                                    style={{
                                      padding:
                                        '0.7rem',
                                      borderBottom:
                                        '1px solid #f1f5f9'
                                    }}
                                  >
                                    {
                                      item.kelas
                                    }
                                  </td>

                                  <td
                                    style={{
                                      padding:
                                        '0.7rem',
                                      borderBottom:
                                        '1px solid #f1f5f9'
                                    }}
                                  >
                                    {
                                      item.jenisKelamin
                                    }
                                  </td>

                                  <td
                                    style={{
                                      padding:
                                        '0.7rem',
                                      borderBottom:
                                        '1px solid #f1f5f9',
                                      textAlign:
                                        'center',
                                      fontWeight:
                                        '700'
                                    }}
                                  >
                                    {
                                      item.total
                                    }
                                  </td>

                                  <td
                                    style={{
                                      padding:
                                        '0.7rem',
                                      borderBottom:
                                        '1px solid #f1f5f9'
                                    }}
                                  >
                                    {
                                      item.alasan
                                    }
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* GRAFIK JENIS KELAMIN DAN KELAS */}
              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(2, minmax(0, 1fr))',
                  gap: '1.5rem'
                }}
              >
                <div
                  style={{
                    backgroundColor:
                      '#ffffff',
                    borderRadius:
                      '12px',
                    padding:
                      '1.5rem',
                    boxShadow:
                      '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <h3
                    style={{
                      margin:
                        '0 0 1rem',
                      fontSize:
                        '0.95rem',
                      color:
                        '#1e293b'
                    }}
                  >
                    Grafik Jenis Kelamin
                  </h3>

                  {rekapJenisKelamin.length ===
                  0 ? (
                    <p
                      style={{
                        color:
                          '#94a3b8',
                        fontSize:
                          '0.85rem'
                      }}
                    >
                      Belum ada data.
                    </p>
                  ) : (
                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap:
                          '1.25rem'
                      }}
                    >
                      <div
                        style={{
                          width:
                            '135px',
                          height:
                            '135px',
                          flex:
                            '0 0 135px',
                          borderRadius:
                            '50%',
                          background:
                            `conic-gradient(${gradientJenisKelamin})`,
                          display:
                            'grid',
                          placeItems:
                            'center'
                        }}
                      >
                        <div
                          style={{
                            width:
                              '72px',
                            height:
                              '72px',
                            borderRadius:
                              '50%',
                            backgroundColor:
                              '#ffffff'
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display:
                            'grid',
                          gap:
                            '0.55rem',
                          fontSize:
                            '0.78rem',
                          color:
                            '#475569'
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap:
                              '0.45rem'
                          }}
                        >
                          <span
                            style={{
                              width:
                                '10px',
                              height:
                                '10px',
                              borderRadius:
                                '50%',
                              backgroundColor:
                                '#ec4899'
                            }}
                          />
                          <span>
                            Perempuan
                          </span>
                        </div>

                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap:
                              '0.45rem'
                          }}
                        >
                          <span
                            style={{
                              width:
                                '10px',
                              height:
                                '10px',
                              borderRadius:
                                '50%',
                              backgroundColor:
                                '#3b82f6'
                            }}
                          />
                          <span>
                            Laki-laki
                          </span>
                        </div>

                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap:
                              '0.45rem'
                          }}
                        >
                          <span
                            style={{
                              width:
                                '10px',
                              height:
                                '10px',
                              borderRadius:
                                '50%',
                              backgroundColor:
                                '#94a3b8'
                            }}
                          />
                          <span>
                            Tidak ada
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    backgroundColor:
                      '#ffffff',
                    borderRadius:
                      '12px',
                    padding:
                      '1.5rem',
                    boxShadow:
                      '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <h3
                    style={{
                      margin:
                        '0 0 1rem',
                      fontSize:
                        '0.95rem',
                      color:
                        '#1e293b'
                    }}
                  >
                    Grafik Berdasarkan Kelas
                  </h3>

                  {rekapKelas.length ===
                  0 ? (
                    <p
                      style={{
                        color:
                          '#94a3b8',
                        fontSize:
                          '0.85rem'
                      }}
                    >
                      Belum ada data.
                    </p>
                  ) : (
                    rekapKelas.map(
                      ([
                        label,
                        total
                      ]) => (
                        <div
                          key={
                            label
                          }
                          style={{
                            marginBottom:
                              '0.8rem'
                          }}
                        >
                          <div
                            style={{
                              display:
                                'flex',
                              justifyContent:
                                'space-between',
                              fontSize:
                                '0.78rem',
                              color:
                                '#475569',
                              marginBottom:
                                '4px'
                            }}
                          >
                            <span>
                              {label}
                            </span>
                            <strong>
                              {total}
                            </strong>
                          </div>

                          <div
                            style={{
                              height:
                                '12px',
                              backgroundColor:
                                '#e2e8f0',
                              borderRadius:
                                '999px',
                              overflow:
                                'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${
                                  (total /
                                    Math.max(
                                      ...rekapKelas.map(
                                        (
                                          item
                                        ) =>
                                          item[1]
                                      )
                                    )) *
                                  100
                                }%`,
                                height:
                                  '100%',
                                backgroundColor:
                                  '#6366f1',
                                borderRadius:
                                  '999px'
                              }}
                            />
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

              {/* GRAFIK MINGGUAN */}
              <div
                style={{
                  backgroundColor:
                    '#ffffff',
                  borderRadius:
                    '12px',
                  padding:
                    '1.5rem 2rem',
                  boxShadow:
                    '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    gap: '1rem',
                    flexWrap:
                      'wrap'
                  }}
                >
                  <h3
                    style={{
                      margin:
                        '0 0 4px',
                      fontSize:
                        '0.95rem',
                      color:
                        '#1e293b'
                    }}
                  >
                    Grafik Mingguan:{' '}
                    {
                      tanggalAwalGrafik
                    }{' '}
                    sampai{' '}
                    {
                      tanggalAkhirGrafik
                    }
                  </h3>
                </div>

                <p
                  style={{
                    margin:
                      '0 0 1.5rem',
                    fontSize:
                      '0.75rem',
                    color:
                      '#64748b'
                  }}
                >
                  Jumlah pengajuan dalam{' '}
                  {
                    rekapMingguan.length
                  }{' '}
                  minggu pada{' '}
                  {
                    namaBulan[
                      bulanLaporanNomor -
                        1
                    ]
                  }{' '}
                  {tahunLaporan}.
                </p>

                <div
                  style={{
                    position:
                      'relative',
                    height:
                      '190px',
                    display:
                      'flex',
                    alignItems:
                      'flex-end',
                    gap: '1rem',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius:
                      '8px',
                    backgroundImage:
                      'linear-gradient(to bottom, transparent 24.5%, #e2e8f0 25%, transparent 25.5%), linear-gradient(to bottom, transparent 49.5%, #e2e8f0 50%, transparent 50.5%), linear-gradient(to bottom, transparent 74.5%, #e2e8f0 75%, transparent 75.5%)',
                    padding:
                      '0 1rem 0.5rem 2.25rem'
                  }}
                >
                  {Array.from(
                    {
                      length:
                        maxMingguan +
                        1
                    },
                    (
                      _,
                      index
                    ) =>
                      maxMingguan -
                      index
                  ).map(
                    (nilai) => (
                      <span
                        key={
                          nilai
                        }
                        style={{
                          position:
                            'absolute',
                          left:
                            '0.45rem',
                          bottom: `${
                            (nilai /
                              maxMingguan) *
                            100
                          }%`,
                          transform:
                            'translateY(50%)',
                          fontSize:
                            '0.68rem',
                          color:
                            '#94a3b8'
                        }}
                      >
                        {nilai}
                      </span>
                    )
                  )}

                  {rekapMingguan.map(
                    (minggu) => {
                      const total =
                        minggu.data
                          .length;

                      const jumlahWarna =
                        hitungWarnaIzin(
                          minggu.data
                        );

                      const barHeight =
                        total
                          ? Math.max(
                              (total /
                                maxMingguan) *
                                82,
                              10
                            )
                          : 0;

                      return (
                        <div
                          key={
                            minggu.label
                          }
                          onClick={() =>
                            setHariTerpilih(
                              minggu.label
                            )
                          }
                          onMouseEnter={() =>
                            setGrafikHover(
                              {
                                key: `hari-${minggu.label}`,
                                label:
                                  minggu.label,
                                total
                              }
                            )
                          }
                          onMouseLeave={() =>
                            setGrafikHover(
                              null
                            )
                          }
                          style={{
                            position:
                              'relative',
                            flex: 1,
                            height:
                              '100%',
                            display:
                              'flex',
                            flexDirection:
                              'column',
                            justifyContent:
                              'flex-end',
                            alignItems:
                              'center',
                            cursor:
                              'pointer'
                          }}
                        >
                          {grafikHover?.key ===
                            `hari-${minggu.label}` && (
                            <span
                              style={{
                                position:
                                  'absolute',
                                bottom: `${Math.max(
                                  barHeight +
                                    8,
                                  18
                                )}%`,
                                zIndex: 3,
                                padding:
                                  '6px 9px',
                                borderRadius:
                                  '7px',
                                backgroundColor:
                                  '#0f172a',
                                color:
                                  '#ffffff',
                                fontSize:
                                  '0.68rem',
                                whiteSpace:
                                  'nowrap',
                                boxShadow:
                                  '0 5px 12px rgba(15,23,42,0.22)',
                                pointerEvents:
                                  'none'
                              }}
                            >
                              {
                                minggu.label
                              }
                              <br />
                              <strong>
                                {
                                  total
                                }{' '}
                                izin
                              </strong>
                            </span>
                          )}

                          <div
                            style={{
                              width:
                                'min(52px, 80%)',
                              height: `${barHeight}%`,
                              minHeight:
                                barHeight >
                                0
                                  ? '4px'
                                  : '0',
                              display:
                                'flex',
                              flexDirection:
                                'column',
                              overflow:
                                'hidden',
                              borderRadius:
                                '5px 5px 0 0'
                            }}
                          >
                            <div
                              style={{
                                height: `${
                                  total
                                    ? (jumlahWarna.izin /
                                        total) *
                                      100
                                    : 0
                                }%`,
                                minHeight:
                                  jumlahWarna.izin >
                                  0
                                    ? '3px'
                                    : '0',
                                backgroundColor:
                                  '#2563eb'
                              }}
                            />

                            <div
                              style={{
                                height: `${
                                  total
                                    ? (jumlahWarna.sakit /
                                        total) *
                                      100
                                    : 0
                                }%`,
                                minHeight:
                                  jumlahWarna.sakit >
                                  0
                                    ? '3px'
                                    : '0',
                                backgroundColor:
                                  '#16a34a'
                              }}
                            />
                          </div>

                          <span
                            style={{
                              marginTop:
                                '8px',
                              fontSize:
                                '0.72rem',
                              color:
                                '#64748b'
                            }}
                          >
                            {
                              minggu.label
                            }
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>

                {hariTerpilih && (
                  <div
                    style={{
                      overflowX:
                        'auto',
                      marginTop:
                        '1.5rem'
                    }}
                  >
                    <h4
                      style={{
                        margin:
                          '0 0 0.75rem',
                        fontSize:
                          '0.9rem',
                        color:
                          '#1e293b'
                      }}
                    >
                      Detail{' '}
                      {
                        hariTerpilih
                      }
                    </h4>

                    <table
                      style={{
                        width:
                          '100%',
                        borderCollapse:
                          'collapse',
                        fontSize:
                          '0.8rem'
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor:
                              '#f8fafc',
                            color:
                              '#475569'
                          }}
                        >
                          <th
                            style={{
                              padding:
                                '0.7rem',
                              textAlign:
                                'left'
                            }}
                          >
                            Nama
                          </th>

                          <th
                            style={{
                              padding:
                                '0.7rem',
                              textAlign:
                                'left'
                            }}
                          >
                            Kelas
                          </th>

                          <th
                            style={{
                              padding:
                                '0.7rem',
                              textAlign:
                                'left'
                            }}
                          >
                            Tanggal
                          </th>

                          <th
                            style={{
                              padding:
                                '0.7rem',
                              textAlign:
                                'center'
                            }}
                          >
                            Total
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {dataHariTerpilih.map(
                          (
                            item,
                            index
                          ) => (
                            <tr
                              key={`${hariTerpilih}-${item.id_pengajuan || index}`}
                            >
                              <td
                                style={{
                                  padding:
                                    '0.7rem',
                                  borderTop:
                                    '1px solid #f1f5f9'
                                }}
                              >
                                {
                                  item.nama_lengkap
                                }
                              </td>

                              <td
                                style={{
                                  padding:
                                    '0.7rem',
                                  borderTop:
                                    '1px solid #f1f5f9'
                                }}
                              >
                                {
                                  item.kelas
                                }
                              </td>

                              <td
                                style={{
                                  padding:
                                    '0.7rem',
                                  borderTop:
                                    '1px solid #f1f5f9'
                                }}
                              >
                                {item.tanggalList.join(
                                  ', '
                                )}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '0.7rem',
                                  textAlign:
                                    'center',
                                  borderTop:
                                    '1px solid #f1f5f9'
                                }}
                              >
                                {
                                  item.total
                                }
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>

                    {dataHariTerpilih.length ===
                      0 && (
                      <p
                        style={{
                          color:
                            '#94a3b8',
                          textAlign:
                            'center',
                          fontSize:
                            '0.85rem'
                        }}
                      >
                        Belum ada data pada hari ini.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* GRAFIK BULANAN */}
              <div
                style={{
                  backgroundColor:
                    '#ffffff',
                  borderRadius:
                    '12px',
                  padding:
                    '1.5rem 2rem',
                  boxShadow:
                    '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <h3
                  style={{
                    margin:
                      '0 0 4px',
                    fontSize:
                      '0.95rem',
                    color:
                      '#1e293b'
                  }}
                >
                  Grafik Bulanan
                </h3>

                <p
                  style={{
                    margin:
                      '0 0 1rem',
                    fontSize:
                      '0.75rem',
                    color:
                      '#64748b'
                  }}
                >
                  Klik titik bulan untuk melihat tabel detail pengajuan.
                </p>

                <div
                  style={{
                    overflowX:
                      'auto'
                  }}
                >
                  <svg
                    viewBox="0 0 740 220"
                    width="100%"
                    height="220"
                    role="img"
                    aria-label="Grafik jumlah izin bulanan"
                    style={{
                      minWidth:
                        '680px',
                      overflow:
                        'visible'
                    }}
                  >
                    <line
                      x1="20"
                      y1="40"
                      x2="20"
                      y2="170"
                      stroke="#cbd5e1"
                    />

                    <line
                      x1="20"
                      y1="170"
                      x2="710"
                      y2="170"
                      stroke="#cbd5e1"
                    />

                    <line
                      x1="20"
                      y1="105"
                      x2="710"
                      y2="105"
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                    />

                    <line
                      x1="20"
                      y1="40"
                      x2="710"
                      y2="40"
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                    />

                    <text
                      x="4"
                      y="44"
                      fontSize="10"
                      fill="#94a3b8"
                    >
                      {maxBulanan}
                    </text>

                    <text
                      x="4"
                      y="109"
                      fontSize="10"
                      fill="#94a3b8"
                    >
                      {Math.ceil(
                        maxBulanan /
                          2
                      )}
                    </text>

                    <text
                      x="8"
                      y="174"
                      fontSize="10"
                      fill="#94a3b8"
                    >
                      0
                    </text>

                    <path
                      d={
                        jalurBulanan
                      }
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {rekapBulanan.map(
                      (bulan) => {
                        const x =
                          20 +
                          bulan.index *
                            60;

                        const y =
                          170 -
                          (bulan.data
                            .length /
                            maxBulanan) *
                            130;

                        return (
                          <g
                            key={
                              bulan.nama
                            }
                            onClick={() =>
                              setBulanTerpilih(
                                bulan.index
                              )
                            }
                            onMouseEnter={() =>
                              setGrafikHover(
                                {
                                  key: `bulan-${bulan.index}`,
                                  label:
                                    bulan.nama,
                                  total:
                                    bulan.data
                                      .length
                                }
                              )
                            }
                            onMouseLeave={() =>
                              setGrafikHover(
                                null
                              )
                            }
                            style={{
                              cursor:
                                'pointer'
                            }}
                          >
                            <circle
                              cx={x}
                              cy={y}
                              r="6"
                              fill="#f59e0b"
                              stroke="#ffffff"
                              strokeWidth="2"
                            />

                            <text
                              x={x}
                              y="195"
                              textAnchor="middle"
                              fontSize="10"
                              fill="#64748b"
                            >
                              {bulan.nama.slice(
                                0,
                                3
                              )}
                            </text>

                            {grafikHover?.key ===
                              `bulan-${bulan.index}` && (
                              <g>
                                <rect
                                  x={
                                    x -
                                    38
                                  }
                                  y={Math.max(
                                    y -
                                      38,
                                    2
                                  )}
                                  width="76"
                                  height="28"
                                  rx="6"
                                  fill="#0f172a"
                                />

                                <text
                                  x={x}
                                  y={Math.max(
                                    y -
                                      20,
                                    20
                                  )}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#ffffff"
                                >
                                  {
                                    bulan
                                      .nama
                                  }
                                  :{' '}
                                  {
                                    bulan
                                      .data
                                      .length
                                  }
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      }
                    )}
                  </svg>
                </div>

                {bulanTerpilih !==
                  null && (
                  <div
                    style={{
                      overflowX:
                        'auto',
                      marginTop:
                        '1rem'
                    }}
                  >
                    <h4
                      style={{
                        margin:
                          '0 0 0.75rem',
                        fontSize:
                          '0.9rem',
                        color:
                          '#1e293b'
                      }}
                    >
                      Detail Bulan{' '}
                      {
                        namaBulan[
                          bulanTerpilih
                        ]
                      }
                    </h4>

                    <table
                      style={{
                        width:
                          '100%',
                        borderCollapse:
                          'collapse',
                        fontSize:
                          '0.8rem'
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor:
                              '#f8fafc',
                            color:
                              '#475569'
                          }}
                        >
                          <th
                            style={{
                              padding:
                                '0.7rem',
                              textAlign:
                                'left'
                            }}
                          >
                            Nama
                          </th>

                          <th
                            style={{
                              padding:
                                '0.7rem',
                              textAlign:
                                'left'
                            }}
                          >
                            Kelas
                          </th>

                          <th
                            style={{
                              padding:
                                '0.7rem',
                              textAlign:
                                'left'
                            }}
                          >
                            Tanggal
                          </th>

                          <th
                            style={{
                              padding:
                                '0.7rem',
                              textAlign:
                                'center'
                            }}
                          >
                            Total
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {dataBulanTerpilih.map(
                          (
                            item,
                            index
                          ) => (
                            <tr
                              key={`bulan-${item.id_pengajuan || index}`}
                            >
                              <td
                                style={{
                                  padding:
                                    '0.7rem',
                                  borderTop:
                                    '1px solid #f1f5f9'
                                }}
                              >
                                {
                                  item.nama_lengkap
                                }
                              </td>

                              <td
                                style={{
                                  padding:
                                    '0.7rem',
                                  borderTop:
                                    '1px solid #f1f5f9'
                                }}
                              >
                                {
                                  item.kelas
                                }
                              </td>

                              <td
                                style={{
                                  padding:
                                    '0.7rem',
                                  borderTop:
                                    '1px solid #f1f5f9'
                                }}
                              >
                                {item.tanggalList?.join(', ') || '-'}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '0.7rem',
                                  textAlign:
                                    'center',
                                  borderTop:
                                    '1px solid #f1f5f9'
                                }}
                              >
                                {item.total}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>

                    {dataBulanTerpilih.length ===
                      0 && (
                      <p
                        style={{
                          color:
                            '#94a3b8',
                          textAlign:
                            'center',
                          fontSize:
                            '0.85rem'
                        }}
                      >
                        Belum ada data pada bulan ini.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ================= SEMUA RIWAYAT ================= */}
              <div
                style={{
                  backgroundColor:
                    '#ffffff',
                  borderRadius:
                    '12px',
                  padding:
                    '1.5rem 2rem',
                  boxShadow:
                    '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    marginBottom:
                      '1.5rem'
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin:
                          '0 0 4px 0',
                        fontSize:
                          '1rem',
                        fontWeight:
                          'bold',
                        color:
                          '#1e293b'
                      }}
                    >
                      Semua Riwayat Pengajuan Izin
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize:
                          '0.75rem',
                        color:
                          '#64748b'
                      }}
                    >
                      Daftar keseluruhan data izin yang masuk ke sistem.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setDaftarIzin([
                        ...daftarIzin
                      ])
                    }
                    style={{
                      backgroundColor:
                        '#f8fafc',
                      border:
                        '1px solid #cbd5e1',
                      color:
                        '#334155',
                      padding:
                        '0.4rem 0.8rem',
                      borderRadius:
                        '6px',
                      fontSize:
                        '0.8rem',
                      cursor:
                        'pointer',
                      fontWeight:
                        '500'
                    }}
                  >
                    Muat Ulang
                  </button>
                </div>

                {daftarIzin.length ===
                0 ? (
                  <p
                    style={{
                      color:
                        '#64748b',
                      fontSize:
                        '0.85rem',
                      textAlign:
                        'center',
                      padding:
                        '2rem 0'
                    }}
                  >
                    Belum ada data izin yang tersedia.
                  </p>
                ) : (
                  <div
                    style={{
                      display:
                        'flex',
                      flexDirection:
                        'column',
                      gap: '1rem'
                    }}
                  >
                    {daftarIzin.map(
                      (item) => (
                        <div
                          key={
                            item.id_pengajuan
                          }
                          style={{
                            border:
                              '1px solid #e2e8f0',
                            borderRadius:
                              '8px',
                            padding:
                              '1rem 1.25rem',
                            backgroundColor:
                              '#ffffff',
                            display:
                              'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'center'
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                gap: '8px',
                                marginBottom:
                                  '6px'
                              }}
                            >
                              <span
                                style={{
                                  fontWeight:
                                    'bold',
                                  fontSize:
                                    '0.9rem',
                                  color:
                                    '#0f172a',
                                  textTransform:
                                    'lowercase'
                                }}
                              >
                                {
                                  item.nama_lengkap
                                }
                              </span>

                              <span
                                style={{
                                  backgroundColor:
                                    '#f1f5f9',
                                  color:
                                    '#334155',
                                  fontSize:
                                    '0.7rem',
                                  padding:
                                    '2px 6px',
                                  borderRadius:
                                    '4px',
                                  fontWeight:
                                    'bold'
                                }}
                              >
                                {
                                  item.kelas
                                }
                              </span>

                              <span
                                style={{
                                  ...gayaBadgeJenisKelamin(
                                    item.jenis_kelamin ||
                                      item.gender
                                  ),
                                  fontSize:
                                    '0.7rem',
                                  padding:
                                    '2px 8px',
                                  borderRadius:
                                    '10px',
                                  fontWeight:
                                    'bold'
                                }}
                              >
                                {item.jenis_kelamin ||
                                  item.gender ||
                                  '-'}
                              </span>

                              <span
                                style={{
                                  backgroundColor:
                                    isSakit(
                                      item.jenis_izin
                                    )
                                      ? '#dcfce7'
                                      : '#dbeafe',
                                  color:
                                    isSakit(
                                      item.jenis_izin
                                    )
                                      ? '#166534'
                                      : '#1d4ed8',
                                  fontSize:
                                    '0.7rem',
                                  padding:
                                    '2px 8px',
                                  borderRadius:
                                    '10px',
                                  fontWeight:
                                    'bold'
                                }}
                              >
                                {
                                  item.jenis_izin
                                }
                              </span>

                              <span
                                style={{
                                  backgroundColor:
                                    statusPengajuan(
                                      item.status
                                    ) ===
                                    'Disetujui'
                                      ? '#dcfce7'
                                      : statusPengajuan(
                                          item.status
                                        ) ===
                                        'Ditolak'
                                      ? '#fee2e2'
                                      : '#fef3c7',
                                  color:
                                    statusPengajuan(
                                      item.status
                                    ) ===
                                    'Disetujui'
                                      ? '#166534'
                                      : statusPengajuan(
                                          item.status
                                        ) ===
                                        'Ditolak'
                                      ? '#991b1b'
                                      : '#92400e',
                                  fontSize:
                                    '0.7rem',
                                  padding:
                                    '2px 8px',
                                  borderRadius:
                                    '10px',
                                  fontWeight:
                                    'bold'
                                }}
                              >
                                {statusPengajuan(
                                  item.status
                                )}
                              </span>
                            </div>

                            <div
                              style={{
                                fontSize:
                                  '0.8rem',
                                color:
                                  '#475569',
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                gap: '10px'
                              }}
                            >
                              <span>
                                📅{' '}
                                {
                                  item.tanggal
                                }
                              </span>

                              <span>
                                ⏰{' '}
                                {
                                  item.waktu_mulai
                                }{' '}
                                -{' '}
                                {
                                  item.waktu_selesai
                                }
                              </span>
                            </div>

                            <div
                              style={{
                                fontSize:
                                  '0.75rem',
                                color:
                                  '#64748b',
                                fontStyle:
                                  'italic',
                                marginTop:
                                  '4px'
                              }}
                            >
                              "
                              {item.keterangan ||
                                item.alasan}
                              "
                            </div>
                          </div>

                          <div
                            style={{
                              display:
                                'flex',
                              gap: '0.5rem'
                            }}
                          >
                            {/* ================= TOMBOL EDIT ================= */}
                            <button
                              onClick={() => {
                                setIsEditing(
                                  true
                                );

                                setIdYangDiedit(
                                  item.id_pengajuan
                                );

                                setNamaLengkap(
                                  item.nama_lengkap ||
                                    ''
                                );

                                setKelas(
                                  item.kelas ||
                                    ''
                                );

                                setJenisKelamin(
                                  item.jenis_kelamin ||
                                    'Laki-laki'
                                );

                                setJenisIzin(
                                  item.jenis_izin ||
                                    'Keluar Sekolah'
                                );

                                setAlasan(
                                  item.alasan ||
                                    item.keterangan ||
                                    ''
                                );

                                setTanggal(
                                  normalisasiTanggal(
                                    item.tanggal
                                  )
                                );

                                setWaktuMulai(
                                  item.waktu_mulai ||
                                    ''
                                );

                                setWaktuSelesai(
                                  item.waktu_selesai ||
                                    ''
                                );

                                setActiveMenu(
                                  'pengajuan'
                                );
                              }}
                              style={{
                                backgroundColor:
                                  '#fef08a',
                                color:
                                  '#713f12',
                                border:
                                  'none',
                                padding:
                                  '0.35rem 0.75rem',
                                borderRadius:
                                  '6px',
                                fontSize:
                                  '0.75rem',
                                cursor:
                                  'pointer',
                                fontWeight:
                                  'bold'
                              }}
                            >
                              Edit
                            </button>

                            <button
                              onClick={() =>
                                handleHapus(
                                  item.id_pengajuan
                                )
                              }
                              style={{
                                backgroundColor:
                                  '#fee2e2',
                                color:
                                  '#991b1b',
                                border:
                                  'none',
                                padding:
                                  '0.35rem 0.75rem',
                                borderRadius:
                                  '6px',
                                fontSize:
                                  '0.75rem',
                                cursor:
                                  'pointer',
                                fontWeight:
                                  'bold'
                              }}
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      )
                    )}
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
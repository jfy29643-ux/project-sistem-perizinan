import React, { useEffect, useState } from "react";
import { PENGAJUAN_API_URL as API_URL, authFetch } from './apiConfig';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  GraduationCap,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
  Bell,
  UserCog,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardList,
  School,
  UserRoundCheck,
  RefreshCw,
  BarChart3,
} from "lucide-react";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [roleOpen, setRoleOpen] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");

  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentRole, setCurrentRole] = useState({
    name: "Admin",
    description: "Administrator",
    icon: <UserCog size={19} />,
    color: "#4f46e5",
  });

  /*
   * ==========================================================
   * CEK LOGIN
   * ==========================================================
   */

  const checkAuthentication = () => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    const role = localStorage.getItem("role");
    const isLoggedIn = localStorage.getItem("isLoggedIn");

    const sessionToken =
      sessionStorage.getItem("token");

    const sessionUser =
      sessionStorage.getItem("user");

    const sessionRole =
      sessionStorage.getItem("role");

    const sessionIsLoggedIn =
      sessionStorage.getItem("isLoggedIn");

    return Boolean(
      token ||
      user ||
      role ||
      isLoggedIn === "true" ||
      sessionToken ||
      sessionUser ||
      sessionRole ||
      sessionIsLoggedIn === "true"
    );
  };

  /*
   * ==========================================================
   * LOGOUT
   * ==========================================================
   */

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      localStorage.removeItem("isLoggedIn");

      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("currentRole");

      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("isLoggedIn");

      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("currentUser");
      sessionStorage.removeItem("currentRole");

      setRoleOpen(false);

      window.location.replace("/login");
    } catch (err) {
      console.error("Logout gagal:", err);
      window.location.replace("/login");
    }
  };

  /*
   * ==========================================================
   * ROLE
   * ==========================================================
   */

  const roles = [
    {
      name: "Admin",
      description: "Kelola seluruh sistem",
      icon: <UserCog size={19} />,
      color: "#4f46e5",
      page: "dashboard",
    },
    {
      name: "Guru",
      description: "Kelola perizinan siswa",
      icon: <Users size={19} />,
      color: "#0891b2",
      page: "guru",
    },
    {
      name: "Satpam",
      description: "Kontrol izin keluar masuk",
      icon: <ShieldCheck size={19} />,
      color: "#7c3aed",
      page: "satpam",
    },
    {
      name: "Siswa",
      description: "Ajukan dan lihat perizinan",
      icon: <GraduationCap size={19} />,
      color: "#059669",
      page: "siswa",
    },
  ];

  /*
   * ==========================================================
   * AMBIL DATA PENGAJUAN (PORT 5002)
   * ==========================================================
   */

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authFetch(`${API_URL}/pengajuan`);

      if (!response.ok) {
        throw new Error(
          `Gagal mengambil data (${response.status})`
        );
      }

      const result = await response.json();

      let data = [];

      if (Array.isArray(result)) {
        data = result;
      } else if (Array.isArray(result.data)) {
        data = result.data;
      } else if (Array.isArray(result.perizinan)) {
        data = result.perizinan;
      }

      setPermissions(data);
    } catch (err) {
      console.error(err);

      setError(
        "Data pengajuan belum dapat dimuat."
      );

      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================================
   * CEK LOGIN KETIKA DASHBOARD DIBUKA
   * ==========================================================
   */

  useEffect(() => {
    const authenticated = checkAuthentication();

    if (!authenticated) {
      window.location.replace("/login");
      return;
    }

    loadPermissions();
  }, []);

  /*
   * ==========================================================
   * NORMALISASI DATA
   * ==========================================================
   */

  const normalizedPermissions = permissions.map(
    (item, index) => ({
      id:
        item.id ??
        item.id_pengajuan ??
        item.id_perizinan ??
        item.perizinan_id ??
        index,

      name:
        item.nama_lengkap ??
        item.name ??
        item.nama ??
        item.nama_siswa ??
        item.namaSiswa ??
        "Nama siswa",

      className:
        item.kelas ??
        item.className ??
        item.nama_kelas ??
        item.kelas_siswa ??
        "-",

      studentId:
        item.id_pengguna ??
        item.studentId ??
        item.nis ??
        item.nisn ??
        item.id_siswa ??
        "-",

      purpose:
        item.jenis_izin ??
        item.alasan ??
        item.purpose ??
        item.keperluan ??
        "-",

      time:
        item.waktu_mulai ??
        item.time ??
        item.waktu ??
        item.jam ??
        "-",

      status:
        item.status ??
        "pending",
    })
  );

  /*
   * ==========================================================
   * STATISTIK & PERSENTASE GRAFIK
   * ==========================================================
   */

  const totalPengajuan = normalizedPermissions.length;

  const menunggu = normalizedPermissions.filter((item) => {
    const value = String(item.status || "").toLowerCase();
    return value === "pending" || value === "menunggu" || value === "menunggu konfirmasi";
  }).length;

  const disetujui = normalizedPermissions.filter((item) => {
    const value = String(item.status || "").toLowerCase();
    return value === "approved" || value === "disetujui";
  }).length;

  const ditolak = normalizedPermissions.filter((item) => {
    const value = String(item.status || "").toLowerCase();
    return value === "rejected" || value === "ditolak";
  }).length;

  const percentDisetujui = totalPengajuan > 0 ? (disetujui / totalPengajuan) * 100 : 0;
  const percentMenunggu = totalPengajuan > 0 ? (menunggu / totalPengajuan) * 100 : 0;
  const percentDitolak = totalPengajuan > 0 ? (ditolak / totalPengajuan) * 100 : 0;

  /*
   * ==========================================================
   * STATUS
   * ==========================================================
   */

  const getStatus = (status) => {
    const value =
      String(status || "").toLowerCase();

    if (
      value === "approved" ||
      value === "disetujui"
    ) {
      return {
        className: "approved",
        text: "Disetujui",
      };
    }

    if (
      value === "rejected" ||
      value === "ditolak"
    ) {
      return {
        className: "rejected",
        text: "Ditolak",
      };
    }

    return {
      className: "pending",
      text: "Menunggu",
    };
  };

  /*
   * ==========================================================
   * ROLE
   * ==========================================================
   */

  const changeRole = (role) => {
    setCurrentRole(role);
    setRoleOpen(false);
    setActivePage(role.page);
  };

  const handleMenu = (page) => {
    setActivePage(page);
    setRoleOpen(false);
  };

  /*
   * ==========================================================
   * INITIAL
   * ==========================================================
   */

  const getInitial = (name) => {
    if (!name) return "?";

    return name
      .trim()
      .charAt(0)
      .toUpperCase();
  };

  return (
    <>
      <style>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: Inter, Arial, sans-serif;
          background: #f7f9fc;
          color: #172033;
        }

        button,
        input {
          font-family: inherit;
        }

        .dashboard-app {
          min-height: 100vh;
          background: #f7f9fc;
        }

        /* ==================================================
           SIDEBAR
        ================================================== */

        .dashboard-sidebar {
          position: fixed;
          z-index: 100;
          top: 0;
          left: 0;
          bottom: 0;

          width: 300px;

          background: #ffffff;
          border-right: 1px solid #e5e7eb;

          display: flex;
          flex-direction: column;

          transition: all 0.25s ease;
        }

        .dashboard-sidebar.sidebar-closed {
          width: 84px;
        }

        .school-header {
          height: 115px;

          padding: 22px 25px;

          display: flex;
          align-items: center;

          gap: 13px;

          border-bottom: 1px solid #edf0f4;
        }

        .sidebar-closed .school-header {
          justify-content: center;
          padding: 20px 10px;
        }

        .school-logo {
          width: 54px;
          height: 54px;

          flex-shrink: 0;

          border-radius: 14px;

          overflow: hidden;

          background: #eef2ff;

          display: flex;
          align-items: center;
          justify-content: center;

          color: #4f46e5;
        }

        .school-logo img {
          width: 100%;
          height: 100%;

          object-fit: contain;
          padding: 4px;
        }

        .school-title {
          min-width: 0;
        }

        .school-title h2 {
          margin: 0 0 5px;

          color: #172033;

          font-size: 16px;
          font-weight: 800;

          white-space: nowrap;
        }

        .school-title p {
          margin: 0;

          color: #718096;

          font-size: 11px;

          white-space: nowrap;
        }

        /* ==================================================
           MENU
        ================================================== */

        .sidebar-menu {
          flex: 1;

          padding: 25px 17px;

          overflow-y: auto;
        }

        .menu-label {
          margin: 3px 8px 11px;

          color: #94a3b8;

          font-size: 9px;

          font-weight: 800;

          letter-spacing: 0.08em;
        }

        .menu-spacing {
          margin-top: 28px;
        }

        .sidebar-closed .menu-label {
          display: none;
        }

        .sidebar-menu-item {
          width: 100%;
          height: 52px;

          margin-bottom: 5px;

          padding: 0 16px;

          border: none;
          border-radius: 12px;

          background: transparent;

          color: #64748b;

          display: flex;
          align-items: center;

          gap: 14px;

          font-size: 13px;
          font-weight: 600;

          cursor: pointer;

          transition: all 0.2s ease;
        }

        .sidebar-closed .sidebar-menu-item {
          justify-content: center;
          padding: 0;
        }

        .sidebar-menu-item:hover {
          color: #4f46e5;
          background: #f4f4ff;
        }

        .sidebar-menu-item.active {
          color: #ffffff;

          background: linear-gradient(
            135deg,
            #5748eb,
            #493be0
          );

          box-shadow:
            0 8px 20px
            rgba(79, 70, 229, 0.22);
        }

        /* ==================================================
           LOGOUT
        ================================================== */

        .sidebar-bottom {
          padding: 17px;

          border-top: 1px solid #edf0f4;
        }

        .logout-button {
          width: 100%;
          height: 50px;

          padding: 0 16px;

          border: none;
          border-radius: 12px;

          background: transparent;

          color: #dc2626;

          display: flex;
          align-items: center;

          gap: 13px;

          font-size: 13px;
          font-weight: 600;

          cursor: pointer;

          transition: all 0.2s ease;
        }

        .logout-button:hover {
          background: #fef2f2;
        }

        .logout-button:active {
          transform: scale(0.98);
        }

        .sidebar-closed .logout-button {
          justify-content: center;
          padding: 0;
        }

        /* ==================================================
           MAIN
        ================================================== */

        .dashboard-main {
          min-height: 100vh;

          margin-left: 300px;

          transition: margin-left 0.25s ease;
        }

        .dashboard-main.main-sidebar-closed {
          margin-left: 84px;
        }

        /* ==================================================
           TOPBAR
        ================================================== */

        .dashboard-topbar {
          position: sticky;
          top: 0;

          z-index: 50;

          height: 92px;

          padding: 0 32px;

          background: #ffffff;

          border-bottom: 1px solid #e5e7eb;

          display: flex;
          align-items: center;

          justify-content: space-between;
        }

        .topbar-left {
          display: flex;
          align-items: center;

          gap: 16px;

          min-width: 0;
        }

        .sidebar-toggle {
          width: 43px;
          height: 43px;

          border: none;
          border-radius: 11px;

          background: #f1f5f9;

          color: #475569;

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;
        }

        .sidebar-toggle:hover {
          background: #e8edf3;
        }

        .topbar-title {
          min-width: 0;
        }

        .topbar-title h1 {
          margin: 0 0 4px;

          color: #111827;

          font-size: 19px;
          font-weight: 800;
        }

        .topbar-title p {
          margin: 0;

          color: #718096;

          font-size: 11px;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: ellipsis;
        }

        .topbar-right {
          display: flex;
          align-items: center;

          gap: 13px;
        }

        .notification-button {
          position: relative;

          width: 42px;
          height: 42px;

          border: none;
          border-radius: 10px;

          background: transparent;

          color: #64748b;

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;
        }

        .notification-button:hover {
          background: #f8fafc;
        }

        .notification-dot {
          position: absolute;

          top: 7px;
          right: 7px;

          width: 8px;
          height: 8px;

          border-radius: 50%;

          background: #ef4444;

          border: 2px solid white;
        }

        /* ==================================================
           ROLE
        ================================================== */

        .role-switcher {
          position: relative;
        }

        .role-current {
          min-width: 195px;
          height: 50px;

          padding: 5px 9px 5px 6px;

          border: 1px solid #e5e7eb;

          border-radius: 12px;

          background: white;

          display: flex;
          align-items: center;

          gap: 9px;

          cursor: pointer;
        }

        .role-current-icon {
          width: 37px;
          height: 37px;

          border-radius: 9px;

          flex-shrink: 0;

          color: white;

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .role-current-text {
          flex: 1;

          min-width: 0;

          display: flex;
          flex-direction: column;

          align-items: flex-start;
        }

        .role-current-text strong {
          color: #1e293b;

          font-size: 11px;
        }

        .role-current-text small {
          margin-top: 2px;

          color: #94a3b8;

          font-size: 9px;
        }

        .role-dropdown {
          position: absolute;

          z-index: 500;

          top: 59px;
          right: 0;

          width: 320px;

          padding: 9px;

          border: 1px solid #e5e7eb;

          border-radius: 14px;

          background: white;

          box-shadow:
            0 20px 50px
            rgba(15, 23, 42, 0.15);
        }

        .role-dropdown-header {
          padding: 10px;

          border-bottom: 1px solid #f1f5f9;
        }

        .role-dropdown-header strong {
          display: block;

          font-size: 12px;

          color: #1e293b;
        }

        .role-dropdown-header span {
          display: block;

          margin-top: 3px;

          color: #94a3b8;

          font-size: 9px;
        }

        .role-option {
          width: 100%;

          margin-top: 3px;

          padding: 9px;

          border: none;

          border-radius: 10px;

          background: transparent;

          display: flex;
          align-items: center;

          gap: 10px;

          text-align: left;

          cursor: pointer;
        }

        .role-option:hover {
          background: #f8fafc;
        }

        .role-option-active {
          background: #f5f5ff;
        }

        .role-option-icon {
          width: 38px;
          height: 38px;

          border-radius: 9px;

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .role-option-info {
          flex: 1;
        }

        .role-option-info strong {
          display: block;

          color: #1e293b;

          font-size: 11px;
        }

        .role-option-info span {
          display: block;

          margin-top: 3px;

          color: #94a3b8;

          font-size: 9px;
        }

        /* ==================================================
           CONTENT
        ================================================== */

        .dashboard-content {
          padding: 32px;
        }

        .dashboard-home {
          max-width: 1450px;

          margin: auto;
        }

        .content-heading {
          margin-bottom: 24px;

          display: flex;
          align-items: center;

          justify-content: space-between;

          gap: 20px;
        }

        .heading-left {
          display: flex;
          align-items: center;

          gap: 14px;
        }

        .heading-icon {
          width: 55px;
          height: 55px;

          flex-shrink: 0;

          border-radius: 14px;

          background: #eef2ff;

          color: #4f46e5;

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .content-heading h2 {
          margin: 0 0 5px;

          color: #111827;

          font-size: 20px;
        }

        .content-heading p {
          margin: 0;

          color: #718096;

          font-size: 11px;
        }

        .admin-access-badge {
          padding: 9px 13px;

          border: 1px solid #e5e7eb;

          border-radius: 20px;

          background: white;

          color: #475569;

          display: flex;
          align-items: center;

          gap: 7px;

          font-size: 10px;
        }

        .admin-access-badge span {
          width: 7px;
          height: 7px;

          border-radius: 50%;

          background: #10b981;
        }

        /* ==================================================
           STATISTICS
        ================================================== */

        .statistics-grid {
          display: grid;

          grid-template-columns:
            repeat(4, minmax(0, 1fr));

          gap: 15px;

          margin-bottom: 20px;
        }

        .statistic-card {
          min-height: 108px;

          padding: 19px;

          border: 1px solid #e5e9ef;

          border-radius: 14px;

          background: white;

          display: flex;
          align-items: center;

          gap: 14px;
        }

        .statistic-icon {
          width: 49px;
          height: 49px;

          flex-shrink: 0;

          border-radius: 12px;

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .statistic-info span {
          display: block;

          margin-bottom: 5px;

          color: #64748b;

          font-size: 10px;
        }

        .statistic-info strong {
          display: block;

          color: #111827;

          font-size: 24px;
        }

        /* ==================================================
           CARD
        ================================================== */

        .permission-card,
        .admin-chart-card {
          margin-bottom: 20px;

          border: 1px solid #e4e8ee;

          border-radius: 17px;

          background: white;

          overflow: hidden;
        }

        .section-header {
          padding: 20px 23px;

          border-bottom: 1px solid #edf0f4;

          display: flex;
          align-items: center;

          justify-content: space-between;
        }

        .section-header h3 {
          margin: 0 0 4px;

          color: #172033;

          font-size: 14px;
        }

        .section-header p {
          margin: 0;

          color: #94a3b8;

          font-size: 10px;
        }

        .section-header-icon {
          width: 41px;
          height: 41px;

          border-radius: 10px;

          background: #eef2ff;

          color: #4f46e5;

          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ==================================================
           ADMIN CHART (GRAFIK KHUSUS ADMIN)
        ================================================== */

        .admin-chart-body {
          padding: 22px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .chart-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
        }

        .chart-box-title {
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .chart-item {
          margin-bottom: 12px;
        }

        .chart-item:last-child {
          margin-bottom: 0;
        }

        .chart-meta {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 5px;
        }

        .chart-bar-bg {
          width: 100%;
          height: 9px;
          background: #e2e8f0;
          border-radius: 5px;
          overflow: hidden;
        }

        .chart-bar-fill {
          height: 100%;
          border-radius: 5px;
          transition: width 0.5s ease;
        }

        /* ==================================================
           PERMISSION LIST
        ================================================== */

        .permission-list {
          padding: 4px 19px 18px;
        }

        .permission-item {
          min-height: 75px;

          border-bottom: 1px solid #f1f5f9;

          display: flex;
          align-items: center;

          gap: 13px;
        }

        .permission-item:last-child {
          border-bottom: none;
        }

        .student-avatar {
          width: 42px;
          height: 42px;

          flex-shrink: 0;

          border-radius: 50%;

          background: #eef2ff;

          color: #4f46e5;

          display: flex;
          align-items: center;
          justify-content: center;

          font-size: 13px;
          font-weight: 800;
        }

        .student-information {
          flex: 1.5;

          min-width: 0;
        }

        .student-information strong {
          display: block;

          margin-bottom: 3px;

          color: #1e293b;

          font-size: 11px;
        }

        .student-information span {
          display: block;

          color: #94a3b8;

          font-size: 9px;
        }

        .permission-purpose {
          flex: 1;

          min-width: 0;
        }

        .permission-purpose span {
          display: block;

          margin-bottom: 3px;

          color: #94a3b8;

          font-size: 8px;
        }

        .permission-purpose strong {
          color: #334155;

          font-size: 9px;
        }

        .permission-time {
          width: 60px;

          color: #64748b;

          display: flex;
          align-items: center;

          gap: 4px;

          font-size: 9px;
        }

        .permission-status {
          min-width: 80px;

          padding: 6px 8px;

          border-radius: 20px;

          text-align: center;

          font-size: 8px;
          font-weight: 700;
        }

        .permission-status.approved {
          color: #059669;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
        }

        .permission-status.pending {
          color: #d97706;
          background: #fffbeb;
          border: 1px solid #fde68a;
        }

        .permission-status.rejected {
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        /* ==================================================
           EMPTY
        ================================================== */

        .empty-state {
          padding: 50px 20px;

          text-align: center;

          color: #94a3b8;

          font-size: 12px;
        }

        .empty-state-icon {
          width: 50px;
          height: 50px;

          margin: 0 auto 12px;

          border-radius: 14px;

          background: #f1f5f9;

          color: #94a3b8;

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-state {
          padding: 50px;

          text-align: center;

          color: #64748b;

          font-size: 12px;
        }

        .loading-icon {
          margin-bottom: 10px;

          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ==================================================
           ERROR
        ================================================== */

        .error-box {
          margin-bottom: 20px;

          padding: 13px 15px;

          border: 1px solid #fecaca;

          border-radius: 11px;

          background: #fef2f2;

          color: #b91c1c;

          font-size: 11px;

          display: flex;
          align-items: center;

          justify-content: space-between;

          gap: 15px;
        }

        .refresh-button {
          padding: 7px 11px;

          border: 1px solid #fecaca;

          border-radius: 7px;

          background: white;

          color: #b91c1c;

          font-size: 10px;

          cursor: pointer;
        }

        /* ==================================================
           SETTINGS
        ================================================== */

        .settings-card {
          padding: 5px 23px 23px;
        }

        .setting {
          min-height: 85px;

          border-bottom: 1px solid #f1f5f9;

          display: flex;
          align-items: center;

          justify-content: space-between;

          gap: 20px;
        }

        .setting strong {
          display: block;

          margin-bottom: 4px;

          color: #1e293b;

          font-size: 11px;
        }

        .setting span {
          color: #94a3b8;

          font-size: 9px;
        }

        .setting input {
          width: 280px;
          height: 38px;

          padding: 0 11px;

          border: 1px solid #e2e8f0;

          border-radius: 8px;

          outline: none;

          font-size: 10px;
        }

        /* ==================================================
           RESPONSIVE
        ================================================== */

        @media (max-width: 1200px) {

          .dashboard-sidebar {
            width: 270px;
          }

          .dashboard-main {
            margin-left: 270px;
          }

          .statistics-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .admin-chart-body {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 850px) {

          .dashboard-sidebar {
            width: 270px;
          }

          .dashboard-sidebar.sidebar-closed {
            transform: translateX(-100%);
            width: 270px;
          }

          .dashboard-main,
          .dashboard-main.main-sidebar-closed {
            margin-left: 0;
          }

          .dashboard-topbar {
            padding: 0 18px;
          }

          .dashboard-content {
            padding: 20px;
          }

          .role-current {
            min-width: 45px;
            width: 45px;

            justify-content: center;

            padding: 5px;
          }

          .role-current-text {
            display: none;
          }

        }

        @media (max-width: 650px) {

          .dashboard-topbar {
            height: 76px;
          }

          .topbar-title h1 {
            font-size: 15px;
          }

          .topbar-title p {
            display: none;
          }

          .notification-button {
            display: none;
          }

          .dashboard-content {
            padding: 15px;
          }

          .statistics-grid {
            grid-template-columns: 1fr;
          }

          .content-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .role-dropdown {
            position: fixed;

            top: 68px;
            right: 12px;

            width: calc(100vw - 24px);
            max-width: 320px;
          }

          .permission-purpose,
          .permission-time {
            display: none;
          }

          .setting {
            align-items: flex-start;
            flex-direction: column;

            padding: 15px 0;
          }

          .setting input {
            width: 100%;
          }

        }

      `}</style>

      <div className="dashboard-app">

        {/* =====================================================
            SIDEBAR
        ===================================================== */}

        <aside
          className={`dashboard-sidebar ${
            sidebarOpen ? "" : "sidebar-closed"
          }`}
        >

          <div className="school-header">

            <div className="school-logo">

              <img
                src="/logo sekolah.jpeg"
                alt="Logo Sekolah"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />

              <School size={27} />

            </div>

            {sidebarOpen && (
              <div className="school-title">

                <h2>
                  Sistem Perizinan
                </h2>

                <p>
                  SMK Negeri Compreng
                </p>

              </div>
            )}

          </div>


          <div className="sidebar-menu">

            <div className="menu-label">
              MENU UTAMA
            </div>

            <button
              type="button"
              className={`sidebar-menu-item ${
                activePage === "dashboard"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleMenu("dashboard")
              }
            >
              <LayoutDashboard size={19} />

              {sidebarOpen && (
                <span>
                  Beranda
                </span>
              )}
            </button>


            <div className="menu-label menu-spacing">
              SISTEM
            </div>

            <button
              type="button"
              className={`sidebar-menu-item ${
                activePage === "settings"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleMenu("settings")
              }
            >
              <Settings size={19} />

              {sidebarOpen && (
                <span>
                  Pengaturan
                </span>
              )}
            </button>

          </div>


          {/* ===================================================
              LOGOUT
          =================================================== */}

          <div className="sidebar-bottom">

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              <LogOut size={19} />

              {sidebarOpen && (
                <span>
                  Keluar
                </span>
              )}
            </button>

          </div>

        </aside>


        {/* =====================================================
            MAIN
        ===================================================== */}

        <main
          className={`dashboard-main ${
            sidebarOpen
              ? ""
              : "main-sidebar-closed"
          }`}
        >

          {/* ===================================================
              TOPBAR
          =================================================== */}

          <header className="dashboard-topbar">

            <div className="topbar-left">

              <button
                type="button"
                className="sidebar-toggle"
                onClick={() =>
                  setSidebarOpen(
                    !sidebarOpen
                  )
                }
              >
                <Menu size={22} />
              </button>


              <div className="topbar-title">

                <h1>
                  {activePage === "dashboard"
                    ? "Administrator"
                    : activePage === "guru"
                    ? "Dashboard Guru Piket"
                    : activePage === "satpam"
                    ? "Dashboard Satpam"
                    : activePage === "siswa"
                    ? "Dashboard Siswa"
                    : "Pengaturan"}
                </h1>

                <p>
                  SMK Negeri Compreng —
                  Sistem Perizinan Siswa
                </p>

              </div>

            </div>


            <div className="topbar-right">

              <button
                type="button"
                className="notification-button"
              >
                <Bell size={19} />

                {menunggu > 0 && (
                  <span className="notification-dot" />
                )}
              </button>


              <div className="role-switcher">

                <button
                  type="button"
                  className="role-current"
                  onClick={() =>
                    setRoleOpen(!roleOpen)
                  }
                >

                  <div
                    className="role-current-icon"
                    style={{
                      background:
                        currentRole.color,
                    }}
                  >
                    {currentRole.icon}
                  </div>


                  <div className="role-current-text">

                    <strong>
                      {currentRole.name}
                    </strong>

                    <small>
                      {currentRole.description}
                    </small>

                  </div>


                  <ChevronRight
                    size={16}
                    style={{
                      transform:
                        roleOpen
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                    }}
                  />

                </button>


                {roleOpen && (

                  <div className="role-dropdown">

                    <div className="role-dropdown-header">

                      <strong>
                        Pindah Role
                      </strong>

                      <span>
                        Admin dapat mengakses
                        seluruh dashboard.
                      </span>

                    </div>


                    {roles.map((role) => (

                      <button
                        type="button"
                        key={role.name}
                        className={`role-option ${
                          currentRole.name ===
                          role.name
                            ? "role-option-active"
                            : ""
                        }`}
                        onClick={() =>
                          changeRole(role)
                        }
                      >

                        <div
                          className="role-option-icon"
                          style={{
                            background:
                              `${role.color}15`,
                            color:
                              role.color,
                          }}
                        >
                          {role.icon}
                        </div>


                        <div className="role-option-info">

                          <strong>
                            {role.name}
                          </strong>

                          <span>
                            {role.description}
                          </span>

                        </div>


                        {currentRole.name ===
                          role.name && (
                          <CheckCircle2
                            size={16}
                            color="#4f46e5"
                          />
                        )}

                      </button>

                    ))}

                  </div>

                )}

              </div>

            </div>

          </header>


          {/* ===================================================
              CONTENT
          =================================================== */}

          <section className="dashboard-content">

            <div className="dashboard-home">

              {/* =================================================
                  ADMIN
              ================================================= */}

              {activePage === "dashboard" && (
                <>

                  <div className="content-heading">

                    <div className="heading-left">

                      <div className="heading-icon">
                        <UserCog size={27} />
                      </div>

                      <div>

                        <h2>
                          Beranda Administrator
                        </h2>

                        <p>
                          Kelola seluruh sistem
                          perizinan sekolah.
                        </p>

                      </div>

                    </div>


                    <div className="admin-access-badge">

                      <span />

                      Admin memiliki
                      akses penuh

                    </div>

                  </div>


                  {error && (
                    <div className="error-box">

                      <span>
                        {error}
                      </span>

                      <button
                        type="button"
                        className="refresh-button"
                        onClick={loadPermissions}
                      >
                        Coba Lagi
                      </button>

                    </div>
                  )}


                  {/* STATISTIK */}

                  <div className="statistics-grid">

                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#eef2ff",
                          color:
                            "#4f46e5",
                        }}
                      >
                        <ClipboardList
                          size={22}
                        />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Total Pengajuan
                        </span>

                        <strong>
                          {loading
                            ? "..."
                            : totalPengajuan}
                        </strong>

                      </div>

                    </div>


                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#ecfdf5",
                          color:
                            "#059669",
                        }}
                      >
                        <CheckCircle2
                          size={22}
                        />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Disetujui
                        </span>

                        <strong>
                          {loading
                            ? "..."
                            : disetujui}
                        </strong>

                      </div>

                    </div>


                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#fffbeb",
                          color:
                            "#d97706",
                        }}
                      >
                        <Clock size={22} />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Menunggu
                        </span>

                        <strong>
                          {loading
                            ? "..."
                            : menunggu}
                        </strong>

                      </div>

                    </div>


                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#fef2f2",
                          color:
                            "#dc2626",
                        }}
                      >
                        <XCircle size={22} />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Ditolak
                        </span>

                        <strong>
                          {loading
                            ? "..."
                            : ditolak}
                        </strong>

                      </div>

                    </div>

                  </div>


                  {/* =================================================
                      GRAFIK KHUSUS ADMIN
                  ================================================= */}

                  <div className="admin-chart-card">

                    <div className="section-header">

                      <div>

                        <h3>
                          Statistik & Grafik Sistem
                        </h3>

                        <p>
                          Visualisasi rekapitulasi data perizinan secara real-time.
                        </p>

                      </div>

                      <div className="section-header-icon">
                        <BarChart3 size={19} />
                      </div>

                    </div>

                    <div className="admin-chart-body">
                      
                      <div className="chart-box">
                        <div className="chart-box-title">
                          <CheckCircle2 size={16} color="#4f46e5" />
                          <span>Distribusi Status Pengajuan</span>
                        </div>

                        <div className="chart-item">
                          <div className="chart-meta">
                            <span style={{ color: '#059669' }}>Disetujui</span>
                            <span>{disetujui} ({Math.round(percentDisetujui)}%)</span>
                          </div>
                          <div className="chart-bar-bg">
                            <div className="chart-bar-fill" style={{ width: `${percentDisetujui}%`, background: '#10b981' }}></div>
                          </div>
                        </div>

                        <div className="chart-item">
                          <div className="chart-meta">
                            <span style={{ color: '#d97706' }}>Menunggu</span>
                            <span>{menunggu} ({Math.round(percentMenunggu)}%)</span>
                          </div>
                          <div className="chart-bar-bg">
                            <div className="chart-bar-fill" style={{ width: `${percentMenunggu}%`, background: '#f59e0b' }}></div>
                          </div>
                        </div>

                        <div className="chart-item">
                          <div className="chart-meta">
                            <span style={{ color: '#dc2626' }}>Ditolak</span>
                            <span>{ditolak} ({Math.round(percentDitolak)}%)</span>
                          </div>
                          <div className="chart-bar-bg">
                            <div className="chart-bar-fill" style={{ width: `${percentDitolak}%`, background: '#ef4444' }}></div>
                          </div>
                        </div>
                      </div>

                      <div className="chart-box">
                        <div className="chart-box-title">
                          <ClipboardList size={16} color="#4f46e5" />
                          <span>Ringkasan Aktivitas Perizinan</span>
                        </div>

                        <div className="chart-item">
                          <div className="chart-meta">
                            <span style={{ color: '#4f46e5' }}>Total Keseluruhan Data</span>
                            <span>{totalPengajuan} Data</span>
                          </div>
                          <div className="chart-bar-bg">
                            <div className="chart-bar-fill" style={{ width: '100%', background: '#6366f1' }}></div>
                          </div>
                        </div>

                        <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                          <p style={{ margin: 0, fontSize: '11px', color: '#1e40af', lineHeight: '1.5' }}>
                            💡 <strong>Info Admin:</strong> Sistem berjalan normal. Semua data pengajuan siswa tersinkronisasi otomatis dari database server port 5002.
                          </p>
                        </div>
                      </div>

                    </div>

                  </div>


                  {/* PENGAJUAN */}

                  <div className="permission-card">

                    <div className="section-header">

                      <div>

                        <h3>
                          Daftar Pengajuan
                        </h3>

                        <p>
                          Menampilkan data
                          pengajuan yang
                          benar-benar tersimpan.
                        </p>

                      </div>


                      <button
                        type="button"
                        className="refresh-button"
                        onClick={loadPermissions}
                      >

                        <RefreshCw
                          size={12}
                          style={{
                            marginRight: 4,
                            verticalAlign:
                              "middle",
                          }}
                        />

                        Refresh

                      </button>

                    </div>


                    {loading ? (

                      <div className="loading-state">

                        <RefreshCw
                          className="loading-icon"
                          size={23}
                        />

                        <div>
                          Memuat data
                          pengajuan...
                        </div>

                      </div>

                    ) : normalizedPermissions.length ===
                      0 ? (

                      <div className="empty-state">

                        <div className="empty-state-icon">
                          <ClipboardList
                            size={23}
                          />
                        </div>

                        Belum ada pengajuan
                        perizinan.

                      </div>

                    ) : (

                      <div className="permission-list">

                        {normalizedPermissions.map(
                          (permission) => {

                            const status =
                              getStatus(
                                permission.status
                              );

                            return (
                              <div
                                className="permission-item"
                                key={
                                  permission.id
                                }
                              >

                                <div className="student-avatar">

                                  {getInitial(
                                    permission.name
                                  )}

                                </div>


                                <div className="student-information">

                                  <strong>
                                    {
                                      permission.name
                                    }
                                  </strong>

                                  <span>
                                    Kelas{" "}
                                    {
                                      permission.className
                                    }{" "}
                                    | ID:{" "}
                                    {
                                      permission.studentId
                                    }
                                  </span>

                                </div>


                                <div className="permission-purpose">

                                  <span>
                                    Keperluan
                                  </span>

                                  <strong>
                                    {
                                      permission.purpose
                                    }
                                  </strong>

                                </div>


                                <div className="permission-time">

                                  <Clock size={12} />

                                  {
                                    permission.time
                                  }

                                </div>


                                <div
                                  className={`permission-status ${status.className}`}
                                >
                                  {
                                    status.text
                                  }
                                </div>

                              </div>
                            );
                          }
                        )}

                      </div>

                    )}

                  </div>

                </>
              )}


              {/* =================================================
                  GURU PIKET
              ================================================= */}

              {activePage === "guru" && (

                <>

                  <div className="content-heading">

                    <div className="heading-left">

                      <div
                        className="heading-icon"
                        style={{
                          background:
                            "#ecfeff",
                          color:
                            "#0891b2",
                        }}
                      >
                        <Users size={27} />
                      </div>

                      <div>

                        <h2>
                          Dashboard Guru Piket
                        </h2>

                        <p>
                          Memeriksa dan memproses
                          pengajuan siswa.
                        </p>

                      </div>

                    </div>

                  </div>


                  <div className="permission-card">

                    <div className="section-header">

                      <div>

                        <h3>
                          Pengajuan Siswa
                        </h3>

                        <p>
                          Data berasal dari
                          sistem perizinan.
                        </p>

                      </div>

                    </div>


                    {normalizedPermissions.length ===
                    0 ? (

                      <div className="empty-state">

                        <div className="empty-state-icon">
                          <ClipboardList
                            size={23}
                          />
                        </div>

                        Belum ada pengajuan.

                      </div>

                    ) : (

                      <div className="permission-list">

                        {normalizedPermissions.map(
                          (permission) => {

                            const status =
                              getStatus(
                                permission.status
                              );

                            return (
                              <div
                                className="permission-item"
                                key={
                                  permission.id
                                }
                              >

                                <div className="student-avatar">
                                  {getInitial(
                                    permission.name
                                  )}
                                </div>

                                <div className="student-information">

                                  <strong>
                                    {
                                      permission.name
                                    }
                                  </strong>

                                  <span>
                                    Kelas{" "}
                                    {
                                      permission.className
                                    }
                                  </span>

                                </div>

                                <div className="permission-purpose">

                                  <span>
                                    Keperluan
                                  </span>

                                  <strong>
                                    {
                                      permission.purpose
                                    }
                                  </strong>

                                </div>

                                <div
                                  className={`permission-status ${status.className}`}
                                >
                                  {
                                    status.text
                                  }
                                </div>

                              </div>
                            );
                          }
                        )}

                      </div>

                    )}

                  </div>

                </>
              )}


              {/* =================================================
                  SATPAM
              ================================================= */}

              {activePage === "satpam" && (

                <>

                  <div className="content-heading">

                    <div className="heading-left">

                      <div
                        className="heading-icon"
                        style={{
                          background:
                            "#f5f3ff",
                          color:
                            "#7c3aed",
                        }}
                      >
                        <ShieldCheck
                          size={27}
                        />
                      </div>

                      <div>

                        <h2>
                          Dashboard Satpam
                        </h2>

                        <p>
                          Monitoring siswa yang
                          keluar dan masuk.
                        </p>

                      </div>

                    </div>

                  </div>


                  <div className="statistics-grid">

                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#ecfdf5",
                          color:
                            "#059669",
                        }}
                      >
                        <UserRoundCheck
                          size={22}
                        />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Pengajuan Disetujui
                        </span>

                        <strong>
                          {disetujui}
                        </strong>

                      </div>

                    </div>


                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#fffbeb",
                          color:
                            "#d97706",
                        }}
                      >
                        <Clock size={22} />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Menunggu
                        </span>

                        <strong>
                          {menunggu}
                        </strong>

                      </div>

                    </div>

                  </div>


                  <div className="permission-card">

                    <div className="section-header">

                      <div>

                        <h3>
                          Monitoring Izin
                        </h3>

                        <p>
                          Pengajuan yang telah
                          disetujui.
                        </p>

                      </div>

                    </div>


                    <div className="permission-list">

                      {normalizedPermissions
                        .filter((item) => {

                          const value =
                            String(
                              item.status
                            ).toLowerCase();

                          return (
                            value ===
                              "approved" ||
                            value ===
                              "disetujui"
                          );
                        })
                        .map((permission) => (

                          <div
                            className="permission-item"
                            key={
                              permission.id
                            }
                          >

                            <div className="student-avatar">

                              {getInitial(
                                permission.name
                              )}

                            </div>

                            <div className="student-information">

                              <strong>
                                {
                                  permission.name
                                }
                              </strong>

                              <span>
                                Kelas{" "}
                                {
                                  permission.className
                                }
                              </span>

                            </div>

                            <div className="permission-purpose">

                              <span>
                                Keperluan
                              </span>

                              <strong>
                                {
                                  permission.purpose
                                }
                              </strong>

                            </div>

                            <div className="permission-status approved">
                              Diizinkan
                            </div>

                          </div>

                        ))}

                    </div>

                  </div>

                </>
              )}


              {/* =================================================
                  SISWA
              ================================================= */}

              {activePage === "siswa" && (

                <>

                  <div className="content-heading">

                    <div className="heading-left">

                      <div
                        className="heading-icon"
                        style={{
                          background:
                            "#ecfdf5",
                          color:
                            "#059669",
                        }}
                      >
                        <GraduationCap
                          size={27}
                        />
                      </div>

                      <div>

                        <h2>
                          Dashboard Siswa
                        </h2>

                        <p>
                          Melihat status pengajuan
                          perizinan.
                        </p>

                      </div>

                    </div>

                  </div>


                  <div className="statistics-grid">

                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#eef2ff",
                          color:
                            "#4f46e5",
                        }}
                      >
                        <ClipboardList
                          size={22}
                        />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Pengajuan
                        </span>

                        <strong>
                          {totalPengajuan}
                        </strong>

                      </div>

                    </div>


                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#ecfdf5",
                          color:
                            "#059669",
                        }}
                      >
                        <CheckCircle2
                          size={22}
                        />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Disetujui
                        </span>

                        <strong>
                          {disetujui}
                        </strong>

                      </div>

                    </div>


                    <div className="statistic-card">

                      <div
                        className="statistic-icon"
                        style={{
                          background:
                            "#fffbeb",
                            color:
                            "#d97706",
                        }}
                      >
                        <Clock size={22} />
                      </div>

                      <div className="statistic-info">

                        <span>
                          Menunggu
                        </span>

                        <strong>
                          {menunggu}
                        </strong>

                      </div>

                    </div>

                  </div>


                  <div className="permission-card">

                    <div className="section-header">

                      <div>

                        <h3>
                          Riwayat Pengajuan
                        </h3>

                        <p>
                          Pengajuan yang tersimpan
                          dalam sistem.
                        </p>

                      </div>

                    </div>


                    {normalizedPermissions.length ===
                    0 ? (

                      <div className="empty-state">

                        <div className="empty-state-icon">
                          <ClipboardList
                            size={23}
                          />
                        </div>

                        Belum ada pengajuan.

                      </div>

                    ) : (

                      <div className="permission-list">

                        {normalizedPermissions.map(
                          (permission) => {

                            const status =
                              getStatus(
                                permission.status
                              );

                            return (
                              <div
                                className="permission-item"
                                key={
                                  permission.id
                                }
                              >

                                <div className="student-avatar">
                                  {getInitial(
                                    permission.name
                                  )}
                                </div>

                                <div className="student-information">

                                  <strong>
                                    {
                                      permission.purpose
                                    }
                                  </strong>

                                  <span>
                                    {
                                      permission.time
                                    }
                                  </span>

                                </div>

                                <div
                                  className={`permission-status ${status.className}`}
                                >
                                  {
                                    status.text
                                  }
                                </div>

                              </div>
                            );
                          }
                        )}

                      </div>

                    )}

                  </div>

                </>
              )}


              {/* =================================================
                  SETTINGS
              ================================================= */}

              {activePage === "settings" && (

                <>

                  <div className="content-heading">

                    <div className="heading-left">

                      <div className="heading-icon">
                        <Settings size={27} />
                      </div>

                      <div>

                        <h2>
                          Pengaturan
                        </h2>

                        <p>
                          Pengaturan sistem
                          perizinan sekolah.
                        </p>

                      </div>

                    </div>

                  </div>


                  <div className="permission-card">

                    <div className="section-header">

                      <div>

                        <h3>
                          Informasi Sekolah
                        </h3>

                        <p>
                          Data aplikasi.
                        </p>

                      </div>

                    </div>


                    <div className="settings-card">

                      <div className="setting">

                        <div>

                          <strong>
                            Nama Sekolah
                          </strong>

                          <span>
                            Nama sekolah pada
                            aplikasi.
                          </span>

                        </div>

                        <input
                          defaultValue="SMK Negeri Compreng"
                        />

                      </div>


                      <div className="setting">

                        <div>

                          <strong>
                            Nama Sistem
                          </strong>

                          <span>
                            Nama aplikasi.
                          </span>

                        </div>

                        <input
                          defaultValue="Sistem Perizinan"
                        />

                      </div>

                    </div>

                  </div>

                </>

              )}

            </div>

          </section>

        </main>

      </div>
    </>
  );
}
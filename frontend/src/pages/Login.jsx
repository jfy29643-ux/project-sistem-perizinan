import React, { useState } from 'react';
import { API_URL } from './apiConfig';

const API_BASE_URL = API_URL;

// ======================================================
// PILIHAN ROLE
// ======================================================
const ROLE_OPTIONS = [
  { value: 'Siswa', label: 'Siswa' },
  { value: 'Guru', label: 'Guru' },
  { value: 'Satpam', label: 'Satpam' }
];

// ======================================================
// NORMALISASI ROLE
// ======================================================
function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, '_');
}

// ======================================================
// LOGIN COMPONENT
// ======================================================
export default function Login({ onLoginSuccess }) {
  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'Siswa'
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ====================================================
  // UPDATE FORM
  // ====================================================
  const update = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value
    }));

    if (errorMessage) {
      setErrorMessage('');
    }
  };

  // ====================================================
  // SUBMIT LOGIN
  // ====================================================
  async function submit(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setErrorMessage('');

    try {
      if (!form.username.trim()) {
        throw new Error('Nama pengguna wajib diisi.');
      }

      if (!form.password) {
        throw new Error('Kata sandi wajib diisi.');
      }

      const loginURL = `${API_BASE_URL}/api/login`;

      console.log('Menghubungkan ke:', loginURL);

      const response = await fetch(loginURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          nama_pengguna: form.username.trim(),
          kata_sandi: form.password,
          peran: form.role
        })
      });

      const textResult = await response.text();
      let result;

      try {
        result = JSON.parse(textResult);
      } catch (e) {
        console.error('Response dari server:', textResult);
        throw new Error(
          'Server mengembalikan respons yang tidak valid. Periksa apakah layanan auth backend sudah berjalan.'
        );
      }

      console.log('Response login:', result);

      if (!response.ok) {
        throw new Error(
          result.message ||
          `Login gagal. Status server: ${response.status}`
        );
      }

      if (!result.user) {
        throw new Error(
          result.message || 'Data pengguna tidak ditemukan.'
        );
      }

      const user = result.user;
      const originalRole = user.peran || user.role || '';

      const userRole = normalizeRole(originalRole);
      const selectedRole = normalizeRole(form.role);

      const isAdmin = userRole === 'admin';

      if (!isAdmin) {
        let roleMatches = userRole === selectedRole;

        if (
          selectedRole === 'guru' &&
          (userRole.includes('guru') || userRole === 'guru_piket')
        ) {
          roleMatches = true;
        }

        if (
          selectedRole === 'satpam' &&
          userRole.includes('satpam')
        ) {
          roleMatches = true;
        }

        if (
          selectedRole === 'siswa' &&
          userRole === 'siswa'
        ) {
          roleMatches = true;
        }

        if (!roleMatches) {
          throw new Error(
            `Akun ini terdaftar sebagai ${
              originalRole || 'peran lain'
            }. Pilih peran yang sesuai.`
          );
        }
      }

      const activeRole = isAdmin ? form.role : originalRole;

      const sessionUser = {
        ...user,
        peranAsli: originalRole,
        activeRole,
        peran: activeRole
      };

      if (!result.token) {
        throw new Error('Server tidak mengirim token login. Hubungi admin.');
      }

      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(sessionUser));
      localStorage.setItem('activeRole', activeRole);

      onLoginSuccess?.(sessionUser);

    } catch (error) {
      console.error('Login error detail:', error);

      const isNetworkError =
        error instanceof TypeError &&
        /fetch|network/i.test(error.message || '');

      setErrorMessage(
        isNetworkError
          ? `Tidak dapat terhubung ke server (${API_BASE_URL}). Pastikan backend auth sudah berjalan.`
          : error.message || 'Login gagal. Tidak dapat terhubung ke server.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ====================================================
  // TAMPILAN LOGIN
  // ====================================================
  return (
    <div style={styles.container}>
      <div style={styles.card}>

        <div style={styles.logoContainer}>
          <img
            src="/logo_sekolah-removebg-preview.png"
            alt="Logo Sekolah"
            style={styles.schoolLogo}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        <h1 style={styles.title}>
          Sistem Perizinan
        </h1>

        <p style={styles.subtitle}>
          Manajemen keluar masuk siswa
        </p>

        {errorMessage && (
          <div style={styles.errorAlert}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={submit} style={styles.formStack}>

          <label style={styles.label}>
            Nama Pengguna
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={update}
              required
              style={styles.input}
              placeholder="Masukkan username"
              disabled={loading}
              autoComplete="username"
            />
          </label>

          <label style={styles.label}>
            Kata Sandi
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={update}
              required
              style={styles.input}
              placeholder="••••••••"
              disabled={loading}
              autoComplete="current-password"
            />
          </label>

          <label style={styles.label}>
            Masuk sebagai
            <select
              name="role"
              value={form.role}
              onChange={update}
              style={styles.select}
              disabled={loading}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.primaryButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>

        </form>

      </div>
    </div>
  );
}

// ======================================================
// STYLE
// ======================================================
const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'linear-gradient(135deg, #edf7ff 0%, #e9f1fa 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    zIndex: 99999
  },
  card: {
    width: '100%',
    maxWidth: '27rem',
    padding: '2.5rem',
    borderRadius: '1.25rem',
    background: 'rgba(255, 255, 255, 0.96)',
    boxShadow: '0 24px 60px rgba(31, 67, 101, 0.14)',
    boxSizing: 'border-box'
  },
  logoContainer: {
    width: '5.5rem',
    height: '5.5rem',
    margin: '0 auto 1.25rem',
    display: 'flex',
    justifyContent: 'center'
  },
  schoolLogo: {
    width: '5.5rem',
    height: '5.5rem',
    objectFit: 'contain'
  },
  title: {
    margin: '0 0 0.5rem',
    textAlign: 'center',
    color: '#12263a',
    fontSize: '1.5rem',
    fontWeight: '800'
  },
  subtitle: {
    margin: '0 0 1.5rem',
    textAlign: 'center',
    color: '#6b7f92',
    fontSize: '0.875rem'
  },
  errorAlert: {
    marginBottom: '1.25rem',
    padding: '0.8rem 1rem',
    borderRadius: '0.7rem',
    background: '#fff1f2',
    color: '#be123c',
    fontSize: '0.875rem',
    textAlign: 'center'
  },
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    color: '#344b61',
    fontSize: '0.8125rem',
    fontWeight: '700'
  },
  input: {
    width: '100%',
    minHeight: '3rem',
    padding: '0.75rem 0.9rem',
    border: '1px solid #cfdae6',
    borderRadius: '0.7rem',
    outline: 'none',
    background: '#fbfdff',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    minHeight: '3rem',
    padding: '0.75rem 0.9rem',
    border: '1px solid #cfdae6',
    borderRadius: '0.7rem',
    outline: 'none',
    background: '#ffffff',
    boxSizing: 'border-box',
    cursor: 'pointer'
  },
  primaryButton: {
    width: '100%',
    minHeight: '3rem',
    marginTop: '0.25rem',
    padding: '0.75rem 1rem',
    border: 'none',
    borderRadius: '0.7rem',
    background: '#1769a5',
    color: '#ffffff',
    fontSize: '0.9375rem',
    fontWeight: '750'
  }
};
import React, { useState } from 'react';

const API_URL = 'http://127.0.0.1:5000/api';

/*
|--------------------------------------------------------------------------
| PILIHAN ROLE
|--------------------------------------------------------------------------
*/

const ROLE_OPTIONS = [
  {
    value: 'Siswa',
    label: 'Siswa'
  },
  {
    value: 'Guru',
    label: 'Guru'
  },
  {
    value: 'Admin',
    label: 'Admin'
  },
  {
    value: 'Satpam',
    label: 'Satpam'
  }
];


/*
|--------------------------------------------------------------------------
| NORMALISASI ROLE
|--------------------------------------------------------------------------
|
| "Guru Piket" -> "guru_piket"
| "Guru-Piket" -> "guru_piket"
| "ADMIN"      -> "admin"
|
*/

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, '_');
}


export default function Login({ onLoginSuccess }) {

  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'Siswa'
  });

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');


  /*
  |--------------------------------------------------------------------------
  | UPDATE FORM
  |--------------------------------------------------------------------------
  */

  const update = (event) => {

    const {
      name,
      value
    } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value
    }));

  };


  /*
  |--------------------------------------------------------------------------
  | SUBMIT LOGIN
  |--------------------------------------------------------------------------
  */

  async function submit(event) {

    event.preventDefault();

    setLoading(true);
    setErrorMessage('');


    try {

      /*
      |--------------------------------------------------------------------------
      | VALIDASI FRONTEND
      |--------------------------------------------------------------------------
      */

      if (!form.username.trim()) {
        throw new Error(
          'Nama pengguna wajib diisi.'
        );
      }

      if (!form.password) {
        throw new Error(
          'Kata sandi wajib diisi.'
        );
      }


      /*
      |--------------------------------------------------------------------------
      | REQUEST KE BACKEND
      |--------------------------------------------------------------------------
      */

      const response = await fetch(
        `${API_URL}/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            nama_pengguna:
              form.username.trim(),

            kata_sandi:
              form.password,

            /*
             * Role yang ingin digunakan
             */
            peran:
              form.role
          })
        }
      );


      /*
      |--------------------------------------------------------------------------
      | BACA RESPONSE
      |--------------------------------------------------------------------------
      */

      const result =
        await response.json();


      /*
      |--------------------------------------------------------------------------
      | LOGIN GAGAL
      |--------------------------------------------------------------------------
      */

      if (
        !response.ok ||
        !result.user
      ) {

        throw new Error(
          result.message ||
          'Username atau kata sandi salah.'
        );

      }


      /*
      |--------------------------------------------------------------------------
      | USER DARI BACKEND
      |--------------------------------------------------------------------------
      */

      const user = result.user;


      /*
      |--------------------------------------------------------------------------
      | ROLE ASLI USER
      |--------------------------------------------------------------------------
      */

      const originalRole =
        user.peran ||
        user.role ||
        '';


      const userRole =
        normalizeRole(
          originalRole
        );


      /*
      |--------------------------------------------------------------------------
      | ROLE YANG DIPILIH
      |--------------------------------------------------------------------------
      */

      const selectedRole =
        normalizeRole(
          form.role
        );


      /*
      |--------------------------------------------------------------------------
      | CEK ADMIN
      |--------------------------------------------------------------------------
      */

      const isAdmin =
        userRole === 'admin';


      /*
      |--------------------------------------------------------------------------
      | VALIDASI ROLE
      |--------------------------------------------------------------------------
      |
      | Admin:
      |     boleh memilih semua role.
      |
      | User biasa:
      |     hanya boleh menggunakan role aslinya.
      |
      */

      if (!isAdmin) {

        let roleMatches =
          userRole === selectedRole;


        /*
         * Toleransi untuk data lama:
         *
         * Database mungkin menyimpan:
         * "Guru Piket"
         *
         * sedangkan role tertentu:
         * "Guru"
         */

        if (
          selectedRole === 'guru' &&
          userRole.includes('guru')
        ) {

          roleMatches = true;

        }


        if (!roleMatches) {

          throw new Error(
            `Akun ini terdaftar sebagai ${
              originalRole ||
              'peran lain'
            }. Pilih peran yang sesuai.`
          );

        }

      }


      /*
      |--------------------------------------------------------------------------
      | TENTUKAN ACTIVE ROLE
      |--------------------------------------------------------------------------
      |
      | Kalau Admin:
      |     activeRole = pilihan dropdown
      |
      | Kalau user biasa:
      |     activeRole = role asli
      |
      */

      const activeRole =
        isAdmin
          ? form.role
          : originalRole;


      /*
      |--------------------------------------------------------------------------
      | BUAT SESSION USER
      |--------------------------------------------------------------------------
      |
      | Contoh cca masuk sebagai Siswa:
      |
      | peranAsli  = Admin
      | peran      = Siswa
      | activeRole = Siswa
      |
      */

      const sessionUser = {

        ...user,

        /*
         * Role asli dari database.
         */
        peranAsli:
          originalRole,

        /*
         * Role aktif.
         */
        activeRole:
          activeRole,

        /*
         * Untuk kompatibilitas
         * dengan komponen lama.
         *
         * Dashboard akan menggunakan
         * activeRole.
         */
        peran:
          activeRole
      };


      /*
      |--------------------------------------------------------------------------
      | SIMPAN TOKEN
      |--------------------------------------------------------------------------
      */

      localStorage.setItem(
        'token',
        result.token ||
        'dummy-jwt-token'
      );


      /*
      |--------------------------------------------------------------------------
      | SIMPAN USER
      |--------------------------------------------------------------------------
      */

      localStorage.setItem(
        'user',
        JSON.stringify(
          sessionUser
        )
      );


      /*
      |--------------------------------------------------------------------------
      | SIMPAN ACTIVE ROLE
      |--------------------------------------------------------------------------
      */

      localStorage.setItem(
        'activeRole',
        activeRole
      );


      /*
      |--------------------------------------------------------------------------
      | LOGIN BERHASIL
      |--------------------------------------------------------------------------
      */

      onLoginSuccess?.(
        sessionUser
      );


    } catch (error) {

      console.error(
        'Login error:',
        error
      );

      setErrorMessage(
        error.message ||
        'Terjadi kesalahan koneksi ke server.'
      );


    } finally {

      setLoading(false);

    }

  }


  /*
  |--------------------------------------------------------------------------
  | TAMPILAN
  |--------------------------------------------------------------------------
  */

  return (

    <div style={styles.container}>

      <div style={styles.card}>


        {/* ======================================================
            LOGO SEKOLAH
        ======================================================= */}

        <div style={styles.logoContainer}>

          <img
            src="/logo_sekolah-removebg-preview.png"
            alt="Logo Sekolah"
            style={styles.schoolLogo}

            onError={(event) => {

              /*
               * Kalau file logo belum ada,
               * tampilkan logo SP sebagai fallback.
               */

              event.currentTarget.style.display =
                'none';

              const fallback =
                event.currentTarget
                  .nextElementSibling;

              if (fallback) {
                fallback.style.display =
                  'grid';
              }

            }}
          />


          <div
            style={{
              ...styles.brandMark,
              display: 'none'
            }}
          >
            SP
          </div>

        </div>


        {/* ======================================================
            JUDUL
        ======================================================= */}

        <h1 style={styles.title}>
          Sistem Perizinan
        </h1>


        <p style={styles.subtitle}>
          Manajemen keluar masuk siswa
        </p>


        {/* ======================================================
            ERROR
        ======================================================= */}

        {errorMessage && (

          <div style={styles.errorAlert}>

            {errorMessage}

          </div>

        )}


        {/* ======================================================
            FORM
        ======================================================= */}

        <form
          onSubmit={submit}
          style={styles.formStack}
        >


          {/* USERNAME */}

          <label style={styles.label}>

            Nama Pengguna

            <input
              name="username"

              type="text"

              value={form.username}

              onChange={update}

              autoComplete="username"

              required

              style={styles.input}

              placeholder="Masukkan username"

              disabled={loading}
            />

          </label>


          {/* PASSWORD */}

          <label style={styles.label}>

            Kata Sandi

            <input
              name="password"

              type="password"

              value={form.password}

              onChange={update}

              autoComplete="current-password"

              required

              style={styles.input}

              placeholder="••••••••"

              disabled={loading}
            />

          </label>


          {/* ROLE */}

          <label style={styles.label}>

            Masuk sebagai

            <select
              name="role"

              value={form.role}

              onChange={update}

              style={styles.select}

              disabled={loading}
            >

              {ROLE_OPTIONS.map(
                (role) => (

                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </option>

                )
              )}

            </select>

          </label>


          {/* ==================================================
              INFORMASI
          =================================================== */}

          <div style={styles.infoAlert}>

            <span style={styles.infoIcon}>
              i
            </span>

            <span>
              Akun admin dapat masuk
              menggunakan seluruh peran
              yang tersedia.
            </span>

          </div>


          {/* ==================================================
              BUTTON
          =================================================== */}

          <button
            type="submit"

            disabled={loading}

            style={{
              ...styles.primaryButton,

              ...(loading
                ? styles.primaryButtonDisabled
                : {})
            }}
          >

            {loading
              ? 'Memproses...'
              : 'Masuk'}

          </button>


        </form>

      </div>

    </div>

  );
}


/*
|--------------------------------------------------------------------------
| STYLES
|--------------------------------------------------------------------------
*/

const styles = {

  container: {

    position: 'fixed',

    top: 0,
    left: 0,

    width: '100vw',
    height: '100vh',

    background:
      'radial-gradient(circle at 12% 12%, rgba(61, 145, 214, 0.22), transparent 30%), linear-gradient(135deg, #edf7ff 0%, #f8fbff 52%, #e9f1fa 100%)',

    display: 'flex',

    alignItems: 'center',

    justifyContent: 'center',

    padding: '1rem',

    boxSizing: 'border-box',

    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',

    zIndex: 99999
  },


  card: {

    width: '100%',

    maxWidth: '27rem',

    padding: '2.5rem',

    border:
      '1px solid rgba(193, 210, 227, 0.8)',

    borderRadius: '1.25rem',

    background:
      'rgba(255, 255, 255, 0.96)',

    boxShadow:
      '0 24px 60px rgba(31, 67, 101, 0.14)',

    boxSizing: 'border-box'
  },


  logoContainer: {

    position: 'relative',

    width: '5.5rem',

    height: '5.5rem',

    margin:
      '0 auto 1.25rem',

    display: 'flex',

    alignItems: 'center',

    justifyContent: 'center'
  },


  schoolLogo: {

    width: '5.5rem',

    height: '5.5rem',

    objectFit: 'contain',

    display: 'block'
  },


  brandMark: {

    placeItems: 'center',

    width: '4.5rem',

    height: '4.5rem',

    border:
      '1px solid #c9e0f4',

    borderRadius: '1.25rem',

    background: '#eaf5ff',

    fontSize: '1.5rem',

    fontWeight: 'bold',

    color: '#1769a5',

    boxShadow:
      '0 10px 22px rgba(37, 99, 235, 0.12)'
  },


  title: {

    margin:
      '0 0 0.5rem',

    textAlign: 'center',

    color: '#12263a',

    fontSize: '1.5rem',

    fontWeight: '800'
  },


  subtitle: {

    margin:
      '0 0 1.5rem',

    textAlign: 'center',

    color: '#6b7f92',

    fontSize: '0.875rem'
  },


  errorAlert: {

    marginBottom: '1.25rem',

    padding:
      '0.8rem 1rem',

    border:
      '1px solid #fecaca',

    borderRadius: '0.7rem',

    background: '#fff1f2',

    color: '#be123c',

    fontSize: '0.875rem',

    textAlign: 'center'
  },


  infoAlert: {

    display: 'flex',

    alignItems: 'flex-start',

    gap: '0.6rem',

    padding:
      '0.75rem 0.85rem',

    border:
      '1px solid #d9ebf8',

    borderRadius: '0.7rem',

    background: '#f2f9ff',

    color: '#39708f',

    fontSize: '0.75rem',

    lineHeight: '1.45'
  },


  infoIcon: {

    flexShrink: 0,

    display: 'grid',

    placeItems: 'center',

    width: '1.15rem',

    height: '1.15rem',

    borderRadius: '50%',

    background: '#1769a5',

    color: '#ffffff',

    fontSize: '0.7rem',

    fontWeight: '800'
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

    padding:
      '0.75rem 0.9rem',

    border:
      '1px solid #cfdae6',

    borderRadius: '0.7rem',

    outline: 'none',

    background: '#fbfdff',

    color: '#172033',

    fontSize: '0.875rem',

    boxSizing: 'border-box'
  },


  select: {

    width: '100%',

    minHeight: '3rem',

    padding:
      '0.75rem 0.9rem',

    border:
      '1px solid #cfdae6',

    borderRadius: '0.7rem',

    outline: 'none',

    background: '#ffffff',

    color: '#172033',

    fontSize: '0.875rem',

    boxSizing: 'border-box',

    cursor: 'pointer'
  },


  primaryButton: {

    width: '100%',

    minHeight: '3rem',

    marginTop: '0.25rem',

    padding:
      '0.75rem 1rem',

    border: 'none',

    borderRadius: '0.7rem',

    background: '#1769a5',

    color: '#ffffff',

    fontSize: '0.9375rem',

    fontWeight: '750',

    cursor: 'pointer',

    boxShadow:
      '0 9px 18px rgba(23, 105, 165, 0.2)'
  },


  primaryButtonDisabled: {

    opacity: 0.65,

    cursor: 'not-allowed'
  }

};

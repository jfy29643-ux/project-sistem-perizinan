import { Link, useSearchParams } from 'react-router-dom';

export default function DetailIzin() {
  const [params] = useSearchParams();
  return <main className="page"><section className="panel detail-panel"><span className="eyebrow">Laporan izin</span><h1>Detail Izin Siswa</h1><p>Kelas yang dipilih: <strong>{params.get('kelas') || 'Semua kelas'}</strong></p><Link className="primary-button inline-button" to="/dashboard/siswa">Kembali ke dashboard</Link></section></main>;
}

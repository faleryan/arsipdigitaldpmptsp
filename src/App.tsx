import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { UIProvider } from "./context/UIContext";
import { Layout, useTheme } from "./components/Layout";
import { TooltipLayer } from "./components/Charts";
import { configured, signOut } from "./lib/api";
import { Loading } from "./components/Loading";
import Login from "./pages/Login";
import Beranda from "./pages/Beranda";
import Dashboard from "./pages/Dashboard";
import DataArsip from "./pages/DataArsip";
import SicantikDashboard from "./pages/sicantik/Dashboard";
import SicantikData from "./pages/sicantik/Data";

const InputData = lazy(() => import("./pages/InputData"));
const ImportExcel = lazy(() => import("./pages/ImportExcel"));
const Pengguna = lazy(() => import("./pages/Pengguna"));
const SicantikInput = lazy(() => import("./pages/sicantik/Input"));
const SicantikImport = lazy(() => import("./pages/sicantik/Import"));
const PelakuPage = lazy(() => import("./pages/Pelaku"));
const PemohonPage = lazy(() => import("./pages/sicantik/Pemohon"));
const KbliPage = lazy(() => import("./pages/master/Kbli"));
const JenisIzinPage = lazy(() => import("./pages/master/JenisIzin"));


function NotConfigured() {
  return (
    <div className="center-page">
      <div className="card pad" style={{ maxWidth: 560 }}>
        <h2 style={{ marginTop: 0 }}>Konfigurasi Supabase belum diisi</h2>
        <p>Isi variabel lingkungan berikut (file <code>.env</code> saat lokal, atau <b>Settings → Environment Variables</b> di Vercel), lalu jalankan ulang/redeploy:</p>
        <pre className="code">VITE_SUPABASE_URL=https://xxxx.supabase.co{"\n"}VITE_SUPABASE_ANON_KEY=eyJ…</pre>
        <p className="muted">Nilainya ada di Supabase: Project Settings → API.</p>
      </div>
    </div>
  );
}

function Gate() {
  const { session, profile, loading, canWrite, isAdmin } = useAuth();
  useTheme();
  if (loading) return <Loading text="Memeriksa sesi…" />;
  if (!session) return <Login />;
  if (!profile) return (
    <div className="center-page"><div className="card pad" style={{ maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>Profil belum terdaftar</h2>
      <p>Akun Anda belum memiliki profil di aplikasi. Pastikan skrip <code>supabase/schema.sql</code> sudah dijalankan, lalu minta admin memberi peran.</p>
    </div></div>
  );
  if (profile.role === "pending") return (
    <div className="center-page"><div className="card pad" style={{ maxWidth: 480, textAlign: "center" }}>
      <h2 style={{ marginTop: 0 }}>Menunggu persetujuan</h2>
      <p className="muted">Akun <b>{session.user.email}</b> sudah terdaftar, tetapi belum diberi peran. Hubungi admin aplikasi untuk mengaktifkan akses Anda.</p>
      <button className="btn" onClick={() => signOut()}>Keluar</button>
    </div></div>
  );
  const W = (el: ReactNode) => (canWrite ? el : <Navigate to="/" replace />);
  return (
    <DataProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Beranda />} />
            <Route path="oss" element={<Dashboard />} />
            <Route path="oss/data" element={<DataArsip />} />
            <Route path="oss/pelaku" element={<PelakuPage />} />
            <Route path="oss/kbli" element={<KbliPage />} />
            <Route path="oss/input" element={W(<InputData />)} />
            <Route path="oss/input/:id" element={W(<InputData />)} />
            <Route path="oss/import" element={W(<ImportExcel />)} />
            <Route path="sicantik" element={<SicantikDashboard />} />
            <Route path="sicantik/data" element={<SicantikData />} />
            <Route path="sicantik/pemohon" element={<PemohonPage />} />
            <Route path="sicantik/jenis-izin" element={<JenisIzinPage />} />
            <Route path="sicantik/input" element={W(<SicantikInput />)} />
            <Route path="sicantik/input/:id" element={W(<SicantikInput />)} />
            <Route path="sicantik/import" element={W(<SicantikImport />)} />
            {/* alamat lama */}
            <Route path="data" element={<Navigate to="/oss/data" replace />} />
            <Route path="input" element={<Navigate to="/oss/input" replace />} />
            <Route path="import" element={<Navigate to="/oss/import" replace />} />
            <Route path="pengguna" element={isAdmin ? <Pengguna /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </DataProvider>
  );
}

export default function App() {
  if (!configured) return <NotConfigured />;
  return (
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <Gate />
          <TooltipLayer />
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

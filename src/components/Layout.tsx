import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Archive, Building2, Contact, FileBadge, Home, LayoutDashboard, LogOut, Moon, PlusCircle, Sun, Table2, Upload, UserCog, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData, useSicantik } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { NAMA_INSTANSI } from "../lib/columns";
import { fmtInt } from "../lib/format";
import * as api from "../lib/api";
import { Modal } from "./Modal";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", operator: "Operator", viewer: "Pembaca", pending: "Nonaktif" };

export function useTheme() {
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; } });
  const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    try { localStorage.setItem("theme", theme); } catch { /* abaikan */ }
  }, [theme, isDark]);
  return { isDark, toggle: () => setTheme(isDark ? "light" : "dark") };
}

export function Layout() {
  const { profile, canWrite, isAdmin, session } = useAuth();
  const oss = useData();
  const sic = useSicantik();
  const { toast } = useUI();
  const { isDark, toggle } = useTheme();
  const [pwOpen, setPwOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  const moduleNav = (base: string) => [
    { to: base, label: "Dashboard", icon: LayoutDashboard, show: true, end: true },
    { to: `${base}/data`, label: "Data Arsip", icon: Table2, show: true },
    base === "/oss"
      ? { to: "/oss/pelaku", label: "Pelaku Usaha", icon: Contact, show: true }
      : { to: "/sicantik/pemohon", label: "Pemohon", icon: Contact, show: true },
    { to: `${base}/input`, label: "Input Data", icon: PlusCircle, show: canWrite },
    { to: `${base}/import`, label: "Import Excel", icon: Upload, show: canWrite },
  ].filter((n) => n.show);
  const sections = [
    { title: "OSS RBA", base: "/oss", items: moduleNav("/oss") },
    { title: "SiCantik", base: "/sicantik", items: moduleNav("/sicantik") },
  ];
  const bottom = [
    { to: "/", label: "Beranda", icon: Home, end: true, show: true },
    { to: "/oss", label: "OSS", icon: Building2, show: true },
    { to: "/sicantik", label: "SiCantik", icon: FileBadge, show: true },
    { to: "/pengguna", label: "Pengguna", icon: UserCog, show: isAdmin },
  ].filter((n) => n.show);
  const current = sections.find((sct) => loc.pathname === sct.base || loc.pathname.startsWith(sct.base + "/"));

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark"><Archive size={20} /></span>
          <div><b>Arsip Digital</b><small>OSS RBA · SiCantik</small></div>
        </div>
        <nav className="nav-list" aria-label="Menu utama">
          <NavLink to="/" end className="nav"><Home size={18} />Beranda</NavLink>
          {sections.map((sct) => (
            <div key={sct.base} className="nav-sec">
              <div className="nav-title">{sct.title}</div>
              {sct.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className="nav"><n.icon size={18} />{n.label}</NavLink>
              ))}
            </div>
          ))}
          {isAdmin && (
            <div className="nav-sec">
              <div className="nav-title">Pengaturan</div>
              <NavLink to="/pengguna" className="nav"><UserCog size={18} />Pengguna</NavLink>
            </div>
          )}
        </nav>
        <div className="side-foot">
          <div className="side-stat">{oss.loaded && sic.loaded ? `${fmtInt(oss.rows.length)} proyek OSS · ${fmtInt(sic.rows.length)} izin SiCantik` : "Memuat…"}</div>
          <div className="me">
            <div className="avatar">{(profile?.nama || session?.user.email || "?").slice(0, 1).toUpperCase()}</div>
            <div className="me-t">
              <b>{profile?.nama || session?.user.email}</b>
              <small>{ROLE_LABEL[profile?.role || ""] || "Belum ada peran"}</small>
            </div>
          </div>
          <div className="side-actions">
            <button className="icon-btn" onClick={toggle} title={isDark ? "Mode terang" : "Mode gelap"} aria-label="Ganti tema">{isDark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button className="icon-btn" onClick={() => setPwOpen(true)} title="Ganti kata sandi" aria-label="Ganti kata sandi"><KeyRound size={17} /></button>
            <button className="icon-btn" onClick={() => api.signOut()} title="Keluar" aria-label="Keluar"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <span className="brand-mark sm"><Archive size={17} /></span>
        <b>Arsip Digital</b>
        <span style={{ flex: 1 }} />
        <button className="icon-btn" onClick={toggle} aria-label="Ganti tema">{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button className="icon-btn" onClick={() => setPwOpen(true)} aria-label="Ganti kata sandi"><KeyRound size={18} /></button>
        <button className="icon-btn" onClick={() => api.signOut()} aria-label="Keluar"><LogOut size={18} /></button>
      </header>

      <main className="main">
        {current && (
          <nav className="modtabs" aria-label={`Menu ${current.title}`}>
            {current.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="modtab">{n.label.replace(" Arsip", "").replace(" Data", "").replace(" Excel", "").replace(" Usaha", "")}</NavLink>
            ))}
          </nav>
        )}
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Menu">
        {bottom.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="bn"><n.icon size={20} /><span>{n.label}</span></NavLink>
        ))}
      </nav>

      {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} onDone={() => { setPwOpen(false); toast("Kata sandi berhasil diganti"); }} />}
    </div>
  );
}

function PasswordDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [a, setA] = useState(""), [b, setB] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (a.length < 8) return setErr("Minimal 8 karakter");
    if (a !== b) return setErr("Konfirmasi kata sandi tidak sama");
    setBusy(true);
    try { await api.updatePassword(a); onDone(); } catch (x) { setErr(api.errMsg(x)); setBusy(false); }
  };
  return (
    <Modal onClose={onClose} size="sm" label="Ganti kata sandi">
      <form onSubmit={submit}>
        <div className="modal-h"><h2>Ganti kata sandi</h2></div>
        <div className="modal-b stack">
          <div className="f"><label htmlFor="pw1">Kata sandi baru</label><input id="pw1" className="inp" type="password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" /></div>
          <div className="f"><label htmlFor="pw2">Ulangi kata sandi</label><input id="pw2" className="inp" type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" /></div>
          {err && <div className="msg">{err}</div>}
        </div>
        <div className="modal-f"><button type="button" className="btn" onClick={onClose}>Batal</button><button className="btn primary" disabled={busy}>Simpan</button></div>
      </form>
    </Modal>
  );
}

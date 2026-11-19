import { useState } from "react";
import { Archive, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import * as api from "../lib/api";
import { NAMA_INSTANSI } from "../lib/columns";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await api.signIn(email.trim(), pw); } catch (x) { setErr(api.errMsg(x)); setBusy(false); }
  };
  return (
    <div className="login">
      <div className="login-art" aria-hidden="true">
        <div className="login-art-in">
          <span className="brand-mark lg"><Archive size={30} /></span>
          <h1>Arsip Digital<br />OSS &amp; SiCantik</h1>
          <p>Simpan, telusuri, dan laporkan data perizinan dari OSS RBA dan SiCantik dalam satu tempat — lengkap dengan dokumen arsipnya.</p>
          <ul>
            <li>Import langsung dari file Excel OSS & rekap SiCantik</li>
            <li>Dashboard laporan & lama proses penetapan izin</li>
            <li>Dokumen PDF tersimpan aman per proyek & permohonan</li>
          </ul>
        </div>
      </div>
      <div className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="login-mobile-brand"><span className="brand-mark"><Archive size={20} /></span><b>Arsip Digital OSS</b></div>
          <h2>Masuk</h2>
          <p className="muted">{NAMA_INSTANSI}</p>
          <div className="f">
            <label htmlFor="em">Email</label>
            <div className="inp-ico"><Mail size={17} /><input id="em" className="inp" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@instansi.go.id" /></div>
          </div>
          <div className="f">
            <label htmlFor="pw">Kata sandi</label>
            <div className="inp-ico"><Lock size={17} /><input id="pw" className="inp" type={show ? "text" : "password"} autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" className="inp-eye" onClick={() => setShow(!show)} aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          </div>
          {err && <div className="alert">{err}</div>}
          <button className="btn primary block" disabled={busy}>{busy ? <><Loader2 size={16} className="spin-ico" />Memproses…</> : "Masuk"}</button>
          <p className="muted small">Belum punya akun? Hubungi admin aplikasi untuk dibuatkan.</p>
        </form>
      </div>
    </div>
  );
}

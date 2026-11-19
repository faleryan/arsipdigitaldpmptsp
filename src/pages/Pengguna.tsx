import { useEffect, useState } from "react";
import { RefreshCw, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import * as api from "../lib/api";
import { Loading } from "../components/Loading";

const ROLES: { v: api.Role; label: string; desc: string }[] = [
  { v: "admin", label: "Admin", desc: "Semua akses + kelola pengguna + kosongkan data" },
  { v: "operator", label: "Operator", desc: "Lihat, tambah, ubah, hapus, import & unggah dokumen" },
  { v: "viewer", label: "Pembaca", desc: "Hanya melihat dashboard dan data" },
  { v: "pending", label: "Nonaktif", desc: "Belum/tidak diberi akses sama sekali" },
];

export default function Pengguna() {
  const { session } = useAuth();
  const { toast } = useUI();
  const [list, setList] = useState<api.Profile[] | null>(null);
  const [err, setErr] = useState("");
  const load = async () => { try { setList(await api.listProfiles()); setErr(""); } catch (e) { setErr(api.errMsg(e)); } };
  useEffect(() => { load(); }, []);

  const change = async (p: api.Profile, patch: Partial<Pick<api.Profile, "role" | "nama">>) => {
    try { await api.updateProfile(p.id, patch); toast("Perubahan disimpan"); load(); } catch (e) { toast(api.errMsg(e)); }
  };

  return (
    <>
      <div className="head">
        <div><h1>Pengguna</h1><p>Atur peran setiap pengguna aplikasi.</p></div>
        <div className="head-actions"><button className="btn" onClick={load}><RefreshCw size={16} />Muat ulang</button></div>
      </div>
      <div className="grid-roles">
        {ROLES.slice(0, 3).map((r) => <div key={r.v} className="card step"><b><Shield size={16} />{r.label}</b><p>{r.desc}</p></div>)}
      </div>
      {err && <div className="banner warn">{err}</div>}
      {!list ? <Loading /> : (
        <div className="card"><div className="tbl-wrap"><table>
          <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Terdaftar</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}>
              <td><input className="inp xs-w" defaultValue={p.nama || ""} aria-label="Nama" onBlur={(e) => { if (e.target.value.trim() !== (p.nama || "")) change(p, { nama: e.target.value.trim() }); }} /></td>
              <td>{p.email}</td>
              <td>
                <select className="inp" value={p.role} disabled={p.id === session?.user.id} onChange={(e) => change(p, { role: e.target.value as api.Role })} aria-label="Peran">
                  {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                </select>
                {p.id === session?.user.id && <div className="cell-sub">Akun Anda</div>}
              </td>
              <td className="cell-sub">{p.created_at ? new Date(p.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" }) : ""}</td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
      <div className="card pad note">
        <b>Menambah pengguna baru</b>
        <ol>
          <li>Buka dashboard Supabase → <b>Authentication → Users → Add user → Create new user</b>.</li>
          <li>Isi email & kata sandi awal, centang <i>Auto Confirm User</i>, lalu simpan.</li>
          <li>Kembali ke halaman ini, klik <b>Muat ulang</b>, lalu ubah perannya (akun baru berstatus Nonaktif sampai diberi peran).</li>
        </ol>
      </div>
    </>
  );
}

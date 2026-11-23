import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Pencil, Save, Trash2, X } from "lucide-react";
import { Modal } from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useJenisIzin, useSicantik } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { fmtDateLong, fmtInt } from "../lib/format";
import { KATEGORI_IZIN, newJenisIzin, persyaratanList, type JenisIzin } from "../lib/master";
import { avgLama, groupIzin, lamaProses } from "../lib/sicantik";
import * as api from "../lib/api";

export function JenisIzinModal({ nama, onClose }: { nama: string | null; onClose: () => void }) {
  const { byId, rows: all, refresh } = useJenisIzin();
  const sic = useSicantik();
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  const isNew = nama === null;
  const j = nama ? byId.get(nama) : undefined;
  const [edit, setEdit] = useState(isNew);
  const [f, setF] = useState<JenisIzin>(() => j ? { ...j } : newJenisIzin(""));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const izin = useMemo(() => (nama ? sic.rows.filter((r) => r.izin === nama).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))) : []), [sic.rows, nama]);
  const g = useMemo(() => groupIzin(izin, () => "x")[0], [izin]);
  const kategoriOpts = useMemo(() => [...new Set([...KATEGORI_IZIN, ...all.map((x) => x.kategori).filter(Boolean)])], [all]);
  if (!isNew && !j) return null;
  const syarat = persyaratanList(j);
  const sla = j?.lama_layanan ?? null;
  const tepat = sla != null ? izin.filter((r) => { const l = lamaProses(r); return l != null && l <= sla; }).length : 0;
  const nLama = izin.filter((r) => lamaProses(r) != null).length;

  const set = (k: keyof JenisIzin, v: string | number | boolean | null) => setF((o) => ({ ...o, [k]: v }));
  const save = async () => {
    const n = f.nama.trim();
    if (!n) return setErr("Nama jenis izin wajib diisi");
    if ((isNew || n !== nama) && byId.has(n)) return setErr("Nama jenis izin sudah ada");
    if (!isNew && n !== nama && izin.length && !(await confirm({ title: "Ganti nama jenis izin?", body: <>Nama izin pada <b>{fmtInt(izin.length)}</b> permohonan di arsip ikut diganti menjadi “{n}”.</>, ok: "Ganti nama" }))) return;
    setBusy(true);
    try {
      await api.saveJenisIzin({ ...f, nama: n, singkatan: f.singkatan.trim(), persyaratan: f.persyaratan.trim() }, isNew ? undefined : nama!);
      await Promise.all([refresh(), sic.refresh()]);
      toast("Jenis izin disimpan");
      onClose();
    } catch (e) { setErr(api.errMsg(e)); }
    setBusy(false);
  };
  const remove = async () => {
    if (!(await confirm({ title: "Hapus jenis izin?", body: <>“{nama}” dihapus dari master.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deleteJenisIzin(nama!); await refresh(); toast("Jenis izin dihapus"); onClose(); } catch (e) { toast(api.errMsg(e)); }
  };

  return (
    <Modal onClose={onClose} size="lg" label="Jenis izin">
      <div className="modal-h">
        <div>
          <h2>{isNew ? "Tambah jenis izin" : nama}</h2>
          {j && <div className="row-gap" style={{ marginTop: 6 }}>
            {j.singkatan && <span className="badge ok">{j.singkatan}</span>}
            <span className="badge">{j.kategori || "Tanpa kategori"}</span>
            {sla != null && <span className="badge">Standar {sla} hari</span>}
            {!j.aktif && <span className="badge warn">Nonaktif</span>}
          </div>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </div>
      <div className="modal-b">
        {edit ? (
          <div className="edit-box"><div className="fgrid">
            <div className="f span3"><label htmlFor="jn">Nama jenis izin <span className="req">*</span></label><input id="jn" className="inp" value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Persis seperti nama izin di SiCantik" />
              {!isNew && izin.length > 0 && <span className="hint">Mengganti nama akan memperbarui {fmtInt(izin.length)} permohonan.</span>}</div>
            <div className="f"><label htmlFor="js">Singkatan</label><input id="js" className="inp" value={f.singkatan} onChange={(e) => set("singkatan", e.target.value)} placeholder="mis. SIP-PV" /></div>
            <div className="f span2"><label htmlFor="jk">Kategori</label><input id="jk" className="inp" list="jkl" value={f.kategori} onChange={(e) => set("kategori", e.target.value)} /><datalist id="jkl">{kategoriOpts.map((k) => <option key={k} value={k} />)}</datalist></div>
            <div className="f"><label htmlFor="jl">Standar waktu layanan (hari)</label><input id="jl" className="inp" inputMode="numeric" value={f.lama_layanan ?? ""} onChange={(e) => set("lama_layanan", e.target.value.trim() === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0))} /><span className="hint">Untuk mengukur ketepatan waktu penetapan</span></div>
            <div className="f span2"><label htmlFor="jm">Masa berlaku</label><input id="jm" className="inp" value={f.masa_berlaku} onChange={(e) => set("masa_berlaku", e.target.value)} placeholder="mis. 5 tahun / mengikuti masa berlaku STR" /></div>
            <div className="f span3"><label htmlFor="jp">Persyaratan dokumen (satu per baris)</label><textarea id="jp" className="inp" rows={6} value={f.persyaratan} onChange={(e) => set("persyaratan", e.target.value)} placeholder={"KTP\nSTR yang masih berlaku\nSurat Rekomendasi Organisasi Profesi\nPas Foto"} /><span className="hint">Dipakai sebagai daftar periksa dokumen arsip & pilihan jenis dokumen saat unggah</span></div>
            <div className="f span3"><label htmlFor="jket">Keterangan / dasar hukum</label><input id="jket" className="inp" value={f.keterangan} onChange={(e) => set("keterangan", e.target.value)} /></div>
            <label className="chk f span3"><input type="checkbox" checked={f.aktif} onChange={(e) => set("aktif", e.target.checked)} />Aktif (muncul sebagai pilihan saat input permohonan)</label>
          </div>
            {err && <div className="alert" style={{ margin: "0 14px 10px" }}>{err}</div>}
            <div className="row-gap end">
              <button className="btn" onClick={() => (isNew ? onClose() : (setEdit(false), setF({ ...j! }), setErr("")))}>Batal</button>
              <button className="btn primary" disabled={busy} onClick={save}><Save size={16} />Simpan</button>
            </div>
          </div>
        ) : j && (
          <>
            <div className="stats" style={{ marginTop: 0 }}>
              <div className="stat"><b>{fmtInt(izin.length)}</b><span>permohonan</span></div>
              <div className="stat"><b>{fmtInt(g?.terbit || 0)}</b><span>ditetapkan</span></div>
              <div className="stat"><b>{g && avgLama(g) != null ? avgLama(g)!.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "—"}</b><span>rata-rata proses (hari)</span></div>
              {sla != null && <div className={"stat" + (nLama && tepat / nLama < 0.8 ? " bad" : " good")}><b>{nLama ? Math.round((tepat / nLama) * 100) + "%" : "—"}</b><span>tepat waktu (≤ {sla} hari)</span></div>}
            </div>
            <dl className="dl">
              <div><dt>Masa berlaku</dt><dd>{j.masa_berlaku || <span className="muted">—</span>}</dd></div>
              <div className="span2"><dt>Keterangan / dasar hukum</dt><dd>{j.keterangan || <span className="muted">—</span>}</dd></div>
            </dl>
            <div className="dsec">Persyaratan dokumen <span className="count">{syarat.length}</span></div>
            {syarat.length ? <ul className="syarat">{syarat.map((s) => <li key={s}><CheckCircle2 size={15} />{s}</li>)}</ul> : <div className="cell-sub">Belum diisi.{isAdmin && " Klik Ubah untuk menambahkan persyaratan."}</div>}
            <div className="dsec">Permohonan terbaru</div>
            {izin.length ? <div className="tbl-wrap"><table className="mini-tbl"><tbody>{izin.slice(0, 10).map((r) => (
              <tr key={r.id_sicantik} className="clk" onClick={() => { onClose(); nav(`/sicantik/data?id=${encodeURIComponent(r.id_sicantik)}`); }}>
                <td><div className="cell-main">{r.pemohon}</div><div className="cell-sub">{r.lokasi}</div></td><td>{r.jenis}</td><td className="nowrap">{fmtDateLong(r.tanggal)}</td>
                <td className="num nowrap">{lamaProses(r) != null ? `${lamaProses(r)} hari` : <span className="badge warn">Belum</span>}</td>
              </tr>))}</tbody></table>{izin.length > 10 && <p className="cell-sub">…dan {fmtInt(izin.length - 10)} lainnya.</p>}</div> : <div className="cell-sub">Belum ada permohonan.</div>}
          </>
        )}
      </div>
      {isAdmin && !edit && (
        <div className="modal-f">
          {izin.length === 0 && <button className="btn danger" onClick={remove}><Trash2 size={16} />Hapus</button>}
          <span className="grow" />
          <button className="btn primary" onClick={() => setEdit(true)}><Pencil size={16} />Ubah</button>
        </div>
      )}
    </Modal>
  );
}

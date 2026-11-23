import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { Modal } from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useData, useKbli } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { fmtInt, fmtRpShort } from "../lib/format";
import { kbliKey, TINGKAT, titleCase, type Kbli } from "../lib/master";
import * as api from "../lib/api";

const blank = (): Kbli => ({ versi: "2025", kode: "", tingkat: "Kelompok", judul: "", kategori: "", aktif: true, uraian: "" });

/** Detail satu kode KBLI: hierarki, uraian, turunan, dan proyek di arsip yang memakainya */
export function KbliModal({ k0, onClose, onOpen, isNew }: { k0?: Kbli; onClose: () => void; onOpen: (k: Kbli) => void; isNew?: boolean }) {
  const { rows, index, refresh } = useKbli();
  const oss = useData();
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  const k = k0 || blank();
  const [uraian, setUraian] = useState<string | null>(isNew ? "" : null);
  const [edit, setEdit] = useState(!!isNew);
  const [f, setF] = useState<Kbli>({ ...k });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    setUraian(null);
    api.getKbliUraian(k.versi, k.kode).then((u) => { if (alive) { setUraian(u); setF((o) => ({ ...o, uraian: u })); } }).catch(() => alive && setUraian(""));
    return () => { alive = false; };
  }, [k.versi, k.kode, isNew]);

  const lineage = useMemo(() => (isNew ? [] : index.lineage(k)), [index, k, isNew]);
  const children = useMemo(() => rows.filter((r) => r.versi === k.versi && r.kode !== k.kode && (k.tingkat === "Kategori" ? r.tingkat === "Golongan Pokok" && r.kategori === k.kode : r.kode.length === k.kode.length + 1 && r.kode.startsWith(k.kode))), [rows, k]);
  const proyek = useMemo(() => oss.rows.filter((r) => (k.tingkat === "Kategori" ? index.kategoriOf(r.kbli) === k.kode : r.kbli.startsWith(k.kode))), [oss.rows, k, index]);

  const save = async () => {
    const kode = f.kode.trim().toUpperCase();
    if (!kode || !f.judul.trim()) return setErr("Kode dan judul wajib diisi");
    if ((isNew || kode !== k.kode || f.versi !== k.versi) && rows.some((r) => r.versi === f.versi && r.kode === kode)) return setErr(`Kode ${kode} sudah ada di KBLI ${f.versi}`);
    setBusy(true);
    try {
      const rec = { ...f, kode, judul: f.judul.trim(), kategori: (f.kategori || index.kategoriOf(kode)).toUpperCase() };
      await api.saveKbli(rec, isNew ? undefined : { versi: k.versi, kode: k.kode });
      await refresh();
      toast("KBLI disimpan");
      if (isNew) onClose(); else setEdit(false);
    } catch (e) { setErr(api.errMsg(e)); }
    setBusy(false);
  };
  const remove = async () => {
    if (!(await confirm({ title: "Hapus kode KBLI?", body: <>Kode <b>{k.kode}</b> ({k.judul}) dihapus dari Master KBLI {k.versi}. Data proyek di arsip tidak berubah.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deleteKbli(k.versi, k.kode); await refresh(); toast("Kode KBLI dihapus"); onClose(); } catch (e) { toast(api.errMsg(e)); }
  };
  const set = (key: keyof Kbli, v: string | boolean) => setF((o) => ({ ...o, [key]: v }));

  return (
    <Modal onClose={onClose} size="lg" label="Detail KBLI">
      <div className="modal-h">
        <div>
          {lineage.length > 0 && (
            <div className="crumbs">{lineage.map((p) => <span key={kbliKey(p)}><button onClick={() => onOpen(p)}>{p.kode} · {titleCase(p.judul).slice(0, 40)}{p.judul.length > 40 ? "…" : ""}</button> <ChevronRight size={12} /></span>)}</div>
          )}
          <h2>{isNew ? "Tambah kode KBLI" : <><span className="mono">{k.kode}</span> · {k.judul}</>}</h2>
          {!isNew && <div className="row-gap" style={{ marginTop: 6 }}>
            <span className={"badge t-" + k.tingkat.replace(" ", "-")}>{k.tingkat}</span>
            <span className="badge">Kategori {index.kategoriLabel(k.kategori)}</span>
            <span className="badge">KBLI {k.versi}</span>
            {!k.aktif && <span className="badge warn">Nonaktif</span>}
          </div>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </div>
      <div className="modal-b">
        {edit ? (
          <div className="edit-box"><div className="fgrid">
            <div className="f"><label htmlFor="kv">Versi</label><input id="kv" className="inp" value={f.versi} onChange={(e) => set("versi", e.target.value)} /></div>
            <div className="f"><label htmlFor="kk">Kode <span className="req">*</span></label><input id="kk" className="inp" value={f.kode} onChange={(e) => set("kode", e.target.value)} /></div>
            <div className="f"><label htmlFor="kt">Tingkat</label><select id="kt" className="inp" value={f.tingkat} onChange={(e) => set("tingkat", e.target.value)}>{TINGKAT.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="f span2"><label htmlFor="kj">Judul <span className="req">*</span></label><input id="kj" className="inp" value={f.judul} onChange={(e) => set("judul", e.target.value)} /></div>
            <div className="f"><label htmlFor="kc">Kategori (A–V)</label><input id="kc" className="inp" maxLength={1} value={f.kategori} onChange={(e) => set("kategori", e.target.value.toUpperCase())} placeholder="otomatis dari kode" /></div>
            <div className="f span3"><label htmlFor="ku">Uraian</label><textarea id="ku" className="inp" rows={7} value={f.uraian || ""} onChange={(e) => set("uraian", e.target.value)} /></div>
            <label className="chk f span3"><input type="checkbox" checked={f.aktif} onChange={(e) => set("aktif", e.target.checked)} />Aktif (muncul sebagai pilihan saat input proyek)</label>
          </div>
            {err && <div className="alert" style={{ margin: "0 14px 10px" }}>{err}</div>}
            <div className="row-gap end">
              <button className="btn" onClick={() => (isNew ? onClose() : (setEdit(false), setF({ ...k, uraian: uraian || "" }), setErr("")))}>Batal</button>
              <button className="btn primary" disabled={busy} onClick={save}><Save size={16} />Simpan</button>
            </div>
          </div>
        ) : (
          <>
            <div className="dsec">Uraian</div>
            {uraian === null ? <div className="loading" style={{ padding: 16 }}><span className="spin" />Memuat uraian…</div> : <div className="uraian">{uraian || "—"}</div>}
          </>
        )}
        {!isNew && children.length > 0 && (
          <>
            <div className="dsec">Turunan <span className="count">{children.length}</span></div>
            <div className="tbl-wrap"><table className="mini-tbl"><tbody>
              {children.map((c) => <tr key={kbliKey(c)} className="clk" onClick={() => onOpen(c)}><td className="tree-kode">{c.kode}</td><td>{c.judul}</td><td><span className={"badge t-" + c.tingkat.replace(" ", "-")}>{c.tingkat}</span></td></tr>)}
            </tbody></table></div>
          </>
        )}
        {!isNew && (
          <>
            <div className="dsec">Dipakai di arsip OSS <span className="count">{proyek.length}</span></div>
            {proyek.length ? (
              <div className="tbl-wrap"><table className="mini-tbl"><tbody>
                {proyek.slice(0, 30).map((r) => (
                  <tr key={r.id_proyek} className="clk" onClick={() => { onClose(); nav(`/oss/data?id=${encodeURIComponent(r.id_proyek)}`); }}>
                    <td><div className="cell-main">{r.nama_proyek || r.nama_perusahaan}</div><div className="cell-sub">{r.nama_perusahaan} · NIB {r.nib}</div></td>
                    <td className="tree-kode">{r.kbli}</td><td className="num">{r.investasi != null ? fmtRpShort(r.investasi) : "—"}</td>
                  </tr>
                ))}
              </tbody></table>{proyek.length > 30 && <p className="cell-sub">…dan {fmtInt(proyek.length - 30)} proyek lainnya.</p>}</div>
            ) : <div className="cell-sub">Belum ada proyek di arsip dengan KBLI ini.</div>}
          </>
        )}
      </div>
      {isAdmin && !edit && (
        <div className="modal-f">
          <button className="btn danger" onClick={remove}><Trash2 size={16} />Hapus</button>
          <span className="grow" />
          <button className="btn" disabled={uraian === null} onClick={() => setEdit(true)}>{uraian === null ? <Loader2 size={16} className="spin-ico" /> : <Pencil size={16} />}Ubah</button>
        </div>
      )}
    </Modal>
  );
}

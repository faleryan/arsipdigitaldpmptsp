import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil, PlusCircle, Save, Trash2, X } from "lucide-react";
import { Modal } from "./Modal";
import { DocsPanel } from "./DocsPanel";
import { FieldGrid } from "./FormFields";
import { useAuth } from "../context/AuthContext";
import { useData, usePelaku } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { PRETTY, type FieldKey } from "../lib/columns";
import { fmtDateLong, fmtInt, fmtRpShort, kecLabel, maskNik, normalizeRecord } from "../lib/format";
import { PELAKU_FIELDS, toFormValues, validatePelaku } from "../lib/forms";
import * as api from "../lib/api";

/** Detail pelaku usaha: data induk + semua proyeknya */
export function PelakuModal({ nib, onClose, startEdit = false }: { nib: string; onClose: () => void; startEdit?: boolean }) {
  const { byId, refresh } = usePelaku();
  const oss = useData();
  const { canWrite } = useAuth();
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  const p = byId.get(nib);
  const [edit, setEdit] = useState(startEdit);
  const [v, setV] = useState<Record<string, string>>(() => toFormValues(p, PELAKU_FIELDS));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [nikOpen, setNikOpen] = useState(false);
  const proyek = useMemo(() => oss.rows.filter((r) => r.nib === nib).sort((a, b) => String(b.tgl_pengajuan).localeCompare(String(a.tgl_pengajuan))), [oss.rows, nib]);
  if (!p) return null;
  const inv = proyek.reduce((s, r) => s + (r.investasi || 0), 0);
  const tki = proyek.reduce((s, r) => s + (r.tki || 0), 0);
  const nDoc = proyek.reduce((s, r) => s + (r.oss_dokumen?.length || 0), 0);

  const save = async () => {
    const e = validatePelaku(v);
    const newNib = v.nib.trim();
    if (!e.nib && newNib !== nib && byId.has(newNib)) e.nib = "NIB tersebut sudah dipakai pelaku lain";
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const rec = normalizeRecord(v);
      await api.updatePelaku(nib, rec);
      await Promise.all([refresh(), oss.refresh()]);
      toast("Data pelaku usaha disimpan" + (proyek.length ? ` — berlaku untuk ${proyek.length} proyeknya` : ""));
      if (newNib !== nib) { onClose(); return; }
      setEdit(false);
    } catch (x) { toast(api.errMsg(x), 6000); }
    setBusy(false);
  };
  const remove = async () => {
    if (!(await confirm({ title: "Hapus pelaku usaha?", body: <>Data pelaku <b>{p.nama_perusahaan}</b> (NIB {p.nib}) akan dihapus.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deletePelaku(nib, p.pelaku_dokumen || []); toast("Pelaku usaha dihapus"); onClose(); refresh(); } catch (x) { toast(api.errMsg(x), 6000); }
  };
  const show = (k: FieldKey) => {
    const val = k === "tgl_terbit_oss" ? fmtDateLong(p.tgl_terbit_oss) : String(p[k as keyof typeof p] ?? "");
    if (k === "nik" && p.nik) return <>{nikOpen ? p.nik : maskNik(p.nik)} <button className="link small" onClick={() => setNikOpen(!nikOpen)}>{nikOpen ? "Sembunyikan" : "Tampilkan"}</button></>;
    return val || <span className="muted">—</span>;
  };

  return (
    <Modal onClose={onClose} size="lg" label="Detail pelaku usaha">
      <div className="modal-h">
        <div><h2>{p.nama_perusahaan}</h2><p className="mono">NIB {p.nib}</p>
          <div className="row-gap" style={{ marginTop: 6 }}>
            <span className="badge ok">{fmtInt(proyek.length)} proyek</span>
            <span className="badge">Investasi {fmtRpShort(inv)}</span>
            <span className="badge">{fmtInt(tki)} tenaga kerja</span>
            <span className={"badge " + ((p.pelaku_dokumen?.length || 0) ? "nib" : "warn")}>{(p.pelaku_dokumen?.length || 0) ? `${p.pelaku_dokumen!.length} dok. pelaku` : "Dokumen NIB belum ada"}</span>
            <span className="badge">{fmtInt(nDoc)} dok. proyek</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </div>
      <div className="modal-b">
        <div className="dsec">Data pelaku usaha</div>
        {edit ? (
          <div className="edit-box">
            <FieldGrid fields={PELAKU_FIELDS} v={v} errs={errs} set={(k, val) => setV((o) => ({ ...o, [k]: val }))} idPrefix="pm_" />
            <div className="row-gap end">
              <button className="btn" onClick={() => { setEdit(false); setV(toFormValues(p, PELAKU_FIELDS)); setErrs({}); }}>Batal</button>
              <button className="btn primary" disabled={busy} onClick={save}><Save size={16} />Simpan</button>
            </div>
          </div>
        ) : (
          <dl className="dl">
            {PELAKU_FIELDS.map((f) => <div key={f.k}><dt>{PRETTY[f.k as FieldKey]}</dt><dd className={f.k === "nib" || f.k === "nik" ? "mono" : ""}>{show(f.k as FieldKey)}</dd></div>)}
          </dl>
        )}
        <DocsPanel kind="pelaku" id={p.nib} docs={p.pelaku_dokumen || []} canWrite={canWrite} onChanged={async () => { await Promise.all([refresh(), oss.refresh()]); }}
          title="Dokumen pelaku usaha" hint="NIB, akta pendirian, NPWP, KTP penanggung jawab — cukup diunggah sekali, berlaku untuk semua proyek NIB ini." />
        <div className="dsec">Proyek / KBLI <span className="count">{proyek.length}</span></div>
        {proyek.length ? (
          <div className="tbl-wrap"><table className="mini-tbl">
            <thead><tr><th>Proyek</th><th>KBLI</th><th>Lokasi</th><th>Tgl pengajuan</th><th className="num">Investasi</th><th>Dok.</th></tr></thead>
            <tbody>{proyek.map((r) => (
              <tr key={r.id_proyek} className="clk" tabIndex={0} onClick={() => { onClose(); nav(`/oss/data?id=${encodeURIComponent(r.id_proyek)}`); }}>
                <td><div className="cell-main">{r.nama_proyek || "—"}</div><div className="cell-sub mono">{r.id_proyek}</div></td>
                <td><span className="mono">{r.kbli}</span><div className="cell-sub">{r.judul_kbli}</div></td>
                <td>{kecLabel(r.kec_usaha)}<div className="cell-sub">{r.kel_usaha}</div></td>
                <td className="nowrap">{fmtDateLong(r.tgl_pengajuan)}</td>
                <td className="num">{r.investasi != null ? fmtRpShort(r.investasi) : "—"}</td>
                <td>{r.oss_dokumen?.length ? <span className="badge ok"><FileText size={12} />{r.oss_dokumen.length}</span> : <span className="cell-sub">—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="cell-sub">Belum ada proyek untuk pelaku usaha ini.</div>}
      </div>
      <div className="modal-f">
        {canWrite ? (
          <>
            {proyek.length === 0 && <button className="btn danger" onClick={remove}><Trash2 size={16} />Hapus</button>}
            <span className="grow" />
            {!edit && <button className="btn" onClick={() => setEdit(true)}><Pencil size={16} />Ubah data pelaku</button>}
            <button className="btn primary" onClick={() => { onClose(); nav(`/oss/input?nib=${encodeURIComponent(nib)}`); }}><PlusCircle size={16} />Tambah proyek</button>
          </>
        ) : <button className="btn" onClick={onClose}>Tutup</button>}
      </div>
    </Modal>
  );
}

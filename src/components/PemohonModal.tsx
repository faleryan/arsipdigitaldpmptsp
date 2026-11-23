import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil, PlusCircle, Save, Trash2, X } from "lucide-react";
import { Modal } from "./Modal";
import { FieldGrid } from "./FormFields";
import { useAuth } from "../context/AuthContext";
import { usePemohon, useSicantik } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { fmtDateLong, fmtInt, maskNik } from "../lib/format";
import { PEMOHON_FIELDS, toFormValues, validatePemohon } from "../lib/forms";
import { izinShort, statusOf } from "../lib/sicantik";
import * as api from "../lib/api";

/** Detail pemohon: data induk + semua permohonan izinnya */
export function PemohonModal({ id, onClose, startEdit = false }: { id: string; onClose: () => void; startEdit?: boolean }) {
  const { byId, rows: all, refresh } = usePemohon();
  const sic = useSicantik();
  const { canWrite } = useAuth();
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  const p = byId.get(id);
  const [edit, setEdit] = useState(startEdit);
  const [v, setV] = useState<Record<string, string>>(() => toFormValues(p, PEMOHON_FIELDS));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [ktpOpen, setKtpOpen] = useState(false);
  const izin = useMemo(() => sic.rows.filter((r) => r.pemohon_id === id).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))), [sic.rows, id]);
  if (!p) return null;
  const terbit = izin.filter((r) => statusOf(r) === "Sudah ditetapkan").length;
  const nDoc = izin.reduce((s, r) => s + (r.sicantik_dokumen?.length || 0), 0);

  const save = async () => {
    const e = validatePemohon(v);
    const ktp = v.no_ktp.trim();
    const dup = ktp && all.find((x) => x.no_ktp === ktp && x.id_pemohon !== id);
    if (!e.no_ktp && dup) e.no_ktp = `No. KTP ini sudah dipakai pemohon ${dup.nama}`;
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.updatePemohon(id, { nama: v.nama.trim(), no_ktp: ktp, no_hp: v.no_hp.trim(), email: v.email.trim() });
      await Promise.all([refresh(), sic.refresh()]);
      toast("Data pemohon disimpan" + (izin.length ? ` — berlaku untuk ${izin.length} permohonannya` : ""));
      setEdit(false);
    } catch (x) { toast(api.errMsg(x), 6000); }
    setBusy(false);
  };
  const remove = async () => {
    if (!(await confirm({ title: "Hapus pemohon?", body: <>Data pemohon <b>{p.nama}</b> akan dihapus.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deletePemohon(id); toast("Pemohon dihapus"); onClose(); refresh(); } catch (x) { toast(api.errMsg(x), 6000); }
  };

  return (
    <Modal onClose={onClose} size="lg" label="Detail pemohon">
      <div className="modal-h">
        <div><h2>{p.nama}</h2><p className="mono">{p.no_ktp ? `KTP ${maskNik(p.no_ktp)}` : "Tanpa No. KTP"}</p>
          <div className="row-gap" style={{ marginTop: 6 }}>
            <span className="badge ok">{fmtInt(izin.length)} permohonan</span>
            <span className="badge">{fmtInt(terbit)} ditetapkan</span>
            <span className="badge">{fmtInt(nDoc)} dokumen</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </div>
      <div className="modal-b">
        <div className="dsec">Data pemohon</div>
        {edit ? (
          <div className="edit-box">
            <FieldGrid fields={PEMOHON_FIELDS} v={v} errs={errs} set={(k, val) => setV((o) => ({ ...o, [k]: val }))} idPrefix="pe_" />
            <div className="row-gap end">
              <button className="btn" onClick={() => { setEdit(false); setV(toFormValues(p, PEMOHON_FIELDS)); setErrs({}); }}>Batal</button>
              <button className="btn primary" disabled={busy} onClick={save}><Save size={16} />Simpan</button>
            </div>
          </div>
        ) : (
          <dl className="dl">
            <div><dt>Nama Pemohon</dt><dd>{p.nama}</dd></div>
            <div><dt>No. KTP</dt><dd className="mono">{p.no_ktp ? <>{ktpOpen ? p.no_ktp : maskNik(p.no_ktp)} <button className="link small" onClick={() => setKtpOpen(!ktpOpen)}>{ktpOpen ? "Sembunyikan" : "Tampilkan"}</button></> : <span className="muted">—</span>}</dd></div>
            <div><dt>No. HP/Telp</dt><dd>{p.no_hp || <span className="muted">—</span>}</dd></div>
            <div><dt>Email</dt><dd>{p.email || <span className="muted">—</span>}</dd></div>
          </dl>
        )}
        <div className="dsec">Permohonan izin <span className="count">{izin.length}</span></div>
        {izin.length ? (
          <div className="tbl-wrap"><table className="mini-tbl">
            <thead><tr><th>Izin</th><th>Permohonan</th><th>Tanggal</th><th>Nomor izin</th><th>Dok.</th></tr></thead>
            <tbody>{izin.map((r) => (
              <tr key={r.id_sicantik} className="clk" tabIndex={0} onClick={() => { onClose(); nav(`/sicantik/data?id=${encodeURIComponent(r.id_sicantik)}`); }}>
                <td><div className="cell-main">{izinShort(r.izin)}</div><div className="cell-sub">{r.lokasi}</div></td>
                <td>{r.jenis}</td>
                <td className="nowrap">{fmtDateLong(r.tanggal)}</td>
                <td>{r.nomor_izin ? <span className="mono sm">{r.nomor_izin}</span> : <span className="badge warn">Belum ditetapkan</span>}</td>
                <td>{r.sicantik_dokumen?.length ? <span className="badge ok"><FileText size={12} />{r.sicantik_dokumen.length}</span> : <span className="cell-sub">—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="cell-sub">Belum ada permohonan untuk pemohon ini.</div>}
      </div>
      <div className="modal-f">
        {canWrite ? (
          <>
            {izin.length === 0 && <button className="btn danger" onClick={remove}><Trash2 size={16} />Hapus</button>}
            <span className="grow" />
            {!edit && <button className="btn" onClick={() => setEdit(true)}><Pencil size={16} />Ubah data pemohon</button>}
            <button className="btn primary" onClick={() => { onClose(); nav(`/sicantik/input?pemohon=${encodeURIComponent(id)}`); }}><PlusCircle size={16} />Tambah permohonan</button>
          </>
        ) : <button className="btn" onClick={onClose}>Tutup</button>}
      </div>
    </Modal>
  );
}

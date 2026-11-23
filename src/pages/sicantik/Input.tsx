import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileText, Loader2, Pencil, Save, UserPlus, Users } from "lucide-react";
import { usePemohon, useSicantik } from "../../context/DataContext";
import { useUI } from "../../context/UIContext";
import { pad2 } from "../../lib/format";
import { IZIN_SECTIONS, PEMOHON_FIELDS, pemohonPickItem, toFormValues, validateIzin, validatePemohon } from "../../lib/forms";
import { normalizeIzin, pemohonIdOf, type Izin } from "../../lib/sicantik";
import * as api from "../../lib/api";
import { Loading } from "../../components/Loading";
import { StatusBanner } from "../../components/StatusBanner";
import { FieldGrid } from "../../components/FormFields";
import { MasterPicker } from "../../components/MasterPicker";
import { DocUploader, LABELS_SICANTIK, type PendingDoc } from "../../components/DocUploader";
import { uploadAll } from "../../components/DocsPanel";
import { PemohonModal } from "../../components/PemohonModal";

const IZIN_FIELDS = IZIN_SECTIONS.flatMap((s) => s.fields);
const autoId = () => { const d = new Date(); return `M-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`; };

export default function SicantikInput() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const editId = id ? decodeURIComponent(id) : null;
  const sic = useSicantik();
  const pem = usePemohon();
  const editing = editId ? sic.byId.get(editId) : undefined;
  if (!sic.loaded || !pem.loaded) return <Loading />;
  if (editId && !editing) return <div className="card pad">Data <span className="mono">{editId}</span> tidak ditemukan.</div>;
  return <Form key={editId || "new"} editing={editing} initialPemohon={params.get("pemohon")} />;
}

function Form({ editing, initialPemohon }: { editing?: Izin; initialPemohon: string | null }) {
  const { rows, byId, refresh } = useSicantik();
  const pem = usePemohon();
  const { toast } = useUI();
  const nav = useNavigate();

  const [pid, setPid] = useState<string | null>(editing?.pemohon_id || (initialPemohon && pem.byId.has(initialPemohon) ? initialPemohon : null));
  const [newMode, setNewMode] = useState(false);
  const [pv, setPv] = useState<Record<string, string>>(() => toFormValues(undefined, PEMOHON_FIELDS));
  const [perrs, setPerrs] = useState<Record<string, string>>({});
  const [pickErr, setPickErr] = useState("");
  const [editPemohon, setEditPemohon] = useState(false);

  const [v, setV] = useState<Record<string, string>>(() => ({ ...toFormValues(editing, IZIN_FIELDS, { jenis: "Baru" }), keterangan: editing?.keterangan || "" }));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingDoc[]>([]);
  const [busy, setBusy] = useState("");

  const countByPemohon = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r) => m.set(r.pemohon_id, (m.get(r.pemohon_id) || 0) + 1)); return m; }, [rows]);
  const pickItems = useMemo(() => [...pem.rows].sort((a, b) => a.nama.localeCompare(b.nama, "id")).map((p) => pemohonPickItem(p, countByPemohon.get(p.id_pemohon) || 0)), [pem.rows, countByPemohon]);
  const lists = useMemo(() => {
    const u = (k: keyof Izin) => [...new Set(rows.map((r) => String(r[k] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
    return { izin: u("izin"), lokasi: u("lokasi") };
  }, [rows]);
  const sel = pid ? pem.byId.get(pid) : undefined;
  const others = pid ? rows.filter((r) => r.pemohon_id === pid && r.id_sicantik !== editing?.id_sicantik) : [];
  const lastLokasi = others.find((r) => r.lokasi)?.lokasi;

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  const findByKtp = (ktp: string) => (ktp ? pem.rows.find((p) => p.no_ktp === ktp) : undefined);

  const reset = () => { setV(toFormValues(undefined, IZIN_FIELDS, { jenis: "Baru" })); setPending([]); setErrs({}); window.scrollTo(0, 0); };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validateIzin(v);
    if (!editing && v.id_sicantik.trim() && byId.has(v.id_sicantik.trim())) e.id_sicantik = "ID sudah ada di arsip";
    let pe: Record<string, string> = {};
    if (newMode) {
      pe = validatePemohon(pv);
      const ex = findByKtp(pv.no_ktp.trim());
      if (!pe.no_ktp && ex) pe.no_ktp = `Sudah terdaftar atas nama ${ex.nama} — pilih dari daftar`;
      else if (!pe.nama && pem.byId.has(pemohonIdOf(pv.nama, pv.no_ktp))) pe.nama = "Pemohon dengan nama ini sudah ada — pilih dari daftar";
    }
    const none = !newMode && !pid;
    setErrs(e); setPerrs(pe); setPickErr(none ? "Pilih pemohon atau tambahkan yang baru" : "");
    if (none || Object.keys(e).length || Object.keys(pe).length) {
      const first = none ? "pickerInput" : Object.keys(pe)[0] ? "np_" + Object.keys(pe)[0] : "si_" + Object.keys(e)[0];
      document.getElementById(first)?.focus();
      toast("Periksa kembali isian yang ditandai");
      return;
    }
    try {
      setBusy("Menyimpan…");
      let thePid = pid!;
      if (newMode) {
        thePid = pemohonIdOf(pv.nama, pv.no_ktp);
        await api.insertPemohon({ id_pemohon: thePid, nama: pv.nama.trim(), no_ktp: pv.no_ktp.trim(), no_hp: pv.no_hp.trim(), email: pv.email.trim() });
      }
      const raw: Record<string, unknown> = { ...v, pemohon_id: thePid };
      if (!String(raw.id_sicantik || "").trim()) raw.id_sicantik = autoId();
      if (!String(raw.lokasi_izin || "").trim()) raw.lokasi_izin = raw.lokasi;
      const rec = normalizeIzin(raw);
      if (editing) await api.updateIzin(editing.id_sicantik, rec);
      else await api.insertIzin(rec);
      if (pending.length) {
        setBusy("Mengunggah dokumen…");
        await uploadAll("sicantik", rec.id_sicantik, pending, (i) => setBusy(`Mengunggah dokumen ${i + 1}/${pending.length}…`));
      }
      await Promise.all([refresh(), pem.refresh()]);
      toast(editing ? "Perubahan disimpan" : `Permohonan tersimpan${pending.length ? ` dengan ${pending.length} dokumen` : ""}`);
      if (editing) nav(`/sicantik/data?id=${encodeURIComponent(rec.id_sicantik)}`);
      else { setNewMode(false); setPid(thePid); reset(); }
    } catch (x) { toast(api.errMsg(x), 6000); }
    setBusy("");
  };

  return (
    <>
      <StatusBanner kind="sicantik" />
      <div className="head">
        <div><h1>{editing ? "Edit permohonan izin" : "Input permohonan SiCantik"}</h1>
          <p>{editing ? <span className="mono">ID {editing.id_sicantik}</span> : "Pilih pemohon (No. KTP atau nama), lalu isi data izinnya. Satu pemohon bisa mengajukan banyak izin."}</p></div>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="card form-sec">
          <div className="card-h col"><h3><span className="step-no teal">1</span>Pemohon</h3><span>Cari berdasarkan No. KTP atau nama — data pemohon tidak perlu diketik ulang</span></div>
          {!newMode ? (
            <>
              <MasterPicker items={pickItems} value={pid} onSelect={(id) => { setPid(id); setPickErr(""); }}
                onNew={(typed) => { setNewMode(true); setPid(null); setPickErr(""); setPv((o) => ({ ...o, ...(/^\d+$/.test(typed) ? { no_ktp: typed } : { nama: typed }) })); }}
                label="No. KTP atau nama pemohon" placeholder="Ketik No. KTP atau nama pemohon…" newLabel="Tambah pemohon baru" error={pickErr} />
              {sel && (
                <div className="sec-switch">
                  <span className="cell-sub">{others.length ? `Pemohon ini sudah memiliki ${others.length} permohonan lain di arsip.` : "Belum ada permohonan lain untuk pemohon ini."}</span>
                  {lastLokasi && !v.lokasi && <button type="button" className="btn ghost sm" onClick={() => set("lokasi", lastLokasi)}>Pakai lokasi terakhir: {lastLokasi}</button>}
                  <span className="grow" />
                  <button type="button" className="btn sm" onClick={() => setEditPemohon(true)}><Pencil size={14} />Lihat / ubah data pemohon</button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sec-switch"><span className="badge ok"><UserPlus size={13} />Pemohon baru</span><span className="grow" />
                <button type="button" className="btn sm" onClick={() => { setNewMode(false); setPerrs({}); }}><Users size={14} />Pilih dari arsip</button></div>
              <FieldGrid fields={PEMOHON_FIELDS} v={pv} errs={perrs} set={(k, val) => setPv((o) => ({ ...o, [k]: val }))} idPrefix="np_"
                onBlur={(f) => {
                  if (f.k !== "no_ktp") return;
                  const ex = findByKtp(pv.no_ktp.trim());
                  if (ex) { setPid(ex.id_pemohon); setNewMode(false); toast("No. KTP ini sudah terdaftar — pemohon dipilih dari arsip"); }
                }} />
            </>
          )}
        </div>

        {IZIN_SECTIONS.map((sec, i) => (
          <div className="card form-sec" key={sec.title}>
            <div className="card-h col"><h3><span className="step-no teal">{i + 2}</span>{sec.title}</h3><span>{sec.desc}</span></div>
            <FieldGrid fields={sec.fields.map((f) => (f.k === "id_sicantik" && editing ? { ...f, readOnly: true } : f))} v={v} errs={errs} set={set} lists={lists} idPrefix="si_" />
          </div>
        ))}

        <div className="card form-sec">
          <div className="card-h col"><h3><span className="step-no teal">{IZIN_SECTIONS.length + 2}</span>Arsip dokumen</h3><span>Lampirkan sebanyak yang diperlukan; beri jenis dokumen pada setiap file</span></div>
          <div className="fgrid">
            <div className="f span3">
              <label htmlFor="si_keterangan">Tautan / keterangan arsip</label>
              <input id="si_keterangan" className="inp" value={v.keterangan} onChange={(e) => set("keterangan", e.target.value)} placeholder="Opsional: tautan Google Drive, nomor box/rak arsip fisik, atau catatan" />
            </div>
            <div className="f span3">
              {editing?.sicantik_dokumen?.length ? (
                <div className="docs saved">{editing.sicantik_dokumen.map((d) => <div className="doc-item" key={d.id}><FileText size={16} className="doc-ico" /><span className="nm">{d.label && <span className="doc-tag">{d.label}</span>}{d.nama_file}</span><span className="cell-sub">tersimpan</span></div>)}</div>
              ) : null}
              <DocUploader pending={pending} onChange={setPending} labels={LABELS_SICANTIK} onReject={(m) => toast(m, 6000)} />
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => (editing ? nav(-1) : reset())}>{editing ? "Batal" : "Kosongkan"}</button>
          <button className="btn primary" disabled={!!busy}>{busy ? <Loader2 size={16} className="spin-ico" /> : <Save size={16} />}{busy || (editing ? "Simpan perubahan" : "Simpan ke arsip")}</button>
        </div>
      </form>
      {editPemohon && pid && <PemohonModal id={pid} startEdit onClose={() => setEditPemohon(false)} />}
    </>
  );
}

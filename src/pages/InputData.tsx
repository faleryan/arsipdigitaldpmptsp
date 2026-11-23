import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileText, Loader2, Pencil, Save, UserPlus, Users } from "lucide-react";
import { useData, useKbli, usePelaku } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import type { Proyek } from "../lib/columns";
import { fmtInt, normalizeRecord, parseNum } from "../lib/format";
import { PELAKU_FIELDS, pelakuPickItem, PROYEK_DEFAULTS, PROYEK_SECTIONS, toFormValues, validatePelaku, validateProyek } from "../lib/forms";
import * as api from "../lib/api";
import { Loading } from "../components/Loading";
import { StatusBanner } from "../components/StatusBanner";
import { FieldGrid, type FieldDef } from "../components/FormFields";
import { MasterPicker } from "../components/MasterPicker";
import { DocUploader, LABELS_OSS, LABELS_PELAKU, type PendingDoc } from "../components/DocUploader";
import { uploadAll } from "../components/DocsPanel";
import { PelakuModal } from "../components/PelakuModal";
import { KbliInput, kbliOptions, type KbliOption } from "../components/KbliInput";

const PROYEK_FIELDS = PROYEK_SECTIONS.flatMap((s) => s.fields);

export default function InputData() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const editId = id ? decodeURIComponent(id) : null;
  const oss = useData();
  const pel = usePelaku();
  const editing = editId ? oss.byId.get(editId) : undefined;
  if (!oss.loaded || !pel.loaded) return <Loading />;
  if (editId && !editing) return <div className="card pad">Data <span className="mono">{editId}</span> tidak ditemukan.</div>;
  return <Form key={editId || "new"} editing={editing} initialNib={params.get("nib")} />;
}

function Form({ editing, initialNib }: { editing?: Proyek; initialNib: string | null }) {
  const { rows, byId, refresh } = useData();
  const pel = usePelaku();
  const kbli = useKbli();
  const { toast } = useUI();
  const nav = useNavigate();

  // ---- pelaku usaha: pilih yang sudah ada, atau buat baru
  const [nib, setNib] = useState<string | null>(editing?.nib || (initialNib && pel.byId.has(initialNib) ? initialNib : null));
  const [newMode, setNewMode] = useState(false);
  const [pv, setPv] = useState<Record<string, string>>(() => toFormValues(undefined, PELAKU_FIELDS, { status_pm: "PMDN" }));
  const [perrs, setPerrs] = useState<Record<string, string>>({});
  const [pickErr, setPickErr] = useState("");
  const [editPelaku, setEditPelaku] = useState(false);

  // ---- proyek
  const [v, setV] = useState<Record<string, string>>(() => ({ ...toFormValues(editing, PROYEK_FIELDS, PROYEK_DEFAULTS), arsip_dokumen: editing?.arsip_dokumen || "" }));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingDoc[]>([]);
  const [pendingPelaku, setPendingPelaku] = useState<PendingDoc[]>([]);
  const [busy, setBusy] = useState("");

  const countByNib = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r) => m.set(r.nib, (m.get(r.nib) || 0) + 1)); return m; }, [rows]);
  const pickItems = useMemo(() => [...pel.rows].sort((a, b) => a.nama_perusahaan.localeCompare(b.nama_perusahaan, "id")).map((p) => pelakuPickItem(p, countByNib.get(p.nib) || 0)), [pel.rows, countByNib]);
  const lists = useMemo(() => {
    const u = (k: keyof Proyek) => [...new Set(rows.map((r) => r[k] as string).filter(Boolean))].sort();
    return { kel_usaha: u("kel_usaha"), kbli: u("kbli"), sektor: u("sektor") };
  }, [rows]);
  const kbliMap = useMemo(() => {
    const m: Record<string, { judul: string; sektor: string }> = {};
    rows.forEach((r) => { if (r.kbli && r.judul_kbli && !m[r.kbli]) m[r.kbli] = { judul: r.judul_kbli, sektor: r.sektor }; });
    return m;
  }, [rows]);
  const kOptions = useMemo(() => kbliOptions(kbli.rows, kbli.index, kbliMap), [kbli.rows, kbli.index, kbliMap]);
  const kByKode = useMemo(() => new Map(kOptions.map((o) => [o.kode, o])), [kOptions]);
  /** KBLI diketik → judul (dan sektor dari arsip) ikut terisi otomatis */
  const setKbli = (code: string) => {
    const o = kByKode.get(code.trim());
    setV((p) => (o ? { ...p, kbli: code, judul_kbli: o.judul, sektor: p.sektor || kbliMap[o.kode]?.sektor || "" } : { ...p, kbli: code }));
  };
  const pickKbli = (o: KbliOption) => setV((p) => ({ ...p, kbli: o.kode, judul_kbli: o.judul, sektor: p.sektor || kbliMap[o.kode]?.sektor || "" }));
  const sel = nib ? pel.byId.get(nib) : undefined;
  const others = nib ? rows.filter((r) => r.nib === nib && r.id_proyek !== editing?.id_proyek) : [];

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  const onBlur = (f: FieldDef) => {
    if (f.type === "money") { const n = parseNum(v[f.k]); if (n != null) set(f.k, fmtInt(n)); }
  };
  const onPelakuBlur = (f: FieldDef) => {
    if (f.k === "nib") {
      const n = pv.nib.trim();
      if (pel.byId.has(n)) { setNib(n); setNewMode(false); toast("NIB ini sudah terdaftar — pelaku usaha dipilih dari arsip"); }
    }
  };

  const reset = () => {
    setV(toFormValues(undefined, PROYEK_FIELDS, PROYEK_DEFAULTS));
    setPending([]); setErrs({}); window.scrollTo(0, 0);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validateProyek(v);
    if (!editing && !e.id_proyek && byId.has(v.id_proyek.trim())) e.id_proyek = "Nomor Permohonan sudah ada di arsip";
    let pe: Record<string, string> = {};
    if (newMode) {
      pe = validatePelaku(pv);
      if (!pe.nib && pel.byId.has(pv.nib.trim())) pe.nib = "NIB sudah terdaftar — pilih dari daftar";
    }
    const noPelaku = !newMode && !nib;
    setErrs(e); setPerrs(pe); setPickErr(noPelaku ? "Pilih pelaku usaha atau tambahkan yang baru" : "");
    if (noPelaku || Object.keys(e).length || Object.keys(pe).length) {
      const firstId = noPelaku ? "pickerInput" : Object.keys(pe)[0] ? "np_" + Object.keys(pe)[0] : "fi_" + Object.keys(e)[0];
      document.getElementById(firstId)?.focus();
      toast("Periksa kembali isian yang ditandai");
      return;
    }
    try {
      setBusy("Menyimpan…");
      let theNib = nib!;
      if (newMode) {
        const p = normalizeRecord(pv);
        await api.insertPelaku(p);
        theNib = p.nib;
      }
      const rec = { ...normalizeRecord(v), nib: theNib };
      if (editing) await api.updateProyek(editing.id_proyek, rec);
      else await api.insertProyek(rec);
      if (pendingPelaku.length) {
        await uploadAll("pelaku", theNib, pendingPelaku, (i) => setBusy(`Mengunggah dokumen pelaku ${i + 1}/${pendingPelaku.length}…`));
        setPendingPelaku([]);
      }
      if (pending.length) {
        setBusy("Mengunggah dokumen…");
        await uploadAll("oss", rec.id_proyek, pending, (i) => setBusy(`Mengunggah dokumen proyek ${i + 1}/${pending.length}…`));
      }
      await Promise.all([refresh(), pel.refresh()]);
      toast(editing ? "Perubahan disimpan" : `Proyek tersimpan${pending.length ? ` dengan ${pending.length} dokumen` : ""}`);
      setPendingPelaku([]);
      if (editing) nav(`/oss/data?id=${encodeURIComponent(rec.id_proyek)}`);
      else { setNewMode(false); setNib(theNib); reset(); }
    } catch (x) { toast(api.errMsg(x), 6000); }
    setBusy("");
  };

  return (
    <>
      <StatusBanner />
      <div className="head">
        <div><h1>{editing ? "Edit data proyek" : "Input proyek OSS"}</h1>
          <p>{editing ? <span className="mono">{editing.id_proyek}</span> : "Pilih pelaku usaha (NIB), lalu isi data proyeknya. Satu pelaku usaha bisa memiliki banyak proyek/KBLI."}</p></div>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="card form-sec">
          <div className="card-h col"><h3><span className="step-no">1</span>Pelaku usaha</h3><span>Cari berdasarkan NIB atau nama — data pelaku tidak perlu diketik ulang</span></div>
          {!newMode ? (
            <>
              <MasterPicker items={pickItems} value={nib} onSelect={(id) => { setNib(id); setPickErr(""); }}
                onNew={(typed) => { setNewMode(true); setNib(null); setPickErr(""); setPv((o) => ({ ...o, ...(/^\d+$/.test(typed) ? { nib: typed } : { nama_perusahaan: typed }) })); }}
                label="NIB atau nama pelaku usaha" placeholder="Ketik NIB atau nama pelaku usaha…" newLabel="Tambah pelaku usaha baru" error={pickErr} />
              {sel && (
                <div className="sec-switch">
                  <span className="cell-sub">{others.length ? `Pelaku ini sudah memiliki ${others.length} proyek lain di arsip.` : "Belum ada proyek lain untuk pelaku ini."}</span>
                  <span className="grow" />
                  <button type="button" className="btn sm" onClick={() => setEditPelaku(true)}><Pencil size={14} />Lihat / ubah data pelaku</button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sec-switch"><span className="badge ok"><UserPlus size={13} />Pelaku usaha baru</span><span className="grow" />
                <button type="button" className="btn sm" onClick={() => { setNewMode(false); setPerrs({}); }}><Users size={14} />Pilih dari arsip</button></div>
              <FieldGrid fields={PELAKU_FIELDS} v={pv} errs={perrs} set={(k, val) => setPv((o) => ({ ...o, [k]: val }))} onBlur={onPelakuBlur} idPrefix="np_" />
            </>
          )}
          {(sel || newMode) && (
            <div className="pelaku-docs">
              <div className="pd-head">
                <b>Dokumen pelaku usaha</b>
                <span className="cell-sub">NIB, akta, NPWP, KTP penanggung jawab — disimpan pada NIB, berlaku untuk semua proyeknya</span>
              </div>
              {sel?.pelaku_dokumen?.length ? (
                <div className="docs saved">{sel.pelaku_dokumen.map((d) => <div className="doc-item" key={d.id}><FileText size={16} className="doc-ico" /><span className="nm">{d.label && <span className="doc-tag">{d.label}</span>}{d.nama_file}</span><span className="cell-sub">tersimpan</span></div>)}</div>
              ) : sel ? <div className="kbli-warn" style={{ marginBottom: 8 }}>Dokumen NIB pelaku ini belum diarsipkan.</div> : null}
              <DocUploader pending={pendingPelaku} onChange={setPendingPelaku} labels={LABELS_PELAKU} onReject={(m) => toast(m, 6000)} compact />
            </div>
          )}
        </div>

        {PROYEK_SECTIONS.map((sec, i) => (
          <div className="card form-sec" key={sec.title}>
            <div className="card-h col"><h3><span className="step-no">{i + 2}</span>{sec.title}</h3><span>{sec.desc}</span></div>
            <FieldGrid fields={sec.fields.map((f) => (f.k === "id_proyek" && editing ? { ...f, readOnly: true } : f))} v={v} errs={errs} set={set} onBlur={onBlur} lists={lists}
              custom={{
                kbli: (id) => (
                  <KbliInput id={id} value={v.kbli} index={kbli.index} options={kOptions} err={!!errs.kbli} onChange={setKbli} onPick={pickKbli} />
                ),
                judul_kbli: (id) => (
                  <KbliInput id={id} mode="judul" value={v.judul_kbli} index={kbli.index} options={kOptions} onChange={(x) => set("judul_kbli", x)} onPick={pickKbli} />
                ),
              }} />
          </div>
        ))}

        <div className="card form-sec">
          <div className="card-h col"><h3><span className="step-no">{PROYEK_SECTIONS.length + 2}</span>Dokumen proyek</h3><span>Dokumen khusus proyek ini (sertifikat standar, izin usaha, PKKPR, …); beri jenis pada setiap file</span></div>
          <div className="fgrid">
            <div className="f span3">
              <label htmlFor="fi_arsip_dokumen">Tautan / keterangan arsip</label>
              <input id="fi_arsip_dokumen" className="inp" value={v.arsip_dokumen} onChange={(e) => set("arsip_dokumen", e.target.value)} placeholder="Opsional: tautan Google Drive, nomor box/rak arsip fisik, atau catatan" />
            </div>
            <div className="f span3">
              {editing?.oss_dokumen?.length ? (
                <div className="docs saved">{editing.oss_dokumen.map((d) => <div className="doc-item" key={d.id}><FileText size={16} className="doc-ico" /><span className="nm">{d.label && <span className="doc-tag">{d.label}</span>}{d.nama_file}</span><span className="cell-sub">tersimpan</span></div>)}</div>
              ) : null}
              <DocUploader pending={pending} onChange={setPending} labels={LABELS_OSS} onReject={(m) => toast(m, 6000)} />
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => (editing ? nav(-1) : reset())}>{editing ? "Batal" : "Kosongkan"}</button>
          <button className="btn primary" disabled={!!busy}>{busy ? <Loader2 size={16} className="spin-ico" /> : <Save size={16} />}{busy || (editing ? "Simpan perubahan" : "Simpan ke arsip")}</button>
        </div>
      </form>
      {editPelaku && nib && <PelakuModal nib={nib} startEdit onClose={() => setEditPelaku(false)} />}
    </>
  );
}

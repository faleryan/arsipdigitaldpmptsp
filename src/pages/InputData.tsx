import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Loader2, Paperclip, Save, X } from "lucide-react";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { JENIS_PERUSAHAAN, JENIS_PROYEK, KEC_BELU, PRETTY, RISIKO, SKALA, type FieldKey, type Proyek } from "../lib/columns";
import { fmtInt, fmtNum, isISO, normalizeRecord, parseNum } from "../lib/format";
import * as api from "../lib/api";
import { Loading } from "../components/Loading";
import { StatusBanner } from "../components/StatusBanner";

type FType = "text" | "select" | "list" | "date" | "num" | "money" | "email" | "tel";
interface Field { k: FieldKey; type?: FType; req?: boolean; hint?: string; span?: 2 | 3; opts?: string[]; dyn?: FieldKey; def?: string }

const FORM: { title: string; desc: string; fields: Field[] }[] = [
  { title: "Data proyek", desc: "Identitas proyek sesuai OSS", fields: [
    { k: "id_proyek", req: true, hint: "Contoh: R-202603100806158504562" },
    { k: "jenis_proyek", type: "list", opts: JENIS_PROYEK, def: "Utama" },
    { k: "nama_proyek", req: true },
    { k: "tgl_pengajuan", type: "date" },
    { k: "risiko", type: "select", opts: RISIKO },
    { k: "skala_usaha", type: "select", opts: SKALA },
    { k: "no_kegiatan" },
  ] },
  { title: "Pelaku usaha", desc: "Isi NIB terlebih dahulu — data pelaku usaha yang sudah pernah tercatat akan terisi otomatis", fields: [
    { k: "nib", req: true, hint: "13 digit angka" },
    { k: "nama_perusahaan", req: true, span: 2 },
    { k: "jenis_perusahaan", type: "list", opts: JENIS_PERUSAHAAN, span: 2 },
    { k: "status_pm", type: "select", opts: ["PMDN", "PMA"], def: "PMDN" },
    { k: "tgl_terbit_oss", type: "date" },
    { k: "nik", hint: "16 digit angka" },
    { k: "nohp", type: "tel" },
    { k: "email", type: "email" },
    { k: "username" },
    { k: "alamat_perusahaan", span: 3 },
    { k: "kel_perusahaan" }, { k: "kec_perusahaan" }, { k: "kab_perusahaan" },
  ] },
  { title: "Lokasi usaha", desc: "Lokasi kegiatan usaha", fields: [
    { k: "alamat_usaha", span: 3 },
    { k: "kab_usaha", def: "Kab. Belu" },
    { k: "kec_usaha", type: "list", opts: KEC_BELU },
    { k: "kel_usaha", type: "list", dyn: "kel_usaha" },
    { k: "luas_tanah", type: "num" },
    { k: "satuan_tanah", type: "list", opts: ["m2", "Ha"], def: "m2" },
  ] },
  { title: "KBLI & investasi", desc: "Judul KBLI dan sektor terisi otomatis bila KBLI pernah dipakai", fields: [
    { k: "kbli", type: "list", dyn: "kbli", hint: "5 digit" },
    { k: "judul_kbli", span: 2 },
    { k: "sektor", type: "list", dyn: "sektor", span: 2 },
    { k: "investasi", type: "money", hint: "Dalam rupiah" },
    { k: "tki", type: "num", hint: "Jumlah tenaga kerja Indonesia" },
  ] },
];
const ALL_FIELDS = FORM.flatMap((s) => s.fields);

function toForm(r: Proyek | undefined): Record<string, string> {
  const o: Record<string, string> = {};
  for (const f of ALL_FIELDS) {
    const v = r ? r[f.k] : undefined;
    if (v == null || v === "") o[f.k] = r ? "" : f.def || "";
    else if (f.type === "money") o[f.k] = fmtInt(v as number);
    else if (f.type === "num") o[f.k] = fmtNum(v as number);
    else o[f.k] = String(v);
  }
  o.arsip_dokumen = r?.arsip_dokumen || "";
  return o;
}

export default function InputData() {
  const { id } = useParams();
  const editId = id ? decodeURIComponent(id) : null;
  const { rows, byId, loaded, refresh } = useData();
  const { toast } = useUI();
  const nav = useNavigate();
  const editing = editId ? byId.get(editId) : undefined;
  if (!loaded) return <Loading />;
  if (editId && !editing) return <div className="card pad">Data <span className="mono">{editId}</span> tidak ditemukan.</div>;
  return <Form key={editId || "new"} editing={editing} rows={rows} byId={byId} refresh={refresh} toast={toast} nav={nav} />;
}

function Form({ editing, rows, byId, refresh, toast, nav }: {
  editing?: Proyek; rows: Proyek[]; byId: Map<string, Proyek>; refresh: () => Promise<void>;
  toast: (m: string, ms?: number) => void; nav: ReturnType<typeof useNavigate>;
}) {
  const [v, setV] = useState<Record<string, string>>(() => toForm(editing));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ file: File; label: string }[]>([]);
  const [docLabel, setDocLabel] = useState("");
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const lists = useMemo(() => {
    const u = (k: FieldKey) => [...new Set(rows.map((r) => r[k] as string).filter(Boolean))].sort();
    return { kel_usaha: u("kel_usaha"), kbli: u("kbli"), sektor: u("sektor") } as Record<string, string[]>;
  }, [rows]);
  const kbliMap = useMemo(() => {
    const m: Record<string, { judul: string; sektor: string }> = {};
    rows.forEach((r) => { if (r.kbli && r.judul_kbli && !m[r.kbli]) m[r.kbli] = { judul: r.judul_kbli, sektor: r.sektor }; });
    return m;
  }, [rows]);

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  const onBlur = (f: Field) => {
    if (f.k === "kbli") {
      const m = kbliMap[v.kbli.trim()];
      if (m) setV((p) => ({ ...p, judul_kbli: p.judul_kbli || m.judul, sektor: p.sektor || m.sektor }));
    }
    if (f.k === "nib" && !editing) {
      const ex = rows.find((r) => r.nib === v.nib.trim());
      if (ex) {
        const keys: FieldKey[] = ["nama_perusahaan", "jenis_perusahaan", "status_pm", "tgl_terbit_oss", "nik", "nohp", "email", "username", "alamat_perusahaan", "kel_perusahaan", "kec_perusahaan", "kab_perusahaan"];
        setV((p) => { const n = { ...p }; keys.forEach((k) => { if (!n[k] && ex[k]) n[k] = String(ex[k]); }); return n; });
        toast("Data pelaku usaha diisi dari arsip NIB yang sama");
      }
    }
    if (f.type === "money") { const n = parseNum(v[f.k]); if (n != null) set(f.k, fmtInt(n)); }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const t = (k: string) => (v[k] || "").trim();
    if (!t("id_proyek")) e.id_proyek = "Wajib diisi";
    else if (!editing && byId.has(t("id_proyek"))) e.id_proyek = "Id Proyek sudah ada di arsip";
    if (!t("nama_proyek")) e.nama_proyek = "Wajib diisi";
    if (!t("nama_perusahaan")) e.nama_perusahaan = "Wajib diisi";
    if (!t("nib")) e.nib = "Wajib diisi"; else if (!/^\d{13}$/.test(t("nib"))) e.nib = "NIB harus 13 digit angka";
    if (t("nik") && !/^\d{16}$/.test(t("nik"))) e.nik = "NIK harus 16 digit angka";
    if (t("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t("email"))) e.email = "Format email tidak valid";
    if (t("kbli") && !/^\d{5}$/.test(t("kbli"))) e.kbli = "KBLI 5 digit angka";
    for (const k of ["investasi", "tki", "luas_tanah"]) if (t(k) && parseNum(t(k)) == null) e[k] = "Isi dengan angka";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) {
      document.getElementById("fi_" + Object.keys(e)[0])?.focus();
      toast("Periksa kembali isian yang ditandai");
      return;
    }
    const rec = normalizeRecord(v);
    try {
      setBusy("Menyimpan…");
      if (editing) await api.updateProyek(editing.id_proyek, rec);
      else await api.insertProyek(rec);
      if (pending.length) {
        setBusy("Mengunggah dokumen…");
        for (const p of pending) await api.uploadDokumen("oss", rec.id_proyek, p.file, p.label);
      }
      await refresh();
      toast(editing ? "Perubahan disimpan" : "Data tersimpan ke arsip");
      if (editing) nav(`/oss/data?id=${encodeURIComponent(rec.id_proyek)}`);
      else { setV(toForm(undefined)); setPending([]); setErrs({}); window.scrollTo(0, 0); }
    } catch (x) {
      toast(api.errMsg(x), 6000);
    }
    setBusy("");
  };

  const input = (f: Field) => {
    const id = "fi_" + f.k;
    const common = {
      id, name: f.k, value: v[f.k] ?? "", className: "inp" + (errs[f.k] ? " err" : ""), autoComplete: "off",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(f.k, e.target.value),
      onBlur: () => onBlur(f), "aria-invalid": !!errs[f.k] || undefined,
    };
    if (f.type === "select") {
      const opts = f.opts || [];
      return <select {...common}><option value="">— pilih —</option>{opts.map((o) => <option key={o}>{o}</option>)}{v[f.k] && !opts.includes(v[f.k]) && <option>{v[f.k]}</option>}</select>;
    }
    if (f.type === "list") {
      const opts = f.dyn ? lists[f.dyn] || [] : f.opts || [];
      return <><input {...common} list={"dl_" + f.k} /><datalist id={"dl_" + f.k}>{opts.map((o) => <option key={o} value={o} />)}</datalist></>;
    }
    if (f.type === "date") return <input {...common} type="date" value={isISO(v[f.k]) ? v[f.k] : ""} />;
    const extra = f.type === "email" ? { type: "email" } : f.type === "tel" ? { type: "tel", inputMode: "tel" as const } : f.type === "money" || f.type === "num" ? { inputMode: "decimal" as const } : {};
    return <input {...common} {...extra} readOnly={f.k === "id_proyek" && !!editing} />;
  };

  return (
    <>
      <StatusBanner />
      <div className="head">
        <div><h1>{editing ? "Edit data proyek" : "Input data proyek OSS"}</h1>
          <p>{editing ? <span className="mono">{editing.id_proyek}</span> : "Isian mengikuti kolom Format Arsip OSS. Kolom bertanda * wajib diisi."}</p></div>
      </div>
      <form onSubmit={submit} noValidate>
        {FORM.map((sec) => (
          <div className="card form-sec" key={sec.title}>
            <div className="card-h col"><h3>{sec.title}</h3><span>{sec.desc}</span></div>
            <div className="fgrid">
              {sec.fields.map((f) => (
                <div key={f.k} className={"f" + (f.span === 2 ? " span2" : f.span === 3 ? " span3" : "")}>
                  <label htmlFor={"fi_" + f.k}>{PRETTY[f.k]}{f.req && <span className="req"> *</span>}</label>
                  {input(f)}
                  {errs[f.k] ? <span className="msg">{errs[f.k]}</span> : f.hint && <span className="hint">{f.hint}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="card form-sec">
          <div className="card-h col"><h3>Arsip dokumen</h3><span>PDF atau gambar (JPG/PNG/WEBP), maks. 20 MB per file</span></div>
          <div className="fgrid">
            <div className="f span3">
              <label htmlFor="fi_arsip_dokumen">{PRETTY.arsip_dokumen}</label>
              <input id="fi_arsip_dokumen" className="inp" value={v.arsip_dokumen} onChange={(e) => set("arsip_dokumen", e.target.value)} placeholder="Opsional: tautan Google Drive, nomor box/rak arsip fisik, atau keterangan" />
            </div>
            <div className="f span3">
              {editing?.oss_dokumen?.length ? <div className="docs">{editing.oss_dokumen.map((d) => <div className="doc-item" key={d.id}><FileText size={16} className="doc-ico" /><span className="nm">{d.label && <b>{d.label} — </b>}{d.nama_file}</span><span className="cell-sub">tersimpan</span></div>)}</div> : null}
              <div className="upload-row">
                <input className="inp" placeholder="Jenis dokumen (mis. NIB, PKKPR, Izin Usaha)" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} />
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Paperclip size={16} />Pilih file…</button>
                <input ref={fileRef} type="file" hidden multiple accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const fs = [...(e.target.files || [])];
                    const big = fs.find((f) => f.size > 20 * 1024 * 1024);
                    if (big) toast(`${big.name} melebihi 20 MB`);
                    setPending((p) => [...p, ...fs.filter((f) => f.size <= 20 * 1024 * 1024).map((file) => ({ file, label: docLabel.trim() }))]);
                    setDocLabel(""); e.target.value = "";
                  }} />
              </div>
              {pending.length > 0 && <div className="docs">{pending.map((p, i) => (
                <div className="doc-item pending" key={i}><FileText size={16} className="doc-ico" /><span className="nm">{p.label && <b>{p.label} — </b>}{p.file.name}</span><span className="cell-sub">akan diunggah</span>
                  <button type="button" className="icon-btn" onClick={() => setPending(pending.filter((_, j) => j !== i))} aria-label="Batalkan file"><X size={15} /></button></div>
              ))}</div>}
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => (editing ? nav(-1) : (setV(toForm(undefined)), setErrs({}), setPending([])))}>{editing ? "Batal" : "Kosongkan"}</button>
          <button className="btn primary" disabled={!!busy}>{busy ? <Loader2 size={16} className="spin-ico" /> : <Save size={16} />}{busy || (editing ? "Simpan perubahan" : "Simpan ke arsip")}</button>
        </div>
      </form>
    </>
  );
}

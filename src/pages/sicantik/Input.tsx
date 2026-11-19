import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Loader2, Paperclip, Save, X } from "lucide-react";
import { useSicantik } from "../../context/DataContext";
import { useUI } from "../../context/UIContext";
import { isISO, pad2 } from "../../lib/format";
import { JENIS_PERMOHONAN, normalizeIzin, SIC_PRETTY, type Izin, type SicKey } from "../../lib/sicantik";
import * as api from "../../lib/api";
import { Loading } from "../../components/Loading";
import { StatusBanner } from "../../components/StatusBanner";

type FType = "text" | "select" | "list" | "date" | "email" | "tel";
interface Field { k: SicKey; type?: FType; req?: boolean; hint?: string; span?: 2 | 3; opts?: string[]; dyn?: SicKey }

const FORM: { title: string; desc: string; fields: Field[] }[] = [
  { title: "Data izin", desc: "Jenis izin, permohonan, dan penetapan", fields: [
    { k: "izin", type: "list", dyn: "izin", req: true, span: 2, hint: "Pilih dari daftar atau ketik nama izin baru" },
    { k: "jenis", type: "select", opts: JENIS_PERMOHONAN, req: true },
    { k: "tanggal", type: "date", req: true },
    { k: "no_permohonan", hint: "Contoh: 1049/500.16.7.1.Resi/DPMPTSP/XI/2026" },
    { k: "id_sicantik", hint: "Kosongkan untuk dibuat otomatis" },
    { k: "nomor_izin", span: 2, hint: "Kosongkan bila izin belum ditetapkan" },
    { k: "tgl_penetapan", type: "date" },
  ] },
  { title: "Pemohon", desc: "Isi No. KTP terlebih dahulu — data pemohon yang sudah pernah tercatat akan terisi otomatis", fields: [
    { k: "no_ktp", hint: "Angka saja" },
    { k: "pemohon", req: true, span: 2 },
    { k: "no_hp", type: "tel" },
    { k: "email", type: "email", span: 2 },
  ] },
  { title: "Lokasi", desc: "Tempat praktik / lokasi kegiatan", fields: [
    { k: "lokasi", type: "list", dyn: "lokasi", span: 2 },
    { k: "lokasi_izin", type: "list", dyn: "lokasi", hint: "Kosongkan bila sama dengan lokasi" },
  ] },
];
const ALL = FORM.flatMap((s) => s.fields);
const toForm = (r?: Izin) => {
  const o: Record<string, string> = {};
  for (const f of ALL) o[f.k] = r ? String(r[f.k] ?? "") : "";
  o.keterangan = r?.keterangan || "";
  if (!r) o.jenis = "Baru";
  return o;
};
const autoId = () => { const d = new Date(); return `M-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`; };

export default function SicantikInput() {
  const { id } = useParams();
  const editId = id ? decodeURIComponent(id) : null;
  const store = useSicantik();
  const editing = editId ? store.byId.get(editId) : undefined;
  if (!store.loaded) return <Loading />;
  if (editId && !editing) return <div className="card pad">Data <span className="mono">{editId}</span> tidak ditemukan.</div>;
  return <Form key={editId || "new"} editing={editing} />;
}

function Form({ editing }: { editing?: Izin }) {
  const { rows, byId, refresh } = useSicantik();
  const { toast } = useUI();
  const nav = useNavigate();
  const [v, setV] = useState<Record<string, string>>(() => toForm(editing));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ file: File; label: string }[]>([]);
  const [docLabel, setDocLabel] = useState("");
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const lists = useMemo(() => {
    const u = (k: SicKey) => [...new Set(rows.map((r) => String(r[k] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
    return { izin: u("izin"), lokasi: u("lokasi") } as Record<string, string[]>;
  }, [rows]);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  const onBlur = (f: Field) => {
    if (f.k === "no_ktp" && !editing) {
      const ktp = v.no_ktp.trim();
      const ex = ktp && rows.find((r) => r.no_ktp === ktp);
      if (ex) {
        setV((p) => ({ ...p, pemohon: p.pemohon || ex.pemohon, no_hp: p.no_hp || ex.no_hp, email: p.email || ex.email, lokasi: p.lokasi || ex.lokasi }));
        toast("Data pemohon diisi dari arsip dengan No. KTP yang sama");
      }
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const t = (k: string) => (v[k] || "").trim();
    if (!t("izin")) e.izin = "Wajib diisi";
    if (!t("jenis")) e.jenis = "Wajib dipilih";
    if (!t("tanggal")) e.tanggal = "Wajib diisi";
    if (!t("pemohon")) e.pemohon = "Wajib diisi";
    if (!editing && t("id_sicantik") && byId.has(t("id_sicantik"))) e.id_sicantik = "ID sudah ada di arsip";
    if (t("no_ktp") && !/^\d{4,20}$/.test(t("no_ktp"))) e.no_ktp = "Isi dengan angka";
    if (t("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t("email"))) e.email = "Format email tidak valid";
    if (t("tgl_penetapan") && t("tanggal") && t("tgl_penetapan") < t("tanggal")) e.tgl_penetapan = "Tidak boleh sebelum tanggal permohonan";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) { document.getElementById("si_" + Object.keys(e)[0])?.focus(); toast("Periksa kembali isian yang ditandai"); return; }
    const raw = { ...v };
    if (!raw.id_sicantik.trim()) raw.id_sicantik = autoId();
    if (!raw.lokasi_izin.trim()) raw.lokasi_izin = raw.lokasi;
    const rec = normalizeIzin(raw);
    try {
      setBusy("Menyimpan…");
      if (editing) await api.updateIzin(editing.id_sicantik, rec);
      else await api.insertIzin(rec);
      if (pending.length) {
        setBusy("Mengunggah dokumen…");
        for (const p of pending) await api.uploadDokumen("sicantik", rec.id_sicantik, p.file, p.label);
      }
      await refresh();
      toast(editing ? "Perubahan disimpan" : "Data permohonan tersimpan ke arsip");
      if (editing) nav(`/sicantik/data?id=${encodeURIComponent(rec.id_sicantik)}`);
      else { setV(toForm()); setPending([]); setErrs({}); window.scrollTo(0, 0); }
    } catch (x) { toast(api.errMsg(x), 6000); }
    setBusy("");
  };

  const input = (f: Field) => {
    const common = {
      id: "si_" + f.k, name: f.k, value: v[f.k] ?? "", className: "inp" + (errs[f.k] ? " err" : ""), autoComplete: "off",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(f.k, e.target.value),
      onBlur: () => onBlur(f), "aria-invalid": !!errs[f.k] || undefined,
    };
    if (f.type === "select") return <select {...common}><option value="">— pilih —</option>{(f.opts || []).map((o) => <option key={o}>{o}</option>)}</select>;
    if (f.type === "list") {
      const opts = f.dyn ? lists[f.dyn] || [] : f.opts || [];
      return <><input {...common} list={"sl_" + f.k} /><datalist id={"sl_" + f.k}>{opts.map((o) => <option key={o} value={o} />)}</datalist></>;
    }
    if (f.type === "date") return <input {...common} type="date" value={isISO(v[f.k]) ? v[f.k] : ""} />;
    const extra = f.type === "email" ? { type: "email" } : f.type === "tel" ? { type: "tel", inputMode: "tel" as const } : f.k === "no_ktp" ? { inputMode: "numeric" as const } : {};
    return <input {...common} {...extra} readOnly={f.k === "id_sicantik" && !!editing} />;
  };

  return (
    <>
      <StatusBanner kind="sicantik" />
      <div className="head">
        <div><h1>{editing ? "Edit permohonan izin" : "Input data SiCantik"}</h1>
          <p>{editing ? <span className="mono">ID {editing.id_sicantik}</span> : "Isian mengikuti kolom Rekap SiCantik. Kolom bertanda * wajib diisi."}</p></div>
      </div>
      <form onSubmit={submit} noValidate>
        {FORM.map((sec) => (
          <div className="card form-sec" key={sec.title}>
            <div className="card-h col"><h3>{sec.title}</h3><span>{sec.desc}</span></div>
            <div className="fgrid">
              {sec.fields.map((f) => (
                <div key={f.k} className={"f" + (f.span === 2 ? " span2" : f.span === 3 ? " span3" : "")}>
                  <label htmlFor={"si_" + f.k}>{SIC_PRETTY[f.k]}{f.req && <span className="req"> *</span>}</label>
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
              <label htmlFor="si_keterangan">{SIC_PRETTY.keterangan}</label>
              <input id="si_keterangan" className="inp" value={v.keterangan} onChange={(e) => set("keterangan", e.target.value)} placeholder="Opsional: tautan Google Drive, nomor box/rak arsip fisik, atau catatan" />
            </div>
            <div className="f span3">
              {editing?.sicantik_dokumen?.length ? <div className="docs">{editing.sicantik_dokumen.map((d) => <div className="doc-item" key={d.id}><FileText size={16} className="doc-ico" /><span className="nm">{d.label && <b>{d.label} — </b>}{d.nama_file}</span><span className="cell-sub">tersimpan</span></div>)}</div> : null}
              <div className="upload-row">
                <input className="inp" placeholder="Jenis dokumen (mis. Surat Izin, STR, KTP, Rekomendasi)" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} />
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
          <button type="button" className="btn" onClick={() => (editing ? nav(-1) : (setV(toForm()), setErrs({}), setPending([])))}>{editing ? "Batal" : "Kosongkan"}</button>
          <button className="btn primary" disabled={!!busy}>{busy ? <Loader2 size={16} className="spin-ico" /> : <Save size={16} />}{busy || (editing ? "Simpan perubahan" : "Simpan ke arsip")}</button>
        </div>
      </form>
    </>
  );
}

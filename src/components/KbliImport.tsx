import { useMemo, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Modal } from "./Modal";
import { useKbli } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { fmtInt } from "../lib/format";
import { kbliKey, TINGKAT, type Kbli } from "../lib/master";
import * as api from "../lib/api";

/** Import Master KBLI dari Excel (kolom: kode, tingkat, judul, uraian, kategori) */
export function KbliImport({ onClose }: { onClose: () => void }) {
  const { byId, refresh } = useKbli();
  const { toast } = useUI();
  const [file, setFile] = useState<{ name: string; rows: Kbli[]; bad: number } | null>(null);
  const [versi, setVersi] = useState("2025");
  const [err, setErr] = useState("");
  const [reading, setReading] = useState(false);
  const [prog, setProg] = useState<number | null>(null);

  const read = async (f: File) => {
    setErr(""); setReading(true);
    try { const x = await import("../lib/excel"); const r = await x.readKbliFile(f); setFile({ name: f.name, rows: r.rows, bad: r.bad }); setVersi(r.versi); }
    catch (e) { setErr((e as Error).message); }
    setReading(false);
  };
  const stats = useMemo(() => {
    if (!file) return null;
    const per: Record<string, number> = {};
    let nNew = 0;
    for (const r of file.rows) { per[r.tingkat || "?"] = (per[r.tingkat || "?"] || 0) + 1; if (!byId.has(kbliKey({ versi, kode: r.kode }))) nNew++; }
    return { per, nNew, nUpd: file.rows.length - nNew };
  }, [file, versi, byId]);
  const go = async () => {
    if (!file || !versi.trim()) return;
    setProg(0);
    try {
      await api.importKbli(file.rows.map((r) => ({ ...r, versi: versi.trim() })), (d) => setProg(d));
      await refresh();
      toast(`${fmtInt(file.rows.length)} kode KBLI ${versi} tersimpan`);
      onClose();
    } catch (e) { setErr(api.errMsg(e)); setProg(null); }
  };

  return (
    <Modal onClose={() => prog === null && onClose()} size="md" label="Import Master KBLI">
      <div className="modal-h"><div><h2>Import Master KBLI</h2><p>File Excel/CSV dengan kolom: kode, tingkat, judul, uraian, kategori</p></div></div>
      <div className="modal-b stack">
        {!file ? (
          <label className="drop" htmlFor="kbliFile">
            <div className="drop-ico">{reading ? <Loader2 size={26} className="spin-ico" /> : <FileSpreadsheet size={26} />}</div>
            <b>{reading ? "Membaca file…" : "Pilih file KBLI (.xlsx/.csv)"}</b>
            <span className="cell-sub">Contoh: kbli-2025-lengkap.xlsx</span>
            <input id="kbliFile" type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
          </label>
        ) : stats && (
          <>
            <div><b>{file.name}</b></div>
            <div className="stats" style={{ margin: 0 }}>
              <div className="stat"><b>{fmtInt(file.rows.length)}</b><span>kode KBLI</span></div>
              <div className="stat good"><b>{fmtInt(stats.nNew)}</b><span>baru</span></div>
              <div className="stat"><b>{fmtInt(stats.nUpd)}</b><span>diperbarui</span></div>
              {file.bad > 0 && <div className="stat bad"><b>{fmtInt(file.bad)}</b><span>dilewati</span></div>}
            </div>
            <div className="cell-sub">{TINGKAT.filter((t) => stats.per[t]).map((t) => `${t}: ${fmtInt(stats.per[t])}`).join(" · ")}</div>
            <div className="f" style={{ maxWidth: 220 }}><label htmlFor="kver">Simpan sebagai versi</label><input id="kver" className="inp" value={versi} onChange={(e) => setVersi(e.target.value)} /><span className="hint">Mis. 2025 atau 2020. Versi berbeda disimpan terpisah.</span></div>
            {prog !== null && <><div className="progress"><i style={{ width: `${(prog / file.rows.length) * 100}%` }} /></div><div className="cell-sub">Menyimpan {fmtInt(prog)} / {fmtInt(file.rows.length)}…</div></>}
          </>
        )}
        {err && <div className="banner warn"><AlertTriangle size={18} /><div>{err}</div></div>}
      </div>
      <div className="modal-f">
        <button className="btn ghost" onClick={async () => (await import("../lib/excel")).exportKbliTemplate()}>Unduh template</button>
        <span className="grow" />
        <button className="btn" disabled={prog !== null} onClick={onClose}>Batal</button>
        {file && <button id="kbliGo" className="btn primary" disabled={prog !== null || !versi.trim()} onClick={go}>{prog !== null ? <Loader2 size={16} className="spin-ico" /> : <Upload size={16} />}Simpan {fmtInt(file.rows.length)} kode</button>}
      </div>
    </Modal>
  );
}

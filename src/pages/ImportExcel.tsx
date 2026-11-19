import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { LABEL, type Proyek } from "../lib/columns";
import { fmtDateLong, fmtInt, kecLabel } from "../lib/format";
import type { ImportRow, ParsedSheet } from "../lib/excel";
import * as api from "../lib/api";
import { StatusBanner } from "../components/StatusBanner";

type Stage = { kind: "pick" } | { kind: "reading" } | { kind: "error"; msg: string } | { kind: "preview"; P: ParsedSheet } | { kind: "done"; nNew: number; nUpd: number };

export default function ImportExcel() {
  const { byId, refresh } = useData();
  const { toast } = useUI();
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [cleanPh, setCleanPh] = useState(true);
  const [dup, setDup] = useState<"update" | "skip">("update");
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [built, setBuilt] = useState<{ rows: ImportRow[]; placeholderCount: number } | null>(null);
  const [P, setP] = useState<ParsedSheet | null>(null);

  const read = async (file: File) => {
    setStage({ kind: "reading" });
    try {
      const x = await import("../lib/excel");
      const parsed = await x.readWorkbook(file);
      setP(parsed);
      setBuilt(x.buildRows(parsed, cleanPh));
      setStage({ kind: "preview", P: parsed });
    } catch (e) {
      setStage({ kind: "error", msg: (e as Error).message || String(e) });
    }
  };
  const rebuild = async (clean: boolean) => {
    setCleanPh(clean);
    if (P) { const x = await import("../lib/excel"); setBuilt(x.buildRows(P, clean)); }
  };

  const stats = useMemo(() => {
    const rows = built?.rows || [];
    const valid = rows.filter((x) => !x.problem);
    const nNew = valid.filter((x) => !byId.has(x.rec.id_proyek)).length;
    return { total: rows.length, valid, nNew, nUpd: valid.length - nNew, nBad: rows.length - valid.length, nDate: rows.filter((x) => x.dateWarn).length };
  }, [built, byId]);

  const save = async () => {
    if (stage.kind !== "preview") return;
    const list = stats.valid.filter((x) => dup === "update" || !byId.has(x.rec.id_proyek));
    // pertahankan keterangan arsip lama bila kolom di file kosong
    const rows: Proyek[] = list.map((x) => {
      const cur = byId.get(x.rec.id_proyek);
      return cur && !x.rec.arsip_dokumen && cur.arsip_dokumen ? { ...x.rec, arsip_dokumen: cur.arsip_dokumen } : x.rec;
    });
    const nNew = list.filter((x) => !byId.has(x.rec.id_proyek)).length;
    setProg({ done: 0, total: rows.length });
    try {
      await api.upsertBatch(rows, { skipExisting: dup === "skip", fileName: stage.P.fileName }, (done, total) => setProg({ done, total }));
      await refresh();
      setStage({ kind: "done", nNew, nUpd: rows.length - nNew });
    } catch (e) {
      toast(api.errMsg(e), 6000);
    }
    setProg(null);
  };
  const template = async () => (await import("../lib/excel")).exportTemplate();

  return (
    <>
      <StatusBanner />
      <div className="head">
        <div><h1>Import data OSS dari Excel</h1><p>Unggah file Excel/CSV hasil unduhan OSS dengan susunan kolom Format Arsip OSS.</p></div>
        <div className="head-actions"><button className="btn" onClick={template}><FileSpreadsheet size={16} />Unduh template</button></div>
      </div>
      <div className="steps">
        <div className="card step"><b><em>1</em>Siapkan file</b><p>File unduhan OSS (.xlsx/.xls/.csv) dengan baris judul seperti template. Urutan kolom boleh berbeda.</p></div>
        <div className="card step"><b><em>2</em>Periksa pratinjau</b><p>Kolom dicocokkan otomatis; data baru, data yang sudah ada, dan baris bermasalah ditandai.</p></div>
        <div className="card step"><b><em>3</em>Simpan</b><p>Pilih cara menangani data yang sudah ada. Dokumen yang sudah terlampir tidak akan hilang.</p></div>
      </div>

      {(stage.kind === "pick" || stage.kind === "error") && (
        <>
          {stage.kind === "error" && <div className="banner warn"><AlertTriangle size={18} /><div><b>File tidak dapat dibaca.</b> {stage.msg}</div></div>}
          <div className={"drop" + (over ? " over" : "")} role="button" tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}>
            <div className="drop-ico"><Upload size={28} /></div>
            <b>Seret file Excel ke sini atau klik untuk memilih</b>
            <span className="cell-sub">.xlsx, .xls, atau .csv</span>
            <input ref={fileRef} id="impFile" type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
          </div>
        </>
      )}
      {stage.kind === "reading" && <div className="loading"><span className="spin" />Membaca file…</div>}

      {stage.kind === "preview" && built && (
        <div className="card">
          <div className="card-h"><h3>Pratinjau: {stage.P.fileName}</h3><span>Sheet “{stage.P.sheet}” · baris judul ke-{stage.P.headerRow + 1}</span></div>
          <div className="card-b">
            <div className="stats">
              <div className="stat"><b>{fmtInt(stats.total)}</b><span>baris data</span></div>
              <div className="stat good"><b>{fmtInt(stats.nNew)}</b><span>data baru</span></div>
              <div className="stat"><b>{fmtInt(stats.nUpd)}</b><span>sudah ada di arsip</span></div>
              <div className={"stat" + (stats.nBad ? " bad" : "")}><b>{fmtInt(stats.nBad)}</b><span>bermasalah (dilewati)</span></div>
            </div>
            <p className="muted">
              <b>{stage.P.matched.length}</b> dari 33 kolom format dikenali.
              {stage.P.missing.length > 0 && <> Kolom tidak ditemukan: <i>{stage.P.missing.map((k) => LABEL[k]).join(", ")}</i>.</>}
              {stage.P.unknown.length > 0 && <> Kolom diabaikan: <i>{stage.P.unknown.join(", ")}</i>.</>}
              {stats.nDate > 0 && <> {fmtInt(stats.nDate)} baris memiliki tanggal yang tidak terbaca (disimpan kosong).</>}
            </p>
            {built.placeholderCount > 0 && (
              <label className="chk"><input type="checkbox" checked={cleanPh} onChange={(e) => rebuild(e.target.checked)} />
                Kosongkan teks placeholder OSS pada kolom alamat/kelurahan/kecamatan/kab perusahaan ({fmtInt(built.placeholderCount)} baris berisi “Alamat Perusahaan”, “kelurahan”, dst.)</label>
            )}
            {stats.nUpd > 0 && (
              <div className="radio-row"><span className="muted">Data yang sudah ada:</span>
                <label className="chk"><input type="radio" name="dup" checked={dup === "update"} onChange={() => setDup("update")} />Perbarui dengan data dari file</label>
                <label className="chk"><input type="radio" name="dup" checked={dup === "skip"} onChange={() => setDup("skip")} />Lewati (biarkan data lama)</label>
              </div>
            )}
            <div className="tbl-wrap preview">
              <table><thead><tr><th>Baris</th><th>Status</th><th>Id Proyek</th><th>Pelaku usaha</th><th>Nama proyek</th><th>KBLI</th><th>Kecamatan</th><th className="num">Investasi</th><th>Tgl pengajuan</th></tr></thead>
                <tbody>{built.rows.slice(0, 300).map((x) => {
                  const r = x.rec;
                  return (
                    <tr key={x.line} className={x.problem ? "bad-row" : ""}>
                      <td className="cell-sub">{x.line}</td>
                      <td>{x.problem ? <span className="badge bad">{x.problem}</span> : byId.has(r.id_proyek) ? <span className="badge">Sudah ada</span> : <span className="badge"><i style={{ background: "var(--good)" }} />Baru</span>}</td>
                      <td className="mono sm nowrap">{r.id_proyek}</td>
                      <td>{r.nama_perusahaan}<div className="cell-sub mono">{r.nib}</div></td>
                      <td>{r.nama_proyek}</td>
                      <td className="mono">{r.kbli}</td>
                      <td>{kecLabel(r.kec_usaha)}</td>
                      <td className="num">{r.investasi != null ? fmtInt(r.investasi) : "—"}</td>
                      <td className="nowrap">{fmtDateLong(r.tgl_pengajuan)}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            {built.rows.length > 300 && <p className="cell-sub">Menampilkan 300 baris pertama dari {fmtInt(built.rows.length)}.</p>}
            {prog && <><div className="progress"><i style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%` }} /></div><div className="cell-sub">Menyimpan {fmtInt(prog.done)} / {fmtInt(prog.total)}…</div></>}
            <div className="form-actions static">
              <button className="btn" disabled={!!prog} onClick={() => { setStage({ kind: "pick" }); setBuilt(null); setP(null); }}>Batal / pilih file lain</button>
              <button id="impGo" className="btn primary" disabled={!!prog || !stats.valid.length || (dup === "skip" && !stats.nNew)} onClick={save}>
                {prog ? <Loader2 size={16} className="spin-ico" /> : <Upload size={16} />}Simpan {fmtInt(dup === "skip" ? stats.nNew : stats.valid.length)} data ke arsip
              </button>
            </div>
          </div>
        </div>
      )}

      {stage.kind === "done" && (
        <div className="card"><div className="done-box">
          <CheckCircle2 size={44} className="ok-ico" />
          <h3>Import selesai</h3>
          <p className="muted">{fmtInt(stage.nNew)} data baru ditambahkan, {fmtInt(stage.nUpd)} data diperbarui.</p>
          <div className="row-gap center">
            <Link className="btn primary" to="/oss">Lihat dashboard</Link>
            <Link className="btn" to="/oss/data">Lihat data</Link>
            <button id="impAgain" className="btn" onClick={() => { setStage({ kind: "pick" }); setBuilt(null); setP(null); }}>Import file lain</button>
          </div>
        </div></div>
      )}
    </>
  );
}

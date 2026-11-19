import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useSicantik } from "../../context/DataContext";
import { useUI } from "../../context/UIContext";
import { fmtDateLong, fmtInt } from "../../lib/format";
import { izinShort, SIC_LABEL, type Izin } from "../../lib/sicantik";
import type { IzinRow, ParsedSheet } from "../../lib/excel";
import * as api from "../../lib/api";
import { StatusBanner } from "../../components/StatusBanner";
import { JenisBadge } from "./Data";

type Stage = { kind: "pick" } | { kind: "reading" } | { kind: "error"; msg: string } | { kind: "preview"; P: ParsedSheet; rows: IzinRow[] } | { kind: "done"; nNew: number; nUpd: number };

export default function SicantikImport() {
  const { byId, refresh } = useSicantik();
  const { toast } = useUI();
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [dup, setDup] = useState<"update" | "skip">("update");
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    setStage({ kind: "reading" });
    try {
      const x = await import("../../lib/excel");
      const P = await x.readWorkbook(file, x.SIC_SPEC);
      setStage({ kind: "preview", P, rows: x.buildIzinRows(P).rows });
    } catch (e) { setStage({ kind: "error", msg: (e as Error).message || String(e) }); }
  };

  const stats = useMemo(() => {
    const rows = stage.kind === "preview" ? stage.rows : [];
    const valid = rows.filter((x) => !x.problem);
    const nNew = valid.filter((x) => !byId.has(x.rec.id_sicantik)).length;
    return { total: rows.length, valid, nNew, nUpd: valid.length - nNew, nBad: rows.length - valid.length, nDate: rows.filter((x) => x.dateWarn).length, nPending: valid.filter((x) => !x.rec.nomor_izin).length };
  }, [stage, byId]);

  const save = async () => {
    if (stage.kind !== "preview") return;
    const list = stats.valid.filter((x) => dup === "update" || !byId.has(x.rec.id_sicantik));
    const rows: Izin[] = list.map((x) => {
      const cur = byId.get(x.rec.id_sicantik);
      return cur && !x.rec.keterangan && cur.keterangan ? { ...x.rec, keterangan: cur.keterangan } : x.rec;
    });
    const nNew = list.filter((x) => !byId.has(x.rec.id_sicantik)).length;
    setProg({ done: 0, total: rows.length });
    try {
      await api.upsertIzinBatch(rows, { skipExisting: dup === "skip", fileName: stage.P.fileName }, (done, total) => setProg({ done, total }));
      await refresh();
      setStage({ kind: "done", nNew, nUpd: rows.length - nNew });
    } catch (e) { toast(api.errMsg(e), 6000); }
    setProg(null);
  };
  const reset = () => setStage({ kind: "pick" });
  const template = async () => (await import("../../lib/excel")).exportIzinTemplate();

  return (
    <>
      <StatusBanner kind="sicantik" />
      <div className="head">
        <div><h1>Import data SiCantik dari Excel</h1><p>Unggah file rekap permohonan dari aplikasi SiCantik (susunan kolom Rekap SiCantik).</p></div>
        <div className="head-actions"><button className="btn" onClick={template}><FileSpreadsheet size={16} />Unduh template</button></div>
      </div>
      <div className="steps">
        <div className="card step"><b><em>1</em>Unduh rekap</b><p>Ekspor rekap permohonan dari SiCantik ke Excel (.xlsx/.xls/.csv). Urutan kolom boleh berbeda.</p></div>
        <div className="card step"><b><em>2</em>Periksa pratinjau</b><p>Kolom <b>ID</b> menjadi kunci. Nilai “-” pada nomor izin/penetapan dibaca sebagai belum ditetapkan.</p></div>
        <div className="card step"><b><em>3</em>Simpan</b><p>Import ulang aman: data yang sama diperbarui (mis. setelah izin ditetapkan), dokumen tetap tersimpan.</p></div>
      </div>

      {(stage.kind === "pick" || stage.kind === "error") && (
        <>
          {stage.kind === "error" && <div className="banner warn"><AlertTriangle size={18} /><div><b>File tidak dapat dibaca.</b> {stage.msg}</div></div>}
          <div className={"drop" + (over ? " over" : "")} role="button" tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}>
            <div className="drop-ico teal"><Upload size={28} /></div>
            <b>Seret file rekap SiCantik ke sini atau klik untuk memilih</b>
            <span className="cell-sub">.xlsx, .xls, atau .csv</span>
            <input ref={fileRef} id="sicFile" type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
          </div>
        </>
      )}
      {stage.kind === "reading" && <div className="loading"><span className="spin" />Membaca file…</div>}

      {stage.kind === "preview" && (
        <div className="card">
          <div className="card-h"><h3>Pratinjau: {stage.P.fileName}</h3><span>Sheet “{stage.P.sheet}” · baris judul ke-{stage.P.headerRow + 1}</span></div>
          <div className="card-b">
            <div className="stats">
              <div className="stat"><b>{fmtInt(stats.total)}</b><span>baris data</span></div>
              <div className="stat good"><b>{fmtInt(stats.nNew)}</b><span>data baru</span></div>
              <div className="stat"><b>{fmtInt(stats.nUpd)}</b><span>sudah ada di arsip</span></div>
              <div className="stat"><b>{fmtInt(stats.nPending)}</b><span>belum ditetapkan</span></div>
              <div className={"stat" + (stats.nBad ? " bad" : "")}><b>{fmtInt(stats.nBad)}</b><span>bermasalah (dilewati)</span></div>
            </div>
            <p className="muted">
              <b>{stage.P.matched.length}</b> dari 13 kolom format dikenali.
              {stage.P.missing.length > 0 && <> Kolom tidak ditemukan: <i>{stage.P.missing.map((k) => SIC_LABEL[k] || k).join(", ")}</i>.</>}
              {stage.P.unknown.length > 0 && <> Kolom diabaikan: <i>{stage.P.unknown.join(", ")}</i>.</>}
              {stats.nDate > 0 && <> {fmtInt(stats.nDate)} baris memiliki tanggal yang tidak terbaca (disimpan kosong).</>}
            </p>
            {stats.nUpd > 0 && (
              <div className="radio-row"><span className="muted">Data yang sudah ada:</span>
                <label className="chk"><input type="radio" name="dup" checked={dup === "update"} onChange={() => setDup("update")} />Perbarui dengan data dari file</label>
                <label className="chk"><input type="radio" name="dup" checked={dup === "skip"} onChange={() => setDup("skip")} />Lewati (biarkan data lama)</label>
              </div>
            )}
            <div className="tbl-wrap preview">
              <table><thead><tr><th>Baris</th><th>Status</th><th>ID</th><th>Pemohon</th><th>Izin</th><th>Permohonan</th><th>Nomor izin</th><th>Tgl permohonan</th><th>Tgl penetapan</th></tr></thead>
                <tbody>{stage.rows.slice(0, 300).map((x) => {
                  const r = x.rec;
                  return (
                    <tr key={x.line} className={x.problem ? "bad-row" : ""}>
                      <td className="cell-sub">{x.line}</td>
                      <td>{x.problem ? <span className="badge bad">{x.problem}</span> : byId.has(r.id_sicantik) ? <span className="badge">Sudah ada</span> : <span className="badge"><i style={{ background: "var(--good)" }} />Baru</span>}</td>
                      <td className="mono sm">{r.id_sicantik}</td>
                      <td>{r.pemohon}</td>
                      <td>{izinShort(r.izin)}</td>
                      <td><JenisBadge v={r.jenis} /></td>
                      <td className="mono sm nowrap">{r.nomor_izin || "—"}</td>
                      <td className="nowrap">{fmtDateLong(r.tanggal)}</td>
                      <td className="nowrap">{r.tgl_penetapan ? fmtDateLong(r.tgl_penetapan) : <span className="cell-sub">—</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            {stage.rows.length > 300 && <p className="cell-sub">Menampilkan 300 baris pertama dari {fmtInt(stage.rows.length)}.</p>}
            {prog && <><div className="progress"><i style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%` }} /></div><div className="cell-sub">Menyimpan {fmtInt(prog.done)} / {fmtInt(prog.total)}…</div></>}
            <div className="form-actions static">
              <button className="btn" disabled={!!prog} onClick={reset}>Batal / pilih file lain</button>
              <button id="sicGo" className="btn primary" disabled={!!prog || !stats.valid.length || (dup === "skip" && !stats.nNew)} onClick={save}>
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
            <Link className="btn primary" to="/sicantik">Lihat dashboard</Link>
            <Link className="btn" to="/sicantik/data">Lihat data</Link>
            <button id="sicAgain" className="btn" onClick={reset}>Import file lain</button>
          </div>
        </div></div>
      )}
    </>
  );
}

import * as XLSX from "xlsx";
import { COLS, HEADER_MAP, LABEL, norm, PLACEHOLDERS, RISIKO, SKALA, type FieldKey, type Proyek } from "./columns";
import { fmtDateLong, fmtDateSlash, fmtNum, hasArsip, isISO, kecLabel, normalizeRecord, pad2 } from "./format";
import { groupBy } from "./stats";

export interface ParsedSheet {
  fileName: string;
  sheet: string;
  headerRow: number;
  aoa: unknown[][];
  map: (FieldKey | "no" | undefined)[];
  matched: string[];
  missing: string[];
  unknown: string[];
}
export interface ImportRow { line: number; rec: Proyek; problem: string; dateWarn: boolean }

/** Membaca file Excel/CSV dan menemukan baris judul kolom */
export async function readWorkbook(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(new TextDecoder().decode(buf), { type: "string", raw: true })
    : XLSX.read(buf, { type: "array", cellDates: true });
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    for (let i = 0; i < Math.min(15, aoa.length); i++) {
      const keys = (aoa[i] || []).map((h) => HEADER_MAP[norm(h)]);
      if (keys.includes("id_proyek") || keys.filter(Boolean).length >= 5) {
        const map: ParsedSheet["map"] = [];
        const unknown: string[] = [];
        const seen = new Set<string>();
        (aoa[i] || []).forEach((h, j) => {
          const k = HEADER_MAP[norm(h)];
          if (k && !seen.has(k)) { map[j] = k; seen.add(k); }
          else if (h != null && String(h).trim()) unknown.push(String(h).trim());
        });
        if (!seen.has("id_proyek")) throw new Error("Kolom “Id Proyek” tidak ditemukan. Kolom ini wajib karena menjadi kunci arsip.");
        return {
          fileName: file.name, sheet: name, headerRow: i, aoa, map, unknown, matched: [...seen],
          missing: COLS.map((c) => c[0]).filter((k) => k !== "no" && !seen.has(k)),
        };
      }
    }
  }
  throw new Error("Tidak menemukan baris judul kolom (mis. “Id Proyek”, “Nib”, “Kbli”). Pastikan file mengikuti Format Arsip OSS.");
}

/** Mengubah isi sheet menjadi record siap simpan + validasi */
export function buildRows(P: ParsedSheet, cleanPlaceholders: boolean) {
  const rows: ImportRow[] = [];
  const ids = new Map<string, number>();
  let placeholderCount = 0;
  for (let i = P.headerRow + 1; i < P.aoa.length; i++) {
    const row = P.aoa[i];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const raw: Record<string, unknown> = {};
    P.map.forEach((k, j) => { if (k) raw[k] = row[j]; });
    if (Object.entries(PLACEHOLDERS).some(([k, p]) => norm(raw[k]) === p)) placeholderCount++;
    const rec = normalizeRecord(raw, { cleanPlaceholders });
    let problem = "";
    if (!rec.id_proyek) problem = "Id Proyek kosong";
    else if (!rec.nama_perusahaan && !rec.nama_proyek) problem = "Nama kosong";
    else if (ids.has(rec.id_proyek)) problem = `Duplikat baris ${ids.get(rec.id_proyek)}`;
    if (!problem) ids.set(rec.id_proyek, i + 1);
    const dateWarn = (raw.tgl_pengajuan != null && raw.tgl_pengajuan !== "" && !rec.tgl_pengajuan) ||
      (raw.tgl_terbit_oss != null && raw.tgl_terbit_oss !== "" && !rec.tgl_terbit_oss);
    rows.push({ line: i + 1, rec, problem, dateWarn });
  }
  return { rows, placeholderCount };
}

/* ---------------- Export ---------------- */
const stamp = () => { const d = new Date(); return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; };

function rowToSheet(r: Proyek, i: number) {
  const o: Record<string, unknown> = {};
  for (const [k, l] of COLS) {
    let v: unknown;
    if (k === "no") v = i + 1;
    else if (k === "tgl_terbit_oss") v = fmtDateSlash(r.tgl_terbit_oss);
    else if (k === "tgl_pengajuan") v = fmtDateLong(r.tgl_pengajuan);
    else if (k === "luas_tanah") v = r.luas_tanah != null ? fmtNum(r.luas_tanah) : "";
    else if (k === "arsip_dokumen") {
      const d = (r.oss_dokumen || []).map((x) => (x.label ? x.label + ": " : "") + x.nama_file);
      v = [r.arsip_dokumen, ...d].filter(Boolean).join("; ");
    } else v = r[k];
    o[l] = v ?? "";
  }
  return o;
}
function colWidths(ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] || {});
  ws["!cols"] = keys.map((k) => ({ wch: Math.min(48, Math.max(k.length, ...rows.slice(0, 200).map((r) => String(r[k] ?? "").length)) + 2) }));
}
function save(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { compression: true });
}

export function exportData(rows: Proyek[]) {
  const data = rows.map(rowToSheet);
  const ws = XLSX.utils.json_to_sheet(data, { header: COLS.map((c) => c[1]) });
  colWidths(ws, data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data OSS");
  save(wb, `Arsip_OSS_${stamp()}.xlsx`);
}

export function exportTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([COLS.map((c) => c[1])]);
  ws["!cols"] = COLS.map((c) => ({ wch: Math.max(10, c[1].length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Format Arsip OSS");
  save(wb, "Template_Format_Arsip_OSS.xlsx");
}

export function exportReport(rows: Proyek[], scope: string, instansi: string) {
  const wb = XLSX.utils.book_new();
  const totInv = rows.reduce((s, r) => s + (r.investasi || 0), 0);
  const totTki = rows.reduce((s, r) => s + (r.tki || 0), 0);
  const pelaku = new Set(rows.map((r) => r.nib).filter(Boolean)).size;
  const arsip = rows.filter(hasArsip).length;
  const ws0 = XLSX.utils.aoa_to_sheet([
    ["LAPORAN DATA PROYEK OSS"], [instansi], ["Cakupan", scope], ["Dicetak", new Date().toLocaleString("id-ID")], [],
    ["Indikator", "Nilai"], ["Jumlah proyek", rows.length], ["Pelaku usaha (NIB unik)", pelaku],
    ["Total investasi (Rp)", totInv], ["Tenaga kerja (orang)", totTki], ["Proyek berdokumen arsip", arsip],
  ]);
  ws0["!cols"] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws0, "Ringkasan");
  const rekap = (name: string, keyFn: (r: Proyek) => string, order?: string[]) => {
    const g = groupBy(rows, keyFn);
    if (order) g.sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99));
    else g.sort((a, b) => b.proyek - a.proyek);
    const data: Record<string, unknown>[] = g.map((x) => ({ [name]: x.key, "Jumlah proyek": x.proyek, "Pelaku usaha": x.pelaku, "Investasi (Rp)": x.investasi, "Tenaga kerja": x.tki, Berdokumen: x.arsip }));
    data.push({ [name]: "TOTAL", "Jumlah proyek": rows.length, "Pelaku usaha": pelaku, "Investasi (Rp)": totInv, "Tenaga kerja": totTki, Berdokumen: arsip });
    const ws = XLSX.utils.json_to_sheet(data);
    colWidths(ws, data);
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, rekap("Kecamatan", (r) => kecLabel(r.kec_usaha)), "Per Kecamatan");
  XLSX.utils.book_append_sheet(wb, rekap("Bulan pengajuan", (r) => (isISO(r.tgl_pengajuan) ? r.tgl_pengajuan.slice(0, 7) : "")), "Per Bulan");
  XLSX.utils.book_append_sheet(wb, rekap("Risiko", (r) => r.risiko, RISIKO), "Per Risiko");
  XLSX.utils.book_append_sheet(wb, rekap("Skala usaha", (r) => r.skala_usaha, SKALA), "Per Skala");
  XLSX.utils.book_append_sheet(wb, rekap("KL / Sektor pembina", (r) => r.sektor), "Per Sektor");
  XLSX.utils.book_append_sheet(wb, rekap("Jenis perusahaan", (r) => r.jenis_perusahaan), "Per Jenis Perusahaan");
  XLSX.utils.book_append_sheet(wb, rekap("KBLI", (r) => (r.kbli ? `${r.kbli} - ${r.judul_kbli || ""}` : "")), "Per KBLI");
  const data = rows.map(rowToSheet);
  const wsd = XLSX.utils.json_to_sheet(data, { header: COLS.map((c) => c[1]) });
  colWidths(wsd, data);
  XLSX.utils.book_append_sheet(wb, wsd, "Data");
  save(wb, `Laporan_OSS_${stamp()}.xlsx`);
}

export { LABEL };

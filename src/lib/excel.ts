import * as XLSX from "xlsx";
import { COLS, HEADER_MAP, LABEL, norm, PLACEHOLDERS, RISIKO, SKALA, type Proyek } from "./columns";
import { katIzin, normKode, tingkatOf, type Kbli } from "./master";
import { SIC_COLS, SIC_HEADER_MAP, normalizeIzin, izinShort, groupIzin, avgLama, statusOf, lokasiKey, type Izin } from "./sicantik";
import { fmtDateLong, fmtDateSlash, fmtNum, hasArsip, isISO, kecLabel, normalizeRecord, pad2 } from "./format";
import { groupBy } from "./stats";

export interface ParsedSheet {
  fileName: string;
  sheet: string;
  headerRow: number;
  aoa: unknown[][];
  map: (string | undefined)[];
  matched: string[];
  missing: string[];
  unknown: string[];
}
export interface ImportRow { line: number; rec: Proyek; problem: string; dateWarn: boolean }

export interface SheetSpec { headerMap: Record<string, string>; keyField: string; keyLabel: string; allKeys: string[]; title: string }
export const OSS_SPEC: SheetSpec = {
  headerMap: HEADER_MAP, keyField: "id_proyek", keyLabel: "Nomor Permohonan (Id Proyek)", title: "Format Arsip OSS",
  allKeys: COLS.map((c) => c[0]).filter((k) => k !== "no"),
};
export const SIC_SPEC: SheetSpec = {
  headerMap: SIC_HEADER_MAP, keyField: "id_sicantik", keyLabel: "ID", title: "Rekap SiCantik",
  allKeys: SIC_COLS.map((c) => c[0]),
};

/** Membaca file Excel/CSV dan menemukan baris judul kolom */
export async function readWorkbook(file: File, spec: SheetSpec = OSS_SPEC): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(new TextDecoder().decode(buf), { type: "string", raw: true })
    : XLSX.read(buf, { type: "array", cellDates: true });
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    for (let i = 0; i < Math.min(15, aoa.length); i++) {
      const keys = (aoa[i] || []).map((h) => spec.headerMap[norm(h)]);
      if (keys.includes(spec.keyField) || keys.filter(Boolean).length >= Math.min(5, spec.allKeys.length - 2)) {
        const map: ParsedSheet["map"] = [];
        const unknown: string[] = [];
        const seen = new Set<string>();
        (aoa[i] || []).forEach((h, j) => {
          const k = spec.headerMap[norm(h)];
          if (k && !seen.has(k)) { map[j] = k; seen.add(k); }
          else if (h != null && String(h).trim()) unknown.push(String(h).trim());
        });
        if (!seen.has(spec.keyField)) throw new Error(`Kolom “${spec.keyLabel}” tidak ditemukan. Kolom ini wajib karena menjadi kunci arsip.`);
        return {
          fileName: file.name, sheet: name, headerRow: i, aoa, map, unknown, matched: [...seen],
          missing: spec.allKeys.filter((k) => !seen.has(k)),
        };
      }
    }
  }
  throw new Error(`Tidak menemukan baris judul kolom. Pastikan file mengikuti ${spec.title}.`);
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
    if (!rec.id_proyek) problem = "Nomor Permohonan kosong";
    else if (!rec.nib) problem = "NIB kosong";
    else if (!rec.nama_perusahaan) problem = "Nama pelaku usaha kosong";
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

/* ================= SiCantik ================= */
export interface IzinRow { line: number; rec: Izin; problem: string; dateWarn: boolean }

export function buildIzinRows(P: ParsedSheet) {
  const rows: IzinRow[] = [];
  const ids = new Map<string, number>();
  for (let i = P.headerRow + 1; i < P.aoa.length; i++) {
    const row = P.aoa[i];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const raw: Record<string, unknown> = {};
    P.map.forEach((k, j) => { if (k) raw[k] = row[j]; });
    const rec = normalizeIzin(raw);
    let problem = "";
    if (!rec.id_sicantik) problem = "ID kosong";
    else if (!rec.pemohon) problem = "Nama pemohon kosong";
    else if (!rec.izin) problem = "Jenis izin kosong";
    else if (ids.has(rec.id_sicantik)) problem = `Duplikat baris ${ids.get(rec.id_sicantik)}`;
    if (!problem) ids.set(rec.id_sicantik, i + 1);
    const isDash = (v: unknown) => v == null || /^\s*[-–—]*\s*$/.test(String(v));
    const dateWarn = (!isDash(raw.tanggal) && !rec.tanggal) || (!isDash(raw.tgl_penetapan) && !rec.tgl_penetapan);
    rows.push({ line: i + 1, rec, problem, dateWarn });
  }
  return { rows };
}

/** Tanggal ISO → nomor seri Excel (tanpa pergeseran zona waktu) */
const toDate = (iso: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 864e5 + 25569;
};
function izinToSheet(r: Izin) {
  const o: Record<string, unknown> = {};
  for (const [k, l] of SIC_COLS) {
    if (k === "tanggal") o[l] = toDate(r.tanggal);
    else if (k === "tgl_penetapan") o[l] = toDate(r.tgl_penetapan);
    else if (k === "nomor_izin") o[l] = r.nomor_izin || "-";
    else if (k === "id_sicantik") o[l] = /^\d+$/.test(r.id_sicantik) ? Number(r.id_sicantik) : r.id_sicantik;
    else o[l] = r[k] ?? "";
  }
  const d = (r.sicantik_dokumen || []).map((x) => (x.label ? x.label + ": " : "") + x.nama_file);
  o["Arsip Dokumen"] = [r.keterangan, ...d].filter(Boolean).join("; ");
  return o;
}
function sheetFromIzin(rows: Izin[]) {
  const data = rows.map(izinToSheet);
  const header = [...SIC_COLS.map((c) => c[1]), "Arsip Dokumen"];
  const ws = XLSX.utils.json_to_sheet(data, { header });
  // beri format tanggal pada kolom Tanggal & Tanggal Penetapan
  const dateCols = ["Tanggal", "Tanggal Penetapan"].map((h) => header.indexOf(h));
  for (let r = 1; r <= data.length; r++) for (const c of dateCols) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell && cell.t === "n") cell.z = "dd/mm/yyyy";
  }
  colWidths(ws, data.map((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "number" && k.startsWith("Tanggal") ? "00/00/0000" : v]))));
  return ws;
}
export function exportIzin(rows: Izin[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromIzin(rows), "Data SiCantik");
  save(wb, `Arsip_SiCantik_${stamp()}.xlsx`);
}
export function exportIzinTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([SIC_COLS.map((c) => c[1])]);
  ws["!cols"] = SIC_COLS.map((c) => ({ wch: Math.max(12, c[1].length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap SiCantik");
  save(wb, "Template_Rekap_SiCantik.xlsx");
}
export function exportIzinReport(rows: Izin[], scope: string, instansi: string) {
  const wb = XLSX.utils.book_new();
  const all = groupIzin(rows, () => "Semua")[0];
  const avg = all ? avgLama(all) : null;
  const ws0 = XLSX.utils.aoa_to_sheet([
    ["LAPORAN PERMOHONAN IZIN SICANTIK"], [instansi], ["Cakupan", scope], ["Dicetak", new Date().toLocaleString("id-ID")], [],
    ["Indikator", "Nilai"], ["Jumlah permohonan", rows.length], ["Sudah ditetapkan", all?.terbit || 0], ["Belum ditetapkan", rows.length - (all?.terbit || 0)],
    ["Permohonan baru", all?.baru || 0], ["Perpanjangan", all?.perpanjangan || 0], ["Perubahan", all?.perubahan || 0], ["Pencabutan", all?.pencabutan || 0],
    ["Pemohon unik", new Set(rows.map((r) => r.pemohon_id)).size],
    ["Rata-rata lama proses (hari)", avg == null ? "-" : Math.round(avg * 10) / 10],
  ]);
  ws0["!cols"] = [{ wch: 32 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws0, "Ringkasan");
  const rekap = (name: string, groups: ReturnType<typeof groupIzin>) => {
    const data = groups.sort((a, b) => b.total - a.total).map((g) => ({
      [name]: g.label, Jumlah: g.total, Baru: g.baru, Perpanjangan: g.perpanjangan, Perubahan: g.perubahan, Pencabutan: g.pencabutan,
      "Sudah ditetapkan": g.terbit, "Belum ditetapkan": g.total - g.terbit, "Rata-rata proses (hari)": avgLama(g) == null ? "" : Math.round(avgLama(g)! * 10) / 10,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    colWidths(ws, data);
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, rekap("Jenis izin", groupIzin(rows, (r) => r.izin, (r) => izinShort(r.izin))), "Per Jenis Izin");
  XLSX.utils.book_append_sheet(wb, rekap("Kategori", groupIzin(rows, (r) => katIzin(r))), "Per Kategori");
  const bulan = groupIzin(rows, (r) => (isISO(r.tanggal) ? r.tanggal.slice(0, 7) : "")).sort((a, b) => a.key.localeCompare(b.key));
  const wsb = rekap("Bulan permohonan", bulan);
  XLSX.utils.book_append_sheet(wb, wsb, "Per Bulan");
  XLSX.utils.book_append_sheet(wb, rekap("Lokasi", groupIzin(rows.filter((r) => r.lokasi), (r) => lokasiKey(r.lokasi), (r) => r.lokasi.trim())), "Per Lokasi");
  const pending = rows.filter((r) => statusOf(r) === "Belum ditetapkan");
  XLSX.utils.book_append_sheet(wb, sheetFromIzin(pending), "Belum Ditetapkan");
  XLSX.utils.book_append_sheet(wb, sheetFromIzin(rows), "Data");
  save(wb, `Laporan_SiCantik_${stamp()}.xlsx`);
}

/* ================= Master KBLI ================= */
const KBLI_HEADERS: Record<string, string> = {
  kode: "kode", kodekbli: "kode", kbli: "kode", tingkat: "tingkat", level: "tingkat", judul: "judul", judulkbli: "judul", nama: "judul",
  uraian: "uraian", deskripsi: "uraian", keterangan: "uraian", kategori: "kategori",
};
/** Membaca file master KBLI (kolom: kode, tingkat, judul, uraian, kategori) */
export async function readKbliFile(file: File): Promise<{ rows: Kbli[]; bad: number; versi: string }> {
  const buf = await file.arrayBuffer();
  const wb = /\.csv$/i.test(file.name) ? XLSX.read(new TextDecoder().decode(buf), { type: "string", raw: true }) : XLSX.read(buf, { type: "array" });
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
  const hr = aoa.findIndex((r, i) => i < 10 && (r || []).some((h) => KBLI_HEADERS[norm(h)] === "kode") && (r || []).some((h) => KBLI_HEADERS[norm(h)] === "judul"));
  if (hr < 0) throw new Error("Tidak menemukan kolom “kode” dan “judul”. Format yang didukung: kode, tingkat, judul, uraian, kategori.");
  const map = (aoa[hr] || []).map((h) => KBLI_HEADERS[norm(h)]);
  const m = file.name.match(/(19|20)\d{2}/);
  const versi = m ? m[0] : "2025";
  const rows: Kbli[] = [];
  let bad = 0, kategoriNow = "";
  const seen = new Set<string>();
  for (let i = hr + 1; i < aoa.length; i++) {
    const raw: Record<string, unknown> = {};
    map.forEach((k, j) => { if (k && raw[k] == null) raw[k] = aoa[i]?.[j]; });
    let tingkat = String(raw.tingkat ?? "").trim();
    const kodeRaw = normKode(raw.kode, tingkat);
    if (!tingkat) tingkat = tingkatOf(kodeRaw);
    const kode = normKode(kodeRaw, tingkat);
    const judul = String(raw.judul ?? "").trim();
    if (!kode || !judul || seen.has(kode)) { bad++; continue; }
    seen.add(kode);
    if (tingkat === "Kategori") kategoriNow = kode;
    const kategori = String(raw.kategori ?? "").trim().toUpperCase() || kategoriNow;
    rows.push({ versi, kode, tingkat, judul, uraian: String(raw.uraian ?? "").trim(), kategori, aktif: true });
  }
  return { rows, bad, versi };
}
export function exportKbliTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([["kode", "tingkat", "judul", "uraian", "kategori"], ["G", "Kategori", "PERDAGANGAN BESAR DAN ECERAN", "", "G"], ["47211", "Kelompok", "PERDAGANGAN ECERAN PADI DAN PALAWIJA", "Kelompok ini mencakup …", "G"]]);
  ws["!cols"] = [{ wch: 8 }, { wch: 16 }, { wch: 50 }, { wch: 60 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "KBLI");
  save(wb, "Template_Master_KBLI.xlsx");
}

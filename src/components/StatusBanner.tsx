import { AlertTriangle, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData, useSicantik } from "../context/DataContext";

export function StatusBanner({ kind = "oss" }: { kind?: "oss" | "sicantik" }) {
  const oss = useData();
  const sic = useSicantik();
  const { error, refresh } = kind === "oss" ? oss : sic;
  const { canWrite } = useAuth();
  if (error) return (
    <div className="banner warn"><AlertTriangle size={18} /><div><b>Gagal memuat data.</b> {error} <button className="link" onClick={() => refresh()}>Coba lagi</button></div></div>
  );
  if (!canWrite) return (
    <div className="banner"><Lock size={18} /><div>Anda masuk sebagai <b>Pembaca</b>. Untuk menambah atau mengubah data, minta peran Operator kepada admin.</div></div>
  );
  return null;
}

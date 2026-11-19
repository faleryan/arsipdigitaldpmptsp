import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "../components/Modal";

interface ConfirmOpts { title: string; body: ReactNode; ok?: string; danger?: boolean; typeWord?: string }
interface UIState {
  toast: (msg: string, ms?: number) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}
const Ctx = createContext<UIState>(null as unknown as UIState);
export const useUI = () => useContext(Ctx);

export function UIProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState("");

  const toast = useCallback((m: string, ms = 3500) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => { setTyped(""); setDlg({ ...o, resolve }); }), []);
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      {msg && <div className="toast" role="status" aria-live="polite">{msg}</div>}
      {dlg && (
        <Modal onClose={() => close(false)} size="sm">
          <div className="modal-b confirm">
            {dlg.danger && <div className="confirm-ico"><AlertTriangle size={22} /></div>}
            <h2>{dlg.title}</h2>
            <div className="confirm-body">{dlg.body}</div>
            {dlg.typeWord && (
              <div className="f" style={{ marginTop: 12 }}>
                <label htmlFor="cfType">Ketik <b>{dlg.typeWord}</b> untuk melanjutkan</label>
                <input id="cfType" className="inp" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
              </div>
            )}
          </div>
          <div className="modal-f">
            <button className="btn" onClick={() => close(false)}>Batal</button>
            <button
              className={"btn " + (dlg.danger ? "danger solid" : "primary")}
              disabled={!!dlg.typeWord && typed.trim().toUpperCase() !== dlg.typeWord}
              onClick={() => close(true)}
            >{dlg.ok || "Ya"}</button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

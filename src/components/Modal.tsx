import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({ children, onClose, size = "md", label }: { children: ReactNode; onClose: () => void; size?: "sm" | "md" | "lg"; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("[autofocus],input,button,select,a");
    first?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
      <div ref={ref} className={"modal " + size} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>,
    document.body,
  );
}

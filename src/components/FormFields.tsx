import { isISO } from "../lib/format";

export type FType = "text" | "select" | "list" | "date" | "num" | "money" | "email" | "tel" | "digits";
export interface FieldDef { k: string; label: string; type?: FType; req?: boolean; hint?: string; span?: 2 | 3; opts?: string[]; dyn?: string; readOnly?: boolean; placeholder?: string }

/** Grid isian formulir dari daftar definisi kolom */
export function FieldGrid({ fields, v, errs, set, onBlur, lists = {}, idPrefix = "fi_" }: {
  fields: FieldDef[]; v: Record<string, string>; errs: Record<string, string>; set: (k: string, val: string) => void;
  onBlur?: (f: FieldDef) => void; lists?: Record<string, string[]>; idPrefix?: string;
}) {
  return (
    <div className="fgrid">
      {fields.map((f) => {
        const id = idPrefix + f.k;
        const common = {
          id, name: f.k, value: v[f.k] ?? "", className: "inp" + (errs[f.k] ? " err" : ""), autoComplete: "off",
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(f.k, e.target.value),
          onBlur: () => onBlur?.(f), "aria-invalid": !!errs[f.k] || undefined, placeholder: f.placeholder,
        };
        let input: React.ReactNode;
        if (f.type === "select") {
          const opts = f.opts || [];
          input = <select {...common}><option value="">— pilih —</option>{opts.map((o) => <option key={o}>{o}</option>)}{v[f.k] && !opts.includes(v[f.k]) && <option>{v[f.k]}</option>}</select>;
        } else if (f.type === "list") {
          const opts = f.dyn ? lists[f.dyn] || [] : f.opts || [];
          input = <><input {...common} list={"dl_" + id} /><datalist id={"dl_" + id}>{opts.map((o) => <option key={o} value={o} />)}</datalist></>;
        } else if (f.type === "date") {
          input = <input {...common} type="date" value={isISO(v[f.k]) ? v[f.k] : ""} />;
        } else {
          const extra = f.type === "email" ? { type: "email" } : f.type === "tel" ? { type: "tel", inputMode: "tel" as const }
            : f.type === "money" || f.type === "num" ? { inputMode: "decimal" as const } : f.type === "digits" ? { inputMode: "numeric" as const } : {};
          input = <input {...common} {...extra} readOnly={f.readOnly} />;
        }
        return (
          <div key={f.k} className={"f" + (f.span === 2 ? " span2" : f.span === 3 ? " span3" : "")}>
            <label htmlFor={id}>{f.label}{f.req && <span className="req"> *</span>}</label>
            {input}
            {errs[f.k] ? <span className="msg">{errs[f.k]}</span> : f.hint && <span className="hint">{f.hint}</span>}
          </div>
        );
      })}
    </div>
  );
}

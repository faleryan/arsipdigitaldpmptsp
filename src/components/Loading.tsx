export function Loading({ text = "Memuat…" }: { text?: string }) {
  return <div className="loading"><span className="spin" />{text}</div>;
}

export default function MetricCard({ label, value, detail }) { return <article className="metric-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>; }

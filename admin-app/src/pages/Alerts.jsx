import { useEffect, useMemo, useState } from "react";
import MetricCard from "../components/MetricCard";
import { getOperationalAlerts } from "../services/alertsService";

const types = { all: "Todas", stock: "Stock", orders: "Pedidos", receivables: "Cobros", refunds: "Reintegros", payables: "Proveedores" };

export default function Alerts() {
  const [alerts, setAlerts] = useState([]), [filter, setFilter] = useState("all"), [query, setQuery] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { setAlerts(await getOperationalAlerts()); } catch (loadError) { setError(loadError.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return alerts.filter((alert) => (filter === "all" || alert.type === filter) && (!term || `${alert.title} ${alert.detail} ${alert.value}`.toLowerCase().includes(term))); }, [alerts, filter, query]);
  const total = (type) => alerts.filter((alert) => type === "all" || alert.type === type).length;
  return <section>
    <div className="page-header"><div><p className="eyebrow">Centro operativo</p><h1>Alertas</h1><p className="page-description">Prioridades que requieren seguimiento. Esta pantalla no modifica información.</p></div><button className="button-secondary" onClick={load}>Actualizar</button></div>
    {error && <p className="form-error">{error}</p>}
    {loading ? <div className="empty-state">Revisando pendientes…</div> : <>
      <div className="metrics-grid alert-metrics"><MetricCard label="Críticas" value={alerts.filter((alert) => alert.severity === "critical").length}/><MetricCard label="Stock" value={total("stock")}/><MetricCard label="Cobros y reintegros" value={total("receivables") + total("refunds")}/><MetricCard label="Proveedores" value={total("payables")}/></div>
      <div className="alert-tabs">{Object.entries(types).map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{label} <span>{total(value)}</span></button>)}</div>
      <div className="toolbar alert-toolbar"><input type="search" placeholder="Buscar producto, cliente, pedido o proveedor" value={query} onChange={(event) => setQuery(event.target.value)}/><span>{filtered.length} alertas</span></div>
      {!filtered.length ? <div className="empty-state alert-empty"><h2>Sin pendientes en esta categoría</h2><p>No hay acciones para mostrar con los filtros seleccionados.</p></div> : <div className="alerts-list">{filtered.map((alert) => <a href={alert.href} className={`alert-row alert-${alert.severity}`} key={alert.id}><div><span>{types[alert.type]}</span><h2>{alert.title}</h2><p>{alert.detail}</p></div><strong>{alert.value}</strong></a>)}</div>}
    </>}
  </section>;
}

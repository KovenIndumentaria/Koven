import { useEffect, useMemo, useState } from "react";
import MetricCard from "../components/MetricCard";
import { calculateMetrics, getReportData } from "../services/reportsService";

const money = (value) => `$${Math.round(value || 0).toLocaleString("es-AR")}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function Reports() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState("30");
  const [customRange, setCustomRange] = useState({ from: monthStart(), to: today() });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); setError(""); try { setData(await getReportData()); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const m = useMemo(() => data ? calculateMetrics(data, days === "custom" ? customRange : days) : null, [data, days, customRange]);
  const invalidRange = days === "custom" && (!customRange.from || !customRange.to || customRange.from > customRange.to);

  function exportCsv() {
    if (!m || invalidRange) return;
    const rows = [
      ["REPORTE KOVEN"], ["Desde", m.from || "Inicio"], ["Hasta", m.to || "Hoy"], [],
      ["RESUMEN", "Importe"], ["Ventas netas", m.revenue], ["Costo vendido conocido", m.knownCost], ["Ganancia bruta", m.grossMargin], ["Gastos operativos", m.expenseCost], ["Resultado neto operativo", m.operatingResult], ["Cobrado en el período", m.collected], ["Saldo por cobrar actual", m.outstanding], ["Cobertura de costos", `${Math.round(m.costCoverage * 100)}%`], [],
      ["PRODUCTOS", "Unidades netas", "Ventas", "Costo conocido", "Ganancia conocida", "Unidades con costo"],
      ...m.productRows.map((product) => [product.name, product.quantity, product.revenue, product.cost, product.margin, product.costUnits]),
    ];
    const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `koven-reporte-${m.from || "inicio"}-${m.to || "hoy"}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Reportes</h1><p className="page-description">Rentabilidad de las ventas, gastos y estado del inventario.</p></div><div className="header-actions"><select className="period-select" value={days} onChange={(event) => setDays(event.target.value)}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option><option value="custom">Elegir fechas</option><option value="all">Todo el historial</option></select><button className="button-secondary" onClick={load}>Actualizar</button><button className="button-primary" onClick={exportCsv} disabled={!m || invalidRange}>Exportar CSV</button></div></div>
    {days === "custom" && <div className="report-date-range"><label className="field">Desde<input type="date" value={customRange.from} max={customRange.to || undefined} onChange={(event) => setCustomRange({ ...customRange, from: event.target.value })} /></label><label className="field">Hasta<input type="date" value={customRange.to} min={customRange.from || undefined} max={today()} onChange={(event) => setCustomRange({ ...customRange, to: event.target.value })} /></label>{invalidRange && <p className="form-error">La fecha inicial debe ser anterior o igual a la fecha final.</p>}</div>}
    {error && <p className="form-error">{error}</p>}
    {loading || !m || invalidRange ? <div className="empty-state">{invalidRange ? "Seleccioná un rango de fechas válido." : "Calculando reportes…"}</div> : <>
      {m.costCoverage < 1 && <div className="report-warning"><strong>Rentabilidad parcial</strong><span>Hay costos cargados para el {Math.round(m.costCoverage * 100)}% de las unidades netas del período. La ganancia mostrada puede disminuir al completar los costos faltantes.</span></div>}
      <div className="metrics-grid">
        <MetricCard label="Ventas netas" value={money(m.revenue)} detail={`${m.orders} pedidos · ${m.unitsSold} unidades`} />
        <MetricCard label="Costo vendido conocido" value={money(m.knownCost)} detail={`Cobertura ${Math.round(m.costCoverage * 100)}%`} />
        <MetricCard label="Ganancia bruta" value={money(m.grossMargin)} detail={`${m.grossMarginPercent.toFixed(1)}% sobre ventas`} />
        <MetricCard label="Resultado neto operativo" value={money(m.operatingResult)} detail="Ganancia bruta menos gastos" />
        <MetricCard label="Cobrado en el período" value={money(m.collected)} detail="Flujo real de clientes" />
        <MetricCard label="Saldo por cobrar actual" value={money(m.outstanding)} />
        <MetricCard label="Gastos operativos" value={money(m.expenseCost)} detail={`${m.expenses} gastos`} />
        <MetricCard label="Compras registradas" value={money(m.purchaseCost)} detail={`${m.purchases} compras · no se resta dos veces`} />
      </div>
      <div className="profit-equation"><span>Ventas netas <strong>{money(m.revenue)}</strong></span><b>−</b><span>Costo vendido <strong>{money(m.knownCost)}</strong></span><b>−</b><span>Gastos <strong>{money(m.expenseCost)}</strong></span><b>=</b><span>Resultado <strong>{money(m.operatingResult)}</strong></span></div>
      <div className="report-grid">
        <section className="report-panel"><h2>Composición de ventas</h2><div className="report-breakdown"><p><span>Ventas actuales</span><strong>{money(m.currentRevenue)}</strong></p><p><span>Ventas históricas cargadas</span><strong>{money(m.historicalRevenue)}</strong></p><p><span>Ajustes por cambios/devoluciones</span><strong>{m.adjustmentRevenue >= 0 ? "+" : "−"}{money(Math.abs(m.adjustmentRevenue))}</strong></p><p><span>Ticket promedio</span><strong>{money(m.averageTicket)}</strong></p></div></section>
        <section className="report-panel"><h2>Productos más vendidos</h2>{!m.topProducts.length ? <p>Sin ventas en el período.</p> : <ol className="ranking-list">{m.topProducts.map((product) => <li key={product.name}><span>{product.name}</span><strong>{product.quantity} u.</strong></li>)}</ol>}</section>
        <section className="report-panel"><h2>Mayor ganancia conocida</h2>{!m.topMargins.length ? <p>Completá los costos para ver este ranking.</p> : <ol className="ranking-list margin-ranking">{m.topMargins.map((product) => <li key={product.name}><span>{product.name}<small>{money(product.revenue)} vendidos</small></span><strong>{money(product.margin)}</strong></li>)}</ol>}</section>
        <section className="report-panel"><h2>Inventario actual</h2><div className="inventory-report"><div><strong>{m.stockUnits}</strong><span>unidades</span></div><div><strong>{m.lowStock.length}</strong><span>stock bajo</span></div><div><strong>{m.outOfStock.length}</strong><span>agotadas</span></div></div><h3>Alertas principales</h3>{[...m.outOfStock, ...m.lowStock].slice(0, 8).map((variant) => <p className="stock-alert" key={variant.id}><span>{variant.product?.name} · {[variant.color_name, variant.size].filter(Boolean).join(" / ")}</span><strong>{variant.stock_current}</strong></p>)}</section>
      </div>
    </>}
  </section>;
}

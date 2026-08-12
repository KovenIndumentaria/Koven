import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import { auditData, getAuditData } from "../services/auditService";
import { calculateMetrics, getReportData } from "../services/reportsService";
import { getOrderAccount } from "../utils/orderAccount";

const money = (value) => `$${Math.round(value || 0).toLocaleString("es-AR")}`;

function operationalSummary(auditSource) {
  const activeOrders = auditSource.orders.filter((order) => order.status !== "cancelled");
  const accounts = activeOrders.map(getOrderAccount);
  const customerDebt = accounts.reduce((sum, account) => sum + account.balance, 0);
  const refunds = accounts.reduce((sum, account) => sum + account.refundDue, 0);
  const supplierDebt = auditSource.purchases.filter((purchase) => purchase.status === "confirmed").reduce((sum, purchase) => {
    const paid = purchase.payments.reduce((total, payment) => total + Number(payment.amount), 0);
    return sum + Math.max(0, Number(purchase.total_cost) - paid);
  }, 0);
  return { customerDebt, refunds, supplierDebt };
}

export default function Dashboard() {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    try {
      const [reportData, auditSource] = await Promise.all([getReportData(), getAuditData()]);
      setState({ metrics: calculateMetrics(reportData, 30), audit: auditData(auditSource), operations: operationalSummary(auditSource) });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const m = state?.metrics;
  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Resumen</h1><p className="page-description">Lo más importante para revisar hoy y el resultado de los últimos 30 días.</p></div><button className="button-secondary" onClick={load}>Actualizar</button></div>
    {error && <p className="form-error">{error}</p>}
    {loading || !state ? <div className="empty-state">Cargando resumen…</div> : <>
      <section className="dashboard-priority">
        <div className="section-title"><div><p className="eyebrow">Atención</p><h2>Pendientes operativos</h2></div><a href="#/control">Ver control completo</a></div>
        <div className="dashboard-attention-grid">
          <a href="#/pedidos" className={m.pendingOrders ? "attention-card attention-active" : "attention-card"}><span>Pedidos por confirmar</span><strong>{m.pendingOrders}</strong><small>{m.pendingOrders ? "Requieren una decisión" : "Sin pedidos pendientes"}</small></a>
          <a href="#/saldos" className={state.operations.customerDebt ? "attention-card attention-active" : "attention-card"}><span>Clientes deben</span><strong>{money(state.operations.customerDebt)}</strong><small>Saldo total por cobrar</small></a>
          <a href="#/cuentas-pagar" className={state.operations.supplierDebt ? "attention-card attention-active" : "attention-card"}><span>Debemos a proveedores</span><strong>{money(state.operations.supplierDebt)}</strong><small>Compras confirmadas pendientes</small></a>
          <a href="#/pedidos" className={state.operations.refunds ? "attention-card attention-danger" : "attention-card"}><span>Reintegros pendientes</span><strong>{money(state.operations.refunds)}</strong><small>{state.operations.refunds ? "Dinero pendiente de devolver" : "Sin reintegros pendientes"}</small></a>
        </div>
      </section>

      <section className="dashboard-period"><div className="section-title"><div><p className="eyebrow">Últimos 30 días</p><h2>Rendimiento</h2></div><a href="#/reportes">Abrir reportes</a></div>
        {m.costCoverage < 1 && <p className="dashboard-cost-note">Rentabilidad parcial: hay costos disponibles para el {Math.round(m.costCoverage * 100)}% de las unidades netas vendidas.</p>}
        <div className="metrics-grid"><MetricCard label="Ventas netas" value={money(m.revenue)} detail={`${m.orders} pedidos`} /><MetricCard label="Ganancia bruta conocida" value={money(m.grossMargin)} detail={`${m.grossMarginPercent.toFixed(1)}% de margen`} /><MetricCard label="Gastos" value={money(m.expenseCost)} /><MetricCard label="Resultado operativo" value={money(m.operatingResult)} /></div>
      </section>

      <section className="dashboard-health"><div><p className="eyebrow">Control de datos</p><h2>{state.audit.errors.length ? "Hay errores para revisar" : "Integridad correcta"}</h2><p>{state.audit.errors.length} errores · {state.audit.warnings.length} advertencias · {state.audit.pending.length} pendientes</p></div><a className={state.audit.errors.length ? "button-primary" : "button-secondary"} href="#/control">Revisar control</a></section>
      <div className="dashboard-actions"><a href="#/ventas/nueva">Cargar venta</a><a href="#/compras">Registrar compra</a><a href="#/gastos">Registrar gasto</a><a href="#/productos">Administrar productos</a></div>
    </>}
  </section>;
}

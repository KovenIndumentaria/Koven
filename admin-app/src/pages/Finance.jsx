import { useEffect, useMemo, useState } from "react";
import MetricCard from "../components/MetricCard";
import { getFinanceData } from "../services/financeService";
import { newestDatedFirst } from "../utils/dateSort";

const money = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;
const methods = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };

export default function Finance() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState("30");
  const [method, setMethod] = useState("all");
  const [error, setError] = useState("");
  useEffect(() => { getFinanceData().then(setData).catch((err) => setError(err.message)); }, []);
  const result = useMemo(() => {
    if (!data) return null;
    const from = days === "all" ? null : new Date(Date.now() - Number(days) * 86400000);
    const inRange = (date) => !from || new Date(`${date}T23:59:59`) >= from;
    const methodMatch = (value) => method === "all" || value === method;
    const income = data.income.filter((payment) => inRange(payment.payment_date) && methodMatch(payment.method)).map((payment) => ({ id: `in-${payment.id}`, date: payment.payment_date, created_at: payment.created_at, type: "Ingreso", detail: `Pedido #${payment.order?.order_number} · ${payment.order?.customer_name}`, method: payment.method, amount: Number(payment.amount) }));
    const supplier = data.supplierPayments.filter((payment) => inRange(payment.payment_date) && methodMatch(payment.method)).map((payment) => ({ id: `supplier-${payment.id}`, date: payment.payment_date, created_at: payment.created_at, type: "Egreso", detail: `Proveedor · ${payment.purchase?.supplier?.name || "Compra"}`, method: payment.method, amount: -Number(payment.amount) }));
    const expenses = data.expenses.filter((expense) => inRange(expense.expense_date) && method === "all").map((expense) => ({ id: `expense-${expense.id}`, date: expense.expense_date, created_at: expense.created_at, type: "Egreso", detail: `Gasto · ${expense.description}`, method: null, amount: -Number(expense.amount) }));
    const adjustments = data.adjustmentPayments.filter((payment) => inRange(payment.payment_date) && methodMatch(payment.method)).map((payment) => ({ id: `adjustment-${payment.id}`, date: payment.payment_date, created_at: payment.created_at, type: payment.direction === "collection" ? "Ingreso" : "Egreso", detail: `${payment.adjustment?.operation_type === "exchange" ? "Cambio" : "Devolución"} · Pedido #${payment.adjustment?.order?.order_number}`, method: payment.method, amount: (payment.direction === "collection" ? 1 : -1) * Number(payment.amount) }));
    const movements = [...income, ...supplier, ...expenses, ...adjustments].sort(newestDatedFirst("date"));
    const collections = income.reduce((sum, movement) => sum + movement.amount, 0) + adjustments.filter((movement) => movement.amount > 0).reduce((sum, movement) => sum + movement.amount, 0);
    const refunds = -adjustments.filter((movement) => movement.amount < 0).reduce((sum, movement) => sum + movement.amount, 0);
    return { movements, collections, supplier: -supplier.reduce((sum, movement) => sum + movement.amount, 0), expenses: -expenses.reduce((sum, movement) => sum + movement.amount, 0), refunds };
  }, [data, days, method]);

  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Finanzas</h1><p className="page-description">Entradas y salidas reales de dinero, incluidos cambios y devoluciones.</p></div><div className="finance-filters"><select value={days} onChange={(event) => setDays(event.target.value)}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="all">Todo el historial</option></select><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="all">Todos los métodos</option><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></div></div>
    {error && <p className="form-error">{error}</p>}
    {!result ? <div className="empty-state">Cargando finanzas…</div> : <><div className="metrics-grid"><MetricCard label="Cobros" value={money(result.collections)} /><MetricCard label="Pagos a proveedores" value={money(result.supplier)} /><MetricCard label="Gastos y devoluciones" value={money(result.expenses + result.refunds)} /><MetricCard label="Flujo neto" value={money(result.collections - result.supplier - result.expenses - result.refunds)} /></div><div className="table-wrap section-table"><table className="data-table finance-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Método</th><th>Movimiento</th></tr></thead><tbody>{result.movements.map((movement) => <tr key={movement.id}><td>{new Date(`${movement.date}T12:00:00`).toLocaleDateString("es-AR")}</td><td><span className={movement.amount >= 0 ? "tag tag-ok" : "tag tag-expense"}>{movement.type}</span></td><td>{movement.detail}</td><td>{movement.method ? methods[movement.method] : "—"}</td><td><strong className={movement.amount >= 0 ? "movement-positive" : "movement-negative"}>{movement.amount >= 0 ? "+" : "−"}{money(Math.abs(movement.amount))}</strong></td></tr>)}</tbody></table></div></>}
  </section>;
}

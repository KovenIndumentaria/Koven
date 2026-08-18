import { useEffect, useMemo, useState } from "react";
import ExportActions from "../components/ExportActions";
import MetricCard from "../components/MetricCard";
import Pagination from "../components/Pagination";
import OrderPaymentForm from "../components/OrderPaymentForm";
import OrderRefundForm from "../components/OrderRefundForm";
import OrderDetail from "../components/OrderDetail";
import SaleAdjustmentForm from "../components/SaleAdjustmentForm";
import { advanceOrder, cancelOrder, confirmOrder, deleteOrderPayment, getAdjustmentVariants, getOrders, setOrderStockMode } from "../services/ordersService";
import { getOrderAccount } from "../utils/orderAccount";
import { newestDatedFirst } from "../utils/dateSort";
import { compareValues, paginate } from "../utils/tableView";
import { downloadCsv } from "../utils/exportData";

const labels = { pending_confirmation: "Pendiente", confirmed: "Confirmado", preparing: "Preparando", ready: "Listo", delivered: "Entregado", cancelled: "Cancelado" };
const methods = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };
const nextStatus = { confirmed: "preparing", preparing: "ready", ready: "delivered" };
const money = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;
const operationalStatuses = ["confirmed", "preparing", "ready", "delivered"];

function paymentData(order) {
  const accountTotal = currentItems(order).reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  const originalPaid = (order.payments || []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const adjustmentPaid = (order.adjustments || []).flatMap((adjustment) => adjustment.payments || []).reduce((sum, payment) => sum + (payment.direction === "collection" ? 1 : -1) * Number(payment.amount), 0);
  const paid = originalPaid + adjustmentPaid;
  return { paid, accountTotal, balance: Math.max(0, accountTotal - paid), refundDue: Math.max(0, paid - accountTotal) };
}
function currentItems(order) {
  const returns = (order.adjustments || []).flatMap((adjustment) => adjustment.return_items || []);
  const originals = order.items.map((item) => ({ id: `order-${item.id}`, name: item.product_name_snapshot, variant: item.variant_snapshot, quantity: item.quantity - returns.filter((returned) => returned.order_item_id === item.id).reduce((sum, returned) => sum + returned.quantity, 0), unit_price: item.unit_price }));
  const replacements = (order.adjustments || []).flatMap((adjustment) => adjustment.replacement_items || []).map((item) => ({ id: `replacement-${item.id}`, name: item.variant?.product?.name || "Producto", variant: [item.variant?.color_name, item.variant?.size].filter(Boolean).join(" · "), quantity: item.quantity - returns.filter((returned) => returned.replacement_item_id === item.id).reduce((sum, returned) => sum + returned.quantity, 0), unit_price: item.unit_price }));
  return [...originals, ...replacements].filter((item) => item.quantity > 0);
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [variants, setVariants] = useState([]);
  const [paying, setPaying] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [refunding, setRefunding] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [orderBy, setOrderBy] = useState("newest");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25);
  async function load() { setLoading(true); setError(""); try { const [nextOrders, nextVariants] = await Promise.all([getOrders(), getAdjustmentVariants()]); setOrders(nextOrders); setVariants(nextVariants); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function action(callback, message) { setError(""); try { await callback(); setNotice(message); await load(); } catch (err) { setError(err.message); } }

  const enriched = useMemo(() => orders.map((order) => { const account=getOrderAccount(order); return { ...order, ...account, fullyReturned: account.currentItems.length===0 && (order.adjustments?.length||0)>0 }; }), [orders]);
  useEffect(() => { setPage(1); }, [query, filter, orderBy, pageSize]);
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return enriched.filter((order) => { const search = !term || `${order.order_number} ${order.customer_name} ${order.customer_phone}`.toLowerCase().includes(term); const active = order.status !== "cancelled" && (order.refundDue > 0 || (!order.fullyReturned && order.status !== "delivered")); const status = filter === "all" || (filter === "active" && active) || (filter === "pending" && order.status === "pending_confirmation") || (filter === "preparing" && !order.fullyReturned && ["confirmed", "preparing", "ready"].includes(order.status)) || (filter === "unpaid" && order.balance > 0 && order.status !== "cancelled") || (filter === "returned" && order.fullyReturned) || (filter === "completed" && order.status === "delivered" && !order.fullyReturned) || (filter === "cancelled" && order.status === "cancelled"); return search && status; }).sort((a,b)=>{if(orderBy==="newest")return compareValues(a.created_at,b.created_at,"desc");if(orderBy==="oldest")return compareValues(a.created_at,b.created_at,"asc");if(orderBy==="customer")return compareValues(a.customer_name,b.customer_name,"asc");if(orderBy==="total_desc")return compareValues(a.accountTotal,b.accountTotal,"desc");if(orderBy==="total_asc")return compareValues(a.accountTotal,b.accountTotal,"asc");return compareValues(a.balance,b.balance,"desc");}); }, [enriched, query, filter, orderBy]);
  const visible = paginate(filtered, page, pageSize);
  const pending = enriched.filter((order) => order.status === "pending_confirmation").length;
  const processing = enriched.filter((order) => ["confirmed", "preparing", "ready"].includes(order.status)).length;
  const receivable = enriched.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.balance, 0);
  const exportCsv=()=>downloadCsv(`koven-pedidos-${new Date().toISOString().slice(0,10)}`,["Pedido","Fecha","Cliente","Teléfono","Entrega","Total actualizado","Pagado neto","Saldo","Reintegro pendiente","Estado","Estado de pago","Histórico"],filtered.map((order)=>[order.order_number,new Date(order.created_at).toLocaleString("es-AR"),order.customer_name,order.customer_phone,order.delivery_type==="pickup"?"Retiro":"Envío",order.accountTotal,order.paid,order.balance,order.refundDue,order.fullyReturned?"Devuelto":labels[order.status],order.refundDue>0?"Reintegro pendiente":order.balance>0?order.paid>0?"Pago parcial":"Pago pendiente":"Saldado",order.affects_stock?"No":"Sí"]));

  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Pedidos</h1><p className="page-description">Gestión de ventas, entregas, pagos, cambios y devoluciones.</p></div><div className="header-actions"><ExportActions onCsv={exportCsv} disabled={!filtered.length}/><a className="button-primary" href="#/ventas/nueva">Cargar venta</a><button className="button-secondary" onClick={load}>Actualizar</button></div></div>
    {notice && <div className="success-notice">{notice}</div>}{error && <p className="form-error">{error}</p>}
    <div className="metrics-grid order-metrics"><MetricCard label="Por confirmar" value={pending} /><MetricCard label="En proceso" value={processing} /><MetricCard label="Saldo pendiente" value={money(receivable)} /><MetricCard label="Entregados" value={enriched.filter((order) => order.status === "delivered").length} /></div>
    <div className="toolbar orders-toolbar"><input type="search" placeholder="Buscar cliente, teléfono o pedido" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Pedidos activos</option><option value="pending">Por confirmar</option><option value="preparing">En preparación</option><option value="unpaid">Con saldo pendiente</option><option value="returned">Devueltos</option><option value="completed">Entregados</option><option value="cancelled">Cancelados</option><option value="all">Todos</option></select><select value={orderBy} onChange={(event)=>setOrderBy(event.target.value)}><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option><option value="customer">Cliente A–Z</option><option value="total_desc">Mayor total</option><option value="total_asc">Menor total</option><option value="balance_desc">Mayor saldo</option></select><span>{filtered.length} pedidos</span></div>
    {loading ? <div className="empty-state">Cargando pedidos…</div> : !filtered.length ? <div className="empty-state">No hay pedidos para este filtro.</div> : <><div className="orders-list">{visible.map((order) => <article className="order-card" key={order.id}>
      <div className="order-head"><div><span>Pedido #{order.order_number}</span><h2>{order.customer_name}</h2><small>{order.customer_phone} · {new Date(order.created_at).toLocaleString("es-AR")}</small></div><div className="order-tags"><span className={order.fullyReturned ? "tag" : operationalStatuses.includes(order.status) ? "tag tag-ok" : "tag"}>{order.fullyReturned ? "Devuelto" : labels[order.status]}</span><span className={order.balance === 0 && order.refundDue === 0 ? "tag tag-ok" : "tag tag-payment"}>{order.refundDue > 0 ? "Reintegro pendiente" : order.paid <= 0 && order.accountTotal > 0 ? "Pago pendiente" : order.balance > 0 ? "Pago parcial" : "Saldado"}</span>{!order.affects_stock && <span className="tag">Histórico · sin stock</span>}</div></div>
      <div className="order-items">{order.adjustments?.length > 0 && <small className="current-items-label">Prendas actuales del cliente</small>}{currentItems(order).map((item) => <div key={item.id}><span>{item.name} {item.variant && `· ${item.variant}`} × {item.quantity}</span><strong>{money(item.unit_price * item.quantity)}</strong></div>)}{currentItems(order).length === 0 && <div><span>Sin prendas vigentes</span></div>}</div>
      <div className="order-meta"><span>{order.delivery_type === "pickup" ? "Retiro" : "Envío"}{order.delivery_address ? ` · ${order.delivery_address}` : ""}</span><span>Total actualizado <strong>{money(order.accountTotal)}</strong></span></div>
      <div className="payment-summary"><span>Pagado neto <strong>{money(order.paid)}</strong></span><span>Saldo <strong>{money(order.balance)}</strong></span>{order.refundDue > 0 && <span className="movement-negative">A devolver <strong>{money(order.refundDue)}</strong></span>}</div>
      {order.payments.length > 0 && <div className="payment-list">{[...order.payments].sort(newestDatedFirst("payment_date")).map((payment) => <div key={payment.id}><span>{new Date(`${payment.payment_date}T12:00:00`).toLocaleDateString("es-AR")} · {methods[payment.method]} {payment.notes && `· ${payment.notes}`}</span><strong>{money(payment.amount)}</strong><button onClick={() => window.confirm("¿Eliminar este pago?") && action(() => deleteOrderPayment(payment.id), "Pago eliminado.")}>Eliminar</button></div>)}</div>}
      {order.adjustments?.length > 0 && <div className="adjustment-history"><strong>Cambios y devoluciones</strong>{order.adjustments.map((adjustment) => <div key={adjustment.id}><span>{new Date(`${adjustment.operation_date}T12:00:00`).toLocaleDateString("es-AR")} · {adjustment.operation_type === "exchange" ? "Cambio" : "Devolución"}</span><span>{Number(adjustment.difference) === 0 ? "Sin ajuste" : `Ajuste ${Number(adjustment.difference) > 0 ? "+" : "−"}${money(Math.abs(adjustment.difference))}`}</span></div>)}</div>}
      <div className="form-actions">
        <button className="button-ghost" onClick={() => setViewing(order)}>Ver detalle</button>
        {order.status === "pending_confirmation" && <label className="historical-check"><input type="checkbox" checked={!order.affects_stock} onChange={(event) => action(() => setOrderStockMode(order.id, !event.target.checked), "Modo de inventario actualizado.")} /> Venta histórica: no descontar stock</label>}
        {operationalStatuses.includes(order.status) && !order.fullyReturned && <button className="button-secondary" onClick={() => setAdjusting(order)}>Cambio / devolución</button>}
        {order.refundDue > 0 && <button className="button-secondary" onClick={() => setRefunding(order)}>Registrar reintegro</button>}
        {order.balance > 0 && order.status !== "cancelled" && <button className="button-secondary" onClick={() => setPaying({ order, balance: order.balance })}>Agregar pago</button>}
        {order.status === "pending_confirmation" && <button className="button-primary" onClick={() => window.confirm(`¿Confirmar venta? ${order.affects_stock ? "Se descontará stock." : "No modificará el stock."}`) && action(() => confirmOrder(order.id), "Pedido confirmado correctamente.")}>Confirmar venta</button>}
        {nextStatus[order.status] && !order.fullyReturned && <button className="button-primary" onClick={() => action(() => advanceOrder(order.id, nextStatus[order.status]), `Pedido marcado como ${labels[nextStatus[order.status]]}.`)}>Marcar {labels[nextStatus[order.status]]}</button>}
        {!['delivered','cancelled'].includes(order.status) && !(order.adjustments?.length > 0) && <button className="button-ghost" onClick={() => window.confirm("¿Cancelar el pedido?") && action(() => cancelOrder(order.id), "Pedido cancelado correctamente.")}>Cancelar</button>}
      </div>
    </article>)}</div><Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize}/></>}
    {paying && <OrderPaymentForm order={paying.order} balance={paying.balance} onClose={() => setPaying(null)} onSaved={async () => { setPaying(null); setNotice("Pago registrado correctamente."); await load(); }} />}
    {adjusting && <SaleAdjustmentForm order={adjusting} variants={variants} onClose={() => setAdjusting(null)} onSaved={async () => { setAdjusting(null); setNotice("Cambio o devolución registrado correctamente."); await load(); }} />}
    {refunding && <OrderRefundForm order={refunding} amount={refunding.refundDue} onClose={() => setRefunding(null)} onSaved={async () => { setRefunding(null); setNotice("Reintegro registrado correctamente."); await load(); }} />}
    {viewing && <OrderDetail order={viewing} onClose={() => setViewing(null)} />}
  </section>;
}

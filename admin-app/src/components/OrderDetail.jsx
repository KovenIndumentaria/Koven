import { useEffect, useMemo, useState } from "react";
import { getOrderMovements } from "../services/ordersService";
import { getOrderAccount } from "../utils/orderAccount";
import { newestDatedFirst } from "../utils/dateSort";

const money = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;
const date = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");
const methods = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };

export default function OrderDetail({ order, onClose }) {
  const account = getOrderAccount(order);
  const [movements, setMovements] = useState([]);
  const [movementError, setMovementError] = useState("");
  useEffect(() => { getOrderMovements(order.id).then(setMovements).catch((err) => setMovementError(err.message)); }, [order.id]);

  const payments = useMemo(() => {
    const originals = (order.payments || []).map((payment) => ({ ...payment, id: `order-${payment.id}`, direction: "collection", detail: "Pago de la venta" }));
    const adjustments = (order.adjustments || []).flatMap((adjustment) => (adjustment.payments || []).map((payment) => ({ ...payment, id: `adjustment-${payment.id}`, detail: payment.direction === "refund" ? "Reintegro al cliente" : "Cobro por cambio" })));
    return [...originals, ...adjustments].sort(newestDatedFirst("payment_date"));
  }, [order]);

  function returnLabel(item) {
    if (item.order_item_id) { const source = order.items.find((candidate) => candidate.id === item.order_item_id); return source ? `${source.product_name_snapshot} · ${source.variant_snapshot || "Variante única"}` : "Prenda original"; }
    const source = (order.adjustments || []).flatMap((adjustment) => adjustment.replacement_items || []).find((candidate) => candidate.id === item.replacement_item_id);
    return source ? `${source.variant?.product?.name || "Producto"} · ${[source.variant?.color_name, source.variant?.size].filter(Boolean).join(" · ")}` : "Prenda de un cambio anterior";
  }

  return <div className="panel-overlay"><section className="panel order-detail-panel">
    <div className="panel-header"><div><p className="eyebrow">Pedido #{order.order_number}</p><h2>{order.customer_name}</h2><p>{order.customer_phone} · Venta del {date(order.sale_date)}</p></div><button type="button" className="button-ghost" onClick={onClose}>Cerrar</button></div>
    <div className="order-detail-account"><div><span>Total actualizado</span><strong>{money(account.accountTotal)}</strong></div><div><span>Pagado neto</span><strong>{money(account.paid)}</strong></div><div><span>Saldo pendiente</span><strong>{money(account.balance)}</strong></div><div><span>A reintegrar</span><strong>{money(account.refundDue)}</strong></div></div>

    <section className="order-detail-section"><h3>Venta original</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Producto</th><th>Variante</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.product_name_snapshot}</td><td>{item.variant_snapshot || "—"}</td><td>{item.quantity}</td><td>{money(item.unit_price)}</td><td><strong>{money(item.unit_price * item.quantity)}</strong></td></tr>)}</tbody></table></div></section>
    <section className="order-detail-section"><h3>Prendas actuales del cliente</h3>{!account.currentItems.length ? <div className="empty-state">El cliente ya no conserva prendas de este pedido.</div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Producto</th><th>Variante</th><th>Cantidad</th><th>Valor</th></tr></thead><tbody>{account.currentItems.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.variant || "—"}</td><td>{item.quantity}</td><td><strong>{money(item.unit_price * item.quantity)}</strong></td></tr>)}</tbody></table></div>}</section>

    <section className="order-detail-section"><h3>Cambios y devoluciones</h3>{!order.adjustments?.length ? <div className="empty-state">Sin operaciones posteriores.</div> : <div className="detail-timeline">{[...order.adjustments].sort((a, b) => a.operation_date.localeCompare(b.operation_date)).map((adjustment) => <article key={adjustment.id}><div className="detail-timeline-head"><strong>{adjustment.operation_type === "exchange" ? "Cambio" : "Devolución"} · {date(adjustment.operation_date)}</strong><span>Ajuste {Number(adjustment.difference) >= 0 ? "+" : "−"}{money(Math.abs(adjustment.difference))}</span></div><div className="detail-operation-columns"><div><small>Recibido del cliente</small>{adjustment.return_items.map((item) => <p key={item.id}>{returnLabel(item)} × {item.quantity}<span>{item.restock ? "Reingresó al stock" : "No reingresó"}</span></p>)}</div><div><small>Entregado al cliente</small>{!adjustment.replacement_items.length ? <p>Sin reemplazo</p> : adjustment.replacement_items.map((item) => <p key={item.id}>{item.variant?.product?.name || "Producto"} · {[item.variant?.color_name, item.variant?.size].filter(Boolean).join(" · ")} × {item.quantity}<span>{money(item.unit_price * item.quantity)}</span></p>)}</div></div>{adjustment.notes && <p className="detail-notes">{adjustment.notes}</p>}</article>)}</div>}</section>

    <section className="order-detail-section"><h3>Pagos y reintegros</h3>{!payments.length ? <div className="empty-state">Sin movimientos de dinero.</div> : <div className="payment-list detail-payments">{payments.map((payment) => <div key={payment.id}><span>{date(payment.payment_date)} · {methods[payment.method]} · {payment.detail}{payment.notes ? ` · ${payment.notes}` : ""}</span><strong className={payment.direction === "refund" ? "movement-negative" : "movement-positive"}>{payment.direction === "refund" ? "−" : "+"}{money(payment.amount)}</strong></div>)}</div>}</section>

    <section className="order-detail-section"><h3>Movimientos de stock</h3>{movementError ? <p className="form-error">{movementError}</p> : !movements.length ? <div className="empty-state">Sin movimientos de inventario para este pedido.</div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Variante</th><th>Movimiento</th><th>Motivo</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Date(movement.created_at).toLocaleString("es-AR")}</td><td>{movement.variant?.product?.name || "Producto"}</td><td>{[movement.variant?.color_name, movement.variant?.size].filter(Boolean).join(" · ") || "—"}</td><td><strong className={movement.quantity_delta > 0 ? "movement-positive" : "movement-negative"}>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}</strong></td><td>{movement.reason}</td></tr>)}</tbody></table></div>}</section>
  </section></div>;
}

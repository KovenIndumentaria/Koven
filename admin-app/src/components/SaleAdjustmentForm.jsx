import { useMemo, useState } from "react";
import VariantCombobox from "./VariantCombobox";
import { createSaleAdjustment } from "../services/ordersService";
import { getOrderAccount } from "../utils/orderAccount";

const today = () => new Date().toISOString().slice(0, 10);
const emptyReplacement = () => ({ variant_id: "", quantity: 1, unit_price: "" });
const money = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;

export default function SaleAdjustmentForm({ order, variants, onClose, onSaved }) {
  const [form, setForm] = useState({ operation_type: "exchange", operation_date: today(), notes: "" });
  const [returns, setReturns] = useState({});
  const [replacements, setReplacements] = useState([emptyReplacement()]);
  const [settled, setSettled] = useState(false);
  const [method, setMethod] = useState("transfer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const returnSources = useMemo(() => {
    const allReturns = (order.adjustments || []).flatMap((adjustment) => adjustment.return_items || []);
    const originals = order.items.map((item) => ({ key: `order-${item.id}`, order_item_id: item.id, replacement_item_id: null, name: item.product_name_snapshot, variant: item.variant_snapshot || "Variante única", quantity: item.quantity, unit_price: item.unit_price, returned: allReturns.filter((returned) => returned.order_item_id === item.id).reduce((sum, returned) => sum + returned.quantity, 0) }));
    const replacements = (order.adjustments || []).flatMap((adjustment) => adjustment.replacement_items || []).map((item) => ({ key: `replacement-${item.id}`, order_item_id: null, replacement_item_id: item.id, name: item.variant?.product?.name || "Producto", variant: [item.variant?.color_name, item.variant?.size].filter(Boolean).join(" · ") || "Variante única", quantity: item.quantity, unit_price: item.unit_price, returned: allReturns.filter((returned) => returned.replacement_item_id === item.id).reduce((sum, returned) => sum + returned.quantity, 0) }));
    return [...originals, ...replacements].filter((source) => source.quantity > source.returned);
  }, [order.items, order.adjustments]);
  const availableVariants = order.affects_stock ? variants.filter((variant) => variant.is_active && variant.product?.is_active && variant.stock_current > 0) : variants;
  const returnedItems = returnSources.map((source) => ({ order_item_id: source.order_item_id, replacement_item_id: source.replacement_item_id, quantity: Number(returns[source.key]?.quantity) || 0, restock: order.affects_stock && (returns[source.key]?.restock ?? true), source })).filter((entry) => entry.quantity > 0);
  const replacementItems = form.operation_type === "exchange" ? replacements.filter((item) => item.variant_id && Number(item.quantity) > 0) : [];
  const returnedTotal = returnedItems.reduce((sum, entry) => sum + entry.quantity * Number(entry.source.unit_price), 0);
  const replacementTotal = replacementItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  const difference = replacementTotal - returnedTotal;
  const account = getOrderAccount(order);
  const projectedTotal = Math.max(0, account.accountTotal + difference);
  const projectedBalance = Math.max(0, projectedTotal - account.paid);
  const projectedRefund = Math.max(0, account.paid - projectedTotal);
  const debtAbsorbed = Math.max(0, account.balance - projectedBalance);
  const cashToCollect = Math.max(0, projectedBalance - account.balance);
  const cashToRefund = Math.max(0, projectedRefund - account.refundDue);
  const settlementAmount = cashToCollect || cashToRefund;
  const settlementDirection = cashToCollect > 0 ? "collection" : "refund";
  function updateReturn(id, changes) { setReturns((current) => ({ ...current, [id]: { ...(current[id] || {}), ...changes } })); }
  function updateReplacement(index, changes) { setReplacements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)); }
  function changeOperation(operationType) {
    setForm((current) => ({ ...current, operation_type: operationType }));
    setError("");
    setSettled(false);
    setReplacements(operationType === "return" ? [] : [emptyReplacement()]);
  }

  async function submit(event) {
    event.preventDefault(); setError("");
    if (!returnedItems.length) return setError("Indicá al menos una prenda devuelta.");
    if (form.operation_type === "exchange" && !replacementItems.length) return setError("Agregá al menos una prenda de reemplazo.");
    if (replacementItems.some((item) => order.affects_stock && Number(item.quantity) > variants.find((variant) => variant.id === item.variant_id)?.stock_current)) return setError("Una cantidad supera el stock disponible.");
    setSaving(true);
    const settlement = settled && settlementAmount > 0 ? { amount: settlementAmount, direction: settlementDirection, payment_date: form.operation_date, method, notes: "Diferencia saldada al registrar la operación" } : null;
    try { await createSaleAdjustment(order.id, form, returnedItems.map(({ order_item_id, replacement_item_id, quantity, restock }) => ({ order_item_id, replacement_item_id, quantity, restock })), replacementItems, settlement); await onSaved(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return <div className="panel-overlay"><form className="panel sale-adjustment-panel" onSubmit={submit}>
    <div className="panel-header"><div><p className="eyebrow">Pedido #{order.order_number}</p><h2>Cambio o devolución</h2><p>{order.customer_name}</p></div><button type="button" className="button-ghost" onClick={onClose}>Cerrar</button></div>
    <div className="form-grid"><label className="field">Operación<select value={form.operation_type} onChange={(event) => changeOperation(event.target.value)}><option value="exchange">Cambio por otra prenda</option><option value="return">Solo devolución · sin reemplazo</option></select></label><label className="field">Fecha<input type="date" value={form.operation_date} onChange={(event) => setForm({ ...form, operation_date: event.target.value })} required /></label><label className="field field-wide">Notas<textarea rows="2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div>
    {form.operation_type === "return" && <div className="return-only-notice"><strong>Devolución sin reemplazo</strong><span>El cliente devuelve la prenda y no se agregará ningún producto nuevo.</span></div>}
    {!order.affects_stock && <div className="notice">Esta venta es histórica: la operación se registrará sin modificar el stock actual.</div>}
    <section className="adjustment-section"><h3>Prendas que devuelve el cliente</h3>{!returnSources.length ? <div className="empty-state">No quedan prendas disponibles para cambiar o devolver.</div> : returnSources.map((source) => { const remaining = source.quantity - source.returned; return <div className="return-line" key={source.key}><div><strong>{source.name}</strong><small>{source.variant} · En poder del cliente: {remaining}</small></div><label className="field">Cantidad<input type="number" min="0" max={remaining} step="1" value={returns[source.key]?.quantity ?? ""} placeholder="0" onChange={(event) => updateReturn(source.key, { quantity: event.target.value })} /></label>{order.affects_stock && <label className="restock-check"><input type="checkbox" checked={returns[source.key]?.restock ?? true} onChange={(event) => updateReturn(source.key, { restock: event.target.checked })} /> Reingresa al stock</label>}<strong>{money((Number(returns[source.key]?.quantity) || 0) * Number(source.unit_price))}</strong></div>; })}</section>
    {form.operation_type === "exchange" && <section className="adjustment-section"><div className="variants-header"><div><h3>Prendas que se lleva</h3><p>El precio puede ajustarse solamente para esta operación.</p></div><button type="button" className="button-secondary" onClick={() => setReplacements([...replacements, emptyReplacement()])}>Agregar producto</button></div><div className="purchase-lines">{replacements.map((item, index) => <div className="sale-line" key={index}><VariantCombobox variants={availableVariants} value={item.variant_id} mode="sale" onChange={(variant) => updateReplacement(index, variant ? { variant_id: variant.id, quantity: 1, unit_price: variant.product.sale_price } : { variant_id: "" })} /><label className="field">Cantidad<input type="number" min="1" max={order.affects_stock ? variants.find((variant) => variant.id === item.variant_id)?.stock_current : undefined} step="1" value={item.quantity} onChange={(event) => updateReplacement(index, { quantity: event.target.value })} required /></label><label className="field">Precio unitario<input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateReplacement(index, { unit_price: event.target.value })} required /></label><strong className="line-subtotal">{money(Number(item.quantity) * Number(item.unit_price))}</strong><button type="button" className="button-danger" disabled={replacements.length === 1} onClick={() => setReplacements(replacements.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button></div>)}</div></section>}
    <div className="adjustment-totals"><span>Devuelto: <strong>{money(returnedTotal)}</strong></span><span>Reemplazo: <strong>{money(replacementTotal)}</strong></span><span>Ajuste de mercadería: <strong>{difference >= 0 ? "+" : "−"}{money(Math.abs(difference))}</strong></span></div>
    <div className="account-preview"><div><span>Antes de la operación</span><strong>Total {money(account.accountTotal)} · Pagado {money(account.paid)} · Saldo {money(account.balance)}</strong></div><div><span>Después de la operación</span><strong>Total {money(projectedTotal)} · Saldo {money(projectedBalance)}</strong></div>{debtAbsorbed > 0 && <div><span>Deuda cancelada con la devolución</span><strong>{money(debtAbsorbed)}</strong></div>}{cashToCollect > 0 && <div className="movement-positive"><span>Dinero a cobrar ahora</span><strong>{money(cashToCollect)}</strong></div>}{cashToRefund > 0 && <div className="movement-negative"><span>Dinero a devolver ahora</span><strong>{money(cashToRefund)}</strong></div>}</div>
    {settlementAmount > 0 && <div className="adjustment-settlement"><label className="historical-check"><input type="checkbox" checked={settled} onChange={(event) => setSettled(event.target.checked)} /> {cashToCollect > 0 ? `Registrar cobro de ${money(cashToCollect)}` : `Registrar devolución de ${money(cashToRefund)}`}</label>{settled && <label className="field">Método<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label>}</div>}
    {error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button-ghost" onClick={onClose}>Cancelar</button><button className="button-primary" disabled={saving}>{saving ? "Registrando…" : form.operation_type === "return" ? "Registrar devolución" : "Registrar cambio"}</button></div>
  </form></div>;
}

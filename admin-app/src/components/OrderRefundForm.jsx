import { useState } from "react";
import { addOrderRefund } from "../services/ordersService";

const today = () => new Date().toISOString().slice(0, 10);
export default function OrderRefundForm({ order, amount, onClose, onSaved }) {
  const [form, setForm] = useState({ amount, payment_date: today(), method: "transfer", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) { event.preventDefault(); setSaving(true); setError(""); try { await addOrderRefund(order.id, form); await onSaved(); } catch (err) { setError(err.message); } finally { setSaving(false); } }
  return <div className="panel-overlay"><form className="panel payment-panel" onSubmit={submit}><div className="panel-header"><div><p className="eyebrow">Pedido #{order.order_number}</p><h2>Registrar reintegro</h2><p>A devolver al cliente: <strong>${amount.toLocaleString("es-AR")}</strong></p></div><button type="button" className="button-ghost" onClick={onClose}>Cerrar</button></div><div className="form-grid"><label className="field">Importe<input type="number" min="0.01" max={amount} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label><label className="field">Fecha<input type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} required /></label><label className="field">Método<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label><label className="field field-wide">Notas<textarea rows="2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button-ghost" onClick={onClose}>Cancelar</button><button className="button-primary" disabled={saving}>{saving ? "Registrando…" : "Registrar reintegro"}</button></div></form></div>;
}

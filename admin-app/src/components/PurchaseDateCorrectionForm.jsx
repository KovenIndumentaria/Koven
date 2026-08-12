import { useState } from "react";
import { correctHistoricalPurchaseDate } from "../services/purchasesService";

export default function PurchaseDateCorrectionForm({ purchase, onClose, onSaved }) {
  const [purchaseDate, setPurchaseDate] = useState(purchase.purchase_date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (purchaseDate === purchase.purchase_date) return setError("Elegí una fecha diferente de la actual.");
    setSaving(true);
    try { await correctHistoricalPurchaseDate(purchase.id, purchaseDate); await onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <div className="panel-overlay"><form className="panel purchase-date-panel" onSubmit={submit}>
    <div className="panel-header"><div><p className="eyebrow">Corrección administrativa</p><h2>Corregir fecha de compra</h2><p>{purchase.supplier?.name || "Proveedor"}</p></div><button type="button" className="button-ghost" onClick={onClose}>Cerrar</button></div>
    <div className="date-correction-summary"><span>Fecha registrada</span><strong>{new Date(`${purchase.purchase_date}T12:00:00`).toLocaleDateString("es-AR")}</strong></div>
    <label className="field">Fecha correcta<input type="date" max={new Date().toISOString().slice(0, 10)} value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} required /></label>
    <p className="form-help">Se recalcularán los costos por orden cronológico. El stock y los importes de la compra no cambiarán.</p>
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions"><button type="button" className="button-ghost" onClick={onClose}>Cancelar</button><button className="button-primary" disabled={saving}>{saving ? "Corrigiendo…" : "Guardar fecha correcta"}</button></div>
  </form></div>;
}

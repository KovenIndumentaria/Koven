import { useState } from "react";
import { adjustStock } from "../services/stockService";

export default function StockAdjustmentForm({ variant, onCancel, onSaved }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const numericDelta = Number(delta);
  const resultingStock = variant.stock_current + (Number.isFinite(numericDelta) ? numericDelta : 0);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!Number.isInteger(numericDelta) || numericDelta === 0) return setError("Ingresá un número entero distinto de cero.");
    if (resultingStock < 0) return setError("El ajuste dejaría el stock negativo.");
    if (!reason.trim()) return setError("El motivo es obligatorio.");
    setSaving(true);
    try {
      const newStock = await adjustStock(variant.id, numericDelta, reason.trim());
      await onSaved(newStock);
    } catch (saveError) {
      setError(saveError.message || "No se pudo ajustar el stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel-overlay" role="presentation">
      <form className="adjustment-panel panel" onSubmit={handleSubmit}>
        <div className="panel-header"><div><p className="eyebrow">Inventario</p><h2>Ajustar stock</h2></div><button type="button" className="button-ghost" onClick={onCancel}>Cerrar</button></div>
        <div className="adjustment-product"><strong>{variant.product?.name}</strong><span>{[variant.color_name, variant.size].filter(Boolean).join(" · ") || "Variante única"}</span></div>
        <div className="stock-balance"><div><small>Stock actual</small><strong>{variant.stock_current}</strong></div><div><small>Resultado</small><strong className={resultingStock < 0 ? "stock-zero" : ""}>{resultingStock}</strong></div></div>
        <label className="field">Ajuste (+ suma / − resta)<input type="number" step="1" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="Ej: +3 o -1" required /></label>
        <label className="field">Motivo<textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej: Corrección por conteo físico" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="button-ghost" onClick={onCancel}>Cancelar</button><button type="submit" className="button-primary" disabled={saving}>{saving ? "Guardando…" : "Confirmar ajuste"}</button></div>
      </form>
    </div>
  );
}

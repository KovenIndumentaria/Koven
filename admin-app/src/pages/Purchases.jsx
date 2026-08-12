import { useEffect, useState } from "react";
import PurchaseDetail from "../components/PurchaseDetail";
import PurchaseDateCorrectionForm from "../components/PurchaseDateCorrectionForm";
import PurchaseForm from "../components/PurchaseForm";
import { cancelPurchase, confirmPurchase, getPurchases, getPurchaseVariants, getSuppliers } from "../services/purchasesService";

const labels = { draft: "Borrador", confirmed: "Confirmada", cancelled: "Cancelada" };
const money = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [variants, setVariants] = useState([]);
  const [editing, setEditing] = useState(undefined);
  const [viewing, setViewing] = useState(null);
  const [correcting, setCorrecting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadData() {
    setLoading(true); setError("");
    try { const [nextPurchases, nextSuppliers, nextVariants] = await Promise.all([getPurchases(), getSuppliers(), getPurchaseVariants()]); setPurchases(nextPurchases); setSuppliers(nextSuppliers); setVariants(nextVariants); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadData(); }, []);

  async function confirm(purchase) {
    const effect = purchase.affects_stock ? "El stock aumentará." : "Se registrará como histórica y no modificará el stock.";
    if (!window.confirm(`¿Confirmar esta compra? ${effect} Luego no podrá editarse.`)) return;
    try { await confirmPurchase(purchase.id); setNotice(purchase.affects_stock ? "Compra confirmada y stock actualizado correctamente." : "Compra histórica confirmada sin modificar stock."); await loadData(); }
    catch (err) { setError(err.message); }
  }
  async function cancel(purchase) {
    if (!window.confirm("¿Cancelar este borrador?")) return;
    try { await cancelPurchase(purchase.id); setNotice("Compra cancelada."); await loadData(); }
    catch (err) { setError(err.message); }
  }

  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Compras</h1><p className="page-description">Ingresos de mercadería, costos y pagos a proveedores.</p></div><button className="button-primary" onClick={() => setEditing(null)} disabled={!suppliers.some((supplier) => supplier.is_active)}>Nueva compra</button></div>
    {!suppliers.some((supplier) => supplier.is_active) && <div className="notice">Creá al menos un proveedor activo antes de registrar compras.</div>}{notice && <div className="success-notice">{notice}</div>}{error && <p className="form-error">{error}</p>}
    {loading ? <div className="empty-state">Cargando compras…</div> : !purchases.length ? <div className="empty-state">Todavía no hay compras registradas.</div> : <div className="table-wrap section-table"><table className="data-table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Productos</th><th>Total</th><th>Estado</th><th>Notas</th><th></th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td>{new Date(`${purchase.purchase_date}T12:00:00`).toLocaleDateString("es-AR")}</td><td>{purchase.supplier?.name || "—"}</td><td>{purchase.items.length} línea(s)<small>{purchase.items.reduce((sum, item) => sum + item.quantity, 0)} unidades</small></td><td>{money(purchase.total_cost)}</td><td><span className={purchase.status === "confirmed" ? "tag tag-ok" : "tag"}>{labels[purchase.status]}</span></td><td>{purchase.notes || "—"}</td><td><div className="row-actions"><button onClick={() => setViewing(purchase)}>Ver detalle</button>{purchase.status === "draft" && <><button onClick={() => setEditing(purchase)}>Editar</button><button onClick={() => confirm(purchase)}>Confirmar</button><button onClick={() => cancel(purchase)}>Cancelar</button></>}</div></td></tr>)}</tbody></table></div>}
    {editing !== undefined && <PurchaseForm purchase={editing} suppliers={suppliers} variants={variants} onCancel={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); setNotice("Borrador guardado correctamente."); await loadData(); }} />}
    {viewing && <PurchaseDetail purchase={viewing} onClose={() => setViewing(null)} onCorrectDate={() => { setCorrecting(viewing); setViewing(null); }} />}
    {correcting && <PurchaseDateCorrectionForm purchase={correcting} onClose={() => setCorrecting(null)} onSaved={async () => { setCorrecting(null); setNotice("Fecha histórica corregida y costos recalculados correctamente."); await loadData(); }} />}
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { savePurchase } from "../services/purchasesService";
import ProductCombobox from "./ProductCombobox";

const emptyGroup = () => ({ product_id: "", unit_cost: "", quantities: {} });
const today = () => new Date().toISOString().slice(0, 10);

export default function PurchaseForm({ purchase, suppliers, variants, onCancel, onSaved }) {
  const [form, setForm] = useState({ id: "", supplier_id: "", purchase_date: today(), notes: "", affects_stock: true, extra_cost: "", extra_cost_description: "Envío", consider_paid_on_confirm: true });
  const [groups, setGroups] = useState([emptyGroup()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const products = useMemo(() => {
    const map = new Map();
    variants.forEach((variant) => {
      if (!map.has(variant.product.id)) map.set(variant.product.id, { ...variant.product, variants: [] });
      map.get(variant.product.id).variants.push(variant);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [variants]);

  useEffect(() => {
    if (!purchase) return;
    setForm({ id: purchase.id, supplier_id: purchase.supplier_id, purchase_date: purchase.purchase_date, notes: purchase.notes || "", affects_stock: purchase.affects_stock, extra_cost: purchase.extra_cost ?? "", extra_cost_description: purchase.extra_cost_description || "", consider_paid_on_confirm: purchase.consider_paid_on_confirm });
    const grouped = new Map();
    purchase.items.forEach((item) => {
      const productId = item.variant?.product?.id || variants.find((variant) => variant.id === item.variant_id)?.product?.id;
      if (!grouped.has(productId)) grouped.set(productId, { product_id: productId, unit_cost: item.unit_cost, quantities: {} });
      grouped.get(productId).quantities[item.variant_id] = item.quantity;
    });
    setGroups([...grouped.values()]);
  }, [purchase, variants]);

  function updateGroup(index, changes) { setGroups((current) => current.map((group, i) => i === index ? { ...group, ...changes } : group)); }
  function selectProduct(index, product) {
    updateGroup(index, product ? { product_id: product.id, quantities: {}, unit_cost: product.default_cost ?? "" } : emptyGroup());
  }
  function updateQuantity(groupIndex, variantId, value) {
    setGroups((current) => current.map((group, index) => index === groupIndex ? { ...group, quantities: { ...group.quantities, [variantId]: value } } : group));
  }
  function addGroup() {
    setGroups((current) => [...current, emptyGroup()]);
    requestAnimationFrame(() => document.querySelector(".purchase-product-group:last-child")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  const items = groups.flatMap((group) => Object.entries(group.quantities).filter(([, quantity]) => Number(quantity) > 0).map(([variant_id, quantity]) => ({ variant_id, quantity: Number(quantity), unit_cost: Number(group.unit_cost) })));
  const productCount = groups.filter((group) => group.product_id && Object.values(group.quantities).some((quantity) => Number(quantity) > 0)).length;
  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const productsTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const total = productsTotal + (Number(form.extra_cost) || 0);

  async function submit(event) {
    event.preventDefault(); setError("");
    if (groups.some((group) => !group.product_id)) return setError("Seleccioná un producto en cada bloque.");
    if (groups.some((group) => !Object.values(group.quantities).some((quantity) => Number(quantity) > 0))) return setError("Indicá al menos una variante con cantidad en cada producto.");
    if (groups.some((group) => group.unit_cost === "" || Number(group.unit_cost) < 0)) return setError("Indicá el costo unitario de cada producto.");
    if (new Set(groups.map((group) => group.product_id)).size !== groups.length) return setError("Un producto está repetido. Completá todas sus variantes en el mismo bloque.");
    setSaving(true);
    try { await savePurchase(form, items); await onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <div className="panel-overlay"><form className="purchase-panel panel" onSubmit={submit}>
    <div className="panel-header"><div><p className="eyebrow">Compras</p><h2>{purchase ? "Editar borrador" : "Nueva compra"}</h2></div><button type="button" className="button-ghost" onClick={onCancel}>Cerrar</button></div>
    <div className="form-grid"><label className="field">Proveedor<select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} required><option value="">Seleccionar</option>{suppliers.filter((supplier) => supplier.is_active || supplier.id === form.supplier_id).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="field">Fecha<input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} required /></label><label className="field field-wide">Notas<textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></div>
    <label className="historical-check purchase-history-check"><input type="checkbox" checked={!form.affects_stock} onChange={(e) => setForm({ ...form, affects_stock: !e.target.checked })} /> Compra histórica: registrar costo sin modificar stock actual</label>
    <label className="historical-check purchase-payment-check"><input type="checkbox" checked={form.consider_paid_on_confirm} onChange={(e) => setForm({ ...form, consider_paid_on_confirm: e.target.checked })} /> Considerar completamente pagada al confirmar</label>
    <div className="variants-header purchase-lines-header"><div><h3>Productos</h3><p>Elegí el producto una vez y distribuí la cantidad entre sus variantes.</p></div><div className="purchase-counter"><strong>{productCount}</strong> productos · <strong>{unitCount}</strong> unidades</div></div>
    <div className="purchase-product-groups">{groups.map((group, groupIndex) => {
      const product = products.find((candidate) => candidate.id === group.product_id);
      return <section className="purchase-product-group" key={`${group.product_id || "new"}-${groupIndex}`}>
        <div className="purchase-product-head"><ProductCombobox products={products} value={group.product_id} excludedIds={groups.filter((_, index) => index !== groupIndex).map((item) => item.product_id)} onChange={(selected) => selectProduct(groupIndex, selected)} />
          <label className="field purchase-shared-cost">Costo unitario<input type="number" min="0" step="0.01" value={group.unit_cost} onChange={(e) => updateGroup(groupIndex, { unit_cost: e.target.value })} required /></label>
          <button type="button" className="button-danger" disabled={groups.length === 1} onClick={() => setGroups(groups.filter((_, index) => index !== groupIndex))}>Quitar</button></div>
        {product && <div className="purchase-variant-grid">{product.variants.map((variant) => <label className="purchase-variant-quantity" key={variant.id}><span><strong>{[variant.color_name, variant.size].filter(Boolean).join(" · ") || "Variante única"}</strong><small>{[variant.sku, !variant.is_active && "Variante archivada"].filter(Boolean).join(" · ")}</small></span><input type="number" min="0" step="1" value={group.quantities[variant.id] ?? ""} placeholder="0" aria-label={`Cantidad de ${variant.color_name} ${variant.size}`} onChange={(e) => updateQuantity(groupIndex, variant.id, e.target.value)} /></label>)}</div>}
        {product && <div className="purchase-group-subtotal"><span>{Object.values(group.quantities).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0)} unidades</span><strong>${(Object.values(group.quantities).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0) * (Number(group.unit_cost) || 0)).toLocaleString("es-AR")}</strong></div>}
      </section>;
    })}</div>
    <button type="button" className="button-secondary add-purchase-line" onClick={addGroup}>+ Agregar producto</button>
    <div className="purchase-extra-cost"><label className="field">Concepto adicional<input value={form.extra_cost_description} onChange={(e) => setForm({ ...form, extra_cost_description: e.target.value })} placeholder="Ej.: Envío" /></label><label className="field">Costo adicional<input type="number" min="0" step="0.01" value={form.extra_cost} onChange={(e) => setForm({ ...form, extra_cost: e.target.value })} placeholder="0" /></label></div>
    <div className="purchase-total"><span>Productos: ${productsTotal.toLocaleString("es-AR")} · Adicional: ${(Number(form.extra_cost) || 0).toLocaleString("es-AR")}</span><strong>${total.toLocaleString("es-AR")}</strong></div>
    {error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button-ghost" onClick={onCancel}>Cancelar</button><button className="button-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar borrador"}</button></div>
  </form></div>;
}

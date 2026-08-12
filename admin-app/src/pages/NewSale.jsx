import { useEffect, useMemo, useState } from "react";
import VariantCombobox from "../components/VariantCombobox";
import { createAdminOrder, getSaleFormData } from "../services/adminSalesService";

const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = () => ({ variant_id: "", quantity: 1, unit_price: "" });

export default function NewSale() {
  const [data, setData] = useState({ customers: [], variants: [] });
  const [form, setForm] = useState({ customer_id: "", customer_name: "", customer_phone: "", sale_date: today(), delivery_type: "pickup", delivery_address: "", notes: "", affects_stock: true });
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { getSaleFormData().then(setData).catch((err) => setError(err.message)); }, []);

  function chooseCustomer(id) {
    const customer = data.customers.find((candidate) => candidate.id === id);
    setForm({ ...form, customer_id: id, customer_name: customer?.name || "", customer_phone: customer?.phone || "", delivery_address: customer?.address || "" });
  }
  function updateItem(index, changes) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  const total = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0), [items]);
  const selectableVariants = useMemo(() => form.affects_stock
    ? data.variants.filter((variant) => variant.is_active && variant.product?.is_active && variant.stock_current > 0)
    : data.variants, [data.variants, form.affects_stock]);

  async function submit(event) {
    event.preventDefault(); setError("");
    if (items.some((item) => !item.variant_id)) return setError("Seleccioná todos los productos.");
    if (new Set(items.map((item) => item.variant_id)).size !== items.length) return setError("Una variante está repetida.");
    if (form.affects_stock) {
      const invalidItem = items.find((item) => {
        const variant = data.variants.find((candidate) => candidate.id === item.variant_id);
        return !variant || !variant.is_active || !variant.product?.is_active || variant.stock_current <= 0 || Number(item.quantity) > variant.stock_current;
      });
      if (invalidItem) return setError("La cantidad solicitada supera el stock disponible. Revisá los productos de la venta.");
    }
    setSaving(true);
    try { await createAdminOrder(form, items); window.location.hash = "/pedidos"; }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Nueva venta</h1><p className="page-description">Carga manual de ventas actuales o históricas. Se guardará pendiente de confirmación.</p></div><a className="button-ghost" href="#/pedidos">Volver a pedidos</a></div>
    <form className="manual-sale-form" onSubmit={submit}>
      <section className="report-panel"><h2>Cliente y fecha</h2><div className="form-grid">
        <label className="field field-wide">Cliente existente<select value={form.customer_id} onChange={(event) => chooseCustomer(event.target.value)}><option value="">Nuevo cliente / completar manualmente</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label>
        <label className="field">Nombre<input minLength="2" value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} required /></label>
        <label className="field">Teléfono<input minLength="6" value={form.customer_phone} onChange={(event) => setForm({ ...form, customer_phone: event.target.value })} required /></label>
        <label className="field">Fecha de venta<input type="date" value={form.sale_date} onChange={(event) => setForm({ ...form, sale_date: event.target.value })} required /></label>
        <label className="field">Entrega<select value={form.delivery_type} onChange={(event) => setForm({ ...form, delivery_type: event.target.value })}><option value="pickup">Retiro</option><option value="shipping">Envío</option></select></label>
        {form.delivery_type === "shipping" && <label className="field field-wide">Dirección<input value={form.delivery_address} onChange={(event) => setForm({ ...form, delivery_address: event.target.value })} required /></label>}
        <label className="field field-wide">Notas<textarea rows="2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div><label className="historical-check purchase-history-check"><input type="checkbox" checked={!form.affects_stock} onChange={(event) => setForm({ ...form, affects_stock: !event.target.checked })} /> Venta histórica: no descontar stock actual</label></section>

      <section className="report-panel sale-items-panel"><div className="variants-header"><div><h2>Productos vendidos</h2><p>Escribí el producto, color, talle o SKU para encontrar rápidamente la variante.</p></div><button type="button" className="button-secondary" onClick={() => setItems([...items, emptyItem()])}>Agregar producto</button></div>
        <div className="purchase-lines">{items.map((item, index) => <div className="sale-line" key={index}>
          <VariantCombobox variants={selectableVariants} value={item.variant_id} mode="sale" onChange={(variant) => updateItem(index, variant ? { variant_id: variant.id, unit_price: variant.product.sale_price, quantity: 1 } : { variant_id: "" })} />
          <label className="field">Cantidad<input type="number" min="1" max={form.affects_stock ? data.variants.find((variant) => variant.id === item.variant_id)?.stock_current : undefined} step="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} required />{form.affects_stock && item.variant_id && <small>Máximo: {data.variants.find((variant) => variant.id === item.variant_id)?.stock_current ?? 0}</small>}</label>
          <label className="field">Precio unitario<input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: event.target.value })} required /></label>
          <strong className="line-subtotal">${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString("es-AR")}</strong>
          <button type="button" className="button-danger" disabled={items.length === 1} onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>
        </div>)}</div>
        <div className="purchase-total"><span>Total de la venta</span><strong>${total.toLocaleString("es-AR")}</strong></div>
      </section>
      {error && <p className="form-error">{error}</p>}<div className="form-actions"><button className="button-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar venta pendiente"}</button></div>
    </form>
  </section>;
}

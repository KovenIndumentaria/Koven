import { useEffect, useState } from "react";
import { saveProduct } from "../services/productsService";

const emptyVariant = () => ({ id: "", size: "", color_name: "", color_hex: "", sku: "", stock_current: 0, cost: "", is_active: true });
const emptyProduct = { id: "", legacy_sheet_id: "", category_id: "", name: "", description: "", sale_price: "", default_cost: "", style: "", is_active: true, is_featured: false, is_new: false };

export default function ProductForm({ product, categories, onCancel, onSaved }) {
  const [form, setForm] = useState(emptyProduct);
  const [variants, setVariants] = useState([emptyVariant()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!product) {
      setForm(emptyProduct);
      setVariants([emptyVariant()]);
      return;
    }
    setForm({
      id: product.id, legacy_sheet_id: product.legacy_sheet_id || "", category_id: product.category_id || "",
      name: product.name, description: product.description || "", sale_price: product.sale_price,
      default_cost: product.default_cost ?? "", style: product.style || "", is_active: product.is_active,
      is_featured: product.is_featured, is_new: product.is_new,
    });
    setVariants(product.variants?.length ? [...product.variants].sort((a, b) => a.size.localeCompare(b.size, "es")).map((variant) => ({ ...variant, cost: variant.cost ?? "" })) : [emptyVariant()]);
  }, [product]);

  function updateVariant(index, field, value) {
    setVariants((current) => current.map((variant, variantIndex) => variantIndex === index ? { ...variant, [field]: value } : variant));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!variants.length) return setError("Agregá al menos una variante.");
    const combinations = new Set();
    for (const variant of variants) {
      const key = `${variant.color_name.trim().toLowerCase()}|${variant.size.trim().toLowerCase()}`;
      if (combinations.has(key)) return setError("Hay variantes repetidas con el mismo color y talle.");
      combinations.add(key);
      if (Number(variant.stock_current) < 0) return setError("El stock no puede ser negativo.");
    }

    setSaving(true);
    try {
      await saveProduct({ ...form, category_id: form.category_id ? String(form.category_id) : "" }, variants.map((variant) => ({ ...variant, stock_current: Number(variant.stock_current), cost: variant.cost === "" ? "" : Number(variant.cost) })));
      await onSaved();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel-overlay" role="presentation">
      <form className="product-form panel" onSubmit={handleSubmit}>
        <div className="panel-header"><div><p className="eyebrow">Productos</p><h2>{product ? "Editar producto" : "Nuevo producto"}</h2></div><button type="button" className="button-ghost" onClick={onCancel}>Cerrar</button></div>
        <div className="form-grid">
          <label className="field field-wide">Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="field">Categoría<select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required><option value="">Seleccionar</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="field">Estilo<input value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} /></label>
          <label className="field">Precio de venta<input type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} required /></label>
          <label className="field">Costo orientativo<input type="number" min="0" step="0.01" value={form.default_cost} onChange={(e) => setForm({ ...form, default_cost: e.target.value })} /></label>
          <label className="field field-wide">Descripción<textarea rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        </div>
        <div className="check-row">
          <label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activo</label>
          <label><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Destacado</label>
          <label><input type="checkbox" checked={form.is_new} onChange={(e) => setForm({ ...form, is_new: e.target.checked })} /> Nuevo</label>
        </div>
        <div className="variants-header"><div><h3>Variantes</h3><p>El stock se administra por combinación de color y talle.</p></div><button type="button" className="button-secondary" onClick={() => setVariants([...variants, emptyVariant()])}>Agregar variante</button></div>
        <div className="variants-list">
          {variants.map((variant, index) => (
            <div className="variant-row" key={variant.id || `new-${index}`}>
              <label className="field">Color<input value={variant.color_name} onChange={(e) => updateVariant(index, "color_name", e.target.value)} placeholder="Negro" /></label>
              <label className="field">Hex<input value={variant.color_hex} onChange={(e) => updateVariant(index, "color_hex", e.target.value)} placeholder="#000000" /></label>
              <label className="field">Talle<input value={variant.size} onChange={(e) => updateVariant(index, "size", e.target.value)} placeholder="M" /></label>
              <label className="field">Stock<input type="number" min="0" step="1" value={variant.stock_current} onChange={(e) => updateVariant(index, "stock_current", e.target.value)} required /></label>
              <label className="field">Costo<input type="number" min="0" step="0.01" value={variant.cost} onChange={(e) => updateVariant(index, "cost", e.target.value)} /></label>
              <button type="button" className="button-danger" disabled={variants.length === 1} onClick={() => setVariants(variants.filter((_, variantIndex) => variantIndex !== index))}>Quitar</button>
            </div>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="button-ghost" onClick={onCancel}>Cancelar</button><button type="submit" className="button-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar producto"}</button></div>
      </form>
    </div>
  );
}

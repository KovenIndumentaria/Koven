import { useEffect, useState } from "react";
import { saveProduct } from "../services/productsService";
import ProductImagesManager from "./ProductImagesManager";

const emptyVariant = () => ({ id: "", size: "", color_name: "", color_hex: "", sku: "", stock_current: 0, cost: "", is_active: true });
const emptyProduct = { id: "", legacy_sheet_id: "", category_id: "", name: "", description: "", sale_price: "", default_cost: "", style: "", is_active: true, is_featured: false, is_new: false };
const sizes = ["Único", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52"];
const colors = [{ name: "Negro", hex: "#000000" }, { name: "Blanco", hex: "#FFFFFF" }, { name: "Gris", hex: "#808080" }, { name: "Beige", hex: "#D8C3A5" }, { name: "Marrón", hex: "#795548" }, { name: "Azul", hex: "#1E4D8F" }, { name: "Celeste", hex: "#87CEEB" }, { name: "Rojo", hex: "#C62828" }, { name: "Verde", hex: "#3E6B48" }, { name: "Rosa", hex: "#E8A0B5" }];

const comparableProduct = (value) => ({ legacy_sheet_id: value?.legacy_sheet_id || "", category_id: String(value?.category_id || ""), name: value?.name || "", description: value?.description || "", sale_price: Number(value?.sale_price || 0), default_cost: value?.default_cost === "" || value?.default_cost == null ? null : Number(value.default_cost), style: value?.style || "", is_active: Boolean(value?.is_active), is_featured: Boolean(value?.is_featured), is_new: Boolean(value?.is_new) });
const comparableVariants = (values) => (values || []).map((value) => ({ id: value.id || "", size: value.size || "", color_name: value.color_name || "", color_hex: value.color_hex || "", sku: value.sku || "", stock_current: Number(value.stock_current || 0), cost: value.cost === "" || value.cost == null ? null : Number(value.cost), is_active: Boolean(value.is_active) })).sort((a, b) => a.id.localeCompare(b.id) || `${a.color_name}|${a.size}`.localeCompare(`${b.color_name}|${b.size}`));

export default function ProductForm({ product, categories, onCancel, onSaved, onImagesChanged }) {
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
    const unchanged = product && JSON.stringify(comparableProduct(form)) === JSON.stringify(comparableProduct(product)) && JSON.stringify(comparableVariants(variants)) === JSON.stringify(comparableVariants(product.variants));
    if (unchanged) { onCancel(); return; }
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
              <label className="field">Color<input list="koven-colors" value={variant.color_name} onChange={(e) => { const color = colors.find((item) => item.name.toLowerCase() === e.target.value.toLowerCase()); updateVariant(index, "color_name", e.target.value); if (color) setTimeout(() => updateVariant(index, "color_hex", color.hex), 0); }} placeholder="Elegir o escribir" /></label>
              <label className="field">Hex<input value={variant.color_hex} onChange={(e) => updateVariant(index, "color_hex", e.target.value)} placeholder="#000000" /></label>
              <label className="field">Talle<input list="koven-sizes" value={variant.size} onChange={(e) => updateVariant(index, "size", e.target.value)} placeholder="Elegir o escribir" /></label>
              <label className="field">Stock<input type="number" min="0" step="1" value={variant.stock_current} onChange={(e) => updateVariant(index, "stock_current", e.target.value)} disabled={Boolean(variant.id)} required />{variant.id && <small>Usá la sección Stock</small>}</label>
              <button type="button" className="button-danger" disabled={variants.length === 1} onClick={() => setVariants(variants.filter((_, variantIndex) => variantIndex !== index))}>Quitar</button>
            </div>
          ))}
        </div>
        <datalist id="koven-sizes">{sizes.map((size) => <option value={size} key={size} />)}</datalist>
        <datalist id="koven-colors">{colors.map((color) => <option value={color.name} key={color.name} />)}</datalist>
        {product ? <><ProductImagesManager product={product} onChanged={onImagesChanged} /><p className="images-autosave-note">Las imágenes se guardan automáticamente. No es necesario guardar nuevamente el producto.</p></> : <div className="images-empty images-save-first">Guardá el producto antes de cargar sus imágenes.</div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="button-ghost" onClick={onCancel}>Cancelar</button><button type="submit" className="button-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar producto"}</button></div>
      </form>
    </div>
  );
}

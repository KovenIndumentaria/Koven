import { useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, uploadCategoryCover } from "../services/settingsService";

const categories = [
  ["remeras", "Remeras"], ["abrigos", "Abrigos"], ["pantalones", "Pantalones"],
  ["gorras", "Gorras"], ["medias", "Medias y Boxers"], ["accesorios", "Accesorios"],
];

export default function Settings() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const inputs = useRef({});

  useEffect(() => { getSettings().then(setForm).catch((e) => setError(e.message)); }, []);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try { await saveSettings(form); setNotice("Configuración guardada correctamente."); setForm(await getSettings()); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function uploadCover(slug, file) {
    if (!file) return;
    setUploading(slug); setError(""); setNotice("");
    try {
      const url = await uploadCategoryCover(slug, file);
      setForm((current) => ({ ...current, [`category_cover_${slug}`]: url }));
      setNotice("Imagen preparada. Presioná Guardar configuración para publicarla.");
    } catch (err) { setError(err.message); }
    finally { setUploading(""); if (inputs.current[slug]) inputs.current[slug].value = ""; }
  }

  if (!form) return <section><p className="eyebrow">Administración</p><h1>Configuración</h1>{error ? <p className="form-error">{error}</p> : <div className="empty-state">Cargando configuración…</div>}</section>;

  return <section>
    <div className="page-header"><div><p className="eyebrow">Administración</p><h1>Configuración</h1><p className="page-description">Datos públicos, canales de venta y reglas de entrega.</p></div></div>
    {notice && <div className="success-notice">{notice}</div>}{error && <p className="form-error">{error}</p>}
    <form onSubmit={submit}>
      <section className="report-panel settings-section"><h2>Tienda y contacto</h2><div className="form-grid">
        <label className="field">Nombre<input value={form.store_name} onChange={(e) => setForm({...form, store_name:e.target.value})} required /></label>
        <label className="field">WhatsApp internacional<input value={form.whatsapp_number} onChange={(e) => setForm({...form, whatsapp_number:e.target.value})} placeholder="5493517557401" required /><small>Solo números, con código de país.</small></label>
        <label className="field field-wide">Instagram<input type="url" value={form.instagram_url} onChange={(e) => setForm({...form, instagram_url:e.target.value})} /></label>
        <label className="field field-wide">Mensaje del checkout<textarea rows="3" value={form.checkout_message} onChange={(e) => setForm({...form, checkout_message:e.target.value})} /></label>
      </div></section>
      <section className="report-panel settings-section"><div className="settings-section-heading"><div><h2>Portadas de categorías</h2><p>Imágenes que aparecen en la sección Categorías del inicio.</p></div></div><div className="category-covers-grid">
        {categories.map(([slug, label]) => <article className="category-cover-card" key={slug}>
          <div className="category-cover-preview"><img src={form[`category_cover_${slug}`]} alt={`Portada de ${label}`} /></div>
          <strong>{label}</strong>
          <input ref={(node) => { inputs.current[slug] = node; }} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadCover(slug, e.target.files?.[0])} />
          <button className="button-secondary" type="button" disabled={Boolean(uploading)} onClick={() => inputs.current[slug]?.click()}>{uploading === slug ? "Procesando…" : "Reemplazar imagen"}</button>
        </article>)}
      </div><small className="settings-help">Usá imágenes verticales y similares entre sí. Se convierten automáticamente a WebP.</small></section>
      <section className="report-panel settings-section"><h2>Entrega</h2><div className="check-row"><label><input type="checkbox" checked={form.pickup_enabled} onChange={(e) => setForm({...form,pickup_enabled:e.target.checked})}/> Permitir retiro</label><label><input type="checkbox" checked={form.shipping_enabled} onChange={(e) => setForm({...form,shipping_enabled:e.target.checked})}/> Permitir envío</label></div><div className="form-grid"><label className="field field-wide">Lugar de retiro<input value={form.pickup_address} onChange={(e) => setForm({...form,pickup_address:e.target.value})} disabled={!form.pickup_enabled}/></label><label className="field">Costo de envío<select value={form.shipping_mode} onChange={(e) => setForm({...form,shipping_mode:e.target.value})} disabled={!form.shipping_enabled}><option value="coordinate">A coordinar por WhatsApp</option><option value="flat">Costo fijo</option></select></label>{form.shipping_mode === "flat" && <><label className="field">Importe fijo<input type="number" min="0" step="0.01" value={form.shipping_cost} onChange={(e) => setForm({...form,shipping_cost:e.target.value})}/></label><label className="field">Envío gratis desde (opcional)<input type="number" min="0" step="0.01" value={form.free_shipping_from ?? ""} onChange={(e) => setForm({...form,free_shipping_from:e.target.value})}/></label></>}</div></section>
      <section className="report-panel settings-section"><h2>Estado de ventas</h2><label className="settings-sales-toggle"><input type="checkbox" checked={form.sales_enabled} onChange={(e) => setForm({...form,sales_enabled:e.target.checked})}/><span><strong>Ventas online habilitadas</strong><small>Si lo desactivás, el catálogo sigue visible pero no acepta pedidos nuevos.</small></span></label></section>
      <div className="form-actions"><button className="button-primary" disabled={saving || Boolean(uploading)}>{saving ? "Guardando…" : "Guardar configuración"}</button></div>
    </form>
  </section>;
}

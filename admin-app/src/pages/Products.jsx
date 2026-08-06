import { useEffect, useMemo, useState } from "react";
import ProductForm from "../components/ProductForm";
import { getCategories, getProducts, importGoogleSheet, setProductActive } from "../services/productsService";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(undefined);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [notice, setNotice] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [nextProducts, nextCategories] = await Promise.all([getProducts(), getCategories()]);
      setProducts(nextProducts);
      setCategories(nextCategories);
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.legacy_sheet_id || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || (status === "active" ? product.is_active : !product.is_active);
    return matchesQuery && matchesStatus;
  }), [products, query, status]);

  async function handleImport() {
    const confirmed = window.confirm("La importación actualizará productos y variantes que tengan el mismo ID de Google Sheets. No importará imágenes y no modificará la tienda pública. ¿Continuar?");
    if (!confirmed) return;
    setImporting(true); setProgress(null); setError(""); setNotice("");
    try {
      const result = await importGoogleSheet(setProgress);
      setNotice(`Importación terminada: ${result.imported} productos válidos. Las imágenes no fueron importadas.`);
      await loadData();
    } catch (importError) {
      setError(importError.message || "La importación no pudo completarse.");
    } finally {
      setImporting(false);
    }
  }

  async function toggleActive(product) {
    try {
      await setProductActive(product.id, !product.is_active);
      await loadData();
    } catch (toggleError) {
      setError(toggleError.message || "No se pudo cambiar el estado.");
    }
  }

  return (
    <section>
      <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Productos</h1><p className="page-description">Productos, precios, variantes y stock inicial. Las imágenes se cargarán en la siguiente etapa.</p></div><div className="header-actions"><button className="button-secondary" type="button" disabled={importing} onClick={handleImport}>{importing ? "Importando…" : "Importar Google Sheets"}</button><button className="button-primary" type="button" onClick={() => setEditing(null)}>Nuevo producto</button></div></div>
      {progress && importing && <div className="notice">Importando {progress.imported} de {progress.total}: {progress.name}</div>}
      {notice && <div className="success-notice">{notice}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="toolbar"><input type="search" placeholder="Buscar por nombre o ID anterior" value={query} onChange={(e) => setQuery(e.target.value)} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select><span>{filtered.length} productos</span></div>
      {loading ? <div className="empty-state">Cargando productos…</div> : !products.length ? <div className="empty-state"><h2>Todavía no hay productos</h2><p>Importá Google Sheets o creá el primero manualmente.</p></div> : (
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Variantes</th><th>Stock</th><th>Imagen</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map((product) => {
          const activeVariants = product.variants?.filter((variant) => variant.is_active) || [];
          const stock = activeVariants.reduce((total, variant) => total + variant.stock_current, 0);
          return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.legacy_sheet_id ? `Sheet #${product.legacy_sheet_id}` : "Creado en Supabase"}</small></td><td>{product.category?.name || "Sin categoría"}</td><td>${Number(product.sale_price).toLocaleString("es-AR")}</td><td>{activeVariants.length}</td><td><span className={stock === 0 ? "stock-zero" : stock <= 3 ? "stock-low" : ""}>{stock}</span></td><td><span className={product.images?.length ? "tag tag-ok" : "tag"}>{product.images?.length ? `${product.images.length} cargada(s)` : "Pendiente"}</span></td><td><span className={product.is_active ? "tag tag-ok" : "tag"}>{product.is_active ? "Activo" : "Archivado"}</span></td><td><div className="row-actions"><button type="button" onClick={() => setEditing(product)}>Editar</button><button type="button" onClick={() => toggleActive(product)}>{product.is_active ? "Archivar" : "Activar"}</button></div></td></tr>;
        })}</tbody></table></div>
      )}
      {editing !== undefined && <ProductForm product={editing} categories={categories} onCancel={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); setNotice("Producto guardado correctamente."); await loadData(); }} />}
    </section>
  );
}

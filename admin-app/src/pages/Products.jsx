import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import ProductForm from "../components/ProductForm";
import SortableHeader from "../components/SortableHeader";
import { getCategories, getProducts, setProductActive } from "../services/productsService";
import { compareValues, nextSort, paginate } from "../utils/tableView";

function productValues(product) {
  const activeVariants = product.variants?.filter((variant) => variant.is_active) || [];
  return {
    variants: activeVariants.length,
    stock: activeVariants.reduce((total, variant) => total + Number(variant.stock_current || 0), 0),
    images: product.images?.length || 0,
    cost: product.default_cost == null ? null : Number(product.default_cost),
  };
}

export default function Products() {
  const [products, setProducts] = useState([]), [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [imageFilter, setImageFilter] = useState("all"), [costFilter, setCostFilter] = useState("all");
  const [sort, setSort] = useState({ column: "name", direction: "asc" });
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25), [editing, setEditing] = useState(undefined);

  async function loadData() { setLoading(true); setError(""); try { const [nextProducts, nextCategories] = await Promise.all([getProducts(), getCategories()]); setProducts(nextProducts); setCategories(nextCategories); } catch (e) { setError(e.message || "No se pudieron cargar los productos."); } finally { setLoading(false); } }
  useEffect(() => { loadData(); }, []);
  useEffect(() => { setPage(1); }, [query, status, imageFilter, costFilter, sort, pageSize]);

  const filtered = useMemo(() => products.filter((product) => {
    const values = productValues(product);
    const matchesQuery = `${product.name} ${product.legacy_sheet_id || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || (status === "active" ? product.is_active : !product.is_active);
    const matchesImage = imageFilter === "all" || (imageFilter === "with" ? values.images > 0 : values.images === 0);
    const matchesCost = costFilter === "all" || (costFilter === "with" ? values.cost != null && values.cost > 0 : values.cost == null || values.cost === 0);
    return matchesQuery && matchesStatus && matchesImage && matchesCost;
  }).sort((a, b) => {
    const av = productValues(a), bv = productValues(b);
    const values = {
      name: [a.name, b.name], category: [a.category?.name, b.category?.name], price: [Number(a.sale_price), Number(b.sale_price)],
      variants: [av.variants, bv.variants], stock: [av.stock, bv.stock], images: [av.images, bv.images], cost: [av.cost, bv.cost], status: [a.is_active ? 1 : 0, b.is_active ? 1 : 0],
    }[sort.column];
    return compareValues(values?.[0], values?.[1], sort.direction) || compareValues(a.name, b.name, "asc");
  }), [products, query, status, imageFilter, costFilter, sort]);

  const visible = paginate(filtered, page, pageSize);
  const changeSort = (column) => setSort((current) => nextSort(current, column));
  async function toggleActive(product) { try { await setProductActive(product.id, !product.is_active); await loadData(); } catch (e) { setError(e.message || "No se pudo cambiar el estado."); } }

  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Productos</h1><p className="page-description">Productos, precios, variantes e imágenes publicados desde Supabase.</p></div><div className="header-actions"><button className="button-primary" type="button" onClick={() => setEditing(null)}>Nuevo producto</button></div></div>
    {notice && <div className="success-notice">{notice}</div>}{error && <p className="form-error" role="alert">{error}</p>}
    <div className="toolbar toolbar-products"><input type="search" placeholder="Buscar por nombre o ID anterior" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filtrar estado" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Archivados</option></select><select aria-label="Filtrar imágenes" value={imageFilter} onChange={(e) => setImageFilter(e.target.value)}><option value="all">Todas las imágenes</option><option value="without">Imagen pendiente</option><option value="with">Con imagen</option></select><select aria-label="Filtrar costos" value={costFilter} onChange={(e) => setCostFilter(e.target.value)}><option value="all">Todos los costos</option><option value="without">Costo pendiente</option><option value="with">Con costo</option></select><span>{filtered.length} productos</span></div>
    {loading ? <div className="empty-state">Cargando productos…</div> : !filtered.length ? <div className="empty-state"><h2>No hay productos para estos filtros</h2><p>Probá cambiando la búsqueda o los filtros seleccionados.</p></div> : <>
      <div className="table-wrap"><table className="data-table"><thead><tr><SortableHeader column="name" label="Producto" sort={sort} onSort={changeSort}/><SortableHeader column="category" label="Categoría" sort={sort} onSort={changeSort}/><SortableHeader column="price" label="Precio" sort={sort} onSort={changeSort}/><SortableHeader column="variants" label="Variantes" sort={sort} onSort={changeSort}/><SortableHeader column="stock" label="Stock" sort={sort} onSort={changeSort}/><SortableHeader column="images" label="Imagen" sort={sort} onSort={changeSort}/><SortableHeader column="status" label="Estado" sort={sort} onSort={changeSort}/><th></th></tr></thead><tbody>{visible.map((product) => { const values = productValues(product); return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.legacy_sheet_id ? `Sheet #${product.legacy_sheet_id}` : "Creado en Supabase"}</small></td><td>{product.category?.name || "Sin categoría"}</td><td>${Number(product.sale_price).toLocaleString("es-AR")}</td><td>{values.variants}</td><td><span className={values.stock === 0 ? "stock-zero" : values.stock <= 3 ? "stock-low" : ""}>{values.stock}</span></td><td><span className={values.images ? "tag tag-ok" : "tag"}>{values.images ? `${values.images} cargada(s)` : "Pendiente"}</span></td><td><span className={product.is_active ? "tag tag-ok" : "tag"}>{product.is_active ? "Activo" : "Archivado"}</span></td><td><div className="row-actions"><button type="button" onClick={() => setEditing(product)}>Editar</button><button type="button" onClick={() => toggleActive(product)}>{product.is_active ? "Archivar" : "Activar"}</button></div></td></tr>; })}</tbody></table></div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(size) => setPageSize(size)} />
    </>}
    {editing !== undefined && <ProductForm product={editing} categories={categories} onCancel={() => setEditing(undefined)} onImagesChanged={loadData} onSaved={async () => { setEditing(undefined); setNotice("Producto guardado correctamente."); await loadData(); }} />}
  </section>;
}

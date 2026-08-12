import { useEffect, useMemo, useState } from "react";
import { getActivity } from "../services/activityService";

const entityLabels = { products: "Producto", product_variants: "Variante", product_images: "Imagen", suppliers: "Proveedor", supplier_purchases: "Compra", supplier_purchase_payments: "Pago a proveedor", orders: "Pedido", order_payments: "Pago de cliente", expenses: "Gasto", sale_adjustments: "Cambio/devolución", sale_adjustment_payments: "Cobro/reintegro" };
const actionLabels = { insert: "Creación", update: "Modificación", delete: "Eliminación" };
const ignored = new Set(["updated_at", "created_at", "confirmed_at"]);
const fieldLabels = { status: "estado", sale_date: "fecha de venta", purchase_date: "fecha de compra", amount: "importe", stock_current: "stock", sale_price: "precio", total_cost: "total", is_active: "visibilidad", affects_stock: "modo de stock", payment_date: "fecha de pago" };

function activityTitle(row) {
  const data = row.new_data || row.old_data || {};
  if (row.entity === "orders") return `Pedido #${data.order_number || "—"} · ${data.customer_name || ""}`;
  if (row.entity === "products" || row.entity === "suppliers") return data.name || entityLabels[row.entity];
  if (row.entity === "product_variants") return `${row.product_name || "Producto"} · ${[data.color_name, data.size].filter(Boolean).join(" / ") || "Variante única"}`;
  if (row.entity === "product_images") return `${row.product_name || "Producto"} · Imagen`;
  if (row.entity === "expenses") return data.description || "Gasto";
  return `${entityLabels[row.entity] || row.entity} · ${row.entity_id?.slice(0, 8) || "—"}`;
}

function changes(row) {
  if (row.action !== "update") return [];
  return Object.keys(row.new_data || {}).filter((key) => !ignored.has(key) && JSON.stringify(row.old_data?.[key]) !== JSON.stringify(row.new_data?.[key])).map((key) => fieldLabels[key] || key.replaceAll("_", " "));
}

export default function Activity() {
  const [rows, setRows] = useState([]), [filter, setFilter] = useState("all"), [query, setQuery] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { setRows(await getActivity()); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => rows.filter((row) => (filter === "all" || row.action === filter) && (!query.trim() || `${activityTitle(row)} ${row.actor_email || "sistema"} ${entityLabels[row.entity] || row.entity}`.toLowerCase().includes(query.toLowerCase()))), [rows, filter, query]);
  return <section><div className="page-header"><div><p className="eyebrow">Administración</p><h1>Actividad</h1><p className="page-description">Registro de operaciones sensibles realizadas en el sistema.</p></div><button className="button-secondary" onClick={load}>Actualizar</button></div>{error && <p className="form-error">{error}</p>}<div className="toolbar activity-toolbar"><input placeholder="Buscar operación o usuario" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todas las acciones</option><option value="insert">Creaciones</option><option value="update">Modificaciones</option><option value="delete">Eliminaciones</option></select><span>{filtered.length} movimientos</span></div>{loading ? <div className="empty-state">Cargando actividad…</div> : !filtered.length ? <div className="empty-state">No hay actividad para este filtro.</div> : <div className="activity-list">{filtered.map((row) => { const changed = changes(row); return <article className="activity-item" key={row.id}><span className={`activity-action activity-${row.action}`}>{actionLabels[row.action]}</span><div><h2>{activityTitle(row)}</h2><p>{entityLabels[row.entity] || row.entity}{changed.length ? ` · Cambió: ${changed.join(", ")}` : ""}</p><small>{row.actor_email || "Tienda online / sistema"}</small></div><time>{new Date(row.occurred_at).toLocaleString("es-AR")}</time></article>; })}</div>}</section>;
}

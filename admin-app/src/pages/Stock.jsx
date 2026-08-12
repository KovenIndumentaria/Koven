import { useEffect, useMemo, useState } from "react";
import StockAdjustmentForm from "../components/StockAdjustmentForm";
import { getInventory, getStockMovements } from "../services/stockService";

const movementLabels = { adjustment: "Ajuste", purchase: "Compra", sale: "Venta", reversal: "Reversión" };

function variantLabel(variant) {
  return [variant.color_name, variant.size].filter(Boolean).join(" · ") || "Variante única";
}

export default function Stock() {
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [adjusting, setAdjusting] = useState(null);

  async function loadData() {
    setLoading(true); setError("");
    try {
      const [nextInventory, nextMovements] = await Promise.all([getInventory(), getStockMovements()]);
      setInventory(nextInventory);
      setMovements(nextMovements);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const activeInventory = inventory.filter((variant) => variant.is_active && variant.product?.is_active);
  const summary = {
    variants: activeInventory.length,
    units: activeInventory.reduce((sum, variant) => sum + variant.stock_current, 0),
    zero: activeInventory.filter((variant) => variant.stock_current === 0).length,
    low: activeInventory.filter((variant) => variant.stock_current > 0 && variant.stock_current <= 3).length,
  };

  const filtered = useMemo(() => activeInventory.filter((variant) => {
    const text = `${variant.product?.name || ""} ${variant.color_name} ${variant.size} ${variant.sku || ""}`.toLowerCase();
    const matchesQuery = text.includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "zero" ? variant.stock_current === 0 : filter === "low" ? variant.stock_current > 0 && variant.stock_current <= 3 : variant.stock_current > 3);
    return matchesQuery && matchesFilter;
  }), [activeInventory, query, filter]);

  return (
    <section>
      <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Stock</h1><p className="page-description">Existencias por variante y trazabilidad de cada cambio.</p></div><button type="button" className="button-secondary" onClick={loadData}>Actualizar</button></div>
      {notice && <div className="success-notice">{notice}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="summary-grid"><article><span>Variantes activas</span><strong>{summary.variants}</strong></article><article><span>Unidades totales</span><strong>{summary.units}</strong></article><article><span>Stock bajo</span><strong>{summary.low}</strong></article><article><span>Sin stock</span><strong>{summary.zero}</strong></article></div>
      <div className="toolbar"><input type="search" placeholder="Buscar producto, color, talle o SKU" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todas</option><option value="zero">Sin stock</option><option value="low">Stock bajo (1–3)</option><option value="healthy">Más de 3</option></select><span>{filtered.length} variantes</span></div>
      {loading ? <div className="empty-state">Cargando inventario…</div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Producto</th><th>Variante</th><th>Categoría</th><th>Stock</th><th>Último costo</th><th>Costo promedio</th><th>Actualización</th><th></th></tr></thead><tbody>{filtered.map((variant) => <tr key={variant.id}><td><strong>{variant.product?.name}</strong><small>{variant.sku || "Sin SKU"}</small></td><td>{variantLabel(variant)}</td><td>{variant.product?.category?.name || "—"}</td><td><span className={variant.stock_current === 0 ? "stock-zero" : variant.stock_current <= 3 ? "stock-low" : ""}>{variant.stock_current}</span></td><td>{variant.cost == null ? "—" : `$${Number(variant.cost).toLocaleString("es-AR")}`}</td><td>{variant.average_cost == null ? "—" : `$${Number(variant.average_cost).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`}</td><td>{new Date(variant.updated_at).toLocaleString("es-AR")}</td><td><button type="button" className="button-small" onClick={() => setAdjusting(variant)}>Ajustar</button></td></tr>)}</tbody></table></div>}
      <section className="movement-section"><div><p className="eyebrow">Auditoría</p><h2>Últimos movimientos</h2></div>{!movements.length ? <div className="empty-state">Todavía no hay movimientos.</div> : <div className="table-wrap"><table className="data-table movement-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Variante</th><th>Tipo</th><th>Cambio</th><th>Motivo</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Date(movement.created_at).toLocaleString("es-AR")}</td><td>{movement.variant?.product?.name || "Producto no disponible"}</td><td>{movement.variant ? variantLabel(movement.variant) : "—"}</td><td>{movementLabels[movement.movement_type] || movement.movement_type}</td><td><strong className={movement.quantity_delta > 0 ? "movement-positive" : "movement-negative"}>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}</strong></td><td>{movement.reason}</td></tr>)}</tbody></table></div>}</section>
      {adjusting && <StockAdjustmentForm variant={adjusting} onCancel={() => setAdjusting(null)} onSaved={async (newStock) => { setAdjusting(null); setNotice(`Stock actualizado correctamente. Nuevo saldo: ${newStock}.`); await loadData(); }} />}
    </section>
  );
}

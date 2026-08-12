import { useEffect, useMemo, useState } from "react";

export default function ProductCombobox({ products, value, onChange, excludedIds = [] }) {
  const selected = products.find((product) => product.id === value);
  const selectedLabel = selected?.name || "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selected?.id, selected?.is_active, open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      const searchable = `${product.name} ${product.is_active ? "activo" : "archivado"}`.toLowerCase();
      return !excludedIds.includes(product.id) && (!term || searchable.includes(term));
    }).slice(0, 10);
  }, [products, query, excludedIds]);

  function select(product) {
    setQuery(product.name);
    setOpen(false);
    onChange(product);
  }

  return <label className="field product-combobox-field">Producto
    <div className="variant-combobox">
      <input type="search" value={query} placeholder="Escribir nombre del producto" autoComplete="off" required
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); if (value) onChange(null); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && open && results.length === 1) { event.preventDefault(); select(results[0]); }
        }} />
      {open && <div className="variant-suggestions" role="listbox">
        {!results.length ? <p>Sin coincidencias</p> : results.map((product) => <button type="button" key={product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => select(product)}>
          <span><strong>{product.name}</strong><small>{product.variants.length} variante(s){!product.is_active && " · Producto archivado"}</small></span>
          <span className="suggestion-cost">{product.default_cost == null ? "Sin costo" : `$${Number(product.default_cost).toLocaleString("es-AR")}`}</span>
        </button>)}
      </div>}
      {selected && !selected.is_active && <small className="archived-selection">Producto archivado: la compra no lo publicará automáticamente.</small>}
    </div>
  </label>;
}

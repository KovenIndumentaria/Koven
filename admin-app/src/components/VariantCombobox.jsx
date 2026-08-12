import { useEffect, useMemo, useState } from "react";

function variantLabel(variant) {
  const detail = [variant.color_name, variant.size].filter(Boolean).join(" / ") || "Única";
  return `${variant.product.name} — ${detail}`;
}

export default function VariantCombobox({ variants, value, onChange, mode = "purchase", label = "Producto y variante" }) {
  const selected = variants.find((variant) => variant.id === value);
  const [query, setQuery] = useState(selected ? variantLabel(selected) : "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) setQuery(selected ? variantLabel(selected) : "");
  }, [value, selected?.id, open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || selected && query === variantLabel(selected)) return variants.slice(0, 10);
    return variants.filter((variant) => `${variant.product.name} ${variant.color_name || ""} ${variant.size || ""} ${variant.sku || ""}`.toLowerCase().includes(term)).slice(0, 10);
  }, [variants, query, selected]);

  function select(variant) {
    setQuery(variantLabel(variant));
    setOpen(false);
    onChange(variant);
  }

  return <label className="field variant-combobox-field">{label}
    <div className="variant-combobox">
      <input
        type="search"
        value={query}
        placeholder="Escribir producto, color, talle o SKU"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); if (value) onChange(null); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && open && results.length === 1) { event.preventDefault(); select(results[0]); }
        }}
        required
      />
      {open && <div className="variant-suggestions" role="listbox">
        {!results.length ? <p>Sin coincidencias</p> : results.map((variant) => <button type="button" role="option" aria-selected={variant.id === value} key={variant.id} onMouseDown={(event) => event.preventDefault()} onClick={() => select(variant)}>
          <span><strong>{variant.product.name}</strong><small>{[variant.color_name, variant.size].filter(Boolean).join(" · ") || "Variante única"}{variant.sku ? ` · ${variant.sku}` : ""}</small></span>
          <span className="suggestion-cost">{mode === "sale" ? `Stock: ${variant.stock_current}` : variant.cost == null ? "Sin costo" : `$${Number(variant.cost).toLocaleString("es-AR")}`}</span>
        </button>)}
      </div>}
    </div>
  </label>;
}

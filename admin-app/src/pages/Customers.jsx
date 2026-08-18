import { useEffect, useMemo, useState } from "react";
import ExportActions from "../components/ExportActions";
import Pagination from "../components/Pagination";
import SortableHeader from "../components/SortableHeader";
import { getCustomers, updateCustomer } from "../services/customersService";
import { compareValues, nextSort, paginate } from "../utils/tableView";
import { downloadCsv } from "../utils/exportData";

const saleStatuses = new Set(["confirmed", "preparing", "ready", "delivered"]);
const money = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;

function customerMetrics(customer) {
  const sales = customer.orders.filter((order) => saleStatuses.has(order.status));
  return {
    orders: sales.length,
    spent: sales.reduce((sum, order) => sum + Number(order.subtotal), 0),
    lastOrder: [...sales].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0],
  };
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [purchaseFilter, setPurchaseFilter] = useState("all");
  const [sort, setSort] = useState({ column: "name", direction: "asc" });
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25);

  async function load() {
    setLoading(true);
    try { setCustomers(await getCustomers()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => { setPage(1); }, [query, purchaseFilter, sort, pageSize]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const metrics = customerMetrics(customer);
      return (!term || [customer.name, customer.phone, customer.email].some((value) => value?.toLowerCase().includes(term))) && (purchaseFilter === "all" || (purchaseFilter === "with" ? metrics.orders > 0 : metrics.orders === 0));
    }).sort((a,b) => { const am=customerMetrics(a),bm=customerMetrics(b); const values={name:[a.name,b.name],contact:[a.phone,b.phone],orders:[am.orders,bm.orders],spent:[am.spent,bm.spent],last:[am.lastOrder?.created_at,bm.lastOrder?.created_at]}[sort.column]; return compareValues(values?.[0],values?.[1],sort.direction); });
  }, [customers, query, purchaseFilter, sort]);
  const visible=paginate(filtered,page,pageSize),changeSort=(column)=>setSort((current)=>nextSort(current,column,column==="last"?"desc":"asc"));
  const exportCsv=()=>downloadCsv(`koven-clientes-${new Date().toISOString().slice(0,10)}`,["Cliente","Teléfono","Email","Dirección","Compras","Total comprado","Última compra","Notas"],filtered.map((customer)=>{const metrics=customerMetrics(customer);return[customer.name,customer.phone,customer.email||"",customer.address||"",metrics.orders,metrics.spent,metrics.lastOrder?.created_at?new Date(metrics.lastOrder.created_at).toLocaleString("es-AR"):"",customer.notes||""];}));

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      const saved = await updateCustomer(selected);
      setCustomers((current) => current.map((customer) => customer.id === saved.id ? { ...customer, ...saved } : customer));
      setSelected((current) => ({ ...current, ...saved }));
      setNotice("Cliente actualizado correctamente.");
    } catch (e) { setError(e.message); }
  }

  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Clientes</h1><p className="page-description">Contactos, historial de compras y valor acumulado por cliente.</p></div><div className="header-actions"><ExportActions onCsv={exportCsv} disabled={!filtered.length}/><button className="button-secondary" onClick={load}>Actualizar</button></div></div>
    {notice && <div className="success-notice">{notice}</div>}{error && <p className="form-error">{error}</p>}
    <div className="toolbar customer-toolbar"><input placeholder="Buscar por nombre, teléfono o email" value={query} onChange={(e) => setQuery(e.target.value)} /><select value={purchaseFilter} onChange={(e)=>setPurchaseFilter(e.target.value)}><option value="all">Todos los clientes</option><option value="with">Con compras</option><option value="without">Sin compras</option></select><span>{filtered.length} clientes</span></div>
    {loading ? <div className="empty-state">Cargando clientes…</div> : !filtered.length ? <div className="empty-state">Todavía no hay clientes para mostrar.</div> :
      <><div className="table-wrap"><table className="data-table customers-table"><thead><tr><SortableHeader column="name" label="Cliente" sort={sort} onSort={changeSort}/><SortableHeader column="contact" label="Contacto" sort={sort} onSort={changeSort}/><SortableHeader column="orders" label="Compras" sort={sort} onSort={changeSort}/><SortableHeader column="spent" label="Total comprado" sort={sort} onSort={changeSort}/><SortableHeader column="last" label="Última compra" sort={sort} onSort={changeSort}/><th></th></tr></thead><tbody>{visible.map((customer) => { const metrics = customerMetrics(customer); return <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.phone}<small>{customer.email || "Sin email"}</small></td><td>{metrics.orders}</td><td><strong>{money(metrics.spent)}</strong></td><td>{metrics.lastOrder ? new Date(metrics.lastOrder.created_at).toLocaleDateString("es-AR") : "—"}</td><td className="row-actions"><button onClick={() => { setNotice(""); setSelected(structuredClone(customer)); }}>Ver ficha</button></td></tr>; })}</tbody></table></div><Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize}/></>}
    {selected && <div className="panel-overlay"><div className="panel customer-panel"><div className="panel-header"><div><p className="eyebrow">Ficha de cliente</p><h2>{selected.name}</h2></div><button className="button-ghost" onClick={() => setSelected(null)}>Cerrar</button></div>
      <form onSubmit={save}><div className="form-grid"><label className="field">Nombre<input required minLength="2" value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} /></label><label className="field">Teléfono<input required minLength="6" value={selected.phone} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} /></label><label className="field">Email<input type="email" value={selected.email} onChange={(e) => setSelected({ ...selected, email: e.target.value })} /></label><label className="field">Dirección<input value={selected.address} onChange={(e) => setSelected({ ...selected, address: e.target.value })} /></label><label className="field field-wide">Notas<textarea rows="3" value={selected.notes} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></label></div><div className="form-actions"><button className="button-primary">Guardar cliente</button></div></form>
      <section className="customer-history"><h3>Historial de pedidos</h3>{!selected.orders.length ? <p>Sin pedidos registrados.</p> : [...selected.orders].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).map((order) => <article key={order.id}><div><strong>Pedido #{order.order_number}</strong><span>{new Date(order.created_at).toLocaleString("es-AR")}</span></div><div><span className="tag">{order.status}</span><strong>{money(order.subtotal)}</strong></div></article>)}</section>
    </div></div>}
  </section>;
}

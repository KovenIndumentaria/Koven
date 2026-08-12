import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import SortableHeader from "../components/SortableHeader";
import { getSuppliers, saveSupplier, setSupplierActive } from "../services/purchasesService";
import { compareValues, nextSort, paginate } from "../utils/tableView";

const emptySupplier = { id: "", name: "", phone: "", email: "", notes: "", is_active: true };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]), [editing, setEditing] = useState(undefined), [form, setForm] = useState(emptySupplier);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [sort, setSort] = useState({ column: "name", direction: "asc" });
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25);
  async function loadData() { setLoading(true); try { setSuppliers(await getSuppliers()); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { loadData(); }, []); useEffect(() => { setPage(1); }, [query, status, sort, pageSize]);
  const filtered = useMemo(() => suppliers.filter((supplier) => {
    const term = query.trim().toLowerCase(); return (!term || `${supplier.name} ${supplier.phone} ${supplier.email}`.toLowerCase().includes(term)) && (status === "all" || (status === "active") === supplier.is_active);
  }).sort((a,b) => { const values={name:[a.name,b.name],phone:[a.phone,b.phone],email:[a.email,b.email],notes:[a.notes,b.notes],status:[a.is_active?1:0,b.is_active?1:0]}[sort.column]; return compareValues(values?.[0],values?.[1],sort.direction); }), [suppliers,query,status,sort]);
  const visible=paginate(filtered,page,pageSize), changeSort=(column)=>setSort((current)=>nextSort(current,column));
  function openForm(supplier=null){setEditing(supplier);setForm(supplier?{...supplier}:emptySupplier);setError("");}
  async function submit(event){event.preventDefault();try{await saveSupplier(form);setEditing(undefined);setNotice("Proveedor guardado correctamente.");await loadData();}catch(e){setError(e.message);}}
  async function toggle(supplier){try{await setSupplierActive(supplier.id,!supplier.is_active);await loadData();}catch(e){setError(e.message);}}
  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Proveedores</h1><p className="page-description">Datos básicos para registrar ingresos de mercadería.</p></div><button className="button-primary" type="button" onClick={()=>openForm()}>Nuevo proveedor</button></div>
    {notice&&<div className="success-notice">{notice}</div>}{error&&<p className="form-error">{error}</p>}
    <div className="toolbar"><input type="search" placeholder="Buscar nombre, teléfono o email" value={query} onChange={(e)=>setQuery(e.target.value)}/><select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Archivados</option></select><span>{filtered.length} proveedores</span></div>
    {loading?<div className="empty-state">Cargando proveedores…</div>:!filtered.length?<div className="empty-state">No hay proveedores para estos filtros.</div>:<><div className="table-wrap"><table className="data-table"><thead><tr><SortableHeader column="name" label="Nombre" sort={sort} onSort={changeSort}/><SortableHeader column="phone" label="Teléfono" sort={sort} onSort={changeSort}/><SortableHeader column="email" label="Email" sort={sort} onSort={changeSort}/><SortableHeader column="notes" label="Notas" sort={sort} onSort={changeSort}/><SortableHeader column="status" label="Estado" sort={sort} onSort={changeSort}/><th></th></tr></thead><tbody>{visible.map((supplier)=><tr key={supplier.id}><td><strong>{supplier.name}</strong></td><td>{supplier.phone||"—"}</td><td>{supplier.email||"—"}</td><td>{supplier.notes||"—"}</td><td><span className={supplier.is_active?"tag tag-ok":"tag"}>{supplier.is_active?"Activo":"Archivado"}</span></td><td><div className="row-actions"><button onClick={()=>openForm(supplier)}>Editar</button><button onClick={()=>toggle(supplier)}>{supplier.is_active?"Archivar":"Activar"}</button></div></td></tr>)}</tbody></table></div><Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize}/></>}
    {editing!==undefined&&<div className="panel-overlay"><form className="adjustment-panel panel" onSubmit={submit}><div className="panel-header"><div><p className="eyebrow">Proveedores</p><h2>{editing?"Editar proveedor":"Nuevo proveedor"}</h2></div><button type="button" className="button-ghost" onClick={()=>setEditing(undefined)}>Cerrar</button></div><div className="form-grid"><label className="field field-wide">Nombre<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></label><label className="field">Teléfono<input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></label><label className="field">Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label><label className="field field-wide">Notas<textarea rows="3" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label></div><label className="check-single"><input type="checkbox" checked={form.is_active} onChange={(e)=>setForm({...form,is_active:e.target.checked})}/> Proveedor activo</label><div className="form-actions"><button type="button" className="button-ghost" onClick={()=>setEditing(undefined)}>Cancelar</button><button className="button-primary">Guardar</button></div></form></div>}
  </section>;
}

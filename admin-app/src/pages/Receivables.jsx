import { useEffect, useMemo, useState } from "react";
import MetricCard from "../components/MetricCard";
import OrderPaymentForm from "../components/OrderPaymentForm";
import Pagination from "../components/Pagination";
import SortableHeader from "../components/SortableHeader";
import { getOrders } from "../services/ordersService";
import { getOrderAccount } from "../utils/orderAccount";
import { compareValues, nextSort, paginate } from "../utils/tableView";

const money=(value)=>`$${Number(value||0).toLocaleString("es-AR")}`, dayMs=86400000;
function paymentSummary(order){const account=getOrderAccount(order);return{...account,age:Math.max(0,Math.floor((Date.now()-new Date(`${order.sale_date}T12:00:00`).getTime())/dayMs))};}

export default function Receivables(){
  const[orders,setOrders]=useState([]),[query,setQuery]=useState(""),[filter,setFilter]=useState("pending"),[paying,setPaying]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const[sort,setSort]=useState({column:"date",direction:"desc"}),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
  async function load(){setLoading(true);setError("");try{setOrders((await getOrders()).filter((order)=>order.status!=="cancelled"));}catch(err){setError(err.message);}finally{setLoading(false);}}
  useEffect(()=>{load();},[]);useEffect(()=>{setPage(1);},[query,filter,sort,pageSize]);
  const rows=useMemo(()=>orders.map((order)=>({order,...paymentSummary(order)})),[orders]);
  const filtered=useMemo(()=>{const term=query.trim().toLowerCase();return rows.filter((row)=>{const search=!term||row.order.customer_name.toLowerCase().includes(term)||row.order.customer_phone.includes(term)||String(row.order.order_number).includes(term);const status=filter==="all"||(filter==="pending"&&row.balance>0)||(filter==="partial"&&row.paid>0&&row.balance>0)||(filter==="paid"&&row.balance===0);return search&&status;}).sort((a,b)=>{const values={order:[a.order.order_number,b.order.order_number],customer:[a.order.customer_name,b.order.customer_name],date:[a.order.sale_date,b.order.sale_date],total:[a.accountTotal,b.accountTotal],paid:[a.paid,b.paid],balance:[a.balance,b.balance],age:[a.age,b.age]}[sort.column];return compareValues(values?.[0],values?.[1],sort.direction);});},[rows,query,filter,sort]);
  const visible=paginate(filtered,page,pageSize),changeSort=(column)=>setSort((current)=>nextSort(current,column,column==="date"?"desc":"asc"));
  const totalBilled=rows.reduce((sum,row)=>sum+row.accountTotal,0),totalPaid=rows.reduce((sum,row)=>sum+row.paid,0),totalBalance=rows.reduce((sum,row)=>sum+row.balance,0),overdue=rows.filter((row)=>row.balance>0&&row.age>=30).reduce((sum,row)=>sum+row.balance,0);
  return <section>
    <div className="page-header"><div><p className="eyebrow">Panel administrativo</p><h1>Saldos y cobros</h1><p className="page-description">Seguimiento centralizado de pagos parciales, cambios y dinero pendiente.</p></div><button className="button-secondary" onClick={load}>Actualizar</button></div>
    {notice&&<div className="success-notice">{notice}</div>}{error&&<p className="form-error">{error}</p>}
    <div className="metrics-grid"><MetricCard label="Ventas actualizadas" value={money(totalBilled)}/><MetricCard label="Total cobrado" value={money(totalPaid)}/><MetricCard label="Saldo pendiente" value={money(totalBalance)}/><MetricCard label="Pendiente +30 días" value={money(overdue)}/></div>
    <div className="toolbar receivables-toolbar"><input placeholder="Buscar cliente, teléfono o pedido" value={query} onChange={(event)=>setQuery(event.target.value)}/><select value={filter} onChange={(event)=>setFilter(event.target.value)}><option value="pending">Con saldo pendiente</option><option value="partial">Pagos parciales</option><option value="paid">Pagados</option><option value="all">Todos</option></select><span>{filtered.length} pedidos</span></div>
    {loading?<div className="empty-state">Cargando saldos…</div>:!filtered.length?<div className="empty-state">No hay pedidos para este filtro.</div>:<><div className="table-wrap"><table className="data-table receivables-table"><thead><tr><SortableHeader column="order" label="Pedido" sort={sort} onSort={changeSort}/><SortableHeader column="customer" label="Cliente" sort={sort} onSort={changeSort}/><SortableHeader column="date" label="Fecha" sort={sort} onSort={changeSort}/><SortableHeader column="total" label="Total actualizado" sort={sort} onSort={changeSort}/><SortableHeader column="paid" label="Cobrado" sort={sort} onSort={changeSort}/><SortableHeader column="balance" label="Saldo" sort={sort} onSort={changeSort}/><SortableHeader column="age" label="Antigüedad" sort={sort} onSort={changeSort}/><th></th></tr></thead><tbody>{visible.map((row)=><tr key={row.order.id}><td><strong>#{row.order.order_number}</strong></td><td><strong>{row.order.customer_name}</strong><small>{row.order.customer_phone}</small></td><td>{new Date(`${row.order.sale_date}T12:00:00`).toLocaleDateString("es-AR")}</td><td>{money(row.accountTotal)}</td><td className="movement-positive">{money(row.paid)}</td><td className={row.balance>0?"receivable-balance":"movement-positive"}><strong>{money(row.balance)}</strong></td><td><span className={row.age>=30&&row.balance>0?"tag tag-payment":"tag"}>{row.age} días</span></td><td className="row-actions">{row.balance>0&&<button onClick={()=>setPaying({order:row.order,balance:row.balance})}>Agregar pago</button>}</td></tr>)}</tbody></table></div><Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize}/></>}
    {paying&&<OrderPaymentForm order={paying.order} balance={paying.balance} onClose={()=>setPaying(null)} onSaved={async()=>{setPaying(null);setNotice("Pago registrado correctamente.");await load();}}/>}
  </section>;
}

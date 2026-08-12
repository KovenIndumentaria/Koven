const statusLabels = { draft: "Borrador", confirmed: "Confirmada", cancelled: "Cancelada" };
const methodLabels = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };
const money = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;

export default function PurchaseDetail({ purchase, onClose, onCorrectDate }) {
  const merchandiseTotal = purchase.items.reduce((sum, item) => sum + item.quantity * Number(item.unit_cost), 0);
  const paid = (purchase.payments || []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = Math.max(0, Number(purchase.total_cost) - paid);

  return <div className="panel-overlay"><section className="panel purchase-detail-panel">
    <div className="panel-header"><div><p className="eyebrow">Detalle de compra</p><h2>{purchase.supplier?.name || "Proveedor"}</h2><p>{new Date(`${purchase.purchase_date}T12:00:00`).toLocaleDateString("es-AR")}</p></div><div className="header-actions">{purchase.status === "confirmed" && !purchase.affects_stock && <button type="button" className="button-secondary" onClick={onCorrectDate}>Corregir fecha</button>}<button type="button" className="button-ghost" onClick={onClose}>Cerrar</button></div></div>
    <div className="purchase-detail-tags"><span className={purchase.status === "confirmed" ? "tag tag-ok" : "tag"}>{statusLabels[purchase.status]}</span><span className="tag">{purchase.affects_stock ? "Con ingreso de stock" : "Histórica · sin stock"}</span><span className={balance === 0 ? "tag tag-ok" : "tag tag-payment"}>{balance === 0 ? "Pagada" : paid > 0 ? "Pago parcial" : "Pendiente de pago"}</span></div>
    <div className="table-wrap purchase-detail-table"><table className="data-table"><thead><tr><th>Producto</th><th>Variante</th><th>Cantidad</th><th>Costo unitario</th><th>Subtotal</th></tr></thead><tbody>{purchase.items.map((item) => <tr key={item.id}><td><strong>{item.variant?.product?.name || "Producto"}</strong></td><td>{[item.variant?.color_name, item.variant?.size].filter(Boolean).join(" · ") || "Única"}</td><td>{item.quantity}</td><td>{money(item.unit_cost)}</td><td><strong>{money(item.quantity * Number(item.unit_cost))}</strong></td></tr>)}</tbody></table></div>
    <div className="purchase-detail-totals"><div><span>Mercadería</span><strong>{money(merchandiseTotal)}</strong></div><div><span>{purchase.extra_cost_description || "Costo adicional"}</span><strong>{money(purchase.extra_cost)}</strong></div><div className="purchase-detail-grand-total"><span>Total compra</span><strong>{money(purchase.total_cost)}</strong></div></div>
    {purchase.notes && <div className="purchase-detail-notes"><strong>Notas</strong><p>{purchase.notes}</p></div>}
    <section className="purchase-detail-payments"><h3>Pagos</h3>{!purchase.payments?.length ? <p>Sin pagos registrados.</p> : purchase.payments.map((payment) => <div key={payment.id}><span>{new Date(`${payment.payment_date}T12:00:00`).toLocaleDateString("es-AR")} · {methodLabels[payment.method]}{payment.notes ? ` · ${payment.notes}` : ""}</span><strong>{money(payment.amount)}</strong></div>)}<div className="purchase-payment-balance"><span>Pagado: <strong>{money(paid)}</strong></span><span>Saldo: <strong>{money(balance)}</strong></span></div></section>
  </section></div>;
}

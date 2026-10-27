import { getAuditData } from "./auditService";
import { getOrderAccount } from "../utils/orderAccount";

const dayMs = 86400000;
const ageInDays = (date) => Math.max(0, Math.floor((Date.now() - new Date(`${date}T12:00:00`).getTime()) / dayMs));

export async function getOperationalAlerts() {
  const data = await getAuditData();
  const alerts = [];

  data.orders.filter((order) => order.status !== "cancelled").forEach((order) => {
    const account = getOrderAccount(order);
    if (order.status === "pending_confirmation") alerts.push({ id: `order-${order.id}`, type: "orders", severity: "warning", title: "Pedido por confirmar", detail: `Pedido #${order.order_number} · ${order.customer_name}`, value: "Revisar", href: "#/pedidos" });
    if (account.balance > 0.01) alerts.push({ id: `receivable-${order.id}`, type: "receivables", severity: ageInDays(order.sale_date) >= 30 ? "critical" : "pending", title: "Cobro pendiente", detail: `Pedido #${order.order_number} · ${order.customer_name} · ${ageInDays(order.sale_date)} días`, value: `$${account.balance.toLocaleString("es-AR")}`, href: "#/saldos" });
    if (account.refundDue > 0.01) alerts.push({ id: `refund-${order.id}`, type: "refunds", severity: "critical", title: "Reintegro pendiente", detail: `Pedido #${order.order_number} · ${order.customer_name}`, value: `$${account.refundDue.toLocaleString("es-AR")}`, href: "#/pedidos" });
  });

  data.purchases.filter((purchase) => purchase.status === "confirmed").forEach((purchase) => {
    const paid = purchase.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = Math.max(0, Number(purchase.total_cost) - paid);
    if (balance > 0.01) alerts.push({ id: `payable-${purchase.id}`, type: "payables", severity: ageInDays(purchase.purchase_date) >= 30 ? "critical" : "pending", title: "Pago a proveedor pendiente", detail: `${purchase.supplier?.name || "Proveedor"} · ${ageInDays(purchase.purchase_date)} días`, value: `$${balance.toLocaleString("es-AR")}`, href: "#/cuentas-pagar" });
  });

  const severityOrder = { critical: 0, warning: 1, pending: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title, "es"));
}

export async function getAlertCount() {
  return (await getOperationalAlerts()).length;
}

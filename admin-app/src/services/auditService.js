import { supabase } from "./supabaseClient";
import { getOrders } from "./ordersService";
import { getOrderAccount } from "../utils/orderAccount";

const issue = (severity, area, title, detail, reference = "") => ({ severity, area, title, detail, reference });
const close = (a, b) => Math.abs(Number(a) - Number(b)) < 0.01;

export async function getAuditData() {
  const [orders, variantsResult, movementsResult, purchasesResult, productsResult] = await Promise.all([
    getOrders(),
    supabase.from("product_variants").select("id,size,color_name,stock_current,cost,average_cost,is_active,product:products(id,name,is_active,default_cost)"),
    supabase.from("stock_movements").select("id,variant_id,quantity_delta"),
    supabase.from("supplier_purchases").select("id,status,purchase_date,total_cost,extra_cost,supplier:suppliers(name),items:supplier_purchase_items(quantity,unit_cost),payments:supplier_purchase_payments(amount)"),
    supabase.from("products").select("id,name,is_active,variants:product_variants(id,is_active),images:product_images(id)"),
  ]);
  const error = variantsResult.error || movementsResult.error || purchasesResult.error || productsResult.error;
  if (error) throw error;
  return { orders, variants: variantsResult.data, movements: movementsResult.data, purchases: purchasesResult.data, products: productsResult.data };
}

export function auditData(data) {
  const issues = [];
  const movementTotals = new Map();
  data.movements.forEach((movement) => movementTotals.set(movement.variant_id, (movementTotals.get(movement.variant_id) || 0) + movement.quantity_delta));
  data.variants.forEach((variant) => {
    const ledger = movementTotals.get(variant.id) || 0;
    if (ledger !== variant.stock_current) issues.push(issue("error", "Stock", "Stock distinto al historial", `${variant.product?.name} · ${[variant.color_name, variant.size].filter(Boolean).join(" · ") || "Variante única"}: stock ${variant.stock_current}, movimientos ${ledger}.`, variant.id));
    const knownCost = variant.average_cost ?? variant.cost ?? variant.product?.default_cost;
    if (variant.stock_current > 0 && knownCost == null) issues.push(issue("warning", "Costos", "Stock sin costo conocido", `${variant.product?.name} tiene ${variant.stock_current} unidades sin costo de compra ni costo de referencia.`, variant.id));
  });
  data.products.forEach((product) => {
    if (product.is_active && !(product.variants || []).some((variant) => variant.is_active)) issues.push(issue("warning", "Productos", "Producto activo sin variantes", product.name, product.id));
    if (product.is_active && !(product.images || []).length) issues.push(issue("warning", "Productos", "Producto activo sin imágenes", product.name, product.id));
  });
  data.purchases.forEach((purchase) => {
    const expected = purchase.items.reduce((sum, item) => sum + item.quantity * Number(item.unit_cost), 0) + Number(purchase.extra_cost || 0);
    if (!close(expected, purchase.total_cost)) issues.push(issue("error", "Compras", "Total de compra inconsistente", `${purchase.supplier?.name || "Proveedor"} · ${purchase.purchase_date}: guardado $${Number(purchase.total_cost).toLocaleString("es-AR")}, calculado $${expected.toLocaleString("es-AR")}.`, purchase.id));
    const paid = purchase.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (paid > Number(purchase.total_cost) + 0.01) issues.push(issue("error", "Compras", "Compra pagada en exceso", `${purchase.supplier?.name || "Proveedor"}: pagado $${paid.toLocaleString("es-AR")} sobre $${Number(purchase.total_cost).toLocaleString("es-AR")}.`, purchase.id));
    if (purchase.status === "confirmed" && paid < Number(purchase.total_cost) - 0.01) issues.push(issue("pending", "Proveedores", "Saldo pendiente a proveedor", `${purchase.supplier?.name || "Proveedor"}: faltan $${(Number(purchase.total_cost) - paid).toLocaleString("es-AR")}.`, purchase.id));
  });
  data.orders.forEach((order) => {
    const account = getOrderAccount(order);
    const originalPaid = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (originalPaid > Number(order.subtotal) + 0.01) issues.push(issue("error", "Ventas", "Pagos originales exceden la venta", `Pedido #${order.order_number}: $${originalPaid.toLocaleString("es-AR")} sobre $${Number(order.subtotal).toLocaleString("es-AR")}.`, order.id));
    if (["confirmed", "preparing", "ready", "delivered"].includes(order.status) && order.items.some((item) => item.unit_cost_snapshot == null)) issues.push(issue("warning", "Costos", "Venta confirmada sin costo completo", `Pedido #${order.order_number} tiene prendas sin costo histórico.`, order.id));
    (order.adjustments || []).forEach((adjustment) => {
      const collections = adjustment.payments.filter((payment) => payment.direction === "collection").reduce((sum, payment) => sum + Number(payment.amount), 0);
      const refunds = adjustment.payments.filter((payment) => payment.direction === "refund").reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (collections > Math.max(0, Number(adjustment.difference)) + 0.01 || refunds > Math.max(0, -Number(adjustment.difference)) + 0.01) issues.push(issue("error", "Cambios", "Movimiento financiero superior al ajuste", `Pedido #${order.order_number} · ${adjustment.operation_date}.`, adjustment.id));
    });
    if (account.balance > 0.01 && order.status !== "cancelled") issues.push(issue("pending", "Clientes", "Saldo pendiente de cliente", `Pedido #${order.order_number} · ${order.customer_name}: $${account.balance.toLocaleString("es-AR")}.`, order.id));
    if (account.refundDue > 0.01) issues.push(issue("pending", "Reintegros", "Reintegro pendiente", `Pedido #${order.order_number} · ${order.customer_name}: $${account.refundDue.toLocaleString("es-AR")}.`, order.id));
  });
  return { issues, errors: issues.filter((item) => item.severity === "error"), warnings: issues.filter((item) => item.severity === "warning"), pending: issues.filter((item) => item.severity === "pending") };
}

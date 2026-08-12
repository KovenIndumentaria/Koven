export function getCurrentOrderItems(order) {
  const returns = (order.adjustments || []).flatMap((adjustment) => adjustment.return_items || []);
  const originals = (order.items || []).map((item) => ({ id: `order-${item.id}`, name: item.product_name_snapshot, variant: item.variant_snapshot, quantity: item.quantity - returns.filter((returned) => returned.order_item_id === item.id).reduce((sum, returned) => sum + returned.quantity, 0), unit_price: item.unit_price }));
  const replacements = (order.adjustments || []).flatMap((adjustment) => adjustment.replacement_items || []).map((item) => ({ id: `replacement-${item.id}`, name: item.variant?.product?.name || "Producto", variant: [item.variant?.color_name, item.variant?.size].filter(Boolean).join(" · "), quantity: item.quantity - returns.filter((returned) => returned.replacement_item_id === item.id).reduce((sum, returned) => sum + returned.quantity, 0), unit_price: item.unit_price }));
  return [...originals, ...replacements].filter((item) => item.quantity > 0);
}

export function getOrderAccount(order) {
  const currentItems = getCurrentOrderItems(order);
  const accountTotal = currentItems.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0) + Number(order.shipping_amount || 0);
  const originalPaid = (order.payments || []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const adjustmentPaid = (order.adjustments || []).flatMap((adjustment) => adjustment.payments || []).reduce((sum, payment) => sum + (payment.direction === "collection" ? 1 : -1) * Number(payment.amount), 0);
  const paid = originalPaid + adjustmentPaid;
  return { currentItems, paid, accountTotal, balance: Math.max(0, accountTotal - paid), refundDue: Math.max(0, paid - accountTotal) };
}

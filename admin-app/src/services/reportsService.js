import { supabase } from "./supabaseClient";

const saleStatuses = new Set(["confirmed", "preparing", "ready", "delivered"]);
const number = (value) => Number(value || 0);
const dateInRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);

export async function getReportData() {
  const [ordersResult, purchasesResult, inventoryResult, expensesResult, adjustmentsResult] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,subtotal,shipping_amount,sale_date,affects_stock,items:order_items(product_name_snapshot,quantity,unit_price,unit_cost_snapshot),payments:order_payments(amount,payment_date)"),
    supabase.from("supplier_purchases").select("id,status,purchase_date,total_cost,affects_stock"),
    supabase.from("product_variants").select("id,stock_current,is_active,size,color_name,product:products(name,is_active)"),
    supabase.from("expenses").select("id,expense_date,amount,category"),
    supabase.from("sale_adjustments").select("id,order_id,operation_date,difference,return_items:sale_adjustment_return_items(quantity,unit_price,unit_cost,order_item:order_items(product_name_snapshot)),replacement_items:sale_adjustment_replacement_items(quantity,unit_price,unit_cost,variant:product_variants(product:products(name))),payments:sale_adjustment_payments(direction,amount,payment_date)"),
  ]);
  const error = ordersResult.error || purchasesResult.error || inventoryResult.error || expensesResult.error || adjustmentsResult.error;
  if (error) throw error;
  return { orders: ordersResult.data, purchases: purchasesResult.data, inventory: inventoryResult.data, expenses: expensesResult.data, adjustments: adjustmentsResult.data };
}

function rangeFor(days) {
  if (typeof days === "object") return { from: days.from || null, to: days.to || null };
  if (days === "all") return { from: null, to: null };
  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - Number(days) + 1);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export function calculateMetrics(data, days = 30) {
  const { from, to } = rangeFor(days);
  const sales = data.orders.filter((order) => saleStatuses.has(order.status) && dateInRange(order.sale_date, from, to));
  const purchases = data.purchases.filter((purchase) => purchase.status === "confirmed" && dateInRange(purchase.purchase_date, from, to));
  const expenses = data.expenses.filter((expense) => dateInRange(expense.expense_date, from, to));
  const adjustments = data.adjustments.filter((adjustment) => dateInRange(adjustment.operation_date, from, to));
  const items = sales.flatMap((order) => order.items.map((item) => ({ ...item, historical: !order.affects_stock })));
  const returnedItems = adjustments.flatMap((adjustment) => adjustment.return_items);
  const replacementItems = adjustments.flatMap((adjustment) => adjustment.replacement_items);

  const shippingRevenue = sales.reduce((sum, order) => sum + number(order.shipping_amount), 0);
  const originalRevenue = items.reduce((sum, item) => sum + number(item.unit_price) * item.quantity, 0) + shippingRevenue;
  const adjustmentRevenue = adjustments.reduce((sum, adjustment) => sum + number(adjustment.difference), 0);
  const revenue = originalRevenue + adjustmentRevenue;
  const knownCost = items.reduce((sum, item) => sum + (item.unit_cost_snapshot == null ? 0 : number(item.unit_cost_snapshot) * item.quantity), 0)
    - returnedItems.reduce((sum, item) => sum + (item.unit_cost == null ? 0 : number(item.unit_cost) * item.quantity), 0)
    + replacementItems.reduce((sum, item) => sum + (item.unit_cost == null ? 0 : number(item.unit_cost) * item.quantity), 0);
  const unitsWithCost = items.reduce((sum, item) => sum + (item.unit_cost_snapshot == null ? 0 : item.quantity), 0)
    - returnedItems.reduce((sum, item) => sum + (item.unit_cost == null ? 0 : item.quantity), 0)
    + replacementItems.reduce((sum, item) => sum + (item.unit_cost == null ? 0 : item.quantity), 0);
  const unitsSold = items.reduce((sum, item) => sum + item.quantity, 0)
    - returnedItems.reduce((sum, item) => sum + item.quantity, 0)
    + replacementItems.reduce((sum, item) => sum + item.quantity, 0);

  const products = new Map();
  const addProduct = (name, quantity, sale, cost, hasCost) => {
    const row = products.get(name) || { name, quantity: 0, revenue: 0, cost: 0, costUnits: 0 };
    row.quantity += quantity; row.revenue += sale; row.cost += cost; row.costUnits += hasCost ? quantity : 0;
    products.set(name, row);
  };
  items.forEach((item) => addProduct(item.product_name_snapshot, item.quantity, number(item.unit_price) * item.quantity, item.unit_cost_snapshot == null ? 0 : number(item.unit_cost_snapshot) * item.quantity, item.unit_cost_snapshot != null));
  returnedItems.forEach((item) => addProduct(item.order_item?.product_name_snapshot || "Producto", -item.quantity, -number(item.unit_price) * item.quantity, item.unit_cost == null ? 0 : -number(item.unit_cost) * item.quantity, item.unit_cost != null));
  replacementItems.forEach((item) => addProduct(item.variant?.product?.name || "Producto", item.quantity, number(item.unit_price) * item.quantity, item.unit_cost == null ? 0 : number(item.unit_cost) * item.quantity, item.unit_cost != null));
  const productRows = [...products.values()].map((row) => ({ ...row, margin: row.revenue - row.cost }));

  const payableOrders = data.orders.filter((order) => order.status !== "cancelled");
  const adjustmentPayments = data.adjustments.flatMap((adjustment) => adjustment.payments);
  const collected = payableOrders.flatMap((order) => order.payments).filter((payment) => dateInRange(payment.payment_date, from, to)).reduce((sum, payment) => sum + number(payment.amount), 0)
    + adjustmentPayments.filter((payment) => dateInRange(payment.payment_date, from, to)).reduce((sum, payment) => sum + (payment.direction === "collection" ? 1 : -1) * number(payment.amount), 0);
  const outstanding = payableOrders.reduce((sum, order) => {
    const orderAdjustments = data.adjustments.filter((adjustment) => adjustment.order_id === order.id);
    const total = number(order.subtotal) + orderAdjustments.reduce((value, adjustment) => value + number(adjustment.difference), 0);
    const paid = order.payments.reduce((value, payment) => value + number(payment.amount), 0) + orderAdjustments.flatMap((adjustment) => adjustment.payments).reduce((value, payment) => value + (payment.direction === "collection" ? 1 : -1) * number(payment.amount), 0);
    return sum + Math.max(0, total - paid);
  }, 0);
  const expenseCost = expenses.reduce((sum, expense) => sum + number(expense.amount), 0);
  const activeInventory = data.inventory.filter((variant) => variant.is_active && variant.product?.is_active);
  const costCoverage = unitsSold > 0 ? Math.max(0, Math.min(1, unitsWithCost / unitsSold)) : 1;
  const historicalRevenue = items.filter((item) => item.historical).reduce((sum, item) => sum + number(item.unit_price) * item.quantity, 0) + sales.filter((order) => !order.affects_stock).reduce((sum, order) => sum + number(order.shipping_amount), 0);

  return {
    from, to, revenue, originalRevenue, adjustmentRevenue, shippingRevenue, historicalRevenue, currentRevenue: originalRevenue - historicalRevenue,
    orders: sales.length, unitsSold, averageTicket: sales.length ? revenue / sales.length : 0,
    knownCost, grossMargin: revenue - knownCost, grossMarginPercent: revenue ? ((revenue - knownCost) / revenue) * 100 : 0, costCoverage,
    purchaseCost: purchases.reduce((sum, purchase) => sum + number(purchase.total_cost), 0), purchases: purchases.length,
    collected, outstanding, expenseCost, expenses: expenses.length, operatingResult: revenue - knownCost - expenseCost,
    stockUnits: activeInventory.reduce((sum, variant) => sum + variant.stock_current, 0),
    lowStock: activeInventory.filter((variant) => variant.stock_current > 0 && variant.stock_current <= 3),
    outOfStock: activeInventory.filter((variant) => variant.stock_current === 0),
    topProducts: productRows.filter((row) => row.quantity > 0).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    topMargins: productRows.filter((row) => row.quantity > 0 && row.costUnits === row.quantity).sort((a, b) => b.margin - a.margin).slice(0, 10),
    productRows: productRows.filter((row) => row.quantity !== 0).sort((a, b) => b.revenue - a.revenue),
    pendingOrders: data.orders.filter((order) => order.status === "pending_confirmation").length,
  };
}

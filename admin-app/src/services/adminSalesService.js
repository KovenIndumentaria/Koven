import { supabase } from "./supabaseClient";

export async function getSaleFormData() {
  const [customersResult, variantsResult] = await Promise.all([
    supabase.from("customers").select("id,name,phone,address").order("name"),
    supabase.from("product_variants").select("id,size,color_name,stock_current,is_active,product:products(id,name,sale_price,is_active)").order("product_id"),
  ]);
  const error = customersResult.error || variantsResult.error;
  if (error) throw error;
  return { customers: customersResult.data, variants: variantsResult.data.filter((variant) => variant.product) };
}

export async function createAdminOrder(order, items) {
  const { data, error } = await supabase.rpc("create_admin_order", { p_order: order, p_items: items.map((item) => ({ variant_id: item.variant_id, quantity: Number(item.quantity), unit_price: Number(item.unit_price) })) });
  if (error) {
    if (error.message?.includes("insufficient_stock_for_variant")) throw new Error("La cantidad solicitada supera el stock disponible.");
    if (error.message?.includes("inactive_variant_for_current_sale")) throw new Error("Uno de los productos ya no está activo para una venta actual.");
    throw error;
  }
  return data;
}

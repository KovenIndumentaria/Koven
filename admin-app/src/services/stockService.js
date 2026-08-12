import { supabase } from "./supabaseClient";

export async function getInventory() {
  const { data, error } = await supabase
    .from("product_variants")
    .select("id,size,color_name,color_hex,sku,stock_current,cost,average_cost,is_active,updated_at,product:products(id,name,is_active,category:categories(name))")
    .order("stock_current", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getStockMovements(limit = 100) {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id,movement_type,quantity_delta,reason,created_at,variant:product_variants(id,size,color_name,product:products(name))")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function adjustStock(variantId, quantityDelta, reason) {
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_quantity_delta: quantityDelta,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

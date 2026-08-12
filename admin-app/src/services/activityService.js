import { supabase } from "./supabaseClient";

export async function getActivity(limit = 250) {
  const { data, error } = await supabase.from("activity_log").select("*").order("occurred_at", { ascending: false }).limit(limit);
  if (error) {
    if (error.code === "42P01") throw new Error("Falta ejecutar la migración 021 de registro de actividad en Supabase.");
    throw error;
  }
  const productIds = [...new Set(data.map((row) => (row.new_data || row.old_data || {}).product_id).filter(Boolean))];
  if (!productIds.length) return data;
  const { data: products, error: productsError } = await supabase.from("products").select("id,name").in("id", productIds);
  if (productsError) throw productsError;
  const names = new Map(products.map((product) => [product.id, product.name]));
  return data.map((row) => ({ ...row, product_name: names.get((row.new_data || row.old_data || {}).product_id) || null }));
}

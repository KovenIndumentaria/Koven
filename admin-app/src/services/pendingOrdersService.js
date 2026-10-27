import { supabase } from "./supabaseClient";

export async function getPendingOrders() {
  const { data, error } = await supabase.from("orders")
    .select("id,order_number,customer_name")
    .eq("status", "pending_confirmation");
  if (error) throw error;
  return data;
}

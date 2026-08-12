import { supabase } from "./supabaseClient";

export async function getCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*,orders(id,order_number,status,subtotal,sale_date,created_at,confirmed_at,delivery_type,delivery_address,items:order_items(quantity,product_name_snapshot,variant_snapshot,unit_price))")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateCustomer(customer) {
  const { data, error } = await supabase.from("customers").update({
    name: customer.name,
    phone: customer.phone,
    email: customer.email || "",
    address: customer.address || "",
    notes: customer.notes || "",
  }).eq("id", customer.id).select().single();
  if (error) throw error;
  return data;
}

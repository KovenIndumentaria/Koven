import { supabase } from "./supabaseClient";

export async function getSuppliers() {
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function saveSupplier(supplier) {
  const payload = { name: supplier.name.trim(), phone: supplier.phone.trim(), email: supplier.email.trim(), notes: supplier.notes.trim(), is_active: supplier.is_active };
  const query = supplier.id ? supabase.from("suppliers").update(payload).eq("id", supplier.id) : supabase.from("suppliers").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function setSupplierActive(id, isActive) {
  const { error } = await supabase.from("suppliers").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function getPurchases() {
  const { data, error } = await supabase.from("supplier_purchases")
    .select("*,supplier:suppliers(id,name),items:supplier_purchase_items(id,variant_id,quantity,unit_cost,variant:product_variants(id,size,color_name,product:products(id,name,default_cost))),payments:supplier_purchase_payments(id,amount,payment_date,method,notes,created_at)")
    .order("purchase_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPurchaseVariants() {
  const { data, error } = await supabase.from("product_variants")
    .select("id,size,color_name,sku,cost,is_active,product:products(id,name,default_cost,is_active)")
    .order("product_id");
  if (error) throw error;
  return data.filter((variant) => variant.product);
}

export async function savePurchase(purchase, items) {
  const { error: schemaError } = await supabase.from("supplier_purchases").select("extra_cost,extra_cost_description,consider_paid_on_confirm").limit(1);
  if (schemaError) throw new Error("Falta aplicar la migración más reciente de compras en Supabase.");
  const { data, error } = await supabase.rpc("save_purchase", { p_purchase: purchase, p_items: items });
  if (error) throw error;
  const { error: paymentModeError } = await supabase.from("supplier_purchases").update({ consider_paid_on_confirm: purchase.consider_paid_on_confirm }).eq("id",data).eq("status","draft");
  if(paymentModeError) throw paymentModeError;
  const { data: saved, error: verifyError } = await supabase.from("supplier_purchases").select("extra_cost,extra_cost_description,total_cost,consider_paid_on_confirm").eq("id", data).single();
  if (verifyError) throw verifyError;
  if (Math.abs(Number(saved.extra_cost) - (Number(purchase.extra_cost) || 0)) > 0.001) throw new Error("Supabase no guardó el costo adicional. Volvé a ejecutar la migración 010.");
  return data;
}

export async function confirmPurchase(id) {
  const { error } = await supabase.rpc("confirm_purchase", { p_purchase_id: id });
  if (error) throw error;
}

export async function cancelPurchase(id) {
  const { error } = await supabase.from("supplier_purchases").update({ status: "cancelled" }).eq("id", id).eq("status", "draft");
  if (error) throw error;
}

export async function correctHistoricalPurchaseDate(id, purchaseDate) {
  const { error } = await supabase.rpc("correct_historical_purchase_date", { p_purchase_id: id, p_purchase_date: purchaseDate });
  if (error) {
    if (error.message?.includes("Could not find the function")) throw new Error("Falta aplicar la migración 015 en Supabase.");
    throw error;
  }
}

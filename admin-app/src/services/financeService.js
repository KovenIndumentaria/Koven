import { supabase } from "./supabaseClient";

export async function getFinanceData() {
  const [incomeResult, supplierResult, expensesResult, adjustmentsResult] = await Promise.all([
    supabase.from("order_payments").select("id,amount,payment_date,method,notes,created_at,order:orders(order_number,customer_name,status)"),
    supabase.from("supplier_purchase_payments").select("id,amount,payment_date,method,notes,created_at,purchase:supplier_purchases(id,supplier:suppliers(name))"),
    supabase.from("expenses").select("id,amount,expense_date,category,description,created_at"),
    supabase.from("sale_adjustment_payments").select("id,direction,amount,payment_date,method,notes,created_at,adjustment:sale_adjustments(operation_type,order:orders(order_number,customer_name))"),
  ]);
  const error=incomeResult.error||supplierResult.error||expensesResult.error||adjustmentsResult.error;
  if(error) throw error;
  return { income: incomeResult.data.filter((payment)=>payment.order?.status!=="cancelled"), supplierPayments:supplierResult.data, expenses:expensesResult.data, adjustmentPayments:adjustmentsResult.data };
}

export async function addSupplierPayment(purchaseId,payment){const{error}=await supabase.rpc("add_supplier_payment",{p_purchase_id:purchaseId,p_amount:Number(payment.amount),p_payment_date:payment.payment_date,p_method:payment.method,p_notes:payment.notes||""});if(error)throw error;}
export async function deleteSupplierPayment(id){const{error}=await supabase.from("supplier_purchase_payments").delete().eq("id",id);if(error)throw error;}

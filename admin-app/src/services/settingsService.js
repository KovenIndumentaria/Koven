import { supabase } from "./supabaseClient";
import { optimizeProductImage, PRODUCT_IMAGES_BUCKET } from "./productImagesService";

const coverFields = ["remeras", "abrigos", "pantalones", "gorras", "medias", "accesorios"];

export async function getSettings() {
  const { data, error } = await supabase.from("store_settings").select("*").eq("id", true).single();
  if (error) {
    if (error.code === "42P01") throw new Error("Falta ejecutar la migración 023 de configuración.");
    throw error;
  }
  return data;
}

export async function saveSettings(settings) {
  const payload = {
    store_name: settings.store_name.trim(),
    whatsapp_number: settings.whatsapp_number.replace(/\D/g, ""),
    instagram_url: settings.instagram_url.trim(),
    pickup_enabled: settings.pickup_enabled,
    pickup_address: settings.pickup_address.trim(),
    shipping_enabled: settings.shipping_enabled,
    shipping_mode: settings.shipping_mode,
    shipping_cost: Number(settings.shipping_cost) || 0,
    free_shipping_from: settings.free_shipping_from === "" ? null : Number(settings.free_shipping_from),
    checkout_message: settings.checkout_message.trim(),
    sales_enabled: settings.sales_enabled,
    updated_at: new Date().toISOString(),
  };
  coverFields.forEach((slug) => { payload[`category_cover_${slug}`] = settings[`category_cover_${slug}`]; });
  const { error } = await supabase.from("store_settings").update(payload).eq("id", true);
  if (error) {
    if (error.code === "42703" || error.message?.includes("category_cover_")) throw new Error("Falta ejecutar la migración 024 de portadas de categorías.");
    throw error;
  }
}

export async function uploadCategoryCover(slug, file) {
  if (!coverFields.includes(slug)) throw new Error("Categoría inválida.");
  const optimized = await optimizeProductImage(file);
  const path = `categories/${slug}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, optimized.blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    if (error.message?.toLowerCase().includes("row-level security")) throw new Error("Falta ejecutar la migración 024 para habilitar estas imágenes.");
    throw error;
  }
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

import { supabase } from "./supabaseClient";

export const PRODUCT_IMAGES_BUCKET = "product-images";
export const MAX_PRODUCT_IMAGES = 5;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 1800;
const ALLOWED_SOURCE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir la imagen a WebP.")), "image/webp", quality);
  });
}

async function loadImageSource(file) {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function optimizeProductImage(file) {
  if (!ALLOWED_SOURCE_TYPES.includes(file.type)) throw new Error(`${file.name}: formato no permitido. Usá JPG, PNG o WebP.`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name}: supera el máximo de 10 MB.`);

  const bitmap = await loadImageSource(file);
  const width = bitmap.width || bitmap.naturalWidth;
  const height = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let quality = 0.84;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_OUTPUT_BYTES && quality > 0.58) {
    quality -= 0.06;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_OUTPUT_BYTES) throw new Error(`${file.name}: no pudo reducirse por debajo de 2 MB.`);
  return { blob, width: canvas.width, height: canvas.height, sourceBytes: file.size, outputBytes: blob.size };
}

export function getProductImageUrl(storagePath) {
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export async function uploadProductImage(productId, file, sortOrder) {
  const optimized = await optimizeProductImage(file);
  const path = `products/${productId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, optimized.blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase.from("product_images").insert({ product_id: productId, storage_path: path, alt_text: file.name.replace(/\.[^.]+$/, ""), sort_order: sortOrder }).select().single();
  if (insertError) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
    throw insertError;
  }
  return { ...data, optimization: optimized };
}

export async function replaceProductImage(image, file) {
  const optimized = await optimizeProductImage(file);
  const path = `products/${image.product_id}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, optimized.blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: updateError } = await supabase.from("product_images").update({ storage_path: path, alt_text: file.name.replace(/\.[^.]+$/, "") }).eq("id", image.id).select().single();
  if (updateError) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
    throw updateError;
  }
  const { error: removeError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);
  return { image: data, optimization: optimized, orphanWarning: removeError?.message || "" };
}

export async function deleteProductImage(image) {
  const { error: removeError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);
  if (removeError) throw removeError;
  const { error: deleteError } = await supabase.from("product_images").delete().eq("id", image.id);
  if (deleteError) throw deleteError;
}

export async function reorderProductImages(images) {
  for (let index = 0; index < images.length; index += 1) {
    const { error } = await supabase.from("product_images").update({ sort_order: index }).eq("id", images[index].id);
    if (error) throw error;
  }
}

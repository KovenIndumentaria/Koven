import { supabase } from "./supabaseClient";

export const SHEET_URL = "https://opensheet.elk.sh/11wJ42eVjai6vehi7x7_vysC1ju1pF1oGH_hmwx5NgRY/Hoja1";

export async function getCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data;
}

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(id,name,slug), variants:product_variants(*), images:product_images(id,storage_path,sort_order)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveProduct(product, variants) {
  const { data, error } = await supabase.rpc("save_product", {
    p_product: product,
    p_variants: variants,
  });
  if (error) throw error;
  return data;
}

export async function setProductActive(id, isActive) {
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeCategory(value) {
  const category = String(value || "").trim().toLowerCase();
  if (category === "buzos") return "abrigos";
  if (category === "jeans") return "pantalones";
  if (["medias-boxers", "medias y boxers", "boxers"].includes(category)) return "medias";
  return category || "sin-categoria";
}

function asBoolean(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["true", "si", "sí", "1"].includes(normalized);
}

function parseColors(value) {
  return String(value || "").split(",").map((item) => {
    const separator = item.lastIndexOf(":");
    if (separator < 0) return { name: item.trim(), hex: "" };
    return { name: item.slice(0, separator).trim(), hex: item.slice(separator + 1).trim() };
  }).filter((color) => color.name);
}

function parseVariants(row) {
  const colors = parseColors(row.colores);
  const colorHex = new Map(colors.map((color) => [color.name.toLowerCase(), color.hex]));
  const parsed = String(row.variantes || "").split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
    const parts = item.split(":").map((part) => part.trim());
    if (parts.length >= 3) {
      const quantity = Number(parts.pop());
      const size = parts.pop();
      const colorName = parts.join(":");
      return { size, color_name: colorName, color_hex: colorHex.get(colorName.toLowerCase()) || "", stock_current: Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0, is_active: true };
    }
    if (parts.length === 2) return { size: parts[0], color_name: colors[0]?.name || "", color_hex: colors[0]?.hex || "", stock_current: Math.max(0, Math.trunc(Number(parts[1]) || 0)), is_active: true };
    return null;
  }).filter(Boolean);

  if (parsed.length) return parsed;
  const sizes = String(row.talles || "").split(",").map((size) => size.trim()).filter(Boolean);
  const safeColors = colors.length ? colors : [{ name: "", hex: "" }];
  return sizes.flatMap((size) => safeColors.map((color) => ({ size, color_name: color.name, color_hex: color.hex, stock_current: 0, is_active: true })));
}

export async function importGoogleSheet(onProgress = () => {}) {
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error("No se pudo leer Google Sheets.");
  const allRows = await response.json();
  const rows = allRows.filter((row) => String(row.id || "").trim() && String(row.nombre || "").trim());
  const categorySlugs = [...new Set(rows.map((row) => normalizeCategory(row.categoria)))];

  const { error: categoryError } = await supabase.from("categories").upsert(
    categorySlugs.map((slug, index) => ({ name: slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "), slug, sort_order: index })),
    { onConflict: "slug" },
  );
  if (categoryError) throw categoryError;

  const categories = await getCategories();
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category.id]));
  const existing = await getProducts();
  const productsByLegacyId = new Map(existing.filter((product) => product.legacy_sheet_id).map((product) => [product.legacy_sheet_id, product]));
  let imported = 0;

  for (const row of rows) {
    const previous = productsByLegacyId.get(String(row.id));
    const previousVariants = new Map((previous?.variants || []).map((variant) => [`${variant.color_name.trim().toLowerCase()}|${variant.size.trim().toLowerCase()}`, variant]));
    const variants = parseVariants(row).map((variant) => ({
      ...variant,
      id: previousVariants.get(`${variant.color_name.trim().toLowerCase()}|${variant.size.trim().toLowerCase()}`)?.id || "",
    }));
    await saveProduct({
      id: previous?.id || "",
      legacy_sheet_id: String(row.id),
      category_id: String(categoriesBySlug.get(normalizeCategory(row.categoria)) || ""),
      name: String(row.nombre).trim(),
      description: String(row.descripcion || "").trim(),
      sale_price: Number(row.precio || 0),
      default_cost: previous?.default_cost ?? "",
      style: String(row.estilo || "").trim(),
      is_active: asBoolean(row.mostrar, true),
      is_featured: asBoolean(row.destacado),
      is_new: asBoolean(row.nuevo),
    }, variants);
    imported += 1;
    onProgress({ imported, total: rows.length, name: row.nombre });
  }

  return { imported, ignored: allRows.length - rows.length };
}

export { slugify };

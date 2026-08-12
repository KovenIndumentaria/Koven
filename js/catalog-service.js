(function () {
  const SUPABASE_URL = "https://dtvzmztzmnoxzszfqrol.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IooZqPmJ0XhU_uaWetsBmA_j39IHjLz";
  const SHEET_URL = "https://opensheet.elk.sh/11wJ42eVjai6vehi7x7_vysC1ju1pF1oGH_hmwx5NgRY/Hoja1";
  const PRODUCT_IMAGES_BASE = `${SUPABASE_URL}/storage/v1/object/public/product-images/`;
  const DEFAULT_SOURCE = "supabase";
  let runtimeSource = null;
  let productsPromise = null;
  let settingsPromise = null;

  async function loadSettings() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/store_settings?select=*&id=eq.true`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
    if (!response.ok) throw new Error("No se pudo cargar la configuración de la tienda");
    const [settings] = await response.json();
    if (!settings) throw new Error("Configuración no disponible");
    document.querySelectorAll('a[href*="wa.me/"]').forEach((link) => { link.href = `https://wa.me/${settings.whatsapp_number}`; });
    document.querySelectorAll('a[href*="instagram.com/"]').forEach((link) => { if (settings.instagram_url) link.href = settings.instagram_url; });
    document.querySelectorAll("[data-category-cover]").forEach((image) => {
      const field = `category_cover_${image.dataset.categoryCover}`;
      if (settings[field]) image.src = settings[field];
    });
    return settings;
  }

  function preferredSource() {
    const requested = new URLSearchParams(window.location.search).get("source");
    // La fuente anterior pudo quedar persistida durante la etapa de pruebas.
    localStorage.removeItem("kovenCatalogSource");
    if (["supabase", "google-sheets"].includes(requested)) return requested;
    return runtimeSource || DEFAULT_SOURCE;
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function storageUrl(path) {
    return `${PRODUCT_IMAGES_BASE}${String(path).split("/").map(encodeURIComponent).join("/")}`;
  }

  function adaptProduct(product) {
    const variants = (product.variants || []).filter((variant) => variant.is_active);
    const colors = new Map();
    variants.forEach((variant) => {
      if (variant.color_name) colors.set(variant.color_name.toLowerCase(), { name: variant.color_name, hex: variant.color_hex || "" });
    });
    const orderedImages = [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order);
    const stock = variants.reduce((total, variant) => total + Number(variant.stock_current || 0), 0);

    return {
      id: product.legacy_sheet_id || product.id,
      database_id: product.id,
      nombre: product.name,
      precio: String(product.sale_price),
      categoria: product.category?.slug || "sin-categoria",
      estilo: product.style || "",
      colores: [...colors.values()].map((color) => `${color.name}${color.hex ? `:${color.hex}` : ""}`).join(","),
      talles: unique(variants.map((variant) => variant.size)).join(", "),
      variantes: variants.map((variant) => variant.color_name
        ? `${variant.color_name}:${variant.size}:${variant.stock_current}`
        : `${variant.size}:${variant.stock_current}`).join(","),
      descripcion: product.description || "",
      imagenes: orderedImages.map((image) => storageUrl(image.storage_path)).join(", "),
      estado: stock > 0 ? "disponible" : "agotado",
      destacado: String(Boolean(product.is_featured)).toUpperCase(),
      nuevo: String(Boolean(product.is_new)).toUpperCase(),
      mostrar: "TRUE"
    };
  }

  async function fetchSupabaseProducts() {
    const select = "id,legacy_sheet_id,name,description,sale_price,style,is_featured,is_new,category:categories(name,slug),variants:product_variants(id,size,color_name,color_hex,stock_current,is_active),images:product_images(storage_path,sort_order)";
    const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${encodeURIComponent(select)}&is_active=eq.true`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
    });
    if (!response.ok) throw new Error(`Supabase respondió ${response.status}`);
    const products = await response.json();
    if (!Array.isArray(products) || products.length === 0) throw new Error("Supabase no devolvió productos activos");
    return products.map(adaptProduct);
  }

  async function fetchSheetProducts() {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error(`Google Sheets respondió ${response.status}`);
    return response.json();
  }

  async function loadProducts() {
    if (preferredSource() === "supabase") {
      const products = await fetchSupabaseProducts();
      api.lastSource = "supabase";
      return products;
    }
    const products = await fetchSheetProducts();
    api.lastSource = "google-sheets";
    return products;
  }

  const api = {
    lastSource: "pending",
    getProducts(options = {}) {
      if (!productsPromise || options.forceRefresh) productsPromise = loadProducts();
      return productsPromise;
    },
    getSettings(options = {}) {
      if (!settingsPromise || options.forceRefresh) settingsPromise = loadSettings();
      return settingsPromise;
    },
    setSource(source) {
      if (!["supabase", "google-sheets"].includes(source)) throw new Error("Fuente de catálogo inválida");
      runtimeSource = source;
      productsPromise = null;
    },
    async createOrder(order, items) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_public_order`, {
        method: "POST",
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ p_order: order, p_items: items })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "No se pudo registrar el pedido");
      return response.json();
    }
  };

  window.KovenCatalog = api;
  api.getSettings().catch(() => {});
})();

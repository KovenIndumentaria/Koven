let carrito = normalizarOrdenCarrito(JSON.parse(localStorage.getItem("carrito")) || []);
let productosSheet = [];
let stockSinVerificar = false;
let storeSettings = null;
let checkoutInProgress = false;
const LAST_ORDER_KEY = "kovenLastOrder";

const contenedor = document.getElementById("carrito");

localStorage.setItem("carrito", JSON.stringify(carrito));

window.KovenCatalog.getProducts({ forceRefresh: true })
  .then(data => {
    productosSheet = data;
    stockSinVerificar = false;
    actualizar();
  })
  .catch(() => {
    stockSinVerificar = true;
    actualizar();
  });

window.KovenCatalog.getSettings().then(settings => {
  storeSettings = settings;
  const pickup = document.getElementById("pickupOption");
  const shipping = document.getElementById("shippingOption");
  if (pickup) pickup.hidden = !settings.pickup_enabled;
  if (shipping) shipping.hidden = !settings.shipping_enabled;
  const pickupLabel = document.getElementById("pickupLabel");
  if (pickupLabel) pickupLabel.textContent = `Retiro por ${settings.pickup_address}`;
  const shippingLabel = document.getElementById("shippingLabel");
  if (shippingLabel) shippingLabel.textContent = settings.shipping_mode === "flat" ? `Costo fijo: $${Number(settings.shipping_cost).toLocaleString("es-AR")}${settings.free_shipping_from ? ` · Gratis desde $${Number(settings.free_shipping_from).toLocaleString("es-AR")}` : ""}` : "El costo y la disponibilidad se confirman por WhatsApp.";
  const checkoutMessage = document.getElementById("checkoutMessage");
  if (checkoutMessage && settings.checkout_message) checkoutMessage.textContent = settings.checkout_message;
  if (!settings.pickup_enabled && settings.shipping_enabled) document.querySelector('input[name="entrega"][value="envio"]').checked = true;
  actualizarEntrega(); renderCarrito();
}).catch(() => {});

function calcularEnvio(subtotal) {
  if (obtenerEntregaSeleccionada() !== "envio" || !storeSettings || storeSettings.shipping_mode !== "flat") return 0;
  if (storeSettings.free_shipping_from && subtotal >= Number(storeSettings.free_shipping_from)) return 0;
  return Number(storeSettings.shipping_cost || 0);
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function stockKey(color, talle) {
  return `${normalizarTexto(color)}|${normalizarTexto(talle)}`;
}

function itemKey(prod) {
  return prod.id + "_" + prod.talle + "_" + prod.color;
}

function normalizarOrdenCarrito(items) {
  const ordenes = new Map();

  items.forEach(item => {
    const key = itemKey(item);
    const ordenActual = ordenes.get(key);
    const ordenItem = item.orderKey || item.timestamp || Date.now();

    if (ordenActual === undefined || ordenItem < ordenActual) {
      ordenes.set(key, ordenItem);
    }
  });

  return items.map(item => ({
    ...item,
    orderKey: ordenes.get(itemKey(item)) || item.timestamp || Date.now()
  }));
}

function obtenerColores(prod) {
  if (!prod?.colores) return [];

  return prod.colores
    .split(",")
    .map(c => {
      const [nombre, hex] = c.split(":");
      return {
        nombre: nombre.trim(),
        hex: (hex || "").trim()
      };
    })
    .filter(c => c.nombre);
}

function obtenerTalles(prod) {
  const fuente = prod?.talles || prod?.stock || "";

  if (fuente && !String(fuente).includes(":")) {
    return [...new Set(fuente.split(",").map(t => t.trim()).filter(Boolean))];
  }

  if (prod?.variantes) {
    return [...new Set(
      prod.variantes
        .split(",")
        .map(v => v.split(":"))
        .map(partes => partes.length >= 3 ? partes[1] : partes[0])
        .map(t => t.trim())
        .filter(Boolean)
    )];
  }

  if (prod?.stock && String(prod.stock).includes(":")) {
    return [...new Set(
      prod.stock
        .split(",")
        .map(v => v.split(":")[0].trim())
        .filter(Boolean)
    )];
  }

  return [];
}

function obtenerStock(prod) {
  const stock = new Map();
  const colores = obtenerColores(prod);

  if (prod?.variantes) {
    prod.variantes.split(",").forEach(item => {
      const partes = item.split(":").map(p => p.trim());

      if (partes.length >= 3) {
        const [color, talle, cantidad] = partes;
        stock.set(stockKey(color, talle), Number(cantidad));
      }

      if (partes.length === 2) {
        const [talle, cantidad] = partes;
        stock.set(stockKey("", talle), Number(cantidad));
      }
    });
  }

  if (stock.size === 0 && prod?.stock && String(prod.stock).includes(":")) {
    prod.stock.split(",").forEach(item => {
      const [talle, cantidad] = item.split(":").map(p => p.trim());
      stock.set(stockKey("", talle), Number(cantidad));
    });
  }

  if (stock.size === 0) {
    obtenerTalles(prod).forEach(talle => {
      if (colores.length) {
        colores.forEach(color => stock.set(stockKey(color.nombre, talle), Infinity));
      } else {
        stock.set(stockKey("", talle), Infinity);
      }
    });
  }

  return stock;
}

function buscarProductoSheet(id) {
  return productosSheet.find(prod => prod.id == id);
}

function stockDisponible(prodCarrito) {
  const prodSheet = buscarProductoSheet(prodCarrito.id);

  if (!prodSheet) return Infinity;

  const stock = obtenerStock(prodSheet);
  const colores = obtenerColores(prodSheet);
  const color = colores.length ? prodCarrito.color : "";
  const exacto = stock.get(stockKey(color, prodCarrito.talle));
  const porTalle = stock.get(stockKey("", prodCarrito.talle));

  if (exacto !== undefined) return exacto;
  if (porTalle !== undefined) return porTalle;

  return 0;
}

function cantidadEnCarrito(prodCarrito) {
  return carrito.filter(item =>
    item.id == prodCarrito.id &&
    item.talle == prodCarrito.talle &&
    item.color == prodCarrito.color
  ).length;
}

function puedeAgregarUno(prodCarrito) {
  const disponible = stockDisponible(prodCarrito);

  if (disponible === Infinity) return true;

  return cantidadEnCarrito(prodCarrito) < disponible;
}

function agruparCarrito() {
  const mapa = new Map();

  carrito.forEach(prod => {
    const key = itemKey(prod);

    if (!mapa.has(key)) {
      mapa.set(key, {
        ...prod,
        cantidad: 1,
        firstTimestamp: prod.orderKey || prod.timestamp
      });
    } else {
      mapa.get(key).cantidad++;
    }
  });

  return Array.from(mapa.values())
    .sort((a, b) => a.firstTimestamp - b.firstTimestamp);
}

function renderCarrito() {
  contenedor.innerHTML = "";

  const productos = agruparCarrito();
  const entregaBox = document.querySelector(".entrega-box");
  const resumenBox = document.querySelector(".carrito-resumen");
  let total = 0;

  if (productos.length === 0) {
    const lastOrder = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || "null");
    const recentOrder = lastOrder && Date.now() - Number(lastOrder.createdAt || 0) < 86400000;
    contenedor.innerHTML = `
      <div class="carrito-vacio ${recentOrder ? "pedido-generado" : ""}">
        <h2>${recentOrder ? `Pedido #${lastOrder.orderNumber} generado` : "Tu carrito está vacío"}</h2>
        <p>${recentOrder ? "El pedido ya quedó registrado. Continuá la conversación por WhatsApp para coordinar el pago y la entrega." : "Explorá el catálogo y agregá las prendas que quieras reservar por WhatsApp."}</p>
        <a href="catalogo.html">Ver productos</a>
      </div>
    `;

    if (entregaBox) entregaBox.classList.add("oculto");
    if (resumenBox) resumenBox.classList.add("oculto");
    document.getElementById("total").innerText = "";
    return;
  }

  if (entregaBox) entregaBox.classList.remove("oculto");
  if (resumenBox) resumenBox.classList.remove("oculto");

  if (stockSinVerificar) {
    contenedor.innerHTML = `
      <div class="carrito-aviso">
        <strong>Stock pendiente de confirmar</strong>
        <p>No pudimos verificar el stock en tiempo real. Podés enviar el pedido igual y lo confirmamos por WhatsApp.</p>
      </div>
    `;
  }

  productos.forEach(prod => {
    total += prod.precio * prod.cantidad;

    const div = document.createElement("div");
    div.classList.add("item-carrito");

    const color = prod.color || "-";
    const colorSwatch = prod.colorHex
      ? `<span class="item-color-swatch" style="background:${prod.colorHex}"></span>`
      : "";
    const disponible = stockDisponible(prod);
    const llegoAlMaximo = disponible !== Infinity && prod.cantidad >= disponible;
    const linkProducto = `producto.html?id=${prod.id}`;

    div.innerHTML = `
      <div class="item-info">
        <a href="${linkProducto}" class="item-link-imagen" aria-label="Ver ${prod.nombre}">
          <img src="${prod.imagen || ""}" alt="${prod.nombre}">
        </a>
        <div>
          <h4><a href="${linkProducto}">${prod.nombre}</a></h4>
          <div class="item-meta">
            <span>Talle: ${prod.talle || "-"}</span>
            <span>${colorSwatch} Color: ${color}</span>
          </div>
          <p class="item-precio">$${prod.precio.toLocaleString("es-AR")} c/u</p>
          ${llegoAlMaximo ? `<p class="item-stock">Máximo disponible en stock</p>` : ""}
        </div>
      </div>

      <div class="item-acciones">
        <button onclick="eliminarUno('${prod.id}', '${prod.talle}', '${prod.color}')" aria-label="Quitar uno">−</button>
        <span>${prod.cantidad}</span>
        <button
          onclick="agregarUno('${prod.id}', '${prod.talle}', '${prod.color}')"
          aria-label="Agregar uno"
          ${llegoAlMaximo ? "disabled" : ""}
        >+</button>
        <button onclick="eliminarProducto('${prod.id}', '${prod.talle}', '${prod.color}')" aria-label="Eliminar producto">×</button>
      </div>
    `;

    contenedor.appendChild(div);
  });

  const envio = calcularEnvio(total);
  document.getElementById("total").innerText = `${envio ? `Productos: $${total.toLocaleString("es-AR")} · Envío: $${envio.toLocaleString("es-AR")} · ` : ""}Total: $${(total + envio).toLocaleString("es-AR")}`;
}

function agregarUno(id, talle, color) {
  const prod = carrito.find(p =>
    p.id == id && p.talle == talle && p.color == color
  );

  if (!prod || !puedeAgregarUno(prod)) return;

  carrito.push({ ...prod, timestamp: Date.now(), orderKey: prod.orderKey || prod.timestamp || Date.now() });
  actualizar();
}

function eliminarUno(id, talle, color) {
  const index = carrito.findIndex(p =>
    p.id == id && p.talle == talle && p.color == color
  );

  if (index !== -1) {
    carrito.splice(index, 1);
    actualizar();
  }
}

function eliminarProducto(id, talle, color) {
  carrito = carrito.filter(p =>
    !(p.id == id && p.talle == talle && p.color == color)
  );

  actualizar();
}

function actualizar() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  renderCarrito();
  actualizarContador();
}

function vaciarCarrito() {
  carrito = [];
  actualizar();
}

function obtenerEntregaSeleccionada() {
  return document.querySelector('input[name="entrega"]:checked')?.value || "retiro";
}

function actualizarEntrega() {
  const tipoEntrega = obtenerEntregaSeleccionada();
  const direccionBox = document.getElementById("direccionEnvio");

  if (!direccionBox) return;

  direccionBox.classList.toggle("activo", tipoEntrega === "envio");
  renderCarrito();
}

async function comprar() {
  if (checkoutInProgress) return;
  if (carrito.length === 0) {
    alert("El carrito está vacío");
    return;
  }

  const productos = agruparCarrito();
  const tipoEntrega = obtenerEntregaSeleccionada();
  const direccion = document.getElementById("direccion")?.value.trim() || "";
  const nombre = document.getElementById("clienteNombre")?.value.trim() || "";
  const telefono = document.getElementById("clienteTelefono")?.value.trim() || "";
  const boton = document.getElementById("btnFinalizar");

  if (storeSettings && !storeSettings.sales_enabled) { alert("La tienda no está recibiendo pedidos online en este momento."); return; }

  if (nombre.length < 2) { alert("Ingresá tu nombre y apellido"); return; }
  if (telefono.length < 6) { alert("Ingresá un teléfono válido"); return; }

  if (tipoEntrega === "envio" && !direccion) {
    alert("Ingresá la dirección de envío");
    return;
  }

  checkoutInProgress = true;
  const whatsappWindow = window.open("", "_blank");
  if (boton) { boton.disabled = true; boton.textContent = "Generando pedido…"; }
  let pedido = null;
  try {
    pedido = await window.KovenCatalog.createOrder({
      customer_name: nombre,
      customer_phone: telefono,
      delivery_type: tipoEntrega === "retiro" ? "pickup" : "shipping",
      delivery_address: direccion
    }, productos.map(prod => ({ product_id: String(prod.id), size: prod.talle || "", color: prod.color || "", quantity: prod.cantidad })));
  } catch (error) {
    alert("No pudimos generar el número de pedido, pero podés continuar por WhatsApp. Confirmaremos los datos manualmente.");
  } finally {
    checkoutInProgress = false;
    if (boton) { boton.disabled = false; boton.textContent = "Finalizar compra"; }
  }

  let mensaje = `Hola KOVEN! Quiero realizar el siguiente pedido${pedido ? ` #${pedido.order_number}` : ""}:\n\n`;
  mensaje += `Nombre: ${nombre}\nTeléfono: ${telefono}\n\n`;
  let subtotal = 0;

  productos.forEach(prod => {
    const subtotalProducto = prod.precio * prod.cantidad;
    subtotal += subtotalProducto;

    mensaje += `* ${prod.nombre}`;
    if (prod.talle) mensaje += ` | Talle: ${prod.talle}`;
    if (prod.color) mensaje += ` | Color: ${prod.color}`;
    mensaje += ` | x${prod.cantidad} - $${subtotalProducto}\n`;
  });

  const envio = pedido ? Number(pedido.shipping_amount || 0) : calcularEnvio(subtotal);
  if (tipoEntrega === "retiro") {
    mensaje += `\nTotal: $${subtotal}`;
    mensaje += `\n\nEntrega: Retiro por ${storeSettings?.pickup_address || "Arturo M Bas 389 - Córdoba Capital"}`;
  } else {
    mensaje += `\nSubtotal: $${subtotal}`;
    mensaje += envio ? `\nEnvío: $${envio}\nTotal: $${subtotal + envio}` : "";
    mensaje += `\n\nEntrega: ${storeSettings?.shipping_mode === "flat" ? "Envío" : "Envío a coordinar"}`;
    mensaje += `\nDirección de envío: ${direccion}`;
  }

  const whatsappUrl = `https://wa.me/${storeSettings?.whatsapp_number || "5493517557401"}?text=${encodeURIComponent(mensaje)}`;
  if (pedido) {
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ orderNumber: pedido.order_number, createdAt: Date.now() }));
    carrito = [];
    actualizar();
  }
  if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
  else window.location.href = whatsappUrl;
}

actualizarEntrega();

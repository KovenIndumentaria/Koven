const URL = "https://opensheet.elk.sh/11wJ42eVjai6vehi7x7_vysC1ju1pF1oGH_hmwx5NgRY/Hoja1";

let carrito = normalizarOrdenCarrito(JSON.parse(localStorage.getItem("carrito")) || []);
let productosSheet = [];

const contenedor = document.getElementById("carrito");

localStorage.setItem("carrito", JSON.stringify(carrito));

fetch(URL)
  .then(res => res.json())
  .then(data => {
    productosSheet = data;
    actualizar();
  })
  .catch(() => {
    actualizar();
  });

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
  let total = 0;

  if (productos.length === 0) {
    contenedor.innerHTML = `<p class="carrito-vacio">Tu carrito está vacío.</p>`;
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

    div.innerHTML = `
      <div class="item-info">
        <img src="${prod.imagen || ""}" alt="${prod.nombre}">
        <div>
          <h4>${prod.nombre}</h4>
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

  document.getElementById("total").innerText =
    "Total: $" + total.toLocaleString("es-AR");
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
}

function comprar() {
  if (carrito.length === 0) {
    alert("El carrito está vacío");
    return;
  }

  const productos = agruparCarrito();
  const tipoEntrega = obtenerEntregaSeleccionada();
  const direccion = document.getElementById("direccion")?.value.trim() || "";

  if (tipoEntrega === "envio" && !direccion) {
    alert("Ingresá la dirección de envío");
    return;
  }

  let mensaje = "Hola KOVEN! Quiero realizar el siguiente pedido:\n\n";
  let subtotal = 0;

  productos.forEach(prod => {
    const subtotalProducto = prod.precio * prod.cantidad;
    subtotal += subtotalProducto;

    mensaje += `* ${prod.nombre}`;
    if (prod.talle) mensaje += ` | Talle: ${prod.talle}`;
    if (prod.color) mensaje += ` | Color: ${prod.color}`;
    mensaje += ` | x${prod.cantidad} - $${subtotalProducto}\n`;
  });

  if (tipoEntrega === "retiro") {
    mensaje += `\nTotal productos: $${subtotal}`;
    mensaje += "\n\nEntrega: Retiro por Arturo M Bas 389 - Córdoba Capital";
  } else {
    mensaje += `\nSubtotal: $${subtotal}`;
    mensaje += "\n\nEntrega: Envío a coordinar";
    mensaje += `\nDirección de envío: ${direccion}`;
  }

  window.open(`https://wa.me/5493517557401?text=${encodeURIComponent(mensaje)}`);
}

actualizarEntrega();

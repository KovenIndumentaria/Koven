let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

const contenedor = document.getElementById("carrito");

function agruparCarrito() {
  const mapa = new Map();

  carrito.forEach(prod => {
    const key = prod.id + "_" + prod.talle + "_" + prod.color;

    if (!mapa.has(key)) {
      mapa.set(key, {
        ...prod,
        cantidad: 1,
        firstTimestamp: prod.timestamp
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
        </div>
      </div>

      <div class="item-acciones">
        <button onclick="eliminarUno('${prod.id}', '${prod.talle}', '${prod.color}')" aria-label="Quitar uno">−</button>
        <span>${prod.cantidad}</span>
        <button onclick="agregarUno('${prod.id}', '${prod.talle}', '${prod.color}')" aria-label="Agregar uno">+</button>
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

  if (!prod) return;

  carrito.push(prod);
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

function comprar() {
  if (carrito.length === 0) {
    alert("El carrito está vacío");
    return;
  }

  const productos = agruparCarrito();

  let mensaje = "Hola! Quiero estos productos:\n\n";
  let total = 0;

  productos.forEach(prod => {
    const subtotal = prod.precio * prod.cantidad;
    total += subtotal;

    mensaje += `${prod.nombre}`;
    if (prod.talle) mensaje += ` | Talle: ${prod.talle}`;
    if (prod.color) mensaje += ` | Color: ${prod.color}`;
    mensaje += ` | x${prod.cantidad} - $${subtotal}\n`;
  });

  mensaje += `\nTotal: $${total}`;

  window.open(`https://wa.me/5493517557401?text=${encodeURIComponent(mensaje)}`);
}

actualizar();

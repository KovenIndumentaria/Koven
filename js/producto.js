const URL = "https://opensheet.elk.sh/11wJ42eVjai6vehi7x7_vysC1ju1pF1oGH_hmwx5NgRY/Hoja1";
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

let productoActual = null;
let coloresGlobal = [];
let imagenesGlobal = [];
let stockGlobal = new Map();
let indexActual = 0;
let talleSeleccionado = "";
let colorSeleccionado = "";
let colorHexSeleccionado = "";
let cantidadSeleccionada = 1;

fetch(URL)
  .then(res => res.json())
  .then(data => {
    const prod = data.find(p => p.id == id);

    if (!prod) return;

    productoActual = prod;

    const colores = obtenerColores(prod);
    const contenedor = document.getElementById("detalle");
    const disponible = prod.estado?.toLowerCase() === "disponible";
    const talles = obtenerTalles(prod);
    const imagenes = prod.imagenes ? prod.imagenes.split(",") : [];

    imagenesGlobal = imagenes;
    coloresGlobal = colores;
    stockGlobal = obtenerStock(prod);

    if (colores.length === 1) {
      colorSeleccionado = colores[0].nombre;
      colorHexSeleccionado = colores[0].hex || colores[0].nombre;
    }

    if (talles.length === 1) {
      talleSeleccionado = talles[0];
    }

    if (imagenes.length === 0) return;

    contenedor.innerHTML = `
      <div class="detalle-container">
        <div class="galeria">
          <img
            src="${imagenes[0].trim()}"
            class="principal"
            id="imgPrincipal"
            alt="${prod.nombre}"
            onclick="abrirModal(0)"
          >

          <div class="thumbs">
            ${imagenes.map((img, i) => `
              <img
                src="${img.trim()}"
                alt="${prod.nombre} ${i + 1}"
                class="${i === 0 ? "activa" : ""}"
                onclick="cambiarImagen('${img.trim()}', this)"
              >
            `).join("")}
          </div>
        </div>

        <div class="info">
          <span class="product-kicker">KOVEN</span>
          <h1>${prod.nombre}</h1>
          <p>$${Number(prod.precio).toLocaleString("es-AR")}</p>

          ${renderColores(colores)}
          ${renderTalles(talles)}

          <div class="cantidad-producto">
            <p class="label">Cantidad</p>
            <div class="cantidad-control">
              <button type="button" onclick="cambiarCantidad(-1)" aria-label="Quitar uno">−</button>
              <span id="cantidadSeleccionada">1</span>
              <button type="button" onclick="cambiarCantidad(1)" aria-label="Agregar uno">+</button>
            </div>
          </div>

          <button
            class="btn-agregar"
            onclick="agregarDesdeProducto('${prod.id}')"
          >
            Agregar al carrito
          </button>

          <p class="stock-mensaje" id="stockMensaje"></p>

          ${prod.descripcion ? `
            <div class="descripcion">
              <h3>Descripción</h3>
              <p>${prod.descripcion}</p>
            </div>
          ` : ""}

          ${!disponible ? `<p class="sin-stock">Este producto está agotado</p>` : ""}
        </div>
      </div>
    `;

    actualizarEstadoStock();
  });

function renderColores(colores) {
  if (!colores.length) return "";

  if (colores.length === 1) {
    const color = colores[0];
    return `
      <div class="opcion-unica">
        <p class="label">Color</p>
        <span>
          <i class="item-color-swatch" style="background:${color.hex || color.nombre}"></i>
          ${color.nombre}
        </span>
      </div>
    `;
  }

  return `
    <div class="colores">
      <p class="label">Color</p>
      <div class="colores-opciones">
        ${colores.map(c => `
          <button
            class="color-btn"
            style="background:${c.hex || c.nombre}"
            data-color-hex="${c.hex || c.nombre}"
            aria-label="${c.nombre}"
            onclick="seleccionarColor('${c.nombre}', this)"
          ></button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderTalles(talles) {
  if (!talles.length) return "";

  if (talles.length === 1) {
    const talle = talles[0];
    const texto = normalizarTexto(talle) === "único" ? "Talle único" : `Talle: ${talle}`;

    return `
      <div class="opcion-unica">
        <p class="label">Talle</p>
        <span>${texto}</span>
      </div>
    `;
  }

  return `
    <div class="talles">
      <p class="label">Seleccionar talle</p>
      <div class="talles-opciones">
        ${talles.map(talle => `
          <button
            class="talle-btn"
            data-talle="${talle}"
            onclick="seleccionarTalle('${talle}', this)"
          >
            ${talle}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function stockKey(color, talle) {
  return `${normalizarTexto(color)}|${normalizarTexto(talle)}`;
}

function obtenerColores(prod) {
  if (!prod.colores) return [];

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
  const fuente = prod.talles || prod.stock || "";

  if (fuente && !String(fuente).includes(":")) {
    return valoresUnicos(fuente.split(",").map(t => t.trim()).filter(Boolean));
  }

  if (prod.variantes) {
    return valoresUnicos(
      prod.variantes
        .split(",")
        .map(v => v.split(":"))
        .map(partes => partes.length >= 3 ? partes[1] : partes[0])
        .map(t => t.trim())
        .filter(Boolean)
    );
  }

  if (prod.stock && String(prod.stock).includes(":")) {
    return valoresUnicos(
      prod.stock
        .split(",")
        .map(v => v.split(":")[0].trim())
        .filter(Boolean)
    );
  }

  return [];
}

function valoresUnicos(lista) {
  return [...new Set(lista)];
}

function obtenerStock(prod) {
  const stock = new Map();

  if (prod.variantes) {
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

  if (stock.size === 0 && prod.stock && String(prod.stock).includes(":")) {
    prod.stock.split(",").forEach(item => {
      const [talle, cantidad] = item.split(":").map(p => p.trim());
      stock.set(stockKey("", talle), Number(cantidad));
    });
  }

  if (stock.size === 0) {
    obtenerTalles(prod).forEach(talle => {
      if (coloresGlobal.length) {
        coloresGlobal.forEach(color => stock.set(stockKey(color.nombre, talle), Infinity));
      } else {
        stock.set(stockKey("", talle), Infinity);
      }
    });
  }

  return stock;
}

function tieneStockPorColor() {
  return [...stockGlobal.keys()].some(key => !key.startsWith("|"));
}

function obtenerStockDisponible(color, talle) {
  const colorNormalizado = coloresGlobal.length ? color : "";
  const exacto = stockGlobal.get(stockKey(colorNormalizado, talle));
  const porTalle = stockGlobal.get(stockKey("", talle));

  if (exacto !== undefined) return exacto;
  if (porTalle !== undefined) return porTalle;

  return 0;
}

function cantidadEnCarrito(color, talle) {
  const carrito = JSON.parse(localStorage.getItem("carrito")) || [];

  return carrito.filter(item =>
    item.id == productoActual.id &&
    normalizarTexto(item.color) === normalizarTexto(color) &&
    normalizarTexto(item.talle) === normalizarTexto(talle)
  ).length;
}

function stockRestante(color, talle) {
  const disponible = obtenerStockDisponible(color, talle);

  if (disponible === Infinity) return Infinity;

  return Math.max(disponible - cantidadEnCarrito(color, talle), 0);
}

function stockRestanteSeleccionado() {
  return stockRestante(colorSeleccionado, talleSeleccionado);
}

function actualizarCantidadUI() {
  const cantidad = document.getElementById("cantidadSeleccionada");
  if (cantidad) cantidad.textContent = cantidadSeleccionada;
}

function ajustarCantidadAlStock() {
  const restante = stockRestanteSeleccionado();

  if (restante !== Infinity && cantidadSeleccionada > restante) {
    cantidadSeleccionada = Math.max(restante, 1);
  }

  actualizarCantidadUI();
}

function cambiarCantidad(delta) {
  const restante = stockRestanteSeleccionado();
  const maximo = restante === Infinity ? 99 : restante;

  cantidadSeleccionada = Math.min(Math.max(cantidadSeleccionada + delta, 1), Math.max(maximo, 1));
  actualizarCantidadUI();
  actualizarEstadoStock();
}

function actualizarEstadoStock() {
  const btn = document.querySelector(".btn-agregar");
  const mensaje = document.getElementById("stockMensaje");
  if (!btn) return;

  const productoDisponible = productoActual?.estado?.toLowerCase() === "disponible";
  const necesitaColor = coloresGlobal.length > 1;
  const necesitaTalle = document.querySelectorAll(".talle-btn").length > 0;

  document.querySelectorAll(".talle-btn").forEach(btnTalle => {
    const talle = btnTalle.dataset.talle;
    const colorParaChequear = colorSeleccionado || (necesitaColor && !tieneStockPorColor() ? "" : colorSeleccionado);
    const sinStock = necesitaColor && !colorSeleccionado
      ? false
      : stockRestante(colorParaChequear, talle) <= 0;

    btnTalle.classList.toggle("disabled", sinStock);
  });

  if (!productoDisponible) {
    btn.textContent = "Sin stock";
    btn.disabled = true;
    if (mensaje) mensaje.textContent = "";
    return;
  }

  if (necesitaColor && !colorSeleccionado) {
    btn.textContent = "Elegí un color";
    btn.disabled = true;
    if (mensaje) mensaje.textContent = "";
    return;
  }

  if (necesitaTalle && !talleSeleccionado) {
    btn.textContent = "Elegí un talle";
    btn.disabled = true;
    if (mensaje) mensaje.textContent = "";
    return;
  }

  ajustarCantidadAlStock();
  const restante = stockRestanteSeleccionado();

  if (restante <= 0) {
    btn.textContent = "Sin stock";
    btn.disabled = true;
    if (mensaje) mensaje.textContent = "No queda stock para esta combinación.";
    return;
  }

  btn.textContent = cantidadSeleccionada > 1
    ? `Agregar ${cantidadSeleccionada} al carrito`
    : "Agregar al carrito";
  btn.disabled = false;

  if (mensaje) {
    mensaje.textContent = restante === Infinity ? "" : `Stock disponible: ${restante}`;
  }
}

function cambiarImagen(src, el) {
  const principal = document.getElementById("imgPrincipal");
  principal.src = src;

  document.querySelectorAll(".thumbs img").forEach(img => {
    img.classList.remove("activa");
  });

  el.classList.add("activa");
}

function agregarDesdeProducto(id) {
  if (!talleSeleccionado && document.querySelectorAll(".talle-btn").length) {
    alert("Seleccioná un talle");
    return;
  }

  if (coloresGlobal.length > 1 && !colorSeleccionado) {
    alert("Seleccioná un color");
    return;
  }

  if (stockRestanteSeleccionado() <= 0) {
    actualizarEstadoStock();
    return;
  }

  const producto = {
    id: id,
    nombre: document.querySelector("h1").innerText,
    precio: Number(document.querySelector(".info > p").innerText.replace(/\D/g, "")),
    talle: talleSeleccionado,
    color: colorSeleccionado,
    colorHex: colorHexSeleccionado,
    imagen: document.getElementById("imgPrincipal").src,
    timestamp: Date.now()
  };

  let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

  for (let i = 0; i < cantidadSeleccionada; i++) {
    carrito.push({ ...producto, timestamp: Date.now() + i });
  }

  localStorage.setItem("carrito", JSON.stringify(carrito));

  const btn = document.querySelector(".btn-agregar");

  btn.textContent = cantidadSeleccionada > 1 ? `Agregados ${cantidadSeleccionada} ✓` : "Agregado ✓";
  btn.classList.add("agregado");
  cantidadSeleccionada = 1;
  actualizarCantidadUI();

  setTimeout(() => {
    btn.classList.remove("agregado");
    actualizarEstadoStock();
  }, 900);

  actualizarContador();
}

actualizarContador();

function abrirModal(index) {
  indexActual = index;

  const modal = document.getElementById("modal");
  const img = document.getElementById("imgModal");

  img.src = imagenesGlobal[index].trim();
  modal.style.display = "flex";
}

function cerrarModal() {
  document.getElementById("modal").style.display = "none";
}

function cambiarSlide(dir) {
  indexActual += dir;

  if (indexActual < 0) indexActual = imagenesGlobal.length - 1;
  if (indexActual >= imagenesGlobal.length) indexActual = 0;

  document.getElementById("imgModal").src = imagenesGlobal[indexActual].trim();
}

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("modal");

  if (!modal || modal.style.display !== "flex") return;

  if (e.key === "ArrowRight") cambiarSlide(1);
  if (e.key === "ArrowLeft") cambiarSlide(-1);
  if (e.key === "Escape") cerrarModal();
});

function seleccionarTalle(talle, el) {
  talleSeleccionado = talle;

  document.querySelectorAll(".talle-btn").forEach(btn => {
    btn.classList.remove("activo");
  });

  el.classList.add("activo");
  cantidadSeleccionada = 1;
  actualizarEstadoStock();
}

function seleccionarColor(color, el) {
  colorSeleccionado = color;
  colorHexSeleccionado = el.dataset.colorHex || "";

  document.querySelectorAll(".color-btn").forEach(btn => {
    btn.classList.remove("activo");
  });

  el.classList.add("activo");
  cantidadSeleccionada = 1;
  actualizarEstadoStock();
}

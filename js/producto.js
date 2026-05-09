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
const contenedorDetalle = document.getElementById("detalle");
const MOSTRAR_ULTIMAS_UNIDADES = false;

mostrarSkeletonProducto();

fetch(URL)
  .then(res => {
    if (!res.ok) throw new Error("No se pudo cargar el producto");
    return res.json();
  })
  .then(data => {
    const prod = data.find(p => p.id == id);

    if (!prod) {
      actualizarSeoProducto({
        nombre: "Producto no encontrado",
        descripcion: "Este producto KOVEN no está disponible o el enlace cambió."
      });

      mostrarEstadoProducto(
        "Producto no encontrado",
        "Es posible que el producto ya no esté disponible o que el enlace haya cambiado.",
        "Volver al catálogo",
        "catalogo.html"
      );
      return;
    }

    productoActual = prod;

    const colores = obtenerColores(prod);
    const disponible = prod.estado?.toLowerCase() === "disponible";
    const talles = obtenerTalles(prod);
    const imagenes = prod.imagenes ? prod.imagenes.split(",") : [];
    const imagenPrincipal = imagenes[0]?.trim() || "";
    const categoriaProducto = obtenerCategoriaNormalizada(prod);
    const linkCategoria = `${categoriaProducto}.html`;

    actualizarSeoProducto({
      nombre: prod.nombre,
      descripcion: prod.descripcion || "Producto KOVEN. Elegí color y talle disponible, agregalo al carrito y finalizá por WhatsApp.",
      imagen: imagenPrincipal
    });

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

    if (imagenes.length === 0) {
      mostrarEstadoProducto(
        "Producto sin imágenes",
        "Este producto todavía no tiene fotos cargadas. Escribinos por WhatsApp y te pasamos más información.",
        "Consultar por WhatsApp",
        "https://wa.me/5493517557401"
      );
      return;
    }

    contenedorDetalle.innerHTML = `
      <nav class="producto-breadcrumb" aria-label="Ruta de navegación">
        <a href="../index.html">Inicio</a>
        <span>/</span>
        <a href="${linkCategoria}">${etiquetaCategoria(categoriaProducto)}</a>
        <span>/</span>
        <span>${prod.nombre}</span>
      </nav>

      <div class="detalle-container">
        <div class="galeria">
          <a href="${linkCategoria}" class="volver-catalogo">← Volver a ${etiquetaCategoria(categoriaProducto)}</a>

          <img
            src="${imagenes[0].trim()}"
            class="principal"
            id="imgPrincipal"
            alt="${prod.nombre}"
            onclick="abrirModal()"
          >

          <div class="thumbs">
            ${imagenes.map((img, i) => `
              <img
                src="${img.trim()}"
                alt="${prod.nombre} ${i + 1}"
                class="${i === 0 ? "activa" : ""}"
                onclick="cambiarImagen('${img.trim()}', this, ${i})"
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
          ${!disponible ? renderReposicionWhatsapp(prod) : ""}
        </div>
      </div>

      ${renderRelacionados(data, prod, categoriaProducto)}
    `;

    actualizarEstadoStock();
  })
  .catch(() => {
    mostrarEstadoProducto(
      "No pudimos cargar el producto",
      "Intentá de nuevo en unos minutos o escribinos por WhatsApp.",
      "Contactar por WhatsApp",
      "https://wa.me/5493517557401"
    );
  });

function mostrarEstadoProducto(titulo, texto, accion, href) {
  if (!contenedorDetalle) return;

  contenedorDetalle.innerHTML = `
    <div class="catalogo-estado producto-estado">
      <h3>${titulo}</h3>
      <p>${texto}</p>
      ${accion && href ? `<a href="${href}" ${href.startsWith("http") ? `target="_blank" rel="noopener"` : ""}>${accion}</a>` : ""}
    </div>
  `;
}

function mostrarSkeletonProducto() {
  if (!contenedorDetalle) return;

  contenedorDetalle.innerHTML = `
    <div class="producto-skeleton-detalle" aria-label="Cargando producto">
      <div class="skeleton-galeria">
        <span class="skeleton-volver"></span>
        <span class="skeleton-imagen"></span>
        <div class="skeleton-thumbs">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <div class="skeleton-info">
        <span class="skeleton-kicker"></span>
        <span class="skeleton-title"></span>
        <span class="skeleton-title skeleton-title--short"></span>
        <span class="skeleton-price"></span>
        <span class="skeleton-label"></span>
        <div class="skeleton-options">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="skeleton-button"></span>
        <span class="skeleton-copy"></span>
        <span class="skeleton-copy skeleton-copy--short"></span>
      </div>
    </div>
  `;
}

function actualizarSeoProducto({ nombre, descripcion, imagen }) {
  const titulo = nombre ? `${nombre} | KOVEN` : "Producto | KOVEN";
  const texto = descripcion || "Producto KOVEN con compra simple por WhatsApp.";

  document.title = titulo;
  actualizarMeta("name", "description", texto);
  actualizarMeta("property", "og:title", titulo);
  actualizarMeta("property", "og:description", texto);

  if (imagen) {
    actualizarMeta("property", "og:image", imagen);
    actualizarMeta("name", "twitter:image", imagen);
  }
}

function actualizarMeta(atributo, clave, contenido) {
  let meta = document.querySelector(`meta[${atributo}="${clave}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(atributo, clave);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", contenido);
}

function obtenerCategoriaNormalizada(prod) {
  const categoria = normalizarTexto(prod?.categoria);

  if (categoria === "buzos") return "abrigos";
  if (categoria === "jeans") return "pantalones";

  return categoria || "catalogo";
}

function etiquetaCategoria(cat) {
  const etiquetas = {
    remeras: "Remeras",
    abrigos: "Abrigos",
    pantalones: "Pantalones",
    gorras: "Gorras",
    medias: "Medias",
    accesorios: "Accesorios",
    catalogo: "Catálogo"
  };

  return etiquetas[cat] || cat;
}

function renderReposicionWhatsapp(prod) {
  const mensaje = `Hola KOVEN! Quería consultar si van a reponer este producto: ${prod.nombre}`;
  const href = `https://wa.me/5493517557401?text=${encodeURIComponent(mensaje)}`;

  return `
    <div class="reposicion-box">
      <p>Consultá reposición por WhatsApp.</p>
      <a href="${href}" target="_blank" rel="noopener">Preguntar disponibilidad</a>
    </div>
  `;
}

function debeMostrarProducto(prod) {
  const valor = normalizarTexto(prod?.mostrar);
  return valor === "" || valor === "true" || valor === "si" || valor === "sí" || valor === "1";
}

function productoAgotado(prod) {
  const estado = normalizarTexto(prod?.estado);
  return estado === "agotado" || estado === "sin stock" || estado === "no disponible";
}

function renderRelacionados(productos, productoActual, categoriaProducto) {
  const relacionados = mezclarLista(productos
    .filter(prod => prod.id != productoActual.id)
    .filter(debeMostrarProducto)
    .filter(prod => obtenerCategoriaNormalizada(prod) === categoriaProducto))
    .slice(0, 4);

  if (!relacionados.length) return "";

  return `
    <section class="relacionados-section" aria-labelledby="relacionados-title">
      <div class="section-heading">
        <span>También puede gustarte</span>
        <h2 class="section-title" id="relacionados-title">Misma categoría</h2>
      </div>
      <div class="productos relacionados-grid">
        ${relacionados.map(renderCardRelacionada).join("")}
      </div>
    </section>
  `;
}

function mezclarLista(lista) {
  return [...lista].sort(() => Math.random() - 0.5);
}

function renderCardRelacionada(prod) {
  const agotado = productoAgotado(prod);
  const imagen = prod.imagenes
    ? prod.imagenes.split(",")[0].trim()
    : "https://via.placeholder.com/300x400?text=Sin+imagen";

  return `
    <div class="producto producto--catalogo ${agotado ? "producto--agotado" : ""}">
      <a href="producto.html?id=${prod.id}" aria-label="Ver ${prod.nombre}">
        <img src="${imagen}" alt="${prod.nombre}">
        ${agotado ? `<span class="producto-badge">Sin stock</span>` : ""}
        <h3>${prod.nombre}</h3>
        <p>$${Number(prod.precio).toLocaleString("es-AR")}</p>
      </a>
    </div>
  `;
}

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
    const esTalleUnico = normalizarTexto(talle) === "único";

    return `
      <div class="opcion-unica">
        <p class="label">Talle</p>
        <span>${texto}</span>
        ${esTalleUnico ? "" : renderConsultaMedidas()}
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
      ${renderConsultaMedidas()}
    </div>
  `;
}

function renderConsultaMedidas() {
  const nombre = productoActual?.nombre || "este producto";
  const mensaje = `Hola KOVEN! Tengo una duda con el talle de ${nombre}. ¿Me pasan medidas?`;
  const href = `https://wa.me/5493517557401?text=${encodeURIComponent(mensaje)}`;

  return `
    <a class="consulta-medidas" href="${href}" target="_blank" rel="noopener">
      ¿Dudás con el talle? Consultanos medidas por WhatsApp.
    </a>
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
    if (MOSTRAR_ULTIMAS_UNIDADES && restante !== Infinity && restante <= 3) {
      mensaje.textContent = restante === 1 ? "Última unidad disponible" : `Últimas ${restante} unidades disponibles`;
    } else {
      mensaje.textContent = restante === Infinity ? "" : `Stock disponible: ${restante}`;
    }
  }
}

function cambiarImagen(src, el, index) {
  const principal = document.getElementById("imgPrincipal");
  if (!principal) return;

  indexActual = index;
  principal.classList.add("cambiando");

  setTimeout(() => {
    principal.src = src;
    principal.onload = () => {
      principal.classList.remove("cambiando");
    };
  }, 120);

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
  const keyProducto = producto.id + "_" + producto.talle + "_" + producto.color;
  const existente = carrito.find(item =>
    item.id + "_" + item.talle + "_" + item.color === keyProducto
  );
  const orderKey = existente?.orderKey || existente?.timestamp || Date.now();

  for (let i = 0; i < cantidadSeleccionada; i++) {
    carrito.push({ ...producto, timestamp: Date.now() + i, orderKey });
  }

  localStorage.setItem("carrito", JSON.stringify(carrito));

  const btn = document.querySelector(".btn-agregar");
  const cantidadAgregada = cantidadSeleccionada;

  btn.textContent = cantidadAgregada > 1 ? `Agregados ${cantidadAgregada} ✓` : "Agregado ✓";
  btn.classList.add("agregado");
  mostrarToastCarrito(cantidadAgregada);
  cantidadSeleccionada = 1;
  actualizarCantidadUI();

  setTimeout(() => {
    btn.classList.remove("agregado");
    actualizarEstadoStock();
  }, 900);

  actualizarContador();
}

actualizarContador();

function abrirModal(index = indexActual) {
  indexActual = Number.isInteger(index) ? index : indexActual;

  const modal = document.getElementById("modal");
  const img = document.getElementById("imgModal");

  img.src = imagenesGlobal[index].trim();
  modal.style.display = "flex";
  actualizarContadorModal();
}

function cerrarModal() {
  document.getElementById("modal").style.display = "none";
}

const modalGaleria = document.getElementById("modal");

if (modalGaleria) {
  modalGaleria.addEventListener("click", (e) => {
    if (e.target === modalGaleria) cerrarModal();
  });
}

function cambiarSlide(dir) {
  indexActual += dir;

  if (indexActual < 0) indexActual = imagenesGlobal.length - 1;
  if (indexActual >= imagenesGlobal.length) indexActual = 0;

  document.getElementById("imgModal").src = imagenesGlobal[indexActual].trim();
  actualizarContadorModal();
}

function actualizarContadorModal() {
  const contador = document.getElementById("modalContador");
  if (!contador) return;

  contador.textContent = `${indexActual + 1} / ${imagenesGlobal.length}`;
}

function mostrarToastCarrito(cantidad) {
  let toast = document.getElementById("toastCarrito");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastCarrito";
    toast.className = "toast-carrito";
    document.body.appendChild(toast);
  }

  toast.textContent = cantidad > 1
    ? `${cantidad} productos agregados al carrito`
    : "Producto agregado al carrito";
  toast.classList.add("visible");

  clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
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

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

const URL = "https://opensheet.elk.sh/11wJ42eVjai6vehi7x7_vysC1ju1pF1oGH_hmwx5NgRY/Hoja1";

let productosGlobal = [];

const categoriaPagina = typeof categoria !== "undefined" ? categoria : "todos";
const tituloFiltroEstilo = typeof categoriaTitulo !== "undefined" ? categoriaTitulo : "Estilo";
const esCatalogoCompleto = typeof catalogoCompleto !== "undefined" && catalogoCompleto;

mostrarCargando();

fetch(URL)
  .then(res => res.json())
  .then(data => {
    productosGlobal = data;

    if (esCatalogoCompleto) {
      construirFiltros();
      aplicarFiltros();
    } else if (categoriaPagina === "todos") {
      const visibles = data.filter(debeMostrarProducto);
      const nuevos = visibles.filter(p => String(p.nuevo).toLowerCase() === "true");
      const destacados = visibles.filter(p => String(p.destacado).toLowerCase() === "true");

      mostrarProductosEn("nuevos-productos", nuevos.length ? nuevos : visibles.slice(0, 6));
      mostrarProductos(destacados.length ? destacados : visibles.slice(4, 8));
    } else {
      construirFiltros();
      aplicarFiltros();
    }
  })
  .catch(() => {
    mostrarError();
  });

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function debeMostrarProducto(prod) {
  const valor = normalizarTexto(prod.mostrar);
  return valor === "" || valor === "true" || valor === "si" || valor === "sí" || valor === "1";
}

function productoAgotado(prod) {
  const estado = normalizarTexto(prod.estado);
  return estado === "agotado" || estado === "sin stock" || estado === "no disponible";
}

function obtenerCategoriaNormalizada(prod) {
  const categoriaProducto = normalizarTexto(prod.categoria);

  if (categoriaProducto === "buzos") return "abrigos";
  if (categoriaProducto === "jeans") return "pantalones";

  return categoriaProducto;
}

function etiquetaCategoria(cat) {
  const etiquetas = {
    remeras: "Remeras",
    abrigos: "Abrigos",
    pantalones: "Pantalones",
    gorras: "Gorras",
    medias: "Medias",
    accesorios: "Accesorios"
  };

  return etiquetas[cat] || cat;
}

function perteneceACategoria(prod) {
  const categoriaProducto = normalizarTexto(prod.categoria);

  if (categoriaPagina === "abrigos") {
    return categoriaProducto === "abrigos" || categoriaProducto === "buzos";
  }

  if (categoriaPagina === "pantalones") {
    return categoriaProducto === "pantalones" || categoriaProducto === "jeans";
  }

  return categoriaProducto === categoriaPagina;
}

function productosDeCategoria() {
  if (categoriaPagina === "todos") {
    return productosGlobal.filter(debeMostrarProducto);
  }

  return productosGlobal.filter(prod => debeMostrarProducto(prod) && perteneceACategoria(prod));
}

function obtenerTalles(prod) {
  const fuente = prod.talles || prod.stock || "";

  if (fuente && !String(fuente).includes(":")) {
    return fuente
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
  }

  if (prod.variantes) {
    return prod.variantes
      .split(",")
      .map(v => v.split(":"))
      .map(partes => partes.length >= 3 ? partes[1] : partes[0])
      .map(t => t.trim())
      .filter(Boolean);
  }

  if (prod.stock && String(prod.stock).includes(":")) {
    return prod.stock
      .split(",")
      .map(v => v.split(":")[0].trim())
      .filter(Boolean);
  }

  return [];
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

function obtenerEstilos(prod) {
  const fuente = prod.estilo || prod.fit || prod.tipo || "";

  return fuente
    .split(",")
    .map(e => e.trim())
    .filter(Boolean);
}

function valoresUnicos(lista) {
  return [...new Set(lista.filter(Boolean))];
}

function ordenarTexto(a, b) {
  return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
}

function ordenarTalles(a, b) {
  const orden = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "40", "42", "44", "46", "48", "U", "ÚNICO", "UNICO"];
  const aNormalizado = String(a).trim().toUpperCase();
  const bNormalizado = String(b).trim().toUpperCase();
  const indexA = orden.indexOf(aNormalizado);
  const indexB = orden.indexOf(bNormalizado);

  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;

  return ordenarTexto(a, b);
}

function construirFiltros() {
  const filtros = document.getElementById("filtros");
  if (!filtros) return;

  const productos = productosDeCategoria();
  const categorias = categoriaPagina === "todos"
    ? valoresUnicos(productos.map(obtenerCategoriaNormalizada)).sort(ordenarTexto)
    : [];
  const talles = valoresUnicos(productos.flatMap(obtenerTalles)).sort(ordenarTalles);
  const estilos = valoresUnicos(productos.flatMap(obtenerEstilos)).sort(ordenarTexto);

  const coloresMap = new Map();
  productos.flatMap(obtenerColores).forEach(color => {
    coloresMap.set(normalizarTexto(color.nombre), color);
  });

  const colores = [...coloresMap.values()].sort((a, b) => ordenarTexto(a.nombre, b.nombre));

  filtros.innerHTML = `
    <div class="filters-header">
      <span>Filtros</span>
      <button type="button" onclick="cerrarFiltros()" aria-label="Cerrar filtros">×</button>
    </div>

    <h3>Ordenar por</h3>
    <select id="ordenar">
      <option value="">Relevancia</option>
      <option value="menor">Precio: menor a mayor</option>
      <option value="mayor">Precio: mayor a menor</option>
    </select>

    ${categorias.length ? `
      <h3>Categoría</h3>
      ${categorias.map(cat => `
        <label class="filtro-item">
          <input type="checkbox" class="filtro-categoria" value="${cat}">
          ${etiquetaCategoria(cat)}
        </label>
      `).join("")}
    ` : ""}

    ${estilos.length ? `
      <h3>${tituloFiltroEstilo}</h3>
      ${estilos.map(estilo => `
        <label class="filtro-item">
          <input type="checkbox" class="filtro-estilo" value="${estilo}">
          ${estilo}
        </label>
      `).join("")}
    ` : ""}

    ${colores.length ? `
      <h3>Color</h3>
      ${colores.map(color => `
        <label class="filtro-item">
          <input type="checkbox" class="filtro-color" value="${color.nombre}">
          <span class="filtro-color-box" style="background:${color.hex || color.nombre}"></span>
          ${color.nombre}
        </label>
      `).join("")}
    ` : ""}

    ${talles.length ? `
      <h3>Talle</h3>
      ${talles.map(talle => `
        <label class="filtro-item">
          <input type="checkbox" class="filtro-talle" value="${talle}">
          ${talle}
        </label>
      `).join("")}
    ` : ""}

    <button type="button" class="btn-aplicar-filtros" onclick="cerrarFiltros()">Aplicar filtros</button>
  `;

  filtros.querySelectorAll("input").forEach(input => {
    input.addEventListener("change", aplicarFiltros);
  });

  const ordenar = document.getElementById("ordenar");
  if (ordenar) ordenar.addEventListener("change", aplicarFiltros);
}

function mostrarProductos(lista) {
  mostrarProductosEn("productos", lista);
}

function mostrarProductosEn(contenedorId, lista) {
  const contenedor = document.getElementById("productos");
  const contenedorPersonalizado = document.getElementById(contenedorId);
  const destino = contenedorPersonalizado || contenedor;
  if (!destino) return;

  destino.innerHTML = "";

  if (!lista.length) {
    destino.innerHTML = `<p class="sin-resultados">Todavía no hay productos para mostrar con esos filtros.</p>`;
    return;
  }

  lista.forEach(prod => {
    const div = document.createElement("div");
    const agotado = productoAgotado(prod);

    div.className = `producto ${categoriaPagina === "todos" ? "producto--featured" : "producto--catalogo"} ${agotado ? "producto--agotado" : ""}`;

    const linkProducto = location.pathname.includes("/pages/")
      ? `../pages/producto.html?id=${prod.id}`
      : `pages/producto.html?id=${prod.id}`;

    div.innerHTML = `
      <a href="${linkProducto}" aria-label="Ver ${prod.nombre}">
        <img src="${
          prod.imagenes
            ? prod.imagenes.split(",")[0].trim()
            : "https://via.placeholder.com/300x400?text=Sin+imagen"
        }" alt="${prod.nombre}">
        ${agotado ? `<span class="producto-badge">Sin stock</span>` : ""}
        <h3>${prod.nombre}</h3>
        <p>$${Number(prod.precio).toLocaleString("es-AR")}</p>
      </a>
    `;

    destino.appendChild(div);
  });
}

function mostrarCargando() {
  const skeleton = Array.from({ length: 4 }, () => `
    <div class="producto-skeleton" aria-hidden="true">
      <div></div>
      <span></span>
      <small></small>
    </div>
  `).join("");

  document.querySelectorAll("#productos, #nuevos-productos").forEach(contenedor => {
    contenedor.innerHTML = skeleton;
  });
}

function mostrarError() {
  const error = `
    <div class="catalogo-estado catalogo-estado--error">
      <h3>No pudimos cargar el catálogo</h3>
      <p>Intentá de nuevo en unos minutos o escribinos por WhatsApp.</p>
      <a href="https://wa.me/5493517557401" target="_blank" rel="noopener">Contactar por WhatsApp</a>
    </div>
  `;

  document.querySelectorAll("#productos, #nuevos-productos").forEach(contenedor => {
    contenedor.innerHTML = error;
  });
}

function filtrar(cat) {
  if (cat === "todos") {
    mostrarProductos(productosGlobal.filter(debeMostrarProducto));
  } else {
    mostrarProductos(productosGlobal.filter(prod => debeMostrarProducto(prod) && perteneceACategoria(prod)));
  }
}

function aplicarFiltros() {
  let filtrados = productosDeCategoria();

  const categoriasSeleccionadas = [...document.querySelectorAll(".filtro-categoria:checked")]
    .map(cb => normalizarTexto(cb.value));

  const tallesSeleccionados = [...document.querySelectorAll(".filtro-talle:checked")]
    .map(cb => cb.value.toUpperCase());

  const coloresSeleccionados = [...document.querySelectorAll(".filtro-color:checked")]
    .map(cb => normalizarTexto(cb.value));

  const estilosSeleccionados = [...document.querySelectorAll(".filtro-estilo:checked")]
    .map(cb => normalizarTexto(cb.value));

  if (categoriasSeleccionadas.length > 0) {
    filtrados = filtrados.filter(p =>
      categoriasSeleccionadas.includes(obtenerCategoriaNormalizada(p))
    );
  }

  if (tallesSeleccionados.length > 0) {
    filtrados = filtrados.filter(p =>
      tallesSeleccionados.some(talle =>
        obtenerTalles(p).map(t => t.toUpperCase()).includes(talle)
      )
    );
  }

  if (coloresSeleccionados.length > 0) {
    filtrados = filtrados.filter(p =>
      coloresSeleccionados.some(color =>
        obtenerColores(p).map(c => normalizarTexto(c.nombre)).includes(color)
      )
    );
  }

  if (estilosSeleccionados.length > 0) {
    filtrados = filtrados.filter(p =>
      estilosSeleccionados.some(estilo =>
        obtenerEstilos(p).map(normalizarTexto).includes(estilo)
      )
    );
  }

  const ordenarSelect = document.getElementById("ordenar");

  if (ordenarSelect) {
    if (ordenarSelect.value === "menor") {
      filtrados.sort((a, b) => Number(a.precio) - Number(b.precio));
    }
    if (ordenarSelect.value === "mayor") {
      filtrados.sort((a, b) => Number(b.precio) - Number(a.precio));
    }
  }

  mostrarProductos(filtrados);
}

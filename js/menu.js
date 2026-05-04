function toggleMenu() {
  const nav = document.querySelector(".nav");
  const button = document.querySelector(".menu-toggle");
  if (!nav) return;

  nav.classList.toggle("activo");

  if (button) {
    button.setAttribute("aria-expanded", nav.classList.contains("activo"));
  }
}

const links = document.querySelectorAll(".nav a");
const current = window.location.pathname;

links.forEach(link => {
  const href = link.getAttribute("href");

  if (current.endsWith(href)) {
    link.classList.add("activo");
  }
});

function toggleFiltros() {
  const filtros = document.getElementById("filtros");
  const overlay = document.querySelector(".filtros-overlay");
  if (!filtros) return;

  filtros.classList.toggle("activo");
  overlay?.classList.toggle("activo", filtros.classList.contains("activo"));
  document.body.classList.toggle("filtros-abiertos", filtros.classList.contains("activo"));
}

function cerrarFiltros() {
  const filtros = document.getElementById("filtros");
  const overlay = document.querySelector(".filtros-overlay");

  filtros?.classList.remove("activo");
  overlay?.classList.remove("activo");
  document.body.classList.remove("filtros-abiertos");
}

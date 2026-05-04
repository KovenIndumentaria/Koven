let cantidadAnterior = null;

function actualizarContador() {
  const contador = document.getElementById("contador-carrito");
  if (!contador) return;

  const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
  const cantidadActual = carrito.length;
  const cantidadAnterior = Number(localStorage.getItem("cantidadAnterior"));

  contador.textContent = cantidadActual;

  if (
    cantidadAnterior !== null &&
    !isNaN(cantidadAnterior) &&
    cantidadAnterior !== cantidadActual
  ) {
    contador.classList.remove("animar");
    void contador.offsetWidth;
    contador.classList.add("animar");

    const icono = document.querySelector(".carrito-icono");

    if (icono) {
      icono.classList.remove("animar");
      void icono.offsetWidth;
      icono.classList.add("animar");

      icono.addEventListener("animationend", () => {
        icono.classList.remove("animar");
      }, { once: true });
    }
  }

  localStorage.setItem("cantidadAnterior", cantidadActual);
}

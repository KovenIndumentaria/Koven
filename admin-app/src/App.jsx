import { useEffect, useState } from "react";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";
import PlaceholderPage from "./pages/PlaceholderPage";
import Products from "./pages/Products";

import { useAuth } from "./context/AuthContext";

const pages = {
  "/": ["Resumen", "Estado general de la tienda y alertas principales."],
  "/productos": ["Productos", "Productos, variantes e imágenes."],
  "/stock": ["Stock", "Existencias y movimientos por variante."],
  "/proveedores": ["Proveedores", "Datos básicos de proveedores."],
  "/compras": ["Compras", "Ingresos de mercadería y costos."],
  "/pedidos": ["Pedidos", "Ventas iniciadas desde la tienda online."],
  "/reportes": ["Reportes", "Indicadores operativos básicos."],
};

function getPath() {
  const path = window.location.hash.slice(1) || "/";
  return pages[path] ? path : "/";
}

export default function App() {
  const { configured, loading, session, isAdmin, signOut } = useAuth();
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const onHashChange = () => setPath(getPath());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (!configured || (!loading && !session)) return <Login />;
  if (loading) return <div className="screen-message">Verificando sesión…</div>;
  if (!isAdmin) {
    return (
      <div className="screen-message unauthorized-message">
        <div>
          <h1>Acceso no autorizado</h1>
          <p>Esta cuenta no pertenece a la administración de KOVEN.</p>
          <button type="button" onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  const [title, description] = pages[path];
  return (
    <AdminLayout currentPath={path}>
      {path === "/productos" ? <Products /> : <PlaceholderPage title={title} description={description} />}
    </AdminLayout>
  );
}

import { lazy, Suspense, useEffect, useState } from "react";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";
const PlaceholderPage = lazy(() => import("./pages/PlaceholderPage"));
const Products = lazy(() => import("./pages/Products"));
const Stock = lazy(() => import("./pages/Stock"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Orders = lazy(() => import("./pages/Orders"));
const Reports = lazy(() => import("./pages/Reports"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const Expenses = lazy(() => import("./pages/Expenses"));
const NewSale = lazy(() => import("./pages/NewSale"));
const Receivables = lazy(() => import("./pages/Receivables"));
const Finance = lazy(() => import("./pages/Finance"));
const Payables = lazy(() => import("./pages/Payables"));
const Audit = lazy(() => import("./pages/Audit"));
const Activity = lazy(() => import("./pages/Activity"));
const Settings = lazy(() => import("./pages/Settings"));

import { useAuth } from "./context/AuthContext";

const pages = {
  "/": ["Resumen", "Estado general de la tienda y alertas principales."],
  "/productos": ["Productos", "Productos, variantes e imágenes."],
  "/stock": ["Stock", "Existencias y movimientos por variante."],
  "/proveedores": ["Proveedores", "Datos básicos de proveedores."],
  "/compras": ["Compras", "Ingresos de mercadería y costos."],
  "/pedidos": ["Pedidos", "Ventas iniciadas desde la tienda online."],
  "/saldos": ["Saldos y cobros", "Seguimiento de pagos pendientes."],
  "/finanzas": ["Finanzas", "Entradas y salidas reales de dinero."],
  "/cuentas-pagar": ["Pagos a proveedores", "Seguimiento de compras pendientes."],
  "/ventas/nueva": ["Nueva venta", "Carga manual de una operación."],
  "/clientes": ["Clientes", "Contactos e historial de compras."],
  "/gastos": ["Gastos", "Egresos operativos de la tienda."],
  "/reportes": ["Reportes", "Indicadores operativos básicos."],
  "/control": ["Control de datos", "Auditoría de integridad y pendientes."],
  "/actividad": ["Actividad", "Historial de acciones administrativas."],
  "/configuracion": ["Configuración", "Datos públicos y reglas de venta."],
};

function getPath() {
  return window.location.hash.slice(1) || "/";
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

  const [title, description] = pages[path] || pages["/"];
  return (
    <AdminLayout currentPath={path}>
      <Suspense fallback={<div className="empty-state">Cargando sección…</div>}>{path === "/" ? <Dashboard /> : path === "/productos" ? <Products /> : path === "/stock" ? <Stock /> : path === "/proveedores" ? <Suppliers /> : path === "/compras" ? <Purchases /> : path === "/pedidos" ? <Orders /> : path === "/saldos" ? <Receivables /> : path === "/ventas/nueva" ? <NewSale /> : path === "/clientes" ? <Customers /> : path === "/finanzas" ? <Finance /> : path === "/cuentas-pagar" ? <Payables /> : path === "/gastos" ? <Expenses /> : path === "/reportes" ? <Reports /> : path === "/control" ? <Audit /> : path === "/actividad" ? <Activity /> : path === "/configuracion" ? <Settings /> : <PlaceholderPage title={title} description={description} />}</Suspense>
    </AdminLayout>
  );
}

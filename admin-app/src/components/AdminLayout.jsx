import { useAuth } from "../context/AuthContext";
import kovenLogo from "../../../assets/img/logo-koven-white.svg";
import reportsIcon from "../../../assets/icons/reports.svg";
import cashRegisterIcon from "../../../assets/icons/cash-register.svg";
import orderPendingIcon from "../../../assets/icons/order-pending.svg";
import paymentIcon from "../../../assets/icons/payment.svg";
import tagsIcon from "../../../assets/icons/tags.svg";
import inventoryIcon from "../../../assets/icons/inventory.svg";
import shippingIcon from "../../../assets/icons/shipping.svg";
import storeIcon from "../../../assets/icons/store.svg";
import financeIcon from "../../../assets/icons/finance.svg";
import cashIcon from "../../../assets/icons/cash.svg";
import minusIcon from "../../../assets/icons/minus.svg";
import customersIcon from "../../../assets/icons/customers.svg";
import checklistIcon from "../../../assets/icons/checklist.svg";
import auditIcon from "../../../assets/icons/audit.svg";
import settingsIcon from "../../../assets/icons/settings.svg";
import logoutIcon from "../../../assets/icons/logout.svg";

const navigation = [
  { label: "Inicio", links: [["/", "Resumen", reportsIcon]] },
  { label: "Ventas", links: [
    ["/ventas/nueva", "Cargar venta", cashRegisterIcon],
    ["/pedidos", "Pedidos", orderPendingIcon],
    ["/saldos", "Saldos y cobros", paymentIcon],
  ] },
  { label: "Inventario", links: [
    ["/productos", "Productos", tagsIcon],
    ["/stock", "Stock", inventoryIcon],
    ["/compras", "Compras", shippingIcon],
    ["/proveedores", "Proveedores", storeIcon],
  ] },
  { label: "Administración", links: [
    ["/finanzas", "Finanzas", financeIcon],
    ["/cuentas-pagar", "Pagos a proveedores", cashIcon],
    ["/gastos", "Gastos", minusIcon],
    ["/clientes", "Clientes", customersIcon],
    ["/reportes", "Reportes", reportsIcon],
    ["/control", "Control de datos", checklistIcon],
    ["/actividad", "Actividad", auditIcon],
    ["/configuracion", "Configuración", settingsIcon],
  ] },
];

export default function AdminLayout({ currentPath, children }) {
  const { session, signOut } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand"><img className="sidebar-logo" src={kovenLogo} alt="KOVEN" /><span>Panel administrativo</span></div>
        </div>
        <nav className="sidebar-scroll" aria-label="Navegación administrativa">
          {navigation.map((section) => <section className="nav-section" key={section.label}>
            <p className="nav-section-label">{section.label}</p>
            <div className="nav-section-links">
              {section.links.map(([to, label, icon]) => <a key={to} href={`#${to}`} className={currentPath === to ? "active" : ""} aria-current={currentPath === to ? "page" : undefined}>
                <span className="nav-icon" aria-hidden="true"><img src={icon} alt="" /></span><span>{label}</span>
              </a>)}
            </div>
          </section>)}
        </nav>
        <div className="session-box">
          <span>Sesión iniciada</span>
          <small>{session?.user?.email}</small>
          <button type="button" onClick={signOut}><img src={logoutIcon} alt="" aria-hidden="true" />Cerrar sesión</button>
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}

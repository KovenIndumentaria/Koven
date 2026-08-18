import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getAlertCount } from "../services/alertsService";
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
import menuIcon from "../../../assets/icons/menu.svg";
import closeIcon from "../../../assets/icons/close.svg";
import warningIcon from "../../../assets/icons/warning.svg";

const navigation = [
  { label: "Inicio", links: [["/", "Resumen", reportsIcon], ["/alertas", "Alertas", warningIcon]] },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => { getAlertCount().then(setAlertCount).catch(() => setAlertCount(0)); }, [currentPath]);

  return (
    <div className="admin-shell">
      {menuOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand"><img className="sidebar-logo" src={kovenLogo} alt="KOVEN" /><span>Panel administrativo</span></div>
          <button className="mobile-menu-button" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenuOpen(!menuOpen)}>
            <img src={menuOpen ? closeIcon : menuIcon} alt="" aria-hidden="true" />
          </button>
        </div>
        <nav className="sidebar-scroll" aria-label="Navegación administrativa">
          {navigation.map((section) => <section className="nav-section" key={section.label}>
            <p className="nav-section-label">{section.label}</p>
            <div className="nav-section-links">
              {section.links.map(([to, label, icon]) => <a key={to} href={`#${to}`} className={currentPath === to ? "active" : ""} aria-current={currentPath === to ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                <span className="nav-icon" aria-hidden="true"><img src={icon} alt="" /></span><span>{label}</span>{to === "/alertas" && alertCount > 0 && <span className="nav-badge" aria-label={`${alertCount} alertas`}>{alertCount > 99 ? "99+" : alertCount}</span>}
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

import { useAuth } from "../context/AuthContext";

const links = [
  ["/", "Resumen"],
  ["/productos", "Productos"],
  ["/stock", "Stock"],
  ["/proveedores", "Proveedores"],
  ["/compras", "Compras"],
  ["/pedidos", "Pedidos"],
  ["/reportes", "Reportes"],
];

export default function AdminLayout({ currentPath, children }) {
  const { session, signOut } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">KOVEN <span>Admin</span></div>
        <nav>
          {links.map(([to, label]) => <a key={to} href={`#${to}`} className={currentPath === to ? "active" : ""}>{label}</a>)}
        </nav>
        <div className="session-box">
          <small>{session?.user?.email}</small>
          <button type="button" onClick={signOut}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}

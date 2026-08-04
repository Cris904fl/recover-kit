import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useMe, useLogout } from "@/hooks/useAuth";
import styles from "./AppShell.module.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/carts", label: "Carts" },
  { to: "/sequences", label: "Sequences" },
  { to: "/analytics", label: "Analytics" },
];

export function AppShell() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>R</div>
          <span className={styles.logoText}>RecoverKit</span>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [styles.navItem, isActive ? styles.active : ""].join(" ")
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.account}>
          <div className={styles.storeBadge}>
            <span className={styles.storeDot} />
            {me?.store.domain ?? "…"}
          </div>
          {me && <div className={styles.userEmail}>{me.email}</div>}
          <button className={styles.logout} onClick={onLogout}>
            Cerrar sesi&oacute;n
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet } from "react-router-dom";
import styles from "./AppShell.module.css";

const links = [
  { to: "/", label: "Início", end: true },
  { to: "/catalogo", label: "Catálogo", end: false },
];

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <NavLink to="/" className={styles.brand} end>
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.brandName}>CifraTrack</span>
        </NavLink>

        <nav className={styles.navLinks} aria-label="Principal">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.linkActive}` : styles.link
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.navActions}>
          <span className={styles.phaseBadge}>Fase 0</span>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

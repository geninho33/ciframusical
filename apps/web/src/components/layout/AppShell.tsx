import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../../features/auth/authStore";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { user, hasRole, logout, loadMe } = useAuthStore();

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const links = [
    { to: "/", label: "Início", end: true, show: true },
    { to: "/catalogo", label: "Catálogo", end: false, show: true },
    { to: "/favoritos", label: "Favoritos", end: false, show: Boolean(user) },
    {
      to: "/criar",
      label: "Criar",
      end: false,
      show: Boolean(user && (hasRole("creator") || hasRole("admin"))),
    },
    {
      to: "/admin/usuarios",
      label: "Admin",
      end: false,
      show: Boolean(user && hasRole("admin")),
    },
  ];

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <NavLink to="/" className={styles.brand} end>
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.brandName}>CifraTrack</span>
        </NavLink>

        <nav className={styles.navLinks} aria-label="Principal">
          {links
            .filter((link) => link.show)
            .map((link) => (
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
          {user ? (
            <>
              <span className={styles.userChip} title={user.email}>
                {user.displayName}
              </span>
              <button type="button" className={styles.textButton} onClick={logout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={styles.textButton}>
                Entrar
              </NavLink>
              <NavLink to="/cadastro" className={styles.ctaButton}>
                Cadastrar
              </NavLink>
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

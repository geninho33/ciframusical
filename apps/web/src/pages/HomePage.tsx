import { Link } from "react-router-dom";
import styles from "./HomePage.module.css";

export function HomePage() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Play-along cifrado</p>
      <h1 className={styles.title}>CifraTrack</h1>
      <p className={styles.lead}>
        Estude, pratique e toque junto com faixas sincronizadas — cifra guiada em
        tempo real, transposição e loop A/B.
      </p>
      <div className={styles.actions}>
        <Link className={styles.ctaPrimary} to="/catalogo">
          Explorar catálogo
        </Link>
        <a
          className={styles.ctaGhost}
          href="https://github.com/geninho33/ciframusical/blob/main/docs/SPEC.md"
          target="_blank"
          rel="noreferrer"
        >
          Ver Spec SDD
        </a>
      </div>
    </section>
  );
}

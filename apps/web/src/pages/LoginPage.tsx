import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/authStore";
import styles from "../features/auth/AuthForm.module.css";
import { ApiError } from "../shared/api/client";

export function LoginPage() {
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Entrar</h1>
      <p className={styles.subtitle}>Acesse seu espaço de prática no CifraTrack.</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          E-mail
          <input
            className={styles.input}
            type="text"
            inputMode="email"
            autoComplete="username"
            required
            placeholder="admin@cifratrack.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          Senha
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <div className={styles.links}>
        <Link to="/cadastro">Criar conta</Link>
        <Link to="/recuperar-senha">Esqueci a senha</Link>
      </div>
    </section>
  );
}

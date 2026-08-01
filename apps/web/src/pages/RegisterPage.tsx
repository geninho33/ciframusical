import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/authStore";
import styles from "../features/auth/AuthForm.module.css";
import { ApiError } from "../shared/api/client";

const betaMode = import.meta.env.VITE_BETA_MODE === "true";

export function RegisterPage() {
  const navigate = useNavigate();
  const { user, register } = useAuthStore();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(email, password, displayName, betaMode ? inviteCode : undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha no cadastro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Criar conta</h1>
      <p className={styles.subtitle}>
        {betaMode
          ? "Beta fechado — cadastro exige código de convite."
          : "Comece como estudante. Um admin pode promover creators."}
      </p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          Nome
          <input
            className={styles.input}
            required
            minLength={2}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          E-mail
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          Senha
          <input
            className={styles.input}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {betaMode ? (
          <label className={styles.label}>
            Código de convite
            <input
              className={styles.input}
              required
              minLength={4}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="one-time-code"
            />
          </label>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Criando…" : "Cadastrar"}
        </button>
      </form>
      <div className={styles.links}>
        <Link to="/login">Já tenho conta</Link>
      </div>
    </section>
  );
}

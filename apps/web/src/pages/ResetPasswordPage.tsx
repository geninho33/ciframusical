import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import styles from "../features/auth/AuthForm.module.css";
import { apiRequest, ApiError } from "../shared/api/client";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Redefinir senha</h1>
      <p className={styles.subtitle}>Cole o token recebido e escolha uma nova senha.</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          Token
          <input
            className={styles.input}
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          Nova senha
          <input
            className={styles.input}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Salvando…" : "Salvar senha"}
        </button>
      </form>
      <div className={styles.links}>
        <Link to="/login">Ir para login</Link>
      </div>
    </section>
  );
}

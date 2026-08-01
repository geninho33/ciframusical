import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import styles from "../features/auth/AuthForm.module.css";
import { apiRequest, ApiError } from "../shared/api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevToken(null);
    try {
      const res = await apiRequest<{ message: string; devResetToken?: string }>(
        "/auth/forgot-password",
        { method: "POST", body: { email } },
      );
      setMessage(res.message);
      if (res.devResetToken) setDevToken(res.devResetToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao solicitar reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Recuperar senha</h1>
      <p className={styles.subtitle}>Enviaremos um token de reset (em dev aparece na tela).</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          E-mail
          <input
            className={styles.input}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p className={styles.success}>{message}</p> : null}
        {devToken ? (
          <p className={styles.success}>
            Token dev: <code>{devToken}</code> — use em{" "}
            <Link to={`/redefinir-senha?token=${devToken}`}>redefinir senha</Link>
          </p>
        ) : null}
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Enviando…" : "Enviar"}
        </button>
      </form>
      <div className={styles.links}>
        <Link to="/login">Voltar ao login</Link>
      </div>
    </section>
  );
}

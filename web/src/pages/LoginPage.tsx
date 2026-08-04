import { useState, type FormEvent } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useLogin } from "@/hooks/useAuth";
import { isAuthenticated } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Ya hay sesion → al dashboard.
  if (isAuthenticated()) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      navigate("/dashboard", { replace: true });
    } catch {
      /* el error se muestra desde login.error */
    }
  }

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? "No se pudo iniciar sesion. Intenta de nuevo."
        : null;

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.brand}>
          <div className={styles.logoMark}>R</div>
          <span className={styles.logoText}>RecoverKit</span>
        </div>
        <h1 className={styles.title}>Inicia sesion</h1>
        <p className={styles.subtitle}>Accede al panel de tu tienda</p>

        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            className={styles.input}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@demo-shop.com"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Contrase&ntilde;a</span>
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {errorMessage && <div className={styles.error}>{errorMessage}</div>}

        <button className={styles.submit} type="submit" disabled={login.isPending}>
          {login.isPending ? "Entrando…" : "Entrar"}
        </button>

        <p className={styles.hint}>
          Cuenta de demo: <code>owner@demo-shop.com</code> / <code>demo1234</code>
        </p>
        <p className={styles.hint}>
          &iquest;No tienes cuenta? <Link to="/register">Reg&iacute;strate</Link>
        </p>
      </form>
    </div>
  );
}

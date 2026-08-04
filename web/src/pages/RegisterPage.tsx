import { useState, type FormEvent } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useRegister } from "@/hooks/useAuth";
import { isAuthenticated } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import styles from "./LoginPage.module.css";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const [storeName, setStoreName] = useState("");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (isAuthenticated()) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await register.mutateAsync({ storeName, domain, email, password });
      navigate("/dashboard", { replace: true });
    } catch {
      /* el error se muestra desde register.error */
    }
  }

  const errorMessage =
    register.error instanceof ApiError
      ? register.error.message
      : register.error
        ? "No se pudo crear la cuenta. Intenta de nuevo."
        : null;

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.brand}>
          <div className={styles.logoMark}>R</div>
          <span className={styles.logoText}>RecoverKit</span>
        </div>
        <h1 className={styles.title}>Crea tu cuenta</h1>
        <p className={styles.subtitle}>Registra tu tienda para empezar</p>

        <label className={styles.field}>
          <span className={styles.label}>Nombre de la tienda</span>
          <input
            className={styles.input}
            type="text"
            required
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Mi Tienda"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Dominio</span>
          <input
            className={styles.input}
            type="text"
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="mitienda.com"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            className={styles.input}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@mitienda.com"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Contrase&ntilde;a (min. 8)</span>
          <input
            className={styles.input}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {errorMessage && <div className={styles.error}>{errorMessage}</div>}

        <button className={styles.submit} type="submit" disabled={register.isPending}>
          {register.isPending ? "Creando…" : "Crear cuenta"}
        </button>

        <p className={styles.hint}>
          &iquest;Ya tienes cuenta? <Link to="/login">Inicia sesi&oacute;n</Link>
        </p>
      </form>
    </div>
  );
}

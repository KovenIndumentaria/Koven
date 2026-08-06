import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { configured, session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (session) {
    window.location.hash = "/";
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: authError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (authError) return setError("No pudimos iniciar sesión. Revisá los datos ingresados.");
    window.location.hash = "/";
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">KOVEN</p>
        <h1>Administración</h1>
        {!configured && <div className="notice">Configurá las variables de Supabase en <code>.env.local</code>.</div>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!configured} /></label>
        <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!configured} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={!configured || submitting}>{submitting ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </main>
  );
}

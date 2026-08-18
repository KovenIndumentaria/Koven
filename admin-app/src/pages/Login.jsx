import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { configured, session, isPasswordRecovery, signIn, requestPasswordReset, updatePassword, finishPasswordRecovery } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (session && !isPasswordRecovery) {
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

  async function handleResetRequest(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (resetError) return setError("No pudimos enviar el correo de recuperación. Revisá el email ingresado.");
    setNotice("Te enviamos un enlace para crear una contraseña nueva. Revisá también la carpeta de spam.");
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden.");
    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);
    if (updateError) return setError("No pudimos actualizar la contraseña. Solicitá un enlace nuevo.");
    finishPasswordRecovery();
    window.location.hash = "/";
  }

  if (isPasswordRecovery) return (
    <main className="login-page">
      <form className="login-card" onSubmit={handlePasswordUpdate}>
        <p className="eyebrow">KOVEN</p>
        <h1>Nueva contraseña</h1>
        <p className="login-description">Elegí una contraseña nueva para el panel administrativo.</p>
        <label>Nueva contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required /></label>
        <label>Repetir contraseña<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="8" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </main>
  );

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={resetMode ? handleResetRequest : handleSubmit}>
        <p className="eyebrow">KOVEN</p>
        <h1>{resetMode ? "Recuperar acceso" : "Administración"}</h1>
        {resetMode && <p className="login-description">Ingresá el email administrador y te enviaremos un enlace seguro.</p>}
        {!configured && <div className="notice">Configurá las variables de Supabase en <code>.env.local</code>.</div>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!configured} /></label>
        {!resetMode && <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={!configured} /></label>}
        {notice && <p className="success-notice login-notice" role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={!configured || submitting}>{submitting ? "Procesando…" : resetMode ? "Enviar enlace" : "Ingresar"}</button>
        <button className="login-link" type="button" onClick={() => { setResetMode(!resetMode); setError(""); setNotice(""); }}>
          {resetMode ? "Volver al inicio de sesión" : "Olvidé mi contraseña"}
        </button>
      </form>
    </main>
  );
}

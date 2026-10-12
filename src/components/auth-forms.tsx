"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { authClient, authErrorMessage, safeNext } from "./auth-client";
import { clearCached } from "./swr-cache";
import { Banner } from "./ui";

/**
 * Navegación completa tras entrar: las rutas protegidas pueden estar precargadas (sin sesión) en la
 * caché del router, y así además se refresca todo lo que depende de la sesión.
 */
/** Tras entrar: fuera lo guardado de otra cuenta y recarga completa. */
function goTo(path: string) {
  clearCached();
  window.location.assign(new URL(path, window.location.origin));
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <label className="field">
      <span className="label">{props.label}</span>
      <input
        required
        type={props.type}
        value={props.value}
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
        className="input"
        style={{ height: 38 }}
      />
    </label>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="panel fade flex flex-col gap-3.5 p-[18px]"
      style={{ ["--d" as string]: "80ms" }}
    >
      <h1 className="h1" style={{ fontSize: 20 }}>
        {title}
      </h1>
      {children}
    </div>
  );
}

function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // Si Google no puede entrar (p. ej. cuenta sin enlazar), de vuelta a /login con `?error=`.
        await authClient.signIn.social({
          provider: "google",
          callbackURL: next,
          errorCallbackURL: `/login?next=${encodeURIComponent(next)}`,
        });
      }}
      className="btn btn-lg w-full"
    >
      <span aria-hidden style={{ fontWeight: 700, color: "var(--color-accent)" }}>
        G
      </span>
      Continuar con Google
    </button>
  );
}

function Divider() {
  return (
    <div className="subtle flex items-center gap-3 text-xs">
      <span className="h-px flex-1 bg-line" />o
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Lo que devuelve Better Auth en `?error=` al volver de Google. */
const OAUTH_ERRORS: Record<string, string> = {
  account_not_linked:
    "Ya tienes una cuenta con el email de tu Google, creada con contraseña. Entra con tu email y contraseña y, en Ajustes, pulsa «Vincular Google»: a partir de ahí podrás entrar con los dos. Si no recuerdas la contraseña, recupérala abajo.",
  email_does_not_match: "El email de Google no coincide con el de tu cuenta.",
  account_already_linked_to_different_user:
    "Esa cuenta de Google ya está vinculada a otro usuario.",
  unable_to_link_account:
    "No se ha podido vincular tu cuenta de Google. Entra con tu email y vincúlala desde Ajustes.",
  access_denied: "Has cancelado el acceso con Google.",
};

export function LoginForm({ google, passwordReset }: { google: boolean; passwordReset: boolean }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const oauthError = params.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError
      ? (OAUTH_ERRORS[oauthError.replace(/ /g, "_")] ??
          "No se ha podido entrar con Google. Prueba otra vez o entra con tu email.")
      : null,
  );
  const [busy, setBusy] = useState(false);

  return (
    <Card title="Entrar">
      {google && (
        <>
          <GoogleButton next={next} />
          <Divider />
        </>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const { error } = await authClient.signIn.email({ email, password });
          setBusy(false);
          if (error) return setError(authErrorMessage(error));
          goTo(next);
        }}
      >
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label="Contraseña"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error && <Banner tone="out">{error}</Banner>}
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <div className="flex flex-col gap-1 text-[13px]">
        <span>
          ¿No tienes cuenta?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`}>Regístrate</Link>
        </span>
        {passwordReset && (
          <Link href="/forgot-password" className="subtle">
            He olvidado la contraseña
          </Link>
        )}
      </div>
    </Card>
  );
}

export function RegisterForm({ google }: { google: boolean }) {
  const next = safeNext(useSearchParams().get("next"), "/collection");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card title="Crear cuenta">
      <p className="muted text-[13px]">
        Tu colección y tus mazos quedan guardados en tu cuenta y puedes entrar desde cualquier
        dispositivo.
      </p>
      {google && (
        <>
          <GoogleButton next={next} />
          <Divider />
        </>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== repeat) return setError("Las contraseñas no coinciden.");
          setBusy(true);
          setError(null);
          const { error } = await authClient.signUp.email({ name: name.trim(), email, password });
          setBusy(false);
          if (error) return setError(authErrorMessage(error));
          goTo(next);
        }}
      >
        <Field label="Nombre" type="text" value={name} onChange={setName} autoComplete="name" />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label="Contraseña (mínimo 8 caracteres)"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />
        <Field
          label="Repite la contraseña"
          type="password"
          value={repeat}
          onChange={setRepeat}
          autoComplete="new-password"
          minLength={8}
        />
        {error && <Banner tone="out">{error}</Banner>}
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
          {busy ? "Creando cuenta…" : "Crear cuenta"}
        </button>
        <p className="subtle text-center text-xs">
          Al crear la cuenta aceptas el <Link href="/legal">aviso legal</Link> y la{" "}
          <Link href="/privacy">política de privacidad</Link>.
        </p>
      </form>
      <span className="text-[13px]">
        ¿Ya tienes cuenta? <Link href={`/login?next=${encodeURIComponent(next)}`}>Entra</Link>
      </span>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title="Recuperar contraseña">
      {sent ? (
        <Banner tone="info">
          Si existe una cuenta con ese email, te hemos enviado un enlace para elegir una contraseña
          nueva. Caduca en 1 hora.
        </Banner>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const { error } = await authClient.requestPasswordReset({
              email,
              redirectTo: "/reset-password",
            });
            setBusy(false);
            if (error) return setError(authErrorMessage(error));
            setSent(true);
          }}
        >
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          {error && <Banner tone="out">{error}</Banner>}
          <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
            {busy ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
      )}
      <Link href="/login" className="text-[13px]">
        Volver a entrar
      </Link>
    </Card>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") ? "El enlace no es válido o ha caducado. Pide otro." : null,
  );

  return (
    <Card title="Nueva contraseña">
      {done ? (
        <Banner tone="info">
          Contraseña cambiada. <Link href="/login">Entra con la nueva</Link>.
        </Banner>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!token) return setError("Falta el token: abre el enlace del email.");
            setBusy(true);
            setError(null);
            const { error } = await authClient.resetPassword({ newPassword: password, token });
            setBusy(false);
            if (error) return setError(authErrorMessage(error));
            setDone(true);
          }}
        >
          <Field
            label="Contraseña nueva (mínimo 8 caracteres)"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
          />
          {error && <Banner tone="out">{error}</Banner>}
          <button type="submit" disabled={busy || !token} className="btn btn-primary btn-lg w-full">
            {busy ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      )}
    </Card>
  );
}

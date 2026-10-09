"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { authClient, authErrorMessage, safeNext } from "./auth-client";
import { Banner } from "./ui";

/**
 * Navegación completa tras entrar: las rutas protegidas pueden estar precargadas (sin sesión) en la
 * caché del router, y así además se refresca todo lo que depende de la sesión.
 */
function goTo(path: string) {
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
        await authClient.signIn.social({ provider: "google", callbackURL: next });
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

export function LoginForm({ google, passwordReset }: { google: boolean; passwordReset: boolean }) {
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
          <Link href={`/registro?next=${encodeURIComponent(next)}`}>Regístrate</Link>
        </span>
        {passwordReset && (
          <Link href="/recuperar" className="subtle">
            He olvidado la contraseña
          </Link>
        )}
      </div>
    </Card>
  );
}

export function RegisterForm({ google }: { google: boolean }) {
  const next = safeNext(useSearchParams().get("next"), "/coleccion");
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
      </form>
      <span className="text-[13px]">
        ¿Ya tienes cuenta? <Link href={`/entrar?next=${encodeURIComponent(next)}`}>Entra</Link>
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
              redirectTo: "/restablecer",
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
      <Link href="/entrar" className="text-[13px]">
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
          Contraseña cambiada. <Link href="/entrar">Entra con la nueva</Link>.
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

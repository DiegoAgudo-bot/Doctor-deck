"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { authClient, authErrorMessage, safeNext } from "./auth-client";
import { Alert, buttonClass } from "./ui";

/**
 * Navegación completa tras entrar: las rutas protegidas pueden estar precargadas (sin sesión) en la
 * caché del router, y así además se refresca todo lo que depende de la sesión.
 */
function goTo(path: string) {
  window.location.assign(new URL(path, window.location.origin));
}

const inputClass =
  "rounded-lg border border-zinc-300 p-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{props.label}</span>
      <input
        required
        type={props.type}
        value={props.value}
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
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
      className={`${buttonClass.secondary} flex items-center justify-center gap-2 py-2`}
    >
      <span aria-hidden className="font-bold text-sky-600">
        G
      </span>
      Continuar con Google
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-500">
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />o
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
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
        {error && <Alert tone="error">{error}</Alert>}
        <button type="submit" disabled={busy} className={buttonClass.primary}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <div className="flex flex-col gap-1 text-sm">
        <span>
          ¿No tienes cuenta?{" "}
          <Link href={`/registro?next=${encodeURIComponent(next)}`} className="underline">
            Regístrate
          </Link>
        </span>
        {passwordReset && (
          <Link href="/recuperar" className="text-zinc-500 underline">
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
      <p className="text-sm text-zinc-500">
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
        {error && <Alert tone="error">{error}</Alert>}
        <button type="submit" disabled={busy} className={buttonClass.primary}>
          {busy ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
      <span className="text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="underline">
          Entra
        </Link>
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
        <Alert tone="info">
          Si existe una cuenta con ese email, te hemos enviado un enlace para elegir una contraseña
          nueva. Caduca en 1 hora.
        </Alert>
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
          {error && <Alert tone="error">{error}</Alert>}
          <button type="submit" disabled={busy} className={buttonClass.primary}>
            {busy ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
      )}
      <Link href="/entrar" className="text-sm underline">
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
        <Alert tone="info">
          Contraseña cambiada.{" "}
          <Link href="/entrar" className="underline">
            Entra con la nueva
          </Link>
          .
        </Alert>
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
          {error && <Alert tone="error">{error}</Alert>}
          <button type="submit" disabled={busy || !token} className={buttonClass.primary}>
            {busy ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      )}
    </Card>
  );
}

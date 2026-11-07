"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { authClient, authErrorMessage, safeNext } from "./auth-client";
import { clearCached } from "./swr-cache";
import { Banner } from "./ui";
import { Link, goTo, useLocale, useLocalePath, useT } from "@/components/i18n";

/**
 * Navegación completa tras entrar: las rutas protegidas pueden estar precargadas (sin sesión) en la
 * caché del router, y así además se refresca todo lo que depende de la sesión.
 */
/** Tras entrar: fuera lo guardado de otra cuenta y recarga completa. */
function goAfterLogin(path: string) {
  clearCached();
  goTo(path);
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
}) {
  // Las contraseñas se pueden ver (así no hace falta escribirlas dos veces).
  const [shown, setShown] = useState(false);
  const t = useT();
  const password = props.type === "password";
  return (
    <label className="field">
      <span className="label">{props.label}</span>
      <span className="relative flex">
        <input
          required={props.required ?? true}
          type={password && shown ? "text" : props.type}
          value={props.value}
          minLength={props.minLength}
          autoComplete={props.autoComplete}
          onChange={(e) => props.onChange(e.target.value)}
          className="input"
          style={{ height: 38, ...(password ? { paddingRight: 64 } : {}) }}
        />
        {password && (
          <button
            type="button"
            className="btn btn-ghost btn-sm absolute"
            style={{ right: 4, top: "50%", transform: "translateY(-50%)" }}
            aria-pressed={shown}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? t("Ocultar", "Hide") : t("Ver", "Show")}
          </button>
        )}
      </span>
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
  const t = useT();
  const lp = useLocalePath();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // Si Google no puede entrar (p. ej. cuenta sin enlazar), de vuelta a /login con `?error=`.
        await authClient.signIn.social({
          provider: "google",
          callbackURL: lp(next),
          errorCallbackURL: lp(`/login?next=${encodeURIComponent(next)}`),
        });
      }}
      className="btn btn-lg w-full"
    >
      <GoogleLogo />
      {t("Continuar con Google", "Continue with Google")}
    </button>
  );
}

/** El logo «G» de Google (sus colores), como piden sus pautas para el botón de acceso. */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function Divider() {
  const t = useT();
  return (
    <div className="subtle flex items-center gap-3 text-xs">
      <span className="h-px flex-1 bg-line" />
      {t("o", "or")}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Lo que devuelve Better Auth en `?error=` al volver de Google. */
const OAUTH_ERRORS: Record<string, [string, string]> = {
  account_not_linked: [
    "Ya tienes una cuenta con el email de tu Google, creada con contraseña. Entra con tu email y contraseña y, en Ajustes, pulsa «Vincular Google»: a partir de ahí podrás entrar con los dos. Si no recuerdas la contraseña, recupérala abajo.",
    "You already have an account with your Google email, created with a password. Sign in with your email and password and, in Settings, tap “Link Google”: from then on you can sign in with either. If you don't remember the password, reset it below.",
  ],
  email_does_not_match: [
    "El email de Google no coincide con el de tu cuenta.",
    "Your Google email doesn't match your account's.",
  ],
  account_already_linked_to_different_user: [
    "Esa cuenta de Google ya está vinculada a otro usuario.",
    "That Google account is already linked to another user.",
  ],
  unable_to_link_account: [
    "No se ha podido vincular tu cuenta de Google. Entra con tu email y vincúlala desde Ajustes.",
    "Couldn't link your Google account. Sign in with your email and link it from Settings.",
  ],
  access_denied: ["Has cancelado el acceso con Google.", "You cancelled the Google sign-in."],
};

export function LoginForm({ google, passwordReset }: { google: boolean; passwordReset: boolean }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const oauthError = params.get("error");
  const t = useT();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError
      ? t(
          ...(OAUTH_ERRORS[oauthError.replace(/ /g, "_")] ?? [
            "No se ha podido entrar con Google. Prueba otra vez o entra con tu email.",
            "Couldn't sign in with Google. Try again or sign in with your email.",
          ]),
        )
      : null,
  );
  const [busy, setBusy] = useState(false);

  return (
    <Card title={t("Entrar", "Sign in")}>
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
          if (error) return setError(authErrorMessage(error, locale));
          goAfterLogin(next);
        }}
      >
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label={t("Contraseña", "Password")}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error && <Banner tone="out">{error}</Banner>}
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
          {busy ? t("Entrando…", "Signing in…") : t("Entrar", "Sign in")}
        </button>
      </form>
      <div className="flex flex-col gap-1 text-[13px]">
        <span>
          {t("¿No tienes cuenta?", "Don't have an account?")}{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`}>
            {t("Regístrate", "Sign up")}
          </Link>
        </span>
        {passwordReset && (
          <Link href="/forgot-password" className="subtle">
            {t("He olvidado la contraseña", "I forgot my password")}
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const locale = useLocale();

  return (
    <Card title={t("Crear cuenta", "Create account")}>
      <p className="muted text-[13px]">
        {t(
          "Tu colección y tus mazos quedan guardados en tu cuenta y puedes entrar desde cualquier dispositivo.",
          "Your collection and decks are saved in your account and you can sign in from any device.",
        )}
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
          setBusy(true);
          setError(null);
          // Sin nombre, el de antes de la @ del email (se puede cambiar en Ajustes).
          const shownName = name.trim() || email.split("@")[0] || email;
          const { error } = await authClient.signUp.email({ name: shownName, email, password });
          setBusy(false);
          if (error) return setError(authErrorMessage(error, locale));
          goAfterLogin(next);
        }}
      >
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label={t("Contraseña (mínimo 8 caracteres)", "Password (at least 8 characters)")}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />
        <Field
          label={t("Nombre (opcional)", "Name (optional)")}
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
          required={false}
        />
        {error && <Banner tone="out">{error}</Banner>}
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
          {busy ? t("Creando cuenta…", "Creating account…") : t("Crear cuenta", "Create account")}
        </button>
        <p className="subtle text-center text-xs">
          {t("Al crear la cuenta aceptas el", "By creating an account you accept the")}{" "}
          <Link href="/legal">{t("aviso legal", "legal notice")}</Link> {t("y la", "and the")}{" "}
          <Link href="/privacy">{t("política de privacidad", "privacy policy")}</Link>.
        </p>
      </form>
      <span className="text-[13px]">
        {t("¿Ya tienes cuenta?", "Already have an account?")}{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`}>{t("Entra", "Sign in")}</Link>
      </span>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const locale = useLocale();
  const lp = useLocalePath();
  return (
    <Card title={t("Recuperar contraseña", "Reset your password")}>
      {sent ? (
        <Banner tone="info">
          {t(
            "Si existe una cuenta con ese email, te hemos enviado un enlace para elegir una contraseña nueva. Caduca en 1 hora.",
            "If an account with that email exists, we've sent you a link to choose a new password. It expires in 1 hour.",
          )}
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
              redirectTo: lp("/reset-password"),
            });
            setBusy(false);
            if (error) return setError(authErrorMessage(error, locale));
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
            {busy ? t("Enviando…", "Sending…") : t("Enviar enlace", "Send link")}
          </button>
        </form>
      )}
      <Link href="/login" className="text-[13px]">
        {t("Volver a entrar", "Back to sign in")}
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
  const t = useT();
  const locale = useLocale();
  const [error, setError] = useState<string | null>(
    params.get("error")
      ? t(
          "El enlace no es válido o ha caducado. Pide otro.",
          "The link isn't valid or has expired. Ask for another one.",
        )
      : null,
  );

  return (
    <Card title={t("Nueva contraseña", "New password")}>
      {done ? (
        <Banner tone="info">
          {t("Contraseña cambiada.", "Password changed.")}{" "}
          <Link href="/login">{t("Entra con la nueva", "Sign in with the new one")}</Link>.
        </Banner>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!token)
              return setError(
                t(
                  "Falta el token: abre el enlace del email.",
                  "Missing token: open the link in the email.",
                ),
              );
            setBusy(true);
            setError(null);
            const { error } = await authClient.resetPassword({ newPassword: password, token });
            setBusy(false);
            if (error) return setError(authErrorMessage(error, locale));
            setDone(true);
          }}
        >
          <Field
            label={t(
              "Contraseña nueva (mínimo 8 caracteres)",
              "New password (at least 8 characters)",
            )}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
          />
          {error && <Banner tone="out">{error}</Banner>}
          <button type="submit" disabled={busy || !token} className="btn btn-primary btn-lg w-full">
            {busy ? t("Guardando…", "Saving…") : t("Guardar contraseña", "Save password")}
          </button>
        </form>
      )}
    </Card>
  );
}

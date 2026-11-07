/** "Chrome en Android", "Safari en iPhone", "App de Android"… a partir del User-Agent. */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Dispositivo desconocido";
  if (/okhttp|expo|doctordeck/i.test(ua)) return "App de Android";
  const os = /android/i.test(ua)
    ? "Android"
    : /iphone|ipad/i.test(ua)
      ? "iPhone"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os/i.test(ua)
          ? "Mac"
          : /linux/i.test(ua)
            ? "Linux"
            : null;
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /firefox|fxios/i.test(ua)
      ? "Firefox"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /safari/i.test(ua)
          ? "Safari"
          : "Navegador";
  return os ? `${browser} en ${os}` : browser;
}

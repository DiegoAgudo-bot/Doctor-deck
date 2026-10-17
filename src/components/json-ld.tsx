/**
 * Datos estructurados (schema.org) para los buscadores. Componente de servidor: se pinta en el
 * HTML. `<` se escapa para que un nombre con `</script>` no cierre la etiqueta.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Migas de pan (Inicio › … › página) con URL absolutas. */
export function breadcrumbs(base: URL, items: [name: string, path: string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: new URL(path, base).toString(),
    })),
  };
}

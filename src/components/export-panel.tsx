"use client";

import { useState } from "react";
import { buttonClass } from "./ui";

export function ExportPanel({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mazo.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        readOnly
        value={text}
        rows={10}
        className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex gap-2">
        <button type="button" onClick={copy} className={buttonClass.secondary}>
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
        <button type="button" onClick={download} className={buttonClass.secondary}>
          Descargar .txt
        </button>
      </div>
    </div>
  );
}

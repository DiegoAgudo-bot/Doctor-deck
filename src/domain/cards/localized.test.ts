import { describe, expect, it } from "vitest";
import {
  betterLocalization,
  deriveKeywordAliases,
  keywordLineParts,
  keywordsFor,
  searchKey,
  stripReminder,
} from "./localized";

const SERRA = {
  keywords: ["Flying", "Vigilance"],
  englishText: "Flying\nVigilance",
};

describe("textos en otros idiomas", () => {
  it("quita el texto recordatorio y normaliza", () => {
    expect(stripReminder("Vuela. (Esta criatura no puede ser bloqueada.)\nVigilancia")).toBe(
      "Vuela.\nVigilancia",
    );
    expect(stripReminder("飛行（このクリーチャーは…）")).toBe("飛行");
    expect(searchKey("Ángel de SERRA")).toBe("angel de serra");
  });

  it("parte la primera línea en habilidades", () => {
    expect(keywordLineParts("Voar, vigilância")).toEqual(["Voar", "vigilância"]);
    expect(keywordLineParts("Vuela. (recordatorio)\nOtra cosa")).toEqual(["Vuela"]);
    expect(keywordLineParts("飛行，警戒")).toEqual(["飛行", "警戒"]);
  });

  it("aprende cómo se dice cada habilidad con las cartas que solo la tienen a ella", () => {
    const vanillaFlyer = {
      keywords: ["Flying"],
      englishText: "Flying",
      localized: [
        { lang: "es", text: "Vuela." },
        { lang: "de", text: "Fliegend" },
        { lang: "ja", text: "飛行" },
      ],
    };
    const aliases = deriveKeywordAliases([
      vanillaFlyer,
      vanillaFlyer,
      {
        ...SERRA,
        englishText: "Flying, vigilance",
        localized: [{ lang: "pt", text: "Voar, vigilância" }],
      },
      {
        ...SERRA,
        englishText: "Flying, vigilance",
        localized: [{ lang: "pt", text: "Voar, vigilância" }],
      },
      // Una frase de reglas no es una habilidad: no se empareja.
      {
        keywords: ["Flying"],
        englishText: "Flying\nWhen this enters, draw a card.",
        localized: [{ lang: "es", text: "Cuando entre, roba una carta y haz muchas cosas más." }],
      },
    ]);
    const say = (keyword: string, lang: string) =>
      aliases.filter((a) => a.keyword === keyword && a.lang === lang).map((a) => a.alias);
    expect(say("Flying", "es")).toEqual(["Vuela"]);
    expect(say("Flying", "de")).toEqual(["Fliegend"]);
    expect(say("Flying", "ja")).toEqual(["飛行"]);
    expect(say("Vigilance", "pt")).toEqual(["vigilância"]);
  });

  it("lo escrito en cualquier idioma → habilidades en inglés", () => {
    const aliases = [
      { keyword: "Flying", alias: "Vuela" },
      { keyword: "Flying", alias: "Fliegend" },
      { keyword: "Flying", alias: "飛行" },
      { keyword: "Trample", alias: "Arrolla" },
    ];
    expect(keywordsFor("vuela", aliases)).toEqual(["Flying"]);
    expect(keywordsFor("volar", aliases)).toEqual(["Flying"]);
    expect(keywordsFor("FLIEG", aliases)).toEqual(["Flying"]);
    expect(keywordsFor("飛行", aliases)).toEqual(["Flying"]);
    expect(keywordsFor("arrollar", aliases)).toEqual(["Trample"]);
    expect(keywordsFor("vínculo vital", [])).toEqual(["Lifelink"]);
    expect(keywordsFor("  ", aliases)).toEqual([]);
  });

  it("de dos impresiones, la que trae tipo y texto o la más nueva", () => {
    const base = { oracleId: "o", lang: "es", name: "Ángel de Serra" };
    const old = { ...base, typeLine: null, text: "Vuela.", releasedAt: "1995-01-01" };
    const full = {
      ...base,
      typeLine: "Criatura — Ángel",
      text: "Vuela.",
      releasedAt: "2010-01-01",
    };
    const newer = { ...full, releasedAt: "2020-01-01" };
    expect(betterLocalization(old, full)).toBe(full);
    expect(betterLocalization(newer, full)).toBe(newer);
  });
});

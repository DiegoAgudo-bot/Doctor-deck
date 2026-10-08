import { describe, expect, it } from "vitest";
import { CsvParseError, csvToRecords, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("separa campos simples", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("respeta comas, comillas escapadas y saltos de línea entre comillas", () => {
    const text = 'Name,Note\n"Ultros, Obnoxious Octopus","dice ""hola""\nadiós"\r\n';
    expect(parseCsv(text)).toEqual([
      ["Name", "Note"],
      ["Ultros, Obnoxious Octopus", 'dice "hola"\nadiós'],
    ]);
  });

  it("ignora BOM y líneas vacías, y acepta un fichero sin salto final", () => {
    expect(parseCsv("﻿a,b\n\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("conserva campos vacíos", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });

  it("falla con comillas sin cerrar", () => {
    expect(() => parseCsv('a\n"abc')).toThrow(CsvParseError);
  });
});

describe("csvToRecords", () => {
  it("usa la cabecera como claves y rellena celdas ausentes", () => {
    const { header, records } = csvToRecords("Name, Quantity\nSol Ring,2\nArcane Signet\n");
    expect(header).toEqual(["Name", "Quantity"]);
    expect(records).toEqual([
      { Name: "Sol Ring", Quantity: "2" },
      { Name: "Arcane Signet", Quantity: "" },
    ]);
  });
});

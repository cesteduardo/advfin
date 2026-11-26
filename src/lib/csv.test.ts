import { describe, expect, it } from "vitest";
import { paraCsv } from "./csv";

describe("CSV", () => {
  it("separa por ponto e vírgula, escapa aspas e quebra de linha, e neutraliza fórmulas", () => {
    const csv = paraCsv([{ a: 'diz "oi"', b: "x;y", c: "=1+1", d: { k: 1 }, e: null }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe('a;b;c;d;e\r\n"diz ""oi""";"x;y";\'=1+1;"{""k"":1}";\r\n');
  });
});

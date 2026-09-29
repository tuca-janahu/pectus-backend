import { describe, expect, it } from "vitest";

import { generateStorageKey } from "../../../../src/modules/storage/key-generator";

describe("generateStorageKey", () => {
  it("prefixa a chave com a pasta informada", () => {
    const key = generateStorageKey("pacientes", "image/jpeg");
    expect(key.startsWith("pacientes/")).toBe(true);
  });

  it("remove barras extras no início/fim da pasta", () => {
    const key = generateStorageKey("/pacientes/", "image/jpeg");
    expect(key.startsWith("pacientes/")).toBe(true);
    expect(key.includes("//")).toBe(false);
  });

  it("usa a extensão correta para content-types conhecidos", () => {
    expect(generateStorageKey("x", "image/jpeg")).toMatch(/\.jpg$/);
    expect(generateStorageKey("x", "image/png")).toMatch(/\.png$/);
    expect(generateStorageKey("x", "video/mp4")).toMatch(/\.mp4$/);
  });

  it("não adiciona extensão para content-type desconhecido", () => {
    const key = generateStorageKey("x", "application/octet-stream");
    expect(key).not.toContain(".");
  });

  it("gera chaves diferentes a cada chamada", () => {
    const a = generateStorageKey("pacientes", "image/jpeg");
    const b = generateStorageKey("pacientes", "image/jpeg");
    expect(a).not.toBe(b);
  });
});

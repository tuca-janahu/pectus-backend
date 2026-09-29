import { describe, expect, it } from "vitest";

import { NoopStorage } from "../../../../src/modules/storage/noop-storage";

describe("NoopStorage", () => {
  it("upload resolve com uma chave dentro da pasta informada", async () => {
    const storage = new NoopStorage();
    const { key } = await storage.upload({ folder: "pacientes", body: Buffer.from("x"), contentType: "image/jpeg" });
    expect(key.startsWith("pacientes/")).toBe(true);
  });

  it("getReadUrl resolve sem lançar", async () => {
    const storage = new NoopStorage();
    const url = await storage.getReadUrl({ key: "pacientes/abc.jpg" });
    expect(url).toBe("");
  });

  it("delete resolve sem lançar", async () => {
    const storage = new NoopStorage();
    await expect(storage.delete("pacientes/abc.jpg")).resolves.toBeUndefined();
  });
});

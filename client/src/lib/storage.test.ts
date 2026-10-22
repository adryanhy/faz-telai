import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./quality";
import { loadName, loadSettings, saveName, saveSettings } from "./storage";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("storage", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("guarda e lê o apelido", () => {
    expect(loadName()).toBe("");
    saveName("Bia");
    expect(loadName()).toBe("Bia");
  });

  it("guarda e lê as configurações de compartilhamento", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    saveSettings({ mode: "browser", resolution: "720p", audio: false });
    expect(loadSettings()).toEqual({ mode: "browser", resolution: "720p", audio: false });
  });

  it("troca valores desconhecidos pelos padrões, campo a campo", () => {
    vi.stubGlobal(
      "localStorage",
      memoryStorage({ "faz-telai:share-settings": JSON.stringify({ mode: "4k", resolution: "720p", audio: "sim" }) }),
    );
    expect(loadSettings()).toEqual({ mode: DEFAULT_SETTINGS.mode, resolution: "720p", audio: DEFAULT_SETTINGS.audio });
  });

  it.each([
    ["JSON quebrado", "{nao é json"],
    ["null", "null"],
  ])("volta pros padrões com %s salvo", (_caso, saved) => {
    vi.stubGlobal("localStorage", memoryStorage({ "faz-telai:share-settings": saved }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("não quebra quando o localStorage lança erro (aba anônima, cookies bloqueados)", () => {
    const failing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    vi.stubGlobal("localStorage", failing);

    expect(loadName()).toBe("");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveName("Bia")).not.toThrow();
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});

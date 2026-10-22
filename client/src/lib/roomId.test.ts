import { describe, expect, it } from "vitest";
import { isValidRoomId } from "@faz-telai/shared";
import { generateRoomId, parseRoomInput } from "./roomId";

describe("generateRoomId", () => {
  it("gera códigos válidos no formato animal-traço-sufixo", () => {
    for (let i = 0; i < 200; i++) {
      const roomId = generateRoomId();
      expect(isValidRoomId(roomId)).toBe(true);
      expect(roomId).toMatch(/^[a-z]+-[a-z]+-[a-z0-9]{4}$/);
    }
  });

  it("praticamente não repete (o sufixo aleatório evita adivinhar salas)", () => {
    const ids = new Set(Array.from({ length: 500 }, generateRoomId));
    expect(ids.size).toBeGreaterThan(495);
  });
});

describe("parseRoomInput", () => {
  it("aceita o código puro", () => {
    expect(parseRoomInput("capivara-turbo-k7q2")).toBe("capivara-turbo-k7q2");
  });

  it("aceita o link inteiro, com ou sem query e hash", () => {
    expect(parseRoomInput("https://faz-telai.onrender.com/sala/tatu-zen-ab12")).toBe("tatu-zen-ab12");
    expect(parseRoomInput("http://localhost:5173/sala/tatu-zen-ab12?x=1#y")).toBe("tatu-zen-ab12");
  });

  it("ignora espaços e maiúsculas", () => {
    expect(parseRoomInput("  Tatu-Zen-AB12  ")).toBe("tatu-zen-ab12");
  });

  it("retorna null pra entrada inválida", () => {
    expect(parseRoomInput("")).toBeNull();
    expect(parseRoomInput("oi")).toBeNull();
    expect(parseRoomInput("https://exemplo.com/outra/coisa")).toBeNull();
  });
});

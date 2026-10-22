import { describe, expect, it } from "vitest";
import { isValidRoomId, NAME_MAX_LENGTH, normalizeName } from "./index";

describe("isValidRoomId", () => {
  it.each(["capivara-turbo-k7q2", "abc", "sala-123", "a".repeat(32)])("aceita %s", (roomId) => {
    expect(isValidRoomId(roomId)).toBe(true);
  });

  it.each([
    ["curto demais", "ab"],
    ["longo demais", "a".repeat(33)],
    ["maiúsculas", "Capivara"],
    ["espaço", "sala 1"],
    ["barra", "sala/1"],
    ["acento", "jacaré"],
    ["vazio", ""],
  ])("recusa código com %s", (_motivo, roomId) => {
    expect(isValidRoomId(roomId)).toBe(false);
  });

  it("recusa o que não é texto", () => {
    expect(isValidRoomId(undefined)).toBe(false);
    expect(isValidRoomId(123)).toBe(false);
    expect(isValidRoomId({ roomId: "abc" })).toBe(false);
  });
});

describe("normalizeName", () => {
  it("remove espaços nas pontas e junta espaços repetidos", () => {
    expect(normalizeName("  Amigo   da   Silva  ")).toBe("Amigo da Silva");
  });

  it("corta no tamanho máximo", () => {
    expect(normalizeName("x".repeat(100))).toHaveLength(NAME_MAX_LENGTH);
  });

  it("retorna vazio pra nome só com espaços ou que não é texto", () => {
    expect(normalizeName("    ")).toBe("");
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(42)).toBe("");
  });
});

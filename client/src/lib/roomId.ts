import { isValidRoomId } from "@faz-telai/shared";

const ANIMALS = ["capivara", "tatu", "jabuti", "tucano", "mico", "lontra", "quati", "sagui", "jacare", "arara"];
const TRAITS = ["turbo", "ninja", "brabo", "sonolento", "veloz", "lendario", "zen", "caotico", "raiz", "nutella"];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/**
 * Gera códigos tipo "capivara-turbo-k7q2". O sufixo aleatório (1,6 milhão de combinações)
 * existe porque o site fica público: sem ele dava pra adivinhar salas testando nomes.
 */
export function generateRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = [...bytes].map((byte) => (byte % 36).toString(36)).join("");
  return `${pick(ANIMALS)}-${pick(TRAITS)}-${suffix}`;
}

/** Aceita tanto o código puro quanto o link inteiro colado pelo amigo. */
export function parseRoomInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const fromLink = trimmed.match(/\/sala\/([^/?#]+)/)?.[1];
  const candidate = fromLink ?? trimmed;
  return isValidRoomId(candidate) ? candidate : null;
}

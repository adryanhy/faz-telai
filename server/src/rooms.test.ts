import { describe, expect, it } from "vitest";
import { MAX_PARTICIPANTS, type Participant } from "@faz-telai/shared";
import { RoomStore } from "./rooms";

const person = (id: string): Participant => ({ id, name: id, joinedAt: 0, sharing: false });

describe("RoomStore", () => {
  it("cria a sala na primeira entrada e retorna quem já estava", () => {
    const rooms = new RoomStore();
    expect(rooms.join("sala", person("a"))).toEqual([]);
    expect(rooms.join("sala", person("b"))).toEqual([person("a")]);
    expect(rooms.stats()).toEqual({ rooms: 1, participants: 2 });
  });

  it("recusa quando a sala está cheia", () => {
    const rooms = new RoomStore();
    for (let i = 0; i < MAX_PARTICIPANTS; i++) rooms.join("sala", person(`p${i}`));
    expect(rooms.join("sala", person("extra"))).toBe("room-full");
    expect(rooms.has("sala", "extra")).toBe(false);
  });

  it("apaga a sala quando a última pessoa sai", () => {
    const rooms = new RoomStore();
    rooms.join("sala", person("a"));
    rooms.join("sala", person("b"));

    expect(rooms.leave("sala", "a")).toBe(true);
    expect(rooms.stats()).toEqual({ rooms: 1, participants: 1 });
    expect(rooms.leave("sala", "b")).toBe(true);
    expect(rooms.stats()).toEqual({ rooms: 0, participants: 0 });
  });

  it("sair de quem não está na sala retorna false", () => {
    const rooms = new RoomStore();
    expect(rooms.leave("nenhuma", "a")).toBe(false);
    rooms.join("sala", person("a"));
    expect(rooms.leave("sala", "b")).toBe(false);
  });

  it("salas são independentes", () => {
    const rooms = new RoomStore();
    rooms.join("sala-1", person("a"));
    rooms.join("sala-2", person("b"));
    expect(rooms.has("sala-1", "a")).toBe(true);
    expect(rooms.has("sala-1", "b")).toBe(false);
  });

  it("marca e desmarca quem está compartilhando", () => {
    const rooms = new RoomStore();
    rooms.join("sala", person("a"));
    expect(rooms.setSharing("sala", "a", true)).toMatchObject({ id: "a", sharing: true });
    expect(rooms.setSharing("sala", "a", false)).toMatchObject({ id: "a", sharing: false });
    expect(rooms.setSharing("sala", "fantasma", true)).toBeUndefined();
  });
});

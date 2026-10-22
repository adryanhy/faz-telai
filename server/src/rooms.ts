import { MAX_PARTICIPANTS, type Participant } from "@faz-telai/shared";

/**
 * Guarda em memória quem está em cada sala.
 * Salas nascem quando a primeira pessoa entra e somem quando a última sai,
 * então não existe "criar sala" no servidor: o link já é a sala.
 */
export class RoomStore {
  private rooms = new Map<string, Map<string, Participant>>();

  /** Adiciona o participante e retorna quem já estava na sala antes dele. */
  join(roomId: string, participant: Participant): Participant[] | "room-full" {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Map();
      this.rooms.set(roomId, room);
    }
    if (room.size >= MAX_PARTICIPANTS) return "room-full";

    const others = [...room.values()];
    room.set(participant.id, participant);
    return others;
  }

  /** Remove o participante. Retorna false se ele não estava na sala. */
  leave(roomId: string, participantId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room?.delete(participantId)) return false;
    if (room.size === 0) this.rooms.delete(roomId);
    return true;
  }

  has(roomId: string, participantId: string): boolean {
    return this.rooms.get(roomId)?.has(participantId) ?? false;
  }

  /** Marca se o participante está compartilhando. Retorna o participante atualizado. */
  setSharing(roomId: string, participantId: string, sharing: boolean): Participant | undefined {
    const participant = this.rooms.get(roomId)?.get(participantId);
    if (participant) participant.sharing = sharing;
    return participant;
  }

  stats() {
    let participants = 0;
    for (const room of this.rooms.values()) participants += room.size;
    return { rooms: this.rooms.size, participants };
  }
}

// Реестр комнат: создание, вход/выход игроков, grace-удаление пустых комнат (SPEC.md §2.5, §4.5).

import {
  MAX_PLAYERS,
  PLAYER_COLORS,
  PLAYER_NAME_MAX,
  ROOM_ID_ALPHABET,
  ROOM_ID_LENGTH,
} from "@multialchemy/shared";
import type { Player, RoomState } from "@multialchemy/shared";

export const ROOM_STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PersistedRoom {
  roomId: string;
  unlockedElements: string[];
  boardInstances: RoomState["boardInstances"];
  updatedAt: number;
}

function generateRoomId(): string {
  let id = "";
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
  }
  return id;
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private roomUpdatedAt = new Map<string, number>();
  private socketRooms = new Map<string, string>();

  constructor(
    private baseElementIds: string[],
    persistedRooms: PersistedRoom[] = [],
    private onChange: () => void = () => {},
  ) {
    const now = Date.now();
    for (const persisted of persistedRooms) {
      if (now - persisted.updatedAt > ROOM_STORAGE_TTL_MS) continue;
      this.rooms.set(persisted.roomId, {
        roomId: persisted.roomId,
        players: {},
        unlockedElements: persisted.unlockedElements,
        boardInstances: Object.fromEntries(
          Object.entries(persisted.boardInstances).map(([id, instance]) => [
            id,
            { ...instance, lockedBy: null },
          ]),
        ),
      });
      this.roomUpdatedAt.set(persisted.roomId, persisted.updatedAt);
    }
  }

  createRoom(): RoomState {
    let roomId: string;
    do {
      roomId = generateRoomId();
    } while (this.rooms.has(roomId));

    const room: RoomState = {
      roomId,
      players: {},
      unlockedElements: [...this.baseElementIds],
      boardInstances: {},
    };
    this.rooms.set(roomId, room);
    this.touchRoom(roomId);
    return room;
  }

  getRoom(roomId: string): RoomState | undefined {
    this.pruneExpiredRooms();
    return this.rooms.get(roomId);
  }

  getRoomBySocket(socketId: string): RoomState | undefined {
    const roomId = this.socketRooms.get(socketId);
    return roomId !== undefined ? this.rooms.get(roomId) : undefined;
  }

  getAllRooms(): IterableIterator<RoomState> {
    this.pruneExpiredRooms();
    return this.rooms.values();
  }

  /** Возвращает созданного Player или null, если комната полна. */
  addPlayer(roomId: string, socketId: string, name: string): Player | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (Object.keys(room.players).length >= MAX_PLAYERS) return null;

    const player: Player = {
      socketId,
      name: name.slice(0, PLAYER_NAME_MAX),
      color: PLAYER_COLORS[Object.keys(room.players).length % PLAYER_COLORS.length]!,
      cursor: { x: 0, y: 0 },
    };
    room.players[socketId] = player;
    this.socketRooms.set(socketId, roomId);
    this.touchRoom(roomId);
    return player;
  }

  removePlayer(socketId: string): RoomState | undefined {
    const room = this.getRoomBySocket(socketId);
    if (!room) return undefined;

    delete room.players[socketId];
    this.socketRooms.delete(socketId);
    this.touchRoom(room.roomId);

    return room;
  }

  touchRoom(roomId: string): void {
    if (!this.rooms.has(roomId)) return;
    this.roomUpdatedAt.set(roomId, Date.now());
    this.onChange();
  }

  getPersistedRooms(): PersistedRoom[] {
    this.pruneExpiredRooms();
    return [...this.rooms.values()].map((room) => ({
      roomId: room.roomId,
      unlockedElements: room.unlockedElements,
      boardInstances: Object.fromEntries(
        Object.entries(room.boardInstances).map(([id, instance]) => [
          id,
          { ...instance, lockedBy: null },
        ]),
      ),
      updatedAt: this.roomUpdatedAt.get(room.roomId) ?? Date.now(),
    }));
  }

  pruneExpiredRooms(now = Date.now()): void {
    let changed = false;
    for (const [roomId, room] of this.rooms) {
      if (Object.keys(room.players).length > 0) continue;
      const updatedAt = this.roomUpdatedAt.get(roomId) ?? now;
      if (now - updatedAt <= ROOM_STORAGE_TTL_MS) continue;
      this.rooms.delete(roomId);
      this.roomUpdatedAt.delete(roomId);
      changed = true;
    }
    if (changed) this.onChange();
  }
}

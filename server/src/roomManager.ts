// Реестр комнат: создание, вход/выход игроков, grace-удаление пустых комнат (SPEC.md §2.5, §4.5).

import {
  MAX_PLAYERS,
  PLAYER_COLORS,
  PLAYER_NAME_MAX,
  ROOM_GRACE_MS,
  ROOM_ID_ALPHABET,
  ROOM_ID_LENGTH,
} from "@multialchemy/shared";
import type { Player, RoomState } from "@multialchemy/shared";

function generateRoomId(): string {
  let id = "";
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
  }
  return id;
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private graceTimers = new Map<string, NodeJS.Timeout>();
  private socketRooms = new Map<string, string>();

  constructor(private baseElementIds: string[]) {}

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
    return room;
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  getRoomBySocket(socketId: string): RoomState | undefined {
    const roomId = this.socketRooms.get(socketId);
    return roomId !== undefined ? this.rooms.get(roomId) : undefined;
  }

  getAllRooms(): IterableIterator<RoomState> {
    return this.rooms.values();
  }

  /** Возвращает созданного Player или null, если комната полна. */
  addPlayer(roomId: string, socketId: string, name: string): Player | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (Object.keys(room.players).length >= MAX_PLAYERS) return null;

    const timer = this.graceTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.graceTimers.delete(roomId);
    }

    const player: Player = {
      socketId,
      name: name.slice(0, PLAYER_NAME_MAX),
      color: PLAYER_COLORS[Object.keys(room.players).length % PLAYER_COLORS.length]!,
      cursor: { x: 0, y: 0 },
    };
    room.players[socketId] = player;
    this.socketRooms.set(socketId, roomId);
    return player;
  }

  removePlayer(socketId: string): RoomState | undefined {
    const room = this.getRoomBySocket(socketId);
    if (!room) return undefined;

    delete room.players[socketId];
    this.socketRooms.delete(socketId);

    if (Object.keys(room.players).length === 0) {
      const timer = setTimeout(() => {
        this.graceTimers.delete(room.roomId);
        // Комнату удаляем, только если за grace-период никто не вошёл
        if (Object.keys(room.players).length === 0) {
          this.rooms.delete(room.roomId);
        }
      }, ROOM_GRACE_MS);
      this.graceTimers.set(room.roomId, timer);
    }
    return room;
  }
}

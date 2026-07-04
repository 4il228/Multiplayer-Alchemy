// Игровая логика доски: спавн, локи, драг, крафт, очистка. Заполняется в фазе S2.

import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import type {
  BoardInstance,
  ClientToServerEvents,
  Element,
  Recipe,
  RoomState,
  ServerToClientEvents,
} from "@multialchemy/shared";
import { BOARD_LIMIT, CLEAR_COOLDOWN_MS, HITBOX_RADIUS } from "@multialchemy/shared";
import type { RoomManager } from "./roomManager";

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface GameContext {
  roomManager: RoomManager;
  elementsById: Map<string, Element>;
  recipes: Map<string, Recipe>;
}

// Буфер инкрементальных изменений драга на комнату (рассылается 20 Гц через flushBoardUpdates)
const dragBuffers = new Map<string, { [instanceId: string]: Partial<BoardInstance> }>();
// Метка последней очистки доски на комнату (cooldown board:clear)
const lastClearAt = new Map<string, number>();

function bufferOf(roomId: string): { [instanceId: string]: Partial<BoardInstance> } {
  let buf = dragBuffers.get(roomId);
  if (!buf) {
    buf = {};
    dragBuffers.set(roomId, buf);
  }
  return buf;
}

/** Рассылает накопленные изменения драга комнаты как board:update_instances. */
export function flushBoardUpdates(io: TypedServer, room: RoomState): void {
  const buf = dragBuffers.get(room.roomId);
  if (!buf || Object.keys(buf).length === 0) return;
  io.to(room.roomId).emit("board:update_instances", buf);
  dragBuffers.set(room.roomId, {});
}

export function registerBoardHandlers(io: TypedServer, socket: TypedSocket, ctx: GameContext): void {
  const { roomManager, recipes } = ctx;

  socket.on("element:spawn", ({ elementId, x, y }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    // Спавн только открытых комнатой элементов (SPEC §4.2)
    if (!room.unlockedElements.includes(elementId)) return;

    // Лимит доски: вытесняем самый старый незалоченный инстанс (SPEC §4.4)
    if (Object.keys(room.boardInstances).length >= BOARD_LIMIT) {
      let oldest: BoardInstance | null = null;
      for (const inst of Object.values(room.boardInstances)) {
        if (inst.lockedBy !== null) continue;
        if (!oldest || inst.createdAt < oldest.createdAt) oldest = inst;
      }
      if (!oldest) return; // все залочены — спавн отклоняется
      delete room.boardInstances[oldest.id];
      delete bufferOf(room.roomId)[oldest.id];
      io.to(room.roomId).emit("board:removed", { instanceIds: [oldest.id] });
    }

    const instance: BoardInstance = {
      id: randomUUID(),
      elementId,
      x,
      y,
      lockedBy: null,
      createdAt: Date.now(),
    };
    room.boardInstances[instance.id] = instance;
    io.to(room.roomId).emit("element:spawned", instance);
  });

  socket.on("element:lock", ({ instanceId }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    const instance = room?.boardInstances[instanceId];
    if (!room || !instance) return;

    if (instance.lockedBy !== null && instance.lockedBy !== socket.id) {
      socket.emit("element:lock_denied", { instanceId });
      return;
    }
    instance.lockedBy = socket.id;
    io.to(room.roomId).emit("element:locked", { instanceId, lockedBy: socket.id });
  });

  socket.on("element:drag", ({ instanceId, x, y }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    const instance = room?.boardInstances[instanceId];
    if (!room || !instance) return;
    if (instance.lockedBy !== socket.id) return; // только владелец лока (SPEC §4.2)

    instance.x = x;
    instance.y = y;
    bufferOf(room.roomId)[instanceId] = { x, y };
  });

  socket.on("element:release", ({ instanceId, x, y }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    const instance = room?.boardInstances[instanceId];
    if (!room || !instance) return;
    if (instance.lockedBy !== socket.id) return;

    instance.x = x;
    instance.y = y;
    instance.lockedBy = null;
    io.to(room.roomId).emit("element:unlocked", { instanceId });

    // Поиск ближайшего незалоченного соседа с дистанцией центров < 2R (SPEC §4.1)
    let nearest: BoardInstance | null = null;
    let nearestDist = Infinity;
    for (const other of Object.values(room.boardInstances)) {
      if (other.id === instanceId || other.lockedBy !== null) continue;
      const dist = Math.hypot(other.x - x, other.y - y);
      if (dist < 2 * HITBOX_RADIUS && dist < nearestDist) {
        nearest = other;
        nearestDist = dist;
      }
    }
    if (!nearest) return;

    const recipeKey = [instance.elementId, nearest.elementId].sort().join(":");
    const recipe = recipes.get(recipeKey);
    if (!recipe) {
      io.to(room.roomId).emit("craft:fail", { instanceId1: instanceId, instanceId2: nearest.id });
      return;
    }

    // Атомарно: удалить ингредиенты, создать результат в середине отрезка
    delete room.boardInstances[instanceId];
    delete room.boardInstances[nearest.id];
    const buf = bufferOf(room.roomId);
    delete buf[instanceId];
    delete buf[nearest.id];

    const newInstance: BoardInstance = {
      id: randomUUID(),
      elementId: recipe.result,
      x: (instance.x + nearest.x) / 2,
      y: (instance.y + nearest.y) / 2,
      lockedBy: null,
      createdAt: Date.now(),
    };
    room.boardInstances[newInstance.id] = newInstance;

    const isNewDiscovery = !room.unlockedElements.includes(recipe.result);
    if (isNewDiscovery) room.unlockedElements.push(recipe.result);

    io.to(room.roomId).emit("craft:success", {
      newInstance,
      destroyedIds: [instanceId, nearest.id],
      isNewDiscovery,
      discoveredBy: room.players[socket.id]?.name ?? "",
    });
  });

  socket.on("board:clear", () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    const now = Date.now();
    const last = lastClearAt.get(room.roomId) ?? 0;
    if (now - last < CLEAR_COOLDOWN_MS) return; // cooldown на комнату (SPEC §4.4)
    lastClearAt.set(room.roomId, now);

    room.boardInstances = {};
    dragBuffers.set(room.roomId, {});
    io.to(room.roomId).emit("board:cleared");
  });
}

// Точка входа сервера: Fastify + Socket.io, комнаты, курсоры (фаза S1).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { Server } from "socket.io";
import { SERVER_BATCH_HZ } from "@multialchemy/shared";
import type {
  ClientToServerEvents,
  Element,
  Recipe,
  RoomStatePayload,
  ServerToClientEvents,
} from "@multialchemy/shared";
import { RoomManager } from "./roomManager";
import { flushBoardUpdates, maybeSendHints, registerBoardHandlers } from "./gameLogic";
import type { GameContext } from "./gameLogic";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "data");
const elements: Element[] = JSON.parse(readFileSync(join(dataDir, "elements.json"), "utf-8"));
const recipeList: Recipe[] = JSON.parse(readFileSync(join(dataDir, "recipes.json"), "utf-8"));
const hints: { [elementId: string]: string } = JSON.parse(
  readFileSync(join(dataDir, "hints.json"), "utf-8"),
);

const elementsById = new Map(elements.map((e) => [e.id, e]));
const recipes = new Map(recipeList.map((r) => [r.id, r]));
const baseElementIds = elements.filter((e) => e.isBase).map((e) => e.id);

const roomManager = new RoomManager(baseElementIds);
const ctx: GameContext = { roomManager, elementsById, recipes, hintsById: new Map(Object.entries(hints)) };

const app = Fastify();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  cors: { origin: true },
});

function buildRoomStatePayload(roomId: string): RoomStatePayload | undefined {
  const room = roomManager.getRoom(roomId);
  if (!room) return undefined;
  return { ...room, elements, totalElements: elements.length };
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ playerName }) => {
    const room = roomManager.createRoom();
    roomManager.addPlayer(room.roomId, socket.id, playerName);
    socket.join(room.roomId);
    socket.emit("room:state", buildRoomStatePayload(room.roomId)!);
  });

  socket.on("room:join", ({ roomId, playerName }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { code: "NOT_FOUND", message: `Комната ${roomId} не найдена` });
      return;
    }
    const player = roomManager.addPlayer(roomId, socket.id, playerName);
    if (!player) {
      socket.emit("room:error", { code: "FULL", message: `Комната ${roomId} заполнена` });
      return;
    }
    socket.join(roomId);
    socket.emit("room:state", buildRoomStatePayload(roomId)!);
    socket.to(roomId).emit("room:player_joined", player);
  });

  socket.on("cursor:move", ({ x, y }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    const player = room?.players[socket.id];
    if (!player) return;
    player.cursor = { x, y };
  });

  socket.on("disconnect", () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    // Снять локи ушедшего игрока
    for (const instance of Object.values(room.boardInstances)) {
      if (instance.lockedBy === socket.id) {
        instance.lockedBy = null;
        io.to(room.roomId).emit("element:unlocked", { instanceId: instance.id });
      }
    }

    roomManager.removePlayer(socket.id);
    io.to(room.roomId).emit("room:player_left", { socketId: socket.id });
  });

  registerBoardHandlers(io, socket, ctx);
});

// Батч-рассылка курсоров по активным комнатам (SPEC.md §4.4)
setInterval(() => {
  for (const room of roomManager.getAllRooms()) {
    const socketIds = Object.keys(room.players);
    if (socketIds.length === 0) continue;
    const cursors: { [socketId: string]: { x: number; y: number } } = {};
    for (const id of socketIds) {
      cursors[id] = room.players[id]!.cursor;
    }
    io.to(room.roomId).emit("room:sync_cursors", cursors);
    flushBoardUpdates(io, room);
  }
}, 1000 / SERVER_BATCH_HZ);

// Подсказки комнатам, которые минуту не открывали ничего нового
setInterval(() => maybeSendHints(io, ctx), 5_000);

const PORT = 3001;
app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Игровая логика доски: спавн, локи, драг, крафт, очистка. Заполняется в фазе S2.

import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, Element, Recipe, ServerToClientEvents } from "@multialchemy/shared";
import type { RoomManager } from "./roomManager";

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface GameContext {
  roomManager: RoomManager;
  elementsById: Map<string, Element>;
  recipes: Map<string, Recipe>;
}

export function registerBoardHandlers(io: TypedServer, socket: TypedSocket, ctx: GameContext): void {
  // S2: обработчики element:spawn, element:lock, element:drag, element:release, board:clear
}

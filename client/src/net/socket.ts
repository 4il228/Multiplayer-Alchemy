// Типизированный singleton-сокет клиента (SPEC.md §3).
import { io, type Socket } from "socket.io-client";
import {
  CURSOR_THROTTLE_MS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@multialchemy/shared";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Vite dev-сервер проксирует /socket.io на localhost:3001 (vite.config.ts).
export const socket: GameSocket = io();

/**
 * Троттлинг с гарантированным trailing-вызовом: последний пакет координат
 * не теряется, чтобы объект/курсор не «замирал» в устаревшей точке.
 */
export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number = CURSOR_THROTTLE_MS,
): (...args: Args) => void {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  return (...args: Args) => {
    const now = Date.now();
    const remaining = waitMs - (now - lastCall);

    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
      return;
    }

    pendingArgs = args;
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        lastCall = Date.now();
        if (pendingArgs !== null) {
          fn(...pendingArgs);
          pendingArgs = null;
        }
      }, remaining);
    }
  };
}

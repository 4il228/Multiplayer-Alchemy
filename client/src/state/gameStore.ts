// Лёгкий стор без внешних библиотек: useSyncExternalStore + подписки на сокет-события.
import { useSyncExternalStore } from "react";
import type {
  Element as GameElement,
  RoomErrorPayload,
  RoomState,
} from "@multialchemy/shared";
import { socket } from "../net/socket";

export const SESSION_NAME_KEY = "ma:playerName";
export const SESSION_ROOM_KEY = "ma:roomId";

export interface GameStoreState {
  phase: "lobby" | "room";
  roomState: RoomState | null;
  elements: Map<string, GameElement>;
  totalElements: number;
  selfSocketId: string | null;
  lastError: RoomErrorPayload | null;
}

let state: GameStoreState = {
  phase: "lobby",
  roomState: null,
  elements: new Map(),
  totalElements: 0,
  selfSocketId: null,
  lastError: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<GameStoreState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGameState(): GameStoreState {
  return state;
}

export function useGameStore(): GameStoreState {
  return useSyncExternalStore(subscribe, getGameState);
}

// --- Подписки на события сервера (SPEC.md §3.2) ---

socket.on("room:state", (payload) => {
  const { elements, totalElements, ...roomState } = payload;
  // roomId запоминаем для авто-re-join при реконнекте (SPEC.md §4.5).
  sessionStorage.setItem(SESSION_ROOM_KEY, roomState.roomId);
  setState({
    phase: "room",
    roomState,
    elements: new Map(elements.map((el) => [el.id, el])),
    totalElements,
    selfSocketId: socket.id ?? null,
    lastError: null,
  });
});

socket.on("room:error", (payload) => {
  // Комната недоступна (не найдена/полна) — показываем ошибку в лобби.
  sessionStorage.removeItem(SESSION_ROOM_KEY);
  setState({ phase: "lobby", roomState: null, lastError: payload });
});

socket.on("room:player_joined", (player) => {
  if (!state.roomState) return;
  setState({
    roomState: {
      ...state.roomState,
      players: { ...state.roomState.players, [player.socketId]: player },
    },
  });
});

socket.on("room:player_left", ({ socketId }) => {
  if (!state.roomState) return;
  const players = { ...state.roomState.players };
  delete players[socketId];
  setState({ roomState: { ...state.roomState, players } });
});

socket.on("craft:success", ({ newInstance, isNewDiscovery }) => {
  if (!isNewDiscovery || !state.roomState) return;
  if (state.roomState.unlockedElements.includes(newInstance.elementId)) return;
  setState({
    roomState: {
      ...state.roomState,
      unlockedElements: [...state.roomState.unlockedElements, newInstance.elementId],
    },
  });
});

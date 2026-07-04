// React-хук доски: монтирует BoardScene, связывает её с сокет-событиями
// (SPEC §3, §4.1-§4.4) и пользовательским вводом (drag-and-drop, курсоры).
import { useEffect, useRef, type RefObject } from "react";
import type {
  BoardInstance,
  Player,
  RoomState,
  Element as GameElement,
} from "@multialchemy/shared";
import { socket, throttle } from "../net/socket";
import { getGameState } from "../state/gameStore";
import { BoardScene } from "./BoardScene";

/** MIME-тип HTML5 DnD для спавна элементов из сайдбара-библиотеки (C3). */
export const ELEMENT_DND_MIME = "application/x-element-id";

interface DragState {
  instanceId: string;
  /** Координаты до захвата — для отката при element:lock_denied. */
  originX: number;
  originY: number;
  /** Смещение точки клика от центра чипа, чтобы чип не «прыгал» к курсору. */
  offsetX: number;
  offsetY: number;
  lastX: number;
  lastY: number;
}

export function useBoard(): RefObject<HTMLDivElement | null> {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new BoardScene();
    let cancelled = false;
    let drag: DragState | null = null;
    /** Актуальные локи комнаты: instanceId -> socketId владельца. */
    const locks = new Map<string, string>();
    const disposers: Array<() => void> = [];

    const selfId = (): string | null => socket.id ?? null;
    const playerOf = (socketId: string): Player | undefined =>
      getGameState().roomState?.players[socketId];

    const toBoard = (e: MouseEvent): { x: number; y: number } => {
      const rect = host.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const applyLockVisual = (instanceId: string, lockedBy: string): void => {
      const isSelf = lockedBy === selfId();
      const player = playerOf(lockedBy);
      // Fallback-цвет (outline из tokens.md) — на случай гонки player_joined.
      scene.lockInstance(instanceId, player?.color ?? "#a08e7c", player?.name ?? "", isSelf);
    };

    const cancelDrag = (instanceId: string): void => {
      if (drag?.instanceId !== instanceId) return;
      scene.setInstanceTarget(instanceId, drag.originX, drag.originY, true);
      drag = null;
    };

    const populate = (roomState: RoomState, elements: Map<string, GameElement>): void => {
      scene.reset();
      locks.clear();
      drag = null;
      for (const instance of Object.values(roomState.boardInstances)) {
        scene.addInstance(instance, elements.get(instance.elementId));
        if (instance.lockedBy) {
          locks.set(instance.id, instance.lockedBy);
          applyLockVisual(instance.id, instance.lockedBy);
        }
      }
    };

    // --- Исходящие интенты (SPEC §3.1) ---

    const sendCursor = throttle((x: number, y: number) => {
      socket.emit("cursor:move", { x, y });
    });
    const sendDrag = throttle((instanceId: string, x: number, y: number) => {
      socket.emit("element:drag", { instanceId, x, y });
    });

    scene.onChipPointerDown = (instanceId, px, py) => {
      if (drag) return;
      const owner = locks.get(instanceId);
      if (owner && owner !== selfId()) return; // элемент держит другой игрок
      const target = scene.getInstanceTarget(instanceId);
      const visible = scene.getInstancePosition(instanceId);
      if (!target || !visible) return;
      drag = {
        instanceId,
        originX: target.x,
        originY: target.y,
        offsetX: px - visible.x,
        offsetY: py - visible.y,
        lastX: visible.x,
        lastY: visible.y,
      };
      // Оптимистичный захват (SPEC §4.3): обводка сразу, сервер подтвердит/откажет.
      const self = selfId();
      if (self) applyLockVisual(instanceId, self);
      socket.emit("element:lock", { instanceId });
    };

    const onMouseMove = (e: MouseEvent): void => {
      const { x, y } = toBoard(e);
      sendCursor(x, y);
      if (drag) {
        const nx = x - drag.offsetX;
        const ny = y - drag.offsetY;
        drag.lastX = nx;
        drag.lastY = ny;
        scene.setInstanceTarget(drag.instanceId, nx, ny, true); // Optimistic UI
        sendDrag(drag.instanceId, nx, ny);
      }
    };

    const onMouseUp = (): void => {
      if (!drag) return;
      const { instanceId, lastX, lastY } = drag;
      drag = null;
      locks.delete(instanceId);
      scene.unlockInstance(instanceId); // сервер продублирует element:unlocked
      socket.emit("element:release", { instanceId, x: lastX, y: lastY });
    };

    // Спавн из библиотеки (C3) через HTML5 DnD.
    const onDragOver = (e: DragEvent): void => {
      if (e.dataTransfer?.types.includes(ELEMENT_DND_MIME)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };
    const onDrop = (e: DragEvent): void => {
      const elementId = e.dataTransfer?.getData(ELEMENT_DND_MIME);
      if (!elementId) return;
      e.preventDefault();
      const { x, y } = toBoard(e);
      socket.emit("element:spawn", { elementId, x, y });
    };

    // --- Входящие события сервера (SPEC §3.2) ---

    const onRoomState: Parameters<typeof socket.on<"room:state">>[1] = (payload) => {
      const { elements, totalElements: _total, ...roomState } = payload;
      void _total;
      populate(roomState, new Map(elements.map((el) => [el.id, el])));
    };

    const onSpawned = (instance: BoardInstance): void => {
      scene.addInstance(instance, getGameState().elements.get(instance.elementId));
    };

    const onLocked = ({ instanceId, lockedBy }: { instanceId: string; lockedBy: string }): void => {
      locks.set(instanceId, lockedBy);
      // Лок достался другому, пока мы держали чип оптимистично, — откатываем.
      if (lockedBy !== selfId()) cancelDrag(instanceId);
      applyLockVisual(instanceId, lockedBy);
    };

    const onUnlocked = ({ instanceId }: { instanceId: string }): void => {
      locks.delete(instanceId);
      if (drag?.instanceId === instanceId) return; // наш оптимистичный захват живёт
      scene.unlockInstance(instanceId);
    };

    const onLockDenied = ({ instanceId }: { instanceId: string }): void => {
      cancelDrag(instanceId);
      const owner = locks.get(instanceId);
      if (owner && owner !== selfId()) {
        applyLockVisual(instanceId, owner); // восстановить обводку реального владельца
      } else {
        scene.unlockInstance(instanceId);
      }
    };

    const onUpdateInstances = (payload: { [id: string]: Partial<BoardInstance> }): void => {
      for (const [instanceId, patch] of Object.entries(payload)) {
        if (drag?.instanceId === instanceId) continue; // свой драг не перетираем
        const target = scene.getInstanceTarget(instanceId);
        if (!target) continue;
        scene.setInstanceTarget(instanceId, patch.x ?? target.x, patch.y ?? target.y);
      }
    };

    const onRemoved = ({ instanceIds }: { instanceIds: string[] }): void => {
      for (const instanceId of instanceIds) {
        cancelDrag(instanceId);
        locks.delete(instanceId);
        scene.removeInstance(instanceId);
      }
    };

    const onCleared = (): void => {
      drag = null;
      locks.clear();
      scene.clear();
    };

    const onCraftSuccess = ({
      newInstance,
      destroyedIds,
    }: {
      newInstance: BoardInstance;
      destroyedIds: string[];
      isNewDiscovery: boolean;
      discoveredBy: string;
    }): void => {
      for (const instanceId of destroyedIds) {
        cancelDrag(instanceId);
        locks.delete(instanceId);
        scene.removeInstance(instanceId);
      }
      scene.addInstance(newInstance, getGameState().elements.get(newInstance.elementId), {
        pop: true, // анимация масштаба 0→1
      });
    };

    const onCraftFail = ({
      instanceId1,
      instanceId2,
    }: {
      instanceId1: string;
      instanceId2: string;
    }): void => {
      scene.repel(instanceId1, instanceId2);
    };

    const onSyncCursors = (payload: { [socketId: string]: { x: number; y: number } }): void => {
      const self = selfId();
      for (const [socketId, pos] of Object.entries(payload)) {
        if (socketId === self) continue; // свой курсор — системный, не рисуем
        const player = playerOf(socketId);
        if (!player) continue;
        scene.updateCursor(socketId, pos.x, pos.y, player.color, player.name);
      }
    };

    const onPlayerLeft = ({ socketId }: { socketId: string }): void => {
      scene.removeCursor(socketId);
    };

    scene.init(host).then(() => {
      if (cancelled) return;

      const current = getGameState();
      if (current.roomState) populate(current.roomState, current.elements);

      host.addEventListener("mousemove", onMouseMove);
      host.addEventListener("dragover", onDragOver);
      host.addEventListener("drop", onDrop);
      window.addEventListener("mouseup", onMouseUp);
      disposers.push(() => {
        host.removeEventListener("mousemove", onMouseMove);
        host.removeEventListener("dragover", onDragOver);
        host.removeEventListener("drop", onDrop);
        window.removeEventListener("mouseup", onMouseUp);
      });

      socket.on("room:state", onRoomState);
      socket.on("element:spawned", onSpawned);
      socket.on("element:locked", onLocked);
      socket.on("element:unlocked", onUnlocked);
      socket.on("element:lock_denied", onLockDenied);
      socket.on("board:update_instances", onUpdateInstances);
      socket.on("board:removed", onRemoved);
      socket.on("board:cleared", onCleared);
      socket.on("craft:success", onCraftSuccess);
      socket.on("craft:fail", onCraftFail);
      socket.on("room:sync_cursors", onSyncCursors);
      socket.on("room:player_left", onPlayerLeft);
      disposers.push(() => {
        socket.off("room:state", onRoomState);
        socket.off("element:spawned", onSpawned);
        socket.off("element:locked", onLocked);
        socket.off("element:unlocked", onUnlocked);
        socket.off("element:lock_denied", onLockDenied);
        socket.off("board:update_instances", onUpdateInstances);
        socket.off("board:removed", onRemoved);
        socket.off("board:cleared", onCleared);
        socket.off("craft:success", onCraftSuccess);
        socket.off("craft:fail", onCraftFail);
        socket.off("room:sync_cursors", onSyncCursors);
        socket.off("room:player_left", onPlayerLeft);
      });
    });

    return () => {
      cancelled = true;
      disposers.forEach((dispose) => dispose());
      scene.destroy();
    };
  }, []);

  return hostRef;
}

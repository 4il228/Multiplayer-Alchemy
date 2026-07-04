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
  /** Курсор за пределами доски: чип подменён DOM-«призраком», дроп удалит элемент. */
  outside: boolean;
}

/**
 * DOM-«призрак» перетаскиваемого чипа за пределами доски. Pixi-канвас обрезан
 * границами панели доски, поэтому вне её чип рисуется обычным DOM-элементом
 * поверх всего экрана + красный бейдж-корзина как знак «отпустишь — удалится».
 */
interface GhostView {
  root: HTMLDivElement;
  icon: HTMLSpanElement;
  name: HTMLSpanElement;
}

function createGhost(): GhostView {
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;z-index:1000;pointer-events:none;display:none;" +
    "transform:translate(-50%,-50%);";

  // Чип в стиле glass-pill из tokens.md, но с плотным фоном (вне доски фон светлее)
  // и красной обводкой опасности (#E63946 — красный из палитры игроков).
  const chip = document.createElement("div");
  chip.style.cssText =
    "display:flex;align-items:center;gap:8px;padding:8px 16px;" +
    "background:rgba(48,41,33,0.92);border:1.5px solid rgba(230,57,70,0.8);" +
    "border-radius:9999px;font-family:Montserrat,Inter,sans-serif;font-size:14px;" +
    "font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#efe0d4;" +
    "box-shadow:0 0 16px rgba(230,57,70,0.45);";

  const icon = document.createElement("span");
  icon.style.fontSize = "18px";
  const name = document.createElement("span");
  chip.append(icon, name);

  const badge = document.createElement("div");
  badge.textContent = "🗑️";
  badge.style.cssText =
    "position:absolute;top:-16px;right:-12px;width:28px;height:28px;" +
    "display:flex;align-items:center;justify-content:center;" +
    "background:#e63946;border-radius:9999px;font-size:14px;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.4);";

  root.append(chip, badge);
  document.body.appendChild(root);
  return { root, icon, name };
}

export function useBoard(): RefObject<HTMLDivElement | null> {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new BoardScene();
    let cancelled = false;
    let drag: DragState | null = null;
    let ghost: GhostView | null = null;
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

    const moveGhost = (clientX: number, clientY: number): void => {
      if (!ghost) return;
      ghost.root.style.left = `${clientX}px`;
      ghost.root.style.top = `${clientY}px`;
    };

    const showGhost = (instanceId: string, clientX: number, clientY: number): void => {
      if (!ghost) ghost = createGhost();
      const info = scene.getInstanceInfo(instanceId);
      ghost.icon.textContent = info?.icon ?? "❔";
      ghost.name.textContent = (info?.name ?? "").toUpperCase();
      ghost.root.style.display = "block";
      moveGhost(clientX, clientY);
    };

    const hideGhost = (): void => {
      if (ghost) ghost.root.style.display = "none";
    };

    const cancelDrag = (instanceId: string): void => {
      if (drag?.instanceId !== instanceId) return;
      hideGhost();
      scene.setInstanceVisible(instanceId, true);
      scene.setInstanceTarget(instanceId, drag.originX, drag.originY, true);
      drag = null;
    };

    const populate = (roomState: RoomState, elements: Map<string, GameElement>): void => {
      scene.reset();
      locks.clear();
      drag = null;
      hideGhost();
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
        outside: false,
      };
      // Оптимистичный захват (SPEC §4.3): обводка сразу, сервер подтвердит/откажет.
      const self = selfId();
      if (self) applyLockVisual(instanceId, self);
      socket.emit("element:lock", { instanceId });
    };

    const isOutside = (e: MouseEvent): boolean => {
      const rect = host.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    // Слушаем window, а не host: во время драга курсор может покидать доску.
    const onMouseMove = (e: MouseEvent): void => {
      const outside = isOutside(e);
      const { x, y } = toBoard(e);

      if (!drag) {
        if (!outside) sendCursor(x, y);
        return;
      }

      if (outside !== drag.outside) {
        drag.outside = outside;
        if (outside) {
          // Чип «покинул» доску: в Pixi его не нарисовать (канвас обрезан
          // панелью), поэтому подменяем DOM-призраком с бейджем удаления.
          scene.setInstanceVisible(drag.instanceId, false);
          showGhost(drag.instanceId, e.clientX, e.clientY);
        } else {
          hideGhost();
          scene.setInstanceVisible(drag.instanceId, true);
        }
      }

      // Для сервера (и остальных игроков) координаты прижимаются к краю доски.
      const rect = host.getBoundingClientRect();
      const nx = Math.max(0, Math.min(rect.width, x)) - drag.offsetX;
      const ny = Math.max(0, Math.min(rect.height, y)) - drag.offsetY;
      drag.lastX = nx;
      drag.lastY = ny;
      scene.setInstanceTarget(drag.instanceId, nx, ny, true); // Optimistic UI
      sendDrag(drag.instanceId, nx, ny);
      sendCursor(Math.max(0, Math.min(rect.width, x)), Math.max(0, Math.min(rect.height, y)));

      if (outside) moveGhost(e.clientX, e.clientY);
    };

    const onMouseUp = (e: MouseEvent): void => {
      if (!drag) return;
      const { instanceId, lastX, lastY } = drag;
      drag = null;
      hideGhost();

      // Дроп за пределами доски — удаление. Чип остаётся скрытым до
      // подтверждения: сервер проверит лок и разошлёт board:removed всем.
      if (isOutside(e)) {
        socket.emit("element:delete", { instanceId });
        return;
      }

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
      // Гонка: чип скрыт «дропом наружу», но лок не наш — element:delete
      // сервер проигнорирует, board:removed не придёт. Возвращаем чип.
      scene.setInstanceVisible(instanceId, true);
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
      hideGhost();
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

      window.addEventListener("mousemove", onMouseMove);
      host.addEventListener("dragover", onDragOver);
      host.addEventListener("drop", onDrop);
      window.addEventListener("mouseup", onMouseUp);
      disposers.push(() => {
        window.removeEventListener("mousemove", onMouseMove);
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
      ghost?.root.remove();
      scene.destroy();
    };
  }, []);

  return hostRef;
}

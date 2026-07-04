// Pixi-сцена доски: чипы элементов, чужие курсоры, LERP-интерполяция (SPEC §4.3).
// Визуальные токены — из design/tokens.md, секция «Game screen» (glass-pill чипы,
// обводка цветом владельца лока, курсор-стрелка с плашкой имени игрока).
import {
  Application,
  Container,
  Graphics,
  Text,
  type FederatedPointerEvent,
  type Ticker,
} from "pixi.js";
import type { BoardInstance, Element as GameElement } from "@multialchemy/shared";

const FONT_STACK = "Montserrat, Inter, sans-serif";

// Чип (glass-pill из game.html): фон white/5, бордер white/15, текст on-surface.
const CHIP_FILL = { color: 0xffffff, alpha: 0.05 };
const CHIP_BORDER = { color: 0xffffff, alpha: 0.15 };
const CHIP_TEXT_COLOR = 0xefe0d4; // on-surface
const AMBER_GLOW = 0xffab40; // primary-container — hover-свечение glow-amber
const CHIP_PADDING_X = 16; // px-md
const CHIP_PADDING_Y = 8; // py-sm
const CHIP_GAP = 8;
const LOCKED_SCALE = 1.1; // чип под локом в макете увеличен

const LERP_ALPHA = 0.2; // SPEC §4.3, alpha ∈ [0.1, 0.3]
const POP_DURATION_MS = 220; // анимация масштаба 0→1 результата крафта
const REPEL_DISTANCE = 28; // визуальный «толчок» чипов при craft:fail

// Стрелка курсора 24×24 — контур повторяет SVG-стрелку из game.html.
const CURSOR_ARROW: number[] = [0, 0, 0, 20, 5.4, 15.6, 9, 23, 12, 21.6, 8.4, 14.2, 15, 14.2];

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

/** Плашка имени игрока: фон цвета игрока, белый uppercase-текст, радиус 4px. */
function makeNameTag(name: string, color: number, fontSize: number): Container {
  const tag = new Container();
  const text = new Text({
    text: name.toUpperCase(),
    style: {
      fontFamily: FONT_STACK,
      fontSize,
      fontWeight: "700",
      fill: 0xffffff,
      letterSpacing: 0.5,
    },
  });
  const bg = new Graphics()
    .roundRect(0, 0, text.width + 12, text.height + 6, 4)
    .fill(color);
  text.position.set(6, 3);
  tag.addChild(bg, text);
  return tag;
}

interface ChipView {
  root: Container;
  pill: Graphics;
  width: number;
  height: number;
  /** Иконка и имя элемента — для DOM-«призрака» при драге за пределы доски. */
  icon: string;
  name: string;
  targetX: number;
  targetY: number;
  /** Залочен мной: двигается мгновенно, LERP не применяется (Optimistic UI). */
  ownedBySelf: boolean;
  lockColor: number | null;
  hovered: boolean;
  ownerTag: Container | null;
}

interface CursorView {
  root: Container;
  targetX: number;
  targetY: number;
}

interface PopAnim {
  root: Container;
  elapsed: number;
}

export class BoardScene {
  /** mousedown по чипу: id инстанса + координаты клика в системе доски. */
  public onChipPointerDown: ((instanceId: string, x: number, y: number) => void) | null = null;

  private app: Application | null = null;
  private instancesLayer = new Container();
  private cursorsLayer = new Container();
  private chips = new Map<string, ChipView>();
  private cursors = new Map<string, CursorView>();
  private pops: PopAnim[] = [];
  private destroyed = false;

  async init(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0, // фон доски (glass-panel + arcane-grid) рисует CSS под canvas
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    // React StrictMode мог размонтировать хук, пока Pixi инициализировался.
    if (this.destroyed) {
      app.destroy(true, { children: true, texture: true });
      return;
    }
    this.app = app;
    this.instancesLayer.sortableChildren = true;
    app.stage.addChild(this.instancesLayer, this.cursorsLayer);
    app.ticker.add(this.tick);
    host.appendChild(app.canvas);
  }

  destroy(): void {
    this.destroyed = true;
    this.chips.clear();
    this.cursors.clear();
    this.pops = [];
    if (this.app) {
      this.app.ticker.remove(this.tick);
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }

  // --- Инстансы элементов ---

  addInstance(
    instance: BoardInstance,
    element: GameElement | undefined,
    opts: { pop?: boolean } = {},
  ): void {
    if (this.chips.has(instance.id)) return;

    const root = new Container();
    const pill = new Graphics();
    const emoji = new Text({ text: element?.icon ?? "❔", style: { fontSize: 18 } });
    const label = new Text({
      text: (element?.name ?? instance.elementId).toUpperCase(),
      style: {
        fontFamily: FONT_STACK,
        fontSize: 14,
        fontWeight: "700",
        fill: CHIP_TEXT_COLOR,
        letterSpacing: 0.7, // ≈ 0.05em от 14px
      },
    });

    const width = CHIP_PADDING_X * 2 + emoji.width + CHIP_GAP + label.width;
    const height = CHIP_PADDING_Y * 2 + Math.max(emoji.height, label.height);
    emoji.position.set(CHIP_PADDING_X, (height - emoji.height) / 2);
    label.position.set(CHIP_PADDING_X + emoji.width + CHIP_GAP, (height - label.height) / 2);

    root.addChild(pill, emoji, label);
    root.pivot.set(width / 2, height / 2);
    root.position.set(instance.x, instance.y);
    root.eventMode = "static";
    root.cursor = "grab";
    root.on("pointerdown", (event: FederatedPointerEvent) => {
      this.onChipPointerDown?.(instance.id, event.global.x, event.global.y);
    });

    const view: ChipView = {
      root,
      pill,
      width,
      height,
      icon: element?.icon ?? "❔",
      name: element?.name ?? instance.elementId,
      targetX: instance.x,
      targetY: instance.y,
      ownedBySelf: false,
      lockColor: null,
      hovered: false,
      ownerTag: null,
    };
    root.on("pointerover", () => {
      view.hovered = true;
      this.drawPill(view);
    });
    root.on("pointerout", () => {
      view.hovered = false;
      this.drawPill(view);
    });
    this.drawPill(view);
    this.chips.set(instance.id, view);
    this.instancesLayer.addChild(root);

    if (opts.pop) {
      root.scale.set(0);
      this.pops.push({ root, elapsed: 0 });
    }
  }

  removeInstance(instanceId: string): void {
    const view = this.chips.get(instanceId);
    if (!view) return;
    this.chips.delete(instanceId);
    this.pops = this.pops.filter((pop) => pop.root !== view.root);
    view.root.destroy({ children: true });
  }

  setInstanceTarget(instanceId: string, x: number, y: number, instant = false): void {
    const view = this.chips.get(instanceId);
    if (!view) return;
    view.targetX = x;
    view.targetY = y;
    if (instant) view.root.position.set(x, y);
  }

  /** Скрыть/показать чип (drag за пределами доски: чип подменяется DOM-«призраком»). */
  setInstanceVisible(instanceId: string, visible: boolean): void {
    const view = this.chips.get(instanceId);
    if (!view) return;
    view.root.visible = visible;
  }

  getInstanceInfo(instanceId: string): { icon: string; name: string } | null {
    const view = this.chips.get(instanceId);
    return view ? { icon: view.icon, name: view.name } : null;
  }

  getInstancePosition(instanceId: string): { x: number; y: number } | null {
    const view = this.chips.get(instanceId);
    return view ? { x: view.root.x, y: view.root.y } : null;
  }

  getInstanceTarget(instanceId: string): { x: number; y: number } | null {
    const view = this.chips.get(instanceId);
    return view ? { x: view.targetX, y: view.targetY } : null;
  }

  lockInstance(instanceId: string, ownerColor: string, ownerName: string, isSelf: boolean): void {
    const view = this.chips.get(instanceId);
    if (!view) return;
    view.ownedBySelf = isSelf;
    view.lockColor = hexToNumber(ownerColor);
    view.root.scale.set(LOCKED_SCALE);
    view.root.zIndex = 10;
    view.root.cursor = isSelf ? "grabbing" : "default";
    this.drawPill(view);
    view.ownerTag?.destroy({ children: true });
    view.ownerTag = null;
    if (!isSelf) {
      // Плашка имени владельца над чипом (как у «Steam / Anna» в макете).
      const tag = makeNameTag(ownerName, view.lockColor, 9);
      tag.position.set(0, -tag.height - 6);
      view.root.addChild(tag);
      view.ownerTag = tag;
    }
  }

  unlockInstance(instanceId: string): void {
    const view = this.chips.get(instanceId);
    if (!view) return;
    view.ownedBySelf = false;
    view.lockColor = null;
    view.root.scale.set(1);
    view.root.zIndex = 0;
    view.root.cursor = "grab";
    view.ownerTag?.destroy({ children: true });
    view.ownerTag = null;
    this.drawPill(view);
  }

  /** Полная очистка доски (board:cleared). Курсоры игроков не трогает. */
  clear(): void {
    for (const id of [...this.chips.keys()]) this.removeInstance(id);
  }

  /** Пересоздание сцены из свежего room:state (реконнект): чипы + курсоры. */
  reset(): void {
    this.clear();
    for (const id of [...this.cursors.keys()]) this.removeCursor(id);
  }

  /** Визуальный «толчок» пары чипов при craft:fail; LERP вернёт их к целям. */
  repel(instanceId1: string, instanceId2: string): void {
    const a = this.chips.get(instanceId1);
    const b = this.chips.get(instanceId2);
    if (!a || !b) return;
    let dx = a.root.x - b.root.x;
    let dy = a.root.y - b.root.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    a.root.position.set(a.root.x + dx * REPEL_DISTANCE, a.root.y + dy * REPEL_DISTANCE);
    b.root.position.set(b.root.x - dx * REPEL_DISTANCE, b.root.y - dy * REPEL_DISTANCE);
  }

  // --- Курсоры других игроков ---

  updateCursor(socketId: string, x: number, y: number, color: string, name: string): void {
    let view = this.cursors.get(socketId);
    if (!view) {
      const root = new Container();
      const colorNum = hexToNumber(color);
      const arrow = new Graphics()
        .poly(CURSOR_ARROW)
        .fill(colorNum)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      const tag = makeNameTag(name, colorNum, 10);
      tag.position.set(16, 20); // как ml-4 под стрелкой в макете
      root.addChild(arrow, tag);
      root.position.set(x, y);
      view = { root, targetX: x, targetY: y };
      this.cursors.set(socketId, view);
      this.cursorsLayer.addChild(root);
    }
    view.targetX = x;
    view.targetY = y;
  }

  removeCursor(socketId: string): void {
    const view = this.cursors.get(socketId);
    if (!view) return;
    this.cursors.delete(socketId);
    view.root.destroy({ children: true });
  }

  // --- Отрисовка и тикер ---

  private drawPill(view: ChipView): void {
    const { pill, width: w, height: h } = view;
    pill.clear();
    if (view.lockColor !== null) {
      // Свечение цветом владельца — аналог CSS box-shadow из макета.
      pill.roundRect(-3, -3, w + 6, h + 6, (h + 6) / 2)
        .stroke({ width: 6, color: view.lockColor, alpha: 0.25 });
    } else if (view.hovered) {
      pill.roundRect(-3, -3, w + 6, h + 6, (h + 6) / 2)
        .stroke({ width: 6, color: AMBER_GLOW, alpha: 0.3 }); // hover:glow-amber
    }
    pill.roundRect(0, 0, w, h, h / 2)
      .fill(CHIP_FILL)
      .stroke(
        view.lockColor !== null
          ? { width: 2, color: view.lockColor, alpha: 0.8 }
          : { width: 1, color: CHIP_BORDER.color, alpha: CHIP_BORDER.alpha },
      );
  }

  private tick = (ticker: Ticker): void => {
    // Экспоненциальное сглаживание, инвариантное к FPS: при 60 fps k = LERP_ALPHA.
    const k = 1 - Math.pow(1 - LERP_ALPHA, ticker.deltaTime);

    for (const view of this.chips.values()) {
      if (view.ownedBySelf) continue; // своё двигаем мгновенно (Optimistic UI)
      view.root.x += (view.targetX - view.root.x) * k;
      view.root.y += (view.targetY - view.root.y) * k;
    }
    for (const view of this.cursors.values()) {
      view.root.x += (view.targetX - view.root.x) * k;
      view.root.y += (view.targetY - view.root.y) * k;
    }

    if (this.pops.length > 0) {
      this.pops = this.pops.filter((pop) => {
        pop.elapsed += ticker.deltaMS;
        const t = Math.min(1, pop.elapsed / POP_DURATION_MS);
        pop.root.scale.set(1 - (1 - t) ** 3); // ease-out cubic 0→1
        return t < 1;
      });
    }
  };
}

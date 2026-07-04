// Контракт данных и событий клиент <-> сервер (SPEC.md, разделы 2-3).

export interface Element {
  id: string;       // Уникальный строковый идентификатор (например, "water")
  name: string;     // Локализованное имя для отображения ("Вода")
  icon: string;     // Эмодзи или путь к SVG/PNG ассету
  isBase: boolean;  // Флаг стартового элемента (доступен всегда)
}

export interface Recipe {
  id: string;                    // "ingredient1_id:ingredient2_id" (алфавитный порядок)
  ingredients: [string, string]; // Отсортированы по алфавиту
  result: string;                // ID получаемого элемента
}

export interface BoardInstance {
  id: string;              // UUID v4 инстанса
  elementId: string;       // Ссылка на статический Element.id
  x: number;
  y: number;
  lockedBy: string | null; // socket.id игрока, который держит элемент
  createdAt: number;       // Timestamp спавна (для вытеснения самых старых)
}

export interface Player {
  socketId: string;
  name: string;   // Обрезается до PLAYER_NAME_MAX символов
  color: string;  // HEX-код курсора; выдаётся сервером из палитры
  cursor: { x: number; y: number };
}

export interface RoomState {
  roomId: string; // 6-значный буквенно-цифровой код лобби
  players: { [socketId: string]: Player };
  unlockedElements: string[]; // Element.id, открытые комнатой (базовые всегда включены)
  boardInstances: { [instanceId: string]: BoardInstance };
}

export type RoomStatePayload = RoomState & {
  elements: Element[];   // Статичный каталог элементов
  totalElements: number;
};

export interface RoomErrorPayload {
  code: "NOT_FOUND" | "FULL";
  message: string;
}

// --- События Socket.io (SPEC.md §3.1) ---

export interface ClientToServerEvents {
  "room:create": (payload: { playerName: string }) => void;
  "room:join": (payload: { roomId: string; playerName: string }) => void;
  "cursor:move": (payload: { x: number; y: number }) => void;
  "element:spawn": (payload: { elementId: string; x: number; y: number }) => void;
  "element:lock": (payload: { instanceId: string }) => void;
  "element:drag": (payload: { instanceId: string; x: number; y: number }) => void;
  "element:release": (payload: { instanceId: string; x: number; y: number }) => void;
  // Удаление своего (залоченного) инстанса — drop за пределами доски.
  // Подтверждение всем — существующим board:removed.
  "element:delete": (payload: { instanceId: string }) => void;
  "board:clear": () => void;
}

// --- События Socket.io (SPEC.md §3.2) ---

export interface ServerToClientEvents {
  "room:state": (payload: RoomStatePayload) => void;
  "room:error": (payload: RoomErrorPayload) => void;
  "room:player_joined": (payload: Player) => void;
  "room:player_left": (payload: { socketId: string }) => void;
  "room:sync_cursors": (payload: { [socketId: string]: { x: number; y: number } }) => void;
  "element:spawned": (payload: BoardInstance) => void;
  "element:locked": (payload: { instanceId: string; lockedBy: string }) => void;
  "element:unlocked": (payload: { instanceId: string }) => void;
  "element:lock_denied": (payload: { instanceId: string }) => void;
  "board:update_instances": (payload: { [instanceId: string]: Partial<BoardInstance> }) => void;
  "board:removed": (payload: { instanceIds: string[] }) => void;
  "board:cleared": () => void;
  "craft:success": (payload: {
    newInstance: BoardInstance;
    destroyedIds: string[];
    isNewDiscovery: boolean;
    discoveredBy: string;
  }) => void;
  "craft:fail": (payload: { instanceId1: string; instanceId2: string }) => void;
}

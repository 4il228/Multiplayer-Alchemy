// Общие константы клиента и сервера (SPEC.md, раздел 4).

export const HITBOX_RADIUS = 40;          // Радиус круглого хитбокса элемента (px)
export const BOARD_LIMIT = 150;           // Максимум инстансов на доске комнаты
export const MAX_PLAYERS = 8;             // Лимит игроков на комнату
export const ROOM_GRACE_MS = 60_000;      // Grace-период удаления пустой комнаты
export const CLEAR_COOLDOWN_MS = 5_000;   // Cooldown board:clear на комнату
export const CURSOR_THROTTLE_MS = 40;     // Троттлинг cursor:move / element:drag на клиенте
export const SERVER_BATCH_HZ = 20;        // Частота батч-рассылок сервера
export const PLAYER_NAME_MAX = 20;        // Максимальная длина имени игрока

// Палитра из 8 контрастных цветов курсоров игроков
export const PLAYER_COLORS: string[] = [
  "#E63946", // красный
  "#2A9D8F", // бирюзовый
  "#4361EE", // синий
  "#F4A261", // оранжевый
  "#9B5DE5", // фиолетовый
  "#80B918", // зелёный
  "#F15BB5", // розовый
  "#FFD60A", // жёлтый
];

export const ROOM_ID_LENGTH = 6;
// Без похожих символов (I, L, O, 0, 1) во избежание опечаток при вводе кода
export const ROOM_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

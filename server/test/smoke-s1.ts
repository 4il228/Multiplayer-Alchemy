// Smoke-тест фазы S1: создание комнаты, вход по коду, ошибка NOT_FOUND.

import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  Player,
  RoomStatePayload,
  ServerToClientEvents,
} from "@multialchemy/shared";

const SERVER_URL = "http://localhost:3001";
type TypedClient = Socket<ServerToClientEvents, ClientToServerEvents>;

function connect(): Promise<TypedClient> {
  return new Promise((resolve, reject) => {
    const socket: TypedClient = io(SERVER_URL, { transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

function fail(message: string): never {
  console.error(`SMOKE S1 FAIL: ${message}`);
  process.exit(1);
}

const timeout = setTimeout(() => fail("таймаут 10 секунд"), 10_000);

async function main() {
  const clientA = await connect();

  // 1. A создаёт комнату и получает room:state с 4 базовыми элементами
  const stateA = await new Promise<RoomStatePayload>((resolve) => {
    clientA.once("room:state", resolve);
    clientA.emit("room:create", { playerName: "Alice" });
  });
  if (!stateA.roomId || stateA.roomId.length !== 6) fail(`некорректный roomId: ${stateA.roomId}`);
  if (stateA.unlockedElements.length !== 4) {
    fail(`ожидалось 4 базовых элемента, получено ${stateA.unlockedElements.length}`);
  }
  for (const id of ["water", "fire", "earth", "air"]) {
    if (!stateA.unlockedElements.includes(id)) fail(`нет базового элемента ${id}`);
  }
  console.log(`room created: ${stateA.roomId}, base elements OK`);

  // 2. B входит по коду, A получает room:player_joined
  const joinedPromise = new Promise<Player>((resolve) => clientA.once("room:player_joined", resolve));
  const clientB = await connect();
  const stateB = await new Promise<RoomStatePayload>((resolve) => {
    clientB.once("room:state", resolve);
    clientB.emit("room:join", { roomId: stateA.roomId, playerName: "Bob" });
  });
  if (stateB.roomId !== stateA.roomId) fail("B попал не в ту комнату");
  const joined = await joinedPromise;
  if (joined.name !== "Bob") fail(`room:player_joined с именем ${joined.name}, ожидался Bob`);
  console.log("join + player_joined OK");

  // 3. Вход с несуществующим кодом — room:error NOT_FOUND
  const clientC = await connect();
  const error = await new Promise<{ code: string }>((resolve) => {
    clientC.once("room:error", resolve);
    clientC.emit("room:join", { roomId: "ZZZZZZ", playerName: "Carl" });
  });
  if (error.code !== "NOT_FOUND") fail(`ожидался NOT_FOUND, получен ${error.code}`);
  console.log("room:error NOT_FOUND OK");

  clearTimeout(timeout);
  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();
  console.log("SMOKE S1 OK");
  process.exit(0);
}

main().catch((err) => fail(String(err)));

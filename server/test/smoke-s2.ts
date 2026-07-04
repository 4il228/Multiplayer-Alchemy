// Smoke-тест фазы S2: спавн, крафт, повторный крафт, отклонение спавна, гонка локов.

import { io, Socket } from "socket.io-client";
import type {
  BoardInstance,
  ClientToServerEvents,
  RoomStatePayload,
  ServerToClientEvents,
} from "@multialchemy/shared";

const SERVER_URL = "http://localhost:3001";
type TypedClient = Socket<ServerToClientEvents, ClientToServerEvents>;

type CraftSuccessPayload = Parameters<ServerToClientEvents["craft:success"]>[0];

function connect(): Promise<TypedClient> {
  return new Promise((resolve, reject) => {
    const socket: TypedClient = io(SERVER_URL, { transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

function fail(message: string): never {
  console.error(`SMOKE S2 FAIL: ${message}`);
  process.exit(1);
}

function once<K extends keyof ServerToClientEvents>(
  socket: TypedClient,
  event: K,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve) => {
    socket.once(event, ((payload: Parameters<ServerToClientEvents[K]>[0]) =>
      resolve(payload)) as ServerToClientEvents[K]);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const timeout = setTimeout(() => fail("таймаут 15 секунд"), 15_000);

/** Спавн элемента клиентом A с ожиданием element:spawned. */
async function spawn(client: TypedClient, elementId: string, x: number, y: number): Promise<BoardInstance> {
  const spawned = once(client, "element:spawned");
  client.emit("element:spawn", { elementId, x, y });
  const instance = await spawned;
  if (instance.elementId !== elementId) fail(`заспавнился ${instance.elementId}, ожидался ${elementId}`);
  return instance;
}

/** Полный цикл крафта: lock -> drag -> release рядом с целью; возвращает craft:success обоих клиентов. */
async function craft(
  a: TypedClient,
  b: TypedClient,
  dragged: BoardInstance,
  target: BoardInstance,
): Promise<[CraftSuccessPayload, CraftSuccessPayload]> {
  const locked = once(a, "element:locked");
  a.emit("element:lock", { instanceId: dragged.id });
  await locked;

  a.emit("element:drag", { instanceId: dragged.id, x: target.x - 30, y: target.y });

  const successA = once(a, "craft:success");
  const successB = once(b, "craft:success");
  a.emit("element:release", { instanceId: dragged.id, x: target.x - 30, y: target.y });
  return Promise.all([successA, successB]);
}

async function main() {
  const clientA = await connect();
  const clientB = await connect();

  // Подготовка: A создаёт комнату, B входит
  const stateA = await new Promise<RoomStatePayload>((resolve) => {
    clientA.once("room:state", resolve);
    clientA.emit("room:create", { playerName: "Alice" });
  });
  await new Promise<RoomStatePayload>((resolve) => {
    clientB.once("room:state", resolve);
    clientB.emit("room:join", { roomId: stateA.roomId, playerName: "Bob" });
  });
  console.log(`room ${stateA.roomId}: Alice + Bob`);

  // 1. Крафт water + fire -> craft:success у обоих, isNewDiscovery: true
  const water1 = await spawn(clientA, "water", 100, 100);
  const fire1 = await spawn(clientA, "fire", 400, 400);
  const [sA, sB] = await craft(clientA, clientB, water1, fire1);

  const recipeResult = sA.newInstance.elementId;
  if (recipeResult !== "steam") fail(`результат рецепта ${recipeResult}, ожидался steam`);
  if (!sA.isNewDiscovery) fail("первый крафт: isNewDiscovery должен быть true");
  if (sA.discoveredBy !== "Alice") fail(`discoveredBy = ${sA.discoveredBy}, ожидалась Alice`);
  if (!sA.destroyedIds.includes(water1.id) || !sA.destroyedIds.includes(fire1.id)) {
    fail("destroyedIds не содержит оба ингредиента");
  }
  if (sB.newInstance.id !== sA.newInstance.id) fail("клиенты получили разные craft:success");
  console.log("craft water+fire -> steam, isNewDiscovery: true OK");

  // 2. Повторный крафт — isNewDiscovery: false
  const water2 = await spawn(clientA, "water", 600, 100);
  const fire2 = await spawn(clientA, "fire", 900, 400);
  const [sA2] = await craft(clientA, clientB, water2, fire2);
  if (sA2.newInstance.elementId !== "steam") fail("повторный крафт дал не steam");
  if (sA2.isNewDiscovery) fail("повторный крафт: isNewDiscovery должен быть false");
  console.log("repeat craft, isNewDiscovery: false OK");

  // 3. Спавн неоткрытого элемента игнорируется
  let illegalSpawn = false;
  const onSpawned = (inst: BoardInstance) => {
    if (inst.elementId === "human") illegalSpawn = true;
  };
  clientA.on("element:spawned", onSpawned);
  clientA.emit("element:spawn", { elementId: "human", x: 200, y: 200 });
  await sleep(500);
  clientA.off("element:spawned", onSpawned);
  if (illegalSpawn) fail("спавн неоткрытого элемента human не был отклонён");
  console.log("spawn of locked element ignored OK");

  // 4. Гонка локов: A захватывает первым, B получает element:lock_denied
  const chip = await spawn(clientA, "earth", 1200, 300);
  const lockedByA = once(clientA, "element:locked");
  clientA.emit("element:lock", { instanceId: chip.id });
  await lockedByA;

  const denied = once(clientB, "element:lock_denied");
  clientB.emit("element:lock", { instanceId: chip.id });
  const deniedPayload = await denied;
  if (deniedPayload.instanceId !== chip.id) fail("lock_denied с чужим instanceId");
  console.log("element:lock_denied for second locker OK");

  clearTimeout(timeout);
  clientA.disconnect();
  clientB.disconnect();
  console.log("SMOKE S2 OK");
  process.exit(0);
}

main().catch((err) => fail(String(err)));

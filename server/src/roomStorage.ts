import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PersistedRoom } from "./roomManager";

interface RoomsFile {
  version: 1;
  rooms: PersistedRoom[];
}

function isRoomsFile(value: unknown): value is RoomsFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; rooms?: unknown };
  return candidate.version === 1 && Array.isArray(candidate.rooms);
}

export class RoomStorage {
  constructor(private filePath: string) {}

  load(): PersistedRoom[] {
    if (!existsSync(this.filePath)) return [];
    const parsed: unknown = JSON.parse(readFileSync(this.filePath, "utf8"));
    if (!isRoomsFile(parsed)) return [];
    return parsed.rooms;
  }

  save(rooms: PersistedRoom[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload: RoomsFile = { version: 1, rooms };
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.filePath);
  }
}

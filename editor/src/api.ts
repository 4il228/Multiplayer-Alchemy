import type { EditorData } from "./validate";

const API_BASE = "http://127.0.0.1:3847";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error(
      "Локальный API редактора недоступен. Запустите приложение командой: npm run dev:editor",
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Ошибка API (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export function loadData(): Promise<EditorData> {
  return request<EditorData>("/api/data");
}

export function saveData(data: EditorData): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

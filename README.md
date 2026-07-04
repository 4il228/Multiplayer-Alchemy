# Multiplayer Alchemy

Кооперативная мультиплеерная игра «Алхимия»: игроки в общей комнате перетаскивают
элементы по доске и соединяют их, открывая новые. Все открытия общие для комнаты —
курсоры, перетаскивания и результаты крафта видны каждому в реальном времени.

Полное описание замысла и механик — в [SPEC.md](SPEC.md), план реализации — в [PLAN.md](PLAN.md).

## Требования

* Node.js 20+
* npm 10+

## Запуск

```powershell
npm install
npm run dev:server   # сервер на http://localhost:3001
npm run dev:client   # клиент (Vite) на http://localhost:5173
```

Откройте `http://localhost:5173` в двух вкладках или браузерах: в первой создайте
комнату, во второй войдите по 6-значному коду из шапки.

## Структура репозитория

| Путь | Назначение |
| :--- | :--- |
| `shared/` | Общий контракт: типы событий Socket.io и константы (`@multialchemy/shared`) |
| `server/` | Authoritative-сервер: Fastify + Socket.io, комнаты, локи, крафт (`server/src`), контент (`server/src/data`), smoke-тесты (`server/test`) |
| `client/` | Клиент: Vite + React 19 + PixiJS, лобби, доска, библиотека элементов |
| `design/` | Выгрузки дизайна из Google Stitch — источник правды для UI |

## Проверки

```powershell
npm run build                             # typecheck + сборка всех пакетов
npx tsx server/src/data/validate.ts       # валидация elements.json / recipes.json
# при запущенном dev:server:
npx tsx server/test/smoke-s1.ts           # комнаты, вход, ошибки
npx tsx server/test/smoke-s2.ts           # доска, локи, крафт
```

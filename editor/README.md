# Редактор базы MultiAlchemy

Локальное оконное приложение для правки игрового контента. **Не входит в сборку игры**
и не нужен для запуска сервера или клиента.

## Что редактирует

Файлы в `server/src/data/`:

| Файл | Содержимое |
| :--- | :--- |
| `elements.json` | Элементы: id, имя, иконка, флаг `isBase` |
| `recipes.json` | Рецепты: два ингредиента → результат |
| `hints.json` | Косвенные подсказки для результатов рецептов |

Перед записью на диск выполняется та же валидация, что в `server/src/data/validate.ts`.

## Запуск

Из корня репозитория:

```powershell
npm run dev:editor
```

Откроется окно **Electron**. Не открывайте `http://localhost:5174` в браузере —
локальный API редактора доступен только при запущенном Electron.

Сборка UI (без dev-сервера Vite):

```powershell
npm run build -w editor
npm run start -w editor
```

## Зависимости от игры

| Пакет / путь | Зачем |
| :--- | :--- |
| `@multialchemy/shared` | Типы `Element`, `Recipe` |
| `server/src/data/*.json` | Целевые файлы для чтения и записи |

Изменения в `shared/src/types.ts` или структуре JSON могут потребовать правок редактора.

## Структура пакета

```
editor/
  electron/main.mjs   — окно Electron + локальный API (порт 3847)
  src/                — React-интерфейс
  package.json
```

Порт API: `127.0.0.1:3847` (только localhost).

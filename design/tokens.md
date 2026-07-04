# Design tokens — Multiplayer Alchemy

Источник: Google Stitch MCP. Все значения извлечены из ответа Stitch, не придуманы.

* **Stitch project:** `projects/1100930816340343959` («Multiplayer Alchemy»)
* **Экран лобби, screenId:** `2bcf4924aa7d40979a446765039e98c7` (title: «Multiplayer Alchemy Lobby», DESKTOP, 1440px)
* **Дизайн-система Stitch:** «Arcane Synthesis», asset `assets/c9f2acd11d224186a187b13f86aae942` (использовать в D2 через параметр `designSystem` для консистентности)
* Выгрузки: `design/lobby.html` (HTML-код экрана из Stitch), `design/lobby.png` (рендер этой выгрузки, 1440×900)

## Палитра (theme.namedColors, colorMode: DARK)

Стиль: dark fantasy alchemy — глубокие пурпурные/полуночные фоны, тёплые янтарно-золотые акценты, глассморфизм.

| Токен | HEX | Использование |
| :--- | :--- | :--- |
| `background` / `surface` | `#19120b` | Фон страницы |
| `surface-container-lowest` | `#130d07` | Самые тёмные инсеты (фон инпутов) |
| `surface-container-low` | `#211a13` | Низкие контейнеры |
| `surface-container` | `#261e17` | Контейнеры |
| `surface-container-high` | `#302921` | Приподнятые контейнеры |
| `surface-container-highest` / `surface-variant` | `#3c332b` | Максимально приподнятые |
| `on-background` / `on-surface` | `#efe0d4` | Основной текст |
| `on-surface-variant` | `#d8c3b0` | Вторичный текст |
| `outline` | `#a08e7c` | Обводки, плейсхолдеры |
| `outline-variant` | `#534435` | Слабые обводки/разделители |
| `primary` | `#ffd09f` | Акцентный текст/заголовок (янтарный) |
| `primary-container` | `#ffab40` | **Фон primary-кнопки (Create Room)** |
| `on-primary-fixed` | `#2b1700` | Текст на primary-кнопке |
| `on-primary` | `#482900` | Текст на primary |
| `secondary` | `#d3bcf9` | Сиреневый акцент (лейблы, код комнаты) |
| `secondary-container` | `#4f3d71` | Фиолетовые контейнеры |
| `on-secondary-container` | `#c1abe7` | Текст на фиолетовых контейнерах |
| `tertiary` | `#d8d6f1` | Третичный акцент |
| `error` | `#ffb4ab` | Ошибки (текст) |
| `error-container` | `#93000a` | Фон ошибок |
| `on-error-container` | `#ffdad6` | Текст на фоне ошибок |

Override-цвета темы Stitch: primary `#ffab40`, secondary `#2d1b4d`, tertiary `#1a1a2e`.

## Шрифты (theme.typography)

Подключение: Google Fonts — `Playfair Display`, `Inter`, `Montserrat`, иконки `Material Symbols Outlined`.

| Роль | Шрифт | Размер / насыщенность |
| :--- | :--- | :--- |
| `display-lg` (заголовок «Multiplayer Alchemy») | Playfair Display | 48px / 700, line-height 1.1, letter-spacing −0.02em |
| `headline-md` | Playfair Display | 32px / 600, lh 1.2 |
| `headline-sm` (инпут кода комнаты) | Playfair Display | 24px / 600, lh 1.3, tracking 0.2em, uppercase |
| `body-lg` | Inter | 18px / 400, lh 1.6 |
| `body-md` (инпуты, подзаголовок) | Inter | 16px / 400, lh 1.6 |
| `label-bold` (кнопки, лейблы) | Montserrat | 14px / 700, lh 1.0, letter-spacing 0.05em, uppercase |
| `label-sm` (футер карточки) | Montserrat | 12px / 500, lh 1.0 |

## Отступы и радиусы (theme.spacing / borderRadius)

* Spacing: `unit/xs = 4px`, `sm = 8px`, `md = 16px`, `lg = 24px`, `xl = 48px`, `gutter = 20px`, `container-max = 1440px`. Базовая сетка 8px; внутренний паддинг карточек — минимум 24px.
* Радиусы (roundness ROUND_EIGHT): `DEFAULT = 0.25rem`, `lg = 0.5rem` (кнопки и инпуты), `xl = 0.75rem` (главная glass-карточка), `full = 9999px` (пилюли/аватары).

## Стили компонентов (из style guidelines «Arcane Synthesis» и lobby.html)

* **Glass-панель (карточка лобби):** `background: rgba(45, 27, 77, 0.4)` + `backdrop-filter: blur(12px)`, `border-top: 1px solid rgba(255,255,255,0.2)` (световая кромка), `box-shadow: 0 10px 30px rgba(0,0,0,0.5)`; ширина карточки лобби `max-width: 520px`, паддинг `48px`, радиус `xl`.
* **Primary-кнопка (Create Room):** фон `#ffab40`, текст `#2b1700`, Montserrat 14px/700 uppercase, радиус `lg`, паддинг по вертикали 24px; свечение `box-shadow: 0 0 20px rgba(255,171,64,0.4)`, при hover — `0 0 30px rgba(255,171,64,0.6)` + `scale(1.02)`; при нажатии `scale(0.95)`.
* **Secondary-кнопка (Join):** ghost-стиль — прозрачный фон, `border: 2px solid rgba(255,208,159,0.4)` (primary/40), текст `#ffd09f`, hover — фон `rgba(255,208,159,0.1)`.
* **Инпут имени:** фон `#130d07` (`surface-container-lowest`), `border: 2px` `outline`/20%, радиус `lg`, паддинг `16px` (+иконка слева), фокус — бордер `primary`; `maxlength="20"`, плейсхолдер `outline`/40%.
* **Инпут кода комнаты:** фон `surface-container`/30%, `border: 2px rgba(255,255,255,0.1)`, текст по центру Playfair Display 24px, tracking 0.2em, цвет `secondary` `#d3bcf9`, uppercase, `maxlength="6"`, фокус — бордер `secondary`.
* **Фон экрана:** глубокий пурпур/полуночная синева (WebGL-шейдер в lobby.html: базовые цвета `vec3(0.05,0.02,0.1)` и `vec3(0.02,0.05,0.1)`, золотые частицы `vec3(1.0,0.7,0.3)`); допустимая статичная замена — градиент этих цветов поверх `#19120b`.
* **Разделитель формы:** линии `border-primary/20` с иконкой `auto_awesome` по центру.
* **Анимации:** shimmer по карточке (10s linear rotate), float для логотипа (4s ease-in-out ±10px).
* **Chips элементов (задел на D2, из style guidelines):** rounded-pill, glow-бордер 2px.

## Прочее

* Тёмная тема (`colorMode: DARK`), `html.dark`, Tailwind-токены в `lobby.html` (`tailwind.config`) — полное соответствие таблицам выше.
* Верхняя навигация и футер-виджеты («Tutorial», счётчик онлайна, кнопка звука) — декоративные элементы выгрузки; обязательная функциональная часть лобби: имя (20 симв.), Create Room, код (6 симв.) + Join.

---

## Game screen (фаза D2)

Источник: Stitch, тот же проект `projects/1100930816340343959`, дизайн-система «Arcane Synthesis» (`assets/c9f2acd11d224186a187b13f86aae942`).

* **Экран игровой комнаты, screenId:** `843da9d8d8bb4794935323b2e7eb54e6` (title: «Multiplayer Alchemy Game Room», DESKTOP, выгрузка 2560×2048)
* Выгрузки: `design/game.html` (HTML-код из Stitch), `design/game.png` (рендер, ширина 1440)
* Палитра и типографика — те же, что в таблицах выше (`tailwind.config` в `game.html` идентичен лобби).

### Компоновка (из game.html)

* Каркас: фиксированная шапка (`header`, высота ~80px, прозрачный фон, паддинги `px-24 py-16`), под ней `main` с горизонтальным layout: узкий декоративный сайднав 80px (glass-панель) → центральная доска (`flex-1`) → правый сайдбар 320px. Зазоры `gap: 16px`, внешний паддинг 16px.
* **Glass-панель (доска, сайдбар):** `background: rgba(45,27,77,0.4)` + `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255,255,255,0.1)`, радиус `rounded-3xl` (1.5rem) для крупных секций.
* **Glass-пилюля (чипы, бейджи):** `background: rgba(255,255,255,0.05)` + `backdrop-filter: blur(8px)`, `border: 1px solid rgba(255,255,255,0.15)`, радиус `full`.

### Шапка (top bar)

* **Бейдж кода комнаты:** glass-пилюля `px-16 py-8 rounded-full`, текст Montserrat 14/700 uppercase `tracking-widest` цвета `primary` `#ffd09f`, справа иконка `content_copy` (Material Symbols, 18px, цвет `on-surface-variant` `#d8c3b0`), hover — `bg-white/10`.
* **Индикаторы игроков:** общая glass-пилюля `px-24 py-8`; каждый игрок — точка `12×12px rounded-full` цвета игрока со свечением `shadow: 0 0 8px <цвет>/0.8` (в макете red-500 `#ef4444`, blue-500 `#3b82f6`, green-500 `#22c55e`); тултип имени — `bg-surface-container-high` `#302921`, радиус 4px, Montserrat 10px, `border-white/10`; справа разделитель `1px bg-white/10` и подпись Montserrat 12/500 uppercase `on-surface-variant`.
* **Кнопка «Clear Board»:** ghost — `border: 1.5px solid rgba(255,208,159,0.4)` (primary/40), радиус `lg` (0.5rem), паддинг `24×8`, текст Montserrat 14/700 цвета `primary`; hover — `bg-primary/10` + бордер `primary`; active — `scale(0.95)`.

### Доска

* Фон доски: glass-панель + паттерн «arcane grid»: `radial-gradient(circle at 1px 1px, rgba(255,171,64,0.05) 1px, transparent 0)`, `background-size: 40px 40px`.
* **Чип элемента:** glass-пилюля `px-16 py-8 rounded-full`, внутри эмодзи (`font-size: 18px`) + подпись Montserrat 14/700 uppercase; `cursor: grab`; hover — свечение `glow-amber: 0 0 20px rgba(255,171,64,0.3)`.
* **Чип под локом (тащит другой игрок):** обводка и свечение цветом владельца — `border-color: <цвет игрока>/0.8`, `box-shadow: 0 0 15px <цвет>/0.6`, `scale(1.1)`, `z-index` выше; над чипом плашка имени владельца: фон цвета игрока, белый текст 9px uppercase bold, радиус 4px.
* **Курсор другого игрока:** SVG-стрелка 24×24, залитая цветом игрока (`#ef4444` / `#3b82f6`), рядом плашка имени: фон цвета игрока, белый текст Montserrat 10px bold uppercase, радиус 4px, `shadow-lg`; плавное движение `transition-all duration-200`.

### Сайдбар (библиотека)

* Панель: glass-панель `rounded-3xl p-24`, ширина 320px, на всю высоту; заголовок «Grimoire» Playfair Display 24/600 `primary` + подзаголовок Montserrat 12/500 uppercase `on-surface-variant`.
* **Поиск:** инпут на всю ширину, фон `surface-container-low` `#211a13`, без бордера, радиус `xl` (0.75rem), паддинг `16px` (слева 48px под иконку `search`), плейсхолдер `on-surface-variant`/40; фокус — `ring 2px primary`.
* **Сетка элементов:** `grid-cols-2 gap-8`, скролл по вертикали; карточка — glass-пилюля `p-16 rounded-xl`, вертикально: эмодзи 24px + имя Montserrat 12/500 uppercase; hover — `bg-white/10`; выделенный/новый элемент — `bg-primary/20` + бордер `primary`, текст `primary`; недоступный вид — `opacity-50 grayscale`.
* **Прогресс:** блок отделён `border-t border-white/10`; слева лейбл Montserrat 14/700 uppercase `on-surface-variant`, справа счётчик «12 / 58» тем же шрифтом цвета `primary`; прогресс-бар: трек `h-8px bg-surface-container-high rounded-full` с shimmer-анимацией (линейный блик `rgba(255,255,255,0.2)`, 2s infinite), заполнение `bg-primary-container` `#ffab40` `rounded-full`.

### Тост

* Позиция: поверх доски слева внизу (`bottom/left: 24px`).
* Контейнер: glass-панель `px-16 py-8 rounded-xl` + акцент `border-left: 4px solid primary` `#ffd09f`, `shadow-2xl`; слева круглая иконка: фон `primary-container` `#ffab40`, внутри `auto_awesome` (FILL 1, 18px, цвет `on-primary-container` `#6e4200`).
* Текст: верхняя строка «New Discovery» Montserrat 12/500 uppercase `on-surface-variant`; нижняя — Montserrat 14/700 `on-surface`, имя элемента выделено цветом `primary`.

### Примечания для C2/C3

* Декоративные элементы выгрузки, не входящие в функциональный объём: левый сайднав 80px, иконки settings/account в шапке, кнопка «Invite Friends», watermark «AetherAlchemist» на доске, состояние `opacity-50 grayscale` у карточки. Обязательная часть: бейдж кода (копирование), точки игроков с тултипами, «Clear Board», доска с чипами/курсорами/локами, поиск + сетка элементов + счётчик прогресса, тосты открытий.
* Цвета игроков в макете иллюстративные — использовать `PLAYER_COLORS` из shared-констант, сохраняя приём «цвет игрока = цвет точки/обводки/курсора/плашки».

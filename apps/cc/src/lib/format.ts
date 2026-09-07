import { TZ } from "@mydon/shared";

/** Дата и время по-ташкентски: панель и бот должны показывать одно и то же. */
export function when(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Давность одной фразой: «5 минут назад», «3 часа назад», «12 дней назад».
 *
 * `now` — ПАРАМЕТРОМ, а не `new Date()` внутри, по двум причинам. Первая — та
 * же, что у доски рутин (`lib/crons.ts`) и сетки агентов: считать надо от
 * времени CORE (`AppsHealth.now`, `AgentsStatus.now`), иначе на границе суток
 * панель подпишет вчерашнюю проверку сегодняшним днём. Вторая — тест: функция
 * от аргументов проверяется границами, а функция от часов машины протухает, и
 * ассерт «2 дня назад» покраснел бы сам через две недели.
 */
export function ago(iso: string, now: Date): string {
  const прошло = now.getTime() - new Date(iso).getTime();
  // Мусор вместо даты — прочерк, а не «NaN дней назад»: тот же довод, что у
  // `count()` ниже — русскую фразу с числом владелец прочитает как ЧАСТЬ
  // ОТЧЁТА, а не как отказ разобрать данные.
  if (!Number.isFinite(прошло)) return "—";
  // Отрицательная разница — это отметка «из будущего», и она нормальна: часы
  // Core и момент, попавший в снимок, расходятся на секунды при любом запросе.
  // «−1 минуту назад» не фраза, а свежее «только что» здесь ближе к правде.
  const минут = Math.floor(Math.max(прошло, 0) / 60_000);
  if (минут < 1) return "только что";
  if (минут < 60) return `${минут} ${plural(минут, "минуту", "минуты", "минут")} назад`;
  const часов = Math.floor(минут / 60);
  if (часов < 24) return `${часов} ${plural(часов, "час", "часа", "часов")} назад`;
  // Сутки — САМАЯ КРУПНАЯ единица. Недель и месяцев не заводим: «45 дней
  // назад» владелец сравнивает в уме с порогом («месяц не проверялось»), а
  // «1 месяц назад» прячет разницу между 31 и 59 днями — ровно то, ради чего
  // давность и печатается. Сутки считаются ПРОШЕДШИМ временем, а не разницей
  // календарных дат: календарь дал бы «1 день назад» через две минуты после
  // полуночи.
  const дней = Math.floor(часов / 24);
  return `${дней} ${plural(дней, "день", "дня", "дней")} назад`;
}

/**
 * Сумма с разделителями разрядов. Валюта проекта — сум.
 *
 * ОСТАЁТСЯ С U+00A0 НАМЕРЕННО. Числа, которые владелец КОПИРУЕТ и сверяет с
 * ботом, печатают `count()`/`amount()` — они NBSP срезают. Здесь неразрывный
 * пробел уместен: `money()` зовут 42 раза, в основном в GLOBERENT и финансах,
 * где число читают глазами, а не ищут поиском по странице. Снек-контур на неё
 * больше не опирается (срез «Хвосты», R-H-3) — если новый снек-лист позовёт
 * `money()`, это регрессия, а не выбор, и её ловит `snack-format.test.tsx`.
 */
export function money(amount: string | number, currency = "UZS"): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  return `${n.toLocaleString("ru-RU")} ${currency === "UZS" ? "сум" : currency}`;
}

/**
 * Сумма по валютам: складывать разные валюты в одно число нельзя (UZS и USD —
 * не одна цифра). Группируем по валюте и показываем каждую отдельно
 * («1 500 000 сум · 2 000 USD»). Пустой список — «0 сум».
 */
export function moneyByCurrency(rows: readonly { amount: string | number; currency: string }[]): string {
  const byCur = new Map<string, number>();
  for (const r of rows) {
    const n = typeof r.amount === "string" ? Number(r.amount) : r.amount;
    if (!Number.isFinite(n)) continue;
    byCur.set(r.currency, (byCur.get(r.currency) ?? 0) + n);
  }
  if (byCur.size === 0) return money(0);
  // Сначала сум (основная валюта), потом прочие по алфавиту — порядок стабилен.
  return [...byCur.entries()]
    .sort((a, b) => (a[0] === "UZS" ? -1 : b[0] === "UZS" ? 1 : a[0].localeCompare(b[0])))
    .map(([currency, amount]) => money(amount, currency))
    .join(" · ");
}

/** Есть ли ненулевая сумма хоть в одной валюте — для подсветки плитки. */
export function hasMoney(rows: readonly { amount: string | number }[]): boolean {
  return rows.some((r) => {
    const n = typeof r.amount === "string" ? Number(r.amount) : r.amount;
    return Number.isFinite(n) && n !== 0;
  });
}

/**
 * Число с разделителями разрядов и БЕЗ неразрывного пробела.
 *
 * `toLocaleString("ru-RU")` разделяет тройки разрядов U+00A0, и скопированная
 * из панели сумма молча не находится ни поиском по странице, ни в боте (тот же
 * баг чинит `formatAmount` в apps/core/src/rules/rules.ts). Листы отчётов П5b
 * показывают числа, которые владелец копирует и сверяет, поэтому пробел здесь
 * обычный; что ни один снек-лист не завёл своего форматтера мимо этого
 * правила, держит сторож `snack-format.test.tsx`.
 *
 * НЕ ЧИСЛО ОТДАЁМ КАК ЕСТЬ. Часть вызывающих кормит `count()` результатом
 * `Number(строка_из_БД)` (`sales-view.tsx`, `supply-views.tsx` — колонки
 * `numeric`, то есть на практике парсятся всегда). Раньше на этом пути стояла
 * `money()` со своим `Number.isFinite`; без него `toLocaleString("ru-RU")`
 * печатает «не число» — русскую фразу, которую владелец прочитает как ЧАСТЬ
 * ОТЧЁТА, а не как отказ разобрать данные.
 */
export function count(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return v.toLocaleString("ru-RU").replace(/\u00a0/g, " ");
}

/** Сумма («12 300 сум») тем же правилом, что `count`: без U+00A0. */
export function amount(v: number): string {
  return money(v).replace(/\u00a0/g, " ");
}

/**
 * Процент с одним знаком: «27,6 %». `null` — «—», а не «0 %»: у процента с
 * нулевой базой нет значения, и ноль читался бы как посчитанный результат.
 * Минус — типографский (U+2212), как в остальных числах панели.
 */
export function percent(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1).replace("-", "\u2212").replace(".", ",")} %`;
}

/** Голые сутки `YYYY-MM-DD` → «25.08.2026»: отчёт живёт неделями, год не лишний. */
export function day(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** Месяц `YYYY-MM` → «08.2026». */
export function month(iso: string): string {
  const [y, m] = iso.split("-");
  return y && m ? `${m}.${y}` : iso;
}

/** Слово в правильном числе: 1 автомат, 2 автомата, 5 автоматов. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

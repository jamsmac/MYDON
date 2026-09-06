/**
 * Разбор аргументов CLI `mydon` (R-A1-3).
 *
 * Свой парсер, без зависимостей: старые `tools/*.mjs` читают флаги через
 * `argv.includes(...)` и молча пропускают опечатки — здесь наоборот,
 * неизвестный флаг всегда ошибка (Р-7). Список известных флагов один на все
 * команды (а не по команде): так опечатка ловится независимо от того, к
 * какой команде она относится, а сам список остаётся в одном месте.
 */

export interface ParsedArgs {
  /** Первый токен командной строки; пустая строка, если argv пуст. */
  command: string;
  /** Всё, что не разобралось как `--флаг`, в исходном порядке. */
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Флаги, которые никогда не принимают значения: их присутствие само по себе
 * `true`, а следующий токен (если есть) остаётся позиционным аргументом.
 * Без этого списка `decide <id> approved --yes` не разобрать однозначно —
 * `--yes` перед позиционным токеном «съел» бы его как своё значение.
 */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(["yes", "json"]);

/** Все флаги, которые понимают команды CLI (раздел 4.3 спеки волны A1). */
const KNOWN_FLAGS: readonly string[] = [
  "yes",
  "json",
  "status",
  "owner",
  "owner-kind",
  "domain",
  "title",
  "description",
  "due",
  "priority",
  "source",
  "type",
  "limit",
  "agent",
  "skill",
];

const KNOWN_FLAGS_SET: ReadonlySet<string> = new Set(KNOWN_FLAGS);

/** Расстояние Левенштейна — для подсказки «возможно, вы имели в виду». */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const previous = row[j]!;
      row[j] = a[i - 1] === b[j - 1] ? diagonal : 1 + Math.min(diagonal, row[j]!, row[j - 1]!);
      diagonal = previous;
    }
  }
  return row[n]!;
}

/**
 * Ближайший известный флаг — только если правка небольшая: далёкая подсказка
 * («возможно, вы имели в виду --title» для «--zzz») вводит в заблуждение
 * больше, чем её отсутствие.
 */
function closestKnownFlag(name: string): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const known of KNOWN_FLAGS) {
    const distance = levenshtein(name, known);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = known;
    }
  }
  return bestDistance <= 2 ? best : undefined;
}

function unknownFlagError(name: string): Error {
  const suggestion = closestKnownFlag(name);
  return new Error(
    suggestion
      ? `неизвестный флаг --${name}; возможно, вы имели в виду --${suggestion}`
      : `неизвестный флаг --${name}`,
  );
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const command = argv[0] ?? "";
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const body = token.slice(2);
    const eq = body.indexOf("=");
    const name = eq >= 0 ? body.slice(0, eq) : body;
    const inlineValue = eq >= 0 ? body.slice(eq + 1) : undefined;

    if (!KNOWN_FLAGS_SET.has(name)) throw unknownFlagError(name);

    if (BOOLEAN_FLAGS.has(name)) {
      // `--yes=false` — редкий случай, но честнее явно уважить его, чем
      // молча превращать в true наравне с `--yes`.
      flags[name] = inlineValue === undefined ? true : inlineValue !== "false" && inlineValue !== "0";
      continue;
    }

    if (inlineValue !== undefined) {
      flags[name] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[name] = next;
      i++; // значение потреблено — следующий токен уже не позиционный.
    } else {
      // Флаг дан без значения (в конце строки или перед другим флагом) —
      // тоже `true`; вызывающая команда сама решает, годится ли это как
      // «значение не задано».
      flags[name] = true;
    }
  }

  return { command, positional, flags };
}

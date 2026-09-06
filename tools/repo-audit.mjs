#!/usr/bin/env node
/**
 * Аудит репозитория MYDON (волна R, R-R-7): что накопилось и требует решения.
 *
 * ЗАЧЕМ. Мусор в репозитории копится тихо и по частям: ветка, которую забыли
 * снести, worktree после разбора аварии, спека без записанного решения, план
 * без леджера, миграция мимо журнала. По одному это мелочь, вместе — состояние,
 * в котором «git cherry врёт», а `git log` перестаёт быть источником правды
 * (31.08 на такую уборку ушёл отдельный блок аудита). Раз в неделю дешевле.
 *
 * ЧТО ДЕЛАЕТ. Только ЧИТАЕТ репозиторий (git — через `--porcelain`/`for-each-ref`,
 * файлы — через `fs`), собирает семь находок и печатает готовую секцию. Без
 * `--dry-run` дописывает её в `memory/open-questions.md` — это единственная
 * запись скрипта и единственный файл, который он трогает.
 *
 * Запуск: node tools/repo-audit.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Часовой пояс проекта: дата секции считается по Ташкенту, а не по UTC. */
const TZ = "Asia/Tashkent";
const ЗАГОЛОВОК = "Аудит репо";
const ДЕНЬ_МС = 86_400_000;
const ВЕТКА_ДНЕЙ = 30;
const ВОПРОС_ДНЕЙ = 60;
const ОБРАЗЕЦ_ФАЙЛОВ = 10;
const ХВОСТ_ПАСПОРТОВ = 20;
const ФАЙЛ_ВОПРОСОВ = "memory/open-questions.md";

/**
 * Обёртка над `execFileSync`: код возврата возвращается, а не бросается.
 *
 * Аудит обязан дойти до конца при любой находке — падение `check:passports`
 * это САМА находка, а не повод оборвать отчёт. Через неё же тест подменяет все
 * внешние вызовы, не трогая настоящий git.
 */
function runCommand(file, args, options = {}) {
  try {
    const stdout = execFileSync(file, args, {
      cwd: options.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
    return { code: 0, stdout };
  } catch (e) {
    // Команды может не быть вовсе (`ENOENT`) — тогда `status` пуст, а сообщение
    // единственное, что можно показать владельцу.
    const код = typeof e?.status === "number" ? e.status : 1;
    const вывод = `${e?.stdout ?? ""}${e?.stderr ?? ""}` || String(e?.message ?? e);
    return { code: код, stdout: вывод };
  }
}

/** `YYYY-MM-DD` по Ташкенту (`en-CA` даёт ровно этот порядок). */
function датаТашкент(now) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const днейС = (now, момент) => Math.floor((now.getTime() - момент.getTime()) / ДЕНЬ_МС);

function читать(файл) {
  try {
    return fs.readFileSync(файл, "utf8");
  } catch {
    return null;
  }
}

function список(каталог) {
  try {
    return fs.readdirSync(каталог).sort();
  } catch {
    return [];
  }
}

/**
 * Ветки в `origin` старше 30 дней.
 *
 * `origin/main` и `origin/HEAD` пропускаются всегда: main живёт вечно по
 * определению, а HEAD — не ветка, а указатель на неё, и в списке он дал бы
 * дубль самой свежей ветки.
 */
function ветки(now, exec, cwd) {
  const r = exec("git", ["for-each-ref", "--format=%(refname:short) %(committerdate:unix)", "refs/remotes/origin"], { cwd });
  if (r.code !== 0) return [];
  const итог = [];
  for (const строка of r.stdout.split("\n")) {
    const [name, unix] = строка.trim().split(/\s+/);
    if (!name || !unix) continue;
    if (name === "origin/main" || name === "origin/HEAD") continue;
    const days = днейС(now, new Date(Number(unix) * 1000));
    if (Number.isFinite(days) && days > ВЕТКА_ДНЕЙ) итог.push({ name, days });
  }
  return итог.sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));
}

/**
 * Рабочие деревья, КРОМЕ того, из которого запущен аудит: сам репозиторий —
 * не находка, а место работы. Остальные — забытые разборы аварий.
 */
function worktrees(exec, cwd) {
  const r = exec("git", ["worktree", "list", "--porcelain"], { cwd });
  if (r.code !== 0) return [];
  // git печатает РАЗЫМЕНОВАННЫЙ путь: на macOS `/tmp` — симлинк на `/private/tmp`,
  // и сравнение с сырым `cwd` не узнало бы собственное дерево.
  let свой = cwd;
  try {
    свой = fs.realpathSync(cwd);
  } catch {
    // каталога нет — сравниваем как есть
  }
  return r.stdout
    .split("\n")
    .filter((s) => s.startsWith("worktree "))
    .map((s) => s.slice("worktree ".length).trim())
    .filter((p) => p.length > 0 && p !== cwd && p !== свой);
}

/** Неотслеживаемые файлы: только `??`, счёт целиком и первые 10 путей. */
function неотслеживаемые(exec, cwd) {
  const r = exec("git", ["status", "--porcelain", "--untracked-files=all"], { cwd });
  if (r.code !== 0) return { count: 0, sample: [] };
  const пути = r.stdout
    .split("\n")
    .filter((s) => s.startsWith("?? "))
    // Пути с пробелами и кириллицей git отдаёт в кавычках — снимаем их, иначе
    // отчёт читается как строка кода, а не как путь.
    .map((s) => s.slice(3).trim().replace(/^"(.*)"$/, "$1"));
  return { count: пути.length, sample: пути.slice(0, ОБРАЗЕЦ_ФАЙЛОВ) };
}

/**
 * Спеки без записанного решения.
 *
 * Имя спеки — `<дата>-<slug>-design.md`, имя решения — `<та же дата>-<slug>.md`
 * (конвенция репо: `2026-09-06-wave-m-docs-brain-design.md` ↔
 * `docs/decisions/2026-09-06-wave-m-docs-brain.md`). Решение без причины
 * пересматривается вслепую — правило CLAUDE.md, поэтому дыра здесь и ищется.
 */
function спекиБезРешения(root) {
  const каталог = path.join(root, "docs/superpowers/specs");
  const итог = [];
  for (const файл of список(каталог)) {
    const m = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/.exec(файл);
    if (!m) continue;
    const [, дата, хвост] = m;
    const slug = хвост.replace(/-design$/, "");
    const есть =
      fs.existsSync(path.join(root, "docs/decisions", `${дата}-${slug}.md`)) ||
      fs.existsSync(path.join(root, "docs/decisions", `${дата}-${хвост}.md`));
    if (!есть) итог.push(`docs/superpowers/specs/${файл}`);
  }
  return итог;
}

/** Планы без леджера `.superpowers/sdd/<план>/progress.md` со строкой `complete`. */
function планыБезЛеджера(root) {
  const каталог = path.join(root, "docs/superpowers/plans");
  const итог = [];
  for (const файл of список(каталог)) {
    if (!файл.endsWith(".md")) continue;
    const леджер = читать(path.join(root, ".superpowers/sdd", файл.slice(0, -3), "progress.md"));
    if (леджер === null || !леджер.split("\n").some((s) => s.includes("complete"))) {
      итог.push(`docs/superpowers/plans/${файл}`);
    }
  }
  return итог;
}

/**
 * Миграции мимо `meta/_journal.json`.
 *
 * Файл на диске без тега в журнале drizzle не применит: на проде такая
 * миграция молча не существует, а локально `schema:sync` её «делает» — ровно
 * тот разрыв, из-за которого в прод однажды вернулась мёртвая схема.
 */
function миграцииВнеЖурнала(root) {
  const каталог = path.join(root, "packages/db/drizzle");
  const сырой = читать(path.join(каталог, "meta/_journal.json"));
  let теги = new Set();
  try {
    теги = new Set((JSON.parse(сырой ?? "{}").entries ?? []).map((e) => e.tag));
  } catch {
    теги = new Set();
  }
  return список(каталог)
    .filter((f) => f.endsWith(".sql") && !теги.has(f.slice(0, -4)));
}

/** `check:passports`: код возврата плюс последние 20 строк вывода. */
function паспорта(exec, cwd) {
  const r = exec("pnpm", ["--filter", "@mydon/agents", "check:passports"], { cwd });
  const хвост = r.stdout.split("\n").filter((s) => s.trim().length > 0).slice(-ХВОСТ_ПАСПОРТОВ).join("\n");
  return { ok: r.code === 0, output: хвост };
}

/**
 * Вопросы старше 60 дней по заголовкам `## YYYY-MM-DD …`.
 *
 * Свои секции («## Аудит репо …») под шаблон не подходят по построению — дата
 * в них стоит ПОСЛЕ подписи, а не сразу за `##`, — поэтому отчёт не находит
 * сам себя и не вытесняет настоящие вопросы владельца.
 */
function староеВВопросах(root, now) {
  const текст = читать(path.join(root, ФАЙЛ_ВОПРОСОВ));
  if (текст === null) return [];
  const итог = [];
  for (const строка of текст.split("\n")) {
    const m = /^##\s+(\d{4}-\d{2}-\d{2})(.*)$/.exec(строка);
    if (!m) continue;
    const heading = `${m[1]}${m[2]}`.trim();
    const days = днейС(now, new Date(`${m[1]}T00:00:00Z`));
    if (Number.isFinite(days) && days > ВОПРОС_ДНЕЙ) итог.push({ heading, days });
  }
  return итог.sort((a, b) => b.days - a.days);
}

export async function collectFindings(root, { now = new Date(), exec = runCommand } = {}) {
  return {
    date: датаТашкент(now),
    staleBranches: ветки(now, exec, root),
    worktrees: worktrees(exec, root),
    untracked: неотслеживаемые(exec, root),
    specsWithoutDecision: спекиБезРешения(root),
    plansWithoutLedger: планыБезЛеджера(root),
    migrationsNotInJournal: миграцииВнеЖурнала(root),
    passports: паспорта(exec, root),
    staleQuestions: староеВВопросах(root, now),
  };
}

/** Строка группы: счётчик всегда, «нет» вместо пустого списка. */
function группа(подпись, элементы, всего = элементы.length) {
  const хвост = всего > элементы.length ? ", …" : "";
  return `- ${подпись} (${всего}): ${элементы.length > 0 ? элементы.join(", ") + хвост : "нет"}`;
}

/** Находки → секция markdown. Чистая функция: печать и запись её не касаются. */
export function renderAudit(findings) {
  const строки = [
    `## ${ЗАГОЛОВОК} ${findings.date}`,
    "",
    группа("Ветки старше 30 дней", findings.staleBranches.map((b) => `${b.name} — ${b.days} дн`)),
    группа("Worktrees", findings.worktrees),
    группа("Неотслеживаемые файлы", findings.untracked.sample, findings.untracked.count),
    группа("Спеки без решения", findings.specsWithoutDecision),
    группа("Планы без леджера", findings.plansWithoutLedger),
    группа("Миграции вне журнала", findings.migrationsNotInJournal),
    findings.passports.ok
      ? "- Паспорта: ок"
      : // Многострочный вывод укладываем отступом внутрь пункта: иначе вторая
        // строка вывалилась бы из списка и разорвала секцию.
        `- Паспорта: ПРОБЛЕМЫ — ${findings.passports.output.trim().split("\n").join("\n  ")}`,
    группа("Вопросы старше 60 дней", findings.staleQuestions.map((q) => `${q.heading} — ${q.days} дн`)),
  ];
  return `${строки.join("\n")}\n`;
}

/**
 * Секция за дату — одна: повтор в тот же день ЗАМЕНЯЕТ прошлую, а не копит
 * ленту одинаковых отчётов, из-за которой файл вопросов перестают читать.
 */
export function upsertSection(markdown, date, section) {
  const тело = section.endsWith("\n") ? section : `${section}\n`;
  const заголовок = `## ${ЗАГОЛОВОК} ${date}`;
  const строки = markdown.split("\n");
  const начало = строки.findIndex((s) => s.trimEnd() === заголовок);
  if (начало === -1) {
    const голова = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
    return `${голова}\n${тело}`;
  }
  let конец = начало + 1;
  while (конец < строки.length && !строки[конец].startsWith("## ")) конец += 1;
  const голова = строки.slice(0, начало).join("\n");
  const хвост = строки.slice(конец).join("\n");
  return `${голова}${тело}${хвост.length > 0 ? `\n${хвост}` : ""}`;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const сухой = process.argv.includes("--dry-run");
  const findings = await collectFindings(root, {});
  const секция = renderAudit(findings);
  process.stdout.write(`${секция}\n`);
  if (сухой) return;
  const файл = path.join(root, ФАЙЛ_ВОПРОСОВ);
  const текст = читать(файл);
  if (текст === null) {
    console.error(`Нет ${ФАЙЛ_ВОПРОСОВ} — секцию писать некуда, отчёт выше остаётся только в stdout.`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(файл, upsertSection(текст, findings.date, секция));
  console.log(`Секция «${ЗАГОЛОВОК} ${findings.date}» записана в ${ФАЙЛ_ВОПРОСОВ}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

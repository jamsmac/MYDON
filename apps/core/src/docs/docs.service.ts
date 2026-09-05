import { readdir, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { agent, agentSkillCatalog } from "@mydon/db";
import { asc, isNull } from "drizzle-orm";
import type { Request } from "express";
import { personalVisible } from "../common/owner-enforcement";
import { DB, type Db } from "../db/db.module";
import {
  buildGraph,
  DOCS_ROOTS,
  isPersonalDoc,
  normalizeDocPath,
  repoRootFrom,
  rootOf,
  titleOf,
  type DocFile,
  type DocsGraph,
  type DocsRootSpec,
  type DocsTreeItem,
  type GraphAgent,
  type GraphSkillRow,
} from "./docs-graph";

/** Дольше — панель показывала бы вчерашний образ; чаще — лишний обход диска. */
const CACHE_MS = 60_000;

/** Потолок на один документ. Самый большой файл репо 06.09 — 243 КБ. */
const MAX_FILE_BYTES = 512 * 1024;

/** Каталоги, в которые не спускаемся никогда: там не документы, а мусор сборки. */
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", ".turbo", "coverage"]);

/** Массив строк из jsonb-колонки: в базе может лежать что угодно, включая null. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

/**
 * Документы репозитория с диска образа (Р-2, R-M-2/3/4).
 *
 * Docker-образ собирается `COPY . .`, поэтому в рантайме рядом с Core лежит
 * весь репозиторий: `docs/`, `memory/`, `routers/`, `engine/`, паспорта агентов
 * и навыки. Панель НЕ ходит ни в GitHub, ни в файловую систему — только сюда,
 * и только по белому списку корней.
 */
@Injectable()
export class DocsService {
  /** Корень репозитория в рантайме (в образе — `/app`). */
  readonly repoRoot = repoRootFrom(__dirname);

  private treeCache: { at: number; items: DocsTreeItem[] } | null = null;
  private graphCache: { at: number; graph: DocsGraph } | null = null;

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Плоское дерево документов по белому списку, кэш 60 с (R-M-3). */
  async tree(): Promise<DocsTreeItem[]> {
    const now = Date.now();
    if (this.treeCache && now - this.treeCache.at < CACHE_MS) return this.treeCache.items;
    const files = await this.scan();
    // markdown в кэше дерева не держим: это 4+ МБ на 200 файлов ради поля,
    // которого в ответе нет.
    const items = files.map(({ markdown: _markdown, ...item }) => item);
    this.treeCache = { at: now, items };
    return items;
  }

  /**
   * Один документ по репо-относительному пути (R-M-2).
   *
   * Четыре независимых пояса: нормализация пути (traversal/абсолют), белый
   * список корней, owner-токен на личный контур и проверка, что РЕАЛЬНЫЙ путь
   * остался внутри репозитория — симлинк (в том числе на родительском
   * каталоге) увёл бы чтение куда угодно.
   */
  async file(input: string, req: Request): Promise<DocFile> {
    const rel = normalizeDocPath(input);
    if (rel === null) throw new BadRequestException("Некорректный путь документа");

    const root = rootOf(rel);
    if (root === null) throw new NotFoundException("Документ вне белого списка корней");

    // Личный контур: `SERVICE_TOKEN` общий (его держат бот и агенты), поэтому
    // содержимое `memory/**` и профиля владельца отдаём по тем же правилам,
    // что `PersonalDomainGuard` — через единый `personalVisible`. Пока
    // ужесточение выключено (дефолт), поведение прежнее.
    if (isPersonalDoc(rel) && !(await personalVisible(req, this.db))) {
      throw new ForbiddenException("Личный контур доступен только владельцу");
    }

    const abs = path.join(this.repoRoot, rel);
    const stat = await lstat(abs).catch(() => null);
    // lstat не идёт по символической ссылке: `isFile()` здесь означает
    // «обычный файл», а не «ссылка на файл».
    if (stat === null || !stat.isFile()) throw new NotFoundException("Документ не найден");

    const realRoot = await realpath(this.repoRoot);
    const real = await realpath(abs);
    if (real !== path.resolve(realRoot, rel)) {
      throw new NotFoundException("Документ не найден");
    }

    if (stat.size > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException(
        `Документ больше ${Math.round(MAX_FILE_BYTES / 1024)} КБ — открой его в репозитории`,
      );
    }

    const markdown = await readFile(abs, "utf8");
    const file: DocFile = {
      path: rel,
      root,
      title: titleOf(markdown, rel),
      bytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      markdown,
    };
    if (isPersonalDoc(rel)) file.personal = true;
    return file;
  }

  /** Граф знаний: документы с диска + агенты и каталог навыков из базы, кэш 60 с. */
  async graph(): Promise<DocsGraph> {
    const now = Date.now();
    if (this.graphCache && now - this.graphCache.at < CACHE_MS) return this.graphCache.graph;
    const [files, agents, catalog] = await Promise.all([
      this.scan(),
      this.agentRows(),
      this.catalogRows(),
    ]);
    const graph = buildGraph(files, agents, catalog);
    this.graphCache = { at: now, graph };
    return graph;
  }

  /** Живые карточки агентов: архивные из графа выпадают вместе с их навыками. */
  private async agentRows(): Promise<GraphAgent[]> {
    const rows = await this.db
      .select({
        name: agent.name,
        business: agent.business,
        skills: agent.skills,
        kbPages: agent.kbPages,
      })
      .from(agent)
      .where(isNull(agent.archivedAt))
      .orderBy(asc(agent.name));
    return rows.map((row) => ({
      name: row.name,
      business: row.business,
      skills: stringList(row.skills),
      kbPages: stringList(row.kbPages),
    }));
  }

  private async catalogRows(): Promise<GraphSkillRow[]> {
    const rows = await this.db
      .select({
        agentName: agentSkillCatalog.agentName,
        skill: agentSkillCatalog.skill,
        allowedTools: agentSkillCatalog.allowedTools,
      })
      .from(agentSkillCatalog)
      .orderBy(asc(agentSkillCatalog.agentName), asc(agentSkillCatalog.skill));
    return rows.map((row) => ({
      agentName: row.agentName,
      skill: row.skill,
      allowedTools: stringList(row.allowedTools),
    }));
  }

  /** Обход белого списка корней. Содержимое нужно и заголовку, и рёбрам `links`. */
  private async scan(): Promise<DocFile[]> {
    const found: DocFile[] = [];
    for (const root of DOCS_ROOTS) {
      await this.walk(root, root.dir, 1, found);
    }
    return found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  private async walk(
    root: DocsRootSpec,
    relDir: string,
    depth: number,
    out: DocFile[],
  ): Promise<void> {
    const absDir = relDir === "" ? this.repoRoot : path.join(this.repoRoot, relDir);
    // Корня может не быть (урезанный образ, свежий клон) — пустая папка не
    // должна ронять весь ответ (R-M-3).
    const entries = await readdir(absDir, { withFileTypes: true }).catch(() => null);
    if (entries === null) return;

    for (const entry of entries) {
      const rel = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
      // Символические ссылки не читаем ни как файлы, ни как каталоги: это
      // единственный дешёвый способ выйти за пределы белого списка.
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        if (depth >= root.depth) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        await this.walk(root, rel, depth + 1, out);
        continue;
      }
      if (!entry.isFile() || !root.match(rel)) continue;

      const stat = await lstat(path.join(this.repoRoot, rel)).catch(() => null);
      if (stat === null || !stat.isFile()) continue;
      // Гигантский файл в дерево попадает (его видно), но содержимое не читаем:
      // `GET /docs/file` на него всё равно ответит 413.
      const markdown =
        stat.size > MAX_FILE_BYTES
          ? ""
          : await readFile(path.join(this.repoRoot, rel), "utf8").catch(() => "");
      const item: DocFile = {
        path: rel,
        root: root.key,
        title: titleOf(markdown, rel),
        bytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        markdown,
      };
      // Метку ставим только когда она есть: лишнее `personal: false` на 200
      // строк дерева — шум в ответе и в панели.
      if (isPersonalDoc(rel)) item.personal = true;
      out.push(item);
    }
  }
}

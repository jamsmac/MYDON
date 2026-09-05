"use server";

import { core } from "../../lib/core";

/** Сколько строк документа показывает карточка узла (R-M-6). */
const PREVIEW_LINES = 40;

/**
 * Чем закончился предпросмотр документа в карточке узла.
 *
 * Отказ здесь — не ошибка экрана: «личное» и «нет файла» это разные ответы
 * владельцу, и оба нормальны. Свалить их в `null` значило бы показать над
 * личным документом «файл не найден», то есть соврать.
 */
export type DocPreview =
  | { ok: true; title: string; lines: string[] }
  | { ok: false; reason: "forbidden" | "missing" | "core" };

/**
 * Первые ~40 строк документа для карточки узла графа.
 *
 * Серверное действие, а не route handler: сервисный токен Core живёт только на
 * сервере панели, и открывать ради предпросмотра собственный прокси-эндпоинт
 * (`/api/docs/file`) значило бы завести второй, никем не охраняемый вход в
 * документы. Действие читает ровно то же, что и страница `/docs`.
 */
export async function previewDoc(path: string): Promise<DocPreview> {
  try {
    const res = await core.docFile(path);
    if (res.kind === "forbidden") return { ok: false, reason: "forbidden" };
    if (res.kind === "missing") return { ok: false, reason: "missing" };
    return {
      ok: true,
      title: res.file.title,
      // Пустой хвост не режем: обрыв на 40-й строке и так виден по многоточию
      // в карточке, а «умное» дообрезание пряталo бы часть первого абзаца.
      lines: res.file.markdown.split("\n").slice(0, PREVIEW_LINES),
    };
  } catch {
    // Core лёг — экран графа при этом целый (граф уже загружен страницей), и
    // ронять его из-за предпросмотра нельзя: сообщение уходит в карточку.
    return { ok: false, reason: "core" };
  }
}

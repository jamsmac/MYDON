import { Injectable } from "@nestjs/common";
import { agentWorkPaused } from "@mydon/shared";
import { SystemService } from "../system/system.service";
import { computeBoard, type CronBoard } from "./board";
import { RunsService } from "./runs.service";

/**
 * Тонкий слой над доской: снимок расписаний, последние прогоны и тумблеры
 * паузы. Вся логика — в `computeBoard`, здесь только три чтения.
 */
@Injectable()
export class BoardService {
  constructor(private readonly runs: RunsService, private readonly system: SystemService) {}

  async board(now = new Date()): Promise<CronBoard> {
    const [snapshot, lastRuns, config] = await Promise.all([this.runs.snapshot(), this.runs.lastPerJob(), this.system.effective()]);
    // `value` — действующее значение тумблера (база > env > дефолт). Поле
    // `effective` есть только у источника учёта (второй слой фолбэков кода);
    // у пауз его нет, и `value` здесь и означает «действует».
    //
    // ОТКАЗ В СТОРОНУ ПАУЗЫ: ключа нет или значение не «0» — считаем «на паузе».
    // Дефолт обоих тумблеров в `config-spec` равен «1», рантайм агентов читает
    // их так же (`apps/agents/src/polling.ts`), и `GET /agents/status` — тоже.
    // Разойтись эти три двери не должны: два экрана, по-разному отвечающих на
    // вопрос «парк на паузе?», хуже, чем один неправильный. Поэтому правило
    // ОДНО на всех — `agentWorkPaused` из `@mydon/shared` (C-6): до неё двери
    // уже разъехались на `trim()`, и `" 0 "` означал паузу здесь и работу там.
    const flag = (key: string): boolean => agentWorkPaused(config.find((i) => i.key === key)?.value);
    return computeBoard({
      now,
      snapshot,
      paused: { schedules: flag("AGENTS_SCHEDULES_PAUSED"), tasks: flag("AGENTS_TASKS_PAUSED") },
      lastRuns,
    });
  }
}

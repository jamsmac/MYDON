import { Injectable } from "@nestjs/common";
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
    const flag = (key: string): boolean => config.find((i) => i.key === key)?.value === "1";
    return computeBoard({
      now,
      snapshot,
      paused: { schedules: flag("AGENTS_SCHEDULES_PAUSED"), tasks: flag("AGENTS_TASKS_PAUSED") },
      lastRuns,
    });
  }
}

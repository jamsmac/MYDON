import { Controller, Get, UseGuards } from "@nestjs/common";
import { ReadTokenGuard } from "../common/read-token.guard";
import { AppsHealthService, type AppsHealthView } from "./apps-health.service";

/**
 * Здоровье приложений одним маршрутом (волна A2, R-A2-2; решение Р-6).
 *
 * ЧИТАЮЩИЙ И БЕЗ СЕКРЕТОВ: наружу едут только состояния и человеческие
 * причины — ни токенов, ни payload событий, ни строк подключения (§5 спеки).
 *
 * НО ТОКЕН ВСЁ РАВНО ОБЯЗАТЕЛЕН (круг починок, C-1). «Человеческая причина»
 * строки монитора — это `agent_run.reason`, то самое поле, ради которого волна
 * R закрыла журнал прогонов гардом, а колбэк монитора кладёт в него голый
 * `err.message` (`apps/agents/src/monitors.ts`) — с хостом и пользователем БД.
 * Guard навешен на КЛАСС, а не на маршрут: будущие `@Get` здоровья закрыты по
 * умолчанию, а не по памяти автора.
 */
@Controller("apps")
@UseGuards(ReadTokenGuard)
export class AppsController {
  constructor(private readonly apps: AppsHealthService) {}

  @Get("health")
  health(): Promise<AppsHealthView> {
    return this.apps.health();
  }
}

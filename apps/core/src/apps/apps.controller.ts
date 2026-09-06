import { Controller, Get } from "@nestjs/common";
import { AppsHealthService, type AppsHealthView } from "./apps-health.service";

/**
 * Здоровье приложений одним маршрутом (волна A2, R-A2-2; решение Р-6).
 *
 * ЧИТАЮЩИЙ И БЕЗ СЕКРЕТОВ: наружу едут только состояния и человеческие
 * причины — ни токенов, ни payload событий, ни строк подключения (§5 спеки).
 */
@Controller("apps")
export class AppsController {
  constructor(private readonly apps: AppsHealthService) {}

  @Get("health")
  health(): Promise<AppsHealthView> {
    return this.apps.health();
  }
}

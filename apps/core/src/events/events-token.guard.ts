import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { assertServiceToken } from "../common/service-token.guard";

/**
 * Токен обязателен и на ЧТЕНИЕ шины событий (волна A1, Ruling 5).
 *
 * Глобальный `ServiceTokenGuard` пропускает GET/HEAD/OPTIONS: чтения Core
 * считались безобидными внутри закрытой сети. Для ленты событий это перестало
 * быть верным. До волны A1 анонимный читатель получал только свежие 100 строк
 * на фильтр; с `until` + `order=asc` + `limit` ленту можно листать насквозь —
 * а в ней и `agent.memory:*` (о чём агенты рассуждали), и события личного
 * контура. Тот же довод, по которому закрыты `/docs/*` и `/routines/*`.
 *
 * Guard навешен на КЛАСС контроллера, а не на отдельные маршруты: новый `@Get`
 * в ленте закрыт по умолчанию, а не по памяти автора.
 */
@Injectable()
export class EventsTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertServiceToken(context.switchToHttp().getRequest<Request>());
    return true;
  }
}

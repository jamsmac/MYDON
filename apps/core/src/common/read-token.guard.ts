import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { assertServiceToken } from "./service-token.guard";

/**
 * Токен обязателен и на ЧТЕНИЕ — общая дверь для новых читающих поверхностей.
 *
 * Глобальный `ServiceTokenGuard` пропускает GET/HEAD/OPTIONS: чтения Core
 * открыты внутри закрытой сети. Волны M, A1 и R по очереди выяснили, что для
 * трёх поверхностей это не годится, и завели одинаковые guard'ы по месту
 * (`DocsTokenGuard`, `EventsTokenGuard`, `RoutinesTokenGuard`). Четвёртая
 * копия того же класса — уже не прецедент, а дубль, поэтому общий guard живёт
 * здесь, в `common/`, рядом с самим `assertServiceToken`.
 *
 * ЧТО ИМЕННО ЗАКРЫВАЕТСЯ (круг починок среза A2, C-1). `GET /agents/status` и
 * `GET /apps/health` печатают наружу `agent_run.reason` — то самое поле, ради
 * которого волна R закрыла журнал прогонов (`RoutinesTokenGuard`): в нём
 * содержательный пересказ работы агентов по делам владельца. Хуже того, колбэк
 * монитора кладёт в `reason` голый `err.message` (`apps/agents/src/monitors.ts`),
 * то есть текст драйвера с хостом и пользователем БД. Пока эти два маршрута
 * были бестокенными, `curl http://core:3001/routines/runs` отвечал 401, а
 * `curl http://core:3001/agents/status` без единого заголовка отдавал то же
 * содержимое — дверь стояла, а стена рядом отсутствовала.
 *
 * Три прежних guard'а НЕ переписываем на этот: их комментарии несут причины
 * своих волн, и правка ради единообразия стоила бы этих причин.
 */
@Injectable()
export class ReadTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertServiceToken(context.switchToHttp().getRequest<Request>());
    return true;
  }
}

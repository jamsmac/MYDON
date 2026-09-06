import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { assertServiceToken } from "../common/service-token.guard";

/**
 * Токен обязателен и на ЧТЕНИЕ журнала прогонов (волна R).
 *
 * Глобальный `ServiceTokenGuard` пропускает GET/HEAD/OPTIONS: чтения Core
 * открыты внутри закрытой сети. Для рутин это не годится — в `reason`, `action`
 * и `review` лежит содержательный пересказ работы агентов по делам владельца,
 * а спека волны требует «ничего не открывать анонимно». Guard навешен на КЛАСС
 * контроллера, поэтому будущие маршруты доски и плейбэка закрыты по умолчанию,
 * а не по памяти автора.
 */
@Injectable()
export class RoutinesTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertServiceToken(context.switchToHttp().getRequest<Request>());
    return true;
  }
}

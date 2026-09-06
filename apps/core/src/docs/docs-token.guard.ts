import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { assertServiceToken } from "../common/service-token.guard";

/**
 * Токен обязателен и на ЧТЕНИЕ документов (R-M-8).
 *
 * Глобальный `ServiceTokenGuard` пропускает GET/HEAD/OPTIONS: чтения Core
 * (реестр, продажи, задачи) открыты внутри закрытой сети. Для документов это
 * не годится — `memory/` содержит личные заметки владельца, а `docs/` —
 * внутренние решения и рунбуки. Отдельный guard на контроллере закрывает все
 * три маршрута `docs/*`, не меняя правил для остального API.
 */
@Injectable()
export class DocsTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertServiceToken(context.switchToHttp().getRequest<Request>());
    return true;
  }
}

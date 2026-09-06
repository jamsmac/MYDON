import { timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { appConfig } from "../config";
import { IS_PUBLIC } from "./public.decorator";

/** Методы только для чтения — их пропускаем: секрет нужен на изменение данных. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Сравнение в постоянное время: иначе токен подбирается по времени ответа. */
function secretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Требует внутренний токен в запросе или бросает 401.
 *
 * Вынесено из `ServiceTokenGuard` отдельной функцией, потому что маршруты
 * ДОКУМЕНТОВ (R-M-8) закрывают токеном и чтение тоже: в `memory/` лежит личное
 * владельца, и «GET открыт всем в сети Core» там неприемлемо. Копировать ради
 * этого сравнение в постоянное время и разбор двух заголовков нельзя — разошлись
 * бы две двери с одним ключом.
 */
export function assertServiceToken(req: Pick<Request, "headers">): void {
  const expected = appConfig.serviceToken;
  const header = req.headers["x-service-token"];
  const bearer = req.headers.authorization;
  const provided =
    typeof header === "string" && header.length > 0
      ? header
      : typeof bearer === "string" && bearer.startsWith("Bearer ")
        ? bearer.slice("Bearer ".length)
        : "";

  // !expected — токен не настроен вообще: ни одна пара secretEquals("", "")
  // не должна тут случайно пройти, поэтому проверяем явно и первым.
  if (!expected || provided.length === 0 || !secretEquals(provided, expected)) {
    throw new UnauthorizedException("Нужен внутренний токен доступа к Core");
  }
}

/**
 * Граница доступа Core: мутации требуют внутренний токен.
 *
 * Раньше любой, кто дотянулся до сети Core, мог менять данные — защита держалась
 * лишь на Docker/Tailscale. Теперь POST/PATCH/PUT/DELETE требуют `x-service-token`
 * (или `Authorization: Bearer`). Чтения (GET) открыты: панель и бот читают много,
 * а вреда от чтения в закрытой сети нет.
 *
 * Fail-closed: если SERVICE_TOKEN не задан, мутации ОТКАЗЫВАЮТСЯ, а не
 * пропускаются — раньше здесь был fail-open (`return true`), и любой в сети
 * Core мог писать данные без токена вообще (найдено внешним аудитом,
 * P1-риск). Перед выкатом этого guard'а SERVICE_TOKEN должен быть выставлен
 * ОДНОВРЕМЕННО в Core, CC, боте и агентах — иначе все мутации из панели/бота
 * начнут получать 401.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    // Маршруты со своей дверью (ingest с INGEST_KEY, health) — мимо.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    assertServiceToken(req);
    return true;
  }
}

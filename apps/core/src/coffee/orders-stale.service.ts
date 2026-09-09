import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { Cron } from "croner";
import { and, eq, gte } from "drizzle-orm";
import { event } from "@mydon/db";
import { tashkentDayStartOf, TZ } from "@mydon/shared";
import { DB, type Db } from "../db/db.module";
import { readIntSetting } from "../system/settings";
import { CoffeeOrdersService } from "./coffee-orders.service";

/** Тип события сторожа — им же ключуется дедуп «раз в ташкентские сутки». */
export const COFFEE_ORDERS_STALE_EVENT = "coffee.orders.stale";

/**
 * Порог по умолчанию, суток. Настройка `COFFEE_ORDERS_STALE_DAYS` его перебивает.
 *
 * Число НЕ измерено: все 57 886 заказов в базе имеют одну дату загрузки —
 * 20.08.2026, то есть был разовый бэкфилл, а ритма прогонов никогда не было.
 * 3 суток — осознанно выбранный старт, который владелец подстроит, когда ритм
 * появится; поэтому порог и живёт в настройках, а не в коде.
 */
export const COFFEE_ORDERS_STALE_DAYS_FALLBACK = 3;

/**
 * Сторож «кофе-заказы перестали приезжать».
 *
 * ЧЕМ ЭТО ОТЛИЧАЕТСЯ ОТ ТРЕВОГИ НА ОШИБКУ. Тревога «серия неудач подряд»
 * (`ourvend.sync_failed_streak`) предполагает коллектор, который САМ доложил об
 * отказе. У кофе-заказов коллектора нет вовсе: единственный источник —
 * `gjvending`, его панель закрыта капчей, и заливку делает человек руками
 * (`tools/fetch-gjvending.mjs`, шапка). Отказов поэтому не бывает — бывает
 * тишина, а отсутствие строк выглядит как спокойствие, а не как авария. Ровно
 * это уже случилось: последний заказ лёг 20.08.2026, и три недели никто не
 * заметил, что выручка по кофе не видна.
 *
 * ПОЧЕМУ В CORE, А НЕ В МОНИТОРЕ АГЕНТОВ. Наблюдатель, живущий внутри процесса,
 * чьё падение он должен пережить, — не наблюдатель: лёг контейнер агентов, и
 * молчание источника заметить некому. Та же причина, по которой рядом стоит
 * `SyncStaleService`, а не поле в отчёте.
 *
 * ПОЧЕМУ ЗОВЁМ `CoffeeOrdersService.status()`, А НЕ СВОЙ SQL. Витрина
 * `GET /coffee/orders/status` и сторож обязаны отвечать на вопрос «когда лёг
 * последний заказ» ОДНИМ числом. Своя копия запроса разошлась бы с витриной на
 * первом же уточнении — тот же довод записан у соседа про `sync-runs.ts`.
 *
 * `null` СУТОК — ТРЕВОЖНЕЕ БОЛЬШОГО ЧИСЛА. «Заказов нет вовсе» означает, что
 * заливку не делали ни разу или таблицу вычистили; молчать об этом нельзя, и
 * событие уходит со `staleDays: null`, а не с нулём.
 *
 * РЕШЕНИЕ «БУДИТЬ ИЛИ В БРИФИНГ» ПРИНИМАЮТ ПРАВИЛА (`rules.ts`) по `staleDays`
 * — как `infra.disk`/`infra.disk.watch` по `usedPercent`. Сторож только считает.
 */
@Injectable()
export class CoffeeOrdersStaleService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CoffeeOrdersStaleService.name);
  private cron: Cron | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly orders: CoffeeOrdersService,
  ) {}

  /**
   * Раз в сутки в 07:10 по Ташкенту — сразу после утреннего сбора мониторов и
   * до брифинга владельцу. Порог считается СУТКАМИ: чаще проверять нечего,
   * а дедуп всё равно пропустил бы одно событие в сутки.
   */
  onModuleInit(): void {
    this.cron = new Cron("10 7 * * *", { timezone: TZ }, () => {
      void this.check().catch((e: unknown) =>
        this.logger.warn(
          `Сторож свежести кофе-заказов не отработал: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    });
  }

  onApplicationShutdown(): void {
    this.cron?.stop();
    this.cron = null;
  }

  /**
   * Проверить давность последнего заказа и, если пора, записать событие.
   *
   * `now` — параметр, а не `new Date()` внутри: иначе «двадцать суток назад»
   * нечем проверить тестом, а дедуп по ташкентским суткам проверялся бы датой
   * прогона тестов.
   */
  async check(now = new Date()): Promise<{ staleDays: number | null; threshold: number; emitted: boolean }> {
    const [status, threshold] = await Promise.all([
      this.orders.status(),
      readIntSetting(this.db, "COFFEE_ORDERS_STALE_DAYS", COFFEE_ORDERS_STALE_DAYS_FALLBACK, this.logger),
    ]);

    const lastOrderAt = status.последний ? tashkentDate(new Date(status.последний)) : null;
    const staleDays = lastOrderAt === null ? null : сутокМежду(lastOrderAt, tashkentDate(now));

    // `null` — заказов нет вовсе, и это тревожнее, чем «последний был давно».
    if (staleDays !== null && staleDays < threshold) return { staleDays, threshold, emitted: false };

    // Дедуп — раз в ташкентские сутки, тем же приёмом, что у `SyncStaleService`.
    // Здесь он дешевле по последствиям (крон ходит раз в сутки, а не каждые 30
    // минут), но нужен так же: расписание крона — настройка, а не закон, и
    // учащение тика не должно превращать сторожа в источник спама.
    const сутки = tashkentDayStartOf(now);
    const [было] = await this.db
      .select({ id: event.id })
      .from(event)
      .where(and(eq(event.type, COFFEE_ORDERS_STALE_EVENT), gte(event.occurredAt, сутки)))
      .limit(1);
    if (было) return { staleDays, threshold, emitted: false };

    await this.db.insert(event).values({
      source: "system",
      type: COFFEE_ORDERS_STALE_EVENT,
      // Момент проверки, а не `now()` базы: дедуп сравнивает с ТЕМ ЖЕ `now`, и
      // расхождение часов процесса с базой иначе давало бы два события на
      // границе суток либо ни одного.
      occurredAt: now,
      payload: { staleDays, lastOrderAt, total: status.всего, threshold },
    });
    return { staleDays, threshold, emitted: true };
  }
}

/** YYYY-MM-DD по Ташкенту. */
function tashkentDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/**
 * Разница в календарных сутках между двумя датами YYYY-MM-DD.
 *
 * Считаем по разобранным числам через `Date.UTC`, а не вычитанием мгновений:
 * между двумя ташкентскими полуночами не всегда ровно 86 400 000 мс, и
 * «19,97 суток» округлились бы вниз до 19 — на границе порога это разница
 * между «сегодня сказали» и «сказали завтра».
 */
function сутокМежду(отISO: string, доISO: string): number {
  const [гО, мО, дО] = отISO.split("-").map(Number);
  const [гД, мД, дД] = доISO.split("-").map(Number);
  return Math.round((Date.UTC(гД, мД - 1, дД) - Date.UTC(гО, мО - 1, дО)) / 86_400_000);
}

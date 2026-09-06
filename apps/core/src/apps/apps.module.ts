import { Module } from "@nestjs/common";
import { ReadTokenGuard } from "../common/read-token.guard";
import { EventsModule } from "../events/events.module";
import { LlmLedgerModule } from "../llm-ledger/llm-ledger.module";
import { RoutinesModule } from "../routines/routines.module";
import { VendingModule } from "../vending/vending.module";
import { AppsController } from "./apps.controller";
import { AppsHealthService } from "./apps-health.service";

@Module({
  // Все четыре модуля ИМПОРТИРУЕМ, а не переобъявляем их провайдеры: второй
  // экземпляр `OurvendHealthService` завёл бы себе второй кеш отчёта (минута)
  // и сверялся бы с зеркалом ещё раз, а второй `RunsService` разошёлся бы с
  // первым по снимку расписаний. Здоровье обязано показывать те же числа, что
  // и `/ourvend/health`, `/routines/board` и `/llm-ledger/monitoring`.
  imports: [RoutinesModule, VendingModule, LlmLedgerModule, EventsModule],
  controllers: [AppsController],
  // `ReadTokenGuard` регистрируем провайдером, чтобы Nest резолвил его через
  // DI (как `DocsTokenGuard` в документах), а не создавал вслепую.
  providers: [AppsHealthService, ReadTokenGuard],
})
export class AppsModule {}

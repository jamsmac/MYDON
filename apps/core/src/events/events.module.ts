import { Module } from "@nestjs/common";
import { EventsController } from "./events.controller";
import { EventsTokenGuard } from "./events-token.guard";
import { EventsService } from "./events.service";

@Module({
  controllers: [EventsController],
  // `EventsTokenGuard` регистрируем провайдером, чтобы Nest резолвил его через
  // DI (как `DocsTokenGuard` в документах), а не создавал вслепую.
  providers: [EventsService, EventsTokenGuard],
  exports: [EventsService],
})
export class EventsModule {}

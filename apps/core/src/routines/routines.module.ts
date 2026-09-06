import { Module } from "@nestjs/common";
import { RoutinesController } from "./routines.controller";
import { RoutinesTokenGuard } from "./routines-token.guard";
import { RunsService } from "./runs.service";

@Module({
  controllers: [RoutinesController],
  // `RoutinesTokenGuard` регистрируем провайдером, чтобы Nest резолвил его через
  // DI (как `DocsTokenGuard` в документах), а не создавал вслепую.
  providers: [RunsService, RoutinesTokenGuard],
  exports: [RunsService],
})
export class RoutinesModule {}

import { Module } from "@nestjs/common";
import { SystemModule } from "../system/system.module";
import { BoardService } from "./board.service";
import { FlowsService } from "./flows.service";
import { RoutinesController } from "./routines.controller";
import { RoutinesTokenGuard } from "./routines-token.guard";
import { RunsService } from "./runs.service";

@Module({
  // `SystemModule` — ради `SystemService`: паузу расписаний и задач доска берёт
  // из тумблеров (база важнее env), а не из снимка рантайма.
  imports: [SystemModule],
  controllers: [RoutinesController],
  // `RoutinesTokenGuard` регистрируем провайдером, чтобы Nest резолвил его через
  // DI (как `DocsTokenGuard` в документах), а не создавал вслепую.
  providers: [RunsService, RoutinesTokenGuard, BoardService, FlowsService],
  exports: [RunsService],
})
export class RoutinesModule {}

import { Module } from "@nestjs/common";
import { OwnerMutationGuard } from "../common/owner-mutation.guard";
import { ReadTokenGuard } from "../common/read-token.guard";
import { RoutinesModule } from "../routines/routines.module";
import { SystemModule } from "../system/system.module";
import { TasksModule } from "../tasks/tasks.module";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";

@Module({
  // TasksModule ИМПОРТИРУЕМ, а не переобъявляем провайдер: запуск навыка из
  // панели создаёт обычную задачу (R-SD-2), и второй экземпляр TasksService
  // разошёлся бы с первым по зависимостям (ТО, шина событий, ledger).
  //
  // SystemModule — ради `SystemService`: паузы `AGENTS_TASKS_PAUSED` и
  // `AGENTS_SCHEDULES_PAUSED` состояние агентов берёт из действующих значений
  // тумблеров (база > env > дефолт), как доска рутин, а не из голой строки
  // `system_config`.
  //
  // RoutinesModule — ради `RunsService`: состояние сверяет тумблеры конфига с
  // паузами, которые рантайм агентов применил на деле (снимок расписаний, Д-3).
  imports: [TasksModule, SystemModule, RoutinesModule],
  controllers: [AgentsController],
  // `ReadTokenGuard` (маршрут `GET /agents/status`) регистрируем провайдером,
  // чтобы Nest резолвил его через DI, а не создавал вслепую.
  providers: [AgentsService, OwnerMutationGuard, ReadTokenGuard],
  exports: [AgentsService],
})
export class AgentsModule {}

import { Module } from "@nestjs/common";
import { OwnerMutationGuard } from "../common/owner-mutation.guard";
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
  imports: [TasksModule, SystemModule],
  controllers: [AgentsController],
  providers: [AgentsService, OwnerMutationGuard],
  exports: [AgentsService],
})
export class AgentsModule {}

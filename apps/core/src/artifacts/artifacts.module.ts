import { Module } from "@nestjs/common";
import { ReadTokenGuard } from "../common/read-token.guard";
import { ArtifactsController } from "./artifacts.controller";
import { ArtifactsService } from "./artifacts.service";

/**
 * Кольцо артефактов (срез A3): чтение архива вложений одним маршрутом.
 *
 * `AttachmentsModule` НЕ импортируем: витрина читает таблицу напрямую и в
 * хранилище не ходит — содержимое отдаёт существующий
 * `GET /attachments/:id/raw`. `ReadTokenGuard` — провайдером, чтобы Nest
 * резолвил его через DI (как в `AppsModule`), а не создавал вслепую.
 */
@Module({
  controllers: [ArtifactsController],
  providers: [ArtifactsService, ReadTokenGuard],
})
export class ArtifactsModule {}

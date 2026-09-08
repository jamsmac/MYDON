import { Module } from "@nestjs/common";
import { ReadTokenGuard } from "../common/read-token.guard";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";
import { StorageService } from "./storage.service";

/**
 * Вложения: приём файлов и отдача содержимого.
 *
 * `ReadTokenGuard` — ПРОВАЙДЕРОМ, чтобы Nest резолвил классовый guard
 * контроллера через DI (как в `AppsModule` и `ArtifactsModule`), а не создавал
 * его вслепую. Почему guard стоит на всём контроллере — в
 * `attachments.controller.ts`.
 */
@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, StorageService, ReadTokenGuard],
  exports: [AttachmentsService, StorageService],
})
export class AttachmentsModule {}

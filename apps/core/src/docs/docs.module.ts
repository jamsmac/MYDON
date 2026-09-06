import { Module } from "@nestjs/common";
import { DocsController } from "./docs.controller";
import { DocsTokenGuard } from "./docs-token.guard";
import { DocsService } from "./docs.service";

@Module({
  controllers: [DocsController],
  // `DocsTokenGuard` регистрируем провайдером, чтобы Nest резолвил его через DI
  // (как `SystemOwnerGuard` в системном модуле), а не создавал вслепую.
  providers: [DocsService, DocsTokenGuard],
  exports: [DocsService],
})
export class DocsModule {}

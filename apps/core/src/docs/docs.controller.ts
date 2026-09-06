import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { IsString, MaxLength, MinLength } from "class-validator";
import { DocsTokenGuard } from "./docs-token.guard";
import { DocsService } from "./docs.service";
import type { DocFile, DocsGraph, DocsTreeItem } from "./docs-graph";

/**
 * Путь документа из запроса. Длину режем до разбора: путь в этом репозитории
 * не бывает длиннее сотни символов, а мегабайтная строка в `path` — только
 * попытка нагрузить нормализацию.
 */
export class DocFileQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  path!: string;
}

/**
 * Документы и граф знаний с диска образа (Р-2/Р-3).
 *
 * Только чтение: правка документов из панели — отдельная волна (Р-6). Guard
 * на классе требует сервисный токен и на GET (R-M-8) — глобальный
 * `ServiceTokenGuard` чтения пропускает, а `memory/` открывать нельзя.
 */
@Controller("docs")
@UseGuards(DocsTokenGuard)
export class DocsController {
  constructor(private readonly docs: DocsService) {}

  @Get("tree")
  tree(): Promise<DocsTreeItem[]> {
    return this.docs.tree();
  }

  /** `req` нужен гейту личного контура: owner-токен читается из заголовка. */
  @Get("file")
  file(@Query() query: DocFileQueryDto, @Req() req: Request): Promise<DocFile> {
    return this.docs.file(query.path, req);
  }

  @Get("graph")
  graph(): Promise<DocsGraph> {
    return this.docs.graph();
  }
}

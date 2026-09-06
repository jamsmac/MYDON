import { Module } from "@nestjs/common";
import { RoutinesController } from "./routines.controller";
import { RunsService } from "./runs.service";

@Module({
  controllers: [RoutinesController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RoutinesModule {}

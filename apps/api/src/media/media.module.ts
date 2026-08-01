import { Module, forwardRef } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [forwardRef(() => JobsModule)],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}

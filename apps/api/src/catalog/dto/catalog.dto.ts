import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateTrackDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  artistName!: string;

  @IsArray()
  @IsString({ each: true })
  genres!: string[];

  @IsArray()
  @IsString({ each: true })
  styles!: string[];

  @IsOptional()
  @IsIn(["beginner", "intermediate", "advanced"])
  difficulty?: "beginner" | "intermediate" | "advanced";

  @IsOptional()
  @IsString()
  @MaxLength(8)
  originalKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(40)
  @Max(240)
  bpm?: number;

  @IsOptional()
  @IsString()
  lyricsPlain?: string;
}

export class ListTracksQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(40)
  @Max(240)
  bpmMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(40)
  @Max(240)
  bpmMax?: number;

  @IsOptional()
  @IsIn(["beginner", "intermediate", "advanced"])
  difficulty?: "beginner" | "intermediate" | "advanced";

  @IsOptional()
  @IsString()
  artist?: string;

  @IsOptional()
  @IsIn(["relevance", "newest", "bpm", "title"])
  sort?: "relevance" | "newest" | "bpm" | "title";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsIn(["published", "mine", "all"])
  scope?: "published" | "mine" | "all";
}

export class InitUploadDto {
  @IsUUID()
  trackId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  filename!: string;

  @IsString()
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  checksumSha256?: string;
}

export class CompleteUploadDto {
  @IsOptional()
  @IsBoolean()
  autoAnalyze?: boolean;
}

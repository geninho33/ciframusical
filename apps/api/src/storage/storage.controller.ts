import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { StorageService } from "./storage.service";

/**
 * Same-origin object proxy so the browser never talks to MinIO (:9002).
 * GET /v1/storage/objects?key=audio/...|sync/...|covers/...
 */
@Controller("storage")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get("objects")
  async getObject(@Query("key") key: string, @Res() res: Response) {
    if (!this.storage.assertSafeObjectKey(key)) {
      throw new BadRequestException("Invalid storage key");
    }

    const obj = await this.storage.getObjectStream(key);
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "private, max-age=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (typeof obj.contentLength === "number") {
      res.setHeader("Content-Length", String(obj.contentLength));
    }
    obj.body.pipe(res);
  }
}

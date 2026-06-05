declare module "multer-s3" {
  import { S3Client } from "@aws-sdk/client-s3";
  import { Request } from "express";
  import { StorageEngine } from "multer";

  interface Options {
    s3: S3Client;
    bucket: string | ((req: Request, file: Express.Multer.File, cb: (error: Error | null, bucket: string) => void) => void);
    acl?: string;
    cacheControl?: string;
    contentType?: (req: Request, file: Express.Multer.File, cb: (error: Error | null, mime: string) => void) => void;
    contentDisposition?: string;
    metadata?: (req: Request, file: Express.Multer.File, cb: (error: Error | null, metadata: Record<string, string>) => void) => void;
    key?: (req: Request, file: Express.Multer.File, cb: (error: Error | null, key: string) => void) => void;
  }

  interface S3File extends Express.Multer.File {
    bucket: string;
    key: string;
    acl: string;
    contentType: string;
    contentDisposition: string | null;
    storageClass: string;
    serverSideEncryption: string | null;
    metadata: Record<string, string>;
    location: string;
    etag: string;
  }

  function multerS3(options: Options): StorageEngine;
  namespace multerS3 {
    function AUTO_CONTENT_TYPE(req: Request, file: Express.Multer.File, cb: (error: Error | null, mime: string) => void): void;
  }

  export = multerS3;
}

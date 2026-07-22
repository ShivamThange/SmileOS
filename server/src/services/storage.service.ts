import { createHmac } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { logger } from "../config/logger";

/*
 * File storage service (spec 5.5). S3-compatible. Uploads use presigned PUT
 * URLs so large X-rays never traverse the API server; downloads are served via
 * short-lived presigned GET URLs generated only after a permission check. With
 * S3_* configured this signs real SigV4 URLs (Supabase Storage / S3); without
 * configuration it falls back to a local signing stub for development.
 */

export interface Presigned { url: string; key: string; expiresIn: number; stub: boolean; }

const configured = Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: { accessKeyId: env.S3_ACCESS_KEY!, secretAccessKey: env.S3_SECRET_KEY! },
      // Supabase and most S3-compatible stores require path-style addressing.
      forcePathStyle: true,
    });
  }
  return client;
}

/** Local, non-functional signature — kept only for the unconfigured dev path. */
function stubSign(method: string, key: string, expiresSec: number): Presigned {
  const exp = Math.floor(Date.now() / 1000) + expiresSec;
  const sig = createHmac("sha256", env.S3_SECRET_KEY ?? "dev").update(`${method}\n${key}\n${exp}`).digest("hex").slice(0, 32);
  return { url: `https://storage.local/${key}?X-Expires=${exp}&X-Signature=${sig}`, key, expiresIn: expiresSec, stub: true };
}

export async function presignUpload(key: string, expiresSec = 300, contentType?: string): Promise<Presigned> {
  if (!configured) return stubSign("PUT", key, expiresSec);
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: env.S3_BUCKET!, Key: key, ...(contentType ? { ContentType: contentType } : {}) }),
    { expiresIn: expiresSec },
  );
  logger.debug("Presigned upload URL issued", { key, expiresSec });
  return { url, key, expiresIn: expiresSec, stub: false };
}

export async function presignDownload(key: string, expiresSec = 120): Promise<Presigned> {
  if (!configured) return stubSign("GET", key, expiresSec);
  const url = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }), { expiresIn: expiresSec });
  return { url, key, expiresIn: expiresSec, stub: false };
}

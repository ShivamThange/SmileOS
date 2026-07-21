import { createHmac } from "node:crypto";
import { env } from "../config/env";

/*
 * File storage service (spec 5.5). S3-compatible. Uploads use presigned PUT
 * URLs so large X-rays never traverse the API server; downloads are served via
 * short-lived presigned GET URLs generated only after a permission check. This
 * is a signing stub — a real deployment swaps in the AWS SDK using S3_* config.
 */

export interface Presigned { url: string; key: string; expiresIn: number; stub: boolean; }

function sign(method: string, key: string, expiresSec: number): Presigned {
  const configured = Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY);
  const exp = Math.floor(Date.now() / 1000) + expiresSec;
  const sig = createHmac("sha256", env.S3_SECRET_KEY ?? "dev").update(`${method}\n${key}\n${exp}`).digest("hex").slice(0, 32);
  const base = env.S3_ENDPOINT ? `${env.S3_ENDPOINT}/${env.S3_BUCKET}` : "https://storage.local";
  return { url: `${base}/${key}?X-Expires=${exp}&X-Signature=${sig}`, key, expiresIn: expiresSec, stub: !configured };
}

export function presignUpload(key: string, expiresSec = 300): Presigned {
  return sign("PUT", key, expiresSec);
}
export function presignDownload(key: string, expiresSec = 120): Presigned {
  return sign("GET", key, expiresSec);
}

import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env, spacesConfigured } from "@/lib/env";

/**
 * Private object storage for student uploads. DigitalOcean Spaces (S3 API) in production,
 * a local folder in development. Paths are always "<accountId>/..." and never served publicly.
 */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class SpacesStorage implements Storage {
  private client: S3Client;
  private bucket: string;
  constructor() {
    const e = env();
    this.bucket = e.SPACES_BUCKET!;
    this.client = new S3Client({
      region: "us-east-1", // Spaces ignores the region here; the endpoint selects the datacenter.
      endpoint: `https://${e.SPACES_REGION}.digitaloceanspaces.com`,
      forcePathStyle: false,
      credentials: { accessKeyId: e.SPACES_KEY!, secretAccessKey: e.SPACES_SECRET! },
    });
  }
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ACL: "private" }));
  }
  async get(key: string) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await out.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

class LocalStorage implements Storage {
  private root = path.resolve(process.cwd(), ".data/uploads");
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("invalid storage key");
    return p;
  }
  async put(key: string, body: Buffer) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }
  async get(key: string) {
    return fs.readFile(this.resolve(key));
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

let instance: Storage | null = null;
export function storage(): Storage {
  if (instance) return instance;
  instance = spacesConfigured() ? new SpacesStorage() : new LocalStorage();
  return instance;
}

let probe: { at: number; ok: boolean; error?: string } | null = null;

/**
 * Can we write to storage right now? Cached for five minutes per process. The render stage asks
 * before spending money on audio or images, so a misconfigured key costs nothing but a log line.
 */
export async function storageWritable(): Promise<{ ok: boolean; error?: string }> {
  if (probe && Date.now() - probe.at < 5 * 60_000) return probe;
  try {
    await storage().put(`assets/_probe/${process.pid}.txt`, Buffer.from("ok"), "text/plain");
    probe = { at: Date.now(), ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    probe = { at: Date.now(), ok: false, error: /denied/i.test(msg) ? `storage write denied: the Spaces key needs Read/Write/Delete on bucket ${env().SPACES_BUCKET ?? ""}` : `storage write failed: ${msg}` };
  }
  return probe;
}

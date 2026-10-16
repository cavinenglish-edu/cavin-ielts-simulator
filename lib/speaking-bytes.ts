import "server-only";
import { createClient } from "@supabase/supabase-js";
import { mimeForSpeakingPath, readSpeakingStorageConfig } from "@/lib/speaking-recording";

export async function readSpeakingClip(path: string): Promise<{ mimeType: string; base64: string; bytes: number } | null> {
  const mimeType = mimeForSpeakingPath(path);
  const storage = readSpeakingStorageConfig(process.env);
  if (!mimeType || !storage) return null;
  try {
    const client = createClient(storage.url, storage.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const downloaded = await client.storage.from(storage.bucket).download(path);
    if (downloaded.error || !downloaded.data) return null;
    const buffer = Buffer.from(await downloaded.data.arrayBuffer());
    if (buffer.byteLength === 0) return null;
    return { mimeType, base64: buffer.toString("base64"), bytes: buffer.byteLength };
  } catch {
    return null;
  }
}

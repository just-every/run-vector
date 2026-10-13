import { z } from "zod";
import { RequestBodyError } from "../../app/input";
/** HTTP runtimes can represent a bodyless POST as a zero-byte stream. */
export async function readEmptyBody(request: Request) {
  if (!request.body) return;
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) {
      void reader.cancel();
      throw new RequestBodyError(413, "This action accepts no request fields.");
    }
    chunks.push(value);
  }
  if (!size) return;
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new RequestBodyError(
      400,
      "JSON content type is required for a supplied body.",
    );
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  z.object({})
    .strict()
    .parse(JSON.parse(new TextDecoder().decode(bytes)));
}

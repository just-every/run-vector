import { storedText, type StoredValue } from "../../shared/sql/stored-value";
/** Private external IDs become domain-separated digests of their exact SQLite
 * identity. The storage class and all bytes participate; no secret is needed
 * after credential rotation or a credentials-excluding archive restore. */
export async function erasedStoredSourceIdentity(value: StoredValue) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      "vector-source-erasure-v2\0" + JSON.stringify(value),
    ),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export const erasedSourceIdentity = (value: string) =>
  erasedStoredSourceIdentity(storedText(value));

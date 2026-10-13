import { ApiError } from "../../../app/api-client";
export function searchErrorMessage(cause: unknown) {
  const message =
    cause instanceof Error ? cause.message : "Search could not be completed.";
  if (
    cause instanceof ApiError &&
    typeof cause.body === "object" &&
    cause.body !== null &&
    "lastSuccessfulIndexAt" in cause.body
  ) {
    const at = cause.body.lastSuccessfulIndexAt;
    return `${message} Last successful index: ${typeof at === "string" ? at : "not yet completed"}.`;
  }
  return message;
}

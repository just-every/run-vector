export class ManualOrderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}
export const unavailable = () =>
  new ManualOrderError(
    "not_found",
    "The team, view or issue is unavailable.",
    404,
  );

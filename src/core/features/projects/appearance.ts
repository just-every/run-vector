import { z } from "zod";

export const projectColor = z.string().length(7)
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hexadecimal colour.")
  .transform(value => value.toLowerCase());
// Unicode's RGI set includes flags, keycaps, skin tones and joined emoji.
export const projectIcon = z.string().regex(
  new RegExp("^\\p{RGI_Emoji}(?![\\s\\S])", "v"),
  "Choose one emoji, or clear the icon.",
);

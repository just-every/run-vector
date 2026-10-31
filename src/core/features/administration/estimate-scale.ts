import { z } from "zod";

export const estimateScaleSchema = z.enum(["points", "fibonacci", "exponential", "tshirt"]);
export type EstimateScale = z.infer<typeof estimateScaleSchema>;
const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
const sizePoints = [1, 2, 3, 5, 8, 13];
export function estimateChoices(scale: EstimateScale) {
  const points = scale === "fibonacci" ? [1,2,3,5,8,13,21,34,55,89] :
    scale === "exponential" ? [1,2,4,8,16,32,64] :
    scale === "tshirt" ? sizePoints : Array.from({length:100},(_,i)=>i+1);
  return points.map((value,i)=>({value, label: scale === "tshirt" ? `${sizes[i]} (${value} points)` : `${value} points`}));
}
export function estimateLabel(value: number, scale: EstimateScale) {
  if (scale === "points") return `${value} points`;
  // Switching scales never rewrites existing estimates or frozen snapshots.
  return estimateChoices(scale).find(choice=>choice.value===value)?.label ?? `${value} points (retained)`;
}

import { estimateChoices, estimateLabel, type EstimateScale } from "../../administration/estimate-scale";

export function EstimateChoice({scale,value,onChange,disabled=false,label="Estimate"}:{scale:EstimateScale;value:string;onChange:(value:string)=>void;disabled?:boolean;label?:string}) {
  const choices=estimateChoices(scale);
  return <label>{label}{scale === "points" ? <input aria-label={label} type="number" min={1} max={100} step={1} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}/> :
    <select aria-label={label} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}>
      <option value="">Not set</option>
      {value && !choices.some(choice=>String(choice.value)===value) && <option value={value}>{estimateLabel(Number(value),scale)}</option>}
      {choices.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
    </select>}</label>;
}

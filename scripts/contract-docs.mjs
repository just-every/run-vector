import {readFileSync,writeFileSync} from 'node:fs';
import {parseContract} from '../src/base/seed-contract.mjs';

// Incremental adoption of the legacy views: only named clauses are regenerated.
// Their requirements, acceptance, evidence and gaps all come from CONTRACT.md.
const [command,...requested]=process.argv.slice(2);
if(!['write','check'].includes(command))throw Error('Use contract-docs.mjs write|check followed by the touched clause IDs.');
const read=file=>readFileSync(file,'utf8');
const original=read('CONTRACT.md'),lines=original.split('\n');
const summary=lines.findIndex(line=>line==='| Clauses | Done | Partial | Missing | Total |');
if(summary<0)throw Error('The contract needs its Status summary table.');
let end=summary+2;while(lines[end]?.startsWith('|'))end++;
const withoutSummary=[...lines.slice(0,summary),...lines.slice(end)].join('\n');
const parsed=parseContract(withoutSummary);
const tally=clauses=>['done','partial','missing'].map(status=>clauses.filter(clause=>clause.status===status).length).concat(clauses.length);
const rows=[['Published',parsed.clauses.filter(clause=>clause.kind==='published')],['Target and push further',parsed.clauses.filter(clause=>clause.kind!=='published')],['All',parsed.clauses]];
lines.splice(summary+2,end-summary-2,...rows.map(([label,clauses])=>'| '+[label,...tally(clauses)].join(' | ')+' |'));
const contract=lines.join('\n');parseContract(contract);
const acceptance=read('ACCEPTANCE.md'),claims=read('docs/CLAIMS.md');
const inherited=[...acceptance.matchAll(/<!-- contract-docs:([A-Z][A-Z0-9-]+) -->/g)].map(match=>match[1]);
const ids=[...new Set(requested.length?requested:inherited)].sort();
if(!ids.length)throw Error('Name the touched clauses for initial view generation.');
let nextAcceptance=acceptance,nextClaims=claims;
const escape=value=>value.replaceAll('|','\\|').replaceAll('\n',' ');
for(const id of ids){
 const clause=parsed.clauses.find(clause=>clause.id===id);if(!clause)throw Error('No contract clause '+id);
 const source=clause.text.split(/\*Status:\*/)[0].trim();
 const acceptanceIndex=source.indexOf('*Acceptance:*');if(acceptanceIndex<0)throw Error(id+' has no acceptance text.');
 const requirement=source.slice(0,acceptanceIndex).trim(),points=source.slice(acceptanceIndex+'*Acceptance:*'.length).trim();
 const row=withoutSummary.split('\n')[clause.row-1];
 const cells=row.split(/(?<!\\)\|/).slice(1,-1).map(cell=>cell.trim());
 const evidence=cells[4],gap=cells[5];
 const marker='<!-- contract-docs:'+id+' -->';
 const generated=`- **${id} — ${clause.title}** (${clause.status}). Requirement: ${requirement} Acceptance: ${points} Evidence: ${evidence}${gap?' Gap: '+gap:''} ${marker}`;
 const acceptanceLines=nextAcceptance.split('\n'),index=acceptanceLines.findIndex(line=>line.startsWith('- **'+id+' — '));
 if(index<0)throw Error('No legacy acceptance entry for '+id);acceptanceLines[index]=generated;nextAcceptance=acceptanceLines.join('\n');
 const claim=`| ${id} | ${clause.status} | ${escape(requirement)}${gap?' Gap: '+escape(gap):''} | ${evidence} |`;
 const claimLines=nextClaims.split('\n'),claimIndex=claimLines.findIndex(line=>line.startsWith('| '+id+' |'));
 if(claimIndex>=0)claimLines[claimIndex]=claim;else{while(claimLines.at(-1)==='')claimLines.pop();claimLines.push(claim,'');}
 nextClaims=claimLines.join('\n');
}
const outputs={'CONTRACT.md':contract,'ACCEPTANCE.md':nextAcceptance,'docs/CLAIMS.md':nextClaims};
for(const [file,text] of Object.entries(outputs)){
 if(command==='write')writeFileSync(file,text);
 else if(read(file)!==text)throw Error(file+' differs from CONTRACT.md; run the documented generator.');
}
console.log('Contract views '+(command==='write'?'generated':'checked')+' for '+ids.join(', '));

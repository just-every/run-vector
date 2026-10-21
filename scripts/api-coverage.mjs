import {readFileSync} from 'node:fs';
import {apiCoverage} from '../src/core/features/integrations/api-coverage.ts';
const report=apiCoverage(JSON.parse(readFileSync(new URL('../schema/api-v1.json',import.meta.url),'utf8')));
console.log(JSON.stringify(report,null,2));
process.exitCode=report.complete?0:1;

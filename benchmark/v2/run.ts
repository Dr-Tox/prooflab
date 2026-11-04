import { readFileSync,writeFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {LocalLinter} from 'harper.js';import {binary} from 'harper.js/binary';
import {Proofreader} from '../../src/proofreader';
import {defaults,seedWords,applyCorrection,type Issue} from '../../src/model';
const bytes=readFileSync('benchmark/v2/corpus.json');
const frozen=JSON.parse(readFileSync('benchmark/v2/FROZEN.json','utf8'));
if(createHash('sha256').update(bytes).digest('hex')!==frozen.sha256)throw Error('Frozen corpus changed');
const cases=JSON.parse(bytes.toString());
const label=process.argv.includes('--baseline')?'baseline':'improved';
const linter=new LocalLinter({binary});const engine=new Proofreader(linter,{diagnostics:true});
const setupStart=performance.now();await engine.initialize();const setupMs=performance.now()-setupStart;
const rows=[];
for(const c of cases){
 const start=performance.now();const issues=await engine.analyze(c.text,defaults(),seedWords,1);const ms=performance.now()-start;
 const grammar=issues.filter(i=>i.category==='Grammar');
 const target=c.accepted[0];let a=0,b=c.text.length,d=target?.length??b;
 if(target){while(a<b&&c.text[a]===target[a])a++;while(b>a&&d>a&&c.text[b-1]===target[d-1]){b--;d--;}}
 const relevant=grammar.filter(i=>i.start<b&&i.end>a);
 const outputs=new Set<string>();let paths=0;
 function visit(text:string,index:number,boundary:number,edits:number){if(++paths>2048)return;outputs.add(text);if(edits>=5)return;for(let n=index;n<sorted.length;n++){const i=sorted[n];if(i.end>boundary)continue;for(const r of i.replacements.slice(0,5)){try{visit(applyCorrection(text,i,r,1),n+1,i.start,edits+1);}catch{}}}}
 const sorted=[...issues].sort((a,b)=>b.start-a.start);visit(c.text,0,c.text.length,0);
 let first=c.text,boundary=c.text.length;for(const i of sorted){if(!i.replacements.length||i.end>boundary)continue;first=applyCorrection(first,i,i.replacements[0],1);boundary=i.start;}
 const number=(s:string)=>JSON.stringify(s.match(/[−-]?\d+(?:[.,]\d+)?/g)??[]);
 const hedge=(s:string)=>JSON.stringify((s.match(/\b(?:may|might|associated with|consistent with)\b/gi)??[]).map(s=>s.toLowerCase()));
 const harmful=issues.flatMap(i=>i.replacements.map(r=>applyCorrection(c.text,i,r,1))).filter(s=>number(s)!==number(c.text)||hedge(s)!==hedge(c.text)||c.forbidden.includes(s)).length;
 rows.push({...c,issues,raw:engine.getDiagnostics()?.rawLints,latencyMs:ms,detected:c.behavior==='no issue'?false:relevant.length>0,classified:relevant.length>0,complete:target?outputs.has(target):null,firstComplete:target?first===target:null,firstOutput:first,grammarFalsePositive:c.behavior==='no issue'&&grammar.length>0,anyFalsePositive:c.behavior==='no issue'&&issues.length>0,extraneousGrammar:c.behavior!=='no issue'?grammar.filter(i=>!relevant.includes(i)).length:grammar.length,harmfulProxy:harmful,duplicateCards:issues.length-new Set(issues.map(i=>`${i.start}:${i.end}:${i.replacements.join('|')}`)).size});
}
function metric(rs:any[]){const pos=rs.filter(c=>c.behavior!=='no issue'),neg=rs.filter(c=>c.behavior==='no issue'),tp=pos.filter(c=>c.detected).length,fn=pos.length-tp,fp=rs.reduce((n,c)=>n+c.extraneousGrammar,0);const precision=tp+fp?tp/(tp+fp):1,recall=pos.length?tp/pos.length:1;const corr=pos.filter(c=>c.behavior==='correction');const times=rs.map(c=>c.latencyMs).sort((a,b)=>a-b);return {cases:rs.length,positives:pos.length,negatives:neg.length,truePositiveCases:tp,falseNegativeCases:fn,extraneousGrammarCards:fp,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0,correctReplacementAndCompleteRate:corr.length?corr.filter(c=>c.complete).length/corr.length:null,firstSuggestionCompleteRate:corr.length?corr.filter(c=>c.firstComplete).length/corr.length:null,grammarFalsePositiveRate:neg.length?neg.filter(c=>c.grammarFalsePositive).length/neg.length:null,allCategoryFalsePositiveRate:neg.length?neg.filter(c=>c.anyFalsePositive).length/neg.length:null,harmfulProxyCount:rs.reduce((n,c)=>n+c.harmfulProxy,0),duplicates:rs.reduce((n,c)=>n+c.duplicateCards,0),latencyMedianMs:times[Math.floor(times.length/2)],latencyP95Ms:times[Math.floor(times.length*.95)]};}
const metrics=Object.fromEntries(['all','development','held-out','regression','agreement','verb','control','held-out-agreement','held-out-verb'].map(k=>[k,metric(rows.filter(c=>k==='all'||k===c.split||k===c.category||k===`${c.split}-${c.category}`))]));
writeFileSync(`benchmark/v2/reports/${label}.json`,JSON.stringify({version:2,label,sourceCommit:execFileSync('git',['rev-parse','HEAD']).toString().trim(),dirty:execFileSync('git',['status','--porcelain']).toString(),environment:{node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,harper:'3.0.0'},corpusSha:frozen.sha256,setupMs,memory:process.memoryUsage(),metrics,rows},null,2)+'\n');
// Aggregate held-out results only; do not expose individual cases during implementation.
console.log(JSON.stringify({label,metrics},null,2));await linter.dispose();

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('app.js','utf8'),workspace=fs.readFileSync('workspace.js','utf8');
const ctx={URL,TextEncoder,crypto:require('node:crypto').webcrypto,console};vm.createContext(ctx);
for(const name of ['queryTokens','esc','escRx','doiClean','safeUrl','estimateQuartile','classifyStance','citationContexts','relevantContext','summaryContext']){
 const start=code.indexOf('function '+name+'('),next=code.indexOf('\nfunction ',start+1),asyncNext=code.indexOf('\nasync function ',start+1);let end=Math.min(...[next,asyncNext,code.indexOf('\n$(\'',start+1),code.indexOf('\n//',start+1)].filter(n=>n>start));if(!Number.isFinite(end))end=code.length;
 // Single-line utility functions end at their newline.
 const line=code.slice(start,code.indexOf('\n',start));const text=line.endsWith('}')?line:code.slice(start,code.indexOf('\n}',start)+2);vm.runInContext(text,ctx);
}
assert.deepEqual(Array.from(vm.runInContext("queryTokens('anti-resonant HCF–SMF; Ara h1')",ctx)),['resonant','anti','hcf','smf','ara','h1']);
assert.equal(vm.runInContext("safeUrl('data:text/html,<script>alert(1)</script>')",ctx),'');
assert.equal(vm.runInContext("safeUrl('https://example.org/paper.pdf')",ctx),'https://example.org/paper.pdf');
assert.equal(vm.runInContext('estimateQuartile(130,6,100000).q',ctx),'Q1');
assert.equal(vm.runInContext('estimateQuartile(2,.1,10).q',ctx),'Q4');
assert.equal(vm.runInContext("classifyStance('does not support the proposed claim').stance",ctx),'contrasting');
assert.equal(vm.runInContext("classifyStance('inconsistent with their observation').stance",ctx),'contrasting');
assert.equal(vm.runInContext("classifyStance('consistent with one claim but contradicts the other').stance",ctx),'unknown');
ctx.target={doi:'10.1234/target',title:'A special experimental fiber sensor study'};
ctx.sample='[Page 2] The response is consistent with the earlier observation [7].\nReferences\n[7] Smith. A special experimental fiber sensor study. 10.1234/target\n[8] Other unrelated work.';
assert.equal(vm.runInContext('citationContexts(sample,target).length',ctx),1);
assert.equal(vm.runInContext("citationContexts(sample.replace('[7].','[6].'),target).length",ctx),0);
assert.equal(vm.runInContext("citationContexts('Smith 2020. No numbered references.',target).length",ctx),0);
ctx.state={reader:{pageTexts:['Introduction on optics.','Unique measurement: 980 nm wavelength at page two.','Conclusion and limitations.']}};
assert.match(vm.runInContext("relevantContext('980 wavelength',70)",ctx),/Page 2/);
assert.match(vm.runInContext('summaryContext()',ctx),/Page 3/);
console.log('PASS: tokenization, URL sanitization, negation, ambiguous stance, reference binding, missing binding, relevant-page retrieval and summary page markers.');
assert.equal(vm.runInContext("classifyStance('We did not confirm the results [7].').stance",ctx),'contrasting');
assert.equal(vm.runInContext("classifyStance(\"We couldn't replicate the results [7].\").stance",ctx),'contrasting');
assert.equal(vm.runInContext("classifyStance('Our findings are not inconsistent with [7].').stance",ctx),'unknown');
assert.equal(vm.runInContext("classifyStance('This does not contradict the proposed mechanism [7].').stance",ctx),'unknown');
ctx.target={doi:'10.1234/test',title:'Unmatched target title'};
assert.equal(vm.runInContext("citationContexts('[Page 1] We confirm the results [1].\\nReferences\\n[1] Other title 10.1234/testing',target).length",ctx),0);
assert.equal(vm.runInContext("citationContexts('[Page 1] We confirm the results [1].\\nReferences\\n[1] Other title 10.1234/test.',target).length",ctx),1);
console.log('PASS: negated support, double negation and exact DOI boundaries.');

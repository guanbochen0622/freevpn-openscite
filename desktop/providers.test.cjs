const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ProviderAccounts}=require('./providers.cjs');
const safe={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s.split('').reverse().join('')),decryptString:b=>b.toString().split('').reverse().join('')};
test('provider credentials: session, encrypted persistence, removal, no plain-text fallback',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openscite-provider-'));try{const file=path.join(dir,'keys.json'),a=new ProviderAccounts(file,safe);a.set({provider:'gemini',key:'private-test-key'});assert.equal(a.key('gemini'),'private-test-key');assert.equal(fs.readFileSync(file,'utf8').includes('private-test-key'),false);assert.equal(new ProviderAccounts(file,safe).key('gemini'),'');
 a.set({provider:'claude',key:'secret-test-key',remember:true});assert.equal(fs.readFileSync(file,'utf8').includes('secret-test-key'),false);assert.equal(new ProviderAccounts(file,safe).key('claude'),'secret-test-key');assert.equal(JSON.stringify(a.status()).includes('secret-test-key'),false);
 a.set({provider:'claude',key:''});assert.equal(new ProviderAccounts(file,safe).key('claude'),'');assert.throws(()=>a.set({provider:'other',key:'a'}));assert.throws(()=>a.set({provider:'gemini',key:'a\nb'}));
 const b=new ProviderAccounts(file,{...safe,isEncryptionAvailable:()=>false});assert.throws(()=>b.set({provider:'gemini',key:'plain',remember:true}),/安全儲存/);assert.equal(b.key('gemini'),'');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

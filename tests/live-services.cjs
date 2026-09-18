const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],services=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(/api\.(openalex|crossref)\.org/.test(r.url()))services.push({service:new URL(r.url()).hostname,status:r.status()});});
  await page.goto('https://guanbochen0622.github.io/freevpn-openscite/');
  await page.waitForSelector('#toggleReaderTools',{state:'attached'});
  await page.fill('#searchQuery','optical fiber sensor');await page.click('#searchBtn');
  await page.waitForFunction(()=>document.querySelector('#searchResults').getAttribute('aria-busy')==='false',null,{timeout:120000});
  const result=await page.evaluate(()=>({estimated:state.search.works.filter(w=>/^Q[1-4]$/.test(w.q)).length,provider:state.search.provider,count:state.search.works.length,title:state.search.works[0]?.title,doi:state.search.works[0]?.doi,status:document.getElementById('searchStatus').textContent,error:document.querySelector('#searchResults .empty-card')?.textContent}));
  console.log('LIVE SEARCH',JSON.stringify({result,services}));assert.ok(result.count>0,'Live search returned no papers: '+JSON.stringify(result));assert.ok(result.title);assert.ok(result.estimated>0,'No journal quartiles were estimated');assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/openscite-live-search.png',fullPage:true});
  console.log('PASS: deployed site, real bibliographic service, nonempty paper results, no uncaught page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

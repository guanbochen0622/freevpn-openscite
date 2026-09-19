// Opt-in rendering/index regression for local PDFs. Files stay local; no model requests.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const files=process.argv.slice(2);if(!files.length)throw Error('Usage: node tests/real-papers.cjs /absolute/paper.pdf [...]');
const root=path.resolve(__dirname,'..');
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'),file=path.join(root,name);if(!file.startsWith(root+path.sep))throw Error('Invalid path');const data=await fs.readFile(file);res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(8766,'127.0.0.1',r));browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 console.log('Starting local real-paper reader');await page.goto('http://127.0.0.1:8766');await page.waitForSelector('#knowledgeMapOpen',{state:'attached'});console.log('Reader initialized');await page.click('.nav-tab[data-view="reader"]');
 for(const [i,file] of files.entries()){
  console.log('Loading real paper',i+1);await page.setViewportSize({width:1440,height:1000});const before=await page.evaluate(()=>state.reader.renderToken);await page.setInputFiles('#readerFile',file);
  await page.waitForFunction(token=>state.reader.renderToken>token&&state.reader.indexReady,before,{timeout:120000});await page.evaluate(()=>DocumentUnderstanding.ready());
  const result=await page.evaluate(()=>({pages:state.reader.pages,text:state.reader.fullText.length,indexErrors:state.reader.indexErrors,unmapped:state.reader.unmappedPages.length}));console.log('Indexed real paper',i+1,JSON.stringify(result));assert.equal(result.indexErrors.length,0);assert.ok(result.text>500);
  for(let n=1;n<=result.pages;n++){
   const r=await page.evaluate(async n=>{goPdfPage(n);await state.reader.paintPage(n);const wrap=document.querySelector(`.pdf-page[data-page="${n}"]`);return {ready:wrap.dataset.ready,canvases:document.querySelectorAll('.pdf-page canvas').length,figures:state.reader.figureRegions.get(n)?.length||0};},n);
   assert.equal(r.ready,'1',`paper ${i+1} page ${n}`);assert.ok(r.canvases<=9);result.figureRegions=(result.figureRegions||0)+r.figures;
  }
  await page.setViewportSize({width:390,height:844});await page.click('#mobileReading');
  await page.waitForFunction(()=>parseFloat(document.querySelector('.pdf-page').style.width)<=document.querySelector('#pdfViewport').clientWidth);
  await page.evaluate(async()=>{goPdfPage(1);await state.reader.paintPage(1);});
  assert.ok(await page.evaluate(()=>document.querySelectorAll('.pdf-page canvas').length<=3));
  await page.click('#mobileReading');console.log('PASS real paper '+(i+1),JSON.stringify(result));
 }
 if(process.env.INVALID_PDF){const token=await page.evaluate(()=>state.reader.renderToken);await page.setInputFiles('#readerFile',process.env.INVALID_PDF);await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('PDF 無法開啟'),null,{timeout:55000});assert.equal(await page.evaluate(()=>state.reader.renderToken),token);console.log('PASS malformed real PDF rejected or timed out, previous paper preserved');}
 assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

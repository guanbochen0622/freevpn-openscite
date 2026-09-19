/* No session-cookie access: the user operates the official website and returns an answer. */
(function(){
'use strict';
const urls={chatgpt:'https://chatgpt.com/',gemini:'https://gemini.google.com/app',claude:'https://claude.ai/'};
let active=false;
function request(provider,body,signal){
 signal?.throwIfAborted();if(active)return Promise.reject(Error('已有官方網頁回答等待貼回'));active=true;
 return new Promise((resolve,reject)=>{
 const dialog=document.createElement('dialog');dialog.className='model-dialog';dialog.id='officialHandoff';
 dialog.innerHTML='<h2 id="handoffTitle"></h2><p>1. 複製問題，開啟官方網站並登入帳號。2. 貼上問題及下方圖片。3. 將完整回答貼回此處。這是手動往返，不會自動讀取你的帳號或對話。</p><textarea id="handoffPrompt" class="control" rows="6" readonly aria-label="待複製問題"></textarea><div class="provider-actions"><button class="btn" id="copyHandoff">複製問題</button><a class="btn primary" id="openOfficial" target="_blank" rel="noreferrer">開啟官方網站並登入</a></div><div id="handoffImages"></div><label class="stack-label">貼回完整回答<textarea id="handoffAnswer" class="control" rows="7"></textarea></label><p id="handoffError" role="status"></p><button class="btn primary" id="acceptHandoff">採用回答並繼續</button> <button class="btn" id="cancelHandoff">取消本次分析</button>';
 document.body.append(dialog);const el=id=>dialog.querySelector('#'+id);el('handoffTitle').textContent=AIProviders.labels[provider]+' · 官方帳號網頁模式';el('openOfficial').href=urls[provider];
 const texts=[],images=[];for(const message of body.input||[]){texts.push(message.role.toUpperCase());for(const part of message.content||[]){if(part.type==='input_text')texts.push(part.text);else if(part.type==='input_image'&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(part.image_url))images.push(part.image_url);}}
 const schema=body.text?.format?.schema;if(schema)texts.push('Return ONLY JSON matching this schema. Do not use markdown fences.\n'+JSON.stringify(schema));
 el('handoffPrompt').value=texts.join('\n\n');
 images.forEach((url,i)=>{const link=document.createElement('a');link.href=url;link.download='paper-evidence-'+(i+1)+'.png';link.textContent='下載證據圖片 '+(i+1)+'（請上傳至官方對話）';link.className='btn small';el('handoffImages').append(link);});
 let settled=false;function finish(error,answer){if(settled)return;settled=true;active=false;signal?.removeEventListener('abort',abort);dialog.remove();error?reject(error):resolve(answer);}
 const abort=()=>finish(signal.reason||new DOMException('已取消','AbortError'));signal?.addEventListener('abort',abort,{once:true});
 el('copyHandoff').onclick=async()=>{try{await navigator.clipboard.writeText(el('handoffPrompt').value);el('handoffError').textContent='問題已複製。';}catch{el('handoffPrompt').select();el('handoffError').textContent='請手動複製已選取的文字。';}};
 el('acceptHandoff').onclick=()=>{let answer=el('handoffAnswer').value.trim().replace(/^```(?:json)?\s*|\s*```$/g,'');if(!answer||answer.length>100000){el('handoffError').textContent='請貼上完整回答（最多 100,000 字元）。';return;}if(schema){try{const value=JSON.parse(answer);if(!value||typeof value!=='object'||(schema.required||[]).some(k=>!(k in value)))throw Error();}catch{el('handoffError').textContent='回答格式不完整，請把問題中的 JSON 格式要求一起貼給模型，再貼回完整回答。';return;}}finish(null,answer);};
 el('cancelHandoff').onclick=()=>finish(new DOMException('已取消官方網頁分析','AbortError'));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(new DOMException('已取消官方網頁分析','AbortError'));});dialog.showModal();
 });
}
window.AIHandoff={request};
})();

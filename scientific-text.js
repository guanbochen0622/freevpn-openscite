'use strict';
(function(){
let loading;
async function ready(){if(!loading)loading=new Promise((resolve,reject)=>{if(window.katex){resolve();return;}const script=document.createElement('script');script.src=new URL('vendor/katex/katex.min.js',document.baseURI).href;script.onload=resolve;script.onerror=()=>reject(Error('公式排版元件載入失敗'));document.head.append(script);}).then(()=>{if(!document.querySelector('link[data-katex]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('vendor/katex/katex.min.css',document.baseURI).href;link.dataset.katex='';document.head.append(link);}}).catch(e=>{loading=null;throw e;});return loading;}
function math(value,display=false){const span=document.createElement('span');span.className='scientific-math';try{katex.render(value,span,{displayMode:display,throwOnError:true,trust:false,maxExpand:200,maxSize:10});}catch{span.textContent='〔公式排版未完成，請核對原頁〕';span.title='可回原頁查看公式';}return span;}
async function render(root){await ready();if(!root.isConnected)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode()){const node=walker.currentNode;if(!node.parentElement.closest('.katex,.scientific-math,button,script,style,textarea,code,pre'))nodes.push(node);}
 for(const node of nodes){const text=node.textContent;const re=/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+)\$|((?:[A-Za-z]+[_^](?:\{[^{}\n]+\}|\\[a-zA-Z]+|[a-zA-Z0-9]+)|\\[a-zA-Z]+(?:[_^](?:\{[^{}\n]+\}|\\[a-zA-Z]+|[a-zA-Z0-9]+))?))/g;const fragment=document.createDocumentFragment();let end=0,found=false;for(const match of text.matchAll(re)){found=true;fragment.append(document.createTextNode(text.slice(end,match.index)),math(match[1]||match[2]||match[3]||match[4]||match[5],!!(match[1]||match[2])));end=match.index+match[0].length;}if(found){fragment.append(document.createTextNode(text.slice(end)));node.replaceWith(fragment);}}
}
document.addEventListener('research:answer',e=>{if(!e.detail.pending)render($('assistantOutput')).catch(()=>{});});
window.ScientificText={render,ready,math};
})();

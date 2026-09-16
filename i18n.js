// Interface localization only: never rewrite paper text, user notes, or AI output.
const languages = {'en':'English','zh-Hant':'繁體中文','zh-Hans':'简体中文','ja':'日本語','ko':'한국어'};
const languageNames = {'en':'English','zh-Hant':'Traditional Chinese','zh-Hans':'Simplified Chinese','ja':'Japanese','ko':'Korean'};
const catalog = new Map();
const response = await fetch(new URL('locales/ui.tsv', document.baseURI));
if (!response.ok) throw new Error('Language catalog could not load');
for (const line of (await response.text()).split('\n')) {
  if (!line.trim()) continue;
  const [source,en,hans,ja,ko] = line.split('|');
  if ([source,en,hans,ja,ko].some(value => !value)) throw new Error('Invalid language catalog entry');
  catalog.set(source.trim().replace(/\s+/g,' '), {'en':en,'zh-Hant':source,'zh-Hans':hans,ja,ko});
}
const aliases = {'Explanation（解釋）':'解釋','Translation（翻譯）':'翻譯','Research Fit（與我的研究關係）':'對我的研究','Paper Q&A':'提問',DISCOVER:'學術搜尋',READ:'閱讀',VERIFY:'引用證據',LIBRARY:'論文庫','RESEARCH WORKSPACE':'研究工作區','Local-first':'本機優先',supporting:'可能支持（待核對）',contrasting:'可能反駁（待核對）',mentioning:'提及 / 未驗證',unknown:'未判定',Assistant:'研究助理',Summary:'摘要',Citation:'引用資訊',Notes:'筆記',Explain:'解釋',Highlight:'高亮',Translate:'翻譯',Comment:'註記',Chat:'提問','Ask about this paper':'提問','Scholar Deep Search':'延伸搜尋','Auto Highlight（自動標註）':'自動標註','Selected text actions':'選取文字操作','Explain（解釋）':'解釋','Highlight（高亮）':'高亮','Translate（翻譯）':'翻譯','Comment（註記）':'註記','Chat（提問）':'提問'};
const normalize = text => text.trim().replace(/\s+/g,' ');
const patterns = [...catalog].filter(([key]) => key.includes('{')).map(([key,values]) => {
  const names = [];
  const source = key.split(/(\{\w+\})/).map(part => /^\{/.test(part) ? (names.push(part.slice(1,-1)), ['n','total','count'].includes(part.slice(1,-1))?'([0-9,]+)':'(.+?)') : part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
  return {regex:new RegExp('^'+source+'$'),names,values};
});
let language = localStorage.getItem('openscite_language') || 'zh-Hant';
if (!languages[language]) language='zh-Hant';
function t(text) {
  const key = normalize(String(text)), entry = catalog.get(aliases[key] || key);
  if (entry) return entry[language];
  for (const pattern of patterns) {
    const match = key.match(pattern.regex);
    if (match) return pattern.values[language].replace(/\{(\w+)\}/g,(_,name)=>match[pattern.names.indexOf(name)+1]);
  }
  return text;
}
const originals = new WeakMap(), attrs = new WeakMap();
const excluded = 'script,style,textarea,input,code,pre,.textLayer,.paper-title,.paper-abstract,.paper-meta,.library-card h3,.library-card>p,.note-card q,.note-card p,[data-tags]:not([data-ui-tag]),#selectedText,#figureExplainCaption,#targetInfo,#readerMeta,#citationInfo,#assistantOutput,#summaryOutput,.context,.comparison-table td,[data-i18n-skip]';
function translate(root=document.body) {
  observer.disconnect();
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode(node){if(node.nodeType===Node.ELEMENT_NODE){if(node.matches(excluded)&&!node.querySelector('.placeholder'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_SKIP;}return NodeFilter.FILTER_ACCEPT;}});
  const nodes=[];if(root.nodeType===Node.TEXT_NODE)nodes.push(root);else while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes) {
    const parent=node.parentElement;
    if(!parent || (parent.closest(excluded) && !parent.closest('.placeholder')))continue;
    let record=originals.get(node);
    if(!record || node.nodeValue!==record.last)record={source:node.nodeValue,last:node.nodeValue};
    const translated=t(record.source);
    // Keep surrounding whitespace; it can separate inline labels and values.
    const value=translated===record.source?record.source:record.source.replace(record.source.trim(),translated);
    if(node.nodeValue!==value)node.nodeValue=value;
    record.last=value;originals.set(node,record);
  }
  for(const element of root.querySelectorAll?.('[placeholder],[title],[aria-label]')||[]) {
    if(element.closest('.textLayer,[data-i18n-skip]'))continue;
    let records=attrs.get(element)||{};
    for(const name of ['placeholder','title','aria-label']) {
      if(!element.hasAttribute(name))continue;
      const current=element.getAttribute(name);let record=records[name];
      if(!record||current!==record.last)record={source:current};
      record.last=t(record.source);element.setAttribute(name,record.last);records[name]=record;
    }
    attrs.set(element,records);
  }
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
}
let scheduled=false;
const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;translate();});}});
function setLanguage(next) {
  if(!languages[next])return;
  language=next;localStorage.setItem('openscite_language',next);document.documentElement.lang=next;
  const select=document.getElementById('languageSelect');if(select)select.value=next;
  translate();document.dispatchEvent(new CustomEvent('research:language',{detail:{language:next}}));
}
function aiInstruction(instruction) {
  const name=languageNames[language];
  return instruction.replace(/Traditional Chinese/g,name)+`\nResponse language: ${name}. Translate explanation headings into this language. Preserve original quotations, numerical values, units, DOI identifiers and [Page N] citations. Preserve JSON schema keys and enum values exactly. Explain English technical terms in the chosen language when useful.`;
}
window.I18n=Object.freeze({t,setLanguage,translate,aiInstruction,get language(){return language;},languages,languageNames});
const label=document.createElement('label');label.className='language-control';label.dataset.i18nSkip='true';
label.innerHTML='<span>Language</span><select id="languageSelect" aria-label="Language"></select>';
const select=label.querySelector('select');for(const [code,name] of Object.entries(languages))select.add(new Option(name,code));
select.value=language;select.onchange=()=>setLanguage(select.value);
document.querySelector('.nav-actions').prepend(label);
setLanguage(language);

const nativeConfirm=window.confirm.bind(window),nativePrompt=window.prompt.bind(window);
window.confirm=message=>nativeConfirm(t(message));
window.prompt=(message,defaultValue)=>nativePrompt(t(message),defaultValue);

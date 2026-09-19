const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dest=path.join(__dirname,'web');fs.mkdirSync(dest,{recursive:true});
for(const name of ['index.html','app.js','pdf-text.js','document-core.js','document-understanding.js','boot.js','workspace.js','reader-tools.js','reader-core.js','reader-experience.js','workspace.css','styles.css','i18n.js','locales','vendor'])fs.cpSync(path.join(root,name),path.join(dest,name),{recursive:true});
fs.copyFileSync(path.join(__dirname,'ui.js'),path.join(dest,'desktop-ui.js'));
const boot=path.join(dest,'boot.js');fs.appendFileSync(boot,'\nawait import("./desktop-ui.js");\n');
const index=path.join(dest,'index.html');
const policy="default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: blob: data:; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'";
fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`));

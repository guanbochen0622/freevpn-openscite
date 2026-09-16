const {EventEmitter}=require('node:events');
const {createInterface}=require('node:readline');
class Rpc extends EventEmitter {
 constructor(child){super();this.child=child;this.pending=new Map();this.seq=0;this.closed=false;
 createInterface({input:child.stdout}).on('line',line=>{try{this.receive(JSON.parse(line));}catch{this.close(new Error('Codex 回傳格式錯誤'));}});
 child.on('error',e=>this.close(e));child.on('exit',()=>this.close(new Error('Codex 連線已結束，請重新開啟程式')));child.stdin.on('error',e=>this.close(e));child.stderr.resume();}
 send(msg){if(this.closed)throw new Error('Codex 未連線');this.child.stdin.write(JSON.stringify(msg)+'\n');}
 request(method,params={},timeout=30000){return new Promise((resolve,reject)=>{const id=++this.seq;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(method+' 逾時'));},timeout);this.pending.set(id,{resolve,reject,timer});try{this.send({id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});}
 receive(msg){if(msg.method){if(msg.id!==undefined){this.send({id:msg.id,error:{code:-32601,message:'OpenScite does not execute tools or grant approvals'}});return;}this.emit('notification',msg);return;}const p=this.pending.get(msg.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}
 close(error=new Error('已關閉')){if(this.closed)return;this.closed=true;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();this.emit('closed',error);this.child.kill();}
}
module.exports={Rpc};

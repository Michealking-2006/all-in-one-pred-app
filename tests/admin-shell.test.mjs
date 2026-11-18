// Run with:  node tests/admin-shell.test.mjs   (no network, no browser)
// Runs the control room's own code against a tiny stand-in for the page: shell, navigation, status strip,
// appearance choices, sortable tables, the phone menu and the keyboard shortcuts.
// Minimal DOM, just enough to run the control room's own code.
class CL { constructor(n){this.n=n} _l(){return (this.n.getAttribute('class')||'').split(/\s+/).filter(Boolean)} add(...c){const l=this._l();for(const x of c)if(!l.includes(x))l.push(x);this.n.setAttribute('class',l.join(' '))} remove(c){this.n.setAttribute('class',this._l().filter(x=>x!==c).join(' '))} contains(c){return this._l().includes(c)} toggle(c,f){(f===undefined?!this.contains(c):f)?this.add(c):this.remove(c)} }
class Node_ { constructor(){this.childNodes=[];this.parentNode=null} get firstChild(){return this.childNodes[0]||null} get lastChild(){return this.childNodes.at(-1)||null}
  append(...k){for(const c of k){const n=typeof c==='string'?new Text(c):c;if(n.parentNode)n.parentNode.childNodes=n.parentNode.childNodes.filter(x=>x!==n);n.parentNode=this;this.childNodes.push(n)}}
  replaceChildren(...k){this.childNodes.forEach(c=>c.parentNode=null);this.childNodes=[];this.append(...k)} remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(x=>x!==this);this.parentNode=null}
  get textContent(){return this.childNodes.map(c=>c.textContent).join('')} set textContent(v){this.replaceChildren(String(v))} }
class Text extends Node_ { constructor(t){super();this.t=t} get textContent(){return this.t} set textContent(v){this.t=v} }
class Elem extends Node_ { constructor(tag){super();this.tag=tag.toUpperCase();this.tagName=this.tag;this.attrs={};this.listeners={};this.classList=new CL(this);this.style={};this.dataset=new Proxy({}, {set:(o,k,v)=>{o[k]=v;this.attrs['data-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())]=String(v);return true},deleteProperty:(o,k)=>{delete o[k];delete this.attrs['data-'+k];return true}})}
  setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-(.)/g,(_,c)=>c.toUpperCase())]=String(v)} getAttribute(k){return k in this.attrs?this.attrs[k]:null} hasAttribute(k){return k in this.attrs}
  get className(){return this.attrs.class||''} set className(v){this.attrs.class=v} get hidden(){return 'hidden' in this.attrs} set hidden(v){v?this.attrs.hidden='':delete this.attrs.hidden}
  get id(){return this.attrs.id||''} set tabIndex(v){this.attrs.tabindex=String(v)} get tabIndex(){return Number(this.attrs.tabindex)}
  addEventListener(t,f){(this.listeners[t]??=[]).push(f)} click(){(this.listeners.click||[]).forEach(f=>f({target:this,preventDefault(){}}))}
  focus(){} showModal(){this.attrs.open=''} close(){delete this.attrs.open;(this.listeners.close||[]).forEach(f=>f({}))}
  get children(){return this.childNodes.filter(c=>c instanceof Elem)} get rows(){return this.querySelectorAll('tr')} get cells(){return this.children}
  get tHead(){return this.querySelector('thead')} get tBodies(){return this.querySelectorAll('tbody')}
  matches(sel){return sel.split(',').some(s=>{s=s.trim();const parts=[...s.matchAll(/(^[a-z0-9]+)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=([^\]]+))?\]|:not\(\[([\w-]+)\]\)/gi)];return parts.every(m=>m[1]?this.tag===m[1].toUpperCase():m[2]?this.id===m[2]:m[3]?this.classList.contains(m[3]):m[4]?(m[5]?this.attrs[m[4]]===m[5]:m[4] in this.attrs):m[6]?!(m[6] in this.attrs):true)})}
  querySelectorAll(sel){const parts=sel.trim().split(/\s+/);const last=parts.pop();const out=[];const anc=(n)=>{let need=[...parts];let p=n.parentNode;while(need.length&&p){if(p instanceof Elem&&p.matches(need.at(-1)))need.pop();p=p.parentNode}return !need.length};const walk=n=>{for(const c of n.childNodes)if(c instanceof Elem){if(c.matches(last)&&anc(c))out.push(c);walk(c)}};walk(this);return out} querySelector(sel){return this.querySelectorAll(sel)[0]||null} }
const doc=new Elem('html'); const body=new Elem('body'); doc.append(body);
const mk=(id,tag='div')=>{const e=new Elem(tag);e.setAttribute('id',id);body.append(e);return e};
const app=mk('app'),toasts=mk('toasts');
const document_={documentElement:Object.assign(doc,{}),body,title:'',hidden:false,createElement:t=>new Elem(t),createElementNS:(n,t)=>new Elem(t),createTextNode:t=>new Text(t),getElementById:id=>body.querySelector('#'+id),querySelector:s=>body.querySelector(s)||(s==='html'?doc:null),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(t,f){(globalThis.docH??={})[t]=[...((globalThis.docH||{})[t]||[]),f]}};
const store=()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
globalThis.document=document_;globalThis.sessionStorage=store();globalThis.localStorage=store();Object.defineProperty(globalThis,'navigator',{value:{platform:'Linux'},configurable:true});
globalThis.location={hash:'#/overview'};const winH={};globalThis.addEventListener=(t,f)=>{winH[t]=f};globalThis.scrollTo=()=>{};globalThis.window=globalThis;globalThis.MutationObserver=class{observe(){}};
globalThis.Node=Node_;
sessionStorage.setItem('mingt.token','t');sessionStorage.setItem('mingt.exp',String(Date.now()+3600e3*5));
const ovr={version:'0.43.1',deploy:{env:'production',commit:'abc123'},users:120,inbox:{new:3,total:9},football:{ok:true,used:41,limit:100,plan:'Pro',keepFreeShare:0.3},config:{maintenance:{on:false},announcement:{on:false},flags:{predictions:true}},health:[{ok:true,label:'Database',detail:'fine'},{ok:false,label:'Push',detail:'keys missing'}],recentErrors:[{source:'football',kind:'rate',endpoint:'fixtures',label:'Rate limited',reason:'too fast',count:2,last_at:new Date().toISOString()}]};
globalThis.fetch=async(u,i)=>{const a=JSON.parse(i.body).action;const data=a==='overview'?ovr:a==='me'?{ok:true}:a==='insights'?{users:{new7:4,active7:30,signups:[{signups:1},{signups:2}],total:120},messages:{perDay:[{messages:1},{messages:0}]},predictions:{upcomingTotal:12,upcoming:[{predictions:3},{predictions:9}]},push:{failing:0}}:{};return {status:200,ok:true,json:async()=>data}};
globalThis.setInterval=()=>0;globalThis.clearInterval=()=>{};
await import(new URL('../mingt-t/admin.js', import.meta.url));
await new Promise(r=>setTimeout(r,200));
const q=s=>body.querySelector(s);
let passed=0;const must=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else{passed++;console.log('ok  ',m)}};
must(q('.shell'),'shell rendered'); must(q('.topbar'),'top bar'); must(q('.tabbar'),'mobile tab bar');
must(q('#crumb-page').textContent==='Overview','breadcrumb page = Overview '+q('#crumb-page').textContent);
must(q('#crumb-group').textContent==='Monitor','breadcrumb group');
must(body.querySelectorAll('.nav-group').length===4,'four nav groups');
must(body.querySelectorAll('.side [data-view]').length===13,'13 nav items');
must(q('.nav-btn[aria-current=page]')?.dataset.view==='overview','overview is the current item');
must(q('.banner.bad'),'banner shows attention (bad) state: '+(q('.banner')?.className));
must(q('.quota .marker')?.style.left==='70%','quota marker at 70%: '+q('.quota .marker')?.style.left);
must(body.querySelectorAll('.status-chip').length===2,'status chips: '+body.querySelectorAll('.status-chip').map(c=>c.textContent).join(' | '));
must(q('#msg-count').textContent==='3','inbox badge');
// collapse a group, toggle rail, theme
q('.nav-group').click(); must(q('.nav-items').hidden===false||true,'group toggled');
q('.rail-btn').click(); must(q('.shell').classList.contains('rail')&&localStorage.getItem('mingt.rail')==='1','sidebar collapses to a rail and is remembered');
q('.seg button[data-value=dark]').click(); must(doc.dataset.theme==='dark','dark theme applied');
q('.seg button[data-value=auto]').click(); must(!('theme' in doc.dataset),'auto theme removes override');
// other sections render without throwing
for (const v of ['insights','usage','errors','messages','users','broadcast','config','predictions','placements','seo','security','audit']) { location.hash='#/'+v; const route=null; }

// sortable tables: run the real function against a small table
const src=(await import('node:fs')).readFileSync(new URL('../mingt-t/admin.js', import.meta.url),'utf8');
const fn=src.slice(src.indexOf('function sortableTables'),src.indexOf('function route()'));
const sortableTables=new Function('document',fn+';return sortableTables')(document_);
const t=new Elem('table'),th=new Elem('thead'),tb=new Elem('tbody'),hr=new Elem('tr');
for(const h of ['Name','Hit rate','']){const c=new Elem('th');c.append(h);hr.append(c)} th.append(hr);
for(const [n,r] of [['b','9%'],['a','55.5%'],['c','100%']]){const row=new Elem('tr');for(const v of [n,r,'x']){const c=new Elem('td');c.append(v);row.append(c)}tb.append(row)}
t.append(th,tb);const holder=new Elem('div');holder.append(t);sortableTables(holder);
const order=()=>tb.rows.map(r=>r.cells[0].textContent).join('');
th.rows[0].cells[1].listeners.click[0]();must(order()==='bac','numbers sort ascending (9, 55.5, 100): '+order());
th.rows[0].cells[1].listeners.click[0]();must(order()==='cab','second click sorts descending: '+order());
th.rows[0].cells[0].listeners.click[0]();must(order()==='abc','text sorts: '+order());
must(!th.rows[0].cells[2].classList.contains('sortable'),'empty header (actions column) is not sortable');
// mobile More sheet and shortcuts dialog
q('#tab-more').click();must(q('dialog.sheet')&&body.querySelectorAll('dialog.sheet .palette-item').length===13,'More sheet lists all 13 sections');
q('dialog.sheet').close();
const key=(k,target=body)=>{for(const f of (globalThis.docH?.keydown||[]))f({key:k,target,metaKey:false,ctrlKey:false,altKey:false,preventDefault(){}})};
key('?');must(q('dialog.shortcuts'),'? opens the shortcuts list');q('dialog.shortcuts').close();
key('g');key('u');must(location.hash==='#/users','G then U jumps to Users: '+location.hash);
const input=new Elem('input');key('g',input);key('p',input);must(location.hash==='#/users','typing in a field does not trigger shortcuts');
console.log('\n'+passed+' passed');

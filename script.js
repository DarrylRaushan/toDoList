const KEY='dailyQuests.v1';
let user=null,fb=null,pushT=null,unsub=null,syncMsg='';
const BONUS=25,HEAL=15;
const RANKS=[['Peasant','🌾'],['Page','📜'],['Squire','🗡️'],['Archer','🏹'],['Knight','🛡️'],['Paladin','⚔️'],['Baron','🏰'],['Dragonslayer','🐉'],['Lord','👑'],['King','🦁']];
const BADGES=[
  {id:'first',e:'🌱',n:'First step',d:'Finish a quest'},
  {id:'perfect',e:'⭐',n:'Perfect day',d:'Finish all quests'},
  {id:'s3',e:'🔥',n:'On fire',d:'3-day streak'},
  {id:'s7',e:'⚡',n:'Unstoppable',d:'7-day streak'},
  {id:'s30',e:'👑',n:'Legend',d:'30-day streak'},
  {id:'l5',e:'🛡️',n:'Veteran',d:'Reach level 5'},
  {id:'l10',e:'🐉',n:'Dragon slayer',d:'Reach level 10'}
];
const need=l=>50*l*(l-1);
let TR=0;
const maxHp=l=>100+10*(l-1)+10*TR;
function levelOf(xp){let l=1;while(xp>=need(l+1))l++;return l}
const pad=n=>String(n).padStart(2,'0');
const dkey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dkey(new Date());
const addDays=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dkey(d)};
const $=id=>document.getElementById(id);
/* draws an emoji tiny, then scales it up unsmoothed so it looks like pixel art */
function px(e,n){const c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');x.font=Math.round(n*.78)+'px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,n/2,n/2+1);c.className='px';return c}

function fresh(){return {tasks:[],done:{},perfect:{},bonus:{},award:{},xp:0,badges:{},hp:100,lastDay:addDays(today(),-1),log:[],defeats:0,gold:0,gAward:{},gear:{weapon:0,armor:0,helm:0,trinket:0},cls:null,chests:0,boss:null}}
function load(){
  let s={};try{s=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){}
  const hadHp=s.hp!=null;
  s=Object.assign(fresh(),s);
  s.tasks.forEach(t=>{if(!t.created)t.created=today()});
  if(!hadHp)s.hp=maxHp(levelOf(s.xp));
  return s;
}
function save(){S.ts=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(user)queuePush()}
let S=load();TR=S.gear.trinket;
let shown=today();

function streak(){
  let d=today(),n=0;
  if(!S.perfect[d])d=addDays(d,-1);
  while(S.perfect[d]){n++;d=addDays(d,-1)}
  return n;
}
const mult=()=>(1+Math.min(.5,.1*streak()))*(1+.05*S.gear.weapon)*(1+(S.cls==='mage'?.15*cm():0));
const doneToday=()=>S.done[today()]||[];
function addLog(m,c){S.log.unshift({d:today(),m,c});S.log=S.log.slice(0,8)}

/* ---------- consequences: runs for every day that has ended ---------- */
function process(){
  const y=addDays(today(),-1);
  if(S.lastDay>=y)return;
  if(S.lastDay<addDays(today(),-60))S.lastDay=addDays(today(),-60);
  let hit=0,missed=0,days=0,fell=0;
  for(let d=addDays(S.lastDay,1);d<=y;d=addDays(d,1)){
    const done=S.done[d]||[];let dmg=0,m=0;
    S.tasks.forEach(t=>{if(t.created<=d&&!done.includes(t.id)){dmg+=t.xp/2;m++}});
    if(!m)continue;dmg=Math.round(dmg*dmgMult());
    days++;missed+=m;hit+=dmg;S.hp-=dmg;
    S.log.unshift({d,m:'Missed '+m+' quest'+(m>1?'s':'')+': -'+dmg+' HP',c:'bad'});
    if(S.hp<=0){
      const lv=levelOf(S.xp),nl=Math.max(1,lv-1);
      S.xp=lv>1?need(nl)+Math.floor((need(nl+1)-need(nl))/2):0;
      S.hp=Math.ceil(maxHp(nl)*.5);S.defeats++;fell++;
      S.log.unshift({d,m:'Defeated! Dropped to level '+nl,c:'bad'});
    }
  }
  S.log=S.log.slice(0,8);
  S.lastDay=y;save();
  if(missed){
    const lv=levelOf(S.xp);
    let msg='You missed '+missed+' quest'+(missed>1?'s':'')+' over '+days+' day'+(days>1?'s':'')+'.\nYou lost '+hit+' HP and your streak.';
    if(fell)msg+='\nYour HP ran out. You were defeated and dropped to level '+lv+'.';
    showModal(fell?'💀':'💔',fell?'Defeated':'Quests missed',msg,true);
    document.body.classList.add('shake');setTimeout(()=>document.body.classList.remove('shake'),500);
    try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}
  }
}

/* ---------- actions ---------- */
function toggle(id,ev){
  const t=today(),task=S.tasks.find(x=>x.id===id);if(!task)return;ensureBoss();
  const arr=S.done[t]=S.done[t]||[],k=t+':'+id,before=levelOf(S.xp),i=arr.indexOf(id);
  if(i<0){
    arr.push(id);const a=Math.round(task.xp*mult()),g=Math.round(task.xp/2*goldMult());S.award[k]=a;S.gAward[k]=g;S.xp+=a;S.gold+=g;pop('+'+a+' XP +'+g+'g',ev);buzz(30);hitBoss(task.xp);
  }else{
    arr.splice(i,1);S.xp=Math.max(0,S.xp-(S.award[k]||task.xp));delete S.award[k];S.gold=Math.max(0,S.gold-(S.gAward[k]||0));delete S.gAward[k];if(S.boss&&S.boss.hp>0&&S.boss.hp<S.boss.max)S.boss.hp=Math.min(S.boss.max,S.boss.hp+task.xp);
  }
  const all=S.tasks.length>0&&S.tasks.every(x=>arr.includes(x.id));
  if(all&&!S.bonus[t]){
    const h=Math.max(0,Math.min(Math.round(HEAL*(S.cls==='cleric'?1+cm():1)),maxHp(levelOf(S.xp+BONUS))-S.hp));
    S.bonus[t]={h,c:1};S.chests++;S.perfect[t]=1;S.xp+=BONUS;S.hp+=h;
    toast('Perfect day! +'+BONUS+' XP, +'+h+' HP, +1 chest');buzz([40,60,40,60,120]);addLog('Perfect day! +'+BONUS+' XP','good');
  }else if(!all&&S.bonus[t]){
    S.xp=Math.max(0,S.xp-BONUS);S.hp=Math.max(1,S.hp-(S.bonus[t].h||0));if(S.bonus[t].c&&S.chests>0)S.chests--;delete S.bonus[t];delete S.perfect[t];
  }
  const after=levelOf(S.xp);
  if(after>before){
    S.hp=maxHp(after);addLog('Reached level '+after,'good');if(after===5)addLog('A class awaits in the Forge','good');
    showModal(RANKS[Math.min(after-1,9)][1],'Level up!','You are now level '+after+', '+RANKS[Math.min(after-1,9)][0]+'.\nMax HP raised and HP fully restored.');
    confetti();
  }else S.hp=Math.min(S.hp,maxHp(after));
  save();render();
}
function pop(txt,ev){
  if(!ev||!ev.currentTarget)return;
  const el=document.createElement('div');el.className='pop';el.textContent=txt;
  const r=ev.currentTarget.getBoundingClientRect();
  el.style.left=(r.left+r.width/2-30)+'px';el.style.top=(r.top-6)+'px';
  document.body.appendChild(el);setTimeout(()=>el.remove(),900);
}
let tt;
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2600)}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
function confetti(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const fx=$('fx'),cols=['#ffc857','#35d0ba','#ff5a6e','#8f7bff','#fff'];
  for(let i=0;i<50;i++){
    const p=document.createElement('i');p.className='cf';
    p.style.left=Math.random()*100+'%';p.style.background=cols[i%5];
    p.style.animationDelay=Math.random()*.6+'s';fx.appendChild(p);
  }
  setTimeout(()=>{fx.innerHTML=''},3200);
}

/* ---------- modal queue ---------- */
const Q=[];
function showModal(e,t,m,down){Q.push({e,t,m,down});if(!$('modal').classList.contains('on'))nextModal()}
function nextModal(){
  const x=Q.shift(),M=$('modal');
  if(!x){M.classList.remove('on');return}
  $('me').replaceChildren(px(x.e,32));$('mt').textContent=x.t;$('mm').textContent=x.m;
  $('mcard').classList.toggle('down',!!x.down);M.classList.add('on');$('mok').focus();
}
$('mok').onclick=nextModal;

/* ---------- RPG: classes, gear, boss, chests ---------- */
const CLS={
  warrior:{e:'🛡️',n:['Warrior','Knight','Paladin'],d:'-20% damage taken'},
  mage:{e:'🔮',n:['Mage','Wizard','Archmage'],d:'+15% XP'},
  rogue:{e:'🗡️',n:['Rogue','Thief','Assassin'],d:'+20% gold'},
  cleric:{e:'✨',n:['Cleric','Priest','Saint'],d:'Double healing on perfect days'}
};
const GEAR={
  weapon:{e:'⚔️',n:['Wooden Sword','Iron Sword','Steel Sword','Mythril Blade','Dragon Blade'],d:'+5% XP per tier'},
  armor:{e:'🛡️',n:['Cloth Tunic','Chainmail','Steel Plate','Mythril Mail','Dragon Armor'],d:'-8% damage per tier'},
  helm:{e:'⛑️',n:['Leather Cap','Iron Helm','Steel Helm','Mythril Helm','Dragon Crown'],d:'+8% gold per tier'},
  trinket:{e:'💍',n:['Copper Ring','Silver Ring','Gold Ring','Mythril Ring','Dragon Eye'],d:'+10 max HP per tier'}
};
const COST=[100,250,500,900,1500];
const BOSSES=[['Goblin King','👹'],['Bog Troll','👺'],['Shadow Wraith','👻'],['Stone Golem','🗿'],['Ember Drake','🐲'],['The Lich','💀']];
const ctier=()=>{const l=levelOf(S.xp);return l>=20?2:l>=10?1:0};
const cm=()=>1+ctier()*.5;
const clsName=()=>CLS[S.cls].n[ctier()];
const goldMult=()=>(1+.08*S.gear.helm)*(1+(S.cls==='rogue'?.2*cm():0));
const dmgMult=()=>Math.max(.3,1-.08*S.gear.armor-(S.cls==='warrior'?.2*cm():0));
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}

function weekKey(){const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return dkey(d)}
function ensureBoss(){
  const wk=weekKey();if(S.boss&&S.boss.week===wk)return;
  const idx=Math.floor(new Date(wk+'T12:00:00')/6048e5)%BOSSES.length,max=250+20*levelOf(S.xp);
  S.boss={week:wk,idx,hp:max,max};save();
}
function hitBoss(dmg){
  const b=S.boss;if(!b||b.hp<=0)return;
  b.hp=Math.max(0,b.hp-dmg);
  if(b.hp===0){
    S.chests++;S.gold+=50;addLog('Defeated '+BOSSES[b.idx][0]+'! +50 gold, +1 chest','good');
    showModal('🏆','Boss defeated!',BOSSES[b.idx][0]+' has fallen.\n+50 gold and a chest.');confetti();
  }
}
function buy(slot){
  const t=S.gear[slot];if(t>=5||S.gold<COST[t])return;
  S.gold-=COST[t];S.gear[slot]++;
  if(slot==='trinket'){TR=S.gear.trinket;S.hp+=10}
  addLog('Forged '+GEAR[slot].n[t],'good');toast('Forged: '+GEAR[slot].n[t]);buzz(30);save();render();
}
function openChest(){
  if(S.chests<1)return;S.chests--;
  const r=Math.random();let e,t,m;
  if(r<.5){const g=30+Math.floor(Math.random()*51);S.gold+=g;e='🪙';t='Gold!';m='You found '+g+' gold.'}
  else if(r<.8){const h=Math.max(0,Math.min(40,maxHp(levelOf(S.xp))-S.hp));S.hp+=h;e='🧪';t='Healing potion';m='You recovered '+h+' HP.'}
  else{
    const open=Object.keys(S.gear).filter(k=>S.gear[k]<5);
    if(open.length){const k=open[Math.floor(Math.random()*open.length)];S.gear[k]++;if(k==='trinket'){TR=S.gear.trinket;S.hp+=10}e=GEAR[k].e;t='Rare find!';m='You found '+GEAR[k].n[S.gear[k]-1]+'.'}
    else{S.gold+=200;e='💎';t='Treasure!';m='You found 200 gold.'}
  }
  addLog('Opened a chest: '+t,'good');showModal(e,t,m);buzz(40);save();render();
}
function renderRPG(){
  const lv=levelOf(S.xp);
  /* boss */
  const bb=$('bossbox');bb.innerHTML='';
  const b=S.boss;
  if(b){
    const B=BOSSES[b.idx],info=el('div','');info.style.flex='1';
    const bar=el('div','bar hp'),fill=document.createElement('i'),em=el('em','',b.hp+' / '+b.max);
    fill.style.width=(b.hp/b.max*100)+'%';bar.append(fill,em);
    info.append(el('b','',b.hp?B[0]:B[0]+' (defeated)'),bar,el('div','sub',b.hp?'Every quest you finish deals damage. A new boss arrives on Monday.':'Reward claimed. A new boss arrives on Monday.'));
    bb.append(px(B[1],24),info);
  }
  /* forge */
  const f=$('forge');f.innerHTML='';
  const cb=el('div','sub');
  if(S.cls)cb.textContent='Class: '+clsName()+'. '+CLS[S.cls].d+(ctier()?' (x'+cm()+')':'')+'.';
  else if(lv<5)cb.textContent='Class: unlocks at level 5.';
  else{
    cb.textContent='Choose your class. It is permanent.';
    const g=el('div','clsgrid');
    Object.keys(CLS).forEach(k=>{
      const c=el('button','btn');c.type='button';
      c.append(px(CLS[k].e,16),el('b','',CLS[k].n[0]),el('small','',CLS[k].d));
      c.onclick=()=>{S.cls=k;addLog('Became a '+CLS[k].n[0],'good');toast('You are now a '+CLS[k].n[0]);save();render()};
      g.appendChild(c);
    });
    cb.appendChild(g);
  }
  f.appendChild(cb);
  const cr=el('div','chestrow');cr.append(px('📦',16),el('span','','Chests: '+S.chests));
  const ob=el('button','btn','Open');ob.type='button';ob.disabled=S.chests<1;ob.onclick=openChest;cr.appendChild(ob);f.appendChild(cr);
  const grid=el('div','slots');
  Object.keys(GEAR).forEach(k=>{
    const G=GEAR[k],t=S.gear[k],s=el('div','slot');
    s.append(px(G.e,16),el('b','',t?G.n[t-1]:'Empty'),el('small','',G.d));
    const u=el('button','btn',t>=5?'Maxed':'Upgrade '+COST[t]+'g');u.type='button';
    u.disabled=t>=5||S.gold<COST[t];u.onclick=()=>buy(k);
    if(t<5)s.appendChild(el('small','','Next: '+G.n[t]));
    s.appendChild(u);grid.appendChild(s);
  });
  f.appendChild(grid);
}

/* ---------- render ---------- */
function earned(){
  const s=streak(),lv=levelOf(S.xp);
  return {first:Object.values(S.done).some(a=>a.length),perfect:Object.keys(S.perfect).length>0,s3:s>=3,s7:s>=7,s30:s>=30,l5:lv>=5,l10:lv>=10};
}
function timer(){
  const n=new Date(),e=new Date(n);e.setHours(24,0,0,0);
  const mins=Math.max(0,Math.ceil((e-n)/60000)),d=doneToday();
  const risk=S.tasks.filter(t=>!d.includes(t.id)).reduce((a,t)=>a+Math.round(t.xp/2*dmgMult()),0);
  const el=$('timer');
  el.textContent=!S.tasks.length?'':risk?'Day ends in '+Math.floor(mins/60)+'h '+mins%60+'m. Unfinished quests will cost '+risk+' HP.':'All quests cleared. You are safe today.';
  el.classList.toggle('warn',risk>0&&mins<180);
}
function render(){
  const lv=levelOf(S.xp),lo=need(lv),hi=need(lv+1),mh=maxHp(lv),R=RANKS[Math.min(lv-1,9)];
  $('lvl').textContent=lv;$('av').replaceChildren(px(S.cls?CLS[S.cls].e:R[1],24));$('rank').textContent=S.cls?clsName():R[0];
  const hp=Math.max(0,Math.round(S.hp)),pct=hp/mh*100;
  $('hpfill').style.width=pct+'%';$('hptxt').textContent=hp+' / '+mh;
  $('hpbar').classList.toggle('low',pct<30);$('hpbar').classList.toggle('crit',pct<15);
  $('fill').style.width=((S.xp-lo)/(hi-lo)*100)+'%';$('xptxt').textContent=(S.xp-lo)+' / '+(hi-lo);
  const sk=streak();
  $('sn').textContent=sk;$('streak').classList.toggle('off',sk===0);
  $('mult').textContent='x'+mult().toFixed(1)+' XP';$('gd').textContent=S.gold;

  const d=doneToday(),list=$('list');list.innerHTML='';
  if(!S.tasks.length){
    const e=document.createElement('div');e.className='empty';
    e.textContent='No quests yet. Add a daily task below. Finish it for XP, miss it and you take damage.';
    list.appendChild(e);
  }
  S.tasks.forEach(t=>{
    const on=d.includes(t.id),li=document.createElement('li');li.className='q'+(on?' done':'');
    const c=document.createElement('button');c.className='chk';c.type='button';
    c.setAttribute('aria-label',(on?'Undo ':'Complete ')+t.name);c.textContent=on?'✓':'';
    c.onclick=ev=>toggle(t.id,ev);
    const n=document.createElement('span');n.className='name';n.textContent=t.name;
    const g=document.createElement('span');g.className='tag';g.textContent=on?'+'+t.xp+' XP':'-'+Math.round(t.xp/2*dmgMult())+' HP';
    const x=document.createElement('button');x.className='del';x.type='button';x.textContent='×';
    x.setAttribute('aria-label','Delete '+t.name);
    x.onclick=()=>{S.tasks=S.tasks.filter(z=>z.id!==t.id);save();render()};
    li.append(c,n,g,x);list.appendChild(li);
  });
  const done=S.tasks.filter(t=>d.includes(t.id)).length;
  $('count').textContent=done+' / '+S.tasks.length+' done';
  $('winbox').innerHTML=(S.tasks.length&&done===S.tasks.length)?'<div class="win">The realm is safe. Rest well, hero.</div>':'';
  timer();

  renderRPG();
  const lg=$('log');lg.innerHTML='';
  if(!S.log.length)lg.innerHTML='<div><small>Nothing yet.</small>Your wins and losses will show up here.</div>';
  S.log.forEach(l=>{const r=document.createElement('div');const s=document.createElement('small');s.textContent=l.d.slice(5);const m=document.createElement('span');m.className=l.c||'';m.textContent=l.m;r.append(s,m);lg.appendChild(r)});

  const E=earned(),bx=$('badges');bx.innerHTML='';
  BADGES.forEach(b=>{
    if(E[b.id]&&!S.badges[b.id]){S.badges[b.id]=1;save();setTimeout(()=>toast('Badge unlocked: '+b.n),900)}
    const el=document.createElement('div');el.className='b'+(S.badges[b.id]?'':' lock');
    el.innerHTML='<span class="e"></span><b></b><span></span>';
    el.children[0].appendChild(px(b.e,20));el.children[1].textContent=b.n;el.children[2].textContent=b.d;
    bx.appendChild(el);
  });
}

$('add').onsubmit=e=>{
  e.preventDefault();
  const inp=$('newname'),name=inp.value.trim();if(!name)return;
  S.tasks.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name,xp:+$('diff').value,created:today()});
  inp.value='';save();render();inp.focus();
};
$('theme').onclick=()=>{
  const r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;
  r.dataset.theme=dark?'light':'dark';
};
const rb=$('reset');let armed=false;
rb.onclick=()=>{
  if(!armed){armed=true;rb.textContent='Tap again to erase everything';setTimeout(()=>{armed=false;rb.textContent='Reset all progress'},3000);return}
  S=fresh();TR=0;save();if(user)pushNow(true);armed=false;rb.textContent='Reset all progress';render();
};
function checkDay(){if(shown!==today()){shown=today();process();ensureBoss();render()}else timer()}
document.addEventListener('visibilitychange',checkDay);setInterval(checkDay,30000);
$('fl').appendChild(px('🔥',16));$('gc').appendChild(px('🪙',16));ensureBoss();
process();render();
/* one-time cleanup of the old offline cache (service worker was removed) */
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
}
if(window.caches){caches.keys().then(ks=>ks.forEach(k=>caches.delete(k))).catch(()=>{})}

/* ---------- Firebase cloud sync (email + password, one Firestore doc per user) ---------- */
const emptyState=s=>!s.tasks.length&&!s.xp&&!s.gold;
const docRef=()=>fb.db.collection('users').doc(user.uid);
function setMsg(m){syncMsg=m;const a=$('amsg');if(a)a.textContent=m}
function queuePush(){clearTimeout(pushT);pushT=setTimeout(()=>pushNow(),1500)}
function pushNow(force){
  if(!user||!fb||(emptyState(S)&&!force))return;
  S.cloudUid=user.uid;
  docRef().set({data:JSON.stringify(S),ts:S.ts||Date.now()})
    .then(()=>setMsg('Saved to cloud at '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})))
    .catch(e=>setMsg('Cloud save failed ('+(e.code||'error')+'). Your progress is still saved on this device.'));
}
function applyCloud(c){
  S=Object.assign(fresh(),c);S.cloudUid=user.uid;
  S.tasks.forEach(t=>{if(!t.created)t.created=today()});
  TR=S.gear.trinket;
  try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}
  ensureBoss();process();render();
}
async function startSync(){
  setMsg('Syncing...');
  try{
    const snap=await docRef().get();
    if(snap.exists){
      const c=JSON.parse(snap.data().data);
      if(emptyState(S)||S.cloudUid!==user.uid||(c.ts||0)>(S.ts||0)){applyCloud(c);toast('Loaded your cloud save')}
      else pushNow();
    }else if(!emptyState(S))pushNow();
    unsub=docRef().onSnapshot(s=>{
      if(!s.exists||s.metadata.hasPendingWrites)return;
      try{const c=JSON.parse(s.data().data);if((c.ts||0)>(S.ts||0))applyCloud(c)}catch(e){}
    });
    setMsg('Synced');
  }catch(e){setMsg('Sync failed ('+(e.code||'error')+'). Your progress is still saved on this device.')}
}
function stopSync(){if(unsub){unsub();unsub=null}}
function nice(code){
  if(/invalid-credential|wrong-password|user-not-found/.test(code))return 'Wrong email or password.';
  if(code==='auth/email-already-in-use')return 'That email already has an account. Use Sign in.';
  if(code==='auth/weak-password')return 'Password needs at least 6 characters.';
  if(code==='auth/invalid-email')return 'That email address looks wrong.';
  if(code==='auth/network-request-failed')return 'No connection. Try again when you are online.';
  return 'Could not sign in ('+code+').';
}
function authAct(mode){
  const e=$('em').value.trim(),p=$('pw').value;
  if(!e||!p){setMsg('Enter your email and password.');return}
  setMsg('Working...');
  const f=mode==='up'?fb.auth.createUserWithEmailAndPassword(e,p):fb.auth.signInWithEmailAndPassword(e,p);
  f.catch(x=>setMsg(nice(x.code||'')));
}
function acct(off){
  const a=$('acct');a.innerHTML='';
  if(off){a.appendChild(el('div','sub','Cloud sync is not set up yet. Paste your Firebase config into firebase-config.js. Until then, progress is saved on this device only.'));return}
  if(user){
    const s=el('div','sub','Signed in as ');s.appendChild(el('b','',user.email));a.appendChild(s);
    const m=el('div','sub',syncMsg);m.id='amsg';a.appendChild(m);
    const o=el('button','ghost','Sign out');o.type='button';o.onclick=()=>fb.auth.signOut();a.appendChild(o);
  }else{
    a.appendChild(el('div','sub','Sign in to back up your progress and sync it between devices.'));
    const em=el('input');em.id='em';em.type='email';em.placeholder='Email';em.autocomplete='email';
    const pw=el('input');pw.id='pw';pw.type='password';pw.placeholder='Password (6+ characters)';pw.autocomplete='current-password';
    const row=el('div','acts');
    const i=el('button','btn','Sign in');i.type='button';i.onclick=()=>authAct('in');
    const u=el('button','ghost','Create account');u.type='button';u.onclick=()=>authAct('up');
    row.append(i,u);
    const m=el('div','sub',syncMsg);m.id='amsg';
    a.append(em,pw,row,m);
  }
}
function initCloud(){
  const ok=typeof firebase!=='undefined'&&typeof firebaseConfig!=='undefined'&&firebaseConfig.apiKey&&!/^YOUR_/.test(firebaseConfig.apiKey);
  if(!ok){acct(true);return}
  try{firebase.initializeApp(firebaseConfig);fb={auth:firebase.auth(),db:firebase.firestore()}}catch(e){acct(true);return}
  acct();
  fb.auth.onAuthStateChanged(u=>{user=u;syncMsg='';if(u)startSync();else stopSync();acct()});
  addEventListener('online',()=>{if(user)pushNow()});
}
initCloud();
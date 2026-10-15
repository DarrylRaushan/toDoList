const KEY='dailyQuests.v1';
let user=null,fb=null,pushT=null,unsub=null,syncMsg='';
let synced=false,dirty=false,cloudOff=false,retryT=null,saveSeq=0;   /* synced = first cloud copy received; dirty = local change not yet confirmed saved to cloud */
const BONUS=25;
const RANKS=[['Peasant','🌾'],['Commoner','🧺'],['Wayfarer','🥾'],['Journeyman','🎒'],['Adventurer','🧭']];   /* ranks 1-5 are the same for every future class; at level 5 you are an Adventurer until you pick a class */
const rk=lv=>RANKS[Math.min(lv-1,4)];
const BADGES=[
  {id:'first',e:'🌱',n:'First step',d:'Finish a quest'},
  {id:'perfect',e:'⭐',n:'Perfect day',d:'Finish all quests'},
  {id:'s3',e:'🔥',n:'On fire',d:'3-day streak'},
  {id:'s7',e:'⚡',n:'Unstoppable',d:'7-day streak'},
  {id:'s30',e:'👑',n:'Legend',d:'30-day streak'},
  {id:'l5',e:'🛡️',n:'Veteran',d:'Reach level 5'},
  {id:'l10',e:'🐉',n:'Dragon slayer',d:'Reach level 10'},
  {id:'l25',e:'🏆',n:'Champion',d:'Reach level 25'},
  {id:'l50',e:'🌟',n:'Mythic',d:'Reach level 50'},
  {id:'l100',e:'💫',n:'Eternal',d:'Reach level 100'}
];
const need=l=>Math.round(50*l*(l-1)*(1+.04*Math.max(0,l-2)));   /* total XP for level l: each level takes longer than the last */
let TR=0,QT='today',ADDOPEN=false,addTouched=false;   /* ADDOPEN = the new-quest note on the board is expanded */   /* QT = selected tab on the quest board */
/* ---- balance: small HP pool, penalties and XP both grow with level ---- */
const hpBase=l=>12+3*(l-1);                          /* max HP before trinkets: 12 at Lv 1 */
const subHp=(id,l)=>id==='guardian'?Math.round(hpBase(l)*.2):0;   /* Guardian: +20% base HP */
const hasSub=id=>S.sub===id;
const maxHp=l=>hpBase(l)+TR+subHp(S.sub,l);                       /* each trinket tier +2 */
const lscale=l=>1+(l-1)/4;                           /* x1 at Lv 1, x2 at Lv 5, x3.25 at Lv 10 */
const PEN={10:1,20:3,40:5};                          /* HP lost per missed quest at Lv 1: easy / medium / hard */
const penBase=xp=>PEN[xp]||Math.max(1,Math.round(xp/8));
const penalty=xp=>Math.max(1,Math.round(penBase(xp)*lscale(levelOf(S.xp))*dmgMult()*(hasSub('berserker')?1.25:1)));
const firstMult=first=>first&&hasSub('shadowblade')?1+.6*cm():1;   /* Shadowblade: first quest of the day */
const xpGain=(xp,first)=>Math.round(xp*lscale(levelOf(S.xp))*mult()*firstMult(first));
const lvBonus=()=>levelOf(S.xp)-1;                   /* levels above 1: every level adds +2% XP, +2% gold, -1% damage taken */
function levelOf(xp){let l=1;while(xp>=need(l+1))l++;return l}
const pad=n=>String(n).padStart(2,'0');
const dkey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dkey(new Date());
const dow=k=>new Date(k+'T12:00:00').getDay();     /* 0 Sun .. 6 Sat */
/* quest schedule: t.days = 'all' (every day, default) | 'wk' (Mon-Fri) | 'we' (Sat-Sun) */
const active=(t,k)=>{k=k||today();const g=t.days||'all',w=dow(k);return g==='all'||(g==='wk'?w>=1&&w<=5:w===0||w===6)};
const addDays=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dkey(d)};
const $=id=>document.getElementById(id);
/* draws an emoji tiny, then scales it up unsmoothed so it looks like pixel art */
function px(e,n){if(typeof e==='string'&&e.slice(0,4)==='pet:')return petIcon(e.slice(4),n);const c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');x.font=Math.round(n*.78)+'px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,n/2,n/2+1);c.className='px';return c}
/* ---------- companion pixel art: Wendigo (drawn procedurally, then snapped to a palette, shaded and outlined) ---------- */
const WP={ink:'#15100f',sk:'#a8a295',sk2:'#827c70',skd:'#4d4841',fur:'#3b3640',fur2:'#2b2730',bone:'#ebe2c8',boned:'#a9996f',ant:'#d6c8a2',antd:'#8a7b58',eye:'#ff5a2a',eyeh:'#ffe6a8',mouth:'#2a1214',tooth:'#f7f2de',claw:'#e4dcc0',sh:'#3f3548',shd:'#2a2232',frost:'#bfe6f2',ear:'#6e5d5e',fur3:'#d6d0c2',fur4:'#8d877b',hat:'#4d4259',ant2:'#bdb08c'};
function wendigoCanvas(res,tier){
  const mk=(w,h)=>{const q=document.createElement('canvas');q.width=w;q.height=h;return q};
  const K=res/96,c=mk(res,res),X=c.getContext('2d');
  X.scale(K,K);X.lineCap='round';X.lineJoin='round';
  const P=WP;
  const seg=(a,b,g)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L,r1=a[2]+g,r2=b[2]+g;
    X.beginPath();X.moveTo(a[0]+nx*r1,a[1]+ny*r1);X.lineTo(b[0]+nx*r2,b[1]+ny*r2);X.lineTo(b[0]-nx*r2,b[1]-ny*r2);X.lineTo(a[0]-nx*r1,a[1]-ny*r1);X.closePath();X.fill();
    X.beginPath();X.arc(a[0],a[1],r1,0,7);X.fill();X.beginPath();X.arc(b[0],b[1],r2,0,7);X.fill()};
  const limb=(pts,fill,edge,g)=>{g=g==null?1.1:g;if(edge){X.fillStyle=edge;for(let i=1;i<pts.length;i++)seg(pts[i-1],pts[i],g)}X.fillStyle=fill;for(let i=1;i<pts.length;i++)seg(pts[i-1],pts[i],0)};
  const poly=(pp,fill,edge)=>{X.beginPath();pp.forEach((p,i)=>i?X.lineTo(p[0],p[1]):X.moveTo(p[0],p[1]));X.closePath();if(edge){X.lineWidth=1.6;X.strokeStyle=edge;X.stroke()}X.fillStyle=fill;X.fill()};
  const line=(pp,col,w)=>{X.beginPath();pp.forEach((p,i)=>i?X.lineTo(p[0],p[1]):X.moveTo(p[0],p[1]));X.strokeStyle=col;X.lineWidth=w;X.stroke()};
  const dot=(x,y,r,col)=>{X.beginPath();X.arc(x,y,r,0,7);X.fillStyle=col;X.fill()};
  const claw=(x,y,dir,n,col)=>{for(let i=0;i<n;i++){const ox=x+(i-(n-1)/2)*2.6;poly([[ox-1,y],[ox+1,y],[ox+dir*1.2,y+5.5]],col,P.ink)}};
  /* ---- antlers: thin branching, pointed tines (front view, spread wide like the sketch) ---- */
  const antler=(main,tines,col,ed)=>{
    const T=tines.filter(t=>t.t<=tier);
    X.fillStyle=ed;for(let i=1;i<main.length;i++)seg(main[i-1],main[i],.85);
    T.forEach(t=>{for(let i=1;i<t.p.length;i++)seg(t.p[i-1],t.p[i],.85)});
    X.fillStyle=col;for(let i=1;i<main.length;i++)seg(main[i-1],main[i],0);
    T.forEach(t=>{for(let i=1;i<t.p.length;i++)seg(t.p[i-1],t.p[i],0)});
  };
  X.save();X.translate(3,0);   /* antlers, ears and head sit 3px to the right */
  antler([[26,35,1.5],[19,30,1.3],[12,24,1.1],[7,16,.9],[6,8,.6],[8,2,.4]],
    [{t:0,p:[[19,30,1],[19,22,.8],[16,14,.4]]},{t:0,p:[[12,24,.9],[13,17,.7],[10,10,.4]]},{t:0,p:[[7,16,.8],[2,13,.6],[1,7,.3]]},{t:1,p:[[16,27,.9],[9,27,.7],[4,23,.4]]},{t:1,p:[[6,8,.6],[11,7,.5],[12,2,.3]]},{t:2,p:[[23,32,.9],[25,24,.7],[26,16,.4]]},{t:2,p:[[12,24,.8],[8,22,.6],[3,20,.3]]}],
    P.ant2,P.ink);
  antler([[34,34,1.7],[36,26,1.5],[40,19,1.3],[45,12,1.1],[48,5,.8],[49,0,.4]],
    [{t:0,p:[[36,26,1.1],[30,22,.9],[27,14,.4]]},{t:0,p:[[40,19,1.1],[34,16,.9],[33,8,.4]]},{t:0,p:[[40,19,1.1],[47,19,.9],[53,12,.5]]},{t:0,p:[[45,12,.9],[52,9,.7],[55,3,.4]]},{t:1,p:[[48,5,.7],[43,3,.5],[42,0,.3]]},{t:1,p:[[37,23,1],[43,24,.8],[50,22,.4]]},{t:2,p:[[46,9,.7],[51,6,.5],[58,8,.3]]},{t:2,p:[[35,30,1],[29,29,.8],[25,24,.4]]}],
    P.ant,P.ink);
  /* ---- ears (big, pointed, like the sketch) ---- */
  poly([[23.6,39.2],[17.6,35.6],[13.4,30.8],[16.4,39.2],[22.4,43.4]],P.sk,P.skd);poly([[22.4,39.8],[18.2,36.2],[15.8,33.8],[17.6,39.2],[21.8,42.2]],P.ear,null);
  poly([[37.8,38.2],[42,34],[45.6,29.2],[44.4,37.6],[39.6,41.8]],P.sk,P.skd);poly([[39,38.2],[42,34.6],[44.4,31.6],[43.2,37],[40.2,40.6]],P.ear,null);
  X.restore();
  /* hands / feet */
  const hand=(x,y,col,edge,inner)=>{                     /* bony hand: palm, knuckles, 4 jointed fingers, thumb, pale claws */
    poly([[x-3.8,y-4],[x+3.8,y-4],[x+3.2,y+1],[x-3.2,y+1]],col,edge);
    line([[x-3,y-1.5],[x+3,y-1.5]],P.skd,.7);
    for(let i=0;i<4;i++){const fx=x+(i-1.5)*2.5,sp=(i-1.5)*.9,mx=fx+sp*.5,tx=fx+sp,ty=y+7.5-(i===1||i===2?.8:1.6);
      limb([[fx,y+.5,1.25],[mx,y+4,1.05],[tx,ty,.8]],col,edge,.65);
      dot(fx,y+1,1.05,P.boned);                                        /* knuckle */
      poly([[tx-.9,ty-.4],[tx+.9,ty-.4],[tx+sp*.25,ty+2.6]],P.claw,P.ink)}
    const tx0=x+inner*3.4;limb([[tx0,y-2,1.4],[tx0+inner*2.2,y+2,1.1],[tx0+inner*3,y+4.6,.8]],col,edge,.65);
    poly([[tx0+inner*2.4,y+4.2],[tx0+inner*3.6,y+4.4],[tx0+inner*3.6,y+6.6]],P.claw,P.ink)};
  const foot=(x,y,dir,col,edge)=>{limb([[x,y,2.7],[x+dir*2,y+3,2.4],[x+dir*5,92,1.8]],col,edge,1);
    for(let i=0;i<3;i++)dot(x+dir*(3+i*2.2),92.6,.8,P.claw)};
  /* ---- legs: left crouched, right stretched out ---- */
  limb([[56,68,5.2],[70,76,3.8],[79,87,2.1]],P.sk2,P.skd);
  line([[62,70],[68,76]],P.skd,.9);
  foot(79,87,1,P.sk2,P.skd);
  limb([[37,66,5.6],[30,78,4],[37,87,2.3]],P.sk,P.skd);
  line([[34,70],[31,76]],P.skd,1);line([[32,80],[35,85]],P.skd,.8);
  foot(37,87,-1,P.sk,P.skd);
  /* ---- torso: broad hunched shoulders and chest ---- */
  poly([[20,49],[25,44],[40,41],[53,42],[59,48],[59,58],[34,58],[27,56],[22,54]],P.sk,P.skd);
  limb([[22,48,5.5],[54,46,6.5]],P.sk,null,0);
  /* trapezius / neck fur ridge */
  poly([[26,45],[30,40],[34,44],[40,39],[45,44],[52,40],[56,46],[50,47],[40,46],[30,48]],P.fur4,P.ink);
  /* chest: pecs, sternum, collarbones, fur tuft */
  line([[28,52],[34,55],[40,53]],P.skd,1.1);line([[40,53],[47,55],[55,52]],P.skd,1.1);
  line([[40,46],[40,56]],P.skd,.9);
  line([[28,47],[37,49]],P.skd,.9);line([[43,49],[54,47]],P.skd,.9);
  poly([[36,49],[39,53],[41,49],[43,54],[45,49],[44,56],[38,56]],P.fur3,null);
  /* ribs hint, abs */
  line([[31,56.5],[36,57]],P.skd,.8);line([[46,57],[53,56.5]],P.skd,.8);
  /* ---- shorts with hatching ---- */
  X.save();
  poly([[35,61],[44,59],[57,54],[60,62],[58,70],[52,75],[47,71],[41,75],[35,72],[32,67]],P.sh,P.ink);
  X.beginPath();X.moveTo(35,61);X.lineTo(44,59);X.lineTo(57,54);X.lineTo(60,62);X.lineTo(58,70);X.lineTo(52,75);X.lineTo(47,71);X.lineTo(41,75);X.lineTo(35,72);X.lineTo(31,66);X.closePath();X.clip();
  for(let i=-10;i<34;i+=4.4)line([[28+i,52],[40+i,78]],P.hat,.6);
  X.restore();
  line([[36,61],[44,59.4],[58,55]],P.shd,1.4);
  /* ---- arms: thick, long, straight down ---- */
  limb([[22,50,5.2],[19,62,4.6],[18,72,3.6],[19,81,2.8]],P.sk,P.skd);
  line([[22,54],[20,60]],P.skd,1);line([[20,65],[19,70]],P.sk2,.8);line([[18,76],[19,80]],P.skd,.8);
  hand(19,84.5,P.sk,P.skd,1);
  limb([[55,48,6.4],[62,58,5],[64,67,4.4],[61,77,3.4],[60,82,2.8]],P.sk,P.skd);
  line([[57,50],[61,56]],P.skd,1.1);line([[62,62],[63,68]],P.sk2,.9);line([[60,72],[60,79]],P.skd,.8);
  hand(60,84.5,P.sk,P.skd,-1);
  X.save();X.translate(34,38);X.rotate(.09);X.scale(1.02,1.02);X.translate(-31,-38);
  /* ---- head: three-quarter deer skull (long tapered snout, heavy brow, deep sockets, small burning eyes) ---- */
  poly([[34,49],[40,46],[43,52],[40,59],[35,58]],P.fur4,P.ink);poly([[36,51],[40,49],[41,54],[38,57]],P.fur3,null);   /* cheek fur behind the jaw */
  limb([[30,57.4,2.6],[30.6,61.6,1.6]],P.bone,P.ink,1);                           /* lower jaw */
  limb([[32,35,6.6],[31.4,43,5.6],[30.4,51,3.5],[29.6,56.4,2.5]],P.bone,P.ink,1.1);   /* cranium narrowing into a long snout */
  poly([[33.4,36.5],[37.6,40.5],[36.6,47.5],[33.4,52.5],[31.6,52],[32.8,44]],P.boned,null);   /* shaded far side of the face */
  dot(27,32.8,1.7,P.boned);dot(27,32.8,.8,P.ant);dot(36.4,32.4,1.7,P.boned);dot(36.4,32.4,.8,P.ant);   /* antler burrs */
  line([[22.6,39.6],[28.8,41.2]],P.boned,2);line([[39.6,39],[33.6,40.8]],P.boned,1.6);   /* heavy brow ridges */
  poly([[22.4,41.8],[28.9,42.2],[28.3,47.6],[23.2,46.6]],P.mouth,P.ink);               /* sunken sockets: near one larger, far one smaller */
  poly([[33.6,42.2],[38.6,41.4],[38,46.4],[34,47.2]],P.mouth,P.ink);
  dot(26,44.8,1.5,P.eye);dot(26.4,44.3,.7,P.eyeh);
  dot(35.9,44.4,1.2,P.eye);dot(36.2,44,.6,P.eyeh);
  line([[32,36.5],[30.6,52]],P.boned,1);                                          /* nose bridge */
  line([[27.8,47.6],[28.8,52]],P.boned,.7);line([[34.2,47.8],[32,52.4]],P.boned,.7);   /* muzzle ridges */
  line([[26.4,38.4],[24.6,45.6]],P.skd,.6);line([[36.6,38.4],[37.4,45]],P.skd,.6);     /* cracks running down from the brow */
  dot(28.6,55,1.1,P.ink);dot(31.8,55,1.1,P.ink);                                  /* nostrils */
  line([[27.2,58.2],[33.8,58.2]],P.ink,1.3);                                      /* mouth line */
  for(let i=0;i<4;i++){const x=27.8+i*1.9;poly([[x,58.6],[x+1.2,58.6],[x+.6,61]],P.tooth,P.ink)}   /* fangs */
  X.restore();
  if(tier>=2){
    [[10,56],[6,48],[14,40],[4,64],[86,40],[90,50]].forEach(p=>dot(p[0],p[1],.9,P.eye));
    [[26,60],[36,62]].forEach(p=>dot(p[0],p[1],1,P.frost));
  }
  /* ---------- pixelate: threshold alpha, snap to palette ---------- */
  const id=X.getImageData(0,0,res,res),d=id.data;
  const pal=Object.values(WP).map(h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),h]);
  const idx=new Array(res*res).fill(null);
  for(let i=0;i<res*res;i++){if(d[i*4+3]<110)continue;let b=1e9,bi=0;for(let j=0;j<pal.length;j++){const e=(d[i*4]-pal[j][0])**2+(d[i*4+1]-pal[j][1])**2+(d[i*4+2]-pal[j][2])**2;if(e<b){b=e;bi=j}}idx[i]=bi}
  const get=(x,y)=>x<0||y<0||x>=res||y>=res?null:idx[y*res+x];
  const mul=(h,f)=>{const n=parseInt(h.slice(1),16);return '#'+[16,8,0].map(s=>Math.max(0,Math.min(255,Math.round(((n>>s)&255)*f))).toString(16).padStart(2,'0')).join('')};
  const inkI=pal.findIndex(p=>p[3]===P.ink);
  const out=Array.from({length:res},()=>Array(res).fill(null));
  const glow=[P.eye,P.eyeh,P.frost,P.tooth,P.claw];
  for(let y=0;y<res;y++)for(let x=0;x<res;x++){
    const v=get(x,y);if(v==null)continue;const h=pal[v][3];
    if(h===P.ink||glow.includes(h)){out[y][x]=h;continue}
    const ul=get(x-1,y-1),dr=get(x+1,y+1);
    let col=h;
    if(ul!==v&&ul!==inkI&&dr===v)col=mul(h,1.22);                 /* lit edge (up-left) */
    else if(dr!==v&&dr!==inkI&&ul===v)col=mul(h,.78);             /* shaded edge (down-right) */
    if(((x*7+y*13)%11===0)&&(h===P.sk||h===P.sk2))col=mul(h,.9);  /* skin grain */
    out[y][x]=col;
  }
  /* outer ink outline */
  const fin=out.map(r=>r.slice());
  for(let y=0;y<res;y++)for(let x=0;x<res;x++){if(out[y][x])continue;
    if([[1,0],[-1,0],[0,1],[0,-1]].some(o=>{const xx=x+o[0],yy=y+o[1];return xx>=0&&yy>=0&&xx<res&&yy<res&&out[yy][xx]&&out[yy][xx]!==P.ink&&out[yy][xx]!==P.frost}))fin[y][x]=P.ink}
  X.setTransform(1,0,0,1,0,0);X.clearRect(0,0,res,res);
  for(let y=0;y<res;y++)for(let x=0;x<res;x++)if(fin[y][x]){X.fillStyle=fin[y][x];X.fillRect(x,y,1,1)}
  return c;
}


/* ---------- companion pixel art: Fire Wolf Cub (a 47x49 pixel-art wolf with a burning eye, a flame mane along its back and a flaming tail tip; stored as a palette + run-length rows stored as a palette + run-length rows: each row is a list of [startColumn,'tokens'], a token is a palette letter plus an optional repeat count, e.g. 'k e3' = 1 ink + 3 body pixels). Sits on a 49x49 square canvas so it scales like the other companions; it faces right. ---------- */
const WOLFPUP={p:{k:'#121318',a:'#1e1e2b',b:'#262634',c:'#313146',d:'#ff5a1a',e:'#41455c',f:'#776b85',g:'#be657b',h:'#9d93a9',i:'#aea7bb',m:'#ff3a1a',n:'#ff7a1a',o:'#ffc02a',p:'#fff6c8',q:'#8a1a10'},r:[
[[31,'k']],
[[30,'k e k'],[42,'k2']],
[[29,'k2 e2 a'],[41,'k b k']],
[[29,'k e3 k'],[40,'k b2 a']],
[[28,'k2 e2 g c k'],[39,'k b2 f a']],
[[28,'k2 e g2 e k'],[38,'k b2 c f a']],
[[28,'k e2 g e3 k6 c f k']],
[[28,'k e2 g k e k e6 k3']],
[[28,'k e3 k b e8 k']],
[[28,'k e2 b e11 k']],
[[28,'k b4 e5 i2 e3 i e']],
[[27,'k2 b2 e6 i4 e2 i k']],
[[26,'k b3 e10 i e b e k']],
[[25,'k c k b e6 k5 e3 k']],
[[24,'a c k e8 k d2'],[39,'k e3 k2']],
[[25,'k3 b e6 k g d g k2 e3 k']],
[[24,'k e b e8 f a g k2 b i4 k']],
[[25,'k e b e5 b i3 e i8 k']],
[[24,'k c k e f c f c2 f2 i10 f2 k']],
[[25,'k3 b e c2 b2 k i10 k3']],
[[25,'k b k2 b c b2 k f12 k']],
[[24,'k b2 k b k2 b k2 f4 k8']],
[[22,'k2 b7 k b k f7 k']],
[[15,'k6 c e3 b7 k f8 k']],
[[13,'e3 k2 e10 b4 k f8 k']],
[[12,'c e3 k e14 b f4 i2 f3 k']],
[[11,'c e3 b k e14 c2 f h f i2 f h f k']],
[[10,'b c e2 b a e16 c h i h f i f2 c']],
[[10,'e4 b a e16 b f i2 f i h f k']],
[[9,'k e4 b a e5 b e10 a e h i f h i f e']],
[[9,'e4 c a2 e5 b a e2 c b e6 c h3 f h k']],
[[8,'k e4 c a2 e5 b k b e b2 e6 f i f4 a']],
[[8,'k e4 c a k e5 b k b4 e5 k f3 h k2']],
[[7,'k e5 c a k b e4 b2 k b2 k e4 k b f h f k3']],
[[7,'a e5 c b a b e4 b2 k4 e4 k f3 k2 b k']],
[[6,'k e6 c b a k e4 b2 k4 e3 b k5 b2 k']],
[[5,'k e6 c b2 a k e3 b2 k2 b2 k e3 k2'],[34,'k b3 k']],
[[2,'k3 e7 c b3 k e2 b3 k2 b2 k e3 k'],[34,'k b3 k']],
[[1,'k e9 c b2 a2 e2 b3 k'],[23,'k b2 k e3 k'],[34,'k b3 k']],
[[1,'k2 b2 e4 b5 a2 e2 b2 k'],[23,'k b2 k e3 k'],[34,'k2 b e b']],
[[2,'k2 b9 a k a e2 b k'],[23,'k b2 k e3 k'],[35,'k b e c']],
[[3,'k b8 a f'],[15,'a e2 k2'],[23,'k b2 k e3 k'],[35,'k b e c']],
[[4,'k2 b4 k2 i'],[15,'a e2 k2'],[23,'k b e k2 e2 k'],[35,'k b e c']],
[[5,'k5'],[15,'a e3 k'],[24,'k e2 k e2 k'],[35,'k b e2 k']],
[[15,'k2 i2 c b'],[24,'k2 e k e2 k'],[35,'k2 i3 e']],
[[16,'k h k i k b'],[25,'k3 i3 e'],[36,'k i f k e k']],
[[16,'k e k f k2'],[27,'k i f k e k'],[36,'k f2 k e k']],
[[17,'k5'],[27,'k2 f k e k'],[36,'k6']],
[[28,'k5']]
]};
/* ph = animation frame 0-3: the flames lean and change height, the embers drift up. The idle code below cycles through the frames. */
function wolfpupCanvas(ph){
  ph=ph||0;
  const W=49,c=document.createElement('canvas');c.width=c.height=W;
  const X=c.getContext('2d'),P=WOLFPUP.p;
  /* a pixel flame: x,y = middle of its base, h = height, w = half width at the base, lean = how far the tip drifts sideways.
     Four nested layers (dark red outline, red, orange, yellow, pale core). Drawn BEFORE the body, so the base hides behind the fur. */
  const flame=(x,y,h,w,lean)=>{
    const hh=h+(ph%2?1:0)+(ph===3?-1:0),ln=lean+(ph===1?.9:ph===2?-.9:ph===3?.4:0);
    [[1.2,0,1,'q'],[1,0,1,'m'],[.72,.08,.86,'n'],[.46,.16,.62,'o'],[.24,.26,.36,'p']].forEach(([sc,y0,top,col])=>{
      X.fillStyle=P[col];
      for(let i=Math.floor(y0*hh);i<Math.ceil(hh*top)+(col==='q'?1:0);i++){
        const t=i/hh,half=Math.max(.5,w*sc*Math.pow(Math.max(0,1-t),.85)),cx=x+ln*t*t*2+Math.sin(ph*1.7+i*.7)*.5*t,wd=Math.max(1,Math.round(half*2));
        X.fillRect(Math.round(cx-wd/2),y-i-(col==='q'?1:0)*0,wd,1);
      }
    });
  };
  flame(5,37,13,3.2,.6);                 /* tail tip */
  flame(16,25,8,2.4,-.3);flame(20,24,11,2.8,.2);flame(24,24,8,2.3,.7);   /* mane along the back */
  WOLFPUP.r.forEach((segs,y)=>segs.forEach(([x0,rle])=>{
    let x=x0;
    rle.split(' ').forEach(t=>{const n=t.length>1?+t.slice(1):1;X.fillStyle=P[t[0]];for(let i=0;i<n;i++)X.fillRect(x++,y,1,1)});
  }));
  /* embers drift up from the flames (only drawn over empty space) */
  [[12,17,0],[27,13,1],[8,30,2],[1,26,1],[19,9,2],[31,21,0],[6,20,1]].forEach(([ex,ey,k])=>{
    const y=ey-ph*(k+1)%7,px=ex+(ph%2?1:0);if(y<0||y>=W||px<0||px>=W)return;
    if(X.getImageData(px,y,1,1).data[3]===0){X.fillStyle=[P.n,P.o,P.m][(k+ph)%3];X.fillRect(px,y,1,1)}
  });
  return c;
}

/* ---------- boss pixel art: Direwolf Pack ----------
   The wolf is a 43x30 pixel-art sprite (from Sprite-AI, "starter wolf-like creature") stored as a palette + rows of characters
   ('.' = transparent). The pack is that one sprite three times: the lead wolf at full colour in front, two darker ones behind it,
   each with an ink outline and a contact shadow. Canvas is 65x38 and shown at 3x (195x114, set inline below so style.css stays as it is). The three wolves stand side by side on the same
   ground line (only 1 pixel row apart, so no paws hang in the air), shifted left one after another so all three heads show. They face left, toward the hero. */
const WOLFSPR={p:{a:'#2b242b',b:'#302830',c:'#7f6e7a',d:'#564a51',e:'#50464f',f:'#4b4147',g:'#776774',h:'#685a65',i:'#3a3039',j:'#736370',k:'#bc998f',l:'#0a0908',m:'#926b5b',n:'#ad8a7d',o:'#7d6554',p:'#6f594c'},r:[
  '...a....b........cccddd....................',
  '...ee..fd......dddfabaabb..................',
  '...gfhiad.hdb.deibbeeeedbi.................',
  '...haahafiaaaaaeeedejjjddbbb...............',
  '...bbehajabbeeeeegjjjjjjjjeedgfb...........',
  '...bjefajaeeeegggejeeffjjjgjdeehhi.........',
  '..jgjjefjbbdeegjjjjeeeeegggjjejkchi........',
  '..ggadjjjjibeeejeffaaeeeejjjjfjjcdbb.......',
  '..fgdlljjeeeieedeaahbeeejjgjeejjjdebf......',
  '..lflmlkjjhaabffbfhhhaaejdgheafjjjeba......',
  '..deflkknjibiababfgchaaeeggeeabjjjeebf.....',
  '.cjneeokmiaaiiiiajjkhaaaeffebabeggeebee....',
  'hcknnebbbaiiiaiiadkchhhaiiibi.bfhcjeadde...',
  'llpfaa...baaiiiiaahhdccbbiba..bbjjjeeaeeihh',
  '.iii......baaaiiiaedeccbaaaa...bdjjhebaeeeb',
  '.iii......baaaiiiaedeccbaaaa...bdjjhebaeeeb',
  '..........aiaaaiaiaidfffaiia....adhceebbbb.',
  '.........aaibaaaaiibhggfaaiib....ihcceb....',
  '........bffba......ahggf.aaiaa....iihgbb...',
  '........bafaa......aegga..aiib......affb...',
  '.......iddba.......aeeea..aia........aeb...',
  '......deeeb........aeeea..iii........beb...',
  '.....cnmfa.........eeiiaiiab.........bfb...',
  '....jkkdp..........fjiiapmfb.........bhb...',
  '...mkkna...........dkiiaada.........hdcb...',
  '..nmmko............mkoo............mkokb...',
  '..badfo...........jnkmm............boapa...',
  '...bfm...........nkmkoo....................',
  '................oaoaoaa....................',
  '.................apap......................'
]};
function direwolfpackCanvas(){   /* 65x38, shown at 3x */
  const W=65,H=38,c=document.createElement('canvas');c.width=W;c.height=H;c.style.width=W*3+'px';c.style.height=H*3+'px';c.style.marginRight='-10px';   /* nudges the whole pack 10px toward the right edge, further from the hero */
  const X=c.getContext('2d'),R=WOLFSPR.r,sh=R.length,sw=R[0].length,INK='#15100f';
  const mul=(h,f)=>{const n=parseInt(h.slice(1),16);return '#'+[16,8,0].map(s=>Math.max(0,Math.min(255,Math.round(((n>>s)&255)*f))).toString(16).padStart(2,'0')).join('')};
  const wolf=(ox,oy,f)=>{   /* one copy of the sprite at (ox,oy), brightness f, with an outline and a shadow under its paws */
    const G=Array.from({length:sh+2},()=>Array(sw+2).fill(null));
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const k=R[y][x];if(k!=='.')G[y+1][x+1]=mul(WOLFSPR.p[k],f)}
    const O=G.map(r=>r.slice());
    for(let y=0;y<sh+2;y++)for(let x=0;x<sw+2;x++)if(!G[y][x]&&[[1,0],[-1,0],[0,1],[0,-1]].some(o=>(G[y+o[1]]||[])[x+o[0]]))O[y][x]=INK;
    X.fillStyle='rgba(0,0,0,.35)';X.fillRect(ox+5,oy+sh,34,1);X.fillRect(ox+9,oy+sh+1,24,1);   /* contact shadow */
    for(let y=0;y<sh+2;y++)for(let x=0;x<sw+2;x++)if(O[y][x]){X.fillStyle=O[y][x];X.fillRect(ox-1+x,oy-1+y,1,1)}
  };
  /* back to front: the two behind are darker and stand one pixel row higher each (so their paws are still well inside the grass, not in the air) */
  wolf(0,4,.66);
  wolf(11,5,.86);
  wolf(22,6,1.1);
  return c;
}

/* companion art registry: a pet whose emoji field is 'pet:<key>' is drawn from code instead of as an emoji */
const PETART={wendigo:(res,tier)=>wendigoCanvas(res,tier),wolfpup:()=>wolfpupCanvas(0)};
const PETCROP={wendigo:[0,0,64,64],wolfpup:[20,0,28,28]};
PETART.direwolfpack=()=>direwolfpackCanvas();PETCROP.direwolfpack=[19,4,24,24];   /* which part of the full art becomes the small icon (the head(s)) */
const petTier=lv=>lv>=14?2:lv>=BIG_LV?1:0;      /* growth: more antler tines at Lv 8, embers at Lv 14 */
function petSprite(key,res,tier){const c=PETART[key](res,tier);c.className='px';return c}
function petIcon(key,n){                          /* small icon = the head and antlers, cropped from the full art */
  const src=PETART[key](96,0),c=document.createElement('canvas');c.width=c.height=n;c.className='px';
  const x=c.getContext('2d');const cr=PETCROP[key]||[0,0,96,96];x.imageSmoothingEnabled=false;x.drawImage(src,cr[0],cr[1],cr[2],cr[3],0,0,n,n);return c;
}

/* ---------- pixel-art hero ----------
   The look comes only from what you wear: each slot is a style (knight / mage / rogue / cleric, or a weapon type)
   at a tier 0-5 (plain -> iron -> steel -> mythril -> gold -> dragon). Class never changes the look.
   30x30 bust or 30x40 full body, auto-outlined. */
const MATS=['#8b6b43','#8e9ab0','#c3ccda','#4aa8d8','#e8b93c','#f6d56a'];   /* leather, iron, steel, mythril, gold, legendary */
const BLADE=['#a8824a','#aab3c2','#e4eaf4','#8fe3f5','#f0c040','#fff1a8'];     /* wood, iron, steel, mythril, gold, legendary */
const TUN={ /* body colour per gear tier (0-5) */
warrior:MATS,
mage:['#7a5a98','#3a6ac0','#6a3ab0','#2a4a9a','#4a2a8a','#eae0ff'],
rogue:['#6a5a3a','#3a5a40','#2a3a30','#22262e','#1a1a22','#16141c'],
cleric:['#e4dcc4','#efe6cc','#f4efd0','#f8f4e0','#fffbea','#ffffff']
};
/* body shape comes from 4 sliders (0-100, 50 = average): shoulders, waist, hips, arms.
   Older saves had a preset (slim / avg / strong / heavy); those are turned into slider values so nothing changes for them. */
const BSL=[['bSh','Shoulders'],['bWa','Waist'],['bHi','Hips'],['bAr','Arms']];
const BPRESET={slim:{bSh:28,bWa:25,bHi:25,bAr:15},avg:{bSh:50,bWa:50,bHi:50,bAr:50},strong:{bSh:100,bWa:62,bHi:55,bAr:90},heavy:{bSh:60,bWa:100,bHi:90,bAr:65}};
const bval=(lk,k)=>lk&&lk[k]!=null?+lk[k]:BPRESET[lk&&BPRESET[lk.build]?lk.build:'avg'][k];
const fillBuild=k=>{BSL.forEach(([key])=>{if(k[key]==null)k[key]=bval(k,key)})};
const seg3=(t,a,b,c)=>t<.5?a+(b-a)*t*2:b+(c-b)*(t-.5)*2;   /* 0 -> a, 0.5 -> b, 1 -> c */
/* half-width (body + arms) at given rows, y=17 shoulders .. y=36 hips, plus arm thickness */
function bodyShape(lk,fem){
  const sh=bval(lk,'bSh')/100,wa=bval(lk,'bWa')/100,hi=bval(lk,'bHi')/100,ar=bval(lk,'bAr')/100;
  const pts=fem
    ?[[17,seg3(sh,4.0,5.0,6.2)],[20,seg3(sh,4.4,5.6,6.8)],[24,seg3(wa,3.6,4.6,6.4)],[28,seg3(wa,4.4,5.6,7.6)],[36,seg3(hi,5.6,7.0,8.8)]]
    :[[17,seg3(sh,5.4,6.8,8.4)],[20,seg3(sh,6.0,7.8,9.6)],[24,seg3(wa,5.6,7.0,9.4)],[27,seg3(wa,5.8,7.0,9.8)],[30,seg3(wa,5.8,7.0,9.4)],[36,seg3(hi,6.2,7.2,9.0)]];
  return {pts,aw:fem?seg3(ar,1.1,1.8,2.6):seg3(ar,1.3,2.2,3.0)};
}
function hexMul(h,f){const n=parseInt(h.slice(1),16);return '#'+[16,8,0].map(s=>Math.max(0,Math.min(255,Math.round(((n>>s)&255)*f))).toString(16).padStart(2,'0')).join('')}
/* stage 0-10 = level 5-15 (capped). tier m = stage>>1 picks the material: leather, iron, steel, mythril, gold, legendary */
function bustGrid(look,full,eq){
  const W=30,Hh=full?40:30;let G=Array.from({length:Hh},()=>Array(W).fill(null));
  const P=(x,y,c)=>{y+=2;if(x>=0&&y>=0&&x<W&&y<Hh)G[y][x]=c};
  const R=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let k=0;k<w;k++)P(x+k,y+j,c)};
  const MR=(x,y,w,h,c)=>{R(x,y,w,h,c);R(W-x-w,y,w,h,c)};
  const MP=(x,y,c)=>{P(x,y,c);P(W-1-x,y,c)};
  const M=hexMul,E=eq||{helm:0,armor:0,weapon:0,trinket:0,offhand:0,sO:'warrior',nO:true,sH:'warrior',sA:'warrior',sW:'warrior'};
  /* every slot is a style (warrior/mage/rogue/cleric/great) at a tier 0-5 (= stage 0-10). s,m switch per body part below */
  const noH=!!E.nH,noA=!!E.nA,noW=!!E.nW,noO=!!E.nO,oS=E.sO||'warrior';   /* nothing worn in that slot: draw no gear for it */
  const sA=E.armor*2,sH=E.helm*2,sW=E.weapon*2,tr=E.trinket,aS=E.sA,hS=E.sH,wS=E.sW;
  let s=sA,m=s>>1,tun=TUN[aS][m];
  const lk=look||DEF_LOOK,hair=lk.hairC;
  const LK=k=>lk[k]!=null?lk[k]:DEF_LOOK[k];   /* older saved looks lack the newer options */
  const RC=LK('race');
  const mix=(a,b,t)=>{const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);return '#'+[16,8,0].map(q=>Math.round(((x>>q)&255)*(1-t)+((y>>q)&255)*t).toString(16).padStart(2,'0')).join('')};
  const fem=!!(lk&&lk.sex==='f');
  const BSH=bodyShape(lk,fem),BP=BSH.pts,AW=BSH.aw;   /* build: from the body sliders */
  const hwAt=y=>{y=Math.max(17,Math.min(36,y));for(let i=1;i<BP.length;i++)if(y<=BP[i][0]){const a=BP[i-1],b=BP[i];return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0])}return BP[BP.length-1][1]};
  const GOLD='#e8b93c',RED='#d63a47',WH='#f4efd0',BR='#6a4a2a',SK=lk?lk.skin:'#f0c49a',SKD=M(SK,.85),INK='#2a1c14',cx=14.5;
  const bot=full?36:28,SKS=[SK,M(SK,.88),M(SK,.9)];
  let base,D,L;const setCol=(st,mm)=>{tun=TUN[st][mm];base=M(tun,.9);D=M(tun,.7);L=M(tun,1.25)};setCol(aS,m);
  const ramp=(c,l)=>M(c,[.5,.68,.85,1.05,1.3][Math.max(-2,Math.min(2,l))+2]);
  /* clothing details were drawn for the old wide body: scale their x-position/width to the chosen build */
  const OLDW=y=>Math.min(7+(Math.max(17,y)-17)*.75,11);
  const sx=(x,y)=>Math.round(cx+(x-cx)*hwAt(y)/OLDW(y));
  const sR=(x,y,w,h,c)=>{const a=sx(x,y),b=sx(x+w-1,y);R(a,y,Math.max(1,b-a+1),h,c)};
  const sMR=(x,y,w,h,c)=>{const a=sx(x,y),b=sx(x+w-1,y);MR(Math.min(a,b),y,Math.abs(b-a)+1,h,c)};
  const sP=(x,y,c)=>P(sx(x,y),y,c);
  const sMP=(x,y,c)=>MP(sx(x,y),y,c);
  const body=(c,w0,gr,mx,fold)=>{
    const fl=mx-11,fy=y=>fl*Math.min(1,(y-17)/8);   /* robes flare out at the bottom */
    for(let y=17;y<bot;y++)for(let x=0;x<W;x++){
      const dx=Math.abs(x-cx),hw=hwAt(y)+fy(y);
      if(dx>hw||y>bot-.5-dx*.12)continue;
      let l=x<cx-2?1:x>cx+2?-1:0;
      if(fold){const f=Math.sin(y*.95+dx*.55);l+=f>.55?1:f<-.55?-1:0}
      P(x,y,ramp(c,y===17?2:l));
    }
    for(let y=20;y<bot-1;y++){                       /* arm / torso seam */
      const q=Math.round(cx-(hwAt(y)+fy(y)-AW)),c0=(G[y+2]||[])[q],c1=(G[y+2]||[])[29-q];
      if(c0)P(q,y,M(c0,.78));if(c1)P(29-q,y,M(c1,.78));
    }
  };
  const cape=(col,trim)=>{for(let y=18;y<bot;y++){const hw=Math.min(14.4,hwAt(y)+1+(y-18)*.2);for(let x=0;x<W;x++){const dx=Math.abs(x-cx);if(dx>hw||y>bot-.5-dx*.12)continue;P(x,y,trim&&dx>hw-1.3?trim:ramp(col,x<cx-3?1:x>cx+3?-1:0))}}};
  const halo=(w,c,dy)=>{const x0=Math.round(cx-w/2+.5),y=-2+(dy||0);R(x0+1,y,w-2,1,c);P(x0,y+1,c);P(x0+w-1,y+1,c);R(x0+1,y+2,w-2,1,c)};
  /* ---- things behind the body ---- */
  if(aS==='warrior'&&s>=7)cape(s>=10?'#c2282e':'#a8283a',s>=8?GOLD:null);
  if(aS==='mage'&&s>=7){cape(s>=10?'#4a3a9a':'#262a6a',s>=8?GOLD:null);[[5,24],[24,22],[7,29],[22,30],[4,20],[25,26]].forEach(p=>P(p[0],p[1]-3,'#fff3b0'))}
  if(aS==='rogue'&&s>=6)cape(s>=8?'#16141c':'#1e3a3a',s>=8?GOLD:null);
  if(aS==='cleric'&&s>=10){
    [[5,6],[7,8],[8,9],[8,9],[7,8],[6,6],[4,4]].forEach((r,k)=>{const y=11+k*2,w=r[1];MR(6-w,y,w,2,k<2?'#ffffff':'#f0e6d0');MR(6-w,y,1,2,k%2?GOLD:'#fff3b0')});
  }
  const HB=M(TUN[hS][sH>>1],.9);
  if(!noH&&hS==='rogue')for(let y=0;y<19;y++)for(let x=0;x<W;x++){               /* hood back */
    let u=(x-cx)/10;const v=(y-8.5)/10;if(y<8.5)u/=.65+.35*(y/8.5);
    const d=u*u+v*v;if(d<=1)P(x,y,ramp(HB,Math.round((-.6*u-.7*v)*1.6)-(d>.8?1:0)));
  }
  /* ---- clothing ---- */
  const BODY={
    warrior:()=>{
      const MC=tun,MD=M(MC,.7),ML=M(MC,1.3),SB='#5a3a22';
      body(MC,7,.8,11);
      if(m===0){                                   /* leather jerkin */
        for(let k=0;k<8;k++){sR(9+k,18+k,2,1,SB);sR(19-k,18+k,2,1,SB)}
        sR(8,27,14,1,'#4a2e1a');sR(14,26,2,2,GOLD);
        if(s>=1){sMR(3,17,5,3,'#a07a45');sMR(3,17,5,1,'#c2a068')}
      }else{                                        /* chain -> plate -> gold */
        if(m===1)for(let y=18;y<27;y++)for(let x=5;x<25;x++)if((x+y)%2===0&&(G[y+2]||[])[x])P(x,y,M(MC,1.18));
        sR(11,18,8,1,ML);sR(14,19,2,8,MD);sMR(8,20,5,1,ML);sMR(8,23,5,1,MD);
        sR(8,27,14,1,m>=4?GOLD:MD);sR(14,26,2,2,m>=4?RED:ML);
        if(m>=3)sMR(9,19,3,1,GOLD);
        if(m>=4)sMR(8,18,1,9,GOLD);
      }
      if(s>=3){                                     /* pauldrons */
        const pw=s>=7?8:7,pc=s>=8?GOLD:MC;
        sMR(2,17,pw,4,pc);sMR(2,17,pw,1,M(pc,1.35));sMR(2,20,pw,1,M(pc,.65));
        if(s>=6){sMP(4,16,ML);sMP(4,15,ML);sMP(3,14,ML)}
      }
      if(s>=10){sR(14,20,2,2,RED);sP(14,20,'#ff9aa4');sMR(3,18,4,1,WH);sR(11,17,8,1,'#fff')}
    },
    mage:()=>{
      body(tun,7,.75,12,true);
      sR(8,26,14,1,s>=8?GOLD:M(tun,.5));                           /* belt / sash */
      if(s>=1)sR(14,26,2,2,s>=4?GOLD:'#c2a46a');
      if(s>=3)sMR(3,24,4,2,GOLD);                                   /* cuffs */
      if(s>=5){sMR(4,17,7,3,M(tun,.85));sMR(4,17,7,1,s>=8?GOLD:M(tun,1.4))} /* mantle */
      if(m>=2)for(let y=18;y<27;y++)for(let x=5;x<25;x++)if((x*3+y*5)%17===0&&(G[y+2]||[])[x])P(x,y,m>=4?GOLD:'#fff3b0');
      if(s>=8){sR(14,17,2,11,GOLD)}
      if(s>=10){sMR(5,26,4,1,GOLD);sR(11,17,8,1,'#fff')}
    },
    rogue:()=>{
      body(tun,7,.7,11,true);
      for(let k=0;k<8;k++)sR(9+k,18+k,2,1,m>=4?GOLD:BR);              /* bandolier */
      if(s>=1){sR(8,26,14,1,BR);sR(15,26,2,2,s>=8?GOLD:'#a08a5a');sMP(9,25,M(BR,1.4))}  /* belt + pouch */
      if(s>=2)for(let k=0;k<3;k++)sP(12+k,22+k,'#dfe6f2');
      if(s>=5){sMR(3,17,6,3,M(tun,.7));sP(14,17,GOLD);sP(15,17,GOLD)}   /* spaulders + clasp */
      if(s>=8)sMR(8,18,1,9,GOLD);
    },
    cleric:()=>{
      body(tun,7,.7,11,true);
      if(s<1)sR(8,25,14,1,'#a08a5a');                                  /* rope belt */
      if(s>=1){sR(14,20,2,4,GOLD);sR(13,21,4,1,GOLD)}                   /* holy symbol */
      if(s>=3)sR(8,27,14,1,GOLD);                                      /* gold hem */
      if(s>=5){sMR(11,17,2,11,s>=6?'#3a8fe0':GOLD);if(s>=8)sMR(11,17,2,11,GOLD)} /* stole */
      if(s>=3)sMR(9,20,2,1,M(tun,.6));
      if(s>=7){sMR(3,17,8,3,M(tun,.9));sMR(3,17,8,1,GOLD)}              /* mantle */
      if(s>=9)sMR(2,17,1,10,GOLD);
      if(s>=10){sR(14,18,2,3,'#fff');sR(13,19,4,1,'#fff')}
    }
  };
  if(noA){   /* no armor: plain peasant clothes - linen shirt with cuffs, rope belt, patched brown trousers, leather shoes */
    const BOD='#7a3a34',SKT='#8b6a45',SH='#dccfae',PN='#6b5638',ROPE='#a07e48',SHO='#4a3320',tw=y=>hwAt(y)-AW+.3,pw=y=>tw(y)-.8;
    const ownHands=noW,hy=noW?25:22,ao22=hwAt(22),AWr=Math.max(2,Math.round(AW));   /* no weapon: arms hang to the hips with their own hands */
    for(let y=17;y<=37;y++)for(let x=0;x<W;x++){
      const dx=Math.abs(x-cx),hw=hwAt(y),side=x<cx-2?1:x>cx+2?-1:0;
      if(y<=26){                                                       /* shirt: chest + long sleeves down to the hands */
        const aoY=y>=22?ao22:hw,ai=y>=22?ao22-AWr:tw(y);                 /* arms hang straight down below the shoulders */
        const inArm=dx>ai&&dx<=aoY&&y<hy;
        if(ownHands&&y>=hy&&y<hy+2&&dx>ao22-AWr+(AWr>2?1:0)&&dx<=ao22){P(x,y,x<cx?SK:M(SK,.85));continue}   /* hands */
        if(!inArm&&(dx>tw(y)||dx>hw))continue;
        let l=side;
        if(inArm)l-=1;                                                 /* sleeves sit a shade darker than the chest */
        let c=ramp(SH,y===17?2:l);
        if(inArm&&y>=19&&dx<ai+1)c=M(SH,.62);                          /* armpit seam: arm reads as separate from the body */
        if(inArm&&y===hy-1)c=M(SH,.72);                                /* cuff */
        if(!inArm&&y>=22&&Math.abs(dx-3)<.5)c=M(SH,.86);               /* a single soft fold on each side */
        if(y===26)c=M(SH,.8);                                          /* hem tucked into the belt */
        if(fem&&y>=23&&!inArm){c=ramp(BOD,y===23?2:y===26?-1:side);if(dx<1)c=y%2?M(ROPE,1.15):M(BOD,.6)}   /* laced bodice that cinches the waist */
        P(x,y,c);
      }else if(y===27){                                                /* rope belt */
        if(dx>tw(y)+.2)continue;P(x,y,dx<1?M(ROPE,.6):ROPE);
      }else if(fem&&y<=34){                                            /* skirt: flares out to the hem */
        const k=y-27,w=tw(27)+.2+k*.42;
        if(dx>w)continue;
        let l=side;if((x*3+y)%7===0)l-=1;
        let c=ramp(SKT,l);
        if(dx>1&&Math.abs(((dx*1.3)%2.6)-1.3)<.3)c=M(SKT,.8);          /* fabric folds */
        if(y===34)c=M(SKT,.62);                                        /* hem */
        P(x,y,c);
      }else if(fem&&y===35){                                           /* bare legs under the hem */
        if(dx<1.2||dx>3.2)continue;P(x,y,x<cx?SK:M(SK,.85));
      }else if(y<=35){                                                 /* trousers */
        if(dx>pw(y))continue;
        if(y>=32&&dx<1)continue;                                       /* gap between the legs */
        let l=side;if(y>=32&&dx<2.2)l-=1;
        let c=ramp(PN,l);if(y===35)c=M(PN,.7);                         /* turned-up cuffs */
        P(x,y,c);
      }else{                                                           /* leather shoes */
        if(dx>(fem?3.6:pw(35)+.5)||dx<1)continue;
        P(x,y,y===36?M(SHO,1.5):SHO);
      }
    }
    P(15,28,ROPE);P(16,28,ROPE);P(16,29,M(ROPE,.8));                   /* belt tail */
    if(!fem){P(14,27,'#d9b24a');P(15,27,M('#d9b24a',1.2))}              /* brass buckle */
    R(12,16,1,1,SKD);                                                  /* (keeps the neck seam tidy) */
    P(13,18,M(SK,.9));P(14,18,M(SK,.9));P(15,18,M(SK,.9));P(16,18,M(SK,.9));P(14,19,M(SK,.85));P(15,19,M(SK,.85));   /* open collar */
    P(12,18,M(SH,1.2));P(17,18,M(SH,1.2));P(13,19,M(SH,1.15));P(16,19,M(SH,1.15));
    P(14,20,ROPE);P(15,20,ROPE);P(14,21,M(ROPE,.7));P(15,21,M(ROPE,.7));   /* lacing */
    if(!fem){const x0=Math.floor((Math.ceil(cx-pw(33))+13)/2-.5);                 /* knee patch */
     [[0,33],[1,33],[0,34],[1,34]].forEach(p=>{if((G[p[1]+2]||[])[x0+p[0]])P(x0+p[0],p[1],'#8f7549')});}
  }else BODY[aS]();
  if(fem){   /* bust: two soft mounds (light on top, shadow underneath) with a cleft between them */
    const bsh=(x,y,f)=>{const c=(G[y+2]||[])[x];if(c)P(x,y,M(c,f))};
    [12,13,16,17].forEach(x=>{bsh(x,21,x<15?1.16:1.08);bsh(x,23,.76);bsh(x,24,.92)});
    [13,16].forEach(x=>bsh(x,22,1.12));
    [14,15].forEach(x=>{bsh(x,21,.92);bsh(x,22,.84);bsh(x,23,.8)});
  }
  if(tr>0){const pc=['','#c0733a','#c8d0e0','#e8b93c','#4aa8d8','#d63a47'][tr];P(13,18,'#c2a46a');P(16,18,'#c2a46a');R(14,19,2,2,pc);P(14,19,M(pc,1.5));R(14,21,2,1,M(pc,.65))}   /* trinket: pendant */
  if(full&&(RC==='tiefling'||RC==='catfolk'||RC==='dragonborn')){   /* tail: its root is found from the body's real left edge, so it stays attached whatever the body sliders or clothes are */
    const dr=RC==='dragonborn',cat=RC==='catfolk',tc=dr?M(SK,.85):cat?hair:M(SK,.8),tl=dr?M(SK,1.15):tc,tp=cat?M(hair,1.4):RED;
    const E=(x,y,c)=>{x=Math.max(1,x);if(x<cx&&y>=0&&y<=37&&!(G[y+2]||[])[x])P(x,y,c)};   /* only on empty pixels, so it sits behind the body */
    const lm=y=>{for(let x=0;x<cx;x++)if((G[y+2]||[])[x])return x;return Math.round(cx-hwAt(y))};   /* leftmost body pixel on a row */
    const y0=33,lx=lm(y0);
    [[0,0],[-1,1],[-2,2],[-3,3],[-4,3],[-5,2],[-5,1],[-6,0],[-6,-1],[-6,-2]].forEach((o,i)=>{
      const x=lx+o[0],y=y0+o[1];
      E(x,y,tc);if(dr)E(x,y+1,tl);
      if(i<4)for(let q=x+1;q<lm(y);q++){E(q,y,tc);if(dr)E(q,y+1,tl)}   /* root: fill any gap up to the body edge */
    });
    const tx=lx-6;
    if(dr){E(tx,y0-3,tc);E(tx,y0-4,tl)}
    else if(cat)E(tx,y0-3,tp);
    else[[-1,-3],[0,-3],[1,-3],[0,-4]].forEach(o=>E(tx+o[0],y0+o[1],tp));   /* spade tip */
  }
  s=sH;m=s>>1;setCol(hS,m);   /* from here: helm */
  /* ---- head ---- */
  R(13,16,4,2,SKD);
  const RW=(y0,ws)=>ws.forEach((w,k)=>R(15-w/2,y0+k,w,1,SK));   /* face drawn row by row: one width per row, centred */
  const FACE={
    dragon:()=>{R(11,4,8,1,SK);R(10,5,10,5,SK);R(9,6,1,3,SK);R(20,6,1,3,SK);R(11,10,8,2,SK);R(12,12,6,3,SK);R(13,15,4,2,SK)},   /* skull, then a long snout and chin */
    oval:()=>RW(5,[8,10,10,10,12,12,10,10,10,8,6]),
    round:()=>{R(9,6,12,9,SK);R(10,5,10,1,SK);R(10,15,10,1,SK);R(8,9,1,2,SK);R(21,9,1,2,SK)},
    square:()=>{R(10,5,10,11,SK);R(9,9,1,2,SK);R(20,9,1,2,SK)},
    long:()=>{R(10,6,10,10,SK);R(11,5,8,1,SK);R(11,16,8,1,SK);R(9,9,1,2,SK);R(20,9,1,2,SK)},
    heart:()=>RW(5,[8,10,10,12,12,10,8,8,6,4,2]),
    diamond:()=>RW(5,[4,6,8,10,12,12,10,10,8,6,4])
  };
  /* feminine face shapes: softer jaw, narrower chin that tapers gently, fuller cheeks */
  const FACEF={
    oval:()=>RW(5,[8,10,10,10,12,12,10,10,8,6,4]),
    round:()=>RW(5,[8,10,10,10,12,12,12,12,10,8,6]),
    square:()=>RW(5,[10,10,10,10,12,12,10,10,10,8,6]),
    long:()=>RW(5,[8,10,10,10,12,12,10,10,8,8,6,4]),
    heart:()=>RW(5,[8,10,10,10,10,10,8,8,6,6,4,2]),
    diamond:()=>RW(5,[8,10,10,12,12,12,10,8,8,6,4,4])
  };
  {const fk=RC==='dragonborn'?'dragon':(lk&&lk.face)||'oval';((fem&&RC!=='dragonborn'&&FACEF[fk])?FACEF:FACE)[fk]()}
  for(let y=3;y<=17;y++){let rx=-1;for(let x=0;x<W;x++)if((G[y+2]||[])[x]===SK)rx=x;if(rx>0)P(rx,y,M(SK,.9))}   /* shade right edge */
  for(let x=0;x<W;x++){let by=-1;for(let y=3;y<=18;y++)if((G[y+2]||[])[x]===SK)by=y;if(by>0)P(x,by,M(SK,.88))}   /* shade chin */
  const skin=(x,y)=>(G[y+2]||[])[x]&&SKS.includes(G[y+2][x]);
  const hs=lk.hair;
  const HAIR={
    bald:()=>{P(13,4,M(SK,1.15));P(14,4,M(SK,1.15))},
    crop:()=>{R(10,4,10,2,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,3,1,hair);R(17,6,2,1,hair)},
    bowl:()=>{R(9,4,12,3,hair);R(9,7,1,4,hair);R(20,7,1,4,hair);R(10,4,6,1,M(hair,1.35))},
    messy:()=>{R(10,4,10,2,hair);[10,12,15,17,19].forEach(x=>P(x,3,hair));R(9,5,1,3,hair);R(20,5,1,3,hair);R(11,6,2,1,hair);R(16,6,3,1,hair)},
    short:()=>{R(10,4,10,2,hair);R(9,5,1,3,hair);R(20,5,1,3,hair);R(11,6,2,1,hair);R(17,6,2,1,hair)},
    spiky:()=>{R(10,4,10,2,hair);R(9,5,1,3,hair);R(20,5,1,3,hair);[10,13,16,18].forEach(x=>R(x,2,2,2,hair));[11,17].forEach(x=>P(x,1,hair));P(14,3,hair);R(11,6,2,1,hair)},
    slick:()=>{R(10,4,10,2,hair);R(9,5,1,3,hair);R(20,5,1,3,hair);R(11,4,4,1,M(hair,1.45))},
    long:()=>{R(10,4,10,3,hair);R(8,5,2,12,hair);R(20,5,2,12,hair);R(8,5,1,12,M(hair,1.3));R(21,5,1,12,M(hair,.75));R(11,6,3,1,hair);R(16,6,3,1,hair)},
    bob:()=>{R(10,4,10,3,hair);R(8,5,2,9,hair);R(20,5,2,9,hair);R(8,5,1,9,M(hair,1.3));R(21,5,1,9,M(hair,.75));R(10,6,5,1,hair);R(17,6,2,1,hair);R(9,14,1,1,hair);R(20,14,1,1,hair)},
    ponytail:()=>{R(10,4,10,2,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,3,1,hair);R(17,6,2,1,hair);R(7,6,2,2,RED);R(5,8,3,10,hair);R(7,8,1,10,M(hair,1.3));R(5,9,1,8,M(hair,.75));R(6,18,1,1,hair)},   /* worn on the left: weapons are on the right */
    bun:()=>{R(10,4,10,2,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,2,1,hair);R(17,6,2,1,hair);R(5,9,4,5,hair);R(6,9,2,1,M(hair,1.4));R(7,8,2,1,RED);R(5,11,1,3,M(hair,.75))},   /* side bun (a top bun would hide under the hats) */
    braid:()=>{R(10,4,10,2,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,3,1,hair);R(17,6,2,1,hair);R(7,5,2,3,hair);for(let k=0;k<7;k++)R(7-(k%2),8+k*2,2,2,k%2?M(hair,.8):M(hair,1.15));R(6,22,2,1,RED)},
    pigtails:()=>{R(10,4,10,2,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,3,1,hair);R(17,6,2,1,hair);MR(6,5,3,1,RED);MR(6,6,3,10,hair);MR(6,6,1,10,M(hair,1.3))},
    buzz:()=>{const hc=mix(SK,hair,.72);R(11,4,8,1,hc);R(10,5,10,1,hc);P(10,6,hc);P(19,6,hc)},
    sidepart:()=>{R(10,4,10,2,hair);R(11,3,8,1,hair);R(9,5,1,3,hair);R(20,5,1,3,hair);R(10,6,5,1,hair);R(10,7,2,1,hair);R(11,3,3,1,M(hair,1.35));P(14,4,M(hair,.6));P(14,5,M(hair,.6))},
    mohawk:()=>{const st=mix(SK,hair,.4);R(10,5,3,1,st);R(17,5,3,1,st);R(13,0,4,6,hair);R(14,-2,2,2,hair);R(13,0,1,6,M(hair,1.35));R(16,0,1,6,M(hair,.75))},
    mullet:()=>{R(10,4,10,2,hair);R(11,3,8,1,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,2,1,hair);R(17,6,2,1,hair);MR(8,8,2,8,hair);R(8,8,1,8,M(hair,1.3));R(21,8,1,8,M(hair,.75))},
    curly:()=>{R(10,3,10,3,hair);R(9,4,12,3,hair);R(11,2,8,1,hair);[9,12,15,18].forEach(x=>P(x,2,hair));[10,13,16,19].forEach(x=>P(x,1,hair));R(8,5,1,5,hair);R(21,5,1,5,hair);[[10,3],[14,2],[18,3],[12,5],[16,5],[9,5],[20,5]].forEach(p=>P(p[0],p[1],M(hair,1.4)));[[11,4],[15,4],[13,6],[17,6]].forEach(p=>P(p[0],p[1],M(hair,.7)))},
    afro:()=>{for(let y=-2;y<=10;y++)for(let x=0;x<W;x++){const u=(x-14.5)/8.4,v=(y-4)/6.2;if(u*u+v*v>1)continue;if(x>=10&&x<=19&&y>=6)continue;P(x,y,M(hair,(x*3+y*5)%7===0?1.25:(x+y*2)%5===0?.78:1))}},
    dreads:()=>{R(10,4,10,3,hair);R(11,3,8,1,hair);R(9,5,1,3,hair);R(20,5,1,3,hair);R(11,7,2,1,hair);R(17,7,2,1,hair);[[7,10],[8,13],[9,9]].forEach((q,i)=>{for(let j=0;j<q[1];j++)MP(q[0],6+j,j%3===2?M(hair,.65):i===1?M(hair,1.15):hair)})},
    manbun:()=>{R(10,4,10,2,hair);R(11,3,8,1,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,2,1,hair);R(17,6,2,1,hair);R(13,0,4,3,hair);R(14,-1,2,1,hair);R(13,0,1,3,M(hair,1.35));R(13,3,4,1,RED)},
    wavy:()=>{R(10,4,10,3,hair);R(11,3,8,1,hair);R(11,3,3,1,M(hair,1.35));for(let y=5;y<=18;y++){const o=Math.round(Math.sin(y*.85));MR(6+o,y,4-o,1,y%4<2?hair:M(hair,.86))}},
    bangs:()=>{R(10,4,10,4,hair);R(11,3,8,1,hair);R(10,7,10,1,M(hair,.8));MR(8,5,2,13,hair);R(8,5,1,13,M(hair,1.3));R(21,5,1,13,M(hair,.75))},
    pixie:()=>{R(10,4,10,3,hair);R(11,3,8,1,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(10,7,5,1,hair);P(10,8,hair);P(8,8,hair);P(21,8,hair);R(12,3,4,1,M(hair,1.4))},
    highponytail:()=>{R(10,4,10,2,hair);R(11,3,8,1,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,2,1,hair);R(17,6,2,1,hair);R(12,0,4,3,hair);R(13,-1,3,1,hair);R(16,0,2,2,hair);R(17,2,2,2,hair);R(12,0,1,3,M(hair,1.35));R(12,3,4,1,RED)},
    spacebuns:()=>{R(10,4,10,2,hair);R(11,3,8,1,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,2,1,hair);R(17,6,2,1,hair);MR(9,0,2,1,hair);MR(8,1,4,3,hair);MR(8,1,1,3,M(hair,1.3));MR(8,3,4,1,M(hair,.8))},
    twinbraids:()=>{R(10,4,10,2,hair);R(11,3,8,1,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,3,1,hair);R(17,6,2,1,hair);MR(7,5,2,3,hair);for(let k=0;k<7;k++)MR(7-(k%2),8+k*2,2,2,k%2?M(hair,.8):M(hair,1.15));MR(6,22,2,1,RED)}
  };
  if(RC==='dragonborn')HAIR.bald();else HAIR[hs]();
  /* ---- ears and head accessories (drawn over the hair, under any helm) ---- */
  const EARS={
    round:()=>{},
    elf:()=>{[[8,10,.82],[8,9,1],[7,9,.95],[7,8,1],[6,7,1.08]].forEach(p=>MP(p[0],p[1],M(SK,p[2])))},
    longelf:()=>{[[8,10,.82],[8,9,1],[7,9,.95],[7,8,1],[6,8,.95],[5,8,1],[5,7,.95],[4,7,1],[3,6,1.08]].forEach(p=>MP(p[0],p[1],M(SK,p[2])))},
    cat:()=>{const pk='#e8909e';MP(10,4,hair);MP(11,4,pk);MP(12,4,hair);MP(10,3,hair);MP(11,3,pk);MP(10,2,hair)},
    horns:()=>{[[10,4,'#bfae8a'],[9,4,'#d8c9a4'],[9,3,'#d8c9a4'],[8,3,'#e8dcc0'],[8,2,'#e8dcc0'],[8,1,'#f4ecd6'],[7,0,'#fff8e6']].forEach(p=>MP(p[0],p[1],p[2]))}
  };
  (EARS[LK('ears')]||EARS.round)();
  const acc=LK('accC'),accd=M(acc,.7),accl=M(acc,1.4);
  const ACC={
    none:()=>{},
    bow:()=>{R(7,2,3,3,acc);R(11,2,3,3,acc);R(7,2,3,1,accl);R(11,2,3,1,accl);R(10,3,1,2,accd);P(7,4,accd);P(13,4,accd)},
    band:()=>{R(9,5,12,1,acc);R(10,5,3,1,accl);P(21,4,accl);P(21,5,acc);P(22,6,accd)},
    flower:()=>{P(10,3,acc);P(9,4,acc);P(11,4,acc);P(10,5,acc);P(10,4,'#ffd75a')},
    bandana:()=>{R(9,3,12,3,acc);R(9,5,12,1,accd);P(12,4,accl);P(16,4,accl);P(14,3,accl);R(21,4,2,2,acc);R(22,6,2,2,accd);P(23,8,accd)}
  };
  (ACC[LK('acc')]||ACC.none)();
  /* ---- face ---- */
  const ang=false,mask=hS==='rogue'&&s>=3,bw=M(hair,.8);
  const ec=hS==='rogue'&&s>=10?'#ffd75a':lk.eyes;
  const BROW={
    default:()=>MR(11,8,fem?2:3,1,fem?M(hair,.9):bw),
    thick:()=>{MR(10,7,4,1,bw);MR(11,8,3,1,bw)},
    thin:()=>MR(12,8,2,1,mix(SK,hair,.55)),
    arched:()=>{MP(11,8,bw);MP(12,7,bw);MP(13,8,bw)},
    stern:()=>{MP(11,7,bw);MP(12,7,bw);MP(13,8,bw)},
    none:()=>{}
  };
  (BROW[LK('brow')]||BROW.default)();
  MR(12,9,1,2,ec);
  if(fem)MP(11,9,INK);                                                /* eyelashes */
  R(14,11,2,2,M(SK,.88));R(14,12,2,1,M(SK,.7));
  if(RC==='dragonborn'){   /* draconic head: brow ridges, long snout with nostrils, fanged mouth, head crest, swept-back horns, cheek and shoulder spikes */
    const dk=M(SK,.62),md=M(SK,.8),lt=M(SK,1.15),bn='#e8dcc0',bn2='#fff8e6';
    const E=(x,y,c)=>{if(!(G[y+2]||[])[x])P(x,y,c)},EM=(x,y,c)=>{E(x,y,c);E(W-1-x,y,c)};
    MR(11,8,3,1,dk);MR(10,7,1,1,dk);                              /* heavy brow ridges */
    R(14,10,2,5,lt);P(14,10,md);P(15,10,md);                       /* bridge of the snout */
    P(13,12,dk);P(16,12,dk);                                       /* nostrils */
    R(12,14,6,1,M(SK,.45));P(13,15,'#f7f2de');P(16,15,'#f7f2de'); /* mouth line + fangs */
    R(13,16,4,1,md);
    [[11,6],[13,6],[14,6],[15,6],[16,6],[18,6],[10,8],[19,8],[11,11],[18,11],[12,13],[17,13]].forEach(q=>P(q[0],q[1],md));   /* scale flecks */
    R(13,3,4,1,dk);P(14,2,dk);P(15,2,dk);                          /* head crest */
    [[10,4],[9,3],[9,2],[8,1],[8,0],[7,-1]].forEach((q,i)=>MP(q[0],q[1],i>3?bn2:bn));   /* horns sweep up and back */
    MP(9,7,dk);MP(8,8,dk);MP(9,9,dk);MP(8,10,dk);MP(9,11,dk);MP(8,12,dk);   /* spiked cheek frills */
    const sx=Math.round(cx-hwAt(17));EM(sx,16,dk);EM(sx,15,dk);EM(sx+1,14,dk);   /* shoulder spikes */
  }
  if(RC!=='dragonborn')[10,19].forEach(x=>{if(skin(x,12))P(x,12,mix(SK,'#e86a6a',fem?.5:.3))});
  const scar=lk?lk.scar:'none',sc=mix(SK,'#8a1e2e',.72);
  const SCAR={cheek:[[11,10],[11,11],[12,12],[12,13]],eye:[[16,6],[16,7],[17,8],[17,9],[18,10],[18,11]],brow:[[13,7],[12,7],[11,7],[10,8],[10,9]],mouth:[[17,12],[18,13],[18,14]]};
  (scar==='battle'?['cheek','brow','mouth']:scar==='none'?[]:[scar]).forEach(k=>SCAR[k].forEach(p=>{if(skin(p[0],p[1]))P(p[0],p[1],sc)}));
  
  
  /* beard (drawn before the mouth so the mouth shows on top) */
  const bs=(fem||RC==='dragonborn')?'none':lk.beard,bc=hair,bcd=M(hair,.7);
  const FB=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let k=0;k<w;k++){const yy=y+j,xx=x+k;if(yy>15||skin(xx,yy))P(xx,yy,c)}};
  const BEARD={
    none:()=>{},
    stubble:()=>{for(let x=10;x<20;x++)for(let y=11;y<16;y++)if((x*2+y)%3===0&&skin(x,y))P(x,y,mix(SK,hair,.5))},
    mustache:()=>{R(12,13,6,1,bc);P(11,14,bc);P(18,14,bc)},
    goatee:()=>{R(12,13,6,1,bc);R(13,15,4,2,bc);R(14,17,2,1,bcd)},
    short:()=>{FB(10,13,10,3,bc);FB(10,11,1,2,bc);FB(19,11,1,2,bc);R(12,13,6,1,bcd)},
    full:()=>{FB(10,12,10,4,bc);FB(10,10,1,3,bc);FB(19,10,1,3,bc);FB(11,16,8,2,bc);FB(12,18,6,1,bc);R(12,13,6,1,bcd);R(14,17,2,1,bcd)},
    sage:()=>{                                 /* grows with every gear tier */
      const B=[[9,13,12,3],[10,16,10,2],[11,18,8,2],[12,20,6,2],[13,22,4,2],[14,24,2,2]];
      for(let k=0;k<=m;k++)R(B[k][0],B[k][1],B[k][2],B[k][3],bc);
      R(12,15,1,2,bcd);R(17,15,1,2,bcd);
    },
    sideburns:()=>{FB(10,8,1,5,bc);FB(19,8,1,5,bc);FB(10,13,1,1,bcd);FB(19,13,1,1,bcd)},
    handlebar:()=>{R(12,13,6,1,bc);MP(11,13,bc);MP(10,12,bc);MP(11,14,bcd)},
    soulpatch:()=>{FB(14,15,2,2,bc)},
    chinstrap:()=>{FB(10,11,1,4,bc);FB(19,11,1,4,bc);FB(11,15,8,1,bc);FB(12,16,6,1,bcd)},
    circle:()=>{R(11,13,8,1,bc);FB(11,14,1,2,bc);FB(18,14,1,2,bc);FB(12,15,6,1,bc);FB(13,16,4,1,bcd)},
    muttonchops:()=>{FB(10,8,1,7,bc);FB(19,8,1,7,bc);FB(11,12,1,3,bc);FB(18,12,1,3,bc);R(12,13,6,1,bc)},
    long:()=>{FB(10,12,10,4,bc);FB(10,10,1,3,bc);FB(19,10,1,3,bc);[[11,16,8],[12,17,6],[12,18,6],[13,19,4],[13,20,4],[13,21,4],[14,22,2],[14,23,2]].forEach((q,i)=>FB(q[0],q[1],q[2],1,i%2?bcd:bc));R(12,13,6,1,bcd)},
    viking:()=>{FB(10,12,10,4,bc);FB(10,10,1,3,bc);FB(19,10,1,3,bc);FB(11,16,8,1,bc);FB(12,17,6,1,bc);R(12,13,6,1,bcd);for(let k=0;k<6;k++)FB(14,18+k,2,1,k%2?bcd:bc);FB(14,24,2,1,GOLD)}
  };
  (BEARD[bs]||BEARD.none)();
  if(!mask&&RC!=='dragonborn'){const lp=LK('lips'),lc=lp!=='auto'?lp:fem?mix(SK,'#c2405a',.85):mix(SK,'#8a2a2a',.5);R(13,14,4,1,lc);if(fem){P(14,14,M(lc,1.3));P(15,14,M(lc,.9))}}
  if(mask)R(10,12,10,4,M(base,.55));
  if(RC==='orc'&&!mask){const tk='#f4efd0';MP(12,13,tk);MP(12,14,tk);MP(12,15,M(tk,.8))}   /* orc tusks */
  {   /* extras: skin marks, face paint, eyewear, earrings (skin() keeps marks off the beard and mask) */
    const mk=LK('marks'),pn=LK('paint'),ew=LK('eyewear'),er=LK('earrings');
    const SKM=(x,y,c)=>{if(skin(x,y))P(x,y,c);if(skin(W-1-x,y))P(W-1-x,y,c)};
    if(mk==='freckles'||mk==='heavy'){
      const fc=mix(SK,'#8a4a24',.5);
      (mk==='heavy'?[[11,11],[13,11],[12,12],[10,12],[13,13],[11,13],[10,10]]:[[11,11],[13,12],[12,13]]).forEach(p=>SKM(p[0],p[1],fc));
    }
    if(mk==='mole'&&skin(17,13))P(17,13,mix(SK,'#2a1410',.8));
    if(mk==='blush'){const bl=mix(SK,'#e8607e',.55);[[10,12],[11,12],[12,12],[11,13]].forEach(p=>SKM(p[0],p[1],bl))}
    if(pn!=='none')[[10,11],[11,11],[12,11],[10,13],[11,13],[12,13]].forEach(p=>SKM(p[0],p[1],pn));
    if(ew==='glasses'||ew==='shades'){
      const fc=ew==='glasses'?'#3a3340':'#16141c';
      MR(11,11,3,1,fc);MR(11,9,1,2,fc);MR(13,9,1,2,fc);R(14,10,2,1,fc);MP(10,9,fc);
      if(ew==='shades'){MR(12,9,1,2,'#16141c');MR(11,8,3,1,fc);MP(12,9,'#5a5a78')}
    }
    if(ew==='patch'){
      const pc='#16141c';R(16,9,3,3,pc);P(16,9,'#34303c');
      [[15,8],[14,7],[13,6],[12,5],[11,5],[10,5]].forEach(p=>P(p[0],p[1],pc));P(19,10,pc);
    }
    if(er==='stud')MP(9,10,GOLD);
    if(er==='hoop'){MP(9,11,GOLD);MP(8,12,GOLD);MP(9,13,GOLD)}
    if(er==='drop'){MP(9,11,GOLD);MP(9,12,'#4aa8d8');MP(9,13,'#8fe3f5')}
  }
  /* ---- headgear: changes at every stage ---- */
  const HG={
    warrior:()=>{
      const HC=MATS[m],HD=M(HC,.7),HL=M(HC,1.4);
      if(m===0){if(s>=1){R(9,3,12,3,HC);R(9,5,12,1,HD);R(10,3,10,1,HL);R(8,5,1,4,HC);R(21,5,1,4,HC)}return}
      R(9,2,12,4,HC);R(8,4,2,8,HC);R(20,4,2,8,HC);R(14,5,2,6,HD);R(10,2,10,1,HL);R(9,5,12,1,HD);
      if(s>=3)R(13,1,4,1,HL);                                            /* crest ridge */
      if(s>=4)MR(10,6,3,1,'#1a1620');                                    /* visor slit */
      if(s>=5){const pc=s>=8?WH:RED;R(12,-1,6,3,pc);R(13,-2,4,1,pc)}     /* plume */
      if(s>=7){MR(5,1,4,2,WH);MR(3,-1,3,2,WH);MR(2,-2,2,1,WH)}           /* wings */
      if(s>=8)R(9,5,12,1,GOLD);
      if(s>=9){R(11,-2,8,1,GOLD);R(14,-2,2,2,RED)}
      if(s>=10){P(14,3,RED);P(15,3,RED);P(14,2,'#fff');MR(1,-2,1,3,'#fff')}
    },
    mage:()=>{
      const ch=[3,4,5,5,6,7][m],hc=m>=5?'#f0e6ff':M(tun,1.0);
      R(m===0?7:5,4,m===0?16:20,1,D);                                    /* brim */
      for(let j=0;j<ch;j++){const w=12-j*2;if(w<2)break;R(9+j+(j>=3?1:0),3-j,w,1,j%2?M(hc,1.12):hc)}
      R(9,3,12,1,s>=3?GOLD:M(tun,.6));                                   /* band */
      if(s>=2)P(15,2,'#fff3b0');if(s>=4)R(11,1,1,1,GOLD);
      if(s>=8){P(17,0,GOLD);P(18,1,GOLD)}
      if(s>=9)P(14,-1,'#fff3b0');
      if(s>=10){R(15,-3+2,1,1,'#fff');P(13,-2,GOLD);P(17,-2,'#fff')}
    },
    rogue:()=>{
      R(9,3,12,3,base);R(8,4,2,9,base);R(20,4,2,9,base);R(9,3,12,1,L);R(10,5,10,1,M(base,.5));R(10,12,10,1,M(base,.8));
      if(s>=7){R(14,1,3,2,base);R(15,0,2,1,base)}
      if(s>=4)MR(8,11,2,1,s>=8?GOLD:M(base,1.5));
      if(s>=9)R(10,5,10,1,GOLD);
    },
    cleric:()=>{
      if(s>=2&&s<4)R(10,5,10,1,GOLD);                                    /* circlet */
      if(s>=4&&s<6)halo(10,GOLD);                                        /* halo grows each tier */
      if(s>=6&&s<8)halo(14,GOLD);
      if(s>=8&&s<10){halo(18,GOLD);halo(12,'#fff3b0')}
      if(s>=10){halo(20,'#fff3b0');halo(14,'#fff')}
    }
  };
  if(!noH)HG[hS]();
  /* ---- full body: boots, hands, weapon ---- */
  if(full){
    s=sA;m=s>>1;setCol(aS,m);   /* boots follow the armor */
    const bt=noA?'#4a3320':aS==='warrior'?M(MATS[m],.5):M(base,.35),DG='#dfe6f2',bh=M(bt,1.6);   /* no armor: plain leather shoes */
    const fw=Math.max(3,Math.min(6,Math.round(hwAt(35)*.53)+(RC==='dwarf'||RC==='orc'?1:0))),fx=14-fw;   /* foot width follows the hips (body sliders) and the race; the gap between the feet stays */
    if(!noA){MR(fx,36,fw,2,bt);MR(fx,36,fw,1,bh)}   /* (peasant shoes are drawn with the trousers) */
    if(RC==='dragonborn'){const ft=M(SK,.8),cl='#e8dcc0',dw=Math.min(7,fw+1),dx=14-dw;MR(dx,36,dw,2,ft);for(let k=0;k<dw;k+=2){P(dx+k,37,cl);P(29-dx-k,37,cl)}}   /* bare clawed feet: as wide as the hips, one claw per toe */
    const G0=G;G=Array.from({length:Hh},()=>Array(W).fill(null));   /* layer: hands, shield, weapon */
    if(!(noA&&noW&&noO))R(5,22,2,2,SK);
    const dagger=(x,len,B,gc)=>{                                        /* x = blade column of a right-hand dagger */
      R(x,21-len,1,len,B);P(x,20-len,M(B,1.3));R(x-1,21,3,1,gc);R(x,22,1,3,BR);R(x-1,22,3,2,SK);
    };
    const WP={
      great:()=>{                                  /* two-handed greatsword */
        const B=BLADE[m],BL=M(B,1.25),len=14+m,y0=21-len,gc=m>=4?GOLD:MATS[Math.min(m,3)];
        R(24,y0,3,len,B);R(24,y0,1,len,BL);R(26,y0,1,len,M(B,.72));P(25,y0-1,BL);
        if(m>=2)R(25,y0+2,1,len-5,M(B,.6));
        if(m>=5){R(25,y0+2,1,len-4,'#fff');P(23,y0+4,'rgba(255,240,150,.7)');P(27,y0+8,'rgba(255,240,150,.7)')}
        R(21,21,8,1,gc);if(m>=3)R(22,22,6,1,M(gc,.7));
        R(25,22,1,6,BR);R(24,22,3,2,SK);R(24,25,3,2,SK);R(24,28,3,1,m>=4?GOLD:BR);
      },
      warrior:()=>{
        const B=BLADE[m],BL=M(B,1.25),len=11+m,y0=21-len,gc=m>=4?GOLD:MATS[Math.min(m,3)];
        /* sword */
        R(25,y0,1,len,BL);R(26,y0,1,len,B);P(25,y0-1,BL);
        if(m>=3)R(26,y0+1,1,len-3,M(B,.75));
        if(m>=5){R(25,y0+2,1,len-4,'#fff');P(24,y0+3,'rgba(255,240,150,.7)');P(27,y0+5,'rgba(255,240,150,.7)')}
        R(25,22,2,4,BR);
        if(m===0)R(24,21,4,1,BR);else R(23,21,5,1,gc);
        if(m>=4){R(22,21,7,1,GOLD);P(22,20,GOLD);P(28,20,GOLD)}
        if(m>=5)P(25,21,RED);
        R(24,22,3,2,SK);
        R(25,26,2,1,m>=5?RED:GOLD);
      },
      mage:()=>{
        const oc=['#a08a6a','#8fe0ff','#c08fff','#8fe0ff','#7fe8ff','#e8fbff'][m],WD='#7a5a2a';
        R(26,8,1,27,WD);
        if(m===0){R(25,6,3,2,WD);P(24,5,WD);P(28,5,WD);P(26,4,WD)}
        else if(m===1){R(25,4,3,3,oc);P(25,4,'#fff');R(25,7,3,1,WD)}
        else if(m===2){R(25,3,3,3,oc);P(25,3,'#fff');P(24,5,GOLD);P(28,5,GOLD);R(25,6,3,1,GOLD);R(26,7,1,1,GOLD)}
        else if(m===3){R(24,2,5,4,oc);R(25,2,3,1,'#fff');P(24,5,GOLD);P(28,5,GOLD);R(24,6,5,1,GOLD)}
        else{
          const g=m>=5?'#ffffff':'#bff4ff';
          [[26,-2,1],[25,-1,3],[24,1,5],[24,3,5],[25,5,3],[26,6,1]].forEach(r=>R(r[0],r[1],r[2],r[1]===-2||r[1]===6?1:2,oc));
          R(26,0,1,5,g);P(24,2,GOLD);P(28,2,GOLD);R(25,7,3,1,GOLD);
          if(m>=5){P(22,0,'#fff');P(29,3,'#fff');P(22,6,'#bff4ff');P(29,-1,'#bff4ff')}
        }
        if(s>=9&&m<5){P(21,2,oc);P(22,3,oc)}
        R(25,22,3,2,SK);
      },
      rogue:()=>{
        const B=['#8a7a6a',...BLADE.slice(1)][m],gc=m>=4?GOLD:'#6e5a3a',len=5+m;
        dagger(25,len,B,gc);
        if(m>=5)R(25,21-len+1,1,len-2,'#fff');
      },
      cleric:()=>{
        const hc=['#a8824a',MATS[1],MATS[2],MATS[3],MATS[4],MATS[5]][m],hs2=3+(m>=2?1:0)+(m>=4?1:0);
        R(25,11,1,24,m>=4?GOLD:BR);
        R(25-((hs2-1)>>1),11-hs2,hs2,hs2,hc);R(25-((hs2-1)>>1),11-hs2,hs2,1,M(hc,1.35));
        if(m>=1){P(25-((hs2-1)>>1)-1,11-hs2+1,hc);P(25-((hs2-1)>>1)+hs2,11-hs2+1,hc)}
        if(m>=5){P(25,11-hs2+1,'#fff');P(25,11-hs2+2,'#fff');P(24,11-hs2+2,'#fff');P(26,11-hs2+2,'#fff')}
        R(24,22,3,2,SK);
      }
    };
    const OH={   /* off-hand (left hand): shield / tome / dagger / lantern, tier = rarity look */
      warrior:()=>{
        const sc=MATS[m],sd=M(sc,.6),sl=M(sc,1.35);
        [8,8,8,8,7,6,5,3,1].forEach((w,j)=>{const x0=1+((8-w)>>1);R(x0,21+j,w,1,sc);P(x0,21+j,sd);P(x0+w-1,21+j,sd)});
        R(1,21,8,1,m>=4?GOLD:sd);
        R(4,23,2,2,m===0?'#aab3c2':sl);
        if(m>=2){R(4,22,2,7,sl);R(2,25,6,1,sl)}
        if(m>=4){R(1,21,1,5,GOLD);R(8,21,1,5,GOLD)}
        if(m>=5){R(4,24,2,2,RED)}
      },
      mage:()=>{
        const cv=['#7a4a2a','#3a6ac0','#6a3ab0','#2a4a9a','#4a2a8a','#e8e0ff'][m],cd=M(cv,.6),cl=M(cv,1.3);
        R(2,20,7,10,cv);R(2,20,7,1,cl);R(2,29,7,1,cd);R(2,20,1,10,cd);R(9,21,1,8,'#f4ecd6');
        if(m>=1)R(4,22,3,3,m>=4?GOLD:'#c2a46a');
        if(m>=3){P(3,21,GOLD);P(8,21,GOLD);P(3,28,GOLD);P(8,28,GOLD)}
        if(m>=5){P(5,22,'#ffffff');P(4,23,'#ffffff');P(5,23,'#ffffff');P(6,23,'#ffffff');P(5,24,'#ffffff')}
        R(4,27,2,2,SK);
      },
      rogue:()=>{
        const B=['#8a7a6a',...BLADE.slice(1)][m],gc=m>=4?GOLD:'#6e5a3a',len=5+m,x=4;
        R(x,21-len,1,len,B);P(x,20-len,M(B,1.3));R(x-1,21,3,1,gc);R(x,22,1,3,BR);R(x-1,22,3,2,SK);
        if(m>=5)R(x,21-len+1,1,len-2,'#ffffff');
      },
      cleric:()=>{
        const fr=MATS[m],gl=['#ffcf7a','#ffe08a','#ffd75a','#9fe8f8','#fff1a8','#ffffff'][m];
        P(5,18,fr);P(4,19,fr);P(6,19,fr);R(4,20,3,1,SK);R(3,21,5,1,m>=3?GOLD:fr);
        R(3,22,5,5,gl);R(3,22,1,5,fr);R(7,22,1,5,fr);R(5,23,1,3,m>=4?'#ff9a2a':'#ff7a1a');R(3,27,5,1,fr);
      }
    };
    s=sW;m=s>>1;   /* weapon */
    const wp=wS;
    if(wp&&!noW)WP[wp]();else if(!noA)R(23,22,2,2,SK);
    if(!noO){s=(E.offhand||0)*2;m=s>>1;OH[oS]()}   /* off-hand, independent of the weapon */
    const dxh=Math.round(hwAt(22)-10.75);
    for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const v=G[y][x];if(!v)continue;const nx=x<15?x-dxh:x+dxh;if(nx>=0&&nx<W)G0[y][nx]=v}
    G=G0;
  }
  const Q=G.map(r=>r.slice());
  for(let y=0;y<Hh;y++)for(let x=0;x<W;x++)if(!G[y][x]&&((G[y-1]||[])[x]||G[y][x-1]||G[y][x+1]||(G[y+1]||[])[x]))Q[y][x]='#0a0812';
  if(sA>=10&&sH>=10&&sW>=10){                                                         /* legendary sparkles (drawn outside the outline) */
    const sp=(x,y,c)=>{y+=2;if(y>=0&&y<Hh&&x>=0&&x<W&&!Q[y][x])Q[y][x]=c};
    const pts=[[2,6],[27,4],[3,16],[27,14],[1,26],[28,24],[6,1]];
    pts.forEach(p=>{sp(p[0],p[1],'#fff3b0');sp(p[0]-1,p[1],'rgba(255,240,170,.55)');sp(p[0]+1,p[1],'rgba(255,240,170,.55)');sp(p[0],p[1]-1,'rgba(255,240,170,.55)');sp(p[0],p[1]+1,'rgba(255,240,170,.55)')});
  }
  if(full&&RC==='dwarf'){Q.splice(31,DWARF_CUT);for(let i=0;i<DWARF_CUT;i++)Q.unshift(Array(W).fill(null))}   /* dwarf: shorter legs and torso */
  return Q;
}
let PV=null; /* dev preview override: {lv,cls,n} or null */
let PVL=10;   /* dev: companion level shown in the previewer (tap the face, or Up/Down) */
let PVP=null; /* dev preview companion (pet key) or null */
function gridCanvas(O,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;c.className='px';
  const x=c.getContext('2d');
  for(let y=0;y<h;y++)for(let k=0;k<w;k++){const f=O[y][k];if(f){x.fillStyle=f;x.fillRect(k,y,1,1)}}
  return c;
}
function heroPx(lv,head,look,eq){
  const lk=look||S.look||null,E=PV?PV.eq:(eq||eqLook());
  const cv=gridCanvas(bustGrid(lk,!head,E),30,head?30:40);
  if(lk&&(lk.eyewear==='shades'||lk.eyewear==='patch'))cv.dataset.noeye='1';   /* idle blink / glance would draw over the lenses */
  if(!head&&lk&&lk.race==='dwarf')cv.dataset.dy=String(DWARF_CUT);   /* idle effects need to know the figure sits lower on the canvas */
  return cv;
}

/* ---------- character creator ---------- */
const DEF_LOOK={sex:'m',race:'human',skin:'#f0c49a',face:'oval',ears:'round',hair:'crop',hairC:'#6b4a2b',brow:'default',eyes:'#2a1c14',eyewear:'none',beard:'none',marks:'none',lips:'auto',paint:'none',scar:'none',earrings:'none',acc:'none',accC:'#d63a47'};
const HAIR_BY_SEX={
  m:['bald','buzz','short','crop','sidepart','messy','bowl','spiky','slick','mohawk','mullet','curly','afro','dreads','long','ponytail','manbun','braid'],
  f:['bob','long','wavy','bangs','pixie','ponytail','highponytail','bun','spacebuns','braid','twinbraids','pigtails','curly','afro','dreads','short','messy','bowl','buzz','mohawk','bald']
};
/* keep a look valid for its gender: women have no beard list, and hair styles differ */
function fixLook(k){k.sex=k.sex==='f'?'f':'m';if(!RACES[k.race])k.race='human';if(!HAIR_BY_SEX[k.sex].includes(k.hair))k.hair=k.sex==='f'?'long':'crop';if(k.sex==='f')k.beard='none'}
/* ---------- races: picking one sets a starting look (ears, brows, build, skin) you can still tweak; some also add a feature to the hero (orc tusks, tiefling and catfolk tails) ---------- */
const RACES={
  human:{n:'Human',d:'Balanced and adaptable. Any skin tone, any look.',set:{ears:'round',brow:'default'},build:{bSh:50,bWa:50,bHi:50,bAr:50}},
  elf:{n:'Elf',d:'Slender and graceful, with long pointed ears.',set:{ears:'longelf',brow:'arched'},build:{bSh:30,bWa:30,bHi:32,bAr:28}},
  dwarf:{n:'Dwarf',d:'Short, broad and stubborn, with a heavy brow and a proud beard.',set:{ears:'round',brow:'thick'},build:{bSh:85,bWa:80,bHi:70,bAr:85},beard:'full'},
  orc:{n:'Orc',d:'Towering shoulders, green skin and a pair of tusks.',set:{ears:'elf',brow:'stern',skin:'#7ba85a',eyes:'#c2822a'},build:{bSh:95,bWa:70,bHi:58,bAr:95}},
  tiefling:{n:'Tiefling',d:'Crimson skin, curved horns and a tail.',set:{ears:'horns',brow:'arched',skin:'#c2504a',eyes:'#e8b93c'},build:{bSh:50,bWa:42,bHi:50,bAr:45}},
  catfolk:{n:'Catfolk',d:'Quick and lithe, with cat ears and a tail that matches the hair.',set:{ears:'cat',brow:'default'},build:{bSh:38,bWa:36,bHi:40,bAr:38}},
  dragonborn:{n:'Dragonborn',d:'A true dragon head: long snout, fangs, swept-back horns, cheek and shoulder spikes, clawed feet and a thick tail. No hair or beard.',set:{ears:'round',brow:'none',skin:'#d9a63a',eyes:'#c2282e'},build:{bSh:80,bWa:60,bHi:55,bAr:75}}
};
const DWARF_CUT=5;   /* dwarves are this many pixel rows shorter than everyone else (rows are cut from the legs, the head stays full size) */
function applyRace(k,id){
  const R=RACES[id]||RACES.human;k.race=RACES[id]?id:'human';
  Object.assign(k,R.set,R.build);
  if(!R.set.skin&&Object.values(RACES).some(r=>r.set.skin===k.skin))k.skin=DEF_LOOK.skin;   /* leaving a race with its own skin colour: back to a natural skin tone */
  if(R.beard&&k.sex==='m'&&(!k.beard||k.beard==='none'))k.beard=R.beard;
}
const OPT={
  sex:['Gender',[['m','Male'],['f','Female']]],
  race:['Race',Object.keys(RACES).map(k=>[k,RACES[k].n])],
  skin:['Skin',[['#fde4d0','Pale'],['#f6d3b0','Fair'],['#f0c49a','Light'],['#d9a577','Tan'],['#c58f5e','Olive'],['#b87f55','Brown'],['#8a5a3a','Deep'],['#5e3b26','Dark'],['#7ba85a','Orc green'],['#6f93d1','Frost blue'],['#a58bd0','Violet'],['#c2504a','Crimson'],['#a8321e','Scarlet scales'],['#d9a63a','Brass scales'],['#3f9a5a','Emerald scales'],['#3a6ab0','Sapphire scales'],['#9aa1ab','Ash']]],
  face:['Face shape',[['oval','Oval'],['round','Round'],['square','Square'],['long','Long'],['heart','Pointed'],['diamond','Diamond']]],
  ears:['Ears',[['round','Round'],['elf','Elf'],['longelf','Long elf'],['cat','Cat'],['horns','Horns']]],
  hair:['Hair style',[['bald','Bald'],['buzz','Buzz cut'],['short','Short'],['crop','Crop'],['sidepart','Side part'],['messy','Messy'],['bowl','Bowl'],['spiky','Spiky'],['slick','Slick'],['mohawk','Mohawk'],['mullet','Mullet'],['curly','Curly'],['afro','Afro'],['dreads','Dreadlocks'],['long','Long'],['wavy','Wavy'],['bangs','Long fringe'],['pixie','Pixie'],['bob','Bob'],['ponytail','Ponytail'],['highponytail','High ponytail'],['manbun','Top knot'],['bun','Side bun'],['spacebuns','Space buns'],['braid','Braid'],['twinbraids','Twin braids'],['pigtails','Pigtails']]],
  hairC:['Hair colour',[['#1e1e24','Black'],['#3a2a1c','Dark brown'],['#6b4a2b','Brown'],['#7a3f22','Chestnut'],['#8a3a2a','Auburn'],['#c2682f','Ginger'],['#b02a2a','Red'],['#d9b968','Blonde'],['#efe6c4','Platinum'],['#c8ccd8','Silver'],['#f2f2f2','White'],['#3a6ad0','Blue'],['#2fb3a8','Teal'],['#3a9a4a','Green'],['#e87aa8','Pink'],['#8a4ad0','Purple']]],
  brow:['Eyebrows',[['default','Natural'],['thick','Thick'],['thin','Thin'],['arched','Arched'],['stern','Stern'],['none','None']]],
  eyes:['Eyes',[['#2a1c14','Brown'],['#4a78c2','Blue'],['#3a8a5a','Green'],['#8a6a2a','Hazel'],['#8a93a6','Grey'],['#8a4ad0','Violet'],['#c2822a','Amber'],['#c2282e','Red'],['#e8b93c','Gold'],['#2fb3a8','Teal'],['#d96fa0','Pink'],['#f2f2f2','White']]],
  eyewear:['Eyewear',[['none','None'],['glasses','Glasses'],['shades','Shades'],['patch','Eyepatch']]],
  beard:['Beard',[['none','None'],['stubble','Stubble'],['sideburns','Sideburns'],['mustache','Moustache'],['handlebar','Handlebar'],['soulpatch','Soul patch'],['chinstrap','Chinstrap'],['goatee','Goatee'],['circle','Circle'],['short','Short'],['muttonchops','Mutton chops'],['full','Full'],['long','Long'],['viking','Braided'],['sage','Sage (grows)']]],
  marks:['Skin marks',[['none','None'],['freckles','Freckles'],['heavy','Heavy freckles'],['mole','Beauty mark'],['blush','Rosy cheeks']]],
  lips:['Lips',[['auto','Natural'],['#c2284a','Red'],['#e0708a','Pink'],['#e8765a','Coral'],['#7a2a5a','Plum'],['#2a1a2a','Dark']]],
  paint:['Face paint',[['none','None'],['#c23a3a','Red stripes'],['#3a6ad0','Blue stripes'],['#f2f2f2','White stripes'],['#3a8a5a','Green stripes']]],
  scar:['Scars',[['none','None'],['cheek','Cheek'],['eye','Eye'],['brow','Brow'],['mouth','Mouth'],['battle','Battle-worn']]],
  earrings:['Earrings',[['none','None'],['stud','Studs'],['hoop','Hoops'],['drop','Gem drops']]],
  acc:['Head accessory',[['none','None'],['bow','Bow'],['band','Headband'],['flower','Flower'],['bandana','Bandana']]],
  accC:['Accessory colour',[['#d63a47','Red'],['#e87aa8','Pink'],['#ff8a2a','Orange'],['#e8b93c','Gold'],['#58b368','Green'],['#3a8fe0','Blue'],['#8a4ad0','Purple'],['#f2f2f2','White'],['#2a2a32','Black']]]
};
const SWATCH=['skin','hairC','eyes','accC'];
const RARE=['beard','scar','marks','lips','paint','ears','eyewear','earrings','acc'];   /* Random mostly leaves these off */
let CK=null,CG='mine',creatorOpen=false,creatorFirst=false,CN='';   /* CN = hero name being typed in the creator */
/* creator layout: icon tabs on top, big preview, category list on the left, options for the picked category on the right */
const CTABS=[
  ['body','Body','🧑',['name','sex','race','shape','skin']],
  ['face','Face','🙂',['face','ears','eyes','brow','eyewear','lips','marks','paint','scar']],
  ['hair','Hair','💇',['hair','hairC','beard']],
  ['extra','Extras','✨',['earrings','acc','accC']]
];
let CTAB='body',CCAT='name';
const catLab=k=>k==='name'?'Hero name':k==='shape'?'Body shape':OPT[k][0];
const catsOf=id=>CTABS.find(t=>t[0]===id)[3].filter(k=>!(k==='beard'&&CK.sex==='f'));   /* no beard options for women */
const curVal=k=>{const it=OPT[k][1].find(i=>i[0]===CK[k]);return it?it[1]:''};
function fillCat(b,k){
  const tx=el('span','ctx'),v=k==='name'?(CN.trim()||'Not set'):k==='shape'?'Sliders':curVal(k);
  tx.append(el('b','',catLab(k)),el('small','',v));b.replaceChildren(tx);
  if(SWATCH.includes(k)){const d=el('i','cdot');d.style.background=CK[k];b.appendChild(d)}
}
function drawCreator(){
  $('cprev').replaceChildren(gridCanvas(bustGrid(CK,true,eqLook()),30,40));
  document.querySelectorAll('#copts [data-k]').forEach(b=>b.classList.toggle('on',CK[b.dataset.k]===b.dataset.v));
  document.querySelectorAll('#copts .ccat').forEach(b=>fillCat(b,b.dataset.cat));
}
function buildPanel(box){
  box.replaceChildren(el('h4','',catLab(CCAT)));
  if(CCAT==='name'){   /* custom hero name (shown under the hero; left empty it falls back to your sign-in name) */
    const nr=el('div','copt'),ni=document.createElement('input');
    ni.id='cname';ni.type='text';ni.maxLength=16;ni.placeholder="Your hero's name";ni.value=CN;ni.autocomplete='off';ni.spellcheck=false;ni.setAttribute('aria-label','Hero name');
    ni.oninput=()=>{CN=ni.value;drawCreator()};
    nr.appendChild(ni);box.append(nr,el('div','sub','Shown under your hero. Leave it empty to use your sign-in name.'));
    return;
  }
  if(CCAT==='shape'){   /* body sliders: drag to shape the body, no preset to pick */
    box.firstChild.textContent='Body sliders';
    BSL.forEach(([k,lab])=>{
      const w=el('div','sl'),rw=el('div','slrow'),rs=el('button','ghost rs','\u21ba'),rg=document.createElement('input'),ou=el('output','','');
      const show=()=>{ou.textContent=(CK[k]/100).toFixed(2);rg.value=CK[k]};
      rs.type='button';rs.title='Reset '+lab;rs.setAttribute('aria-label','Reset '+lab);
      rg.type='range';rg.min=0;rg.max=100;rg.step=1;rg.className='rng';rg.setAttribute('aria-label',lab);
      rg.oninput=()=>{CK[k]=+rg.value;show();drawCreator()};
      rs.onclick=()=>{CK[k]=50;show();drawCreator()};
      show();rw.append(rs,rg,ou);w.append(el('label','',lab),rw);box.appendChild(w);
    });
    const ra=el('button','ghost wide','Reset all');ra.type='button';
    ra.onclick=()=>{BSL.forEach(([k])=>{CK[k]=50});buildPanel(box);drawCreator()};
    box.appendChild(ra);
    return;
  }
  const sw=SWATCH.includes(CCAT),w=el('div','copts'+(sw?' swatches':''));
  const items=CCAT==='hair'?OPT.hair[1].filter(i=>HAIR_BY_SEX[CK.sex||'m'].includes(i[0])):OPT[CCAT][1];
  items.forEach(([v,n])=>{
    const b=el('button',sw?'o sw':'o',sw?'':n);b.type='button';b.dataset.k=CCAT;b.dataset.v=v;b.title=n;b.setAttribute('aria-label',OPT[CCAT][0]+': '+n);
    if(sw)b.style.background=v;
    b.onclick=()=>{CK[CCAT]=v;if(CCAT==='race'){applyRace(CK,v);buildCreator()}if(CCAT==='sex'){fixLook(CK);buildCreator()}drawCreator()};
    w.appendChild(b);
  });
  box.appendChild(w);
  if(CCAT==='race')box.appendChild(el('div','sub',(RACES[CK.race]||RACES.human).d));
  if(CK.race==='dragonborn'&&(CCAT==='hair'||CCAT==='hairC'||CCAT==='beard'))box.appendChild(el('div','sub','Dragonborn are scaled, so hair and beards do not show.'));
}
function buildCreator(){
  const tb=$('ctabs');tb.replaceChildren();
  CTABS.forEach(([id,lab,ic])=>{
    const b=el('button','ctab'+(CTAB===id?' on':''));b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',CTAB===id);
    b.append(px(ic,16),el('small','',lab));
    b.onclick=()=>{CTAB=id;CCAT=catsOf(id)[0];buildCreator();drawCreator()};
    tb.appendChild(b);
  });
  const cats=catsOf(CTAB);if(!cats.includes(CCAT))CCAT=cats[0];
  const box=$('copts'),left=el('div','ccats'),right=el('div','cpanel');
  cats.forEach(k=>{
    const b=el('button','ccat'+(k===CCAT?' on':''));b.type='button';b.dataset.cat=k;b.setAttribute('aria-pressed',k===CCAT);
    b.onclick=()=>{CCAT=k;buildCreator();drawCreator()};
    left.appendChild(b);
  });
  box.replaceChildren(left,right);buildPanel(right);
}
function openCreator(first){
  creatorOpen=true;creatorFirst=!!first;CG='mine';CTAB='body';CCAT='name';
  CK=Object.assign({},DEF_LOOK,S.look||{});fixLook(CK);fillBuild(CK);CN=S.name||'';
  $('ctitle').textContent=first?'Create your hero':'Edit your hero';
  $('ccancel').hidden=!!first;
  buildCreator();drawCreator();
  $('creator').hidden=false;document.body.classList.add('creating');$('creator').scrollTop=0;
}
function closeCreator(){creatorOpen=false;$('creator').hidden=true;document.body.classList.remove('creating')}
function maybeCreator(){
  const b=document.body.classList;
  if(S.look){if(creatorOpen&&creatorFirst)closeCreator();return}
  if(!canRun())return;   /* don't treat this as a new hero until we know what the cloud has */
  if(!creatorOpen&&!b.contains('out')&&!b.contains('wait'))openCreator(true);
}
/* tap the profile avatar at the top to edit your hero's look and name (always on, not a dev tool) */
let DEVON=true;try{DEVON=localStorage.getItem('dq.dev')!=='0'}catch(e){}   /* the Dev tools button on the Realm tab turns every dev tool on or off (remembered) */
function initDevAvatar(){
  const av=document.querySelector('.hud .av');
  if(!av)return;
  av.classList.add('devclick');av.setAttribute('role','button');av.tabIndex=0;av.title='Tap to edit your hero';
  const go=()=>openCreator(false);
  av.addEventListener('click',go);
  av.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
}
function initCreator(){
  initDevAvatar();
  $('editchar').onclick=()=>openCreator(false);
  $('ccancel').onclick=closeCreator;
  $('crand').onclick=()=>{const rids=Object.keys(RACES),rc=rids[Math.floor(Math.random()*rids.length)],R0=RACES[rc];applyRace(CK,rc);Object.keys(OPT).forEach(k=>{
    if(k==='sex'||k==='race')return;
    if(rc!=='human'&&(k==='ears'||(k==='skin'&&R0.set.skin)))return;
    if(k==='beard'&&rc==='dwarf'&&CK.sex==='m')return;
    const a=k==='hair'?OPT[k][1].filter(i=>HAIR_BY_SEX[CK.sex].includes(i[0])):OPT[k][1];
    CK[k]=(RARE.includes(k)&&Math.random()<.6)?a[0][0]:a[Math.floor(Math.random()*a.length)][0]});BSL.forEach(([key])=>{const sp=rc==='human'?30:14;CK[key]=Math.max(0,Math.min(100,Math.round(R0.build[key]+(Math.random()*2-1)*sp)))});fixLook(CK);buildCreator();drawCreator()};
  $('cdone').onclick=()=>{fixLook(CK);S.look=Object.assign({},CK);{const nm=CN.trim().replace(/\s+/g,' ').slice(0,16);if(nm)S.name=nm;else delete S.name}save();closeCreator();render();toast('Your hero is ready')};
}

/* ---------- loot: random drops, you decide what to wear ---------- */
const SLOTS=['helm','armor','weapon','trinket','offhand','companion'];
const SLOTN={helm:'Helm',armor:'Armor',weapon:'Weapon',trinket:'Trinket',offhand:'Off-hand',companion:'Companion'};
const NOUN={helm:{warrior:'Helm',mage:'Hat',rogue:'Hood',cleric:'Circlet'},armor:{warrior:'Plate',mage:'Robes',rogue:'Leathers',cleric:'Vestments'},weapon:{warrior:'Sword',great:'Greatsword',mage:'Staff',rogue:'Daggers',cleric:'Mace'},offhand:{warrior:'Shield',mage:'Tome',rogue:'Dagger',cleric:'Lantern'}};
const MATN=['Plain','Iron','Steel','Tempered','Mythril','Golden','Dragon','Godforged'];
const RNAME=['Common','Uncommon','Rare','Very rare','Epic','Legendary','Mythical','Unique'];
const VIS=[0,1,2,2,3,4,5,5];                 /* rarity -> how the gear looks on the hero (6 looks) */
const OLD2NEW=[0,1,2,4,5,6];                 /* old 6-tier saves -> new rarity index */
const PETS={wolfpup:{e:'pet:wolfpup',n:'Fire Wolf Cub',sm:1,px:49,fire:1},sprite:{e:'🧚',n:'Sprite'},imp:{e:'😈',n:'Imp'},goblin:{e:'👺',n:'Goblin'},unicorn:{e:'🦄',n:'Unicorn'},golem:{e:'🗿',n:'Golem'},genie:{e:'🧞',n:'Genie'},troll:{e:'🧌',n:'Troll'},drake:{e:'🐲',n:'Drake'},dragon:{e:'🐉',n:'Dragon'},wendigo:{e:'pet:wendigo',n:'Wendigo',still:1}};
const PETMAP={cat:'imp',frog:'goblin',bunny:'sprite',turtle:'golem',bat:'wolfpup',wisp:'wolfpup',cinderpup:'wolfpup',owl:'genie',fox:'drake',wolf:'troll',duck:'sprite'};   /* old real-animal companions in saves become fantasy ones */
/* companion levels: a worn companion earns XP from every quest you finish (and loses it if you undo the quest); stronger and bigger each level */
const PMAX=20,BIG_LV=8;                                   /* from BIG_LV on it is big enough to stand behind the hero instead of beside it */
const pneed=l=>40*(l-1)*l;                                /* total companion XP for level l */
const plv=it=>{const x=it&&it.ce||0;let l=1;while(l<PMAX&&x>=pneed(l+1))l++;return l};
const psize=l=>l<BIG_LV?34+7.5*(l-1):130+10*(l-BIG_LV);   /* sprite size in px: Lv 1 = 34, Lv 7 = 79, Lv 8 = 130, Lv 20 = 250 (taller than the hero) */
const vlv=(k,l)=>PETS[k]&&PETS[k].sm?Math.min(l,BIG_LV-1):l;   /* look level: small companions (sm) stay in their small form forever; their bonuses still grow */
const psz=(k,l)=>{const p=PETS[k]&&PETS[k].px;return p?Math.max(1,Math.round(psize(l)/p))*p:psize(l)};   /* pixel-art companions (px = native size) only grow in whole-number zooms so their pixels stay sharp */
const pres=l=>l>=14?64:l>=BIG_LV?48:32;                   /* sprite resolution: bigger companions get more detail */
function eff(it,k){const v=it.b[k]||0;return it.slot==='companion'?Math.round(v*(1+.08*(plv(it)-1))):v}   /* companion bonuses grow +8% per level */
const PETQ=['Stray','Tame','Loyal','Clever','Noble','Fabled','Mythic','Spirit'];
const TNAME=['Bone Charm','Copper Ring','Silver Ring','Jade Ring','Gold Ring','Mythril Ring','Dragon Eye','Eye of the Void'];
const SUF={xp:'of Insight',gold:'of Fortune',dmg:'of Warding',hp:'of Vitality',bd:'of Slaying'};
const ICON={helm:{warrior:'\u26d1\ufe0f',mage:'\ud83c\udfa9',rogue:'\ud83e\udd77',cleric:'\ud83d\udc51'},armor:{warrior:'\ud83d\udee1\ufe0f',mage:'\ud83e\udde5',rogue:'\ud83e\udd4b',cleric:'\ud83d\udc58'},weapon:{warrior:'\u2694\ufe0f',great:'\ud83d\udde1\ufe0f',mage:'\ud83e\ude84',rogue:'\ud83d\udd2a',cleric:'\ud83d\udd28'},offhand:{warrior:'🛡️',mage:'📖',rogue:'🗡️',cleric:'🏮'}};
const RAR=['#6b6478','#58b368','#4a9ae0','#2fc7c0','#a56be0','#e8b93c','#ff7a4a','#ff4fd8'];   /* frame colour per rarity */
const STAT_TXT={xp:v=>(v<0?'':'+')+v+'% XP',gold:v=>(v<0?'':'+')+v+'% gold',dmg:v=>v<0?'+'+(-v)+'% damage taken':'-'+v+'% damage taken',hp:v=>(v<0?'':'+')+v+' max HP',bd:v=>(v<0?'':'+')+v+'% boss damage'};
/* Unique gear: hand-made named items, mostly weapons. Quirky rather than strong, some have trade-offs.
   v = which of the 6 hero looks it uses (0 plain .. 5 dragon). */
const UNIQ={
  pin:{n:"Grandma's Rolling Pin",slot:'weapon',st:'cleric',v:0,b:{hp:6,gold:6},d:'Smells faintly of cookies.'},
  knife:{n:'The Butter Knife',slot:'weapon',st:'rogue',v:0,b:{xp:6,gold:6,hp:2,dmg:4},d:'Not sharp, but oddly well rounded.'},
  clock:{n:'Alarm Clock Mace',slot:'weapon',st:'cleric',v:1,b:{xp:15,hp:2},d:'Rings at the worst possible moment.'},
  quill:{n:'Quill of the Scribe',slot:'weapon',st:'mage',v:2,b:{xp:18,gold:10},d:'Every quest it signs feels official.'},
  lucky:{n:"Thief's Lucky Dagger",slot:'weapon',st:'rogue',v:2,b:{gold:30,xp:-5},d:'Pockets coins, forgets lessons.'},
  regret:{n:'Greatsword "Regret"',slot:'weapon',st:'great',v:3,b:{xp:25,dmg:-10},d:'Hits hard. You will feel it later.'},
  later:{n:'Staff of Procrastination',slot:'weapon',st:'mage',v:4,b:{dmg:20,xp:-10},d:'Shields you from consequences, and progress.'},
  hood:{n:"Jester's Hood",slot:'helm',st:'rogue',v:2,b:{gold:20,dmg:-5},d:'Fortune favours the fool, mostly.'},
  owl:{n:'Crown of the Night Owl',slot:'helm',st:'cleric',v:3,b:{xp:20,dmg:-8},d:'Wisdom by moonlight, bruises by morning.'},
  robe:{n:'Coffee-Stained Robes',slot:'armor',st:'mage',v:1,b:{xp:14,hp:4},d:'Powered by one more cup.'},
  coin:{n:'Lucky Copper Coin',slot:'trinket',st:null,v:1,b:{gold:25,hp:-2},d:'Heads you win, tails you lose a little HP.'},
  lid:{n:'Pot Lid Shield',slot:'offhand',st:'warrior',v:0,b:{dmg:6,hp:3},d:'Dinner is served. So is justice.'},
  planner:{n:'The Overdue Planner',slot:'offhand',st:'mage',v:1,b:{xp:16,dmg:-4},d:'Every page says tomorrow.'},
  phone:{n:'Phone Flashlight',slot:'offhand',st:'cleric',v:1,b:{gold:10,hp:4},d:'Seven percent battery. Still holy.'},
  duck:{n:'Pocket Sprite Familiar',slot:'companion',st:null,pet:'sprite',v:0,b:{xp:12,gold:6},d:'Listens to all your problems.'},
  knock:{n:'Imp Who Knocks Things Over',slot:'companion',st:null,pet:'imp',v:0,b:{gold:14,dmg:-6},d:'Chaos, but profitable chaos.'}
};
const visOf=it=>it.v!=null?it.v:VIS[it.r];
const bonusTxt=it=>Object.keys(it.b).map(k=>STAT_TXT[k](eff(it,k))).join(', ');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function itemName(it){
  const main=Object.keys(it.b)[0];
  const base=it.slot==='trinket'?TNAME[it.r]:it.slot==='companion'?PETQ[it.r]+' '+(PETS[it.pet]||PETS.wolfpup).n:MATN[it.r]+' '+NOUN[it.slot][it.st];
  return base+(main?' '+SUF[main]:'');
}
/* old saves had gear tiers per slot: turn them into loot items so nothing is lost */
const OLDCLS={cleric:'druid',monk:'bard'};   /* classes that were renamed: old saves keep their slot */
function migrate(s){
  if(OLDCLS[s.cls])s.cls=OLDCLS[s.cls];
  (s.inv||[]).forEach(i=>{if(i.slot==='companion'&&PETMAP[i.pet]){i.pet=PETMAP[i.pet];i.n=i.u&&UNIQ[i.u]?UNIQ[i.u].n:itemName(i)}});
  (s.inv||[]).forEach(i=>{if(i.n&&i.n.indexOf('Sword & Shield')>-1)i.n=i.n.replace('Sword & Shield','Sword')});
  (s.inv||[]).forEach(i=>{if(i.slot==='companion'&&i.n&&i.n.indexOf('Wolf Pup')>-1)i.n=i.n.replace('Wolf Pup','Fire Wolf Cub')});
  if(s.inv){
    if(!s.rv){s.inv.forEach(i=>{i.r=OLD2NEW[i.r]!=null?OLD2NEW[i.r]:i.r});s.rv=2}   /* items from the 6-rarity version */
    return s;
  }
  s.inv=[];s.worn={};s.rv=2;
  const g=s.gear||{},eq=s.equip||{},st=s.style||{};
  const mk=(k,t)=>{
    const b={};if(k==='weapon')b.xp=5*t;if(k==='armor')b.dmg=8*t;if(k==='helm')b.gold=8*t;if(k==='trinket')b.hp=2*t;
    const it={id:uid(),slot:k,r:OLD2NEW[Math.min(5,t)],b,st:k==='trinket'?null:(st[k]||(s.cls&&NOUN[k][s.cls]?s.cls:'warrior'))};
    it.n=itemName(it);s.inv.push(it);return it;
  };
  SLOTS.forEach(k=>{
    const own=g[k]||0;if(!own)return;
    const t=eq[k]!=null?Math.min(eq[k],own):own;
    const hi=mk(k,own);
    if(t===own)s.worn[k]=hi.id;else if(t>0)s.worn[k]=mk(k,t).id;
  });
  return s;
}
const wornOf=(s,k)=>{const id=(s.worn||{})[k];return id?((s.inv||[]).find(i=>i.id===id)||null):null};
const worn=k=>wornOf(S,k);
const hpOf=s=>SLOTS.reduce((a,k)=>{const i=wornOf(s,k);return a+(i?eff(i,'hp'):0)},0);
function bsum(k){return SLOTS.reduce((a,s)=>{const i=worn(s);return a+(i?eff(i,k):0)},0)}

function fresh(){return {tasks:[],done:{},perfect:{},bonus:{},award:{},xp:0,badges:{},hp:hpBase(1),lastDay:addDays(today(),-1),log:[],defeats:0,gold:0,gAward:{},inv:[],worn:{},rv:2,cls:null,sub:null,chests:0,boss:null,look:null}}
function load(){
  let s={};try{s=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){}
  s=migrate(s);
  const hadHp=s.hp!=null;
  s=Object.assign(fresh(),s);
  s.tasks.forEach(t=>{if(!t.created)t.created=today()});
  if(!hadHp)s.hp=hpBase(levelOf(s.xp))+subHp(s.sub,levelOf(s.xp));
  else{const cap=hpBase(levelOf(s.xp))+hpOf(s)+subHp(s.sub,levelOf(s.xp));if(s.hp>cap)s.hp=cap}
  return s;
}
function save(){S.ts=Date.now();saveSeq++;try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(user){setPending(true);queuePush()}}
let S=load();TR=bsum('hp');
let shown=today();

function streak(){
  let d=today(),n=0,g=0,grace=hasSub('chronicler');
  if(!S.perfect[d])d=addDays(d,-1);
  const rest=k=>!S.tasks.some(t=>t.created<=k&&active(t,k));   /* nothing scheduled that day: doesn't break the streak */
  while(g++<730){
    if(S.perfect[d])n++;
    else if(!rest(d)){if(grace)grace=false;else break}   /* Chronicler forgives one missed day */
    d=addDays(d,-1);
  }
  return n;
}
const sbm=()=>1+(S.cls==='bard'?.5*cm():0)+(hasSub('scholar')?.5*cm():0);   /* Bard: streak bonus per day and its cap are both multiplied */
const mult=()=>(1+Math.min(.5*sbm(),.1*sbm()*streak()))*(1+bsum('xp')/100)*(1+(S.cls==='mage'?.15*cm():0))*(1+.02*lvBonus());
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
    S.tasks.forEach(t=>{if(t.created<=d&&active(t,d)&&!done.includes(t.id)){dmg+=penalty(t.xp);m++}});
    if(!m)continue;
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
  const t=today(),task=S.tasks.find(x=>x.id===id);if(!task||!active(task,t))return;ensureBoss();
  const arr=S.done[t]=S.done[t]||[],k=t+':'+id,before=levelOf(S.xp),i=arr.indexOf(id);
  if(i<0){
    const fq=arr.length===0;arr.push(id);const a=xpGain(task.xp,fq),g=Math.round(task.xp/2*goldMult()*firstMult(fq));S.award[k]=a;S.gAward[k]=g;S.xp+=a;S.gold+=g;pop('+'+a+' XP +'+g+'g',ev);buzz(30);const bd=bossDmg(task.xp);(S.bAward=S.bAward||{})[k]=bd;hitBoss(bd);attackFx(bd);if(hasSub('healer')&&task.xp>=40){const hh=Math.max(0,Math.min(Math.max(1,Math.round(hpBase(levelOf(S.xp))*.08*cm())),maxHp(levelOf(S.xp))-S.hp));if(hh){S.hp+=hh;(S.hAward=S.hAward||{})[k]=hh;toast('Healer: +'+hh+' HP')}}
    const cp=worn('companion');
    if(cp){const b4=plv(cp);const cg=task.xp*(hasSub('beastmaster')?2:1);cp.ce=(cp.ce||0)+cg;(S.pAward=S.pAward||{})[k]={id:cp.id,x:cg};
      if(plv(cp)>b4){TR=bsum('hp');addLog(cp.n+' reached level '+plv(cp),'good');toast('Your companion reached level '+plv(cp)+(plv(cp)===BIG_LV&&!(PETS[cp.pet]&&PETS[cp.pet].sm)?'. It is big enough to stand behind you now.':''))}}
  }else{
    arr.splice(i,1);S.xp=Math.max(0,S.xp-(S.award[k]||task.xp));delete S.award[k];S.gold=Math.max(0,S.gold-(S.gAward[k]||0));delete S.gAward[k];
    {const pa=(S.pAward||{})[k];if(pa){const ci=S.inv.find(z=>z.id===pa.id);if(ci){ci.ce=Math.max(0,(ci.ce||0)-pa.x);TR=bsum('hp')}delete S.pAward[k]}}
    const bd0=S.bAward&&S.bAward[k]!=null?S.bAward[k]:task.xp;if(S.bAward)delete S.bAward[k];{const ha=(S.hAward||{})[k];if(ha){S.hp=Math.max(1,S.hp-ha);delete S.hAward[k]}}
    if(S.boss&&S.boss.hp>0&&S.boss.hp<S.boss.max)S.boss.hp=Math.min(S.boss.max,S.boss.hp+bd0);
  }
  const act=S.tasks.filter(x=>active(x,t)),all=act.length>0&&act.every(x=>arr.includes(x.id));
  if(all&&!S.bonus[t]){
    const lv0=levelOf(S.xp),bx=Math.round(BONUS*lscale(lv0)*(hasSub('herald')?1+.5*cm():1)),hb=Math.max(2,Math.round(hpBase(lv0)*.25));
    const h=Math.max(0,Math.min(Math.round(hb*(S.cls==='druid'?1+cm():1)),maxHp(levelOf(S.xp+bx))-S.hp));
    const nc=1+(hasSub('herald')&&seedR('herald'+t)<.35?1:0);S.bonus[t]={h,c:nc,x:bx};S.chests+=nc;S.perfect[t]=1;S.xp+=bx;S.hp+=h;
    toast('Perfect day! +'+bx+' XP, +'+h+' HP, +'+nc+(nc>1?' chests (Herald bonus)':' chest'));buzz([40,60,40,60,120]);addLog('Perfect day! +'+bx+' XP','good');
  }else if(!all&&S.bonus[t]){
    S.xp=Math.max(0,S.xp-(S.bonus[t].x||BONUS));S.hp=Math.max(1,S.hp-(S.bonus[t].h||0));S.chests=Math.max(0,S.chests-(S.bonus[t].c||0));delete S.bonus[t];delete S.perfect[t];
  }
  const after=levelOf(S.xp);
  if(after>before){
    if(S.cls&&ctierAt(before)!==ctierAt(after))addLog('Promoted to '+CLS[S.cls].n[ctierAt(after)],'good');
    S.hp=maxHp(after);addLog('Reached level '+after,'good');if(after===5)addLog('A class awaits in the Forge','good');if(before<15&&after>=15&&S.cls&&!S.sub)addLog('A subclass awaits in the Forge','good');
    showModal(S.cls?CLS[S.cls].e:rk(after)[1],'Level up!','You are now level '+after+', '+(S.cls?clsName():rk(after)[0])+'.\nMax HP raised, HP restored and all your stats improved.'+(before<15&&after>=15&&S.cls&&!S.sub?'\nA subclass awaits in the Forge.':'')+(after===5&&!S.cls?'\nA class awaits in the Forge.':''));
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
  warrior:{e:'🛡️',n:['Warrior','Knight','Champion','Paladin','Crusader','Warlord'],d:'-20% damage taken'},
  mage:{e:'🔮',n:['Mage','Wizard','Sorcerer','Magister','Archmage','Archon'],d:'+15% XP'},
  rogue:{e:'🗡️',n:['Rogue','Thief','Trickster','Assassin','Shadowblade','Phantom'],d:'+20% gold'},
  druid:{e:'🌿',n:['Druid','Warden','Shaman','Hierophant','Archdruid','Wildheart'],d:'Double healing on perfect days'},
  bard:{e:'🎻',n:['Bard','Minstrel','Troubadour','Maestro','Virtuoso','Songweaver'],d:'Stronger streak bonus'}
};
const BOSSES=[['Goblin King','👹'],['Bog Troll','👺'],['Shadow Wraith','👻'],['Stone Golem','🗿'],['Ember Drake','🐲'],['The Lich','💀']];
const ctierAt=l=>Math.max(0,Math.min(5,Math.floor(l/5)-1));   /* a new class title every 5 levels: Lv 5, 10, 15, 20, 25, 30 */
const ctier=()=>ctierAt(levelOf(S.xp));
const cmAt=l=>.4+.07*Math.max(0,l-5);   /* class bonus strength: 40% of its base at Lv 5, +7% every level after (Lv 15 = 110%, Lv 25 = 180%) */
const cm=()=>cmAt(levelOf(S.xp));
const CB={warrior:[20,'% damage taken','-'],mage:[15,'% XP','+'],rogue:[20,'% gold','+'],bard:[50,'% streak bonus','+']};
const clsBonusTxt=(k,l)=>{const m=cmAt(l);if(k==='druid')return 'Heals x'+(1+m).toFixed(2)+' on perfect days';const c=CB[k];return c[2]+(Math.round(c[0]*m*10)/10)+c[1]};
const roman=n=>{let r='';[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']].forEach(([v,s])=>{while(n>=v){r+=s;n-=v}});return r};
const clsName=()=>{const lv=levelOf(S.xp);return CLS[S.cls].n[ctier()]+(lv>=40?' '+roman(Math.floor(lv/10)-2):'')};   /* top title at Lv 30, then II at Lv 40, III at Lv 50... */
const goldMult=()=>(1+bsum('gold')/100)*(1+(S.cls==='rogue'?.2*cm():0))*(1+(hasSub('treasure')?.15*cm():0))*(1+.02*lvBonus());
const dmgMult=()=>{const r=bsum('dmg')/100+.01*lvBonus()+(S.cls==='warrior'?.2*cm():0)+(hasSub('guardian')?.1*cm():0);return r<=.5?1-r:.25/r};   /* diminishing returns, but every level still helps, forever */
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}

/* ---------- subclasses: unlock at level 15, permanent, chosen in the Forge ---------- */
const SUBS={warrior:['guardian','berserker'],mage:['scholar','battlemage'],rogue:['treasure','shadowblade'],druid:['healer','beastmaster'],bard:['chronicler','herald']};
const SUBD={guardian:{n:'Guardian',e:'🏰'},berserker:{n:'Berserker',e:'🔥'},scholar:{n:'Scholar',e:'📚'},battlemage:{n:'Battlemage',e:'⚡'},treasure:{n:'Treasure Hunter',e:'💎'},shadowblade:{n:'Shadowblade',e:'🌑'},healer:{n:'Healer',e:'💚'},beastmaster:{n:'Beastmaster',e:'🐾'},chronicler:{n:'Chronicler',e:'📜'},herald:{n:'Herald',e:'📯'}};
const bossDmg=xp=>Math.round(xp*(S.boss&&S.boss.sc||1)*(1+bsum('bd')/100)*(1+(hasSub('berserker')?.3*cm():0)+(hasSub('battlemage')?.4*cm():0)));
const seedR=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/10000};   /* same day = same roll, so undo/redo can't reroll */
function subTxt(id,l){
  const m=cmAt(l),r=x=>Math.round(x*m);
  return {
    guardian:'Extra '+r(10)+'% damage reduction, +'+Math.round(hpBase(l)*.2)+' max HP',
    berserker:'+'+r(30)+'% boss damage, but missed quests cost 25% more HP',
    scholar:'+'+r(50)+'% streak bonus',
    battlemage:'+'+r(40)+'% boss damage',
    treasure:'+'+r(15)+'% gold and better chest rolls',
    shadowblade:'+'+r(60)+'% XP and gold on your first quest each day',
    healer:'Heal '+Math.max(1,Math.round(hpBase(l)*.08*m))+' HP on every hard quest',
    beastmaster:'Companion XP doubled',
    chronicler:'One missed day will not break your streak',
    herald:'+'+r(50)+'% perfect-day XP and a 35% chance of a bonus chest'
  }[id];
}
function subBox(lv){
  const box=el('div','subbox');
  if(S.sub){box.appendChild(el('div','sub','Subclass: '+SUBD[S.sub].n+'. '+subTxt(S.sub,lv)+'.'));return box}
  box.appendChild(el('div','sub',lv<15?'Subclass: unlocks at level 15. Two paths to choose from.':'Choose your subclass. It is permanent.'));
  const g=el('div','subgrid');
  (SUBS[S.cls]||[]).forEach(id=>{
    const U=SUBD[id],c=el('button','btn subopt');c.type='button';c.disabled=lv<15;
    c.append(px(U.e,16),el('b','',U.n),el('small','',subTxt(id,Math.max(lv,15))));
    c.onclick=()=>{S.sub=id;const l=levelOf(S.xp);S.hp=Math.min(maxHp(l),S.hp+subHp(id,l));addLog('Became a '+U.n,'good');toast('You are now a '+U.n);save();render()};
    g.appendChild(c);
  });
  box.appendChild(g);
  if(lv<15){
    const pb=el('div','bar xp cbar'),pf=document.createElement('i');
    pf.style.width=Math.min(100,(lv-1+(S.xp-need(lv))/(need(lv+1)-need(lv)))/14*100)+'%';
    pb.append(pf,el('em','','Lv '+lv+' / 15'));box.appendChild(pb);
  }
  return box;
}
/* weekly bosses: the tier follows your level (goblins and wolves early, dragons much later).
   [name, emoji, base HP at Lv 1]. HP and your hits are both multiplied by the level scale (sc), so every tier stays beatable. */
const BTIERS=[
  {min:1,pool:[['Goblin Band','👺',120],['Direwolf Pack','🐺',140],['Bandit Gang','🥷',160]]},
  {min:5,pool:[['Spider Nest','🕷️',190],['Bog Troll','🧌',210],['Skeleton Warband','💀',230]]},
  {min:10,pool:[['Ogre Brute','👹',260],['Stone Golem','🗿',280],['Shadow Wraith','👻',300]]},
  {min:15,pool:[['Ember Drake','🐲',330],['Frost Giant','🧊',350],['Marsh Hydra','🐍',370]]},
  {min:20,pool:[['Ancient Dragon','🐉',400],['Demon Lord','😈',420],['The Lich','🧟',440]]},
  {min:30,pool:[['Elder Dragon','🐉',480],['Archdemon','👿',500],['Abyssal Kraken','🦑',520]]}
];
const BSHARE=[.35,.45,.55,.65,.75,.85];   /* boss HP = this share of what a perfect week of your posted quests would deal, by tier. Board size cancels out; class, subclass and gear are your edge. */
function weekCap(){let c=0,d=weekKey();for(let i=0;i<7;i++,d=addDays(d,1))S.tasks.forEach(t=>{if(active(t,d))c+=t.xp});return c}   /* every quest scheduled Mon-Sun, at base damage */
const BART={'Direwolf Pack':'pet:direwolfpack'};   /* bosses drawn as pixel art instead of an emoji */
const bossOf=b=>b.n?[b.n,BART[b.n]||b.e]:BOSSES[b.idx];   /* old saves only stored an index into BOSSES */
function weekKey(){const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return dkey(d)}
function ensureBoss(){
  const wk=weekKey(),old=S.boss;if(old&&old.week===wk&&old.n&&old.v===3)return;
  const lv=levelOf(S.xp),tr=BTIERS.reduce((a,t,i)=>lv>=t.min?i:a,0),pool=BTIERS[tr].pool,B=pool[Math.floor(new Date(wk+'T12:00:00')/6048e5)%pool.length],sc=lscale(lv),raw=Math.max(weekCap(),140),max=Math.max(1,Math.round(raw*sc*BSHARE[tr])),rs=Math.min(1.6,Math.max(.6,raw/420));   /* raw: floor of one medium quest a day; rs: reward size from the board */
  const f=old&&old.week===wk&&old.max?old.hp/old.max:1,hp0=f>0?Math.max(1,Math.round(max*f)):0;   /* this week's old-style boss is swapped for a scaled one, keeping its damage progress */
  S.boss={week:wk,idx:0,n:B[0],e:B[1],tier:tr,hp:hp0,max,sc,v:3,rw:{g:Math.round(50*(1+.3*tr)*rs),c:rs>=1.5?2:1}};save();
}
function hitBoss(dmg){
  const b=S.boss;if(!b||b.hp<=0)return;
  b.hp=Math.max(0,b.hp-dmg);
  if(b.hp===0){
    const rw=b.rw||{g:50,c:1};S.chests+=rw.c;S.gold+=rw.g;addLog('Defeated '+bossOf(b)[0]+'! +'+rw.g+' gold, +'+rw.c+' chest'+(rw.c>1?'s':''),'good');
    showModal('🏆','Boss defeated!',bossOf(b)[0]+' has fallen.\n+'+rw.g+' gold and '+(rw.c>1?rw.c+' chests.':'a chest.'));confetti();
  }
}
const CHEST_COST=150;
function buyChest(){if(S.gold<CHEST_COST)return;S.gold-=CHEST_COST;S.chests++;toast('Bought a chest');buzz(30);save();render()}
/* drop weights per rarity: every rarity can drop at any level, but the odds slide toward the good stuff as you level.
   Lv 1 uses DROP_LO, Lv 40+ uses DROP_HI, levels in between blend the two (Lv 30 is about 20% Legendary).
   Unique (last slot) is a set of quirky named items, so it stays fairly steady instead of being tied to power. */
const DROP_LO=[50,28,13,5,2,.8,.2,6];
const DROP_HI=[4,8,14,18,22,28,9,8];
function dropWeights(l){
  const p=Math.max(0,Math.min(1,(l-1)/39));
  return DROP_LO.map((w,i)=>w+(DROP_HI[i]-w)*p);
}
function rollRarity(){
  const a=rollRarity1();if(!hasSub('treasure'))return a;   /* Treasure Hunter: roll twice, keep the better (uniques count as mid-rarity) */
  const b=rollRarity1(),key=x=>x===7?3.5:x;return key(b)>key(a)?b:a;
}
function rollRarity1(){
  const w=dropWeights(levelOf(S.xp));
  let r=Math.random()*w.reduce((x,y)=>x+y,0);
  for(let i=0;i<w.length;i++){if((r-=w[i])<0)return i}
  return 0;
}
const RSC=[1,1.8,2.6,3.5,4.5,5.5,6.8,8.5];   /* bonus size per rarity */
const STAT_STEP={xp:3,gold:4,dmg:3,hp:1.6,bd:4};   /* per rarity step; each stat rolls 60-140% of it */
function rollLoot(){
  let r=rollRarity();
  if(r===7){   /* a unique: pick a named item you don't already own */
    const own=new Set(S.inv.map(i=>i.u).filter(Boolean)),pool=Object.keys(UNIQ).filter(k=>!own.has(k));
    if(pool.length){
      const k=pool[Math.floor(Math.random()*pool.length)],U=UNIQ[k];
      return {id:uid(),slot:U.slot,r:7,u:k,v:U.v,st:U.st,pet:U.pet,b:Object.assign({},U.b),n:U.n,isNew:true};
    }
    r=6;   /* you own every unique: this one drops as Mythical gear instead */
  }
  const slot=SLOTS[Math.floor(Math.random()*SLOTS.length)];
  const n=Math.min(4,1+(r>=2?1:0)+(r>=4?1:0)),b={};
  Object.keys(STAT_STEP).sort(()=>Math.random()-.5).slice(0,n).forEach(k=>{b[k]=Math.max(1,Math.round(STAT_STEP[k]*RSC[r]*(.6+Math.random()*.8)))});
  const ks=Object.keys(NOUN[slot]||{});
  const pool=r>=5?['dragon','drake','unicorn','genie','wendigo']:r>=3?['unicorn','genie','golem','troll','drake','wendigo']:['wolfpup','sprite','imp','goblin','wendigo'];
  const it={id:uid(),slot,r,b,st:ks.length?ks[Math.floor(Math.random()*ks.length)]:null,isNew:true};
  if(slot==='companion')it.pet=pool[Math.floor(Math.random()*pool.length)];
  it.n=itemName(it);return it;
}
const iicon=it=>it.slot==='trinket'?'\ud83d\udcff':it.slot==='companion'?(PETS[it.pet]||PETS.wolfpup).e:ICON[it.slot][it.st];
const dicon=k=>k==='trinket'?'\ud83d\udcff':k==='companion'?'🐾':ICON[k][S.cls&&NOUN[k][S.cls]?S.cls:'warrior'];
const sellVal=it=>it.u?120:10*(it.r+1)*(it.r+1);
function openChest(){
  if(S.chests<1)return;S.chests--;
  const r=Math.random();let e,t,m;
  const lp=hasSub('treasure')?.84:.72;if(r<lp){
    const it=rollLoot();S.inv.push(it);
    e=iicon(it);t=RNAME[it.r]+' loot!';m=it.n+'\n'+bonusTxt(it)+(it.u&&UNIQ[it.u]?'\n'+UNIQ[it.u].d:'')+'\nFind it in the Hero tab.';
    addLog('Found '+it.n,'good');
  }else{
    if(r<lp+(1-lp)*.64){const g=30+Math.floor(Math.random()*51);S.gold+=g;e='🪙';t='Gold!';m='You found '+g+' gold.'}
    else{const h=Math.max(0,Math.min(Math.round(hpBase(levelOf(S.xp))*.4),maxHp(levelOf(S.xp))-S.hp));S.hp+=h;e='🧪';t='Healing potion';m='You recovered '+h+' HP.'}
    addLog('Opened a chest: '+t,'good');
  }
  showModal(e,t,m);buzz(40);save();render();
}
function wear(id){
  const it=S.inv.find(i=>i.id===id);if(!it)return;
  S.worn=S.worn||{};
  if(S.worn[it.slot]===id)delete S.worn[it.slot];else S.worn[it.slot]=id;
  TR=bsum('hp');save();render();
}
function sell(id){
  const it=S.inv.find(i=>i.id===id);if(!it||(S.worn||{})[it.slot]===id)return;
  const v=sellVal(it);S.inv=S.inv.filter(i=>i.id!==id);S.gold+=v;
  toast('Sold '+it.n+' for '+v+'g');save();render();
}
/* ---------- hero tab: equipment showcase ---------- */
/* what you wear sets your bonuses and your look. Nothing worn in a slot = plain starter look. */
function eqLook(){
  const e={},dflt=k=>S.cls&&NOUN[k][S.cls]?S.cls:'warrior',sk={helm:'sH',armor:'sA',weapon:'sW'};
  ['helm','armor','weapon'].forEach(k=>{const i=worn(k);e[k]=i?visOf(i):0;e[sk[k]]=i?i.st:dflt(k)});
  e.nH=!worn('helm');e.nA=!worn('armor');e.nW=!worn('weapon');
  const t=worn('trinket');e.trinket=t?Math.max(1,visOf(t)):0;
  const oh=worn('offhand');e.offhand=oh?visOf(oh):0;e.sO=oh?oh.st:dflt('offhand');e.nO=!oh;
  return e;
}
/* selectable hero-tab backgrounds (CSS in style.css via data-bg on .stage); the choice is saved in S.bg */
const SCENES=[['twilight','Twilight'],['grass','Grasslands'],['dungeon','Dungeon'],['desert','Desert'],['snow','Snowfield'],['volcano','Volcano'],['night','Starry night']];
const sceneIdx=()=>{const i=SCENES.findIndex(s=>s[0]===S.bg);return i<0?0:i};
function applyScene(){
  const sg=document.querySelector('.stage');if(!sg)return;
  const sc=SCENES[sceneIdx()];if(sg.dataset.bg!==sc[0])sg.dataset.bg=sc[0];
  const hav=document.querySelector('.hud .av');if(hav&&hav.dataset.bg!==sc[0])hav.dataset.bg=sc[0];   /* the profile frame shows the same scene */
  const l=$('bgname'),t='Scene: '+sc[1];if(l&&l.textContent!==t)l.textContent=t;
}
function initScene(){
  const fn=$('figname');if(!fn||$('bgrow'))return;
  const row=el('div','bgrow'),pv=el('button','ghost','<'),nx=el('button','ghost','>'),nm=el('b','','');
  row.id='bgrow';nm.id='bgname';pv.type=nx.type='button';
  pv.setAttribute('aria-label','Previous background');nx.setAttribute('aria-label','Next background');
  const go=n=>{S.bg=SCENES[(sceneIdx()+n+SCENES.length)%SCENES.length][0];save();applyScene()};
  pv.onclick=()=>go(-1);nx.onclick=()=>go(1);
  row.append(pv,nm,nx);const ft=document.querySelector('#tab-realm .foot');if(ft)ft.insertBefore(row,ft.firstChild);else fn.after(row);applyScene();   /* tucked away at the bottom of the Realm tab, not on the Hero tab */
}
/* shrink each caption line (data-max = biggest size in px) until it fits the width; skipped while the Hero tab is hidden */
const heroName=()=>S.name||(user&&user.email?user.email.split('@')[0]:'');   /* custom name, else the start of the sign-in email */
function fitCap(){
  ['figname','rank'].forEach(id=>{
    const fn=$(id);if(!fn||!fn.offsetParent)return;
    fn.querySelectorAll('span').forEach(s=>{let z=+s.dataset.max||12;s.style.fontSize=z+'px';while(s.scrollWidth>s.clientWidth&&z>6){z-=.5;s.style.fontSize=z+'px'}});
  });
}
addEventListener('resize',fitCap);
let SEL='weapon',SELI=null;   /* slot being browsed / item selected in the picker */
function renderGear(){
  const lv=levelOf(S.xp),R=rk(lv),E=eqLook();applyScene();
  const fg=$('figure'),fk=(PV?'pv'+PV.n:Object.values(E).join('.'))+'|'+(S.look?Object.values(S.look).join(','):'');
  if(fg.dataset.k!==fk){fg.dataset.k=fk;fg.replaceChildren(heroPx(lv))}
  {   /* caption under the hero: username on top, level + rank below, each sized to fill the width */
    const fn=$('figname'),nm=heroName(),rl='Lv '+lv+' '+(S.cls?clsName():R[0]),ck=nm+'|'+rl;
    if(fn.dataset.k!==ck){
      fn.dataset.k=ck;const a=[];
      if(nm){const s1=el('span','fn-name',nm);s1.dataset.max=16;a.push(s1)}
      const s2=el('span','fn-rank',rl);s2.dataset.max=12;a.push(s2);
      fn.replaceChildren(...a);
    }
    fitCap();
  }
  {   /* companion beside the hero (a dev preview overrides what is worn) */
    const cw=worn('companion'),fk2=PVP||(cw?(PETS[cw.pet]?cw.pet:'wolfpup'):null),fp=$('fpet'),cl=PVP?PVL:(cw?plv(cw):1);
    if(fk2){fp.hidden=false;fp.title=(PVP?PETS[fk2].n:cw.n)+' (Lv '+cl+')';const vl=vlv(fk2,cl);fp.classList.toggle('solid',!!PETS[fk2].sm);fp.classList.toggle('still',!!PETS[fk2].still);fp.classList.toggle('big',vl>=BIG_LV);fp.parentNode.style.setProperty('--pz',psz(fk2,vl));setSprite('fpet',PETS[fk2].e,pres(vl),vl);fp.style.filter=PETS[fk2].fire?'drop-shadow(0 0 6px rgba(255,120,30,.75))':''}else fp.hidden=true;
  }
  const slot=(k,wide)=>{
    const it=worn(k),b=el('button','eslot'+(SEL===k?' on':'')+(it?'':' base')),ic=el('span','ei'),lab=it?it.n+(it.slot==='companion'?' Lv '+plv(it):''):'Empty';
    b.type='button';b.style.setProperty('--rar',RAR[it?it.r:0]);b.setAttribute('aria-pressed',SEL===k);
    b.setAttribute('aria-label',SLOTN[k]+': '+(it?it.n:'empty'));ic.appendChild(px(it?iicon(it):dicon(k),16));
    if(wide){const tx=el('div','etx');tx.append(el('span','ek',SLOTN[k]),el('small','',lab));b.classList.add('wide');b.append(ic,tx)}
    else b.append(el('span','ek',SLOTN[k]),ic,el('small','',lab));
    if(S.inv.some(i=>i.slot===k&&i.isNew))b.appendChild(el('i','up','!'));
    b.onclick=()=>{
      SEL=k;let ch=false;
      S.inv.forEach(i=>{if(i.slot===k&&i.isNew){delete i.isNew;ch=true}});
      if(ch){save();render()}else renderGear();
    };
    return b;
  };
  $('scol-l').replaceChildren(slot('helm'),slot('armor'));
  $('scol-r').replaceChildren(slot('weapon'),slot('offhand'));
  $('slotrow').replaceChildren(slot('trinket',1),slot('companion',1));
  const pk=$('picker'),hd=el('div','pkhead'),cur=worn(SEL);
  const items=S.inv.filter(i=>i.slot===SEL).sort((a,c)=>c.r-a.r||a.n.localeCompare(c.n));
  hd.append(el('b','',SLOTN[SEL]),el('span','',(items.length?items.length+(items.length===1?' item':' items')+' \u00b7 ':'')+S.gold+'g'));
  pk.replaceChildren(hd);
  if(!items.length){   /* nothing for this slot: one compact line instead of a big empty panel */
    const e=el('div','pkempty'),ic=el('span','ei');ic.appendChild(px(dicon(SEL),16));
    e.append(ic,el('span','','Nothing yet. Chests drop random loot.'));pk.appendChild(e);
  }else{
    if(!items.some(i=>i.id===SELI))SELI=cur&&items.some(i=>i.id===cur.id)?cur.id:items[0].id;
    /* inventory grid: one small tile per item, tap one to see its details below */
    const g=el('div','ig');
    items.forEach(i=>{
      const isOn=!!cur&&cur.id===i.id,t=el('button','itile'+(i.id===SELI?' sel':'')+(isOn?' on':'')),ic=el('span','ei');
      t.type='button';t.style.setProperty('--rar',RAR[i.r]);t.setAttribute('aria-pressed',i.id===SELI);
      t.setAttribute('aria-label',i.n+(isOn?' (worn)':''));t.title=i.n;
      ic.appendChild(px(iicon(i),16));t.appendChild(ic);
      if(isOn)t.appendChild(el('i','wn','\u2713'));
      t.onclick=()=>{SELI=i.id;renderGear()};
      g.appendChild(t);
    });
    pk.appendChild(g);
    const sel=items.find(i=>i.id===SELI),on=!!cur&&cur.id===sel.id,d=el('div','idet'),act=el('div','iact2');
    d.style.setProperty('--rar',RAR[sel.r]);
    d.append(el('b','',sel.n),el('small','',RNAME[sel.r]+': '+bonusTxt(sel)));
    if(sel.slot==='companion'){const L=plv(sel);d.appendChild(el('small','',L>=PMAX?'Level '+L+' (max)':'Level '+L+': '+((sel.ce||0)-pneed(L))+' / '+(pneed(L+1)-pneed(L))+' XP. Grows as you finish quests.'))}
    if(sel.u&&UNIQ[sel.u])d.appendChild(el('small','',UNIQ[sel.u].d));
    if(!on)d.appendChild(el('small','dim','Bonuses only count while worn.'));
    const wb=el('button','btn',on?'Take off':'Wear');wb.type='button';wb.onclick=()=>wear(sel.id);act.appendChild(wb);
    if(!on){const sb=el('button','ghost','Sell '+sellVal(sel)+'g');sb.type='button';sb.onclick=()=>sell(sel.id);act.appendChild(sb)}
    d.appendChild(act);pk.appendChild(d);
  }
}
/* ---------- chest stage: pixel chest that shakes, glows and bursts open ---------- */
let CHEST_BUSY=false,LOCKSEL=null;   /* LOCKSEL = class tapped in the locked preview */
function chestPx(open){
  const W=20,H=20,G=Array.from({length:H},()=>Array(W).fill(null));
  const R=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let k=0;k<w;k++)if(x+k>=0&&y+j>=0&&x+k<W&&y+j<H)G[y+j][x+k]=c};
  const WD='#8a5a2a',WL='#b07a3a',WK='#5e3a1a',MT='#aab3c2',MD='#6e7788',GD='#e8b93c',GL='#fff1a8',KH='#1a1008';
  R(2,10,16,8,WD);R(2,10,16,1,WL);R(2,14,16,1,WK);R(2,17,16,1,WK);                    /* body planks */
  R(5,10,2,8,MT);R(6,10,1,8,MD);R(13,10,2,8,MT);R(14,10,1,8,MD);R(2,10,16,1,MT);     /* iron bands + rim */
  if(!open){
    R(4,3,12,1,WL);R(3,4,14,1,WL);R(2,5,16,5,WD);R(2,5,16,1,WL);R(2,9,16,1,WK);       /* rounded lid */
    R(5,4,2,6,MT);R(6,4,1,6,MD);R(13,4,2,6,MT);R(14,4,1,6,MD);
    R(8,8,4,4,GD);R(8,8,4,1,GL);R(9,9,2,2,KH);                                        /* lock */
  }else{
    R(4,1,12,5,WD);R(4,1,12,1,WL);R(4,5,12,1,WK);                                     /* lid swung up */
    R(6,2,2,3,MT);R(7,2,1,3,MD);R(12,2,2,3,MT);R(13,2,1,3,MD);
    R(3,6,14,3,'#3a2410');R(3,8,14,2,'#ffe58a');R(3,8,14,1,'#fffbe0');                  /* glowing inside */
    [[5,8],[9,9],[12,8],[15,9]].forEach(p=>R(p[0],p[1],1,1,GD));
    R(8,12,4,2,GD);R(8,12,4,1,GL);                                                    /* lock hangs open */
  }
  const Q=G.map(r=>r.slice());
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!G[y][x]&&((G[y-1]||[])[x]||G[y][x-1]||G[y][x+1]||(G[y+1]||[])[x]))Q[y][x]='#0a0812';
  return gridCanvas(Q,W,H);
}
function openChestFx(fg,st){
  if(CHEST_BUSY||S.chests<1)return;
  CHEST_BUSY=true;fg.classList.remove('ready');fg.classList.add('shake');buzz(30);
  setTimeout(()=>{
    fg.classList.remove('shake');fg.classList.add('burst');fg.replaceChildren(chestPx(true));
    ['#ffd75a','#fff1a8','#ffffff','#e8b93c'].forEach((c,q)=>{
      for(let i=0;i<3;i++){
        const s=el('i','spark'),a=Math.PI*(1.1+.8*Math.random()),d=50+Math.random()*55;
        s.style.setProperty('--dx',Math.round(Math.cos(a)*d)+'px');s.style.setProperty('--dy',Math.round(Math.sin(a)*d)+'px');
        s.style.background=c;st.appendChild(s);
      }
    });
    setTimeout(()=>{CHEST_BUSY=false;openChest()},650);
  },520);
}
function renderRPG(){
  const lv=levelOf(S.xp);renderArena();renderSheet();renderGear();
  /* boss */
  const bb=$('bossbox');bb.innerHTML='';
  const b=S.boss;
  if(b){
    const B=bossOf(b),info=el('div','');info.style.flex='1';
    const bar=el('div','bar hp'),fill=document.createElement('i'),em=el('em','',b.hp+' / '+b.max);
    fill.style.width=(b.hp/b.max*100)+'%';bar.append(fill,em);
    info.append(el('b','',b.hp?B[0]:B[0]+' (defeated)'),bar,el('div','sub',b.hp?'Every quest you finish deals damage. A new boss arrives on Monday.':'Reward claimed. A new boss arrives on Monday.'));
    bb.append(px(B[1],24),info);
  }
  /* forge */
  const f=$('forge');if(CHEST_BUSY)return;f.innerHTML='';
  const cb=el('div','sub');
  if(S.cls)cb.textContent='Class: '+clsName()+'. '+clsBonusTxt(S.cls,lv)+'.';
  else if(lv<5){
    cb.textContent='Class: unlocks at level 5.';
    const lk=el('div','lockrow'),clsInfo=k=>CLS[k].n[0]+': '+clsBonusTxt(k,5)+'.',
      info=el('div','lockinfo',LOCKSEL?clsInfo(LOCKSEL):'Tap a class to preview its bonus.');
    Object.keys(CLS).forEach(k=>{
      const b=el('button','lockitem'+(LOCKSEL===k?' on':'')),c=el('span','lockc'),pl=el('span','lockpad');
      b.type='button';b.title=clsInfo(k);b.setAttribute('aria-label',CLS[k].n[0]+', locked until level 5. '+clsBonusTxt(k,5));
      c.appendChild(px(CLS[k].e,16));pl.appendChild(px('🔒',16));c.appendChild(pl);
      b.append(c,el('small','',CLS[k].n[0]));
      b.onclick=()=>{LOCKSEL=k;lk.querySelectorAll('.lockitem').forEach(x=>x.classList.toggle('on',x===b));info.textContent=clsInfo(k)};
      lk.appendChild(b);
    });
    const pb=el('div','bar xp cbar'),pf=document.createElement('i');
    pf.style.width=Math.min(100,(lv-1+(S.xp-need(lv))/(need(lv+1)-need(lv)))/4*100)+'%';
    pb.append(pf,el('em','','Lv '+lv+' / 5'));cb.append(lk,info,pb);
  }
  else{
    cb.textContent='Choose your class. It is permanent and only changes your bonuses, not your look.';
    const g=el('div','clsgrid');
    Object.keys(CLS).forEach(k=>{
      const c=el('button','btn');c.type='button';
      c.append(px(CLS[k].e,16),el('b','',CLS[k].n[0]),el('small','',clsBonusTxt(k,lv)));
      c.onclick=()=>{S.cls=k;addLog('Became a '+CLS[k].n[0],'good');toast('You are now a '+CLS[k].n[0]);save();render()};
      g.appendChild(c);
    });
    cb.appendChild(g);
  }
  f.appendChild(cb);
  if(S.cls)f.appendChild(subBox(lv));
  const nc=S.chests,st=el('div','chestwrap'),fg=el('button','chestfig'+(nc>0?' ready':''));
  fg.type='button';fg.setAttribute('aria-label',nc>0?'Open a chest':'No chests to open');fg.appendChild(chestPx(false));
  fg.onclick=()=>{if(nc<1){toast('No chests yet. Perfect days and weekly bosses drop them.');return}openChestFx(fg,st)};
  st.append(fg,el('div','chestcount','Chests: '+nc),el('div','sub',nc>0?'Tap the chest to open it.':'No chests yet. Earn them from perfect days and weekly bosses.'));
  f.appendChild(st);
  const ob=el('button','btn wide','Open chest');ob.type='button';ob.disabled=nc<1;ob.onclick=()=>openChestFx(fg,st);f.appendChild(ob);
  const br=el('div','buyrow'),gb=el('div','bar gold gbar'+(S.gold>=CHEST_COST?' full':'')),gf=document.createElement('i');
  gf.style.width=Math.min(100,S.gold/CHEST_COST*100)+'%';gb.append(gf,el('em','',S.gold+' / '+CHEST_COST+'g'));
  const bc=el('button','ghost','Buy chest');bc.type='button';bc.disabled=S.gold<CHEST_COST;bc.onclick=buyChest;br.append(gb,bc);f.appendChild(br);
  const aff=S.inv.some(i=>i.isNew);
  $('dot-hero').hidden=!(S.chests>0||aff||(lv>=5&&!S.cls)||(lv>=15&&S.cls&&!S.sub));
}

/* ---------- arena, character sheet, tabs ---------- */
function setSprite(id,emoji,n,lv){const e=$(id),art=emoji.slice(0,4)==='pet:',res=lv<BIG_LV?64:96,tier=petTier(lv||1),key=art?emoji+res+tier:emoji+n;if(e.dataset.k===key)return;e.dataset.k=key;e.replaceChildren(art?petSprite(emoji.slice(4),res,tier):px(emoji,n))}
function renderArena(){
  const lv=levelOf(S.xp),R=rk(lv);
  const ah=$('ahero'),hk=(PV?'pv'+PV.n:Object.values(eqLook()).join('.'))+(S.look?Object.values(S.look).join(','):'');if(ah.dataset.k!==hk){ah.dataset.k=hk;ah.replaceChildren(heroPx(lv))}
  $('atag').textContent='Lv '+lv+' '+(S.cls?clsName():R[0]);
  const pt=worn('companion'),ap=$('apet'),pk=PVP||(pt?(PETS[pt.pet]?pt.pet:'wolfpup'):null),al=PVP?PVL:(pt?plv(pt):1);
  if(pk){ap.hidden=false;ap.title=(PVP?PETS[pk].n:pt.n)+' (Lv '+al+')';const vl=vlv(pk,al);ap.classList.toggle('solid',!!PETS[pk].sm);ap.classList.toggle('still',!!PETS[pk].still);ap.classList.toggle('big',vl>=BIG_LV);ap.style.setProperty('--pz',PETS[pk].px?PETS[pk].px/.4737:psize(vl));setSprite('apet',PETS[pk].e,pres(vl),vl);ap.style.filter=PETS[pk].fire?'drop-shadow(0 0 5px rgba(255,120,30,.75))':''}else ap.hidden=true;
  const b=S.boss;if(!b)return;
  const B=bossOf(b);setSprite('aboss',B[1],24);$('aboss').classList.toggle('art',B[1].slice(0,4)==='pet:');
  $('abname').textContent=B[0];$('abfill').style.width=(b.hp/b.max*100)+'%';$('abtxt').textContent=b.hp+' / '+b.max;
  $('aboss').classList.toggle('dead',b.hp<=0);
}
function attackFx(dmg){
  const h=$('ahero'),b=$('aboss');
  [[h,'atk'],[b,'hit'],[$('apet'),'hop']].forEach(([e,c])=>{e.classList.remove(c);void e.offsetWidth;e.classList.add(c);setTimeout(()=>e.classList.remove(c),800)});
  const d=el('div','dmg','-'+dmg);$('arena').appendChild(d);setTimeout(()=>d.remove(),900);
}
function renderSheet(){
  const s=$('sheet');s.innerHTML='';
  [['XP','x'+mult().toFixed(2)],['Gold','x'+goldMult().toFixed(2)],['Damage','x'+dmgMult().toFixed(2)],['Max HP',maxHp(levelOf(S.xp))]].forEach(([k,v])=>{
    const d=el('div','stat');d.append(el('small','',k),el('b','',v));s.appendChild(d);
  });
  const gb=$('gearbonus');
  if(gb){
    gb.replaceChildren();
    const ks=['xp','gold','dmg','hp','bd'].filter(k=>bsum(k));
    if(!ks.length)gb.textContent='No gear bonuses yet. Wear some loot to gain them.';
    else{const t=el('div','','Gear bonuses');t.style.color='var(--gold)';gb.appendChild(t);ks.forEach(k=>gb.appendChild(el('div','',STAT_TXT[k](bsum(k)))))}
  }
}
function tab(n){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.id==='tab-'+n));
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('on',b.dataset.tab===n));
  const hud=document.querySelector('.hud');if(hud)hud.hidden=n==='hero';   /* Hero tab: just the full avatar and its gear */
  const th=$('tab-hero');if(th)th.style.paddingTop=n==='hero'?'env(safe-area-inset-top,0px)':'';
  fitCap();scrollTo(0,0);try{localStorage.setItem('dq.tab',n)}catch(e){}
}
function initNav(){
  const ic={quests:'📜',hero:'🛡️',realm:'🏰'};
  document.querySelectorAll('.navbtn').forEach(b=>{b.querySelector('.ni').appendChild(px(ic[b.dataset.tab],16));b.onclick=()=>tab(b.dataset.tab)});
  let t='quests';try{t=localStorage.getItem('dq.tab')||t}catch(e){}
  tab(ic[t]?t:'quests');
}

/* ---------- render ---------- */
function earned(){
  const s=streak(),lv=levelOf(S.xp);
  return {first:Object.values(S.done).some(a=>a.length),perfect:Object.keys(S.perfect).length>0,s3:s>=3,s7:s>=7,s30:s>=30,l5:lv>=5,l10:lv>=10,l25:lv>=25,l50:lv>=50,l100:lv>=100};
}
function timer(){
  const n=new Date(),e=new Date(n);e.setHours(24,0,0,0);
  const mins=Math.max(0,Math.ceil((e-n)/60000)),d=doneToday();
  const risk=S.tasks.filter(t=>active(t)&&!d.includes(t.id)).reduce((a,t)=>a+penalty(t.xp),0);
  const el=$('timer');
  el.textContent=!S.tasks.length?'':!S.tasks.some(t=>active(t))?'A rest day. No quests are due today.':risk?'Day ends in '+Math.floor(mins/60)+'h '+mins%60+'m. Unfinished quests will cost '+risk+' HP.':'All quests cleared. You are safe today.';
  el.classList.toggle('warn',risk>0&&mins<180);
}
/* ---------- HUD effects: counting numbers, bar flashes, coin flip, label icons ---------- */
let lastXp=null,lastHp=null,lastGold=null;
const NOMOVE=matchMedia('(prefers-reduced-motion:reduce)').matches;
function tween(el,to,dec,pre){   /* counts a number up or down to its new value (and pops it) */
  const fmt=v=>pre+(dec?v.toFixed(dec):Math.round(v));
  if(el._v==null||NOMOVE){el._v=to;el._to=to;el.textContent=fmt(to);return}
  if(el._to===to)return;
  const from=el._v;el._to=to;cancelAnimationFrame(el._raf);
  const t0=performance.now();
  const step=n=>{const k=Math.min(1,(n-t0)/550),v=from+(to-from)*(1-Math.pow(1-k,3));el._v=v;el.textContent=fmt(v);if(k<1)el._raf=requestAnimationFrame(step);else{el._v=to;el.textContent=fmt(to)}};
  el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');
  el._raf=requestAnimationFrame(step);
}
function flashBar(b){b.classList.remove('flash');void b.offsetWidth;b.classList.add('flash');setTimeout(()=>b.classList.remove('flash'),750)}
function flipCoin(){const g=$('gc');g.classList.remove('flip');void g.offsetWidth;g.classList.add('flip');setTimeout(()=>g.classList.remove('flip'),650)}
function initHud(){   /* a heart in front of HP, a star in front of XP */
  const ls=document.querySelectorAll('.hud .stats .row label');
  [['\u2764\ufe0f'],['\u2b50']].forEach((a,i)=>{const l=ls[i];if(l&&!l.querySelector('.px'))l.prepend(px(a[0],16))});
}
function render(){
  const lv=levelOf(S.xp),lo=need(lv),hi=need(lv+1),mh=maxHp(lv),R=rk(lv);
  if(S.hp>mh)S.hp=mh;
  $('lvl').textContent=lv;$('av').replaceChildren(heroPx(lv,1));{const fr=document.querySelector('.hud .av');if(fr)fr.dataset.tier=lv>=40?4:lv>=25?3:lv>=15?2:lv>=5?1:0}   /* frame tier */{   /* top bar: your name big, rank small underneath (just the rank if there is no name) */
    const rn=$('rank'),nm=heroName(),rl='Rank '+Math.min(lv,5)+': '+(S.cls?clsName():R[0]),ck=nm+'|'+rl;   /* rank number 1-5 (you stay at Rank 5 after level 5) */
    if(rn.dataset.k!==ck){
      rn.dataset.k=ck;
      /* banner name plate: name on a ribbon, rank / class underneath as a title */
      const a=el('span','rk-name',nm||rl);a.dataset.max=17;
      const rib=el('div','rk-rib');rib.appendChild(a);
      const bn=el('div','rk-banner');bn.append(rib);
      if(nm){const b=el('span','rk-sub',rl);b.dataset.max=11;rn.replaceChildren(bn,b)}else rn.replaceChildren(bn);
    }
    fitCap();
  }
  const hp=Math.max(0,Math.round(S.hp)),pct=hp/mh*100;
  $('hpfill').style.width=pct+'%';$('hptxt').textContent=hp+' / '+mh;
  $('hpbar').classList.toggle('low',pct<30);$('hpbar').classList.toggle('crit',pct<15);
  document.body.classList.toggle('lowhp',pct<30&&hp>0);document.body.classList.toggle('critical',pct<15&&hp>0);
  $('fill').style.width=((S.xp-lo)/(hi-lo)*100)+'%';$('xptxt').textContent=(S.xp-lo)+' / '+(hi-lo);
  $('bar').classList.toggle('near',(S.xp-lo)/(hi-lo)>=.85);
  if(lastXp!=null&&S.xp>lastXp)flashBar($('bar'));if(lastHp!=null&&S.hp>lastHp)flashBar($('hpbar'));lastXp=S.xp;lastHp=S.hp;
  const sk=streak();
  tween($('sn'),sk,0,'');$('streak').classList.toggle('off',sk===0);
  {const st=$('streak');st.classList.remove('s1','s2','s3','s4');st.classList.add(sk>=14?'s4':sk>=7?'s3':sk>=3?'s2':'s1')}
  tween($('mv'),mult(),2,'x');tween($('gd'),S.gold,0,'');
  if(lastGold!=null&&S.gold>lastGold)flipCoin();lastGold=S.gold;

  const d=doneToday(),list=$('list');list.innerHTML='';
  const act=S.tasks.filter(t=>active(t)),shown=S.tasks.filter(t=>QT==='today'?active(t):(t.days||'all')===QT);
  document.querySelectorAll('.qtab').forEach(b=>{const on=b.dataset.g===QT;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
  if(!shown.length){
    const e=document.createElement('div');e.className='empty';
    e.textContent=!S.tasks.length?'The board is bare. Pin a daily quest below. Finish it for XP, neglect it and you take damage.':QT==='today'?'A rest day. Nothing is posted for today.':'Nothing posted here yet. Choose this schedule when you pin a quest.';
    list.appendChild(e);
  }
  shown.forEach(t=>{
    const on=d.includes(t.id),rest=!active(t),li=document.createElement('li');li.className='q'+(on?' done':'')+(rest?' rest':'');
    const c=document.createElement('button');c.className='chk';c.type='button';
    c.setAttribute('aria-label',(on?'Undo ':'Complete ')+t.name);c.textContent=on?'✓':'';c.disabled=rest;
    c.onclick=ev=>toggle(t.id,ev);
    const n=el('div','name');n.append(el('div','',t.name),el('small','meta','★'.repeat(t.xp>=40?3:t.xp>=20?2:1)+' +'+(on&&S.award[today()+':'+t.id]!=null?S.award[today()+':'+t.id]:xpGain(t.xp,!d.length))+' XP +'+(on&&S.gAward[today()+':'+t.id]!=null?S.gAward[today()+':'+t.id]:Math.round(t.xp/2*goldMult()*firstMult(!d.length)))+'g'));
    const g=document.createElement('span');g.className='tag';g.textContent=rest?'REST':on?'DONE':'-'+penalty(t.xp)+' HP';
    const x=document.createElement('button');x.className='del';x.type='button';x.textContent='×';
    x.setAttribute('aria-label','Delete '+t.name);
    x.onclick=()=>{S.tasks=S.tasks.filter(z=>z.id!==t.id);save();render()};
    li.append(c,n,g,x);list.appendChild(li);
  });
  const done=act.filter(t=>d.includes(t.id)).length;
  $('count').textContent=done+' / '+act.length+' done';$('dfill').style.width=(act.length?done/act.length*100:0)+'%';
  $('winbox').innerHTML=(act.length&&done===act.length)?'<div class="win">The realm is safe. Rest well, hero.</div>':'';
  timer();
  if(!addTouched)setAdd(!S.tasks.length);   /* open by default only while the board is empty */

  renderRPG();
  document.querySelectorAll('.dbtn').forEach(b=>{const v=+b.dataset.v;b.querySelector('.dx').textContent='+'+xpGain(v)+' XP';b.querySelector('.dh').textContent='-'+penalty(v)+' HP'});
  const lg=$('log');lg.innerHTML='';
  if(!S.log.length)lg.innerHTML='<div><small>Nothing yet.</small>Your wins and losses will show up here.</div>';
  S.log.forEach(l=>{const r=document.createElement('div');const s=document.createElement('small');s.textContent=l.d.slice(5);const m=document.createElement('span');m.className=l.c||'';m.textContent=l.m;r.append(s,m);lg.appendChild(r)});

  const E=earned(),bx=$('badges');bx.innerHTML='';
  BADGES.forEach(b=>{
    if(E[b.id]&&!S.badges[b.id]){S.badges[b.id]=1;save();setTimeout(()=>toast('Badge unlocked: '+b.n),900)}
    const kind=/^s\d/.test(b.id)?'s':/^l\d/.test(b.id)?'l':'x',got=!!S.badges[b.id];   /* s = streak, l = level, x = other */
    const el=document.createElement('div');el.className='b k-'+kind+(got?' got':' lock');
    el.innerHTML='<span class="e"></span><b></b><span class="bd"></span>';
    el.children[0].appendChild(px(b.e,20));el.children[1].textContent=b.n;el.children[2].textContent=b.d;
    if(!got){   /* locked: padlock on the medal, and a progress bar toward streak / level goals */
      const pl=document.createElement('i');pl.className='bl';pl.appendChild(px('🔒',16));el.children[0].appendChild(pl);
      if(kind!=='x'){
        const tg=+b.id.slice(1),cur=Math.min(kind==='s'?sk:lv,tg),p=document.createElement('div');
        p.className='bp';p.innerHTML='<i></i><em></em>';p.firstChild.style.width=(cur/tg*100)+'%';p.lastChild.textContent=cur+' / '+tg;
        el.appendChild(p);
      }
    }
    bx.appendChild(el);
  });
  maybeCreator();
}

function setAdd(o){ADDOPEN=o;$('addbody').hidden=!o;$('addtoggle').setAttribute('aria-expanded',o?'true':'false');$('add').classList.toggle('open',o)}
$('addtoggle').onclick=()=>{addTouched=true;setAdd(!ADDOPEN);if(ADDOPEN)$('newname').focus()};
$('add').onsubmit=e=>{
  e.preventDefault();
  const inp=$('newname'),name=inp.value.trim();if(!name)return;
  const nt={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name,xp:+$('diff').value,created:today(),days:$('days').value};
  S.tasks.push(nt);
  if(QT==='today'?!active(nt):QT!==nt.days)QT=nt.days;   /* jump to the tab where the new quest lives */
  inp.value='';addTouched=true;setAdd(false);save();render();toast('Quest pinned');
};
document.querySelectorAll('.dbtn').forEach(b=>b.onclick=()=>{
  $('diff').value=b.dataset.v;
  document.querySelectorAll('.dbtn').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});
});
document.querySelectorAll('.sbtn').forEach(b=>b.onclick=()=>{
  $('days').value=b.dataset.g;
  document.querySelectorAll('.sbtn').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});
});
document.querySelectorAll('.qtab').forEach(b=>b.onclick=()=>{QT=b.dataset.g;render()});
$('theme').onclick=()=>{
  const r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;
  r.dataset.theme=dark?'light':'dark';
};
/* reset progress: two "are you sure" steps. The confirm button is on top in step 1 and at the bottom in step 2
   (Cancel swaps with it), so you have to move the mouse each time; a double click on the same spot hits Cancel. */
function confirmReset(){
  const ov=el('div','modal on'),card=el('div','card down'),h=el('h2',''),p=el('p',''),box=el('div','stack');
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  card.append(h,p,box);ov.appendChild(card);document.body.appendChild(ov);
  const esc=e=>{if(e.key==='Escape')close()};
  const close=()=>{ov.remove();document.removeEventListener('keydown',esc)};
  document.addEventListener('keydown',esc);
  const doReset=()=>{S=fresh();S.wiped=Date.now();TR=0;save();if(user)pushNow(true);close();render()};
  const mk=(t,cls,fn,wait)=>{const b=el('button',cls,t);b.type='button';b.onclick=fn;if(wait){b.disabled=true;setTimeout(()=>{b.disabled=false},wait)}return b};
  const step=n=>{
    box.replaceChildren();
    if(n===1){
      h.textContent='Reset progress?';p.textContent='This erases your hero, gear, quests and gold.';
      box.append(mk('Yes, continue','btn danger',()=>step(2),600),mk('Cancel','btn',close));
      box.lastChild.focus();
    }else{
      h.textContent='Are you really sure?';p.textContent='This cannot be undone.\nEverything will be wiped, including your cloud save.';
      box.append(mk('Cancel','btn',close),mk('Yes, erase everything','btn danger',doReset,600));
      box.firstChild.focus();
    }
  };
  step(1);
}
$('reset').onclick=confirmReset;
/* day rollover + penalties only run once the cloud save has been pulled, otherwise a stale device would "miss" quests done elsewhere */
function canRun(){return cloudOff||!cloudConfigured()||synced}
function daily(){if(!canRun())return;ensureBoss();process()}
function checkDay(){
  if(dirty&&user&&synced&&!pushT)pushNow();   /* retry any save that failed or was interrupted */
  if(!canRun()){timer();return}
  if(shown!==today()){shown=today();process();ensureBoss();render()}else timer();
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){flushPush();return}   /* leaving the app: save to cloud right now */
  checkDay();                                                       /* coming back: the live listener has already caught up */
});
addEventListener('pagehide',flushPush);
setInterval(checkDay,30000);
$('fl').appendChild(px('🔥',16));$('gc').appendChild(px('🪙',16));$('mi').appendChild(px('⚡',16));initNav();initCreator();initScene();initHud();
daily();render();
/* ---------- dev: scroll through every avatar (set DEV=false to hide) ---------- */
const DEV=true;
if(DEV){
  const LIST=[];
  Object.keys(NOUN.weapon).forEach(w=>Object.keys(NOUN.armor).forEach(a=>[0,2,5].forEach(t=>LIST.push({n:NOUN.armor[a]+' + '+NOUN.weapon[w]+' T'+t,eq:{helm:t,armor:t,weapon:t,trinket:t,offhand:t,sO:a,sH:a,sA:a,sW:w}}))));
  let pi=-1;
  const PKEYS=Object.keys(PETS);let pj=-1;   /* companion previewer: cycles every pet next to your hero in the arena */
  const pdraw=()=>{$('dpname').textContent=PVP?PETS[PVP].n+' Lv '+PVL:'My companion';$('dpface').replaceChildren(PVP?px(PETS[PVP].e,24):el('span',''));render()};
  const pgo=n=>{pj=PVP?(pj+n+PKEYS.length)%PKEYS.length:(n>0?0:PKEYS.length-1);PVP=PKEYS[pj];pdraw()};
  const draw=()=>{$('dname').textContent=PV?PV.n:'My hero';$('dface').replaceChildren(heroPx(1,1));render()};
  const go=n=>{pi=PV?(pi+n+LIST.length)%LIST.length:(n>0?0:LIST.length-1);PV=LIST[pi];draw()};
  $('dev').hidden=false;
  $('dprev').onclick=()=>go(-1);$('dnext').onclick=()=>go(1);
  $('dpprev').onclick=()=>pgo(-1);$('dpnext').onclick=()=>pgo(1);
  $('dpface').onclick=()=>{if(!PVP)return;PVL=PVL>=PMAX?1:Math.min(PMAX,PVL+3);pdraw()};
  $('dpreset').onclick=()=>{PVP=null;pj=-1;pdraw()};
  $('devpet').hidden=false;
  $('dreset').onclick=()=>{PV=null;pi=-1;draw()};
  addEventListener('keydown',e=>{if(!DEVON||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1);if(PVP&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();PVL=Math.max(1,Math.min(PMAX,PVL+(e.key==='ArrowUp'?1:-1)));pdraw()}});
  draw();
  /* button on the Realm tab (next to Day / Night) that hides or shows every dev tool: both previewers, the avatar tap menu and the arrow-key shortcuts */
  const dtb=el('button','ghost','');dtb.type='button';dtb.id='devtoggle';
  const applyDev=()=>{
    if(!DEVON){$('dreset').onclick();$('dpreset').onclick()}   /* drop any preview so you see your real hero and companion */
    $('dev').hidden=!DEVON;$('devpet').hidden=!DEVON;
    dtb.textContent='Dev tools: '+(DEVON?'On':'Off');dtb.setAttribute('aria-pressed',DEVON?'true':'false');
  };
  dtb.onclick=()=>{DEVON=!DEVON;try{localStorage.setItem('dq.dev',DEVON?'1':'0')}catch(e){}applyDev()};
  $('reset').parentNode.insertBefore(dtb,$('reset'));
  applyDev();
}

/* depth: the hero scene shifts a little with the pointer / finger (layers move by different amounts) */
(function(){
  const st=document.querySelector('.stage');if(!st)return;
  const set=e=>{const r=st.getBoundingClientRect();st.style.setProperty('--tx',Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2)).toFixed(2))};
  st.addEventListener('pointermove',set);st.addEventListener('pointerdown',set);
  st.addEventListener('pointerleave',()=>st.style.setProperty('--tx',0));
  st.addEventListener('pointerup',()=>st.style.setProperty('--tx',0));
})();

/* one-time cleanup of the old offline cache (service worker was removed) */
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
}
if(window.caches){caches.keys().then(ks=>ks.forEach(k=>caches.delete(k))).catch(()=>{})}

/* ---------- Firebase cloud sync (email + password, one Firestore doc per user) ---------- */
const emptyState=s=>!s.tasks.length&&!s.xp&&!s.gold&&!s.look&&!s.name;
const docRef=()=>fb.db.collection('users').doc(user.uid);
function setMsg(m){syncMsg=m;['amsg','gmsg'].forEach(i=>{const a=$(i);if(a)a.textContent=m})}
function cloudConfigured(){return typeof firebaseConfig!=='undefined'&&!!firebaseConfig.apiKey&&!/^YOUR_/.test(firebaseConfig.apiKey)}
/* Cloud sync, modelled on the shiny tracker:
   - the cloud copy is the source of truth; a live listener applies every remote change straight away
   - no clocks or version numbers are compared (that is what broke before)
   - nothing is pushed until the first copy has been received, so a stale device can't overwrite a newer one
   - a plain "has the content actually changed?" check stops the two devices echoing each other */
const PEND='dq.pending';
function setPending(v){try{v?localStorage.setItem(PEND,'1'):localStorage.removeItem(PEND)}catch(e){}}
function isPending(){try{return localStorage.getItem(PEND)==='1'}catch(e){return false}}
function stable(o){return Array.isArray(o)?'['+o.map(stable).join(',')+']':(o&&typeof o==='object')?'{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+stable(o[k])).join(',')+'}':JSON.stringify(o)}
function sig(o){const c=Object.assign({},o);delete c.ts;delete c.ver;delete c.cloudUid;return stable(c)}
function queuePush(){dirty=true;clearTimeout(pushT);pushT=setTimeout(()=>{pushT=null;pushNow()},600)}
function flushPush(){clearTimeout(pushT);pushT=null;if(dirty&&user&&synced)pushNow()}
function pushNow(force){
  clearTimeout(pushT);pushT=null;
  if(!user||!fb||!synced||(emptyState(S)&&!force))return;
  const seq=saveSeq;
  S.cloudUid=user.uid;
  docRef().set({data:JSON.stringify(S),ts:S.ts||Date.now()})
    .then(()=>{
      if(seq===saveSeq){dirty=false;setPending(false)}   /* only "done" if nothing changed while it was uploading */
      setMsg('Saved to cloud at '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
    })
    .catch(e=>setMsg('Cloud save failed ('+(e.code||'error')+'). Your progress is still saved on this device.'));
}
function applyCloud(c){
  if(sig(c)===sig(S))return;                 /* identical content: nothing to do (also stops echo loops) */
  const keepLook=(!c.look&&!c.wiped&&S.look)?S.look:null;   /* never lose the hero's look because a copy came without one */
  const keepName=(!c.name&&!c.wiped&&S.name)?S.name:null;   /* same for the hero's name */
  const mig=!c.inv||!c.rv||!!OLDCLS[c.cls]||c.inv.some(i=>i.slot==='companion'&&PETMAP[i.pet]);
  S=Object.assign(fresh(),migrate(Object.assign({},c)));S.cloudUid=user.uid;
  if(keepLook)S.look=keepLook;
  if(keepName)S.name=keepName;
  if(keepLook||keepName||mig)save();
  S.tasks.forEach(t=>{if(!t.created)t.created=today()});
  TR=bsum('hp');
  try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}
  ensureBoss();process();render();
}
function onCloud(snap,first){
  if(!snap.exists){                          /* nothing in the cloud yet: seed it from this device */
    synced=true;
    if(!emptyState(S)){setPending(true);dirty=true;pushNow()}
    if(first){daily();setMsg('Synced');render()}
    return;
  }
  let c;try{c=JSON.parse(snap.data().data)}catch(e){return}
  if(emptyState(c)&&!c.wiped&&!emptyState(S)){   /* an empty cloud copy that wasn't a deliberate reset: keep our progress and restore it */
    synced=true;dirty=true;pushNow();
    if(first){daily();setMsg('Synced');render()}
    return;
  }
  if(first){
    synced=true;
    /* this device made changes the cloud never got (app closed / offline): send those up instead of discarding them.
       Same for progress made before this device was ever signed in, if it is newer than the cloud copy. */
    const unsent=isPending(),adopt=!S.cloudUid&&(S.ts||0)>(c.ts||0);
    if(!emptyState(S)&&(unsent||adopt)&&sig(c)!==sig(S)){dirty=true;pushNow();daily();setMsg('Synced');render();return}
    applyCloud(c);
    if(sig(c)===sig(S)){dirty=false;setPending(false)}
    daily();setMsg('Synced');render();
    if(dirty)pushNow();
    return;
  }
  if(dirty)return;                            /* one of our own changes is on its way up and will replace this copy */
  applyCloud(c);
}
function startSync(){
  stopSync();
  setMsg('Syncing...');
  if(S.cloudUid&&S.cloudUid!==user.uid){S=fresh();setPending(false);TR=0;render()}
  return new Promise(done=>{
    let first=true;
    unsub=docRef().onSnapshot(snap=>{
      if(!user||snap.metadata.hasPendingWrites)return;
      const f=first;first=false;
      try{onCloud(snap,f)}catch(e){console.error(e)}
      if(f)done();
    },err=>{
      setMsg('Sync error ('+(err.code||'error')+'). Your progress is still saved on this device. Retrying...');
      synced=false;
      if(first){first=false;done()}
      clearTimeout(retryT);retryT=setTimeout(()=>{if(user)startSync()},6000);   /* re-attach until the cloud answers */
    });
  });
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
  if(off){a.appendChild(el('div','sub','Cloud sync is not set up. Progress is saved on this device only.'));return}
  if(!user)return;
  const s=el('div','sub','Signed in as ');s.appendChild(el('b','',user.email));a.appendChild(s);
  const m=el('div','sub',syncMsg);m.id='amsg';a.appendChild(m);
  const o=el('button','ghost','Sign out');o.type='button';o.onclick=()=>fb.auth.signOut();a.appendChild(o);
}
function showGate(out){document.body.classList.remove('wait');document.body.classList.toggle('out',!!out);if(out&&creatorOpen&&creatorFirst)closeCreator()}
function initCloud(){
  setTimeout(()=>{document.body.classList.remove('wait');render()},4000);
  $('gicon').appendChild(px('🛡️',32));
  const ok=typeof firebase!=='undefined'&&cloudConfigured();
  if(!ok){acct(true);showGate(false);render();return}   /* cloud not set up (or SDK didn't load): daily() stays gated only if a config exists */
  try{firebase.initializeApp(firebaseConfig);fb={auth:firebase.auth(),db:firebase.firestore()}}catch(e){cloudOff=true;acct(true);showGate(false);daily();render();return}
  $('gin').onclick=()=>authAct('in');
  $('gup').onclick=()=>authAct('up');
  $('pw').onkeydown=e=>{if(e.key==='Enter')authAct('in')};
  fb.auth.onAuthStateChanged(u=>{
    user=u;synced=false;setMsg('');
    if(u){acct();startSync().then(()=>{showGate(false);render()})}   /* stay on the loading screen until the cloud save has been pulled */
    else{stopSync();acct();showGate(true)}
  });
  addEventListener('online',()=>{if(user&&dirty&&synced)pushNow()});
}
initCloud();

/* ---------- idle: pixel-level touches drawn straight onto the hero canvas (no scaling or bobbing) ----------
   Every few seconds each hero picks one effect at random: blink, glance sideways, weapon glint, weapon sway or hair sway.
   Only one effect runs at a time per canvas, and each one puts the original pixels back when it ends. */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const heroes=()=>[...document.querySelectorAll('#figure canvas,#ahero canvas')].filter(c=>c.offsetParent);
  const EX=[12,17],ER=11;   /* eye pixels on the 30px-wide hero canvas */
  const rgb=(d,f)=>'rgb('+Math.round(d[0]*f)+','+Math.round(d[1]*f)+','+Math.round(d[2]*f)+')';
  /* slide each row of a block sideways by off(row) pixels. clear: leave the gap transparent, otherwise stretch the neighbouring pixel into it.
     returns the untouched pixels so they can be put back */
  function shiftRows(x,x0,y0,w,h,off,clear){
    const src=x.getImageData(x0,y0,w,h),out=x.createImageData(w,h);
    for(let r=0;r<h;r++){
      const d=off(r);
      for(let q=0;q<w;q++){
        let s=q-d,gap=false;
        if(s<0||s>=w){s=q;gap=clear}
        for(let k=0;k<4;k++)out.data[(r*w+q)*4+k]=gap?0:src.data[(r*w+s)*4+k];
      }
    }
    x.putImageData(out,x0,y0);
    return src;
  }
  const FX={
    blink(c,x,done){   /* both eyes shut for a moment */
      if(c.dataset.noeye)return done();const ER=11+(+c.dataset.dy||0);
      const sk=x.getImageData(14,ER,1,1).data;
      if(!sk[3])return done();
      const saved=EX.map(ex=>x.getImageData(ex,ER,1,2));
      EX.forEach(ex=>{x.fillStyle=rgb(sk,1);x.fillRect(ex,ER,1,1);x.fillStyle=rgb(sk,.6);x.fillRect(ex,ER+1,1,1)});
      setTimeout(()=>{EX.forEach((ex,i)=>x.putImageData(saved[i],ex,ER));done()},140);
    },
    look(c,x,done){    /* glance to one side for a moment */
      if(c.dataset.noeye)return done();const ER=11+(+c.dataset.dy||0);
      const sk=x.getImageData(14,ER,1,1).data;
      if(!sk[3])return done();
      const dir=Math.random()<.5?-1:1,saved=x.getImageData(10,ER,10,2),eyes=EX.map(ex=>x.getImageData(ex,ER,1,2));
      x.fillStyle=rgb(sk,1);EX.forEach(ex=>x.fillRect(ex,ER,1,2));
      EX.forEach((ex,i)=>x.putImageData(eyes[i],ex+dir,ER));
      setTimeout(()=>{x.putImageData(saved,10,ER);done()},700+Math.random()*400);
    },
    glint(c,x,done){   /* a little star twinkles on the weapon tip (highest bright pixel on the right side) */
      const dy=+c.dataset.dy||0,d=x.getImageData(24,dy,5,23).data;
      let gx=-1,gy=-1;
      for(let r=1;r<23&&gx<0;r++)for(let q=0;q<5;q++){
        const i=(r*5+q)*4;
        if(d[i+3]>200&&d[i]+d[i+1]+d[i+2]>330){gx=24+q;gy=dy+r;break}
      }
      if(gx<0)return done();
      const saved=x.getImageData(gx-1,gy-1,3,3);
      x.fillStyle='#fff';x.fillRect(gx,gy,1,1);
      setTimeout(()=>{try{x.fillRect(gx-1,gy,3,1);x.fillRect(gx,gy-1,1,3)}catch(e){}},110);
      setTimeout(()=>{x.putImageData(saved,gx-1,gy-1);done()},330);
    },
    sway(c,x,done){    /* the weapon tip leans over by a pixel or two, pivoting at the hand */
      const dy=+c.dataset.dy||0,saved=shiftRows(x,24,dy,6,17,r=>r<4?2:r<10?1:0,true);
      setTimeout(()=>{x.putImageData(saved,24,dy);done()},450);
    },
    hair(c,x,done){    /* long hair, braids and pigtails flick outward by a pixel (short hair has nothing to move) */
      const dy=+c.dataset.dy||0,l=shiftRows(x,2,12+dy,9,7,()=>-1,false),r=shiftRows(x,19,12+dy,9,7,()=>1,false);
      setTimeout(()=>{x.putImageData(l,2,12+dy);x.putImageData(r,19,12+dy);done()},400);
    }
  };
  const WT=[['blink',40],['look',15],['glint',15],['sway',15],['hair',15]];
  const pick=()=>{let n=Math.random()*100;for(const [k,w] of WT){if((n-=w)<0)return k}return 'blink'};
  const tick=()=>{
    heroes().forEach(c=>{
      if(c._fx)return;
      c._fx=1;const done=()=>{c._fx=0};
      try{FX[pick()](c,c.getContext('2d'),done)}catch(e){done()}
    });
    setTimeout(tick,1500+Math.random()*2500);
  };
  setTimeout(tick,2000);
})();



/* hide / show the gear boxes around the hero (remembered between visits) */
(function(){
  const st=document.querySelector('.stage');if(!st)return;
  const b=document.createElement('button');b.type='button';b.className='ghost gearbtn';
  const set=h=>{st.classList.toggle('nogear',h);b.textContent=h?'Show gear':'Hide gear';b.setAttribute('aria-pressed',h?'true':'false')};
  let h=false;try{h=localStorage.getItem('dq.nogear')==='1'}catch(e){}
  set(h);
  b.onclick=()=>{h=!h;set(h);try{localStorage.setItem('dq.nogear',h?'1':'0')}catch(e){}};
  st.appendChild(b);
})();

/* ---------- idle: Fire Wolf Cub (pixel-level touches drawn straight onto the companion canvas, same idea as the hero idle) ----------
   Every few seconds the pup picks one at random: blink, wag its tail, or flick its ears. Each effect puts the original pixels back when it ends.
   Coordinates are on the 49x49 sprite canvas. */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const pups=()=>[...document.querySelectorAll('#fpet canvas,#apet canvas')].filter(c=>c.offsetParent&&c.parentNode&&String(c.parentNode.dataset.k||'').indexOf('pet:wolfpup')===0);
  /* slide each row of a block sideways by off(row) pixels (the gap keeps its own pixel). returns the untouched pixels */
  function shiftRows(x,x0,y0,w,h,off){
    const src=x.getImageData(x0,y0,w,h),out=x.createImageData(w,h);
    for(let r=0;r<h;r++){const d=off(r);for(let q=0;q<w;q++){let s=q-d;if(s<0||s>=w)s=q;for(let k=0;k<4;k++)out.data[(r*w+q)*4+k]=src.data[(r*w+s)*4+k]}}
    x.putImageData(out,x0,y0);return src;
  }
  const FX={
    blink(c,x,done){   /* the eye shuts for a moment */
      const ex=36,ey=14,saved=x.getImageData(ex,ey,3,3);
      x.fillStyle='#41455c';x.fillRect(ex,ey,3,3);
      x.fillStyle='#121318';x.fillRect(ex,ey+1,3,1);
      setTimeout(()=>{x.putImageData(saved,ex,ey);done()},150);
    },
    tail(c,x,done){   /* the tail tip swings out and back */
      const x0=0,y0=26,w=16,h=21,orig=x.getImageData(x0,y0,w,h),seq=[1,2,1,-1,0];let i=0;
      const step=()=>{
        x.putImageData(orig,x0,y0);
        if(i>=seq.length)return done();
        const d=seq[i++];if(d)shiftRows(x,x0,y0,w,h,r=>r>h*.45?d:0);
        setTimeout(step,130);
      };step();
    },
    ears(c,x,done){   /* both ears flick outward at the tip */
      const sl=shiftRows(x,28,0,9,10,r=>r<5?-1:0),sr=shiftRows(x,38,1,10,8,r=>r<4?1:0);
      setTimeout(()=>{x.putImageData(sl,28,0);x.putImageData(sr,38,1);done()},380);
    }
  };
  /* the flames never stop moving: every ~140 ms the canvas is redrawn with the next animation frame (skipped while another effect is running) */
  const FR=[0,1,2,3].map(p=>wolfpupCanvas(p)),SEQ=[0,1,2,3,2,1,3,0];let fi=0;
  const flick=()=>{
    const f=FR[SEQ[fi++%SEQ.length]];
    pups().forEach(c=>{if(c._fx)return;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);x.drawImage(f,0,0)});
    setTimeout(flick,110+Math.random()*80);
  };
  setTimeout(flick,900);
  const WT=[['blink',40],['tail',35],['ears',25]];
  const pick=()=>{let n=Math.random()*WT.reduce((a,t)=>a+t[1],0);for(const [k,w] of WT){if((n-=w)<0)return k}return 'blink'};
  const tick=()=>{
    pups().forEach(c=>{
      if(c._fx)return;
      c._fx=1;const done=()=>{c._fx=0};
      try{FX[pick()](c,c.getContext('2d'),done)}catch(e){done()}
    });
    setTimeout(tick,1200+Math.random()*2200);
  };
  setTimeout(tick,1800);
})();


/* ---------- idle: Wendigo drool (a strand stretches from a fang, a drop breaks off and falls to the ground; pixels are restored afterwards) ---------- */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const wens=()=>[...document.querySelectorAll('#fpet canvas,#apet canvas')].filter(c=>c.offsetParent&&c.parentNode&&String(c.parentNode.dataset.k||'').indexOf('pet:wendigo')===0);
  const drip=(c,x,done)=>{   /* a strand stretches from a fang, a drop breaks off, falls all the way to the ground and splats */
    const S=c.width/96,sc=v=>Math.max(1,Math.round(v*S)),px=Math.round((Math.random()<.5?35:31.2)*S),py=Math.round(62*S),
      gy=Math.round(92.5*S)-py,H=Math.min(Math.round(34*S),c.height-py),orig=x.getImageData(px-3,py,7,H);
    const COL='#8fd8f5',strand=[1,2,3,4,4].map(sc),fall=[5,9,14,20,27].map(v=>Math.round(v*S)).concat([gy-1]);
    let i=0;
    const step=()=>{
      x.putImageData(orig,px-3,py);
      const n=i++;x.fillStyle=COL;
      if(n<strand.length){
        const L=strand[n];x.fillRect(px,py,1,L);
        if(n===strand.length-1)x.fillRect(px,py+L,1,2);   /* the drop hangs at the end */
        return setTimeout(step,200);
      }
      const k=n-strand.length;
      if(k<fall.length){x.fillRect(px,Math.min(py+fall[k],py+H-2),1,2);return setTimeout(step,70)}
      if(k===fall.length){const y=Math.min(py+gy,py+H-1);x.fillRect(px-2,y,1,1);x.fillRect(px+2,y,1,1);x.fillRect(px-1,y-1,1,1);x.fillRect(px+1,y-1,1,1);return setTimeout(step,220)}   /* splat on the ground */
      done();
    };step();
  };
  const tick=()=>{
    wens().forEach(c=>{
      if(c._dr)return;
      c._dr=1;const done=()=>{c._dr=0};
      try{drip(c,c.getContext('2d'),done)}catch(e){done()}
    });
    setTimeout(tick,3500+Math.random()*4000);
  };
  setTimeout(tick,2500);
})();

/* ---------- idle: Wendigo (extra pixel-level touches drawn straight onto the companion canvas) ----------
   Works alongside the drool effect in script.js: both share the canvas flag c._dr, so only one effect runs at a time.
   Every few seconds the Wendigo picks one at random: blink, eyes flare,
   an ear twitch, or a puff of frosty breath. Each effect puts the original pixels back when it ends. */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const wens=()=>[...document.querySelectorAll('#fpet canvas,#apet canvas')].filter(c=>c.offsetParent&&c.parentNode&&String(c.parentNode.dataset.k||'').indexOf('pet:wendigo')===0);
  const near=(d,i,r,g,b,t)=>d[i+3]>150&&Math.abs(d[i]-r)<t&&Math.abs(d[i+1]-g)<t&&Math.abs(d[i+2]-b)<t;

  /* finds the burning eye pixels (orange + pale highlight) inside the eye area */
  function eyes(c,x){
    const S=c.width/96,x0=Math.round(20*S),y0=Math.round(38*S),
      w=Math.min(c.width-x0,Math.round(26*S)),h=Math.min(c.height-y0,Math.round(14*S)),
      saved=x.getImageData(x0,y0,w,h),d=saved.data,p=[];
    for(let r=0;r<h;r++)for(let q=0;q<w;q++){
      const i=(r*w+q)*4;
      if(near(d,i,255,90,42,34)||near(d,i,255,230,168,34))p.push([q,r]);
    }
    return {x0,y0,w,h,saved,p};
  }

  const FX={
    blink(c,x,done){   /* the eyes go dark for a moment (sometimes twice) */
      const e=eyes(c,x);if(!e.p.length)return done();
      const dark=()=>{x.fillStyle='#2a1214';e.p.forEach(p=>x.fillRect(e.x0+p[0],e.y0+p[1],1,1))},
        open=()=>x.putImageData(e.saved,e.x0,e.y0),twice=Math.random()<.3;
      dark();
      setTimeout(()=>{
        open();
        if(!twice)return done();
        setTimeout(()=>{dark();setTimeout(()=>{open();done()},130)},140);
      },150);
    },
    flare(c,x,done){   /* the eyes flare bright and the sockets glow orange around them */
      const e=eyes(c,x);if(!e.p.length)return done();
      const d=e.saved.data,set=new Set(e.p.map(p=>p[1]*e.w+p[0]));
      x.fillStyle='#ff5a2a';
      e.p.forEach(p=>[[1,0],[-1,0],[0,1],[0,-1]].forEach(o=>{
        const q=p[0]+o[0],r=p[1]+o[1];
        if(q<0||r<0||q>=e.w||r>=e.h||set.has(r*e.w+q))return;
        if(near(d,(r*e.w+q)*4,42,18,20,50))x.fillRect(e.x0+q,e.y0+r,1,1);
      }));
      x.fillStyle='#ffe6a8';e.p.forEach(p=>x.fillRect(e.x0+p[0],e.y0+p[1],1,1));
      setTimeout(()=>{x.putImageData(e.saved,e.x0,e.y0);done()},650);
    },
    ear(c,x,done){   /* one ear (picked at random) twitches outward a pixel or two and back; only the ear's own pixels move */
      const S=c.width/96,left=Math.random()<.5,dir=left?-1:1,
        b=(left?[14,29,10,13]:[43,27,9,14]).map(v=>Math.round(v*S)),
        x0=b[0],y0=b[1],w=Math.min(c.width-x0,b[2]),h=Math.min(c.height-y0,b[3]);
      if(w<2||h<2)return done();
      const orig=x.getImageData(x0,y0,w,h),d=orig.data,mask=new Uint8Array(w*h);
      /* ear skin is a low-saturation grey; antlers, bone and fur are warmer or brighter, so they are left alone */
      for(let k=0;k<w*h;k++){
        const i=k*4;if(d[i+3]<150)continue;
        const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]),av=(d[i]+d[i+1]+d[i+2])/3;
        if(mx-mn<32&&av>85&&av<225)mask[k]=1;
      }
      /* the dark outline touching the ear moves with it */
      const ring=[];
      for(let r=0;r<h;r++)for(let q=0;q<w;q++){
        const k=r*w+q,i=k*4;if(mask[k]||d[i+3]<150||d[i]+d[i+1]+d[i+2]>135)continue;
        if([[1,0],[-1,0],[0,1],[0,-1]].some(o=>{const qq=q+o[0],rr=r+o[1];return qq>=0&&rr>=0&&qq<w&&rr<h&&mask[rr*w+qq]===1}))ring.push(k);
      }
      ring.forEach(k=>{mask[k]=1});
      let n=0;for(let k=0;k<mask.length;k++)n+=mask[k];
      if(n<6)return done();
      const rowShift=(r,dx)=>r<h*.4?dx:r<h*.7?(dx>1?1:0):0;   /* the tip moves most, the base stays put */
      const frame=dx=>{
        const out=x.createImageData(w,h),o=out.data;o.set(d);
        const mv=[];
        for(let r=0;r<h;r++){const sh=rowShift(r,dx);if(!sh)continue;for(let q=0;q<w;q++){const k=r*w+q;if(mask[k]){mv.push([q,r,sh]);o[k*4+3]=0}}}
        mv.forEach(m=>{const nq=m[0]+dir*m[2];if(nq<0||nq>=w)return;const s=(m[1]*w+m[0])*4,t=(m[1]*w+nq)*4;for(let j=0;j<4;j++)o[t+j]=d[s+j]});
        x.putImageData(out,x0,y0);
      };
      const seq=[1,2,0,2,1,0];let i=0;
      const step=()=>{
        if(i>=seq.length){x.putImageData(orig,x0,y0);return done()}
        frame(seq[i++]);setTimeout(step,95);
      };step();
    },
    breath(c,x,done){   /* a puff of frosty breath leaves the snout, grows and fades (only drawn over empty space) */
      const S=c.width/96,u=Math.max(1,Math.round(S)),sx=Math.round(29*S),sy=Math.round(62*S),
        cols=['#dff4fa','#bfe6f2','#bfe6f2','#8fb8c8','#6f8fa0'];
      let i=0,drawn=[];
      const clear=()=>{drawn.forEach(p=>x.clearRect(p[0],p[1],1,1));drawn=[]};
      const step=()=>{
        clear();
        if(i>=cols.length)return done();
        const sz=(1+(i>>1))*u,bx=sx-Math.round(i*.6*u),by=sy+Math.round(i*1.4*u);
        x.fillStyle=cols[i];
        for(let a=0;a<sz;a++)for(let b=0;b<sz;b++){
          const px=bx+a,py=by+b;
          if(px<0||py<0||px>=c.width||py>=c.height)continue;
          if(x.getImageData(px,py,1,1).data[3]===0){x.fillRect(px,py,1,1);drawn.push([px,py])}
        }
        i++;setTimeout(step,170);
      };step();
    }
  };
  const WT=[['blink',30],['flare',15],['ear',20],['breath',20]];
  const pick=()=>{let n=Math.random()*WT.reduce((a,t)=>a+t[1],0);for(const [k,w] of WT){if((n-=w)<0)return k}return 'blink'};
  const tick=()=>{
    wens().forEach(c=>{
      if(c._dr)return;   /* busy: drool or another idle effect is running */
      c._dr=1;const done=()=>{c._dr=0};
      try{FX[pick()](c,c.getContext('2d'),done)}catch(e){done()}
    });
    setTimeout(tick,2000+Math.random()*3000);
  };
  setTimeout(tick,3000);
})();
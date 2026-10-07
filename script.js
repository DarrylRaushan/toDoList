const KEY='dailyQuests.v1';
let user=null,fb=null,pushT=null,unsub=null,syncMsg='';
const BONUS=25;
const RANKS=[['Peasant','🌾'],['Page','📜'],['Squire','🗡️'],['Recruit','🪖'],['Adventurer','🧭']];
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
let TR=0,QT='today';   /* QT = selected tab on the quest board */
/* ---- balance: small HP pool, penalties and XP both grow with level ---- */
const hpBase=l=>12+3*(l-1);                          /* max HP before trinkets: 12 at Lv 1 */
const maxHp=l=>hpBase(l)+2*TR;                       /* each trinket tier +2 */
const lscale=l=>1+(l-1)/4;                           /* x1 at Lv 1, x2 at Lv 5, x3.25 at Lv 10 */
const PEN={10:1,20:3,40:5};                          /* HP lost per missed quest at Lv 1: easy / medium / hard */
const penBase=xp=>PEN[xp]||Math.max(1,Math.round(xp/8));
const penalty=xp=>Math.max(1,Math.round(penBase(xp)*lscale(levelOf(S.xp))*dmgMult()));
const xpGain=xp=>Math.round(xp*lscale(levelOf(S.xp))*mult());
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
function px(e,n){const c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');x.font=Math.round(n*.78)+'px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,n/2,n/2+1);c.className='px';return c}

/* ---------- pixel-art hero ----------
   Levels 1-4: generic look that changes a little every level.
   Level 5: pick a class. From then on your gear changes EVERY level:
   lv5 starter (wood/leather) -> lv15 legendary gold. 30x30 bust or 30x40 full body, auto-outlined. */
const MATS=['#8b6b43','#8e9ab0','#c3ccda','#4aa8d8','#e8b93c','#f6d56a'];   /* leather, iron, steel, mythril, gold, legendary */
const BLADE=['#a8824a','#aab3c2','#e4eaf4','#8fe3f5','#f0c040','#fff1a8'];     /* wood, iron, steel, mythril, gold, legendary */
const PAL_RANK=[
['#6b4a2b','#8b6b43','#c2412f','#5b4636','#3a2a1c'],
['#3a2a1c','#4a78c2','#e8e0c8','#3e3e5a','#2a2018'],
['#b8742f','#6a8f4e','#d8d0b0','#5a4a3a','#2a2018'],
['#3a2a1c','#7a6a4a','#8a5a2a','#4a3a28','#2a1c10']
];
const TUN={ /* body colour per gear tier (0-5) */
warrior:MATS,
mage:['#7a5a98','#3a6ac0','#6a3ab0','#2a4a9a','#4a2a8a','#eae0ff'],
rogue:['#6a5a3a','#3a5a40','#2a3a30','#22262e','#1a1a22','#16141c'],
cleric:['#e4dcc4','#efe6cc','#f4efd0','#f8f4e0','#fffbea','#ffffff']
};
/* body build: half-width (body + arms) at given rows, y=17 shoulders .. y=36 hips. Each build has its OWN silhouette. */
const BUILDS={
  slim:  [[17,5.6],[20,6.2],[24,6.6],[36,6.6]],                         /* narrow tube, small shoulders */
  avg:   [[17,6.8],[20,8.2],[24,9],[36,9]],                             /* normal */
  strong:[[17,9.2],[19,10.6],[24,10.4],[28,9.6],[36,9.2]],              /* broad shoulders, big arms, tapered waist */
  heavy: [[17,6.6],[20,8.6],[24,11.6],[27,12.6],[36,12.6]]              /* sloped shoulders, wide round belly */
};
const ARMW={slim:1.5,avg:2.2,strong:3.2,heavy:2.8};   /* arm thickness (for the arm/torso seam) */
const HAIRC={warrior:'#5a3a22',mage:'#d8d8e8',rogue:'#2a2220',cleric:'#c88a3a'};
function hexMul(h,f){const n=parseInt(h.slice(1),16);return '#'+[16,8,0].map(s=>Math.max(0,Math.min(255,Math.round(((n>>s)&255)*f))).toString(16).padStart(2,'0')).join('')}
/* stage 0-10 = level 5-15 (capped). tier m = stage>>1 picks the material: leather, iron, steel, mythril, gold, legendary */
function bustGrid(lv,cls,full,look){
  const W=30,Hh=full?40:30;let G=Array.from({length:Hh},()=>Array(W).fill(null));
  const P=(x,y,c)=>{y+=2;if(x>=0&&y>=0&&x<W&&y<Hh)G[y][x]=c};
  const R=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let k=0;k<w;k++)P(x+k,y+j,c)};
  const MR=(x,y,w,h,c)=>{R(x,y,w,h,c);R(W-x-w,y,w,h,c)};
  const MP=(x,y,c)=>{P(x,y,c);P(W-1-x,y,c)};
  const s=cls?Math.max(0,Math.min(10,lv-5)):0,m=s>>1,gi=Math.min(lv,4)-1,id=cls||gi,M=hexMul;
  const lk=look||null,hair=lk?lk.hairC:cls?HAIRC[cls]:PAL_RANK[gi][0],tun=cls?TUN[cls][m]:PAL_RANK[gi][1];
  const mix=(a,b,t)=>{const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);return '#'+[16,8,0].map(q=>Math.round(((x>>q)&255)*(1-t)+((y>>q)&255)*t).toString(16).padStart(2,'0')).join('')};
  const bk=lk&&BUILDS[lk.build]?lk.build:'avg',BP=BUILDS[bk];   /* build */
  const hwAt=y=>{y=Math.max(17,Math.min(36,y));for(let i=1;i<BP.length;i++)if(y<=BP[i][0]){const a=BP[i-1],b=BP[i];return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0])}return BP[BP.length-1][1]};
  const GOLD='#e8b93c',RED='#d63a47',WH='#f4efd0',BR='#6a4a2a',SK=lk?lk.skin:'#f0c49a',SKD=M(SK,.85),INK='#2a1c14',cx=14.5;
  const bot=full?36:28,base=M(tun,.9),D=M(tun,.7),L=M(tun,1.25),SKS=[SK,M(SK,.88),M(SK,.9)];
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
      const q=Math.round(cx-(hwAt(y)+fy(y)-ARMW[bk])),c0=(G[y+2]||[])[q],c1=(G[y+2]||[])[29-q];
      if(c0)P(q,y,M(c0,.78));if(c1)P(29-q,y,M(c1,.78));
    }
  };
  const cape=(col,trim)=>{for(let y=18;y<bot;y++){const hw=Math.min(14.4,hwAt(y)+1+(y-18)*.2);for(let x=0;x<W;x++){const dx=Math.abs(x-cx);if(dx>hw||y>bot-.5-dx*.12)continue;P(x,y,trim&&dx>hw-1.3?trim:ramp(col,x<cx-3?1:x>cx+3?-1:0))}}};
  const halo=(w,c,dy)=>{const x0=Math.round(cx-w/2+.5),y=-2+(dy||0);R(x0+1,y,w-2,1,c);P(x0,y+1,c);P(x0+w-1,y+1,c);R(x0+1,y+2,w-2,1,c)};
  /* ---- things behind the body ---- */
  if(cls==='warrior'&&s>=7)cape(s>=10?'#c2282e':'#a8283a',s>=8?GOLD:null);
  if(cls==='mage'&&s>=7){cape(s>=10?'#4a3a9a':'#262a6a',s>=8?GOLD:null);[[5,24],[24,22],[7,29],[22,30],[4,20],[25,26]].forEach(p=>P(p[0],p[1]-3,'#fff3b0'))}
  if(cls==='rogue'&&s>=6)cape(s>=8?'#16141c':'#1e3a3a',s>=8?GOLD:null);
  if(cls==='cleric'&&s>=10){
    [[5,6],[7,8],[8,9],[8,9],[7,8],[6,6],[4,4]].forEach((r,k)=>{const y=11+k*2,w=r[1];MR(6-w,y,w,2,k<2?'#ffffff':'#f0e6d0');MR(6-w,y,1,2,k%2?GOLD:'#fff3b0')});
  }
  if(id==='rogue')for(let y=0;y<19;y++)for(let x=0;x<W;x++){               /* hood back */
    let u=(x-cx)/10;const v=(y-8.5)/10;if(y<8.5)u/=.65+.35*(y/8.5);
    const d=u*u+v*v;if(d<=1)P(x,y,ramp(base,Math.round((-.6*u-.7*v)*1.6)-(d>.8?1:0)));
  }
  /* ---- clothing ---- */
  const BODY={
    0:()=>{body(tun,7,.7,11);sR(8,21,3,3,M(tun,1.3));sP(8,21,D);sP(10,23,D);sP(14,19,'#c2a46a');sP(15,19,'#c2a46a');sR(8,27,14,1,'#c2a46a')},
    1:()=>{body(tun,7,.75,11);sR(11,17,8,1,WH);sR(12,18,6,1,WH);sR(13,19,4,1,WH);[22,25].forEach(y=>sMP(14,y,GOLD));sR(8,27,14,1,D)},
    2:()=>{body(tun,7,.75,11);sR(11,17,8,2,WH);for(let k=0;k<9;k++)sR(9+k,19+k,2,1,BR);sR(8,27,14,1,BR);sP(15,23,GOLD)},
    3:()=>{body(tun,7,.8,11);sR(11,17,8,1,'#c2a46a');sMR(3,17,5,2,M(tun,1.2));sR(8,27,14,1,BR);sR(14,26,2,2,GOLD);[[10,21],[19,21],[10,24],[19,24]].forEach(p=>sP(p[0],p[1],M(tun,.6)))},
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
  BODY[id]();
  /* ---- head ---- */
  R(13,16,4,2,SKD);
  const FACE={
    oval:()=>{R(10,6,10,9,SK);R(11,5,8,1,SK);R(11,15,8,1,SK);R(9,9,1,2,SK);R(20,9,1,2,SK)},
    round:()=>{R(9,6,12,9,SK);R(10,5,10,1,SK);R(10,15,10,1,SK);R(8,9,1,2,SK);R(21,9,1,2,SK)},
    square:()=>{R(10,5,10,11,SK);R(9,9,1,2,SK);R(20,9,1,2,SK)},
    long:()=>{R(10,6,10,10,SK);R(11,5,8,1,SK);R(11,16,8,1,SK);R(9,9,1,2,SK);R(20,9,1,2,SK)},
    heart:()=>{R(11,5,8,1,SK);R(10,6,10,4,SK);R(11,10,8,2,SK);R(12,12,6,2,SK);R(13,14,4,1,SK);R(14,15,2,1,SK);R(9,8,1,2,SK);R(20,8,1,2,SK)}
  };
  FACE[(lk&&lk.face)||'oval']();
  for(let y=3;y<=17;y++){let rx=-1;for(let x=0;x<W;x++)if((G[y+2]||[])[x]===SK)rx=x;if(rx>0)P(rx,y,M(SK,.9))}   /* shade right edge */
  for(let x=0;x<W;x++){let by=-1;for(let y=3;y<=18;y++)if((G[y+2]||[])[x]===SK)by=y;if(by>0)P(x,by,M(SK,.88))}   /* shade chin */
  const skin=(x,y)=>(G[y+2]||[])[x]&&SKS.includes(G[y+2][x]);
  const hs=lk?lk.hair:{0:'crop',1:'bowl',2:'messy',3:'crop',warrior:'short',mage:'long',rogue:'messy',cleric:'long'}[id];
  const HAIR={
    bald:()=>{P(13,4,M(SK,1.15));P(14,4,M(SK,1.15))},
    crop:()=>{R(10,4,10,2,hair);R(9,5,1,4,hair);R(20,5,1,4,hair);R(11,6,3,1,hair);R(17,6,2,1,hair)},
    bowl:()=>{R(9,4,12,3,hair);R(9,7,1,4,hair);R(20,7,1,4,hair);R(10,4,6,1,M(hair,1.35))},
    messy:()=>{R(10,4,10,2,hair);[10,12,15,17,19].forEach(x=>P(x,3,hair));R(9,5,1,3,hair);R(20,5,1,3,hair);R(11,6,2,1,hair);R(16,6,3,1,hair)},
    short:()=>{R(10,4,10,2,hair);R(9,5,1,3,hair);R(20,5,1,3,hair);R(11,6,2,1,hair);R(17,6,2,1,hair)},
    spiky:()=>{R(10,4,10,2,hair);R(9,5,1,3,hair);R(20,5,1,3,hair);[10,13,16,18].forEach(x=>R(x,2,2,2,hair));[11,17].forEach(x=>P(x,1,hair));P(14,3,hair);R(11,6,2,1,hair)},
    slick:()=>{R(10,4,10,2,hair);R(9,5,1,3,hair);R(20,5,1,3,hair);R(11,4,4,1,M(hair,1.45))},
    long:()=>{R(10,4,10,3,hair);R(8,5,2,12,hair);R(20,5,2,12,hair);R(8,5,1,12,M(hair,1.3));R(21,5,1,12,M(hair,.75));R(11,6,3,1,hair);R(16,6,3,1,hair)}
  };
  HAIR[hs]();
  /* ---- face ---- */
  const ang=id==='warrior',mask=id==='rogue'&&s>=3,bw=M(hair,.8);
  const ec=id==='rogue'&&s>=10?'#ffd75a':lk?lk.eyes:({1:'#4a78c2',2:'#3a7a4a',3:'#7a5a2a',mage:'#3a8fe0',cleric:'#3a8a5a'}[id]||INK);
  if(ang){MP(11,7,bw);MP(12,7,bw);MP(13,8,bw)}else MR(11,8,3,1,bw);
  if(id==='cleric'&&!lk)MR(11,10,2,1,INK);else MR(12,9,1,2,ec);
  R(14,11,2,2,M(SK,.88));R(14,12,2,1,M(SK,.7));
  [10,19].forEach(x=>{if(skin(x,12))P(x,12,mix(SK,'#e86a6a',.3))});
  const scar=lk?lk.scar:'none',sc=mix(SK,'#8a1e2e',.72);
  const SCAR={cheek:[[11,10],[11,11],[12,12],[12,13]],eye:[[16,6],[16,7],[17,8],[17,9],[18,10],[18,11]],brow:[[13,7],[12,7],[11,7],[10,8],[10,9]],mouth:[[17,12],[18,13],[18,14]]};
  (scar==='battle'?['cheek','brow','mouth']:scar==='none'?[]:[scar]).forEach(k=>SCAR[k].forEach(p=>{if(skin(p[0],p[1]))P(p[0],p[1],sc)}));
  if(!lk&&id===2)[[10,11],[12,12],[11,13]].forEach(p=>MP(p[0],p[1],'#c98a5a'));
  if(!lk&&id==='warrior')MR(10,11,3,1,RED);
  /* beard (drawn before the mouth so the mouth shows on top) */
  const bs=lk?lk.beard:id==='mage'?'sage':id===0?'stubble':'none',bc=hair,bcd=M(hair,.7);
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
    }
  };
  (BEARD[bs]||BEARD.none)();
  if(!mask)R(13,14,4,1,mix(SK,'#8a2a2a',.5));
  if(mask)R(10,12,10,4,M(base,.55));
  /* ---- headgear: changes at every stage ---- */
  const HG={
    0:()=>{R(11,0,8,4,'#d8b86a');R(12,-1,6,1,'#d8b86a');R(11,3,8,1,'#c2412f');R(5,4,20,1,'#b8923c');R(12,0,3,1,'#f0d890');R(10,5,10,1,M(SK,.7))},
    1:()=>{R(7,2,15,3,tun);R(9,1,11,1,tun);R(10,0,8,1,L);R(9,4,12,1,D);R(21,-2,1,6,WH);R(22,-1,1,4,M(WH,.8))},
    2:()=>{R(9,5,12,1,'#c2412f');R(21,5,2,2,'#c2412f');R(22,7,1,3,'#c2412f')},
    3:()=>{R(9,3,12,3,'#7a5a3a');R(9,5,12,1,'#4a3a28');R(10,3,10,1,'#9a7a52');R(8,5,1,3,'#7a5a3a');R(21,5,1,3,'#7a5a3a');P(14,2,'#9a7a52');P(15,2,'#9a7a52')},
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
  HG[id]();
  /* ---- full body: boots, hands, weapon ---- */
  if(full){
    const bt=cls==='warrior'?M(MATS[m],.5):M(base,.35),DG='#dfe6f2';
    R(10,36,4,2,bt);R(16,36,4,2,bt);R(10,36,4,1,M(bt,1.6));R(16,36,4,1,M(bt,1.6));
    const G0=G;G=Array.from({length:Hh},()=>Array(W).fill(null));   /* layer: hands, shield, weapon */
    R(5,22,2,2,SK);
    const dagger=(x,len,B,gc)=>{                                        /* x = blade column of a right-hand dagger */
      R(x,21-len,1,len,B);P(x,20-len,M(B,1.3));R(x-1,21,3,1,gc);R(x,22,1,3,BR);R(x-1,22,3,2,SK);
    };
    const WP={
      pitch:()=>{R(25,12,1,24,'#7a5a2a');R(23,10,1,4,'#9aa4b4');R(25,9,1,4,'#9aa4b4');R(27,10,1,4,'#9aa4b4');R(23,13,5,1,'#9aa4b4');R(24,22,3,2,SK)},
      stick:()=>{R(25,14,1,10,'#a8824a');R(24,22,3,2,SK)},
      wood:()=>{R(25,10,2,11,'#a8824a');P(25,9,'#c2a068');R(24,21,4,1,BR);R(25,22,1,3,BR);R(24,22,3,2,SK)},
      warrior:()=>{
        const B=BLADE[m],BL=M(B,1.25),len=11+m,y0=21-len,gc=m>=4?GOLD:MATS[Math.min(m,3)];
        /* shield (left arm) */
        const sc=MATS[m],sd=M(sc,.6),sl=M(sc,1.35);
        [8,8,8,8,7,6,5,3,1].forEach((w,j)=>{const x0=1+((8-w)>>1);R(x0,21+j,w,1,sc);P(x0,21+j,sd);P(x0+w-1,21+j,sd)});
        R(1,21,8,1,m>=4?GOLD:sd);
        R(4,23,2,2,m===0?'#aab3c2':sl);
        if(m>=2){R(4,22,2,7,sl);R(2,25,6,1,sl)}
        if(m>=4){R(1,21,1,5,GOLD);R(8,21,1,5,GOLD)}
        if(m>=5){R(4,24,2,2,RED)}
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
        if(s>=4){                                                        /* second dagger, mirrored */
          const x=4;R(x,21-len,1,len,B);P(x,20-len,M(B,1.3));R(x-1,21,3,1,gc);R(x,22,1,3,BR);R(x-1,22,3,2,SK);
          if(m>=5)R(x,21-len+1,1,len-2,'#fff');
        }
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
    const wp=cls||{0:'pitch',2:'stick',3:'wood'}[id];
    if(wp)WP[wp]();else R(23,22,2,2,SK);
    const dxh=Math.round(hwAt(22)-10.75);
    for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const v=G[y][x];if(!v)continue;const nx=x<15?x-dxh:x+dxh;if(nx>=0&&nx<W)G0[y][nx]=v}
    G=G0;
  }
  const Q=G.map(r=>r.slice());
  for(let y=0;y<Hh;y++)for(let x=0;x<W;x++)if(!G[y][x]&&((G[y-1]||[])[x]||G[y][x-1]||G[y][x+1]||(G[y+1]||[])[x]))Q[y][x]='#0a0812';
  if(cls&&s>=10){                                                         /* legendary sparkles (drawn outside the outline) */
    const sp=(x,y,c)=>{y+=2;if(y>=0&&y<Hh&&x>=0&&x<W&&!Q[y][x])Q[y][x]=c};
    const pts=lv>=20?[[2,6],[27,4],[3,16],[27,14],[1,26],[28,24],[6,1]]:[[2,8],[27,6],[3,20],[27,18]];
    if(lv>=30)pts.push([9,0],[21,0],[0,12],[29,10]);
    if(lv>=50)pts.push([4,32],[26,30],[0,20],[29,18]);
    pts.forEach(p=>{sp(p[0],p[1],'#fff3b0');sp(p[0]-1,p[1],'rgba(255,240,170,.55)');sp(p[0]+1,p[1],'rgba(255,240,170,.55)');sp(p[0],p[1]-1,'rgba(255,240,170,.55)');sp(p[0],p[1]+1,'rgba(255,240,170,.55)')});
  }
  return Q;
}
let PV=null; /* dev preview override: {lv,cls,n} or null */
function gridCanvas(O,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;c.className='px';
  const x=c.getContext('2d');
  for(let y=0;y<h;y++)for(let k=0;k<w;k++){const f=O[y][k];if(f){x.fillStyle=f;x.fillRect(k,y,1,1)}}
  return c;
}
function heroPx(lv,head,look){
  const lk=look||S.look||null,g=PV?[PV.lv,PV.cls]:[lv,S.cls];
  return gridCanvas(bustGrid(g[0],g[1],!head,lk),30,head?30:40);
}

/* ---------- character creator ---------- */
const DEF_LOOK={skin:'#f0c49a',face:'oval',hair:'crop',hairC:'#6b4a2b',eyes:'#2a1c14',beard:'none',scar:'none',build:'avg'};
const OPT={
  skin:['Skin',[['#f6d3b0','Fair'],['#f0c49a','Light'],['#d9a577','Tan'],['#b87f55','Brown'],['#8a5a3a','Deep'],['#5e3b26','Dark']]],
  face:['Face shape',[['oval','Oval'],['round','Round'],['square','Square'],['long','Long'],['heart','Pointed']]],
  hair:['Hair style',[['bald','Bald'],['short','Short'],['crop','Crop'],['messy','Messy'],['bowl','Bowl'],['spiky','Spiky'],['slick','Slick'],['long','Long']]],
  hairC:['Hair colour',[['#1e1e24','Black'],['#3a2a1c','Dark brown'],['#6b4a2b','Brown'],['#8a3a2a','Auburn'],['#c2682f','Ginger'],['#d9b968','Blonde'],['#c8ccd8','Silver'],['#f2f2f2','White'],['#3a6ad0','Blue'],['#8a4ad0','Purple']]],
  eyes:['Eyes',[['#2a1c14','Brown'],['#4a78c2','Blue'],['#3a8a5a','Green'],['#8a6a2a','Hazel'],['#8a93a6','Grey'],['#8a4ad0','Violet']]],
  beard:['Beard',[['none','None'],['stubble','Stubble'],['mustache','Moustache'],['goatee','Goatee'],['short','Short'],['full','Full'],['sage','Sage (grows)']]],
  scar:['Scars',[['none','None'],['cheek','Cheek'],['eye','Eye'],['brow','Brow'],['mouth','Mouth'],['battle','Battle-worn']]],
  build:['Build',[['slim','Slim'],['avg','Average'],['strong','Strong'],['heavy','Heavy']]]
};
const SWATCH=['skin','hairC','eyes'];
let CK=null,CG='mine',creatorOpen=false,creatorFirst=false;
function drawCreator(){
  const lv=levelOf(S.xp),g=CG==='mine'?[lv,S.cls]:CG==='l1'?[1,null]:[15,CG];
  $('cprev').replaceChildren(gridCanvas(bustGrid(g[0],g[1],true,CK),30,40));
  document.querySelectorAll('#copts [data-k]').forEach(b=>b.classList.toggle('on',(b.dataset.k==='gear'?CG:CK[b.dataset.k])===b.dataset.v));
}
function buildCreator(){
  const box=$('copts');box.innerHTML='';
  const add=(k,lab,items,sw)=>{
    const row=el('div','copt'),w=el('div','copts');row.appendChild(el('h4','',lab));
    items.forEach(([v,n])=>{
      const b=el('button',sw?'o sw':'o',sw?'':n);b.type='button';b.dataset.k=k;b.dataset.v=v;b.title=n;b.setAttribute('aria-label',lab+': '+n);
      if(sw)b.style.background=v;
      b.onclick=()=>{if(k==='gear')CG=v;else CK[k]=v;drawCreator()};
      w.appendChild(b);
    });
    row.appendChild(w);box.appendChild(row);
  };
  Object.keys(OPT).forEach(k=>add(k,OPT[k][0],OPT[k][1],SWATCH.includes(k)));
  add('gear','Try on gear',[['mine','My gear'],['l1','Level 1'],...Object.keys(CLS).map(k=>[k,CLS[k].n[0]+' Lv 15'])],false);
}
function openCreator(first){
  creatorOpen=true;creatorFirst=!!first;CG='mine';
  CK=Object.assign({},DEF_LOOK,S.look||{});
  $('ctitle').textContent=first?'Create your hero':'Edit your hero';
  $('ccancel').hidden=!!first;
  buildCreator();drawCreator();
  $('creator').hidden=false;document.body.classList.add('creating');$('creator').scrollTop=0;
}
function closeCreator(){creatorOpen=false;$('creator').hidden=true;document.body.classList.remove('creating')}
function maybeCreator(){
  const b=document.body.classList;
  if(S.look){if(creatorOpen&&creatorFirst)closeCreator();return}
  if(!creatorOpen&&!b.contains('out')&&!b.contains('wait'))openCreator(true);
}
function initCreator(){
  $('editchar').onclick=()=>openCreator(false);
  $('ccancel').onclick=closeCreator;
  $('crand').onclick=()=>{Object.keys(OPT).forEach(k=>{const a=OPT[k][1];CK[k]=a[Math.floor(Math.random()*a.length)][0]});drawCreator()};
  $('cdone').onclick=()=>{S.look=Object.assign({},CK);save();closeCreator();render();toast('Your hero is ready')};
}

function fresh(){return {tasks:[],done:{},perfect:{},bonus:{},award:{},xp:0,badges:{},hp:hpBase(1),lastDay:addDays(today(),-1),log:[],defeats:0,gold:0,gAward:{},gear:{weapon:0,armor:0,helm:0,trinket:0},cls:null,chests:0,boss:null,look:null}}
function load(){
  let s={};try{s=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){}
  const hadHp=s.hp!=null;
  s=Object.assign(fresh(),s);
  s.tasks.forEach(t=>{if(!t.created)t.created=today()});
  if(!hadHp)s.hp=maxHp(levelOf(s.xp));
  else{const cap=hpBase(levelOf(s.xp))+2*(s.gear&&s.gear.trinket||0);if(s.hp>cap)s.hp=cap}
  return s;
}
function save(){S.ts=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(user)queuePush()}
let S=load();TR=S.gear.trinket;
let shown=today();

function streak(){
  let d=today(),n=0,g=0;
  if(!S.perfect[d])d=addDays(d,-1);
  const rest=k=>!S.tasks.some(t=>t.created<=k&&active(t,k));   /* nothing scheduled that day: doesn't break the streak */
  while(g++<730){
    if(S.perfect[d])n++;
    else if(!rest(d))break;
    d=addDays(d,-1);
  }
  return n;
}
const mult=()=>(1+Math.min(.5,.1*streak()))*(1+.05*S.gear.weapon)*(1+(S.cls==='mage'?.15*cm():0))*(1+.02*lvBonus());
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
    arr.push(id);const a=xpGain(task.xp),g=Math.round(task.xp/2*goldMult());S.award[k]=a;S.gAward[k]=g;S.xp+=a;S.gold+=g;pop('+'+a+' XP +'+g+'g',ev);buzz(30);hitBoss(task.xp);attackFx(task.xp);
  }else{
    arr.splice(i,1);S.xp=Math.max(0,S.xp-(S.award[k]||task.xp));delete S.award[k];S.gold=Math.max(0,S.gold-(S.gAward[k]||0));delete S.gAward[k];if(S.boss&&S.boss.hp>0&&S.boss.hp<S.boss.max)S.boss.hp=Math.min(S.boss.max,S.boss.hp+task.xp);
  }
  const act=S.tasks.filter(x=>active(x,t)),all=act.length>0&&act.every(x=>arr.includes(x.id));
  if(all&&!S.bonus[t]){
    const lv0=levelOf(S.xp),bx=Math.round(BONUS*lscale(lv0)),hb=Math.max(2,Math.round(hpBase(lv0)*.25));
    const h=Math.max(0,Math.min(Math.round(hb*(S.cls==='cleric'?1+cm():1)),maxHp(levelOf(S.xp+bx))-S.hp));
    S.bonus[t]={h,c:1,x:bx};S.chests++;S.perfect[t]=1;S.xp+=bx;S.hp+=h;
    toast('Perfect day! +'+bx+' XP, +'+h+' HP, +1 chest');buzz([40,60,40,60,120]);addLog('Perfect day! +'+bx+' XP','good');
  }else if(!all&&S.bonus[t]){
    S.xp=Math.max(0,S.xp-(S.bonus[t].x||BONUS));S.hp=Math.max(1,S.hp-(S.bonus[t].h||0));if(S.bonus[t].c&&S.chests>0)S.chests--;delete S.bonus[t];delete S.perfect[t];
  }
  const after=levelOf(S.xp);
  if(after>before){
    S.hp=maxHp(after);addLog('Reached level '+after,'good');if(after===5)addLog('A class awaits in the Forge','good');
    showModal(S.cls?CLS[S.cls].e:rk(after)[1],'Level up!','You are now level '+after+', '+(S.cls?clsName():rk(after)[0])+'.\nMax HP raised, HP restored and all your stats improved.'+(S.cls?'\nYour gear has improved.':after===5?'\nA class awaits in the Forge.':''));
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
  trinket:{e:'💍',n:['Copper Ring','Silver Ring','Gold Ring','Mythril Ring','Dragon Eye'],d:'+2 max HP per tier'}
};
const COST=[100,250,500,900,1500];
const BOSSES=[['Goblin King','👹'],['Bog Troll','👺'],['Shadow Wraith','👻'],['Stone Golem','🗿'],['Ember Drake','🐲'],['The Lich','💀']];
const ctier=()=>{const l=levelOf(S.xp);return l>=20?2:l>=10?1:0};
const cm=()=>1+.06*Math.max(0,levelOf(S.xp)-5);   /* class bonus grows every level after 5 */
const roman=n=>{let r='';[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']].forEach(([v,s])=>{while(n>=v){r+=s;n-=v}});return r};
const clsName=()=>{const lv=levelOf(S.xp);return CLS[S.cls].n[ctier()]+(lv>=30?' '+roman(Math.floor(lv/10)-1):'')};   /* Paladin II at Lv 30, III at Lv 40... */
const goldMult=()=>(1+.08*S.gear.helm)*(1+(S.cls==='rogue'?.2*cm():0))*(1+.02*lvBonus());
const dmgMult=()=>{const r=.08*S.gear.armor+.01*lvBonus()+(S.cls==='warrior'?.2*cm():0);return r<=.5?1-r:.25/r};   /* diminishing returns, but every level still helps, forever */
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
  if(slot==='trinket'){TR=S.gear.trinket;S.hp+=2}
  addLog('Forged '+GEAR[slot].n[t],'good');toast('Forged: '+GEAR[slot].n[t]);buzz(30);save();render();
}
function openChest(){
  if(S.chests<1)return;S.chests--;
  const r=Math.random();let e,t,m;
  if(r<.5){const g=30+Math.floor(Math.random()*51);S.gold+=g;e='🪙';t='Gold!';m='You found '+g+' gold.'}
  else if(r<.8){const h=Math.max(0,Math.min(Math.round(hpBase(levelOf(S.xp))*.4),maxHp(levelOf(S.xp))-S.hp));S.hp+=h;e='🧪';t='Healing potion';m='You recovered '+h+' HP.'}
  else{
    const open=Object.keys(S.gear).filter(k=>S.gear[k]<5);
    if(open.length){const k=open[Math.floor(Math.random()*open.length)];S.gear[k]++;if(k==='trinket'){TR=S.gear.trinket;S.hp+=2}e=GEAR[k].e;t='Rare find!';m='You found '+GEAR[k].n[S.gear[k]-1]+'.'}
    else{S.gold+=200;e='💎';t='Treasure!';m='You found 200 gold.'}
  }
  addLog('Opened a chest: '+t,'good');showModal(e,t,m);buzz(40);save();render();
}
function renderRPG(){
  const lv=levelOf(S.xp);renderArena();renderSheet();
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
  if(S.cls)cb.textContent='Class: '+clsName()+'. '+CLS[S.cls].d+(cm()>1?' (x'+cm().toFixed(2)+')':'')+'.';
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
  const aff=Object.keys(GEAR).some(k=>S.gear[k]<5&&S.gold>=COST[S.gear[k]]);
  $('dot-hero').hidden=!(S.chests>0||aff||(lv>=5&&!S.cls));
}

/* ---------- arena, character sheet, tabs ---------- */
function setSprite(id,emoji,n){const e=$(id);if(e.dataset.k===emoji)return;e.dataset.k=emoji;e.replaceChildren(px(emoji,n))}
function renderArena(){
  const lv=levelOf(S.xp),R=rk(lv);
  const ah=$('ahero'),hk=(PV?'pv'+PV.n:S.cls?S.cls+Math.min(lv,20):'r'+Math.min(lv,5))+(S.look?Object.values(S.look).join(','):'');if(ah.dataset.k!==hk){ah.dataset.k=hk;ah.replaceChildren(heroPx(lv))}
  $('atag').textContent='Lv '+lv+' '+(S.cls?clsName():R[0]);
  const b=S.boss;if(!b)return;
  const B=BOSSES[b.idx];setSprite('aboss',B[1],24);
  $('abname').textContent=B[0];$('abfill').style.width=(b.hp/b.max*100)+'%';$('abtxt').textContent=b.hp+' / '+b.max;
  $('aboss').classList.toggle('dead',b.hp<=0);
}
function attackFx(dmg){
  const h=$('ahero'),b=$('aboss');
  [[h,'atk'],[b,'hit']].forEach(([e,c])=>{e.classList.remove(c);void e.offsetWidth;e.classList.add(c);setTimeout(()=>e.classList.remove(c),800)});
  const d=el('div','dmg','-'+dmg);$('arena').appendChild(d);setTimeout(()=>d.remove(),900);
}
function renderSheet(){
  const s=$('sheet');s.innerHTML='';
  [['XP','x'+mult().toFixed(2)],['Gold','x'+goldMult().toFixed(2)],['Damage','x'+dmgMult().toFixed(2)],['Max HP',maxHp(levelOf(S.xp))]].forEach(([k,v])=>{
    const d=el('div','stat');d.append(el('small','',k),el('b','',v));s.appendChild(d);
  });
}
function tab(n){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.id==='tab-'+n));
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('on',b.dataset.tab===n));
  scrollTo(0,0);try{localStorage.setItem('dq.tab',n)}catch(e){}
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
function render(){
  const lv=levelOf(S.xp),lo=need(lv),hi=need(lv+1),mh=maxHp(lv),R=rk(lv);
  if(S.hp>mh)S.hp=mh;
  $('lvl').textContent=lv;$('av').replaceChildren(heroPx(lv,1));$('rank').textContent=S.cls?clsName():R[0];
  const hp=Math.max(0,Math.round(S.hp)),pct=hp/mh*100;
  $('hpfill').style.width=pct+'%';$('hptxt').textContent=hp+' / '+mh;
  $('hpbar').classList.toggle('low',pct<30);$('hpbar').classList.toggle('crit',pct<15);
  $('fill').style.width=((S.xp-lo)/(hi-lo)*100)+'%';$('xptxt').textContent=(S.xp-lo)+' / '+(hi-lo);
  const sk=streak();
  $('sn').textContent=sk;$('streak').classList.toggle('off',sk===0);
  $('mv').textContent='x'+mult().toFixed(2);$('gd').textContent=S.gold;

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
    const n=el('div','name');n.append(el('div','',t.name),el('small','meta','★'.repeat(t.xp>=40?3:t.xp>=20?2:1)+' +'+xpGain(t.xp)+' XP +'+Math.round(t.xp/2*goldMult())+'g'));
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

  renderRPG();
  document.querySelectorAll('.dbtn').forEach(b=>{const v=+b.dataset.v;b.querySelector('.dx').textContent='+'+xpGain(v)+' XP';b.querySelector('.dh').textContent='-'+penalty(v)+' HP'});
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
  maybeCreator();
}

$('add').onsubmit=e=>{
  e.preventDefault();
  const inp=$('newname'),name=inp.value.trim();if(!name)return;
  const nt={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name,xp:+$('diff').value,created:today(),days:$('days').value};
  S.tasks.push(nt);
  if(QT==='today'?!active(nt):QT!==nt.days)QT=nt.days;   /* jump to the tab where the new quest lives */
  inp.value='';save();render();inp.focus();
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
const rb=$('reset');let armed=false;
rb.onclick=()=>{
  if(!armed){armed=true;rb.textContent='Tap again to erase everything';setTimeout(()=>{armed=false;rb.textContent='Reset all progress'},3000);return}
  S=fresh();TR=0;save();if(user)pushNow(true);armed=false;rb.textContent='Reset all progress';render();
};
function checkDay(){if(shown!==today()){shown=today();process();ensureBoss();render()}else timer()}
document.addEventListener('visibilitychange',checkDay);setInterval(checkDay,30000);
$('fl').appendChild(px('🔥',16));$('gc').appendChild(px('🪙',16));$('mi').appendChild(px('⚡',16));ensureBoss();initNav();initCreator();
process();render();
/* ---------- dev: scroll through every avatar (set DEV=false to hide) ---------- */
const DEV=true;
if(DEV){
  const LIST=[1,2,3,4].map(l=>({lv:l,cls:null,n:'Lv '+l+' '+RANKS[l-1][0]}));
  Object.keys(CLS).forEach(k=>[5,6,7,8,9,10,11,12,13,14,15,20].forEach(l=>LIST.push({lv:l,cls:k,n:CLS[k].n[l>=20?2:l>=10?1:0]+' Lv '+l})));
  let pi=-1;
  const draw=()=>{$('dname').textContent=PV?PV.n:'My hero';$('dface').replaceChildren(heroPx(1,1));render()};
  const go=n=>{pi=PV?(pi+n+LIST.length)%LIST.length:(n>0?0:LIST.length-1);PV=LIST[pi];draw()};
  $('dev').hidden=false;
  $('dprev').onclick=()=>go(-1);$('dnext').onclick=()=>go(1);
  $('dreset').onclick=()=>{PV=null;pi=-1;draw()};
  addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1)});
  draw();
}

/* one-time cleanup of the old offline cache (service worker was removed) */
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
}
if(window.caches){caches.keys().then(ks=>ks.forEach(k=>caches.delete(k))).catch(()=>{})}

/* ---------- Firebase cloud sync (email + password, one Firestore doc per user) ---------- */
const emptyState=s=>!s.tasks.length&&!s.xp&&!s.gold;
const docRef=()=>fb.db.collection('users').doc(user.uid);
function setMsg(m){syncMsg=m;['amsg','gmsg'].forEach(i=>{const a=$(i);if(a)a.textContent=m})}
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
    if(S.cloudUid&&S.cloudUid!==user.uid){S=fresh();TR=0;render()}
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
    setMsg('Synced');render();
  }catch(e){setMsg('Sync failed ('+(e.code||'error')+'). Your progress is still saved on this device.');render()}
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
  const ok=typeof firebase!=='undefined'&&typeof firebaseConfig!=='undefined'&&firebaseConfig.apiKey&&!/^YOUR_/.test(firebaseConfig.apiKey);
  if(!ok){acct(true);showGate(false);render();return}
  try{firebase.initializeApp(firebaseConfig);fb={auth:firebase.auth(),db:firebase.firestore()}}catch(e){acct(true);showGate(false);render();return}
  $('gin').onclick=()=>authAct('in');
  $('gup').onclick=()=>authAct('up');
  $('pw').onkeydown=e=>{if(e.key==='Enter')authAct('in')};
  fb.auth.onAuthStateChanged(u=>{user=u;setMsg('');if(u)startSync();else stopSync();acct();showGate(!u)});
  addEventListener('online',()=>{if(user)pushNow()});
}
initCloud();
const KEY='dailyQuests.v1';
let user=null,fb=null,pushT=null,unsub=null,syncMsg='';
let synced=false,dirty=false,cloudOff=false,retryT=null,saveSeq=0;   /* synced = first cloud copy received; dirty = local change not yet confirmed saved to cloud */
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
const maxHp=l=>hpBase(l)+TR;                       /* each trinket tier +2 */
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
/* body build: half-width (body + arms) at given rows, y=17 shoulders .. y=36 hips. Each build has its OWN silhouette. */
const BUILDS={
  slim:  [[17,5.6],[20,6.2],[24,6.6],[36,6.6]],                         /* narrow tube, small shoulders */
  avg:   [[17,6.2],[20,7.2],[24,7.6],[36,7.6]],                             /* normal */
  strong:[[17,7.8],[19,9],[24,8.8],[28,8.2],[36,8]],              /* broad shoulders, big arms, tapered waist */
  heavy: [[17,6.4],[20,8.2],[24,9.8],[27,10.4],[30,9.8],[36,9.2]]              /* sloped shoulders, wide round belly */
};
const BUILDS_F={
  slim:  [[17,5.0],[20,5.4],[24,4.8],[28,5.6],[36,6.6]],                 /* small shoulders, narrow waist, soft hips */
  avg:   [[17,5.8],[20,6.6],[24,5.9],[28,7.0],[36,8.2]],
  strong:[[17,6.8],[19,7.8],[24,6.8],[29,7.6],[36,8]],                 /* athletic: broad-ish shoulders, tapered waist */
  heavy: [[17,5.8],[20,7.2],[24,8.8],[28,9.8],[36,9.4]]
};
const ARMW={slim:1.5,avg:2.2,strong:2.8,heavy:2.4};   /* arm thickness (for the arm/torso seam) */
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
  const mix=(a,b,t)=>{const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);return '#'+[16,8,0].map(q=>Math.round(((x>>q)&255)*(1-t)+((y>>q)&255)*t).toString(16).padStart(2,'0')).join('')};
  const fem=!!(lk&&lk.sex==='f');
  const bk=lk&&BUILDS[lk.build]?lk.build:'avg',BP=(fem?BUILDS_F:BUILDS)[bk];   /* build */
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
      const q=Math.round(cx-(hwAt(y)+fy(y)-ARMW[bk])),c0=(G[y+2]||[])[q],c1=(G[y+2]||[])[29-q];
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
    const SH='#dccfae',PN='#6b5638',ROPE='#a07e48',SHO='#4a3320',tw=y=>hwAt(y)-ARMW[bk]+.3,pw=y=>tw(y)-.8;
    const ownHands=noW,hy=noW?25:22,ao22=hwAt(22),AWr=Math.max(2,Math.round(ARMW[bk]));   /* no weapon: arms hang to the hips with their own hands */
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
        P(x,y,c);
      }else if(y===27){                                                /* rope belt */
        if(dx>tw(y)+.2)continue;P(x,y,dx<1?M(ROPE,.6):ROPE);
      }else if(y<=35){                                                 /* trousers */
        if(dx>pw(y))continue;
        if(y>=32&&dx<1)continue;                                       /* gap between the legs */
        let l=side;if(y>=32&&dx<2.2)l-=1;
        let c=ramp(PN,l);if(y===35)c=M(PN,.7);                         /* turned-up cuffs */
        P(x,y,c);
      }else{                                                           /* leather shoes */
        if(dx>pw(35)+.5||dx<1)continue;
        P(x,y,y===36?M(SHO,1.5):SHO);
      }
    }
    P(15,28,ROPE);P(16,28,ROPE);P(16,29,M(ROPE,.8));                   /* belt tail */
    R(12,16,1,1,SKD);                                                  /* (keeps the neck seam tidy) */
    P(13,18,M(SK,.9));P(14,18,M(SK,.9));P(15,18,M(SK,.9));P(16,18,M(SK,.9));P(14,19,M(SK,.85));P(15,19,M(SK,.85));   /* open collar */
    P(12,18,M(SH,1.2));P(17,18,M(SH,1.2));P(13,19,M(SH,1.15));P(16,19,M(SH,1.15));
    P(14,20,ROPE);P(15,20,ROPE);P(14,21,M(ROPE,.7));P(15,21,M(ROPE,.7));   /* lacing */
    {const x0=Math.floor((Math.ceil(cx-pw(33))+13)/2-.5);                 /* knee patch */
     [[0,33],[1,33],[0,34],[1,34]].forEach(p=>{if((G[p[1]+2]||[])[x0+p[0]])P(x0+p[0],p[1],'#8f7549')});}
  }else BODY[aS]();
  if(tr>0){const pc=['','#c0733a','#c8d0e0','#e8b93c','#4aa8d8','#d63a47'][tr];P(13,18,'#c2a46a');P(16,18,'#c2a46a');R(14,19,2,2,pc);P(14,19,M(pc,1.5));R(14,21,2,1,M(pc,.65))}   /* trinket: pendant */
  s=sH;m=s>>1;setCol(hS,m);   /* from here: helm */
  /* ---- head ---- */
  R(13,16,4,2,SKD);
  const FACE={
    oval:()=>{R(10,6,10,9,SK);R(11,5,8,1,SK);R(11,15,8,1,SK);R(9,9,1,2,SK);R(20,9,1,2,SK)},
    round:()=>{R(9,6,12,9,SK);R(10,5,10,1,SK);R(10,15,10,1,SK);R(8,9,1,2,SK);R(21,9,1,2,SK)},
    square:()=>{R(10,5,10,11,SK);R(9,9,1,2,SK);R(20,9,1,2,SK)},
    long:()=>{R(10,6,10,10,SK);R(11,5,8,1,SK);R(11,16,8,1,SK);R(9,9,1,2,SK);R(20,9,1,2,SK)},
    heart:()=>{R(11,5,8,1,SK);R(10,6,10,4,SK);R(11,10,8,2,SK);R(12,12,6,2,SK);R(13,14,4,1,SK);R(14,15,2,1,SK);R(9,8,1,2,SK);R(20,8,1,2,SK)},
    diamond:()=>{R(12,5,6,1,SK);R(11,6,8,1,SK);R(10,7,10,5,SK);R(9,9,1,2,SK);R(20,9,1,2,SK);R(11,12,8,1,SK);R(12,13,6,1,SK);R(13,14,4,1,SK);R(14,15,2,1,SK)}
  };
  FACE[(lk&&lk.face)||'oval']();
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
  HAIR[hs]();
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
  [10,19].forEach(x=>{if(skin(x,12))P(x,12,mix(SK,'#e86a6a',fem?.5:.3))});
  const scar=lk?lk.scar:'none',sc=mix(SK,'#8a1e2e',.72);
  const SCAR={cheek:[[11,10],[11,11],[12,12],[12,13]],eye:[[16,6],[16,7],[17,8],[17,9],[18,10],[18,11]],brow:[[13,7],[12,7],[11,7],[10,8],[10,9]],mouth:[[17,12],[18,13],[18,14]]};
  (scar==='battle'?['cheek','brow','mouth']:scar==='none'?[]:[scar]).forEach(k=>SCAR[k].forEach(p=>{if(skin(p[0],p[1]))P(p[0],p[1],sc)}));
  
  
  /* beard (drawn before the mouth so the mouth shows on top) */
  const bs=fem?'none':lk.beard,bc=hair,bcd=M(hair,.7);
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
  if(!mask){const lp=LK('lips');R(13,14,4,1,lp!=='auto'?lp:fem?mix(SK,'#c2405a',.85):mix(SK,'#8a2a2a',.5))}
  if(mask)R(10,12,10,4,M(base,.55));
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
    if(!noA){R(10,36,4,2,bt);R(16,36,4,2,bt);R(10,36,4,1,bh);R(16,36,4,1,bh);}   /* (peasant shoes are drawn with the trousers) */
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
  return Q;
}
let PV=null; /* dev preview override: {lv,cls,n} or null */
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
  return cv;
}

/* ---------- character creator ---------- */
const DEF_LOOK={sex:'m',skin:'#f0c49a',face:'oval',ears:'round',hair:'crop',hairC:'#6b4a2b',brow:'default',eyes:'#2a1c14',eyewear:'none',beard:'none',marks:'none',lips:'auto',paint:'none',scar:'none',earrings:'none',acc:'none',accC:'#d63a47',build:'avg'};
const HAIR_BY_SEX={
  m:['bald','buzz','short','crop','sidepart','messy','bowl','spiky','slick','mohawk','mullet','curly','afro','dreads','long','ponytail','manbun','braid'],
  f:['bob','long','wavy','bangs','pixie','ponytail','highponytail','bun','spacebuns','braid','twinbraids','pigtails','curly','afro','dreads','short','messy','bowl','buzz','mohawk','bald']
};
/* keep a look valid for its gender: women have no beard list, and hair styles differ */
function fixLook(k){k.sex=k.sex==='f'?'f':'m';if(!HAIR_BY_SEX[k.sex].includes(k.hair))k.hair=k.sex==='f'?'long':'crop';if(k.sex==='f')k.beard='none'}
const OPT={
  sex:['Gender',[['m','Male'],['f','Female']]],
  skin:['Skin',[['#fde4d0','Pale'],['#f6d3b0','Fair'],['#f0c49a','Light'],['#d9a577','Tan'],['#c58f5e','Olive'],['#b87f55','Brown'],['#8a5a3a','Deep'],['#5e3b26','Dark'],['#7ba85a','Orc green'],['#6f93d1','Frost blue'],['#a58bd0','Violet'],['#9aa1ab','Ash']]],
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
  accC:['Accessory colour',[['#d63a47','Red'],['#e87aa8','Pink'],['#ff8a2a','Orange'],['#e8b93c','Gold'],['#58b368','Green'],['#3a8fe0','Blue'],['#8a4ad0','Purple'],['#f2f2f2','White'],['#2a2a32','Black']]],
  build:['Build',[['slim','Slim'],['avg','Average'],['strong','Strong'],['heavy','Heavy']]]
};
const SWATCH=['skin','hairC','eyes','accC'];
const RARE=['beard','scar','marks','lips','paint','ears','eyewear','earrings','acc'];   /* Random mostly leaves these off */
let CK=null,CG='mine',creatorOpen=false,creatorFirst=false;
function drawCreator(){
  $('cprev').replaceChildren(gridCanvas(bustGrid(CK,true,eqLook()),30,40));
  document.querySelectorAll('#copts [data-k]').forEach(b=>b.classList.toggle('on',(b.dataset.k==='gear'?CG:CK[b.dataset.k])===b.dataset.v));
}
function buildCreator(){
  const box=$('copts');box.innerHTML='';
  const add=(k,lab,items,sw)=>{
    const row=el('div','copt'),w=el('div','copts');row.appendChild(el('h4','',lab));
    items.forEach(([v,n])=>{
      const b=el('button',sw?'o sw':'o',sw?'':n);b.type='button';b.dataset.k=k;b.dataset.v=v;b.title=n;b.setAttribute('aria-label',lab+': '+n);
      if(sw)b.style.background=v;
      b.onclick=()=>{if(k==='gear')CG=v;else{CK[k]=v;if(k==='sex'){fixLook(CK);buildCreator()}}drawCreator()};
      w.appendChild(b);
    });
    row.appendChild(w);box.appendChild(row);
  };
  Object.keys(OPT).forEach(k=>{
    if(k==='beard'&&CK.sex==='f')return;                                      /* no beard options for women */
    const items=k==='hair'?OPT[k][1].filter(i=>HAIR_BY_SEX[CK.sex||'m'].includes(i[0])):OPT[k][1];
    add(k,OPT[k][0],items,SWATCH.includes(k));
  });
}
function openCreator(first){
  creatorOpen=true;creatorFirst=!!first;CG='mine';
  CK=Object.assign({},DEF_LOOK,S.look||{});fixLook(CK);
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
/* dev tool: tap the profile avatar at the top to get a "Modify look" option (set to false to turn off) */
const DEV_AVATAR_EDIT=true;
function initDevAvatar(){
  const av=document.querySelector('.hud .av');
  if(!DEV_AVATAR_EDIT||!av)return;
  av.classList.add('devclick');av.setAttribute('role','button');av.tabIndex=0;av.title='Dev tool: tap to modify your look';
  let menu=null;
  const close=()=>{if(menu){menu.remove();menu=null}};
  const open=()=>{
    close();
    menu=el('div','devmenu');
    menu.appendChild(el('small','','Dev tool'));
    const b=el('button','ghost','Modify look');b.type='button';
    b.onclick=()=>{close();openCreator(false)};
    menu.appendChild(b);
    document.body.appendChild(menu);
    const r=av.getBoundingClientRect();
    menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';
    menu.style.top=(r.bottom+6)+'px';
    b.focus();
  };
  const toggle=()=>menu?close():open();
  av.addEventListener('click',e=>{e.stopPropagation();toggle()});
  av.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
  document.addEventListener('click',e=>{if(menu&&!menu.contains(e.target))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  addEventListener('scroll',close,{passive:true});
}
function initCreator(){
  initDevAvatar();
  $('editchar').onclick=()=>openCreator(false);
  $('ccancel').onclick=closeCreator;
  $('crand').onclick=()=>{Object.keys(OPT).forEach(k=>{
    if(k==='sex')return;
    const a=k==='hair'?OPT[k][1].filter(i=>HAIR_BY_SEX[CK.sex].includes(i[0])):OPT[k][1];
    CK[k]=(RARE.includes(k)&&Math.random()<.6)?a[0][0]:a[Math.floor(Math.random()*a.length)][0]});fixLook(CK);drawCreator()};
  $('cdone').onclick=()=>{fixLook(CK);S.look=Object.assign({},CK);save();closeCreator();render();toast('Your hero is ready')};
}

/* ---------- loot: random drops, you decide what to wear ---------- */
const SLOTS=['helm','armor','weapon','trinket','offhand','companion'];
const SLOTN={helm:'Helm',armor:'Armor',weapon:'Weapon',trinket:'Trinket',offhand:'Off-hand',companion:'Companion'};
const NOUN={helm:{warrior:'Helm',mage:'Hat',rogue:'Hood',cleric:'Circlet'},armor:{warrior:'Plate',mage:'Robes',rogue:'Leathers',cleric:'Vestments'},weapon:{warrior:'Sword',great:'Greatsword',mage:'Staff',rogue:'Daggers',cleric:'Mace'},offhand:{warrior:'Shield',mage:'Tome',rogue:'Dagger',cleric:'Lantern'}};
const MATN=['Plain','Iron','Steel','Tempered','Mythril','Golden','Dragon','Godforged'];
const RNAME=['Common','Uncommon','Rare','Very rare','Epic','Legendary','Mythical','Unique'];
const VIS=[0,1,2,2,3,4,5,5];                 /* rarity -> how the gear looks on the hero (6 looks) */
const OLD2NEW=[0,1,2,4,5,6];                 /* old 6-tier saves -> new rarity index */
const PETS={cat:{e:'🐱',n:'Cat'},frog:{e:'🐸',n:'Frog'},bunny:{e:'🐰',n:'Bunny'},turtle:{e:'🐢',n:'Turtle'},bat:{e:'🦇',n:'Bat'},owl:{e:'🦉',n:'Owl'},fox:{e:'🦊',n:'Fox'},wolf:{e:'🐺',n:'Wolf'},dragon:{e:'🐉',n:'Dragon'},duck:{e:'🦆',n:'Duck'}};
const PETQ=['Stray','Tame','Loyal','Clever','Noble','Fabled','Mythic','Spirit'];
const TNAME=['Bone Charm','Copper Ring','Silver Ring','Jade Ring','Gold Ring','Mythril Ring','Dragon Eye','Eye of the Void'];
const SUF={xp:'of Insight',gold:'of Fortune',dmg:'of Warding',hp:'of Vitality'};
const ICON={helm:{warrior:'\u26d1\ufe0f',mage:'\ud83c\udfa9',rogue:'\ud83e\udd77',cleric:'\ud83d\udc51'},armor:{warrior:'\ud83d\udee1\ufe0f',mage:'\ud83e\udde5',rogue:'\ud83e\udd4b',cleric:'\ud83d\udc58'},weapon:{warrior:'\u2694\ufe0f',great:'\ud83d\udde1\ufe0f',mage:'\ud83e\ude84',rogue:'\ud83d\udd2a',cleric:'\ud83d\udd28'},offhand:{warrior:'🛡️',mage:'📖',rogue:'🗡️',cleric:'🏮'}};
const RAR=['#6b6478','#58b368','#4a9ae0','#2fc7c0','#a56be0','#e8b93c','#ff7a4a','#ff4fd8'];   /* frame colour per rarity */
const STAT_TXT={xp:v=>(v<0?'':'+')+v+'% XP',gold:v=>(v<0?'':'+')+v+'% gold',dmg:v=>v<0?'+'+(-v)+'% damage taken':'-'+v+'% damage taken',hp:v=>(v<0?'':'+')+v+' max HP'};
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
  duck:{n:'Rubber Duck Familiar',slot:'companion',st:null,pet:'duck',v:0,b:{xp:12,gold:6},d:'Listens to all your problems.'},
  knock:{n:'Cat Who Knocks Things Over',slot:'companion',st:null,pet:'cat',v:0,b:{gold:14,dmg:-6},d:'Chaos, but profitable chaos.'}
};
const visOf=it=>it.v!=null?it.v:VIS[it.r];
const bonusTxt=it=>Object.keys(it.b).map(k=>STAT_TXT[k](it.b[k])).join(', ');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function itemName(it){
  const main=Object.keys(it.b)[0];
  const base=it.slot==='trinket'?TNAME[it.r]:it.slot==='companion'?PETQ[it.r]+' '+(PETS[it.pet]||PETS.cat).n:MATN[it.r]+' '+NOUN[it.slot][it.st];
  return base+(main?' '+SUF[main]:'');
}
/* old saves had gear tiers per slot: turn them into loot items so nothing is lost */
const OLDCLS={cleric:'druid',monk:'bard'};   /* classes that were renamed: old saves keep their slot */
function migrate(s){
  if(OLDCLS[s.cls])s.cls=OLDCLS[s.cls];
  (s.inv||[]).forEach(i=>{if(i.n&&i.n.indexOf('Sword & Shield')>-1)i.n=i.n.replace('Sword & Shield','Sword')});
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
const hpOf=s=>SLOTS.reduce((a,k)=>{const i=wornOf(s,k);return a+(i&&i.b.hp||0)},0);
function bsum(k){return SLOTS.reduce((a,s)=>{const i=worn(s);return a+(i&&i.b[k]||0)},0)}

function fresh(){return {tasks:[],done:{},perfect:{},bonus:{},award:{},xp:0,badges:{},hp:hpBase(1),lastDay:addDays(today(),-1),log:[],defeats:0,gold:0,gAward:{},inv:[],worn:{},rv:2,cls:null,chests:0,boss:null,look:null}}
function load(){
  let s={};try{s=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){}
  s=migrate(s);
  const hadHp=s.hp!=null;
  s=Object.assign(fresh(),s);
  s.tasks.forEach(t=>{if(!t.created)t.created=today()});
  if(!hadHp)s.hp=maxHp(levelOf(s.xp));
  else{const cap=hpBase(levelOf(s.xp))+hpOf(s);if(s.hp>cap)s.hp=cap}
  return s;
}
function save(){S.ts=Date.now();saveSeq++;try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(user){setPending(true);queuePush()}}
let S=load();TR=bsum('hp');
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
const sbm=()=>1+(S.cls==='bard'?.5*cm():0);   /* Bard: streak bonus per day and its cap are both multiplied */
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
    arr.push(id);const a=xpGain(task.xp),g=Math.round(task.xp/2*goldMult());S.award[k]=a;S.gAward[k]=g;S.xp+=a;S.gold+=g;pop('+'+a+' XP +'+g+'g',ev);buzz(30);hitBoss(task.xp);attackFx(task.xp);
  }else{
    arr.splice(i,1);S.xp=Math.max(0,S.xp-(S.award[k]||task.xp));delete S.award[k];S.gold=Math.max(0,S.gold-(S.gAward[k]||0));delete S.gAward[k];if(S.boss&&S.boss.hp>0&&S.boss.hp<S.boss.max)S.boss.hp=Math.min(S.boss.max,S.boss.hp+task.xp);
  }
  const act=S.tasks.filter(x=>active(x,t)),all=act.length>0&&act.every(x=>arr.includes(x.id));
  if(all&&!S.bonus[t]){
    const lv0=levelOf(S.xp),bx=Math.round(BONUS*lscale(lv0)),hb=Math.max(2,Math.round(hpBase(lv0)*.25));
    const h=Math.max(0,Math.min(Math.round(hb*(S.cls==='druid'?1+cm():1)),maxHp(levelOf(S.xp+bx))-S.hp));
    S.bonus[t]={h,c:1,x:bx};S.chests++;S.perfect[t]=1;S.xp+=bx;S.hp+=h;
    toast('Perfect day! +'+bx+' XP, +'+h+' HP, +1 chest');buzz([40,60,40,60,120]);addLog('Perfect day! +'+bx+' XP','good');
  }else if(!all&&S.bonus[t]){
    S.xp=Math.max(0,S.xp-(S.bonus[t].x||BONUS));S.hp=Math.max(1,S.hp-(S.bonus[t].h||0));if(S.bonus[t].c&&S.chests>0)S.chests--;delete S.bonus[t];delete S.perfect[t];
  }
  const after=levelOf(S.xp);
  if(after>before){
    S.hp=maxHp(after);addLog('Reached level '+after,'good');if(after===5)addLog('A class awaits in the Forge','good');
    showModal(S.cls?CLS[S.cls].e:rk(after)[1],'Level up!','You are now level '+after+', '+(S.cls?clsName():rk(after)[0])+'.\nMax HP raised, HP restored and all your stats improved.'+(after===5&&!S.cls?'\nA class awaits in the Forge.':''));
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
  druid:{e:'🌿',n:['Druid','Warden','Archdruid'],d:'Double healing on perfect days'},
  bard:{e:'🎻',n:['Bard','Minstrel','Maestro'],d:'Stronger streak bonus'}
};
const BOSSES=[['Goblin King','👹'],['Bog Troll','👺'],['Shadow Wraith','👻'],['Stone Golem','🗿'],['Ember Drake','🐲'],['The Lich','💀']];
const ctier=()=>{const l=levelOf(S.xp);return l>=20?2:l>=10?1:0};
const cmAt=l=>.4+.07*Math.max(0,l-5);   /* class bonus strength: 40% of its base at Lv 5, +7% every level after (Lv 15 = 110%, Lv 25 = 180%) */
const cm=()=>cmAt(levelOf(S.xp));
const CB={warrior:[20,'% damage taken','-'],mage:[15,'% XP','+'],rogue:[20,'% gold','+'],bard:[50,'% streak bonus','+']};
const clsBonusTxt=(k,l)=>{const m=cmAt(l);if(k==='druid')return 'Heals x'+(1+m).toFixed(2)+' on perfect days';const c=CB[k];return c[2]+(Math.round(c[0]*m*10)/10)+c[1]};
const roman=n=>{let r='';[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']].forEach(([v,s])=>{while(n>=v){r+=s;n-=v}});return r};
const clsName=()=>{const lv=levelOf(S.xp);return CLS[S.cls].n[ctier()]+(lv>=30?' '+roman(Math.floor(lv/10)-1):'')};   /* Paladin II at Lv 30, III at Lv 40... */
const goldMult=()=>(1+bsum('gold')/100)*(1+(S.cls==='rogue'?.2*cm():0))*(1+.02*lvBonus());
const dmgMult=()=>{const r=bsum('dmg')/100+.01*lvBonus()+(S.cls==='warrior'?.2*cm():0);return r<=.5?1-r:.25/r};   /* diminishing returns, but every level still helps, forever */
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
  const w=dropWeights(levelOf(S.xp));
  let r=Math.random()*w.reduce((x,y)=>x+y,0);
  for(let i=0;i<w.length;i++){if((r-=w[i])<0)return i}
  return 0;
}
const RSC=[1,1.8,2.6,3.5,4.5,5.5,6.8,8.5];   /* bonus size per rarity */
const STAT_STEP={xp:3,gold:4,dmg:3,hp:1.6};   /* per rarity step; each stat rolls 60-140% of it */
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
  const pool=r>=5?['dragon','wolf','fox','owl']:r>=3?['owl','fox','wolf','bat']:['cat','frog','bunny','turtle','bat'];
  const it={id:uid(),slot,r,b,st:ks.length?ks[Math.floor(Math.random()*ks.length)]:null,isNew:true};
  if(slot==='companion')it.pet=pool[Math.floor(Math.random()*pool.length)];
  it.n=itemName(it);return it;
}
const iicon=it=>it.slot==='trinket'?'\ud83d\udcff':it.slot==='companion'?(PETS[it.pet]||PETS.cat).e:ICON[it.slot][it.st];
const dicon=k=>k==='trinket'?'\ud83d\udcff':k==='companion'?'🐾':ICON[k][S.cls&&NOUN[k][S.cls]?S.cls:'warrior'];
const sellVal=it=>it.u?120:10*(it.r+1)*(it.r+1);
function openChest(){
  if(S.chests<1)return;S.chests--;
  const r=Math.random();let e,t,m;
  if(r<.72){
    const it=rollLoot();S.inv.push(it);
    e=iicon(it);t=RNAME[it.r]+' loot!';m=it.n+'\n'+bonusTxt(it)+(it.u&&UNIQ[it.u]?'\n'+UNIQ[it.u].d:'')+'\nFind it in the Hero tab.';
    addLog('Found '+it.n,'good');
  }else{
    if(r<.9){const g=30+Math.floor(Math.random()*51);S.gold+=g;e='🪙';t='Gold!';m='You found '+g+' gold.'}
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
let SEL='weapon';
function renderGear(){
  const lv=levelOf(S.xp),R=rk(lv),E=eqLook();
  const fg=$('figure'),fk=(PV?'pv'+PV.n:Object.values(E).join('.'))+'|'+(S.look?Object.values(S.look).join(','):'');
  if(fg.dataset.k!==fk){fg.dataset.k=fk;fg.replaceChildren(heroPx(lv))}
  $('figname').textContent='Lv '+lv+' '+(S.cls?clsName():R[0]);
  {   /* companion beside the hero (a dev preview overrides what is worn) */
    const cw=worn('companion'),fk2=PVP||(cw?(PETS[cw.pet]?cw.pet:'cat'):null),fp=$('fpet');
    if(fk2){fp.hidden=false;fp.title=PVP?PETS[fk2].n:cw.n;setSprite('fpet',PETS[fk2].e,24)}else fp.hidden=true;
  }
  const slot=(k,wide)=>{
    const it=worn(k),b=el('button','eslot'+(SEL===k?' on':'')+(it?'':' base')),ic=el('span','ei');
    b.type='button';b.style.setProperty('--rar',RAR[it?it.r:0]);b.setAttribute('aria-pressed',SEL===k);
    b.setAttribute('aria-label',SLOTN[k]+': '+(it?it.n:'empty'));ic.appendChild(px(it?iicon(it):dicon(k),16));
    if(wide){const tx=el('div','etx');tx.append(el('span','ek',SLOTN[k]),el('small','',it?it.n:'Empty'));b.classList.add('wide');b.append(ic,tx)}
    else b.append(el('span','ek',SLOTN[k]),ic,el('small','',it?it.n:'Empty'));
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
  hd.append(el('b','',SLOTN[SEL]),el('span','',S.gold+'g'));
  pk.replaceChildren(hd,el('div','sub',items.length?'Bonuses only count while an item is worn.':'Nothing found for this slot yet. Chests drop random loot.'));
  items.forEach(it=>{
    const on=!!cur&&cur.id===it.id,r=el('div','irow'+(on?' on':'')),ic=el('span','ei'),tx=el('div','itx'),act=el('div','iact');
    r.style.setProperty('--rar',RAR[it.r]);ic.appendChild(px(iicon(it),16));
    tx.append(el('b','',it.n),el('small','',RNAME[it.r]+': '+bonusTxt(it)));
    if(it.u&&UNIQ[it.u])tx.appendChild(el('small','',UNIQ[it.u].d));
    const wb=el('button','btn',on?'Take off':'Wear');wb.type='button';wb.onclick=()=>wear(it.id);act.appendChild(wb);
    if(!on){const sb=el('button','ghost','Sell '+sellVal(it)+'g');sb.type='button';sb.onclick=()=>sell(it.id);act.appendChild(sb)}
    r.append(ic,tx,act);pk.appendChild(r);
  });
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
    const B=BOSSES[b.idx],info=el('div','');info.style.flex='1';
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
  $('dot-hero').hidden=!(S.chests>0||aff||(lv>=5&&!S.cls));
}

/* ---------- arena, character sheet, tabs ---------- */
function setSprite(id,emoji,n){const e=$(id);if(e.dataset.k===emoji)return;e.dataset.k=emoji;e.replaceChildren(px(emoji,n))}
function renderArena(){
  const lv=levelOf(S.xp),R=rk(lv);
  const ah=$('ahero'),hk=(PV?'pv'+PV.n:Object.values(eqLook()).join('.'))+(S.look?Object.values(S.look).join(','):'');if(ah.dataset.k!==hk){ah.dataset.k=hk;ah.replaceChildren(heroPx(lv))}
  $('atag').textContent='Lv '+lv+' '+(S.cls?clsName():R[0]);
  const pt=worn('companion'),ap=$('apet'),pk=PVP||(pt?(PETS[pt.pet]?pt.pet:'cat'):null);
  if(pk){ap.hidden=false;ap.title=PVP?PETS[pk].n:pt.n;setSprite('apet',PETS[pk].e,24)}else ap.hidden=true;
  const b=S.boss;if(!b)return;
  const B=BOSSES[b.idx];setSprite('aboss',B[1],24);
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
    const ks=['xp','gold','dmg','hp'].filter(k=>bsum(k));
    if(!ks.length)gb.textContent='No gear bonuses yet. Wear some loot to gain them.';
    else{const t=el('div','','Gear bonuses');t.style.color='var(--gold)';gb.appendChild(t);ks.forEach(k=>gb.appendChild(el('div','',STAT_TXT[k](bsum(k)))))}
  }
}
function tab(n){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.id==='tab-'+n));
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('on',b.dataset.tab===n));
  const hud=document.querySelector('.hud');if(hud)hud.hidden=n==='hero';   /* Hero tab: just the full avatar and its gear */
  const th=$('tab-hero');if(th)th.style.paddingTop=n==='hero'?'env(safe-area-inset-top,0px)':'';
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
  S=fresh();S.wiped=Date.now();TR=0;save();if(user)pushNow(true);armed=false;rb.textContent='Reset all progress';render();
};
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
$('fl').appendChild(px('🔥',16));$('gc').appendChild(px('🪙',16));$('mi').appendChild(px('⚡',16));initNav();initCreator();
daily();render();
/* ---------- dev: scroll through every avatar (set DEV=false to hide) ---------- */
const DEV=true;
if(DEV){
  const LIST=[];
  Object.keys(NOUN.weapon).forEach(w=>Object.keys(NOUN.armor).forEach(a=>[0,2,5].forEach(t=>LIST.push({n:NOUN.armor[a]+' + '+NOUN.weapon[w]+' T'+t,eq:{helm:t,armor:t,weapon:t,trinket:t,offhand:t,sO:a,sH:a,sA:a,sW:w}}))));
  let pi=-1;
  const PKEYS=Object.keys(PETS);let pj=-1;   /* companion previewer: cycles every pet next to your hero in the arena */
  const pdraw=()=>{$('dpname').textContent=PVP?PETS[PVP].n:'My companion';$('dpface').replaceChildren(PVP?px(PETS[PVP].e,24):el('span',''));render()};
  const pgo=n=>{pj=PVP?(pj+n+PKEYS.length)%PKEYS.length:(n>0?0:PKEYS.length-1);PVP=PKEYS[pj];pdraw()};
  const draw=()=>{$('dname').textContent=PV?PV.n:'My hero';$('dface').replaceChildren(heroPx(1,1));render()};
  const go=n=>{pi=PV?(pi+n+LIST.length)%LIST.length:(n>0?0:LIST.length-1);PV=LIST[pi];draw()};
  $('dev').hidden=false;
  $('dprev').onclick=()=>go(-1);$('dnext').onclick=()=>go(1);
  $('dpprev').onclick=()=>pgo(-1);$('dpnext').onclick=()=>pgo(1);
  $('dpreset').onclick=()=>{PVP=null;pj=-1;pdraw()};
  $('devpet').hidden=false;
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
  const mig=!c.inv||!c.rv||!!OLDCLS[c.cls];
  S=Object.assign(fresh(),migrate(Object.assign({},c)));S.cloudUid=user.uid;
  if(keepLook)S.look=keepLook;
  if(keepLook||mig)save();
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
      if(c.dataset.noeye)return done();
      const sk=x.getImageData(14,ER,1,1).data;
      if(!sk[3])return done();
      const saved=EX.map(ex=>x.getImageData(ex,ER,1,2));
      EX.forEach(ex=>{x.fillStyle=rgb(sk,1);x.fillRect(ex,ER,1,1);x.fillStyle=rgb(sk,.6);x.fillRect(ex,ER+1,1,1)});
      setTimeout(()=>{EX.forEach((ex,i)=>x.putImageData(saved[i],ex,ER));done()},140);
    },
    look(c,x,done){    /* glance to one side for a moment */
      if(c.dataset.noeye)return done();
      const sk=x.getImageData(14,ER,1,1).data;
      if(!sk[3])return done();
      const dir=Math.random()<.5?-1:1,saved=x.getImageData(10,ER,10,2),eyes=EX.map(ex=>x.getImageData(ex,ER,1,2));
      x.fillStyle=rgb(sk,1);EX.forEach(ex=>x.fillRect(ex,ER,1,2));
      EX.forEach((ex,i)=>x.putImageData(eyes[i],ex+dir,ER));
      setTimeout(()=>{x.putImageData(saved,10,ER);done()},700+Math.random()*400);
    },
    glint(c,x,done){   /* a little star twinkles on the weapon tip (highest bright pixel on the right side) */
      const d=x.getImageData(24,0,5,23).data;
      let gx=-1,gy=-1;
      for(let r=1;r<23&&gx<0;r++)for(let q=0;q<5;q++){
        const i=(r*5+q)*4;
        if(d[i+3]>200&&d[i]+d[i+1]+d[i+2]>330){gx=24+q;gy=r;break}
      }
      if(gx<0)return done();
      const saved=x.getImageData(gx-1,gy-1,3,3);
      x.fillStyle='#fff';x.fillRect(gx,gy,1,1);
      setTimeout(()=>{try{x.fillRect(gx-1,gy,3,1);x.fillRect(gx,gy-1,1,3)}catch(e){}},110);
      setTimeout(()=>{x.putImageData(saved,gx-1,gy-1);done()},330);
    },
    sway(c,x,done){    /* the weapon tip leans over by a pixel or two, pivoting at the hand */
      const saved=shiftRows(x,24,0,6,17,r=>r<4?2:r<10?1:0,true);
      setTimeout(()=>{x.putImageData(saved,24,0);done()},450);
    },
    hair(c,x,done){    /* long hair, braids and pigtails flick outward by a pixel (short hair has nothing to move) */
      const l=shiftRows(x,2,12,9,7,()=>-1,false),r=shiftRows(x,19,12,9,7,()=>1,false);
      setTimeout(()=>{x.putImageData(l,2,12);x.putImageData(r,19,12);done()},400);
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
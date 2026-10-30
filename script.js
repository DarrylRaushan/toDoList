const KEY='dailyQuests.v1';
let user=null,fb=null,pushT=null,unsub=null,syncMsg='';
let synced=false,dirty=false,cloudOff=false,retryT=null,saveSeq=0;   /* synced = first cloud copy received; dirty = local change not yet confirmed saved to cloud */
const BONUS=25;
const RANKS=[['Peasant','🌾'],['Commoner','🧺'],['Wayfarer','🥾'],['Journeyman','🎒'],['Adventurer','🧭']];   /* ranks 1-5 are the same for every future class; at level 5 you are an Adventurer until you pick a class */
const rk=lv=>RANKS[Math.min(lv-1,4)];
/* ---- honours: c = category, t = tier (0 bronze, 1 silver, 2 gold, 3 legend), m = the stat it counts, v = the goal for that stat ---- */
const HCATS=[['q','Quests','📜'],['s','Streaks','🔥'],['l','Levels','🏆'],['h','Hero','🛡️'],['b','Battle','⚔️']];
const HTIER=['Bronze','Silver','Gold','Legend'];
const BADGES=[
  /* quests */
  {id:'first',c:'q',t:0,e:'🌱',n:'First step',d:'Finish a quest',m:'done',v:1},
  {id:'dn10',c:'q',t:0,e:'📜',n:'Task taker',d:'Finish 10 quests',m:'done',v:10},
  {id:'dn50',c:'q',t:1,e:'🗒️',n:'Diligent',d:'Finish 50 quests',m:'done',v:50},
  {id:'dn100',c:'q',t:1,e:'💯',n:'Centurion',d:'Finish 100 quests',m:'done',v:100},
  {id:'dn250',c:'q',t:2,e:'🏹',n:'Quest hunter',d:'Finish 250 quests',m:'done',v:250},
  {id:'dn500',c:'q',t:2,e:'🎯',n:'Relentless',d:'Finish 500 quests',m:'done',v:500},
  {id:'dn1000',c:'q',t:3,e:'🏛️',n:'Living legend',d:'Finish 1000 quests',m:'done',v:1000},
  {id:'perfect',c:'q',t:0,e:'⭐',n:'Perfect day',d:'Finish all quests in a day',m:'perf',v:1},
  {id:'pf5',c:'q',t:0,e:'✨',n:'Five flawless',d:'5 perfect days',m:'perf',v:5},
  {id:'pf10',c:'q',t:1,e:'🎖️',n:'Spotless',d:'10 perfect days',m:'perf',v:10},
  {id:'pf25',c:'q',t:2,e:'🏅',n:'Immaculate',d:'25 perfect days',m:'perf',v:25},
  {id:'pf50',c:'q',t:3,e:'🥇',n:'Flawless victor',d:'50 perfect days',m:'perf',v:50},
  {id:'tk5',c:'q',t:0,e:'📋',n:'Planner',d:'Have 5 quests on your board',m:'tasks',v:5},
  {id:'tk10',c:'q',t:1,e:'🗂️',n:'Taskmaster',d:'Have 10 quests on your board',m:'tasks',v:10},
  {id:'hd25',c:'q',t:1,e:'💪',n:'Heavy lifter',d:'Finish 25 hard quests',m:'hard',v:25},
  {id:'hd100',c:'q',t:2,e:'🏋️',n:'Titan',d:'Finish 100 hard quests',m:'hard',v:100},
  /* streaks */
  {id:'s3',c:'s',t:0,e:'🔥',n:'On fire',d:'3-day streak',m:'str',v:3},
  {id:'s7',c:'s',t:1,e:'⚡',n:'Unstoppable',d:'7-day streak',m:'str',v:7},
  {id:'s14',c:'s',t:1,e:'🌪️',n:'Fortnight',d:'14-day streak',m:'str',v:14},
  {id:'s30',c:'s',t:2,e:'👑',n:'Legend',d:'30-day streak',m:'str',v:30},
  {id:'s60',c:'s',t:2,e:'🌋',n:'Eruption',d:'60-day streak',m:'str',v:60},
  {id:'s100',c:'s',t:3,e:'☄️',n:'Comet',d:'100-day streak',m:'str',v:100},
  {id:'s365',c:'s',t:3,e:'🌞',n:'Year of glory',d:'365-day streak',m:'str',v:365},
  {id:'qs7',c:'s',t:0,e:'🔁',n:'Creature of habit',d:'Finish one quest 7 days in a row',m:'qs',v:7},
  {id:'qs30',c:'s',t:2,e:'⛓️',n:'Iron habit',d:'Finish one quest 30 days in a row',m:'qs',v:30},
  {id:'fz1',c:'s',t:0,e:'🧊',n:'Safety net',d:'Hold a Streak Freeze',m:'frz',v:1},
  {id:'fz3',c:'s',t:1,e:'❄️',n:'Cold storage',d:'Hold 3 Streak Freezes',m:'frz',v:3},
  /* levels */
  {id:'l3',c:'l',t:0,e:'🧭',n:'Getting started',d:'Reach level 3',m:'lv',v:3},
  {id:'l5',c:'l',t:0,e:'🛡️',n:'Veteran',d:'Reach level 5',m:'lv',v:5},
  {id:'l10',c:'l',t:1,e:'🐉',n:'Dragon slayer',d:'Reach level 10',m:'lv',v:10},
  {id:'l15',c:'l',t:1,e:'🗡️',n:'Seasoned',d:'Reach level 15',m:'lv',v:15},
  {id:'l25',c:'l',t:2,e:'🏆',n:'Champion',d:'Reach level 25',m:'lv',v:25},
  {id:'l50',c:'l',t:3,e:'🌟',n:'Mythic',d:'Reach level 50',m:'lv',v:50},
  {id:'l75',c:'l',t:3,e:'🌠',n:'Ascendant',d:'Reach level 75',m:'lv',v:75},
  {id:'l100',c:'l',t:3,e:'💫',n:'Eternal',d:'Reach level 100',m:'lv',v:100},
  /* hero */
  {id:'cls',c:'h',t:0,e:'🎓',n:'Chosen path',d:'Pick a class',m:'cls',v:1},
  {id:'sub',c:'h',t:1,e:'🔱',n:'Specialist',d:'Pick a subclass',m:'sub',v:1},
  {id:'wn3',c:'h',t:0,e:'🧥',n:'Dressed for it',d:'Wear 3 pieces of gear',m:'wn',v:3},
  {id:'wn6',c:'h',t:2,e:'🎽',n:'Fully kitted',d:'Fill all 6 gear slots',m:'wn',v:6},
  {id:'pt1',c:'h',t:0,e:'🐾',n:'Not alone',d:'Own a companion',m:'pets',v:1},
  {id:'pt3',c:'h',t:1,e:'🦊',n:'Menagerie',d:'Own 3 companions',m:'pets',v:3},
  {id:'pl5',c:'h',t:1,e:'🐣',n:'Growing bond',d:'Raise a companion to level 10',m:'plv',v:10},
  {id:'pr3',c:'h',t:1,e:'🐺',n:'Fine company',d:'Own a Rare or better companion',m:'prar',v:3},
  {id:'pl10',c:'h',t:2,e:'🦅',n:'Best friends',d:'Raise a companion to level 30',m:'plv',v:30},
  {id:'pr5',c:'h',t:2,e:'🐲',n:'Mythic mount',d:'Own a Legendary companion',m:'prar',v:6},
  {id:'iv10',c:'h',t:0,e:'🎒',n:'Pack rat',d:'Own 10 items',m:'inv',v:10},
  {id:'iv25',c:'h',t:1,e:'📦',n:'Collector',d:'Own 25 items',m:'inv',v:25},
  {id:'gd100',c:'h',t:1,e:'💰',n:'Well off',d:'Hold 100 gold',m:'gold',v:10000},
  {id:'gd1000',c:'h',t:2,e:'🏦',n:'Dragon hoard',d:'Hold 1000 gold',m:'gold',v:100000},
  {id:'gm10',c:'h',t:1,e:'💎',n:'Gem keeper',d:'Hold 10 gems',m:'gems',v:10},
  {id:'gm25',c:'h',t:2,e:'🔮',n:'Gem hoarder',d:'Hold 25 gems',m:'gems',v:25},
  /* battle and loot */
  {id:'bk1',c:'b',t:0,e:'⚔️',n:'Boss slayer',d:'Defeat a weekly boss',m:'kills',v:1},
  {id:'bk5',c:'b',t:1,e:'🩸',n:'Bane of bosses',d:'Defeat 5 bosses',m:'kills',v:5},
  {id:'bk10',c:'b',t:2,e:'👹',n:'Giant killer',d:'Defeat 10 bosses',m:'kills',v:10},
  {id:'bk25',c:'b',t:3,e:'🏰',n:'Realm warden',d:'Defeat 25 bosses',m:'kills',v:25},
  {id:'ch1',c:'b',t:0,e:'🎁',n:'Treasure hunter',d:'Open a chest',m:'chs',v:1},
  {id:'ch10',c:'b',t:1,e:'🗝️',n:'Locksmith',d:'Open 10 chests',m:'chs',v:10},
  {id:'ch50',c:'b',t:2,e:'🏴',n:'Plunderer',d:'Open 50 chests',m:'chs',v:50},
  {id:'rr2',c:'b',t:0,e:'🔷',n:'Rare find',d:'Own loot of Rare quality or better',m:'rar',v:3},
  {id:'rr4',c:'b',t:1,e:'🟣',n:'Epic find',d:'Own loot of Epic quality or better',m:'rar',v:5},
  {id:'rr5',c:'b',t:2,e:'🟠',n:'Legendary find',d:'Own Legendary loot',m:'rar',v:6},
  {id:'rr6',c:'b',t:3,e:'🌌',n:'Mythical find',d:'Own Mythical loot',m:'rar',v:7},
  {id:'uq1',c:'b',t:2,e:'🏺',n:'One of a kind',d:'Own a unique item',m:'uniq',v:1},
  {id:'fl1',c:'b',t:0,e:'💀',n:'Fell in battle',d:'Be knocked out once',m:'fell',v:1},
  {id:'fl5',c:'b',t:1,e:'☠️',n:'Stubborn',d:'Be knocked out 5 times',m:'fell',v:5}
];
const need=l=>Math.round(50*l*(l-1)*(1+.04*Math.max(0,l-2)));   /* total XP for level l: each level takes longer than the last */
let TR=0,QT='any',ADDOPEN=false,addTouched=false;   /* ADDOPEN = the new-quest note on the board is expanded */   /* QT = selected tab on the quest board */
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
const pathMult=t=>hasSub('pathfinder')&&t&&tabOf(t)!=='all'?1+.3*cm():1;   /* Pathfinder: quests that are not every-day */
const shotMult=t=>hasSub('sharpshooter')&&t.xp>=40?1+.4*cm():1;   /* Sharpshooter: coins from hard quests */
const xpGain=(xp,first,t)=>Math.round(xp*lscale(levelOf(S.xp))*mult()*firstMult(first)*masteryMult(t)*pathMult(t));   /* t = the quest (optional): adds its weekly mastery bonus */
const goldGain=(t,first)=>Math.round(t.xp/2*goldMult()*firstMult(first)*masteryMult(t)*pathMult(t)*shotMult(t));
const lvBonus=()=>levelOf(S.xp)-1;                   /* levels above 1: every level adds +2% XP, +2% gold, -1% damage taken */
function levelOf(xp){let l=1;while(xp>=need(l+1))l++;return l}
const pad=n=>String(n).padStart(2,'0');
const dkey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dkey(new Date());
const dow=k=>new Date(k+'T12:00:00').getDay();     /* 0 Sun .. 6 Sat */
/* quest schedule: t.days = 'all' (every day, default) | 'wk' (Mon-Fri) | 'we' (Sat-Sun) | an array of weekday numbers (0 Sun .. 6 Sat) for your own days, e.g. [3,5] = Wed + Fri */
const DAYSETS={all:[0,1,2,3,4,5,6],wk:[1,2,3,4,5],we:[0,6]};
const DNAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],DORDER=[1,2,3,4,5,6,0];   /* the week is shown Mon..Sun */
const dayList=t=>Array.isArray(t.days)&&t.days.length?t.days:(DAYSETS[t.days]||DAYSETS.all);
const dayKey=ds=>{const s=ds.slice().sort((a,b)=>a-b).join();return Object.keys(DAYSETS).find(k=>DAYSETS[k].join()===s)||null};   /* preset name, or null for a custom set */
const saveDays=ds=>dayKey(ds)||ds.slice().sort((a,b)=>a-b);
const dayLabel=t=>{const k=dayKey(dayList(t));return k==='all'?'Daily':k==='wk'?'Mo-Fr':k==='we'?'Sa-Su':DORDER.filter(d=>dayList(t).includes(d)).map(d=>DNAMES[d].slice(0,2)).join(' ')};   /* short text for a resting quest's header */
const dayGroup=t=>dayKey(dayList(t))||'cu';
const tabOf=t=>t.once?'once':dayKey(dayList(t))==='all'?'all':'cu';   /* which tab a quest lives in: Daily (every day) or Custom (any other days) */
const active=(t,k)=>{k=k||today();if(t.once)return k===t.once;return dayList(t).includes(dow(k))};   /* a one-off quest (t.once = its date) is only due on that one day */
const expired=t=>!!t.once&&t.once<today();   /* a one-off from an earlier day: kept in S.tasks for the streak maths, but no longer shown */
const addDays=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dkey(d)};
const $=id=>document.getElementById(id);
/* draws an emoji tiny, then scales it up unsmoothed so it looks like pixel art */
/* hand-drawn 16x16 pixel icons for the shop wares: palette letters -> colours, '.' is clear (looked up by the old emoji they replace) */
const SHOP_SPR={
  '🧊':{p:{'k':'#1a0f06','w':'#ffffff','l':'#bfeaff','b':'#6cc4f0','d':'#3a8fd0','D':'#2a64a8'},r:[
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwwlllllllbk.',
    '.kwllllllllllbk.',
    '.kwlllllwlllbbk.',
    '.kwllllwwwllbbk.',
    '.kwlllllwlllbbk.',
    '.kwlllllllllbbk.',
    '.kllllllllbbbbk.',
    '.kllllllbbbbbdk.',
    '.kbbbbbbbbbbddk.',
    '.kbbbbbbbbbddDk.',
    '.kddddddddddDDk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................']},
  '🧪':{p:{'k':'#1a0f06','c':'#b07a3a','g':'#a9d6e8','w':'#ffffff','r':'#e8344a','R':'#a81c34'},r:[
    '................',
    '.....kkkkkk.....',
    '......kccck.....',
    '......kccck.....',
    '.....kgwggk.....',
    '.....kgwggk.....',
    '....kkgwggkk....',
    '...kgwrrrrrgk...',
    '..kgwrrrrrrrrgk.',
    '..kgwrRrrrrrrgk.',
    '..kgrrrrrrrrRgk.',
    '..kgrrrrrrrRRgk.',
    '..kgRRrrrrRRRgk.',
    '...kgRRRRRRRgk..',
    '....kkkkkkkkkk..',
    '................']},
  '🎁':{p:{'k':'#1a0f06','b':'#c98a4a','d':'#8a5224','D':'#5e3516','m':'#b9c2d0','y':'#ffd75a'},r:[
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kbbbbbbbbbbk..',
    '.kbbmbbbbbbmbbk.',
    '.kbbmbbbbbbmbbk.',
    '.kkkkkkkkkkkkkk.',
    '.kddmddddddmddk.',
    '.kddmddyyddmddk.',
    '.kddmddyyddmddk.',
    '.kddmddddddmddk.',
    '.kDDmDDDDDDmDDk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................']},
  '💖':{p:{'k':'#1a0f06','r':'#ff4d6d','R':'#b81f45','w':'#ffd1dc'},r:[
    '................',
    '..kkkk....kkkk..',
    '.kwwrrk..krrrrk.',
    'kwwrrrrkkrrrrrrk',
    'kwrrrrrrrrrrrrRk',
    'krrrrrrrrrrrrRRk',
    'krrrrrrrrrrrRRRk',
    '.krrrrrrrrrrRRk.',
    '..krrrrrrrrRRk..',
    '...krrrrrrRRk...',
    '....krrrrRRk....',
    '.....krrRRk.....',
    '......krRk......',
    '.......kk.......',
    '................',
    '................']},
  '💠':{p:{'k':'#1a0f06','p':'#b968ff','P':'#7a35c8','w':'#f0d8ff'},r:[
    '................',
    '......kkkk......',
    '.....kwwppk.....',
    '....kwpppppk....',
    '..kkkkkkkkkkkk..',
    '.kwwppppppppPPk.',
    '.kwpppwwpppppPk.',
    '..kwppppppppPk..',
    '...kwppppppPk...',
    '....kwpppPPk....',
    '.....kwpPPk.....',
    '......kwPk......',
    '.......kk.......',
    '................',
    '................',
    '................']},
};
/* the 16 axes from the reference sheet, hand-pixelled: rows joined with '|', palette letter -> colour, '.' is clear */
const AXE_P={"a":"#e1f5f3","b":"#ded8c7","c":"#e1c087","d":"#eca252","e":"#92d1af","f":"#6cab74","g":"#cd7f4f","h":"#bf6761","i":"#736a68","j":"#7a5f63","k":"#427a7b","l":"#52626e","m":"#c84b40","n":"#995257","o":"#7e4b58","p":"#64576e","q":"#64565a","r":"#66475a","s":"#535163","t":"#52445a","u":"#3d5164","v":"#3d4362","w":"#8b3841","x":"#55374e","y":"#453a4f","z":"#442e43","A":"#363554","B":"#35333b","C":"#322b3b","D":"#2e2431","E":"#1a0f06","F":"#172427"};
const AXE_S=[
"......................EEEEE..EEE........|.....................EspllpEEoooE.......|.....................EsslpEEEowrE.......|.....................ExEEEExoEnxE.......|.....................EzE.EEoEEopEEEE....|.....................EzpExxEEwEExxxqE...|......................EEppjEorE.EEEEjEE.|......................EqxiiorsE..EbEztsE|.....................ExjiojspE...EbbbisE|....................EExiirrspE...EbbbElE|...................EtpEjrssspE..EbbbbEpE|..................EEppprrpppE...EbbbE.E.|.................EplEEzxxEiE...EbbbEsE..|.................EEErjEEErpE...EEEE.E...|...............EEqEExqE.ExxE.EEbEEsE....|..............EpEEooEE..ErxEEbbbEEE.....|.............EEsEEoqE...EtrEEbEEEiE.....|............EljEoxEE....EsibbbEpEE......|...........EEinEEoE....EEpEbbE.E........|..........EppEnzEE....EozE.EEtE.........|.........EirrojE.......EtpEE.E..........|........EEtooDrE......EpssssE...........|.......EtiEzxEE........EEEEE............|......EEspErxE..........................|.....EspErDEE...........................|....EEppqqqE............................|...EpsEiDEE.............................|..EjrqrqE...............................|.EExorzqE...............................|ErjixxEE................................|ExriqrE.................................|EDzzEE..................................|EqqqE...................................|.EEE....................................",
".............................EEE..........|...........................EErooE.........|..........................EjnnnojE........|.........................EEwwnnnrpE.......|........................EoEEnowworpE......|.......................EEnnEEorooorEE.....|......................EjoEEwrtttorortE....|......................EEnEnrojooooorrEE...|.....................EwEEortjgghrvtrotrE..|....................EonnnxronhggnnorrtpE..|..................EEtonorzxnhhggghnottpEE.|.................EionooxxonnhhhgddhhhEEojE|................EErrnooxznnnhhggddhggEEwnE|...............ErzrrryzonnnnhgddddhggghwnE|...............ExxrryxonnnnnhgggddEEEhnwjE|..............EzroryzwnnnnnnhgnwddEEnooojE|..............EzxxttonnnnnnhggggddE.EEEEE.|..............EzttrrnnnnnnnhgdddddnE......|..............EzttronnnnnhhggEgnEEnE......|..............ExttronnnnnhhhgEEE..E.......|...............ErzrownnhhEEEnnE...........|..............EEtzxrrohhgnE.EE............|.............EjzxtzzCwgghnE...............|............EqrxxxjEEjjoooE...............|...........EEDxozzE..EyttroE..............|..........EqroxzEE....EEEEE...............|.........EErrwrxE.........................|........EprnnzqE..........................|........EEoooqE...........................|.......ExoEzxE............................|......EjooxEE.............................|....EEtonxzE..............................|...EprEozEE...............................|..EEqonozE................................|.EpxEEzrE.................................|.EEEEErE..................................|EtEdrrE...................................|EtEErpE...................................|EtEErqE...................................|.EjptpE...................................|.EirpE....................................",
"...................EEEEE..EEE...........|..................EpppppEEpllE..........|..................EsslllEEplpEE.........|..................EpEaaaEpEEbEsE........|................EEEpEbbbEpEbbEEEE.......|...............EsssEEbEE.EaabEEppE......|..............EiAeEE.E..EEbbE..EEEE.....|..............EpFbabE..EaabE....EspE....|..............EiDEbE..EabbE......EEpE...|..............EiCEE..EEabE........EpE...|...............EEqsEEabbE.........EbE...|..............EEEppEEabE.........EEbEE..|.............ECtsEEbbbE........EEbbbbbE.|.............ECsE.EbEE.E......EbbbbbbbE.|.............ECpEEEbEEEsE.....EaabbbbbbE|..............EEpppsstEE.....EbaabEEEEE.|..............EEssstAApE..EEEbaaaE......|.............EtEEtyEECpE.EbbbbaaaE......|............EEEpppqEEiEEEEbbbbbbbE......|...........EspEqCEEsEbbbbbbbbEsEE.......|............EEpqEiEEEbbbbbEEE.E.........|............EEDpEplbbbbbbbtpE...........|...........EysEEEllpppEEEEEE............|..........EEtqE.EppsppE.................|.........EtyEE...EEEEE..................|........EEipE...........................|.......EiDEE............................|.......EEE..............................|.....EEsE...............................|....ElEE................................|..E.ElE.................................|.EbEsE..................................|.EE.E...................................|EpsE....................................|.EE.....................................",
"...................EEE....................|.................EEwwoE...................|................EjEEEzE...................|................EoodEzEE....EEEEE.........|................EzxggErBE..EoooooE........|...............EEnnhhgnoEE.ExonrqE........|..............EnwEdghggEzyEEDnhxxE........|..............EjxggggghnzzpxxoozxE........|..............ErDhghggnrzzzxoxzzzE........|.............EoEEhhnooxxzzrxxzzEE.........|.............EoEdhnwooxzxxoxzzzEEEEEEEEEE.|.............EzgdwwoxzgdccDxoEEzzzxroroooE|.............EzohrxrxzngccCxnEEwrrwnnhhnwE|.............EDzzCzzzzrohhDwhhghgggdcccEwE|..............EEEEjzzzzxronhgdghggdcccEEE.|................EEEzzzzzzxggdddggdccbcojE.|...............ExtrxxzzzxohhgdddgwwnnoEE..|..............EqzzzrrxzzwngggddddzxoooE...|..............EqzoxzqErzhhggdddccBqEEE....|..............EnrxxzjEqzhggdddcccxjE......|.............EwnEzzzqEqzhgdddccccoE.......|............EEEnrEEEjqonggddcccEEE........|..........EEwnErDE..ECngggdcccbooE........|.........EjoEnzEE...EzngddccbEoEE.........|.........EjnEnxE...EizjhddcccEoE..........|........EwhhzrE.....EBzzrooooEE...........|.......EEnnjrE......ErqqjjjjjE............|......EwEExxE........EEEEEEEE.............|.....EEEnojE..............................|...EEwnEozE...............................|..EjoEExjE................................|EEEnnEjyE.................................|oowEEDrE..................................|onEEEqE...................................|wgdxzE....................................|xwozBE....................................|CzCzxE....................................|EEEEE.....................................",
"....................E.................|...................EbE................|..................EEabE...............|.................EbabE................|...............E.EbabEE.EEEEEE........|..............EsEabbbbbEbpstvtE.......|.............E.EbbbbEEEEEpqnnwoE......|............EtEabbbE..EtDtrdgmotE.....|...........EEbbaaaE..EypEtxmmoxypE....|..........ErqaaaaaE.EEBEEyywotvAspE...|.........ExbaaaabE.EzpEpysuzzAzAEEpE..|........EjzbaaaaE.EEtpEsAssyyCAyEEpE..|........EjzEEbEE.EyyEECvsAtEEBpEbbE...|.........EqEEE...EppisvvypiEipEEbbEEE.|..........ErxEEEEEEiyylvDEEBtE.EEbbbaE|...........EEjqttttppsApEqpEE.EbaaabE.|............ExxyAAyyipBiEytE.EbaaaaE..|.............EEEpAssAAzyypE.EaaaaalE..|...............EpytstyAAyE.EEaaaaEpE..|..............EApEyyEEApE.EbbbballE...|.............EiqppEiEpiE.EEbbbbEEE....|..........EEEsiEpCEECpE.EbbEbaExE.....|.........EsssEpqjEqqpE..EbbabiEE......|........EpCCyEExEEyAEEEEbbbaEzE.......|........EpAssxjEszEbaaaaaabxjE........|........EEytsxqEqBEEbbbbbbErE.........|.......EyEEtAzsEpCyCBzxzxxxE..........|......E.E.EjijE.EppppiiEjEE...........|.....EsEbExEEE...EEEEEE.E.............|....E.EEqEE...........................|.EEEpEEExE............................|EppsEErEE.............................|EsssEEriE.............................|ECpEAyEE..............................|ECtpyyE...............................|ECCCAyE...............................|.EEEEE................................",
".......................EEEE............|......................EkkkkE...........|...................EEEEbbeuE...........|.................EEkkkeaabAlE..........|................EkEaaaaatrEE...........|................EEEaaaabtqE............|...............EkaaaaaiCEE.............|..............EEeaaaaafkEE.............|.............EkbaaaaaeeeulE............|.............EkbaaaaelkkulE............|............EEkbaaaeECvvupE.EEE....EE..|...........EkEaaaeeEEBEEEE.EyyyE..EkkE.|...........EkEaaaeeEjBE...EpvAyE.EEkkkE|...........EkeaaaEE.ECE..EAukvyEEvEafkE|...........EkeaaaE.EqyqEEEkklAyEEAEafkE|...........EkeaaeEEqsqyAzuekAAyEEDEafkE|...........EkeaeEqsqqtlkkkkuuttqiEEafkE|...........EvfaEEyyqsukkekvvvstyrEbafkE|...........EukaEyEECukkeuAzysqqEEeaafkE|...........EvkelzEEClkkktttttqjEEeaafkE|...........EzkeuyEEzkeuDEEEiCEE.EaaafkE|...........ECvkkqipvkkkiE.EiAE.EEaaafkE|...........ECzDEEyvkuzEEEEEiCEEeaaaaEkE|............EEEqptyvlE.EstsACEeaaabE.E.|..............EsCstCjE.EyyzzCeeaaaekE..|.............EziiytEE..EzueeeaaaaeekE..|............EqysiqpE...EtlkeaaaaaeeE...|...........ECyqzzEE.....EEAEaaaaekE....|..........EiptyqiE.....EjEEeaaaeEE.....|.........EztEECEE.....EEzseaaaakE......|........EsEEtEE......EitkeeeiEEE.......|.......EpyEECqE......EsAeeefvkE........|......EyEEtsEE.......EpvullEEE.........|.....EEtEEqpE.........EllluE...........|..EEECEbpzEE...........EEEE............|.EiiqiEEEiE............................|EtAAyEECEE.............................|EsAklspE...............................|EsAkkAqE...............................|EszAAzqE...............................|EprssrE................................",
"........................EEEE...............|.......................EtzCqE..............|.......................EtAvlEEE............|.......................EyAkkzzAEEE.........|......................EplkluvuuurtE........|.....................EpCkkuuvkkvAArEEE.....|.....................EqDuuuvuuuvuekzyBE....|.....................ElBssvvvvvvukkvvvEEEE.|....................EDuklssttvvvuvkkkevByqE|...................EqulklstrttvvuuukkkkkCqE|..................EDAkklsstttttvvvvukkekDxE|..................EBBvussssstvyAAvuvuAuuEE.|..................EBBBvssssssyAAAuuvBDBzE..|...................EEDCysssssyAkkklDEEEE...|....................EDBBsssssyAkkkkBEE.....|....................EFBAusCCzvuvueeektE....|.................EEEpvAzvyAAvvvukkkkltE....|................EyCCvkuAzAAvvvukkFCtttE....|...............EslkkkkyAzAvukkkusEEEEE.....|..............EiCkkkllvAAAvukkkvyE.........|..............EqDtssssyAvvvuukekklE........|..............ElAytttsvAukuuvkkkksjE.......|.............EFuksrAACvukkkkDCDyttpE.......|.............EDvlstzyvukkkulqqqjEEE........|............EEDyrrtBAvkkkkFxEEEE...........|...........EqluvyyxxttuukkkkpE.............|........EEEEDAkuACAttttvkeektE.............|.......EiDDDDBtyAtvkkkuCCztptE.............|.......EqDDCBztyBtlkkklyzxpspE.............|.......EiDyttyyDDkkkkvEEEEEEE..............|........EiyyyyCtqlukptE....................|.........EyCACDqEBCtttE....................|........EtBzBzEE.EEEEE.....................|.......EsCABDtE............................|......EyvvABEE.............................|.....EEyvvAyE..............................|....EBAsBDEE...............................|...EEAAytqE................................|..EtAvvDqE.................................|.EtyvCyEE..................................|EiCttBqE...................................|EiDBBEE....................................|.EyyyE.....................................",
"..................................EEE.|.................................EbbbE|................................EEaaaE|...............................EaaaEE.|..............................EEaaaE..|.............................EaabEtE..|...........................EEEbbE.E...|..................EEEEE...EseabEsE....|.................EbbbbbEE.EsEbEEE...E.|.................EaaaaaElEEsEbpqE.EEsE|.................EbbbbbEEppEEpEE.EsEbE|................EEccEbbEEppEpsEEE.EEbE|...............EssuuuEEssEisEEsssEabbE|................EEEEE.EipplsppEpEEabbE|....................EEsEEsssssEEbbabbE|...................EiEEEpEEEppEEbbabbE|...................EsEEppE.EisEEbbabbE|....................EEsEE..EisEEbbabbE|....................EEiE...EisEEbbabE.|...................EsEE....EisEEaaaE..|..................E.E......EEE.EaaaE..|.................EsE.....EEtE..EaaaE..|................EEE.....EiEE..EbabE...|...........E...ElpE...EEEsiEEEbbabE...|..........EsE.EsEE...EpspEEbbbbEEE....|.........EEspEEpE...EEpEEEEbbEE.......|........EppEpsEE...EsEEEbbbbE.........|.........EEpEE.....EspE.EEEE..........|..........EsE......EpssE..............|.........EiE........EEE...............|........EppE..........................|.......EpEE...........................|......EEpE............................|.....EtEE.............................|..EEEEE...............................|.EbbsiE...............................|EpppsE................................|EppspE................................|.EEEE.................................",
"........................EEEEE......EE.....|.......................ElllllE....EllE....|....................EEEEuvuulEE..EuuulE...|...................EpvulfffffvpE.EuufivE..|..................EEEslifffqqvpE.EluffliE.|.................ElvEcfffffDDDqE.EluffflvE|.................EEEddfffqqiiqE..EsuffflvE|...............EEvEdddffftFEEE...EsuffflvE|..............EpiEddiilifBDE.....EluffflvE|.............EEvidddquuqfBDEE...EElldfflvE|............EplffdfuuuuultrBzE.EpuffdddivE|...........EEllfffquuuuuuqqukEEEElifdddivE|..........EpvfffquuuuuuyDqfeeDBvifuldddivE|.........EpllfflyBByBBBBDyqkkDBuuqiffddivE|........EEvlfffsBDDDDDDBCytvvDBuuuffffdivE|.......ElEfffBBDtEEEBDDDDCCCzyuuuuffffflvE|.......EvlfffyzDqEEEzCDDBDDBBuuuuuffffflvE|.......ECBfqDEEEEEqDtyDtEtDuuuuuqfffDqfyDE|.......EBBiqtE..EEtAvtztEiyyyuuuifiqyqiBDE|.......EDDFiE..EiFvvvvtzDEEBDuuufdBBEiFDDE|.......EiiiE..EqtyAAAAyBDEEzBulfddqqqqEijE|........EEE...EDBuADDDDDDiEBBuidddffFyEEE.|.............EpvACiEEEEiDDyuqfddffBBDqE...|...........EEpvuvDE...EEBFBlfdddffBBBqE...|..........EixvvFqE...EBBkffcdDDFFDEEEE....|..........EpsyAqiE...EBBuqqfEytxtzE.......|.........EtsvCDEE....EBDDDDFBEEEEE........|........EpvvApiE......EiiiiiE.............|......EEtsuAFEE........EEEEE..............|.....EjpvvCqE.............................|.....EsvuABE..............................|....EtsuDtE...............................|.EEEEiyyqiE...............................|EuvvlfByEE................................|EvvfiBiE..................................|EvidiFE...................................|ECCyDDE...................................|EzBzBBE...................................|.EEEEE....................................",
".................EEEE......................|................EitqqEEE...................|................EiqEEByyE..................|................EEqabEDDEEEE...............|...............EtEaabwmwzFDyE..............|...............EtbaabwmwwzDxE..............|...............EtbaabwmwwwDyE...EE.........|..............E.EaachwmwwwiE...EqqE........|.............EqEbbammwwmzDE...ExDFzEEE.....|.............EtEbbammwwwzDE..ExwmwxtyzE....|............EEqEbbbmmmmwzBEEEqBmmmwDzBEEEE.|...........EqibbbgmmmwwqqqBBBwmmmwwwEEiqqiE|...........EqibbEgmmmwrqtyBBDwmmmmwhEEEEqqE|...........EqibEEhmmwFzqBDtyDwmmmwhbbbbbqiE|..........EEEEEEswwzwqtByyzzywmmmhcbEiEEEE.|.........EiqbbEiFFFDyEiByrDBsnmmmEbbEFyqE..|.........EittyziEEEEEztyzzDzwmmcbbEqEEEE...|..........EqBBBqE..EEBytBDBzmmmbaEEqE......|...........EEEEE..EBBtyCDDtrwEaaaiiE.......|.................EEyzyyyBDrwEEabbEE........|................EzBttDqExDwnbbaEtE.........|...............EqzzzyiiqyBEEbbE.E..........|..............EiCttByEiDytbbbEqE...........|.............EBttBBEEEiDEEttEqqE...........|..........EEEEDyqyzE.EiDEEDCqqqE...........|.........EyFDDtyDEE.EDqE.EBxEEE............|.........EyDzzzttE..EDtEEEtqE..............|.........EtDwwDtE...EFDDFFEE...............|.........EjiwxDqE...EiiiiiE................|.......EEtEEBDDqE....EEEEE.................|......EiEEqxEEEE...........................|.....EEqEEqBE..............................|....EqibEDEE...............................|.EEEEiEEixE................................|EjDDFEEDqE.................................|EiDzwxqEE..................................|EiDwwBzE...................................|.EDCzCxE...................................|.EBBzDxE...................................|..EEEEE....................................",
"........................EEEEE..............|.......................EptsttE.............|.......................EtBBABEE..EEEE......|.......................EtAlulyDEEDDFiE.....|.......................EqtuuuyzEEyBDE......|...................EEE..EEFBupsDDtyDiE.....|..................EiipE..EDBvyBBBByiE......|..................EBACEEEEDBBCCuyDqE.......|..................EBBuuytyyyDytBBBDyE......|..................EBBlBCCDsyDysBDzBBqE.....|...................EEDyuttCCDDCCzABBCBE....|..............EEE...EDBusuBBABDyABAzABEE...|.............ECCDEEEEDBCkkdfkuCvuAACyussE..|.............EDyuqqqtzBDlfiiftDuuAAvuyiiEE.|.............EFBuBDDztzFffCtfqDuuAyuuufftjE|..............EqByytxBCDtukkuBDyuuuulffftE.|..............EqCyutyBDDvukkvADyuuuuiffitE.|..............EqDCABBlBDBDBDDyyuuuqfffqsE..|..............EqDCBBBuFDCBBDByuyyuqffEqE...|..............EqDDBluDDDBzAzBvuDDFBfitE....|..............EqDyyBuqyDBAAyvvBqjiiqiE.....|............EEEqDuuDtEqDCzCyuBDEEEEyE......|...........EttyyuByEEEqDyuuuuBDE...E.......|...........EyzAAuBBE.EqDuuuulBBEE..........|...........EBztzDEE.EFBluqfffffqrE.........|........EEEEyzytxE.EqBuukfffffiiE..........|.......EiCAAtyDqE.EDBkkufffffitE...........|.......EqByxyyiE..EttsusqqqiiEE............|.......EqDytDxE...ErttttttttyE.............|......EtysBzEE.....EEEEEEEEEE..............|.....EEAvszzE..............................|....EBysyDEE...............................|...EEyytytE................................|..EtBsyDEE.................................|.EpuBBtE...................................|EiCulByE...................................|.EDDBDtE...................................|EizBzzqE...................................|.EEEEEE....................................",
"..............................E............|......................EEEEEEEEiE...........|.................EEEEEitttttqzBEE..........|................EiiiiqEEEeecEEEppE.........|................EqqqqqEbbbbbbbEtyEEE.......|................EqibbbEEEEEEbEoEnCzCE......|................EsqbbEEEEE.EbEE.EtyCE......|................EytbEEsAAAEEbbbE.EEDE.EE...|................EyAE.EittsEEbbE.EqEE.EipE..|................EyACEbEtqqbbbbbEECpEEECAtE.|................EyAAypEEEEEEEEErtAytttkktE.|..............EEEyAACAEEEbEEonEzAzAAAAektE.|.............EqqqyAAAAzyEbbbbEEyAukkkeektE.|.............EyqiiqqqqrpEEEEE.ErtuukkeektE.|.............ECEEbbbbbEEEnrxDE.EoyukkeektE.|..............EiqEEEEEEEEnxyAEEpsAukkeektE.|..............EqCrwEEEooEnCBCpjvvAukkeektE.|..............EpAnnwnEnoxxEEEpyAAvukkeektE.|..............EiyonongnrBvEEEqyBAvkkkeektE.|...............EEtzzohrAvuAqEEEyAvkkkeektE.|................EyAytEjsvvvsEEEvvukkeeekriE|................EtyptzEEtAvvACAvukkeeeektE.|...............EpsvvtiE.EpAAvAyvukkeeekEE..|..............EpCssCpE...ECvvvCuvkkeeespE..|.............EyssAtEE.....EpAvvkkkeeeeppE..|............EEzssytE......EizvukkeeeeeppE..|...........EtpEtBEE........ECkkkkeeekxEE...|..........EEppEptE........EpvkkkkeekkqE....|.........ErtEpCEE........EDukkkeeekxEE.....|.........EppppiE........EpukkkkeekEE.......|.......EEtEECqE......EEEyAkkkeeektE........|......EqEEssEE......EttslkkkeeeklE.........|.....EEspEtsE......EiAAukkkkeeelpE.........|....ExpEsBEE......EAukkeeeekttsEE..........|...EEtsppsE.......EyskkkkkkkjpiE...........|..ErsvvCEE........EtttrtttxjEEE............|.EpEkkuyE..........EEEEEEEEE...............|EpteekkDE..................................|EpBkkAlE...................................|EpxkkypE...................................|.EEyAAtE...................................|..EisqE....................................",
"....................EEEEEEEE...EEEEEE....|...................EmmmwwwwwEEEwwmmmmE...|...................EwhbcbbcggnggggmmwE...|...................EwEaaaaadgwgdddgmwEEE.|....................EEnbaaadddddjqrEEEwnE|.................EEEEEwbaabdddddottEEEmmn|................EwwwwmdcaddmmmwtEEEEvmgmn|.............EEEhmmmmgdcbddmmmojE..Esgdmn|............EmwwdddddddddddwwvEE..EEygdmn|............EwmgddddggmddggmwtE..EiEEddmn|............EmmdddddwwwgdmmmorEEEEtndddmn|.............EEmdddgmmmmmmhbcdEspomgdgmEE|.............EEmdddgmmmmmmhbcdEtromgdgmEE|............Ewmddgmmmmmmdmmgmmotwmmgdddmn|............Ewmddmmmmmmmmmmgmmwommmgdddmn|............Ewmdgmmmwwwotmmtttwmmmgddddmn|............Emmdmwwnmwowwwnnwtnmmmdddddmn|............Emmdntvrwwtomtodhtmmmmdddddmn|............EmwrEEEErpiptrtrnmmmdddgmgdmn|............EnnsE.EEspiptoronmmwdddgngdmn|.............EEE.ErsEEswmwwmmmwwbbwEEEnwn|................EEppppEowmmmmmgEabwhE.EEE|...............EitEEAqEEvmmmmgbaabwE.....|...............EEEssEEEjvmmmgdbaabwnE....|.............EEppEytE.EpymmgddbaabwE.....|............EqEEpyEE.EphgddddmbaEEE......|...........EEspEpyE..ErmgdddgnEbmwE......|..........ElsEpDEE...EwmwwwwEEEwmnE......|..........EEpppqE.....EEEEEE...EEE.......|........EEsEECpE.........................|.......EiEEptEE..........................|......EEspEtxE...........................|.....EpEEptEE............................|....EEpEEptE.............................|...EpsEpCEE..............................|.EEEEEppqE...............................|EsstEECqE................................|EsEEEEEE.................................|EpEbppE..................................|EtsttrE..................................|EppppE...................................|.EEEE....................................",
".................EEEEE......................|................EppspiE.....................|................EtrrrjEEEEE............EEEE.|................EtEbcEtttADE..........EqyyqE|................EtEcEEojizAE.EEE......EEospE|...............EiCEE..EEbjAEECACE....EtEErpE|................EEEoEEEEitAqsvAzE....EthhrpE|.................EsAjjpptvzCAvvBE...EEthhrpE|.................EsztttstppzAApE...EqpphhspE|.................EsAttttrppyyCpEEEEErpjhhtpE|.................EtzCAArjjjjpACAtttrEhhccrpE|..................EpptAypppprtyxjojjnhhccoE.|...................EEEzBztttstpjhhhhhhhccE..|...................EqtvAAyyttpprpphhhhcccE..|..................EEyvuvACCtrjrCvvEhhccccE..|.................EqxppApEtAppxpEEEpEbcbEE...|.................ElAppyEEsCnpApE.EpEEccE....|................EzkkAtE.EsAhhvE...EEvEbE....|...............EluullE..EtAhhpEE...EvpE.....|...........EEEECukuzE...EsAhhhEvEE.EypE.....|..........EisrqkuvpE...EprphhhhEEpE.EE......|..........EsAAvkuBE.EEEEzonhhhccEvE.........|..........EpzrrAsE.ElltrphhhhcbbcbE.........|.........EEryrrAtEEEssyrEEhhhcccccE.........|........EiCnhxAAqElvEEhhEccbbcEEEE..........|........EqrojpsqEElvEEjEEEEEEE..............|......EECjgrCEEE.EpuvvutttxpEjE.............|.....EpjEoriE.....EEEEEEEEEE.E..............|....EEyxEoAE................................|...EqzorxjE.................................|...EpxooApE.................................|..ECEEnpCqE.................................|.ElkEErpiE..................................|ECkekkAtE...................................|EzukkkzyE...................................|EBukuvAtE...................................|.EiAACEE....................................|..EtttE.....................................|...EEE......................................",
"......................................EE..|.....................................EppE.|....................................EEuusE|...................................EuEEluE|...........EEEE....................EvEdllE|..........ElvvlE...................EvEdpsE|..........ElvpEEE...EEE..EEEE.....EiiEdpsE|..........ElsdEDpE.EvvvEEsvvpEEEEEvEdddpuE|..........EludgziEEEkkAEElukkppppEEEdeeluE|..........ElldgCiEsuekCiEsukkvvuuldddfekuE|..........ElldgfqyukekAEEluffkfdfddddfekuE|..........EludgfqBukekCpEildfkfdddddffeklE|..........EluhjuqflkkkBvvfddfkfddddfffekuE|..........EluhhklfqlkuAslfddffffdddfffkuvE|..........EluhhuuuffBzAqfffdddfkfdfffkkvyE|..........EsvhhpppiirsvufqffffkkffffqkkvyE|..........EtzEhjjjjjjpvukuufffkkffffukkvAE|...........EEtyyAyyyytpnhlulqffkffffuBAEE.|............EtyyyyBAyxpnhilulfkkffffkyCE..|.............EEEEEyzrrzABhhuuukkffqkekCE..|...............EEEvyxxpppjniiukkkiukkuzE..|..............ECACvuAtEEEyxEhkuvuuukkvCE..|..............EAxovuzsE..EEtjhpvukfkvlE...|.............EECrnsvArE...ECthpvukekziE...|............EtrnryvsEEyE..ECtnpuukEEAE....|...........EEyxntBvsEEyjE.ECropuliEEzE....|..........EltEoCACluulhoDE.EEzvvhhCsE.....|..........EjqrrqppuuligikEE.EztpjjpE......|........EEunnztEEEvBffffeuBEECnhtBE.......|.......EijjotEE...EEttqukABEECyxjE........|......EEuoExyE.....EtyyyyztEEAyyE.........|.....EsqnrzEE.......EEEEEEE..EEE..........|....EEsqnryE..............................|...EqsnoAEE...............................|...EqqoqqE................................|.EEunEBsE.................................|EtiEjxEE..................................|ECndrBE...................................|ECzyzCE...................................|EtttttE...................................|.EEEEE....................................",
"................................EE.......|...............................EpiE......|.............................EErttiE.....|............................EprEEtiE.....|....................EEEEEE..EqyEEyiE.....|...................EiCCCCyE.EszddtiE.....|.................EEEErqxyyE.EsAggEEE.....|................EyACjdggxBE.EsyhgdEyE....|................EvyhhgoqiE..EsznhddEiE...|................EyxdgnxAE...EsAnndddExE..|................EyyhnryzE...EpynnnnhptE..|............EEEEExxnotxxEEEEEqxononhErEE.|...........EzCAAzxwwooorzAzzzonwwwnhEEtpE|...........EzyorxoorrxrrxxyyyrorronhEErqE|...........EAodgnwotvBABwwttttstrrhdddtpE|..........EjEEhnrrtAxwmnwxstrrroonhdddtpE|.........EyxdEnqtttAwmggxArroownnngdddtpE|.........EytgnzzyttArmmmxyoonnnnnngdddtpE|.........EyxhotytttzwwmmryoonnnnnnhdddtpE|.........EvzCsEEEtzwryAzEECyttrroonhEEtpE|.........EjipE..EyAwxBtpEECxrrrronhhEEEE.|..........EEE...EyzxxCEE.ECxooownhhhotE..|...............EsxxzyAE.EqxronnggdgdjtE..|..............EpCxxzBBEEtzowwnndddddjtE..|.............EyzxztEEEixjjwnhhhdddEoEE...|............EECxxytE.EpznnonhhhddEEsE....|...........EDyoxDEE.EConddddhEErvtiE.....|..........EpxxxxpE.EqrhhdddgnEEjEpE......|.........EyzoxAiE.ECohdddddEtvtE.E.......|........ErxrxrEE.EjEEdddhjE.EEE..........|.......EpzrrzpE.EtjEEddEjttE.............|......EArrxxEE..EptrrrrrEEE..............|.....EjyxrtqE...EpppppppE................|....EDxnrCEE.....EEEEEEE.................|.EEEExxoopE..............................|EtyADmwDEE...............................|EqBnnxrE.................................|EqAEECpE.................................|EpCzxEE..................................|.EttqE...................................|..EEE...................................."
];
/* the 9 weapons from the second sheet: [palette, rows joined with '|'] */
const WPN=[[{"a":"#ece591","b":"#bddfca","c":"#e2b96f","d":"#69ece0","e":"#68d191","f":"#5cb693","g":"#43b3aa","h":"#eca85b","i":"#ba9481","j":"#9c5844","k":"#34916a","l":"#178e8f","m":"#3d6973","n":"#272730","o":"#1a171f","p":"#0d1d21","q":"#101826","r":"#22151e","s":"#191521","t":"#131525","u":"#250f1c","v":"#1e1121","w":"#1a1222","x":"#161222"},".fe.........tqtqqqqqtqq........|..mn......tqllgggdddddgq.rwuo..|..n......slgfaacccaddgtx.tcaax.|........pkfacdddddgbdp..qllmcaw|.......pkfcvrtqqpedfbdqqlgqqrhw|......okeso......wqdfillggt..uw|......txw..........oegllnw.tw..|....................pelmijoko..|....................qenfnhjs...|....................pe.bohjev..|.................wppelmbvjokew.|.................pkellmibv.pko.|..................omlllmnu..qw.|.................ujqlll.cjox...|...............wrjrtnqquhhcx...|..............ucaw.ts..rhhax...|.............ucajw...vujhhas...|.............ucjv...ujhhhco....|............tirv...ujhhhcr.....|...........tbw.....ujjvvo......|..........qbx......vjv.........|.........tit.......wo..........|.......orjx....................|....usuccr.....................|...uhjvujv.....................|..ocjujwv......................|..xrucujv......................|.soacujcv......................|peocjucr.......................|qgqowwx........................|qglmw..........................|.wtw..........................."],[{"a":"#d0dee9","b":"#c0cedf","c":"#e2b577","d":"#c39d9f","e":"#9a9fc0","f":"#939db9","g":"#b694ee","h":"#817287","i":"#6d6f85","j":"#6d6983","k":"#8a537e","l":"#6c55a8","m":"#75449d","n":"#533956","o":"#3f3d5a","p":"#3f3959","q":"#222237","r":"#191728","s":"#1a142b","t":"#1a1422","u":"#1b1227","v":"#190f27","w":"#151427","x":"#151126"},"..........................sssst|........................sxabffr|.......................vialllfw|......................siaglllfw|.....................sibgglllfr|.....................ralgglleq.|....................weglgglejr.|...................relglgleit..|..................sellgllajs...|................vqemllglbtu....|..............uqbbmmlller......|..............wbnmmmllbw.......|.....us..rt...xfommmlew........|.....sfusdct.rpbepmmet.........|....rvijdkctwbboofppjt.........|...qejpnkcncvfpfpbjjr..........|..xjpp.kccjckjpoepsur..........|..sjjsuhkcccbqiffu.............|..rst.sjnkcbwfsts..............|.......wbpbxdcccut.............|.......sffofccjncct............|.......sqofpkccckjx............|......wbosfbnkckjx.............|.....wiefuuxjkk.ex.............|....wbbor...usooijt............|...qboft.....spfssv............|.vxibfr.....tjpjx..............|xjwsot......xjir...............|xqpsx.......uuu................|.vvpx..........................|..ur..........................."],[{"a":"#f1f4cc","b":"#f3e697","c":"#eec768","d":"#d1e4c8","e":"#a5deaf","f":"#cdc8a0","g":"#dbac79","h":"#e4a166","i":"#a99d88","j":"#41a5b8","k":"#357da2","l":"#a15c3a","m":"#606276","n":"#333d58","o":"#24242c","p":"#2a1b21","q":"#211b26","r":"#1b1927","s":"#14192b","t":"#2d1214","u":"#211220","v":"#1c1323","w":"#15142b","x":"#17131d"},"...........................wrwv|.........................vpaaev|......................nvpacccer|.....................soacfjigiv|.....................xafjkkmgr.|.....................xagkkkgip.|....................nafkkkmix..|..................vrafkkmcfiv..|.................tbcikkmfddr...|.................tfjkkmfdrrq...|................sifjkkfds......|..............snjfadkmgs.......|..............sjfjjachiv.......|...........svojfdejfkvo........|......uvvuvracfjjafjo..........|....rtbbbbgqffdejfjs...........|....tcllhlvvsjeefjsv...........|..xtcbvtcb.gfjjhcr.............|..qbbq..pcb.miwdav.............|...xxv..xtcg.ixvvq.............|........tchll.tgv..............|.......wmgltlhlgr..............|......omknvvtlcgr..............|.....sknns...plgw..............|.xx.rmmnr....tliv..............|xbhuuwnw...rtcgq...............|xblbcvo....tcluq...............|ugpchq.....pgo.................|.pgutlo.....vq.................|..thhgq........................|...vuq........................."],[{"a":"#f7e2d6","b":"#fde88e","c":"#f5d090","d":"#f2bf87","e":"#edab86","f":"#d3986f","g":"#cf8348","h":"#ec6c23","i":"#ae5358","j":"#9b5840","k":"#d4422a","l":"#c54733","m":"#89334a","n":"#a31e26","o":"#6d1a2c","p":"#361119","q":"#340916","r":"#26111b","s":"#270d1d","t":"#1e1427","u":"#1f1419","v":"#171523","w":"#1d1029","x":"#1e101f"},"....................rdbdx.......|...................udbdu........|..................tdbdx.........|..................tdbdu.........|...................ubdu.........|.............wwwq..qgbfr........|............taaalxxjggbjv.......|............waakkistxrrsrr......|...........xaalnnmaasnkkklwu....|...........sagsoimmiatonnhagux..|..........wagrbfvwootosonngaggr.|..........wmqdbbbfsxtwtsssonnkfx|..........xxfqgddbollaahoosrwxxv|............rjqdmjddonnnnnnmx...|...........vfpiaisgddokkkchgat..|...........uqdiaimqgdbonhgdkgau.|..........udjdjfwanrgbbbqohhhggx|..........xdglgwialaqjgddgsxsuvv|...........vsjftwqnaafrwurvv....|...........wewx.snsqlhfrnlr.....|...........woew.slrjqkhcphlv....|...........sjox.skfqgqkhasuv....|..........sjjx..rluudjqhhgw.....|.........rjiox..wx..udvxxxw.....|..tv....rjios........uw.........|..tat.tsojos....................|..rgauasoox.....................|..qhgwewtt......................|.qnhaweew.......................|slkneawv........................|xwqlseav........................|..vr.wtv........................"],[{"a":"#bdc7d5","b":"#9aa5bc","c":"#9e9db4","d":"#9c94ab","e":"#7c7792","f":"#6b6983","g":"#62546d","h":"#7b3e52","i":"#7d2c3d","j":"#464763","k":"#413a59","l":"#3c2a41","m":"#781d30","n":"#4e1b34","o":"#2d1225","p":"#221f33","q":"#211a2c","r":"#201427","s":"#1b192d","t":"#191629","u":"#191527","v":"#1a1427","w":"#191129","x":"#141326"},"...........................rxrtr|.........................rpgbbbr|........................qfacbbx.|.......................vfahbbp..|......................pgdidex...|.....................rfancfr....|....................lfchdjq.....|..............r....qfahckw......|.............pv...qgd.dep.......|............slx..pfchcfw........|..........rrit..ufcndkq.........|........tvkio..pfdndkt..........|..tttvxxglio.usfcnckp...........|..ugac.iiin.qkgmndes............|...sxg.mmo..tgminbkx............|qrtg.hnndr.qliiidjpu............|w.aghopkbwr.mmmkwp..............|.scio..sjcwgmmgp..tr............|.semr..wkfcag.t..sfu............|.oho...tfbabsp..qgfv............|.oix...tspbfcxrongs.............|.omu..onlwekkbbkmp..............|.ro..p.gkxpssjjnhu..............|.xw.oihnp....wongfx.............|.q.onoor.......rswx.............|.kr.oc.x........................|.qwpaep.........................|.saabs..........................|.pbbeu..........................|.kplp..........................."],[{"a":"#dff6b1","b":"#b5ec7c","c":"#d3dd8f","d":"#91e485","e":"#5dd365","f":"#70c86d","g":"#d5b072","h":"#dca569","i":"#b2835f","j":"#71a981","k":"#888c66","l":"#218f38","m":"#305f4a","n":"#264532","o":"#302c23","p":"#052b16","q":"#2e1d1c","r":"#1e1c20","s":"#171c1f","t":"#261217","u":"#1e1423","v":"#1b1622","w":"#141623","x":"#191224"},"...........................vuvuu|.........................vrcaacv|.......................vsaabbjs.|....................mvoaabbdvr..|....................nfbbbbjr....|...................saebbbfr.....|..................rabfbbjr......|.................pfbdfdfr.......|................pefbdejv........|...............peeebefr.........|..............peleeems..........|......muuu.xwnfpleelr...........|.......tgu.wlmpllels............|......ohcv.slplllmw.............|wr....qhcv.slllmww..............|tiu..tgauxxussthiw..............|tigxqgctiitigdj.v...............|thiqivvxvvpjdjmr................|.qhit...smjskms.................|.ocgu..tgkkmxr..................|tgcuu.pmkhgv....................|thu...njjmq.....................|tgv..schkv......................|tiawsmkiu.......................|tigtagmr........................|.xrmjir.........................|.ocgmu..........................|.ohix...........................|..uxx..........................."],[{"a":"#eeedc2","b":"#c7d6e7","c":"#eab36e","d":"#9fa8c3","e":"#9ba1bc","f":"#95a1bd","g":"#ab9497","h":"#94655b","i":"#726d8a","j":"#6f6b89","k":"#4c4c67","l":"#3f3c5b","m":"#3f3b58","n":"#423959","o":"#3f395b","p":"#3b3959","q":"#2c2637","r":"#1b1524","s":"#181421","t":"#1c1220","u":"#1f0e1c","v":"#161125","w":"#101025","x":"#0f0b27"},".........................xxxxxv|........................xfbbbbx|.......................vfjlmmfx|......................wbiooolfx|.....................xbeooolpfx|....................xbejoolpfix|...................wbdjjnopeix.|..................rbepjjlpeix..|.................wbejojjpeiw...|................wblojoipejv....|...............wblooippeix.....|............rvwbpoooipejs......|............wbbonoolpeis.......|..........swbdpooplpeis........|........ruabjllfflpfjr.........|......wvgccnoejfflkes..........|.....xejmhcnoonjlpev...........|.....sveficamopelkev...........|.......sruhcmmnpkdvt...........|........vnuhcanngr.............|........x.puhcchcs.............|.......vjvoorhhhu..............|......vjkmvvveniv..............|.....tjklv..reir...............|....ucumr....wes...............|...usugv.....ss................|.uucarv........................|uachcs.........................|uacct..........................|.uhhs..........................|..us..........................."],[{"a":"#cde6e8","b":"#c0d0dd","c":"#c8c5b8","d":"#9ccbc9","e":"#4db8b9","f":"#7fa6b9","g":"#9c9baa","h":"#a98c7b","i":"#5a7c98","j":"#696273","k":"#38455a","l":"#3c364b","m":"#28222d","n":"#281b27","o":"#1d192d","p":"#141e2d","q":"#131729","r":"#181628","s":"#23121f","t":"#1b1324","u":"#181227","v":"#161328","w":"#11142a","x":"#141025"},"......................n.........|.....................mgt........|.....................wbq........|................nm..lbbgn..mm...|...............lbu..pbdbr..xbm..|..............ubgx.rafdgct.qbgt.|..............rao..wbiejgx..qjr.|..............qax..vkiejku..vju.|..............xbgttbjkkkjbmlbjx.|..............qdfpaekieekebkbiv.|..............wekdfiideeiiigkex.|.............mbmjgkkieeeikkfjkbt|.............wbvootckici.cxvoobt|.............rbr...sh.hkhn...obt|.............vfgro..nllln..tobgt|..............pgxgnmwjgjwtogwgp.|..............owxajsjhchjujbvvx.|.............mh.xajtlhchnwjgt...|..........ttshhoubjulshs.ujgx...|..........obghsq.ogjm.n.ojbm....|.........tjjk.bdtvbjvpirojgr....|........mjjkodegr.pbokdkogv.....|.......q.jlvgqpou..oofdgvr......|.....xlggkoqq.......lpeq........|.....rddgo...........wfx........|....tpedm.............m.........|.trollpqo.......................|urbwgkr.........................|scahoo..........................|..acft..........................|.vshwv..........................|..lnu..........................."],[{"a":"#e5bf73","b":"#db9d68","c":"#c3824c","d":"#966653","e":"#9b533e","f":"#7e5145","g":"#664645","h":"#993631","i":"#6f3e3e","j":"#5a3b3f","k":"#523130","l":"#42353a","m":"#3e2f35","n":"#392b31","o":"#721a24","p":"#451f2b","q":"#38212a","r":"#2e222e","s":"#2b121b","t":"#1e1c2c","u":"#1d1626","v":"#1b1425","w":"#211122","x":"#171228"},".n..........xvvutxvr...........|..gl......tr.g.twohkvm.......ur|.md.....xqgiiii.msohhkxxm..umjx|q......njdccbbbbbbfhhhu.lr.rjm.|......ricbsssssohccihhsg.nrkwt.|.....rfbsq......pessphtji.lr...|.....vsn........ihx.kokqif.rn..|.................oir.jwtjdf.mvr|.................jpxwkcfnddggnv|..................vwaabew.dfdfv|..................vdcabmlqgsqn.|..................radict.wgt...|.................sdabdp..wfr...|................vscesn..tvn....|..............vvujsp...sdu.....|.............lv.lwx...kcbv.....|.............pim.t..lqcbm......|.............phntu..kcck.......|............nksq...lcbk........|...........t.r.....sdq.........|..........l.n......wm..........|.........r.r...................|........rjr....................|......vnkn.....................|...tttrkn......................|...sabjut......................|..uakcfx.......................|..wafifx.......................|.tscegwx.......................|mfkssm.........................|sgjt...........................|wrn............................"]];
/* the 25 swords from the third sheet: [palette, rows joined with '|'] */
const SWD=[[{"a":"#fbfcff","b":"#fcfaff","c":"#dcdbe6","d":"#d1cedf","e":"#cccddc","f":"#cda88c","g":"#8a6759","h":"#442f2a","i":"#1c1f29","j":"#301717","k":"#28181e","l":"#231c2a","m":"#241726","n":"#1e1c2b","o":"#1a1b26","p":"#1c1727"},"mm.............|pbo............|lbdp...........|naedn..........|.iadep.........|..oaeen........|...obddn.......|....ibddp..ki..|.....oaedpjgk..|......obdhfgk..|.......lhffj...|.......jffhl...|......kggjk.p..|......lkm..p.n.|............mhn|.............ll"],[{"a":"#fefdff","b":"#fbfdfd","c":"#fafbfd","d":"#faf8fd","e":"#d2d1de","f":"#d0cee3","g":"#cdcae5","h":"#a19eb5","i":"#826176","j":"#431b2b","k":"#241a28","l":"#1f1a2a","m":"#1c1c29","n":"#1b1a29","o":"#1a182a","p":"#1b1426"},"pp........................|pdl.......................|mdfo......................|kafgk.....................|kadego....................|.kcbfgk...................|..nbbefo..................|...nbcefp.................|....laedfl................|.....odchfo...............|......mahdfl..............|.......naahgp.............|........nbhhal............|.........mdhbn............|..........padn............|...........paenno.........|............laacfo........|.............maehgo.......|..............nchghom.....|...............pc.ffm.....|................nfgl......|.............lllgh.k......|.............kfhh.jij.....|..............lllkkjik....|...................jjik...|....................kjjkk.|.....................kkl.k|......................k..k|.......................kl."],[{"a":"#fbfbfe","b":"#f3fef8","c":"#e7fdef","d":"#d3fadf","e":"#dbf5e4","f":"#a4cdab","g":"#9cbca1","h":"#253c2c","i":"#1c2226","j":"#1c1d28","k":"#142123","l":"#161d26","m":"#221924","n":"#291623","o":"#1d1824","p":"#141b1e"},"mom...............|oaap..............|jaaei.............|.jabep............|..oabek...........|...obgdk..........|....jcgek.........|.....ibgdp........|......lbgdk.......|.......jbgdk......|........lbgdpli...|.........icgdel...|..........icggp...|..........jeghm...|..........jlki.o..|..............m.m.|...............n.m|................nm"],[{"a":"#d0d0eb","b":"#d0ceeb","c":"#ceccea","d":"#cacbe9","e":"#a7a9cf","f":"#9b9dc5","g":"#9a9bc5","h":"#908eb5","i":"#797a9d","j":"#726e8f","k":"#2f2536","l":"#1f1a2d","m":"#201929","n":"#251424","o":"#1b192d","p":"#18162b"},"....m...................|...lco..................|..labal.................|.oadiibl................|padifficl...............|ocaifggicm..............|ocdigfggibl.............|.oabiggggibp............|..paaifggfial...........|...odciegffico..........|....odaiffgicop.........|.....oacifgfdddp........|......oaaiffgiboo.......|.......ocaigfgacao......|........lddigffio.......|.........ocdigf.n.......|..........pbci.jkm......|...........lcomkkkm.....|............l..m...m....|................n...m...|.................n..n...|..................mnkn..|....................nm..|.....................mp.|.....................m.m|..................n..m.m|...................mm..m"],[{"a":"#fdfcfe","b":"#dfdef1","c":"#d0cee6","d":"#cdcdd8","e":"#b6b5d1","f":"#806c85","g":"#27212a","h":"#1b1e26","i":"#281b29","j":"#241926","k":"#211929","l":"#2d1324","m":"#1d1b2d","n":"#1d1c23","o":"#1c182d","p":"#17172e"},"...jk................|..nan................|.naan................|jaadan...............|mnhadcm..............|...mceco.............|....ocecm............|.....pcecp...........|......ocecp..........|.......pcecm.........|........mcecn........|.........pcdahhh.....|..........naddan.....|...........mcei......|...........haigl.....|...........mn.lfl....|...............lfl...|................lgio.|.................i.hk|.................jk.j|............kk......j|..............ki....j|..............ki...j.|................jjj.."],[{"a":"#fbfcfd","b":"#e8e7f4","c":"#cdc7d9","d":"#a3a0ae","e":"#9392ab","f":"#5b576f","g":"#211d23","h":"#1b1d2b","i":"#241929","j":"#20192a","k":"#1f182e","l":"#24191c","m":"#291515","n":"#1b1a2c","o":"#17192c","p":"#191629"},"ggi.........................|gacj........................|laacj.......................|.gaaci......................|..gaack.....................|...gadck....................|....jadcp...................|.....gadck..................|......padck.................|.......iadck................|........gadco...............|.........padck..............|..........gadcn..n..........|...........gadcoh...........|............hadfk...........|.............h.eek..nn......|.............pkdefkneo......|............n..oeekdn.......|................hodjg.......|................ndk.l.......|...............nekpi.m......|...............jk...mdm.....|.....................mdm....|......................m.m...|.......................lfii.|........................ij.l|........................j..g|.........................ii."],[{"a":"#fdfefc","b":"#fdfdff","c":"#fcfbfe","d":"#faf9fc","e":"#d8d5e2","f":"#c4aca0","g":"#a38173","h":"#643f3f","i":"#221d24","j":"#2d1a14","k":"#261921","l":"#2c1416","m":"#1d1b2e","n":"#1b1c22","o":"#1f1721","p":"#17162f"},"oinn...............|ibbbi..............|ibddbo.............|ibaacbi............|.nbcedcn....kk.....|..pdaecbi...m.l....|...nadfcem...jgk...|....ncdfdem..jfi...|.....nccfeeojfj....|......naemjfgl.....|.......nejfhfj.....|........jfhhgo.....|....mi..jgfgkm.....|....m.jjflkkmhm....|.....lgfj....php...|......kj......p.io.|...............ml.k|...............i.j.|................l.."],[{"a":"#fcfcff","b":"#f9f8ff","c":"#dad9e7","d":"#d1d0e2","e":"#cfcede","f":"#cfcbdc","g":"#b0b0c3","h":"#292631","i":"#1d1c29","j":"#1e1b28","k":"#211a26","l":"#1b1a2d","m":"#261628","n":"#1f1727","o":"#18182f","p":"#1a1627"},"mj............................|kaj...........................|pafl..........................|kafdn.........................|.kbfdp........................|..jafej.......................|...kafen......................|....kafdn.....................|.....kadel....................|......kaddo...................|.......kbedp..................|........jbedp.................|.........pbfel................|..........iaedl...............|...........ibffo..............|............jbddl.............|.............ibedl............|..............pbffl...........|...............padeo..........|................iaedo.........|.................jaedo........|..................jaedo.li....|...................ibdgogl....|....................jggdo.....|.....................jbg.i....|....................mfkn..m...|....................mm..m..m..|.........................n..n.|..........................m.hk|...........................mmk"],[{"a":"#fcfcfe","b":"#f5f4fc","c":"#cfcfe7","d":"#c0b9d1","e":"#9f9eb6","f":"#9c9cba","g":"#9091b0","h":"#7879a0","i":"#4e4758","j":"#22202a","k":"#221b2a","l":"#1c1b2a","m":"#271720","n":"#201727","o":"#1b1826","p":"#191425"},"...n.....................|..jcp....................|.kaaco...................|naaehck..................|.naefhck.................|..jaefhco................|...oaefhck...............|....oaefhcj..............|.....laefhcl.............|......jaefhcl............|.......laefhcl...........|........oaefhcp..........|.........laffhcl.........|..........laefhck........|...........oaeehcl.......|............pbefhcnk.....|.............jaeem.m.....|..............oameim.....|...............n.imk.....|...............kmnjl.....|.................k.jo....|..................pjjn...|...................l.jnnm|....................lij.m|.....................knm."],[{"a":"#fdfcff","b":"#fcfaff","c":"#faf7ff","d":"#d4d4e5","e":"#cecde1","f":"#bcb1b7","g":"#99909d","h":"#372d33","i":"#1e1d27","j":"#2a1719","k":"#221924","l":"#1f1b27","m":"#1f1725","n":"#1b1a2c","o":"#1b1a24","p":"#1a1729"},"kkkkkkko......................|laaaaaabo.....................|.kkooidgcm....................|......negbk...................|...mkiocegai..................|...maaeeeegcl.................|....nnpnnnegck................|..........negbi...............|......plloicefco..............|......laaaeeeegbo.............|.......lllpppnegci............|..............pdgci...........|..........pionnbegck..........|..........ibabedeegbo.........|...........innnnnnegcn........|..................nefen.......|..............poomocegjj......|..............naaaeeejfhl.....|...............nnilmjffjn.....|...................jggjh.m....|...................ljjklhhk...|........................mhhm..|.........................lhjjm|..........................jfgk|..........................jgjl|..........................kjk."],[{"a":"#fbf8ff","b":"#d1d0e7","c":"#cac0d9","d":"#665e7b","e":"#57556c","f":"#535472","g":"#544455","h":"#2e212f","i":"#1e1d29","j":"#241a29","k":"#1f1927","l":"#281323","m":"#201627","n":"#1b1a2c","o":"#1c1a23","p":"#191528"},"hkmj.....................|mabbn....................|ma.fbp...................|oa..dbj..................|.o..ffbn.................|..i...fbn................|...o..ffbj...............|....k...fbn..............|.....o....bn.............|......o...fbn............|.......kaeffbp...........|........ia..fbp..........|.........i.....j.........|..........oae...n........|...........oae...n.......|............ia...bmn.....|.............i...lgk.....|..............oao.dl.....|...............jedgo.....|...............pmllgk....|...................hgl...|....................lhm..|.....................iiio|......................p.m|......................jmj"],[{"a":"#fcfcff","b":"#ede0d4","c":"#a9a0ab","d":"#9c9eba","e":"#9a9bc5","f":"#9c9bbb","g":"#8988ac","h":"#79799e","i":"#785b55","j":"#322730","k":"#1f1b26","l":"#221a24","m":"#1b192e","n":"#29171f","o":"#2e1518","p":"#1b1629"},"...lkk..............|..laak..............|.laadp..............|.kacfm..............|laadfm..............|ladefm..............|kafeem..............|kadeedk.............|kadeefp.............|kadeefm.............|.kafeem.............|.kadehhm............|.kadhedm............|.pacehhm............|..kadhfdm...........|..kacdhhm...........|...kadhhhm..........|...kachhhm..........|....kadhhhm.........|.....kadhhhlnn......|......madhhiiik.....|.......pahjccil.....|........kfocco......|.........knii.m.....|......ll..ojn..m....|......lioocinm..m...|.......nicio..m..kl.|........non....m.oil|................lc.n|................noo."],[{"a":"#fdfcfe","b":"#ececf5","c":"#ccbbbe","d":"#725e6c","e":"#231f29","f":"#211a2a","g":"#201a23","h":"#1a1b2d","i":"#1b1c24","j":"#241729","k":"#24171e","l":"#211928","m":"#2c121d","n":"#1c182c","o":"#1e1822","p":"#1d152b"},"ff........................|pdl.......................|.fcn......................|..ncg.....................|...oag....................|....gao...................|.....iao..................|......gag.................|.......gae................|........eai...............|.........iai..............|..........iah.............|...........hbh............|............hbh...........|.............hch..........|..............nch.....h...|...............ndnkg.pn...|................hcddnn....|................kccmf.....|................k.mej.....|.................ojjdm....|................phl.mdm...|...............lg.g..mdj..|..................k...jloj|...................ol..p.l|.....................l.fll"],[{"a":"#fdf9fb","b":"#e8e4ef","c":"#bfb0ae","d":"#817177","e":"#282435","f":"#1e1d2b","g":"#261a21","h":"#1d1b2b","i":"#191b2f","j":"#1a1b27","k":"#271820","l":"#1f1927","m":"#28141e","n":"#1a1831","o":"#1a1825","p":"#1a1528"},"hf............................|hdn...........................|.ncl..........................|..lbl.........................|...lag........................|....oao.......................|.....laj......................|......jaj.....................|.......lao....................|........obl...................|.........hbo..................|..........fae.................|...........jah................|............haj...............|.............fbi..ff..........|..............ibh.j...j.......|...............icn.f..n.hj....|................ncn.op.k.p....|..............hh.ndn..mdk.....|..............h.j.hdomcm......|.................i.ladm.......|.................i.gacg.......|...............oi.kckk.n......|.................m.m..n.n.....|................lem....n.n....|................ol......n.n...|.........................i.gg.|..........................mcem|..........................mcdg|...........................mm."],[{"a":"#fcfcff","b":"#faf8ff","c":"#c5c3d0","d":"#a09fb2","e":"#9f9daf","f":"#9692ab","g":"#52394f","h":"#1e1f27","i":"#231a25","j":"#1f1b27","k":"#1e1a2d","l":"#1a1b28","m":"#1a1829","n":"#251629","o":"#2f1020","p":"#1b1628"},"..iiii.....................|...iabl....................|i...jeai...................|ij...keai..................|iak...ndbj.................|iaek...keai................|.hbem...pdbi...............|..ladm...mebi..............|...hbem...kebj.............|....lbdk...kebh............|.....laem...keah...........|......lbek...meah..........|.......lbdk...kdah.........|........mbek...kebp........|.........lbek...meap.......|..........lbek...kdblkk....|...........hbdk..ndgdfp....|............lbdkn.ndfk.....|.............jaedn..kn.....|..............lagd..gn.....|...............kdfnggo.....|...............lfkkoogo....|...............ii....ogo...|......................ogi..|.......................onii|........................i.p|........................jpj"],[{"a":"#fdfcff","b":"#fafafe","c":"#d6d7e6","d":"#cfcee1","e":"#cccce3","f":"#c6c0ce","g":"#ada1a2","h":"#8a88a5","i":"#483b45","j":"#201c25","k":"#241b1f","l":"#1b1a27","m":"#28171a","n":"#1f1628","o":"#19172b","p":"#1b132b"},"jjln.....................|lbddo....................|jbdddp...................|jaadedo..................|.jbadden.................|..jaadeeo................|...labdedl...............|....lbadeeo..............|.....laadedo.............|......laagedo............|.......jbbgedo...........|........jabheeo..........|.........jabheeo....no...|..........jbdhheo..k.l...|...........lbgiggnm.n....|............jbgihigm.....|.............oghigm......|..............nigik......|..............mgmk.o.....|.............m.m..o.o....|............nin....o.o...|............kk......o.p..|.....................p.j.|......................kgm|.......................kk"],[{"a":"#fdfcff","b":"#f9fbfe","c":"#f9f8fe","d":"#d7d6e8","e":"#cecde4","f":"#c9c7e6","g":"#9e9fb6","h":"#9a99b0","i":"#7b7a94","j":"#302e3d","k":"#1e1c29","l":"#1f1a27","m":"#1b1a2d","n":"#211827","o":"#1f141f","p":"#1b182b"},"nnoo........................|nbcco.......................|ocggco......................|oahggck.....................|.oagie.l....................|..oaefecl...................|...k.eggbn..................|....oagie.l.................|.....pceeeao................|......mieghal...............|.......kchif.k..............|........kaffebl.............|.........p.eggbk............|..........kbgid.p...........|...........kbefebk..........|............k.eggam...mm....|.............magieik.pim....|..............pcefeckkp.....|...............m.ehmgm......|................pcmeim......|.................kgijn......|................mmmmljn.....|...............mip...n.n....|...............nm.....o.o...|.......................n.o..|........................njmk|.........................mik|.........................mml"],[{"a":"#fefefe","b":"#fcfefe","c":"#fdfcff","d":"#fcfafc","e":"#d6d5e8","f":"#cecbe7","g":"#bfa794","h":"#a39aaf","i":"#8c604f","j":"#4b3337","k":"#211c26","l":"#1c1c25","m":"#2a181f","n":"#291217","o":"#1d192a","p":"#1c1626"},"kp...........................|kcl..........................|kccl.........................|kaacp........................|kaacl........................|kaabp........................|kaabho.......................|kabbhho......................|kabahfho.....................|kcbchfffp....................|kdcchfffeo...................|.laachfffeo..................|.laddhfffhfo.................|..ldcchffhfeo................|...ldbbffhfhfo...............|....olcaffehhfo..............|......olcafhhhfo.............|........olbcfhhho............|..........llbdfhhnmmk........|............oohhhiiijo.......|..............ojjginmp.......|..............lgggnjjko......|..............lddgnj.jjkk....|..............kddgimmk.jjpool|..............migggijmmk.jnjm|...............niggiiijjmniin|................njiiijnk..nn.|.................mmmmm......."],[{"a":"#b3b1ce","b":"#7c7d9b","c":"#7b7897","d":"#77779b","e":"#58597b","f":"#585778","g":"#56557d","h":"#534260","i":"#31182a","j":"#23192d","k":"#1f1a30","l":"#1e172c","m":"#1b1b32","n":"#181b32","o":"#1a182f","p":"#19152b"},".....j..................|....kj..................|...kcl..................|..kbfl..................|.kbgel..................|jcdge.l.................|.lbdeffl................|..obdgffl...............|...mfeff.p..............|....odbff.p.............|.....obdfefm............|......nbbfefm...........|.......nfbef.o..........|........mcdgf.k.........|.........mdde..om.......|..........mbd.na.n......|...........nbnaaak......|............kaaakj......|...........paaakiii.....|...........k.am.ihhj....|............lcm..iiij...|.............pcm..ihhjml|..............jck..iij.l|...............l.j..jacl|................ol...plj"],[{"a":"#fdfbfe","b":"#d4d4e7","c":"#cecdec","d":"#cecdde","e":"#c9c2d5","f":"#b9a098","g":"#a49bb2","h":"#876e6f","i":"#604443","j":"#231d28","k":"#221a24","l":"#1b1b2a","m":"#2d1519","n":"#221725","o":"#1c1829","p":"#1d1524"},"kkkno.........................|kaaaep........................|kaaaaak.......................|kaaddaak......................|odaddddak.....................|.paadccbap....................|..padcgcddj...................|...padcggadp..................|....padggdaj..................|.....ldadbcgl.................|......ldacgccl................|.......llgcgccl...............|.........lccgccl..............|..........odcgccl.............|...........lccgccl.......ll...|............lddgcgl.....kip...|.............ldbhcgl...khij...|..............lgcgghjmmfhm....|...............lgghihffhm.....|................lhifffhm......|.................lhf.ihm......|.................mffi.ik......|.................mfhh.jin.....|................mfhmmm..jk....|...............mhhm...njiin...|..............piim.....ni..o..|..............njp....p..n..jo.|..................n.n....poj.n|..................k.n....no..j|...................ojjjjn..kn."],[{"a":"#fdfcff","b":"#f0edf7","c":"#cfcde0","d":"#b9b0b8","e":"#9f9eb0","f":"#6f5667","g":"#2b202d","h":"#1b1e2a","i":"#201b2f","j":"#241a1f","k":"#2c151f","l":"#221826","m":"#1c1a2a","n":"#1c182a","o":"#191925","p":"#181628"},"ool.........................|laaj........................|lacal.......................|.jaeao......................|..laeep.....................|...iecin....................|....oaaell..................|....loecao..................|......ioaei.................|.......iecim................|........oaaeii..............|........ioecao.....im.......|..........ipaep....pcm......|...........mecin....mao.....|............maaeoo..pcm.....|............ioecaohmncm.....|..............iicecacem.....|...............neeijji......|................pejd.l......|............in..pajdkl......|............hcmhiclkggk.....|.............haccei.kggl....|..............lmmo...lggk...|......................jggk..|.......................kgkj.|........................ldfk|........................jjfj|..........................jl"],[{"a":"#fafbff","b":"#f1eef9","c":"#d0cfe0","d":"#cecbe1","e":"#aaa8b9","f":"#675561","g":"#42303a","h":"#372c35","i":"#281c29","j":"#201b2d","k":"#1c1b29","l":"#1a1925","m":"#251724","n":"#211424","o":"#1d1724","p":"#1a1422"},"i......................|om.....................|oaj....................|kaep...................|paedj..................|.paecj.................|..laecj................|...kaedj...............|....oaddj..............|.....laecj.............|......oaccj............|.......kbdcj...........|........kacdj..........|.........kaddj.........|..........laedj........|...........kaccl.......|............laedk......|.............paeck.....|..............laeho....|...............j.hhm...|................mggho..|.................mgghl.|..................kgghj|...................mghj|..............in...mghm|..............mhm..nhhm|..............n..mpgghi|...............n...hhm.|................mmmmm.."],[{"a":"#e0ddf2","b":"#cfcce7","c":"#8684a5","d":"#7c7a99","e":"#7b799e","f":"#575572","g":"#1e1d2e","h":"#1e1c2c","i":"#1f1a31","j":"#1c1b2e","k":"#1e1a29","l":"#1a1a2f","m":"#1e182d","n":"#18182e","o":"#1d162b","p":"#19122b"},".k.....................|.k.....................|kbg....................|kbi....................|obeh...................|mbei...................|kbedp..................|kbeei..................|.nbe.h.................|.lbdden................|..jbdefn...............|...nbbddi..............|....ngbefi.............|......ibedg..j.........|.......ibd.ll..o.......|........kbedl...k..jh..|.........lbefi..h.lfk..|.........gjbddip.jdi...|........l..ibpbik.i....|............ka.bkh.....|.........m..kkaag......|..........km.gmo.j.....|............g.o.g.p....|...........i.k...i.m...|..........k.o.....n.m..|..........kk.......i.kk|....................hak|....................ik."],[{"a":"#fdfbfe","b":"#e7e6f2","c":"#d0cfe4","d":"#cdcbe6","e":"#a9a9c3","f":"#8482a4","g":"#413440","h":"#24202b","i":"#211b2d","j":"#221b24","k":"#211928","l":"#1f1b25","m":"#1c1b2f","n":"#1a1b25","o":"#211726","p":"#191526"},"nnlj......................|jaaakk....................|jaedaj....................|oaceecik..................|.kaefdak..................|.hhcceckpj................|...kacccal................|...kkpcecljp..............|.....iacddam..............|.....kilcedcnn...nm.......|.......iadfean..nai.......|.......mncefccmmcal.......|.........nadffddecm.......|.........nldffikfdmmn.....|...........mdiggmeean.....|...........mdm.jhmdi......|..........lcefp.gkk.......|.........naaddemjggi......|.........npmmmeck.g.p.....|.............kal.igggi....|.............jj...ogg.m...|...................jggkok.|....................iko..p|.....................k...p|.....................k...l|......................lph."],[{"a":"#fdf6ff","b":"#ffeffe","c":"#d4c2d7","d":"#d5bcd4","e":"#8c8196","f":"#806f82","g":"#42323b","h":"#21202c","i":"#211b28","j":"#1e1b29","k":"#1c1b2c","l":"#1c1b25","m":"#1c1928","n":"#241828","o":"#261424","p":"#1c1728"},"n.....................|jl....................|lai...................|ladon.................|ladcn.................|lkedepl...............|..ibcbp...............|..jnfcepm.............|....pbcaj.............|....khecejk...........|......mbcam...........|......kkedfmk.........|........kbcbj.........|........kkfdfjk.......|..........kbcbp.......|..........kpednp......|............jbdeh.....|............jaceep....|............lalacgi...|............hl.lg..i..|............p...og.go.|.................oggo.|..................ofgo|..................nghi|..................lael|..................nijj"]];
/* the 14 upright swords from the fourth sheet: [palette, rows joined with '|'] */
const VSW=[[{"a":"#f2d290","b":"#efa24e","c":"#e6a44b","d":"#e49e45","e":"#aeaa8c","f":"#e69b43","g":"#df9b42","h":"#d6863f","i":"#c77741","j":"#5284a5","k":"#c26c3c","l":"#c3693b","m":"#c16636","n":"#b7602e","o":"#7b5f55","p":"#874a37","q":"#6b3020","r":"#304061","s":"#190d16","t":"#180a18"},".......ahi......|......anqpi.....|......hshqcs....|......pnqkp.....|.......bgn......|.........s......|.......rrr......|................|.......rr.......|................|.......rr.......|.......r........|.......rr.......|..........t.....|......jjjjr.....|...jjjj.j.rjjj..|..jrjrr.j.jrjrj.|.jrjttr......jrj|ejrt..kp.ppst.rj|jj....gspqhs...j|......ap.ci.....|......aqiqi.....|......appqi.....|......ap.pi.....|......ap.pi.....|......apppi.....|......gappis....|......ggqkk.....|......ggakk.....|......gfffls....|......gfffl.....|......gffnm.....|......gfnbls....|......bnnnl.....|......gbcnl.....|......dnnbl.....|......gbbmm.....|......dnmml.....|......dfnbm.....|......dnbnl.....|......dbnnk.....|......cnnbks....|......cnbck.....|......dfddks....|......gdffls....|......gdffl.....|......gffnk.....|......gfnbk.....|......dnnbm.....|......dnbnk.....|......dbnbk.....|......cnbmks....|......annbk.....|......ammni.....|......amlni.....|......cmmbi.....|......ckbmks....|......aklib.....|......aklkcs....|.......iibs.....|.......akcs.....|.......alct.....|........gqt.....|........cs......"],[{"a":"#fcfcf1","b":"#fafaee","c":"#faf9ee","d":"#dedfda","e":"#b4b9b9","f":"#afadab","g":"#aeaaaa","h":"#a6a8a8","i":"#7a8c97","j":"#62707d","k":"#656a7b","l":"#64687b","m":"#5b6773","n":"#56646f","o":"#55636d","p":"#9c4354","q":"#53626e","r":"#271320","s":"#210a1a","t":"#130919"},".....i.......|.....dj......|.....al......|....iak......|....iaet.....|....akfo.....|....ajgo.....|....bkgq.....|....akgn.....|....akgn.....|....bkgn.....|....ckgq.....|....ckgq.....|....ckfo.....|....ckfo.....|jt..ckfo.....|....ckfo.....|....ckfot....|....clgo.....|....clho.....|....clgo.....|....blgn.....|....blgn.....|....clgq.....|....clgo.....|....ckgo.....|....blgq.....|....blgq.....|....clfot....|....ckfo.....|....ckfot....|....bkfot....|....ckfnt....|....akfn.....|....bkfnt....|....blgnt....|....cldm.....|....blfmt....|....blcnt....|....bkent....|....anmnt....|....ddhqt....|....cihnt....|d...idmit..d.|kd.ieiiii.cme|mqcieakendjj.|ttqqijjmmt.tt|..t.qdft.....|.....prt.....|.....rps.....|.....pr......|.....rp......|.....pr......|.....rp......|.....pr......|.....rp......|.....pp......|....hhhm.....|...oidift....|....fcejt....|.....km......|.....tt......"],[{"a":"#a1bea4","b":"#9aa082","c":"#659b8e","d":"#688782","e":"#4a7d7e","f":"#626d65","g":"#466b68","h":"#436668","i":"#406764","j":"#3a686c","k":"#915a40","l":"#405353","m":"#3b575e","n":"#345d5f","o":"#2f5366","p":"#2b4c58","q":"#424349","r":"#2a4048","s":"#182648","t":"#150a1a"},".....kk......|....babk.....|...kkkkkt....|....akk.t....|....hac......|.....ost.....|.....co......|.....os......|.....eo......|.....os......|.....cj......|.....ept.....|.....opt.....|....dact.....|...irrrgr....|.ccgcdcggcc..|cp..gabf.rgc.|e.t..qq...rde|.tt.d..g...mr|.t..rdrc...rt|....d.d......|....mg.......|....ng.......|....nc.......|....nn.......|....mni......|....ndrq.....|....dip......|....dre......|....re.......|....rml......|....mn.......|....m........|....me.......|....mph......|....le.......|....pee......|....hrp......|....hh.......|....h........|....hg.......|....gip......|....giq......|....ic.......|....ic.......|....icl......|....grl......|....hh.......|....hil......|....ii.......|....ih.......|....ii.......|....ii.......|....ii.......|....ii.......|....i........|....c........|....g.mm.....|....m.om.....|.....dh......|.....dh......|.....po......|.....omt....."],[{"a":"#f2eee3","b":"#e6e1d9","c":"#e3dad0","d":"#bfb7b3","e":"#b9b6b5","f":"#b6b5b0","g":"#b8b2ae","h":"#b5b2aa","i":"#d3a188","j":"#b2b1ab","k":"#8c959f","l":"#d55c52","m":"#797888","n":"#717b91","o":"#6c798c","p":"#5e6e86","q":"#b63842","r":"#97212c","s":"#5c121e","t":"#180a17"},"......k.......|.....pa.......|.....acp......|....oabo......|....kbjot.....|....abjnk.....|....ahjpkt....|....ahhne.....|....ahhne.....|....dhhnn.....|....dghnn.....|....dghne.....|....dghne.....|....bghne.....|....bhhne.....|....bhjne.....|....bhjnf.....|....bhhnf.....|....bhhne.....|....bghne.....|....bghne.....|....bghnf.....|....bghng.....|....dgfnj.....|....bghnj.....|....bgjoe.....|....bfhne.....|....bfhoe.....|....bgjnd.....|....bfjnd.....|....bmjnd.....|....bnjnd.....|....bmfnd.....|....bmonet....|....bmfoet....|....bmpoet....|....bmfoe.....|....bkonet....|....bkeod.....|....bpeoe.....|....bkknet....|....bpjne.....|....bql.et....|....csqsj....l|l...qqqqr...lr|llilrlclrlilrl|rqlqrlilsqqrqt|tt.tqrqsqt....|.....qiqtt....|.....sqtt.....|.....rsrt.....|.....sqt......|.....qrr......|.....rqs......|.....sqr......|.....qrr......|.....sqt......|.....rrr......|.....lll......|....lkbpl.....|....qpkplt....|.....lllt....."],[{"a":"#d4d1ac","b":"#9caca8","c":"#92a1a3","d":"#87a0a9","e":"#8d9fa1","f":"#919da1","g":"#889da7","h":"#cb8642","i":"#829aa3","j":"#52777e","k":"#b45e33","l":"#774d3d","m":"#3d4d60","n":"#2e434f","o":"#2f3243","p":"#491a1d","q":"#190916","r":"#150b1a","s":"#130d1a","t":"#130b19"},"....jdj......|....bjj......|...mjdjh.....|...ojmhqr....|....khnr.....|....t.sr.....|....nm.r.....|......sr.....|....nj.r.....|....s.ss.....|....nj.s.....|.......t.....|....nn.s.....|.....hlq.....|aahahhhhahh..|hhhkkakkkkkh.|hll.hhk..khkq|qqrillljrqppq|q..j.hhjqrqq.|...bmkpdr....|...bbjbbt....|....j.m......|....jji......|....j.i......|....j.i......|....j.d.r....|....j.b.r....|....d.b.r....|....dmd.r....|....djc......|....d.d......|....dod......|....dod......|....dod.r....|....dog.r....|....dog.r....|....dog......|....gog......|....gog.s....|....g.g.s....|....d.d.s....|....gog.s....|....iog.r....|....dog.r....|....dog.s....|k...d.d.t....|kq..gog.r....|q...gog......|....gog......|....gog......|....dog......|....dog......|....dog......|....dog......|....dog......|....dog.s....|....dog.s....|....gog.r....|....god......|....god......|....bog......|....biir.....|.....ai......|.....at......|......s......"],[{"a":"#f9faf1","b":"#f4f7f0","c":"#ccd1c9","d":"#c0c2bb","e":"#afb9b6","f":"#b2a69a","g":"#6a8190","h":"#5b6e7a","i":"#5b6c78","j":"#586875","k":"#db5958","l":"#cc434b","m":"#4d5261","n":"#ad313e","o":"#a12432","p":"#741825","q":"#43506b","r":"#3a3e50","s":"#1f0815","t":"#130a1a"},"....kffo.....|...nkqhkn....|...kjqeqn....|...pkqqks....|....ndkps....|.....pps.....|.....op......|.....lnt.....|.....npt.....|.....ont.....|.....lpt.....|.....oos.....|.....los.....|.....pps.....|...kkllls....|.kkoppppnkk..|.lss.olmtslog|ks..gopgt.sl.|n...gpmgt..pn|s...co.gt....|....c.eh.....|....drcht....|....dreht....|....ereh.....|....ereit....|....arbit....|....amch.....|....drei.....|....dmbi.....|....emeh.....|....ameh.....|....bmeh.....|....cmei.....|....cmbi.....|....cmdh.....|....emdh.....|....emai.....|....dmej.....|....amai.....|....bmah.....|....dmeh.....|....drch.....|....cmdj.....|....ambj.....|....dmaj.....|....dmeht....|....ameh.....|....cmbh.....|....cmeht....|....dmeh.....|....dmdht....|....amei.....|....amai.....|....emcj.....|....emcj.....|....emei.....|....emei.....|....dmej.....|....demj.....|....cemj.....|.....eqt.....|.....egt.....|.....egt.....|.....ftt.....|......t......"],[{"a":"#74a393","b":"#608f79","c":"#5e8d79","d":"#5e8a79","e":"#5d877d","f":"#558871","g":"#5d827a","h":"#51816c","i":"#4d7667","j":"#46695d","k":"#3f6654","l":"#416353","m":"#406452","n":"#3c6352","o":"#406057","p":"#374e54","q":"#1d212a","r":"#130d17","s":"#150b19","t":"#120b18"},"....eeep.....|...ip..j.....|...i.aeo.....|...peopi.....|....paas.....|....t........|....slr......|....s.mr.....|....sk.......|....s.nr.....|....sk.......|....sr.......|.....hnr.....|....s..s.....|....rn.r.....|eeeaaaaaaeee.|o......r..pii|....ip.o.....|....i.jo.....|....i.qgs....|....i..ds....|....iq.dt....|....iijfs....|....ipehr....|....i.pi.....|....ipghs....|....hdqhr....|....hikfr....|....hkkfs....|....fklfr....|....fnldr....|....fnldr....|....ffmd.....|....fmmdr....|....ffldr....|....fmmdr....|...pfflcr....|...pfmldr....|...enhldr....|...enkkbr....|...ckklbr....|...bnknbt....|...bkmncr....|...bnmnbr....|...bhmlcr....|...bhmlcr....|...bnmmcr....|...bkmlcr....|...kkmlbr....|...bnnmbr....|...kfmlbr....|....fmlir....|....fmlir....|....cmlhr....|....cmlhs....|....ckkjs....|....ckkjt....|....ckkpt....|....kjipt....|....fkfr.....|....cnfs.....|....pjfr.....|....paps.....|.....ar......|......s......"],[{"a":"#fbfcf4","b":"#e6f1f1","c":"#d8dbdb","d":"#b0d6ec","e":"#9fd1ef","f":"#9dcdec","g":"#9ccbea","h":"#abc2d3","i":"#8fbdde","j":"#77accc","k":"#75a6c6","l":"#859eac","m":"#6895b8","n":"#6294b4","o":"#618eb3","p":"#5f8ab3","q":"#6f7480","r":"#49658b","s":"#334165","t":"#1e1728"},"........n.......|........a.......|.......hmr......|.......amr......|.......amit.....|......aakje.....|......aakje.....|......akjjn.....|......ajjjo.....|......jjkje.....|......jkkke.....|......akkkk.....|......gkkkk.....|......gkkkd.....|......akkke.....|......akkkk.....|......akkkk.....|......dkkke.....|......dkkke.....|......ckkke.....|......ckdme.....|......cdnme.....|......codme.....|......cdnmf.....|......conne.....|......ceene.....|......coonf.....|......cpenf.....|......cppmf.....|......cpfmf.....|......ifgnf.....|......gppof.....|......gpgmf.....|......gppmg.....|......gpfng.....|......gpgog.....|......gppog.....|......gpppg.....|......gpfog.....|......gpsog.....|......fosog.....|......fpfpg.....|......foosg.....|......fpfsg.....|......goqsg.....|......g.qsi.....|......gltli.....|......g.l.i.....|......gqtqj.....|.ah...k.q.j...ah|cssh..bjajrt.ahs|spsshcsbrcshao.m|..orsscrpchstsqt|..trjmskporrkrtt|....t..........t|.......ss.......|................|.......ss.......|.........st.....|........r.......|.......sss......|.........rt.....|.......ss.t.....|.........s......|.......bkpt.....|......c...r.....|......l...o.....|......sq........"],[{"a":"#b3bb9b","b":"#9b8e60","c":"#5f919e","d":"#717b71","e":"#44738d","f":"#41708a","g":"#92553a","h":"#436175","i":"#3a5b6f","j":"#335a76","k":"#325370","l":"#8b4733","m":"#813f34","n":"#68342d","o":"#622a24","p":"#532421","q":"#35404d","r":"#302c44","s":"#230d19","t":"#140b1a"},".....e.......|.....cq......|....ecf......|....acfj.....|...fcffqt....|...ceffrr....|...cajjjr....|...ic..jr....|...ie..jr....|...ie..kr....|...ce..kr....|...ie..kr....|...ce..kr....|...fe..kr....|...ff..jr...a|...ff..kr..ab|...ff..jk...g|...ff..kk...t|...ff..kj....|...ff..kj....|...ff..kr....|...ff..kr....|...ff..kr....|...ff..k.....|...hf..k.....|...hc..k.....|...icblkk....|i..iclg.k..q.|qh.cqaacqk.q.|.qhqabbmcci..|...bddddq....|ccqmbqbqdqccc|ki.dnbqbq.iic|..trdgbirtttq|....crrctt.t.|....tbg......|....tt.......|....o..o.....|....m..o.....|.....ngo.....|....pgp.t....|....ms.lt....|....p........|....omp.t....|....npmnt....|.......n.....|....ll.......|....p.got....|....n..lt....|....onp.t....|....opmpt....|....omppt....|....g.llt....|....pm..t....|....noont....|....nomnt....|....pppot....|....llos.....|....plop.....|....oogot....|....oopnt....|....gp.nt....|....nl.pt....|.....gp......|.....gp......|.....np......"],[{"a":"#f9f8ec","b":"#f9f4e9","c":"#efd18c","d":"#b1a680","e":"#819d9f","f":"#7f9c9e","g":"#d38642","h":"#e06750","i":"#93735d","j":"#52696f","k":"#44565e","l":"#41555d","m":"#b5453d","n":"#ae2c36","o":"#7d312c","p":"#7a1b27","q":"#41545d","r":"#2f2933","s":"#1d0912","t":"#160b18"},".....cc......|....cggc.....|....gffmt....|....ggmgs....|....oggo.....|.....oos.....|.....ms......|.....oot.....|.....ost.....|.....mot.....|.....prt.....|.....mpt.....|.....mms.....|.....pps.....|..ccccccgc...|cgggmmooggcg.|mmsrgggms.omg|ostt.md...sog|s...qg.f...sm|....j.gj....t|....e.rjt....|....ek.j.....|....ekkjt....|....bkfj.....|....bfke.....|....aqke.....|....afqe.....|....aqqe.....|....afqf.....|....akle.....|....aqqe.....|....aqqf.....|....aqqf.....|i...aqqf.....|ot..bqle.....|o...bqket....|....bqle.....|....aqlft....|....blqf.....|....bklf.....|....bkff.....|....aklf.....|....blqet....|....aqqe.....|....akqft....|....akqe.....|....akqe.....|....akqe.....|....akqe.....|....akqe.....|....akqe.....|....bkket....|....blket....|.o..ekket.o..|nhpmjjjj.nhn.|nnhhhhhhhhnnt|..pmnnmmnpps.|..tsrpppst...|.....nn......|.....pp......|.....pnt.....|.....hns.....|.....pp......|.....mp......|.....pmt.....|.....hpt.....|.....ppt.....|....ommo.....|....hbcn.....|.....mn......"],[{"a":"#f5f1e9","b":"#ede5d6","c":"#ebe4dc","d":"#eae2db","e":"#ebd2a5","f":"#c4af91","g":"#b5a595","h":"#a8a4a5","i":"#a7a2a5","j":"#a6a2a4","k":"#a5a0a0","l":"#a59fa3","m":"#b89472","n":"#ad6d3a","o":"#60696a","p":"#4f4c4e","q":"#504542","r":"#354151","s":"#3c373e","t":"#1a0b14"},"......i.......|.....oak......|.....aad......|....kaaek.....|....hhaah.....|....hhhah.....|....hhhhh.....|....hhhhht....|....hhhhd.....|....hhhhd.....|....iihhd.....|....hjhdd.....|....ijhhd.....|....ijidc.....|....ijjhc.....|....ijlhc.....|....iklhc.....|....iklhc.....|....ickdd.....|....ikkkdt....|....ickcd.....|....lkddd.....|....lcdkc.....|....lkkjd.....|....lckcc.....|....ikckc.....|....ickcc.....|....ikclc.....|....jckdc.....|....jkkkd.....|....neefn.....|....nnnnn.....|....neemn.....|fnnnmqpqmmnmnm|nennnofomnmqfq|tnenmsornnenqm|ntt.enrrmqt.nt|t..tqfemnt..tt|....o..q......|.....mn.......|..............|....s.........|....r.........|....rrr.......|....r..r......|....rrrr......|....r.r.......|....r.........|.....oo.......|....rrrr......|....r.........|....r.........|....r.........|....rro.......|....roor......|....r.s.r.....|....r.r.r.....|.....p........|....rr.r......|....r..r......|.......r......|..............|.......r......|.......r......|....r..p......|....rpsst.....|.....rrr......|......rt......|......t......."],[{"a":"#cdcab8","b":"#8d9da0","c":"#76858a","d":"#58757f","e":"#5f6267","f":"#4c606a","g":"#4b5c65","h":"#485b64","i":"#435760","j":"#963337","k":"#4c3442","l":"#3e4f57","m":"#3e4d56","n":"#3d4752","o":"#3a4c55","p":"#384650","q":"#1c1d2b","r":"#140c1b","s":"#190a17","t":"#130a19"},".....c.......|....fai......|....bbf......|....abb......|....bbb......|....abbr.....|...cacac.....|...cabacr....|...cpbmcr....|...cnancr....|...oobpor....|...oobpor....|...omapor....|...omcpor....|...llmpmt....|...mmanl.....|...mmaplr....|...dmmllr....|...fmmll.....|...fodmlr....|...follmt....|...domllt....|...mmnlir....|...noclir....|...fofiit....|...fomlg.....|...fpfof.....|...fpfofr....|...fffngt....|...f.fnfr....|...g.f.fr....|...g.g.g.....|...g.h.h.....|...g.h.gr....|...g.h.gr....|...g.h.gr....|...g.h.hr....|...h.h.h.....|...h.h.h.....|...h.h.h.....|...i.g.g.....|...h.f.g.....|...h.f.gr....|...h.f.g.....|...h...h.....|...h.g.hr....|...h.p.hr....|....ldpd.....|...ddkcft....|...dkjkbt....|d..ickji...bd|a..i.dnitfcap|cbabblbbabaor|toddddddddr..|.ttr.........|..rsjjk......|....jkj......|....kjks.....|....jkj......|....kjk......|....jkj......|....kjj......|....jkk......|....aaa......|...jkknj.....|...jkccjs....|....bajss....|....sjjs.....|.....ss......"],[{"a":"#ead6a0","b":"#b4d5df","c":"#b8af88","d":"#8aa1a2","e":"#789fb4","f":"#74a2b1","g":"#cc8e43","h":"#9a8467","i":"#6995a3","j":"#5a7e92","k":"#9f5d26","l":"#7d4e34","m":"#445c6d","n":"#355263","o":"#344451","p":"#2d1e23","q":"#140c1a","r":"#160b18","s":"#1b0813","t":"#150a18"},".....cg......|....coog.....|...gobiog....|...goiiog....|...lgoogs....|....lagsr....|.....kkt.....|.....akr.....|.....ggr.....|.....akr.....|.....ggt.....|.....aks.....|.....kks.....|.....aks.....|....gkkk.....|gagkamjgggag.|gsrskankssrgk|lrr..ggsqqrl.|....mpp......|.....kks.....|.....gks.....|.....llr.....|.....ldt.....|.....imq.....|.....miq.....|.....iiq.....|.....ii......|.....iiq.....|.....im......|.....mit.....|.....jmq.....|.....jmq.....|.....jeq.....|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....ef......|.....efq.....|.....efq.....|.....efq.....|.....meq.....|....nbiq.....|....bifi.....|....bijbj....|...iionii....|...bnejne....|...mbmme.....|....mbiiq....|....o...q....|.....ont.....|.......q.....|.....onq.....|.......q.....|.....nnt.....|.....n.q.....|.....nnq.....|.....o.q.....|....njm......|....ebjo.....|....mbfo.....|.....moq....."],[{"a":"#faeab0","b":"#f6e5ac","c":"#f7d781","d":"#f9cd69","e":"#f1cc63","f":"#f4c65d","g":"#edc45e","h":"#ebb559","i":"#de9e4b","j":"#c47f37","k":"#bc6f30","l":"#b1652d","m":"#af592f","n":"#a4552c","o":"#a14e2a","p":"#944327","q":"#653734","r":"#200b0f","s":"#180b17","t":"#190814"},".....i.......|....qcl......|....jdd......|....adc......|....aed......|....beeps....|....beeps....|...meffmt....|...meffmt....|...mfffmt....|...mfffmt....|...bfffmt....|...bgffm.....|...cgflmt....|...aglfmt....|...agflm.....|...agldnt....|...affkmt....|...bgldnt....|...bgffnt....|...bgflmt....|...bgldnt....|...bihkmt....|...cildnt....|...ciddns....|...adeknt....|...aekcot....|...gekdos....|...bgkdos....|...agddot....|...afjjos....|...bfldot....|...bgfdot....|...bgldot....|...egfdos....|...agfkos....|...agkdo.....|...ddkdot....|...ddkdot....|...hdddot....|...gikko.....|...kiccps....|hq.kiicks.pi.|mfnpikkhrehpj|inohjrgfenoir|ricpoccpohit.|.sthhlliirr..|...t...t.....|.......s.....|....s........|....sq.......|....s........|....sq.......|.............|....sq.......|.......r.....|....chhi.....|...hir.cq....|...lg..gr....|....mhhr....."]];
const BLADES=WPN.concat(SWD,VSW);   /* 48 wall blades; the wall shows a different, never-repeating handful each dawn */
  /* lengthen a sword sprite: find the crossguard (widest row), then repeat one plain blade row (60% of the way down the longer side) n extra times, so the blade grows and the hilt and tip stay untouched */
  function longBlade(rows,n){
    if(!n)return rows;
    let g=0,best=-1;rows.forEach((r,y)=>{const c=r.replace(/\./g,'').length;if(c>best){best=c;g=y}});
    const down=rows.length-1-g>=g,side=down?rows.length-1-g:g;
    const m=Math.max(0,Math.min(rows.length-1,down?g+Math.round(side*.6):g-Math.round(side*.6)));
    const o=rows.slice();o.splice(m,0,...Array(n).fill(rows[m]));return o;
  }
  const HQ=8;   /* sword / axe sprites are drawn 8x8 device blocks per art pixel */
  function wpnCv(i,k,extra){
  const P=BLADES[i][0],rows=longBlade(BLADES[i][1].split('|'),extra||0),h=rows.length,w=Math.max(...rows.map(r=>r.length)),c=document.createElement('canvas'),x=c.getContext('2d');
  c.width=w*HQ;c.height=h*HQ;
  rows.forEach((r,y)=>{for(let j=0;j<r.length;j++){const col=P[r[j]];if(col){x.fillStyle=col;x.fillRect(j*HQ,y*HQ,HQ,HQ)}}});
  c.className='sfa-ax';c.style.imageRendering='auto';c.style.width=w*k+'px';c.style.height=h*k+'px';return c;
}
function dgCv(j,k){   /* one of the five dagger-board daggers (DAGSK) drawn on a canvas, same 8x blocks as wpnCv */
  const P=DAGSK[j][0],rows=DAGSK[j][1].split('|'),h=rows.length,w=Math.max(...rows.map(r=>r.length)),c=document.createElement('canvas'),x=c.getContext('2d');
  c.width=w*HQ;c.height=h*HQ;
  rows.forEach((r,y)=>{for(let i=0;i<r.length;i++){const col=P[r[i]];if(col){x.fillStyle=col;x.fillRect(i*HQ,y*HQ,HQ,HQ)}}});
  c.className='sfa-ax';c.style.imageRendering='auto';c.style.width=w*k+'px';c.style.height=h*k+'px';return c;
}
function skCv(sp,k){   /* any [palette, rows] sprite (the wall bows) on a canvas, same 8x blocks as wpnCv */
  const P=sp[0],rows=sp[1].split('|'),h=rows.length,w=Math.max(...rows.map(r=>r.length)),c=document.createElement('canvas'),x=c.getContext('2d');
  c.width=w*HQ;c.height=h*HQ;
  rows.forEach((r,y)=>{for(let j=0;j<r.length;j++){const col=P[r[j]];if(col){x.fillStyle=col;x.fillRect(j*HQ,y*HQ,HQ,HQ)}}});
  c.className='sfa-ax';c.style.imageRendering='auto';c.style.width=w*k+'px';c.style.height=h*k+'px';return c;
}
/* two wall bows: 0 = the oak bow with steel nocks (25x25), 1 = the plain wooden shortbow (15x15); both hang on the Armoury wall above the dagger rods */
const BOWSK=[[{"a":"#653b22","b":"#421e0e","c":"#a7592d","d":"#d79875","e":"#bac3d7","f":"#c87e4d","g":"#97a4cc"},".......................aa|.....................aaca|................aaaaaefa.|.............aaadffegba..|...........aadffcbbbb....|..........adfcbbb..a.....|.........aefbb....a......|.........afb.....a.......|........afcb....a........|......aafcb....a.........|.....aefcb....a..........|....adcbb....a...........|....afb.....a............|...adcb....a.............|...afb....a..............|...afb...a...............|..adcb..a................|..afb..a.................|..afb.a..................|..aeba...................|..agb....................|.aeb.....................|.afa.....................|aca......................|aa......................."],[{"a":"#4d4d4d","b":"#513e13","c":"#767676","d":"#715822","e":"#93722a","f":"#2d2109","g":"#a0a0a0"},"..........bbbb.|.......bbbeddef|.....bbedeffff.|....bcdfff..a..|...bcgc....a...|..bcgc....a....|..bdc....a.....|.bef....a......|.bdf...a.......|.bef..a........|bef..a.........|bdf.a..........|bdfa...........|bef............|.f............."]];
function axeCv(i,k){
  const rows=AXE_S[i].split('|'),h=rows.length,w=Math.max(...rows.map(r=>r.length)),c=document.createElement('canvas'),x=c.getContext('2d');
  c.width=w*HQ;c.height=h*HQ;
  rows.forEach((r,y)=>{for(let j=0;j<r.length;j++){const col=AXE_P[r[j]];if(col){x.fillStyle=col;x.fillRect(j*HQ,y*HQ,HQ,HQ)}}});
  c.className='sfa-ax';c.style.imageRendering='auto';c.style.width=w*k+'px';c.style.height=h*k+'px';return c;
}

/* ---------- Copper / chainmail / iron / diamond / gold gear: pixel sprites (1 char = 1 pixel, '.' = clear) ----------
   MCSW = the five swords (wood, stone, iron, diamond, gold) - they join SKIN as ids 64-68. MCA = helm, chestplate, leggings and boots in the same five metals. */
const MCSW=[[{"a":"#7a6129","b":"#433618","c":"#372a14","d":"#2a2110"},".............ccc|............caac|...........caaac|..........caaac.|.........caaac..|........caaac...|..dd...caaac....|..dbd.caaac.....|...dbdaaac......|...dbdaac.......|....dbdd........|...badbbd.......|..bad.ddbd......|ddad....dd......|dbd.............|ddd............."],[{"a":"#a4a4a4","b":"#55534e","c":"#3c3b37"},".............bbb|............baab|...........baaab|..........baaab.|.........baaab..|........baaab...|..cc...baaab....|..cbc.baaab.....|...cbcaaac......|...cbcaab.......|....cbcc........|...cbcbbc.......|..cbc.ccbc......|ccbc....cc......|cbc.............|ccc............."],[{"a":"#ffffff","b":"#fefefe","c":"#fdfdfd","d":"#fcfcfc","e":"#fbfbfb","f":"#fafafa","g":"#d6d6d7","h":"#535049","i":"#292825"},".............hhh|............hfgh|...........hdgdh|..........hegch.|.........hfgah..|........hegbh...|..ii...hdgch....|..ihi.hdgch.....|...igiagdh......|...igigeh.......|....igii........|...ihighi.......|..ihi.iihi......|iihi....ii......|igi.............|iii............."],[{"a":"#3dd6b7","b":"#254c3e","c":"#10251e"},".............bbb|............baab|...........baaab|..........baaab.|.........baaab..|........baaab...|..cc...baaab....|..cbc.baaab.....|...cbcaaab......|...cbcaab.......|....cbcc........|...cbcbbc.......|..bbc.ccbc......|ccbc....cc......|cbc.............|ccc............."],[{"a":"#f7f8e4","b":"#cbd15b","c":"#4e4c2b","d":"#3e3d2c","e":"#3b3828"},".............dde|............dbbe|...........dbbbe|..........ebbbd.|.........dbbbd..|........dbbbd...|..dd...dbbbe....|..ecd.dbbbd.....|...dbdbbbda.....|...dbebbda......|....dbed........|...ecdbce.......|..ece.ddce......|ddce....dd......|dbe.............|ddd............."]];
const MCA={helm:[[{"a":"#c26037","b":"#bc6036","c":"#c75c36","d":"#ad5330","e":"#8b452b","f":"#562917","g":"#4f291a","h":"#492117","i":"#3b1e13","j":"#2c1c14","k":"#1e130f","l":"#1a0e0a"},"..ffffff..|.faaaabej.|gcbcacadei|gacaabedeh|gbbfffiedi|fcfklkkiei|fcglkkkidi|gaikllkiei|.gi....ii."],[{"a":"#fafafa","b":"#c6c6c6","c":"#aeadae","d":"#716d6e","e":"#595959","f":"#313231","g":"#303030","h":"#2f2f2f","i":"#262626","j":"#1e1d1e","k":"#181412","l":"#191110"},"..gghfhf..|.hdbdbdci.|gdadbdbeci|hbdbdbecej|gdbgghjeci|hbflklkjej|fdhlkkkici|hbilklkjej|.gj....ij."],[{"a":"#fefefe","b":"#fcfcfc","c":"#c6c6c6","d":"#979797","e":"#2e2e2f","f":"#2d2d2d","g":"#232423","h":"#1b1c1c","i":"#1b1b1b","j":"#1c1312","k":"#1c100d"},"..feffff..|.ecccccdi.|ecaacccddi|ecbcccdddh|fcceeehddh|fcekjkjhdh|fcejkjjhdh|ecgjkkkhdj|.ei....ii."],[{"a":"#fbfdfc","b":"#fdf9fb","c":"#35ecc4","d":"#42e3c6","e":"#258a75","f":"#323030","g":"#2a312f","h":"#1b1e1e","i":"#201817","j":"#1e110f"},"..gggfgg..|.fdcdddeh.|gdaaccceeh|fdbdddeeeh|fcdfggheeh|fdfjjijheh|fcfiijjheh|fdijjjjheh|.fh....hh."],[{"a":"#fcfdf9","b":"#fcfaf9","c":"#e8f26f","d":"#e7ef53","e":"#e7eb64","f":"#d7a11f","g":"#2f2f30","h":"#2f3028","i":"#1f1f1c","j":"#201919","k":"#191a1c","l":"#1c110e"},"..gggggg..|.heeeecfla|hdbbddeffk|gdaeedfffi|geegggkffj|hdhllljjfj|hdhllllifj|heillllkfk|.gk....ki."]],armor:[[{"a":"#f8fcfb","b":"#be6136","c":"#c15f38","d":"#c35d36","e":"#a14c2c","f":"#994c2d","g":"#542b18","h":"#3f2316","i":"#401c11"},"..a...........|...gg....gg...|.ggceg..gdcgi.|gccdfi..gcbdfh|gbdcdcggcbcbfh|gfddbdbdddcefh|.gbbbbbcbbfeh.|.iedbcccbdfeh.|..gcbbbcbbfi..|..hdbbcbbfei..|..hfbdccfffi..|..hffefefefi..|...ieffeffh...|....hiiiii...."],[{"a":"#fcfcfc","b":"#c4c4c4","c":"#959595","d":"#727272","e":"#6e6e6e","f":"#5f5f5f","g":"#373737","h":"#2c2c2c","i":"#1f1f1f"},"...gg....hg...|.hgdch..hebgi.|hbebfi..hbebfi|hebdbeghbebeci|hceaebdbebdcfi|.hbdbebebecfi.|.ifbebdbebfch.|..hebebdbech..|..ibebdbecfi..|..ifbdbecfch..|..icfcfcfcfi..|...icfcfcfi...|....iiiiii...."],[{"a":"#fefefe","b":"#fcfcfc","c":"#c7c7c7","d":"#c6c6c6","e":"#c5c5c5","f":"#c4c4c4","g":"#a0a0a0","h":"#969696","i":"#2a2a2a","j":"#1b1b1b"},"...ii....ii...|.iiehi..idcij.|ifdfhj..ifefhj|ifdfdfiicecchj|ihcbafcfccdhhj|.ieafcfeefhhj.|.jhddeddechhj.|..iccfdccfgj..|..jeccccdhhj..|..jhfdcchhhj..|..jhhhhhhhhj..|...jhhhhhhj...|....jjjjjj...."],[{"a":"#fafcfb","b":"#fbf9fa","c":"#3ee6c7","d":"#3ae8c7","e":"#43e2c6","f":"#298776","g":"#218a74","h":"#2b292b","i":"#1b1c1d"},"...hh....hh...|.hhdfh..hcdhi.|heccfi..hdcdgi|hecccehhceecfi|hfeabccddedfgi|.hcadccdeefgi.|.igecedcdeggi.|..heccccdegh..|..iddcccdggi..|..ifeeeefgfi..|..iggfgggggi..|...igfffffi...|....iiiiii...."],[{"a":"#fefefc","b":"#fbfcfc","c":"#f8f9fa","d":"#e7ed61","e":"#e8ee5b","f":"#e4ee57","g":"#d4a31e","h":"#dba01f","i":"#3c382e","j":"#252627","k":"#1e191a"},"...ji....ii...|.iiegi..iefik.|jffegk..ifefgk|ifddddiifdddgk|ihdcbdddfedggk|.jdadddeddhgk.|.kgddfdfdeghk.|.cjdddddddgk..|..kddddedhgk..|..khdeddhhgk..|..khhhhhhhgk..|...kghhhghk...|....kkkkkk...."]],legs:[[{"a":"#c35f37","b":"#bf5f37","c":"#c35c37","d":"#9e4a2b","e":"#954d33","f":"#542919","g":"#50291c","h":"#412319","i":"#3e1d14","j":"#3e1911"},".ffffffgg.|gabbbbbbei|gbbccabaei|gccddddaei|gadejjecei|gbdj..fbei|gbdj..faej|gbdi..fbej|fadi..faej|gbdi..faei|gcdi..fcei|gdei..fdei|gjih..fihh"],[{"a":"#fefefe","b":"#fcfcfc","c":"#cbcbcb","d":"#c4c4c4","e":"#979797","f":"#6d6d6d","g":"#5c5c5c","h":"#313131","i":"#2f2f2f","j":"#272727","k":"#212121","l":"#1b1b1b"},".hihhiijh.|hfdfdfcfek|hdfbfdfdgl|ifagegefek|hdgejlgdgl|ifek..jfek|idgl..idgl|ifek..hfek|idgl..hdgl|hfek..hfek|idgl..hdgl|hgek..hgej|iljk..iljl"],[{"a":"#fefefe","b":"#fafafa","c":"#c6c6c6","d":"#c4c4c4","e":"#989898","f":"#959595","g":"#2f2f2f","h":"#2e2e2e","i":"#2c2c2c","j":"#202020","k":"#1b1b1b","l":"#181818"},".gggghgig.|gdcdcddcfk|icaadccdek|hcbeffedfl|hcffllecfl|hcfk..hcfl|hcfk..idfl|gdek..hcfl|gcel..icfl|idfl..hcfk|hcel..hcfl|hfek..gffk|hkjk..hjkk"],[{"a":"#fdfdfd","b":"#fcfafb","c":"#34eac4","d":"#3fe5c5","e":"#258975","f":"#2a8674","g":"#2b3330","h":"#2e3031","i":"#2e2e30","j":"#1b1c1c","k":"#1c1a1b"},".ihhhihhi.|idddddcdfj|icbbcccdfk|idaeeeecfk|ideekjecej|hdej..gcfk|idfj..gcej|hdfk..gcej|idfk..icek|hdek..gdfj|gdej..hcek|ieej..iffj|hjjj..ijjk"],[{"a":"#fdfdfd","b":"#f8fbfb","c":"#e8ef5a","d":"#e8ec61","e":"#d1a420","f":"#31312c","g":"#2f3028","h":"#1c1c17","i":"#1d1918","j":"#181816"},".fffffgff.|gdcdddddeh|gcbadcddej|gdbeeeedeh|gdeeijecej|gdei..gdej|gcei..gcej|gcei..fdei|gdei..gceh|gdeh..gdeh|gceh..fcej|feei..feej|fhhh..gihi"]],boots:[[{"a":"#c65e39","b":"#bf5f39","c":"#9f4c2c","d":"#974b33","e":"#602d1a","f":"#48271a","g":"#3c1f15","h":"#401d14"},"...eee..eef...|..facg..eadh..|..facg..eadh..|..eacg..eadh..|..facg..ebdg..|..eacg..eadh..|.eaach..eaaaf.|fbbddg..fdbbdg|fdcch....hccdh|fggg......gggg"],[{"a":"#fbfbfb","b":"#bebebe","c":"#969696","d":"#757575","e":"#575757","f":"#383838","g":"#303030","h":"#2e2e2e","i":"#252525","j":"#1e1e1e"},"...hgh..ghh...|..gbej..gbej..|..gdci..hdci..|..gbej..gbej..|..gdci..hdci..|..hbej..gbej..|.gadci..hdbdg.|hbdcei..gcdbej|fecej....iceci|gjij......ijij"],[{"a":"#fefefe","b":"#fbfbfb","c":"#c6c6c6","d":"#c3c3c3","e":"#9a9a9a","f":"#959595","g":"#2e2e2e","h":"#1c1c1c","i":"#1a1a1a"},"...ggg..ggg...|..gcfi..gdfh..|..gbfi..gafh..|..gdfi..gdfh..|..gdfh..gcfi..|..gcfi..gcfh..|.gbcfi..gcdcg.|gcdfeh..gfccfi|gffeh....hfffh|ghhh......hiii"],[{"a":"#fcfdff","b":"#f8fbfa","c":"#3ce7c4","d":"#268973","e":"#2c3130","f":"#312f31","g":"#1d201f","h":"#1d1d1d"},"...fff..efe...|..ecdh..fcdg..|..fbdg..ebdh..|..ecdh..ecdh..|..ecdh..fcdh..|..fcdg..ecdh..|.eacdh..eccce.|eccddg..fdccdh|fdddg....gdddg|ehhg......hhhh"],[{"a":"#fafafc","b":"#fafbf8","c":"#f8f8f6","d":"#e6ed5d","e":"#d6a01f","f":"#30302e","g":"#272826","h":"#1b1c19","i":"#1c191b"},"...fff..fff...|..fdei..fdeh..|..faeh..fbeh..|..fdeh..fdeh..|..fdei..fdeh..|..fdeh..fdei..|.fcdeh..fdddg.|fddeeh..feddei|feeeh....heeei|fhhh......hhih"]]};
/* every pixel weapon in one list: ids 0-15 axes, 16-24 the second sheet, 25-49 the swords, 50-63 the upright swords, 64-68 the wood / stone / iron / diamond / gold swords, 69-71 the diamond sword, diamond pickaxe and bow */
/* three more weapons, pixelled from the diamond-tools sheet (ids 69-71): the diamond sword, the diamond pickaxe and the bow. Same format as MCSW */
const MCX=[[{"a":"#06080c","b":"#41f8fb","c":"#1fc2c5","d":"#622f08","e":"#cd6006"},".............aaa|............abca|...........abcba|..........abcba.|.........abcba..|........abcba...|..aa...abcba....|..aca.abcba.....|...ababcba......|...abacba.......|....abaa........|...deabca.......|..ded.aaca......|aaed....aa......|aca.............|aaa............."],[{"a":"#06050b","b":"#40fbfb","c":"#1dc1c4","d":"#421e0a","e":"#ab470b"},"....aaaaa....|...abbccbade.|....aaaabbad.|........acba.|.......aeabba|......aea.aba|.....aea..aca|....aea...aca|...aea....aba|..aea......a.|.aea.........|aea..........|aa..........."],[{"a":"#06060a","b":"#4b6b74","c":"#af4301","d":"#371903","e":"#9caaaf","f":"#c9d8df"},"..........aaaa.|.......aaacddca|.....aacdcaaaa.|....aeaaaa..b..|...aefa....b...|..aefa....b....|..aaa....b.....|.aca....b......|.ada...b.......|.aca..b........|aca..b.........|ada.b..........|adab...........|aca............|.a............."]];
const SKN={69:'Sword',70:'Pickaxe',71:'Bow',91:'Bow',92:'Bow',93:'Bow',94:'Bow',95:'Bow',86:'Dagger',87:'Dagger',88:'Dagger',89:'Dagger',90:'Dagger'};   /* skins that carry their own noun (the rest take it from the weapon style) */
const STAFFSK=[[{"a":"#6b5151","b":"#603529","c":"#413b45","d":"#372f39","e":"#562328","f":"#372326","g":"#2b2531","h":"#261d27","i":"#3c1920","j":"#2f1422","k":"#281621","l":"#1f1521","m":"#1b0c21","n":"#131120"},"........................jj|.......................caj|......................dcd.|.....................hagn.|....................ibg...|...................iai....|..................iai.....|.................gbe......|................naf.......|...............fbn........|..............fek.........|.............kfl..........|............kfl...........|...........kem............|..........fbk.............|.........kel..............|........hak...............|.......jeh................|......jbi.................|.....jbi..................|....mei...................|...gck....................|..ccd.....................|.gcd......................|.cc.......................|.j........................"],[{"a":"#a36a3f","b":"#985631","c":"#68646a","d":"#774834","e":"#534642","f":"#58362c","g":"#4d2c24","h":"#3a3542","i":"#312d39","j":"#422323","k":"#341f26","l":"#2b2631","m":"#221926","n":"#1a111c","o":"#160f25"},"........................j.|.......................faj|......................kdf.|.....................gbgk.|....................jbg...|...................kbg....|..................fcl.....|.................mef......|................hch.......|...............lci........|..............icl.........|.............ich..........|............lch...........|...........lci............|..........lch.............|.........lem..............|........ieo...............|.......gem................|......mdk.................|.....feo..................|....fbm...................|...faj....................|.lgfg.....................|.dbg......................|jbg.......................|.n........................"],[{"a":"#605f67","b":"#47444d","c":"#3e384a","d":"#333041","e":"#322c47","f":"#2d2c44","g":"#222433","h":"#232130","i":"#201c31","j":"#1e1929","k":"#181b2e","l":"#16182a","m":"#191626","n":"#131529","o":"#131226","p":"#120f22"},"........................m.|.......................dah|......................mbc.|......................dh..|....................mbd...|...................jbd....|..................jad.....|..................bb......|................gac.......|...............mad........|..............fdd.........|..............be..........|............nci...........|...........keg............|..........ifo.............|.........ofl..............|........kei...............|.......jek................|......ofk.................|......fl..................|.....fi...................|....gl....................|..hgn.....................|.bah......................|.bb.......................|op........................"],[{"a":"#686b74","b":"#5a575e","c":"#4c4952","d":"#4d3f47","e":"#413d48","f":"#3d3b44","g":"#393640","h":"#2e2a35","i":"#33232f","j":"#201d2d","k":"#421520","l":"#1d1a29","m":"#171524","n":"#141122","o":"#100e1e"},".......................l..|.......................eah|.....................mebbh|.....................nedn.|.....................gjl..|....................fg....|...................cd.....|..................be......|................ofg.......|...............leh........|...............gg.........|..............gh..........|.............bg...........|............kk............|..........jkk.............|.........cai..............|........lkel..............|.......jdi................|.......ci.................|.....jfl..................|....jel...................|...hem....................|..ffj.....................|.aaf......................|fac.......................|.m........................"],[{"a":"#92654b","b":"#6f6464","c":"#7d533c","d":"#6d4733","e":"#514240","f":"#5e3a29","g":"#4c3027","h":"#492a1f","i":"#37313a","j":"#38282a","k":"#342225","l":"#2e1c1e","m":"#241d29","n":"#1e151d","o":"#171324","p":"#16101c"},"......................je..|.....................kdcb.|.....................hpoak|...................jncclc.|...................ffffgh.|...................fgg....|..................hakhk...|.................hfn......|................gfn.......|...............fdp........|..............adl.........|.............mdh..........|............ebo...........|...........ib.............|..........ibm.............|.........ie...............|........ie................|.......mem................|......mi..................|.....gmo..................|....gcj...................|...fdk....................|.jdcl.....................|jacd......................|hckl......................|.l........................"],[{"a":"#927f71","b":"#715b50","c":"#614c43","d":"#5a3e37","e":"#473a36","f":"#48332f","g":"#402f2e","h":"#332b2c","i":"#352526","j":"#2b2327","k":"#2a1d22","l":"#221d23","m":"#1f151f","n":"#181520","o":"#150f1c","p":"#150d1b"},"........................g.|.......................cal|......................ngel|.....................lclp.|....................hah...|...................gah....|..................cad.....|.................gdfo.....|................gccl......|...............mig........|..............mgd.........|.............ogfm.........|.............bcn..........|............bc............|...........be.............|..........be..............|.........df...............|........di................|.......di.................|......di..................|.....fk...................|....hi....................|...hk.....................|..jj......................|.hk.......................|mh........................"],[{"a":"#836541","b":"#675238","c":"#45432d","d":"#373827","e":"#313426","f":"#2f3324","g":"#2d2f25","h":"#2e2924","i":"#212823","j":"#27201f","k":"#151d20","l":"#1e1a20","m":"#171a24","n":"#1c1420","o":"#11141b","p":"#0f0f1c","q":"#0c0d1a"},"........................n.|.......................haj|......................jag.|.....................ocej.|....................ndb...|...................nfi....|...................ab.....|..................fdl.....|.................bf.......|................eb........|...............fg.........|..............bc..........|............pgm...........|...........lch............|..........mcg.............|..........cf..............|........oci...............|.......mcf................|.......di.................|......dk..................|.....el...................|....ip....................|...kq.....................|..kq......................|hi........................|h........................."],[{"a":"#8b6c49","b":"#6a543a","c":"#5d4933","d":"#4f3d2c","e":"#3d3323","f":"#5a2428","g":"#3c2822","h":"#2c2724","i":"#281f22","j":"#3b1723","k":"#26111c","l":"#1a141c","m":"#1c0d1c"},"........................d.|.....................eecbh|....................heiic.|....................edcha.|....................eaecd.|...................bccdg..|.................icba.....|.................gbel.....|.................heh......|................bi........|...............ji.........|.............lfj..........|.............ae...........|............bc............|..........idd.............|.........kfd..............|........kfj...............|.......mfj................|......mfj.................|.....kfj..................|....mfj...................|....jk....................|...jk.....................|..jm......................|gdk.......................|.g........................"],[{"a":"#8a8f9a","b":"#696a71","c":"#8b4b36","d":"#564e52","e":"#874935","f":"#824533","g":"#6a3b36","h":"#62312c","i":"#5a3035","j":"#512f2d","k":"#49312e","l":"#4b282b","m":"#442426","n":"#3d262a","o":"#3a2029","p":"#331d26"},"..........................|.......................da.|......................aa..|.....................ndb..|....................pk....|....................k.....|...................i......|..................f.......|.................ej.......|................f.........|...............c..........|..............fl..........|.............c............|............c.............|...........e..............|..........e...............|.........f................|........e.................|......mf..................|......g...................|.....h....................|....h.....................|...h......................|..h.......................|.l........................|o........................."],[{"a":"#7f8289","b":"#6e6e75","c":"#5a555e","d":"#834635","e":"#784034","f":"#703a2e","g":"#66362f","h":"#3d3a47","i":"#592c2e","j":"#4c2633","k":"#412233","l":"#2b2129"},".........................|......................kb.|.....................hba.|....................chh..|....................hc...|...................b.....|..................ic.....|.................ef......|................ef.......|...............dd........|..............fd.........|.............gd..........|............ed...........|...........id............|..........ef.............|.........gd..............|........ge...............|.......gd................|......jf.................|......g..................|....ji...................|...ji....................|...i.....................|..j......................|.k.......................|l........................"],[{"a":"#83848c","b":"#756e71","c":"#874d38","d":"#56575d","e":"#824433","f":"#703d2e","g":"#514140","h":"#58382f","i":"#5d3231","j":"#5a2e2d","k":"#4e292d","l":"#47252a","m":"#3f2523","n":"#39212c"},".........................b|.......................aa.|......................bag.|.....................bag..|.....................bd...|....................b.....|...................cg.....|..................fh......|.................el.......|................e.........|...............ch.........|..............cj..........|.............c............|............ek............|...........c..............|..........c...............|.........c................|........e.................|.......c..................|......e...................|....mf....................|...li.....................|..lj......................|..i.......................|.j........................|n........................."],[{"a":"#9498a2","b":"#82868e","c":"#6b6b73","d":"#8a4c36","e":"#874836","f":"#743b32","g":"#5e352d","h":"#5d2c2f","i":"#562b2e","j":"#502c2b","k":"#55161b","l":"#43282d","m":"#3a1b23"},".........................b|........................c.|......................ccb.|.....................aba..|.....................ba...|....................h.....|...................a......|...............mkkki......|...............kkgk.......|................e.........|...............e..........|..............eg..........|.............d............|............e.............|...........e..............|..........dg..............|.........eg...............|........ej................|.......f..................|......d...................|.....f....................|....g.....................|...g......................|..g.......................|.h........................|l........................."],[{"a":"#aab1bb","b":"#90969e","c":"#81848f","d":"#676562","e":"#575557","f":"#894a36","g":"#824633","h":"#6f3a31","i":"#38384a","j":"#5b2f2d","k":"#56292e","l":"#3e222c"},".........................b|.......................ca.|......................ba..|.....................eab..|.....................bd...|...................ec.....|...................d......|..................i.......|.................e........|................d.........|...............i..........|..............h...........|.............f............|............g.............|...........f..............|..........g...............|.........f................|........g.................|.......g..................|......h...................|.....k....................|....j.....................|...j......................|..k.......................|.l........................|l........................."],[{"a":"#c5c5b3","b":"#95ac85","c":"#88816f","d":"#8b7855","e":"#896c52","f":"#776246","g":"#765d47","h":"#705a42","i":"#6f573c","j":"#6c5742","k":"#69523b","l":"#614b35","m":"#604a34","n":"#5e4833","o":"#574638","p":"#4f3f2b"},".....................kee..|.....................gnlkk|....................ki...e|....................ij...d|....................gg..ig|....................ho....|...................mn.....|...............jffhp......|..............jn..........|..............b...........|.............a............|............a.............|............c.............|...........k..............|..........d...............|.........d................|........h.................|......kg..................|.....mj...................|....m.....................|...h......................|.nn......................."]];   /* ids 72-79: the eight staffs from the staff sheet (drawn as icons); ids 80-84: five spears; id 85: the druid's gnarled staff. */
/* five daggers pixelled from the dagger board (ids 86-90): 86 round amber pommel + curved gold guard, 87 big amber pommel + green grip, 88 T-pommel red hilt + broad blade, 89 banded grip, 90 steel cross-guard. Same format as MCSW */
const DAGSK=[[{"a":"#241c2a","b":"#ffc46a","c":"#e8943a","d":"#a85a20","e":"#4a4650","f":"#2e2b33","g":"#f7c866","h":"#d9922e","i":"#9a5a1c","j":"#ffffff","k":"#e2e8ee","l":"#b4bcc8","m":"#8690a2"},"...abcda...|..abcccda..|..abcccda..|...abcda...|...aeefa...|...aeefa...|...aeefa...|...aeefa...|aghhhhhhhia|ahaaaaaaaia|.aajkklmaa.|..ajkklma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkklma..|..ajkklma..|...ajkma...|...ajkma...|.....a....."],[{"a":"#241c2a","b":"#ffd27a","c":"#f0a040","d":"#b8601c","e":"#2f7a4c","f":"#1c4a2c","g":"#f8cf72","h":"#dc9a32","i":"#a86020","j":"#ffffff","k":"#e2e8ee","l":"#b4bcc8","m":"#8690a2"},"...abcda...|..abcccda..|..abcccda..|..abcccda..|...abcda...|...aeefa...|...aeefa...|...aeefa...|aghhhhhhhia|ahhhhhhhhha|.ahhhhhhha.|..aiiiiia..|..ajkklma..|..ajkklma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkllma..|..ajkklma..|..ajkklma..|...ajkma...|...ajkma...|.....a....."],[{"a":"#241c2a","b":"#d9704a","c":"#b04a2e","d":"#7a2c1c","e":"#e8d0a0","f":"#ffffff","g":"#e2e8ee","h":"#b4bcc8","i":"#8690a2"},".abcccccca.|abcccccccca|.addddddda.|...accda...|...aceda...|...accda...|...accda...|...accda...|abcccccccda|aadddddddaa|.afgggghia.|.afgggghia.|.afgghghia.|.afgghghia.|.afgghghia.|.afgghghia.|.afgghghia.|.afgghghia.|.afgghghia.|.afgghghia.|.afgggghia.|..afgghia..|..afgghia..|...afgia...|...afgia...|.....a....."],[{"a":"#241c2a","b":"#ffd27a","c":"#f0a040","d":"#b8601c","e":"#6a5a4a","f":"#40342a","g":"#3a6aa8","h":"#f4cc78","i":"#c8903a","j":"#8a5a22","k":"#ffffff","l":"#e2e8ee","m":"#b4bcc8","n":"#8690a2"},"...abcda...|..abcccda..|..abcccda..|...abcda...|...aeefa...|...aggga...|...aeefa...|...aeefa...|...aggga...|...aeefa...|.ahiiiiija.|..aaaaaaa..|..akllmna..|..akllmna..|..aklmmna..|..aklmmna..|..aklmmna..|..aklmmna..|..aklmmna..|..aklmmna..|..aklmmna..|..akllmna..|..akllmna..|...aklna...|...aklna...|.....a....."],[{"a":"#241c2a","b":"#a0a4b0","c":"#6a6d78","d":"#3a3c46","e":"#c8a878","f":"#8a6e46","g":"#e8ecf4","h":"#b8bcc8","i":"#ffffff","j":"#e2e8ee","k":"#8690a2"},"...abcda...|..abcccda..|..abcccda..|...abcda...|...aeefa...|...aeefa...|...aeefa...|...aeefa...|...aeefa...|aghhhhhhhda|.aahhhhhaa.|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|...aijka...|.....a....."]];
/* five bows (ids 91-95) and five war hammers (ids 96-100), pixelled from the bow / war hammer sheet. Same format as MCSW. Bows are drawn string-right, hammers head-up. */
const BOWN=[[{"a":"#b49e90","b":"#a38372","c":"#838087","d":"#987d72","e":"#8a5f5a","f":"#754875","g":"#6c5143","h":"#565355","i":"#613e46","j":"#643c3e","k":"#563454","l":"#5d3d3e","m":"#413a48","n":"#533831","o":"#462946","p":"#3b2a3b","q":"#422534","r":"#3c203d","s":"#392136","t":"#39221f","u":"#2f1230","v":"#120816","w":"#0b0718","x":"#0f0311","y":"#080714","z":"#0e0409"},"................x...|...............ydx..|...............ydtw.|................zgt.|................ygnw|................wcmw|................ym.w|................zcmw|...............wtmw.|...............ynmw.|...............zgmw.|...............ndmy.|..............znnmw.|..............ndtmw.|..............datmw.|.............ytzthy.|.............qjtxhw.|............xiiy.hw.|............qjp..hw.|...........vjiw..hw.|...........jjq...hw.|..........qjly...hw.|.........xjjw....hw.|........xleq.....cw.|.......zleiw.....cw.|......xleir......cw.|.....xjeeqw......cw.|....xteeix.......cw.|...wqeeix........cw.|..yqebep.........cw.|..xlbbsw.........cw.|..jbbiw..........cw.|.xebep...........cw.|.qbbjw...........cw.|.lbai............cw.|vebai............cw.|xebajw...........cw.|vlbaev...........cw.|.lbaapw..........cw.|.yebaby..........cw.|..xebbdz.........cw.|...xebeev........cw.|....xeekkv.......cw.|.....wsfoow......cw.|......vrfk.......cw.|........ffry.....cw.|.......xkr.y.....cw.|.......yrosw.....cw.|.......ykfry.....cw.|.......yrfoy.....cw.|.......yko.y.....cw.|.......ykfuy.....cw.|.......w.rry.....cw.|.......wkoow.....cw.|......w.fk.......cw.|......vrurw......cw.|.....w.ur.w......cw.|....vuursw.......cw.|...ziir.y........cw.|..zleeiw.........cw.|.zjaeev..........cw.|.jbaai...........cw.|vjbaey...........cw.|vebajy...........cw.|vebajw...........cw.|.lbai............cw.|.qbbjp...........cw.|.xebeiw..........cw.|..lbblw..........cw.|..xlbbqw.........cw.|..wqebeq.........cw.|...wqeelz........cw.|....wqeelx.......cw.|.....xleeqw......cw.|......vlejp......cw.|.......vleiv.....cw.|........xleq.....cw.|.........xjjx....cw.|..........qjlx...cw.|...........ijq...cw.|...........wjiw..cw.|............qjq..hy.|............xiiv.hy.|.............pipxhy.|.............wzztmw.|..............dathy.|..............tdnmw.|..............xggmw.|...............tgmy.|...............zgmy.|...............ytmw.|...............ymhw.|...............wt.y.|................ycpw|................ym.w|................ycmw|................ygnw|................vgt.|...............zgnw.|...............ygy..|................x..."],[{"a":"#e8bd8d","b":"#9fa6ae","c":"#c49d66","d":"#b48a62","e":"#837c85","f":"#b48645","g":"#b7843b","h":"#99621f","i":"#785b3a","j":"#865c2a","k":"#873f39","l":"#57534f","m":"#674025","n":"#722c2c","o":"#4f4a31","p":"#6c4016","q":"#433846","r":"#521e20","s":"#462820","t":"#132e27","u":"#1d281c","v":"#3c0910","w":"#201115","x":"#0b0717","y":"#090810","z":"#100708"},".............z....|............zdz...|............yoj...|.............mjx..|.............yux..|.............qxqx.|............wjajx.|.............qqqy.|..............tyx.|.............xbeqx|.............yt.lx|.............ytqy.|..............tqx.|............yotqx.|............yotqx.|............ujtqx.|...........yojulx.|...........zdo.lx.|...........jau.ex.|..........zpsdxlx.|.........zph.iylx.|.........rhh.x.ey.|........zpfmy..ey.|.......ypgfy...ey.|......ywhgm....ey.|.....x.sffx....ey.|.....ysffm.....ey.|....zwhchy.....ey.|....ysccm......ey.|...xwhcfy......ey.|...yscchy......ey.|...zpcfmx......ey.|...zpchsx......ey.|...zpchs.......ey.|...zpcfs.......ey.|...zpcfs.......ey.|...ypcfs.......ey.|...xsccs.......ey.|....wccsx......ey.|....zggsx......ey.|....zhfsx......ey.|....xrmwx......ey.|....zdaiy......ey.|....xwswz......ey.|....ysjhiz.....ey.|....ymddoj.....ey.|....wjaaojx....ey.|.....x...yx....ey.|.....x.qq.x....ey.|.....xqai.y....ey.|.....xqox.y....ey.|.....xqlq.x....ey.|.....xqll.x....ey.|.....xqai.x....ey.|.....x.ox.y....ey.|.....x.q..x....ey.|.....x.q..y....ey.|.....zdaaoiw...ey.|.....xojjou....ey.|.....yuooty....ey.|....znknrrx....ey.|...xvkrvxx.....ey.|...xn.nknsx....ey.|..yvs.uuyx.....ey.|..yr.sspx......ey.|..zkwsppx......ey.|..ynvmhmx......ey.|..ykrphsx......ey.|..yrvfhsx......ey.|..ynrchs.......ey.|..wrxchs.......ey.|.znkwcfpx......ey.|.xznrcchy......ey.|xjdazhcfx......ey.|.yxddsccp......ey.|...wdwhchz.....ey.|yizoizsfgp.....ey.|.yjqxx.sggz....ey.|..xz..ywhgm....ey.|.......xpgfz...ex.|........xmgpx..ex.|.........shhzw.ex.|.........xphsjwlx.|..........xpsexlx.|...........jau.ex.|...........zdo.lx.|...........xojtlx.|............uitqx.|............yotqx.|............xotqx.|.............ytqx.|.............ytqy.|.............yt.lx|.............lbeqx|.............ytyz.|.............ouqx.|............zicly.|............xqxqx.|.............yux..|.............uox..|............zpi...|............zix...|.............x...."],[{"a":"#dad9e9","b":"#b8a98a","c":"#828187","d":"#997f5a","e":"#a4534e","f":"#7b6164","g":"#575355","h":"#8d3838","i":"#853b3c","j":"#735533","k":"#743c41","l":"#6e5621","m":"#403d46","n":"#5c3a22","o":"#5a262a","p":"#512a2e","q":"#422413","r":"#321b26","s":"#39151e","t":"#1f0f16","u":"#260f09","v":"#0b071a","w":"#15040d","x":"#090714","y":"#0e0610","z":"#110703"},"...........wxyx..|..........whhipy.|...........wirrr.|............wrgrx|.............gxgx|.............zpmv|.............ypmv|.............xrmv|.............xbmv|.............wdmx|............wljgx|...........zldtgx|...........lbdygx|..........xaav.gv|.........zbnjv.cx|........xjtud..cx|........yurrx..gx|.......xtppx...gx|.......ysorv...cx|......yropx....cx|......soorv....cx|.....xsiptx....cx|.....toirx.....cx|....xshitx.....cx|....toipx......cx|...vshkrv......cx|...yohpt.......cx|..xuhhrx.......cx|..yohitx.......cx|..whiox........cx|..shipx........cx|.woeitv........cx|.whek..........cx|.shepy.........cx|xohepx.........cx|ypeepy.........cx|xpeepx.........cx|xpeeox.........cx|xpheix.........cx|.rieer.........cx|.yhiipv........cx|.yorssx........cx|.ynabjv........cx|..nlbdx........cx|..xqnqq........cx|..zdbjnx.......cx|..vyrttx.......cx|...uppry.......cx|...yrrtx.......cx|...yqrtx.......cx|...ynprx.......cx|...ynprx.......cx|...ynptx.......cx|...tprtv.......cx|..xzrutx.......cx|..zjbjnx.......cx|..zunqqv.......cx|..jbnnv........cx|.xabdqv........cx|.ytrstx........cx|.wooorv........cx|.rhhip.........cx|xseekr.........cx|yoeepy.........cx|yoeepx.........cx|xpeepx.........cx|xohepy.........cx|vohept.........cx|.sieir.........cx|.yoeir.........cx|..shepv........cx|..yheor........cx|..xohhp........cx|...rhhpv.......cx|...xokor.......cx|....ropp.......cx|....ypopx......cx|.....roor......cx|.....yoopx.....cx|.....xroo......cx|......tporx....cx|......vrppt....cx|.......yrprx...cx|.......ytrrv...gv|........xurtz..gx|........xduud..cx|.........ybnjv.cx|..........xaay.gx|...........nbdwgx|...........zjdngx|............yjdgx|.............wdgx|.............ybgx|.............yrgx|.............tomx|.............fpgx|.............xcyv|.............uprx|............yoprv|............sopr.|...........vpprv.|............xxv.."],[{"a":"#a9a178","b":"#837e84","c":"#736b4a","d":"#6f6b3b","e":"#7c533e","f":"#575354","g":"#614435","h":"#654330","i":"#66432b","j":"#52482c","k":"#453d42","l":"#51332a","m":"#4a342f","n":"#553325","o":"#352426","p":"#3b241d","q":"#2e222a","r":"#35221f","s":"#24181e","t":"#26150f","u":"#0c081a","v":"#0b0715","w":"#110610","x":"#090613","y":"#0b070d","z":"#100507"},"...............xox.|...............xmv.|...............xlw.|...............xlq.|...............xrou|...............xfku|..............xfksu|..............xsksv|..............ysfsu|..............yofx.|..............yofx.|..............xsfx.|..............yofx.|.............vsofx.|.............zlrfx.|.............sp.fv.|............wngybx.|............wlrxfv.|...........zcakvbv.|...........wpmx.bv.|...........pnq..bv.|..........tlmw..bv.|.........snhq...bv.|.........pemu...bv.|........peev....bv.|.......zieq.....bv.|......zihgu.....bv.|.....whigq......bv.|....zligov......bv.|...znhgox.......bv.|..wnhgox........bv.|.wpihlv.........bv.|.znegqu.........bv.|yriemv..........bv.|ypnhox..........bv.|ycnlo...........bv.|ydats...........bv.|xjacs...........bv.|xpacsu..........bv.|zhlosv..........bv.|wiehrx..........bv.|.nehmv..........bv.|.peilv..........bv.|.oihlv..........bv.|.ziigw..........bv.|.yiihr..........bv.|.wnihhx.........bv.|..piheou........bv.|..yehegw........bv.|..yenneou.......bv.|..vennieov......bv.|..yhlpnhmv......bv.|..ynlpngqu......bv.|..yhnnimv.......bv.|..yenhgv........bv.|..yenihu........bv.|..yeiil.........bv.|..pehgq.........bv.|.wnihmx.........bv.|.yiigrx.........bv.|.peils..........bv.|.nehmv..........bv.|wiegox..........bv.|ygnrsv..........bv.|xpadsu..........bv.|yjac............bv.|ydats...........bv.|xcllou..........bv.|ypngrx..........bv.|vriely..........bv.|.znehrx.........bv.|.uriinv.........bv.|..ylhhrv........bv.|...wlhhrv.......bv.|....yliirw......bv.|.....vgigo......bv.|......vihgu.....bv.|.......vheo.....bv.|........peew....bv.|.........relu...bv.|.........slgq...bv.|..........wnlw..bv.|...........ono..bv.|...........wnmv.bv.|...........ycakvbv.|............zlpxfx.|............wlgwbx.|.............spsfx.|.............wlpfx.|.............usrfx.|..............yrfx.|..............ysfx.|..............yofx.|..............wofu.|..............ysk.v|..............ysksv|..............vfksv|...............xfku|...............xssu|...............xs..|...............xsv.|...............xsv.|...............vqu."],[{"a":"#f7b04e","b":"#fdb438","c":"#858187","d":"#f0702b","e":"#f5751a","f":"#df7328","g":"#8b6a6c","h":"#bd5329","i":"#aa5439","j":"#72575c","k":"#585455","l":"#94371c","m":"#703b3b","n":"#553e49","o":"#7f3726","p":"#7c1d22","q":"#542334","r":"#3d2d3a","s":"#5f1622","t":"#491a28","u":"#2b1e2b","v":"#521507","w":"#2a0f22","x":"#1d060b","y":"#120613","z":"#090716"},"...............yyy...|...............yiix..|..............w.ufhz.|...............xhley.|...............yieiqz|................xeahz|...............yqhbdy|...............ybleiz|...............wefiiz|................ydqoz|................yhobz|................xobdz|................zleiz|................yihiz|................ydiqz|................pfqnz|...............xegynz|...............qdt.nz|..............xdiz.kz|.............zhfr..kz|.............xdoy..kz|............ysir...cz|...........vpstz...kz|..........xpppz....kz|.........ysspz.....kz|........yppss......kz|........zrppz......kz|.......zrnrt.......cz|......yunn.y.......cz|......tunrz........cz|.....xptw.z........cz|.....spppty........cz|....yppptz.........cz|....ztsp.z.........cz|...zujjtz..........cz|...zrjjn...........cz|...ynjjnz..........cz|..z.jjjnz..........cz|..yrjjjrz..........cz|..ynjgju...........cz|..ynggj............cz|zzujggnz...........cz|znngggnz...........cz|znjggjnz...........cz|.rjggnzz...........cz|.ujgrzz............cz|.ujjxqz............cz|.yjnsqz............cz|.ynsiqz............cz|.ysheqz............cz|.ysedmz............cz|.zoedqz............cz|.zoedmz............cz|.zoedmz............cz|.yoedmz............cz|.yshdmz............cz|.znqimz............cz|.yjyqqz............cz|.ujnxrz............cz|.unjryz............cz|.rngjnz............cz|znjggjrz...........cz|znjgggnz...........cz|zyrgggjz...........cz|..yjggjz...........cz|..znggj............cz|...yjgj............cz|...znjjrz..........cz|....rjjnz..........cz|....unjn.z.........cz|....znjj.z.........cz|....zujjrz.........cz|.....unjnz.........cz|.....zrnnyz........cz|.......tppy........cz|......yspppz.......cz|.......ypssy.......cz|.......ztspwy......cz|.......xspuz.......cz|.......spyssy......cz|......wptysptz.....cz|.....wspz.ytyqz....cz|.....wpqyszyqoqz...cz|......zywtz.yooy...cz|.......xsty..toqz..cz|.......sssy..yooq..kz|......xppsy...qliy.kz|.....wpppt....xiho.nz|.....ytyp......yhiznz|......yztz.....yofxnz|........z.......xfiqz|................yhdqz|................zleiz|................yhbez|................xehaz|................vbeoz|...............xebedz|...............xihbez|...............zqhbfz|................veaoz|...............yhdhmz|...............yildz.|................tfiz.|...............xiqz..|...............zyz..."]];
const HAMSK=[[{"a":"#cddaf5","b":"#a3a8af","c":"#818086","d":"#76747a","e":"#985443","f":"#9f5537","g":"#58575c","h":"#545354","i":"#723734","j":"#683a38","k":"#5c3c3c","l":"#72372a","m":"#3f3d49","n":"#462f32","o":"#49243b","p":"#4f2632","q":"#292531","r":"#342027","s":"#261013","t":"#170e19","u":"#110f1b","v":"#180d10"},".......u...u............|......ucbahcu...........|.......tumq.............|........uagu............|.uu.....ubgu............|bcg.uuu.gccg.uu.uuuu....|ucbbgmmcaaabchcchmq.uuu.|.gbcbbccbaabchccbbccchhh|bcbccchcbaacchmqmmmqq...|uhbccchcbaaccgmqquuu....|qcbcq...mmmmqu..........|bdg.u.......uu..........|.......uhcgqmu..........|........hccqmu..........|.......uhccmmu..........|.......uurr..u..........|.........lio.u..........|.........ffjqu..........|........vffiou..........|........tieipu..........|........ujfiou..........|........tplepu..........|........uiflou..........|........tlfeou..........|........tjffp...........|.........pffi...........|.........pffi...........|.........offio..........|.........offio..........|.........offio..........|..........ffio..........|.........tfflo..........|.........uleiou.........|.........tlffpu.........|.........tlffjt.........|.........tlffjt.........|..........lffju.........|.........tlffit.........|..........lffjt.........|.........upjktu.........|.........qtrrnnu........|........urnjjkv.........|.........rnjksjt........|..........rnnijt........|........uqurjjku........|........ununjkvt........|........tkrnksiu........|........tnqnpeeu........|........rjtrjre.........|........rktpjjrt........|.......unjtipkpk........|.......tnkvfepjj........|........k.uepjjku.......|..........upjiksu.......|..........unjkviu.......|..........tnksoju.......|...........qtjkpt.......|...........vlsksn.......|...........vfjvkn.......|...........vjpjjn.......|...........tpjjku.......|...........vjikss.......|...........vjnsel.......|...........tktrelu......|...........urnjrku......|...........torkjru......|...........tppsknu......|............pllsnu......|............plfisu......|............olffiu......|............ulefeu......|.............tjjou......|............hhcbhm......|.............hdch......."],[{"a":"#cadaf8","b":"#cddaec","c":"#a2a9b2","d":"#b0a39b","e":"#807f85","f":"#937e73","g":"#605e64","h":"#555356","i":"#655145","j":"#663b3a","k":"#444350","l":"#403e49","m":"#513b35","n":"#3c3844","o":"#542e34","p":"#452f32","q":"#2c2a33","r":"#3c271e","s":"#2f212b","t":"#2d201b","u":"#110f1c","v":"#140f17"},"........u...............|.......uhlvuu...........|.uvu..uhclhlquuu........|.hhhuuqecqhlhqlluuu.....|ueeeqkecevelcne.n..uu...|uccceecclvuscqculhhkqq..|.bab..chhvqllllleeeehlq.|uhhhq.ceehqquvqqqv.unhhl|..lln.caccceqheelu...uu.|......ubaaccchcceu......|.......ebaacceccg.......|.......uhaabcccck.......|.........hecehee........|.........uqebcecq.......|.........uqkcaccnu......|..........uhbbcchu......|..........vlheehqu......|.........vpojjojp.......|.........uvuvquv........|.........vovheehhu......|........vopvqqql........|........vjuu.vv.u.......|.........jvvsppsu.......|.........vouspjsu.......|..........ouspjj........|..........jvsppju.......|..........outjpp........|.........vjvsjjps.......|.........vovsjjjs.......|........uhevsppjp.......|.........le.vpojpu......|.........u..vpjjpu......|............vpjpp.......|............vppppu......|............usppmu......|............usjjpu......|.............sjmsu......|.............spps.......|.............sojps......|.............sjjps......|.............sjjps......|.............vjjjs......|.............vjjms......|.............vjmpsu.....|.............vjppsu.....|.............vpjjsu.....|.............vpjmsu.....|.............vpppsu.....|.............usojpu.....|.............usjmqu.....|.............usmp.u.....|.............usssqlu....|.............uhcehlu....|...............npsuu....|..............vrrrru....|..............vriiru....|..............uriiru....|..............vrmmru....|..............vrmmmu....|..............vrgemu....|..............vregvu....|..............vrmtrv....|...............rmiir....|...............tmiiru...|...............vgeiru...|...............ueevmu...|...............vmvqmv...|...............vmffmu...|...............viffiv...|...............viddir...|...............vpddmru..|...............uhkkhhu..|................hbbcl...|.................ln....."],[{"a":"#cddaf5","b":"#a2abb2","c":"#b5a69e","d":"#a2a8ad","e":"#9a9ca1","f":"#828087","g":"#7f7d81","h":"#8f7a70","i":"#7e726c","j":"#59575a","k":"#555454","l":"#635046","m":"#413e49","n":"#503a31","o":"#562c35","p":"#46302c","q":"#2c2a35","r":"#39242a","s":"#3b261c","t":"#2a242d","u":"#1a1116","v":"#120f1c"},"....vvv................|...v.mmmvvvvv..........|..v.m..mfbbfjm.v.......|..dkj.d.daaabfvmm......|mmfej..ffaabbbdvjj.....|gkm.ffaajaaadbvvmffv...|dfk.dkgfmjfffbdfvddgkv.|kqqdkkkmmmmmqqmqvkjfgeg|m..e.tmmmfbbfjv.qtmm.v.|.v......vjbbfkv........|.........maafmv........|..........mmmq.........|..........kffkv........|.........vgbdkv........|.........vmmqqq........|.........vtkfkm........|..........qkffmv.......|..........tkbfmv.......|.........vtkbbmv.......|..........vmddmv.......|..........vmfgmv.......|..........vkgkjv.......|..........vkkkg........|..........vkjdgm.......|..........vmfdjm.......|...........mgkkmv......|...........qkjfmv......|...........qkdgqv......|...........vbdmq.......|...........vdkmfv......|...........vkjdg.......|...........vkddkq......|...........vkdkkq......|............kjkfm......|............vkffmv.....|............vgfdjv.....|............vgbbkv.....|............vkbbgv.....|............vkbdkv.....|............ukbbgv.....|.............mbbg......|.............mdbgq.....|.............tfdgm.....|.............vfdgm.....|.............vfffmv....|.............vfffmv....|.............vfffmvu...|............uukffkuss..|...........usskgilssnnv|..........vnsssssssphi.|..........vllssnnlhcg..|...........vnlllhhhl...|..............vurruv...|..............urrrrv...|..............vrpor....|..............vrooo....|..............vrooov...|..............vrooot...|..............vrooot...|..............vrooor...|...............rooor...|...............rooor...|...............rooorv..|...............uooorv..|...............uooorv..|...............vrrrt...|...............vuttuu..|................iuulp..|...............ulhhlr..|..............unrooplnv|...............nlhchlt.|................lhciq..|.................tt...."],[{"a":"#cbd9f5","b":"#cfbfda","c":"#deb58c","d":"#a2aab0","e":"#a6a8a6","f":"#c5a471","g":"#989aa2","h":"#83848a","i":"#aa8760","j":"#827f84","k":"#6e6b70","l":"#7c5a34","m":"#575556","n":"#4c4b4f","o":"#70372f","p":"#5f3a38","q":"#423d49","r":"#4b243a","s":"#51242f","t":"#2c2934","u":"#25161e","v":"#120f1c"},"..........vvv...........|.........vjem...........|.........vqmqvvv........|..vvh...aaaeeedd........|.tmhdvvtdelcflhdtq......|.ddaaqjmdjliilhdmjdjmv..|vdaaaqjmdepccpddqjddghv.|.qjjgtttjjsoopmj..ttqqmv|..tmmvvvvvsolpv.......v.|..vvn....vrlspv.........|.........vqlil..........|.........vqiciv.........|.........vqioiv.........|.........vqcic..........|..........vlcpv.........|..........t.i.tv........|..........tq.ttv........|..........vqqqqv........|..........vqqqnv........|..........vqqnq.........|..........vqmnmv........|..........vtmmn.........|...........tmktt........|...........tmtut........|...........tmmmtv.......|............mmjtv.......|...........vmkmqv.......|...........vmkkqv.......|...........vmjmmv.......|...........vqjjmv.......|...........vqjjjv.......|...........vtjjjv.......|.............jjjt.......|.............jgqt.......|.............jq.qv......|.............jjjqv......|............vmjjmv......|............vmjjmv......|............vmjjjv......|............vmjjjv......|.............qjjjv......|.............qjjjt......|.............tjhkqv.....|.............vhdtqv.....|.............vdqvq......|.............vdjhmv.....|.............vdddmv.....|.............vjddhv.....|.............vjddhv.....|..............hddjv.....|..............nmmmv.....|..............ddjedv....|..............dhjjdv....|..............ddddgv....|.............v..mmv.....|.............vtvmmvr....|..............rujmurv...|..............rrjmrrv...|..............rrhdrrv...|..............rrda.rv...|...............rm..rv...|..............vsmjjrv...|..............vrojjsv...|..............vrojjov...|..............vrojmov...|..............vsomdp....|..............vsoebtrv..|..............vrpm.uov..|..............vrsjhsov..|..............vrrjjpo...|..............vrrdejorv.|...............rtdekpt..|...............v.nn....."],[{"a":"#ccd9f3","b":"#e6d6b9","c":"#c2cad9","d":"#d0bc96","e":"#a2a9b1","f":"#c4a96f","g":"#ac8f60","h":"#807f85","i":"#9a733c","j":"#7d5c2d","k":"#565557","l":"#725320","m":"#5e422e","n":"#413f49","o":"#531d28","p":"#2b2b35","q":"#452a17","r":"#4b2c09","s":"#39191f","t":"#2c1e21","u":"#2a111a","v":"#130f1a"},".......v...vv..........|.......nkeahnk.........|......vnkeahnkv........|.......vrjgjqv.........|.......vjffgmv.........|.......vqmgjqv.........|vaevv.vvkhehkvv........|eaaahv.nnkkknnp.pvv....|vnkaahpkheaaeknpkhkpv..|..pncepnheaaeknpkhhkkp.|vnnknnvnheaceknv..pnnkn|khhnpvvvvrjjmv......v..|vhnv....vjfgrq.........|.........rjjmv.........|........vkhehn.........|........vkhehn.........|........vkeeek.........|..........ppp.v........|.........vkhnpv........|.........vhnknv........|.........vkhhkv........|.........vkhhkv........|.........vnehh.........|.........vnehhp........|.........vphahp........|.........vpenhn........|..........pehen........|..........pchen........|..........peaanv.......|..........vnepkv.......|..........vknnk........|..........vkeeh........|...........keahp.......|...........neaep.......|...........peaen.......|............eaen.......|............eaakv......|...........vhaak.......|...........vkaak.......|............keck.......|...........vkaek.......|............neeh.......|............neehp......|............thehn......|............vhehn......|............vkknt......|...........vrlfilmv....|............mbbdjtv....|............vqlmtvv....|............vvttv.v....|.............ussuuv....|.............usssuv....|.............vsssuv....|.............vsoouv....|.............vsootv....|.............vsootv....|.............vuootv....|.............vuoosv....|.............vuooov....|.............vuooou....|.............vuooou....|.............vuooos....|..............uooos....|..............uooosv...|..............vsootv...|..............vsoosv...|..............vssssq...|..............vrqrrlv..|..............vfbfllv..|..............vldglqv..|................qqt....|................ml.....|...............vijg....|...............vmjm...."]];
const SKIN=AXE_S.map(s=>[AXE_P,s]).concat(BLADES).concat(MCSW).concat(MCX).concat(STAFFSK).concat(DAGSK).concat(BOWN).concat(HAMSK);
const A_=i=>i,W_=i=>16+i,S_=i=>25+i,V_=i=>50+i;
/* weapon skins by style and tier: tier 0 plain iron, 1 steel, 2 ornate, 3 magical. A weapon's tier is its rarity (3 = Very rare and up). */
const SKT={
  warrior:[[5,6,8,10,15,21,0].map(S_).concat([11,6,1].map(V_)),[1,7,12,16,20,23,24].map(S_).concat([3,4,10,5].map(V_)),[9,11,13,14,17,19,22].map(S_).concat([0,2,9,8,12].map(V_)),[1,2,4,5,6].map(W_).concat([7,13].map(V_)).concat([69,70])],
  great:[[3,18].map(S_),[3].map(V_),[0,9].map(V_),[]],
  hammer:[[96],[97],[98,99],[100]],                                  /* the five war hammers (ids 96-100), plain to ornate; two-handed like the greatsword */                 /* greatswords only: the axe models now belong to the axe style */
  axe:[[1,3,5].map(A_),[0,2,6,7].map(A_),[4,9,10,13].map(A_),[8,11,12,14,15].map(A_)],   /* the 16 axe models, and nothing else may carry one */
  spear:[[80,81],[82],[83],[84]],                                    /* the five spears (the same models as in the barrel) */
  mage:[[72,73],[74,75],[76,77],[78,79,85]],                         /* the eight staffs from the staff sheet and the druid's gnarled staff */
  rogue:[[0,6].map(S_).concat([89,90,91,93]),[2,4].map(S_).concat([86,92]),[11,22].map(S_).concat([71,88,94]),[2,4].map(W_).concat([71,87,95])],
  cleric:[[W_(3)],[W_(3)],[W_(3)],[W_(3)]]
};
function pickSkin(st,r){
  const t=SKT[st]||SKT.warrior;let k=Math.max(0,Math.min(3,r|0)),p=t[k];
  while(!p.length&&k>0)p=t[--k];
  return p[Math.floor(Math.random()*p.length)];
}
function skIcon(id,n){return spIcon(SKIN[id],n)}
function mcIcon(slot,m,n){return spIcon(MCA[slot][m],n)}   /* helm / chestplate / leggings / boots in metal m (0 copper, 1 chainmail, 2 iron, 3 diamond, 4 gold) */
function spIcon(sp,n){
  const P=sp[0],rows=sp[1].split('|'),h=rows.length,w=Math.max(...rows.map(r=>r.length)),t=document.createElement('canvas'),tx=t.getContext('2d');
  t.width=w;t.height=h;
  rows.forEach((r,y)=>{for(let j=0;j<r.length;j++){const col=P[r[j]];if(col){tx.fillStyle=col;tx.fillRect(j,y,1,1)}}});
  const m=Math.max(w,h),sc=n>=m?Math.floor(n/m):n/m,dw=Math.round(w*sc),dh=Math.round(h*sc);
  const c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  x.drawImage(t,Math.round((n-dw)/2),Math.round((n-dh)/2),dw,dh);c.className='px';c.style.imageRendering='pixelated';return c;
}
/* two shield sprites: 0 = heraldic steel shield (blue lion on black, red lion on tan), 1 = plank shield with iron rim and rivets, 2 = round wooden shield with a steel rim and boss. An offhand shield with .shk set uses one as its icon ('shd:N'). */
const SHD=[[{"a":"#333335","b":"#cac9c9","c":"#a28656","d":"#8e0101","e":"#010002","f":"#294d7e","g":"#9f9d9e","h":"#7c7a7b","i":"#560205","j":"#baa178","k":"#1a191c","l":"#273e5d","m":"#8b7041","n":"#6b0001","o":"#262628","p":"#212c3b","q":"#c2c1c2","r":"#aba9aa","s":"#3e3e40","t":"#848283","u":"#989698","v":"#937547","w":"#a68a5a","x":"#a7a5a6","y":"#9d814f","z":"#b69f78","A":"#b79e71","B":"#29292b","C":"#273d60","D":"#807e80"},"...................e...................|..................eqe..................|................eeqqbee................|..............eeqqxqxbbee..............|............eehxxxxqxxxxhee............|..........eehxhxxxxqxxxxhxhee..........|..eeeeeeeehxhxhhxxxqxxxhhxhxheeeeeeee..|.eqqqqqqxxhxhxhohxxqxxhyhxhxhxxbbbbbbe.|eqqxxxxhhxhxooooohxqxhyyyyyxhxhhxxxxbbe|eqxqxxxhhxkkoaaaaohxhyjjjjymmxhhxxxbxbe|eqxxqxxhekoaaaaaaaohyjjjjjAjymehxxbxxbe|eqxxxqxhoooooaaaaaahjjjjjjcyyyyhxbxxxbe|eqxxxxeeooooooaaaaahjjzjjyyyyyyeexxxxbe|eqxxxxkkooCfooaffaaxjjddjyydnyymmxxxxbe|exhhhhkkoCCCfolCBaaxjAwnnydnnnymmhhhhxe|exhheekkoCCCooBBaaaxjjjwcyynnnymmeehhxe|.exxkkkkopCCooaaCfaqjdnjjyynniymmmmxxe.|.ehhkkfkoppCfoaaClaqjnnjjydniiymdmmhhe.|.exxkkpfoopCCfpCpBaqjcinidnnimydimmxxe.|.ehhkkkCooCCCClpBaaqjAcinnnnnyynmmmhhe.|.exxkkCkooCCppCoaaaqjjAcniinnyymnmmxxe.|.ehhkCCkoCCCoopCaaaqjjjnimmnnnymnnmhhe.|.exxkpCkCCCCfoopCfaqjdniyydnnnnmnimxxe.|.ehhkkpCpCCplfaopCaqjniyjdninninimmhhe.|.exxkkkkkCCkpCaaaoaxjcyjjnimnnmmmmmxxe.|..ehhkkkCpkoppCfaaaxjjjdniiyminmmmhhe..|..exxkkkpCookkooaaxxxjjccmmyynimmmxxe..|..ehhkkkklooooaaaaxxxjjzjyyyynmmmmhhe..|..exxkkkoppCooaaaaxqxjjjjyyniimmmmxxe..|..eqhkkkokkkooaaaxxqxxjjjyymmmymmmhbe..|..eqxxxkooooooaaaxqhqxjjjyyyyyymxxxbe..|...eqxxqooooooaaaahhhwjjjyyyyyybxxbe...|...eqxqxxoooooaxqaahcjqxjyyyyyxxbxbe...|....eqxxxhooooxhhqxqxqhhxyyyyhxxxbe....|.....eqxxhoooxhaaxxqxxcchxyyyhxxbe.....|......eqxhoooxxaaaxxxcwAxxyyyhxbe......|.......eqhqoooahaaaxvwjhcmyybhbe.......|........eqqhooaaaaqrqjjycyyhbbe........|.........eqhqoaaashqhjjjjybhbe.........|..........ehqhqaaxqqqxzjbhbhe..........|...........eqhqDggxqxuxhbhbe...........|............eeqhhtuxgthhbee............|..............eehhtxDhhee..............|................eehhhee................|..................eee.................."],[{"a":"#655234","b":"#90939a","c":"#76706a","d":"#533e24","e":"#715c3d","f":"#59452a","g":"#5f4b31","h":"#6c5739","i":"#624f31","j":"#574327","k":"#7a736d","l":"#5e4a2f"},"bbbbbbbbbbbb|beahaeahahab|bhiaghiagalb|becjgagalkfb|bedfgagalfdb|belagaiagelb|bhlegaiagelb|bhlegaiagalb|bhcigaiagkdb|bhdigagagjdb|bhlegagagalb|bhlegagagalb|bhlagagagalb|bhcfgaiagklb|bhdfgaiagjlb|bhlagaiagalb|bhlagagagalb|bhgagagagalb|bhcfgalaikfb|bhdjialaijfb|bhlilgliggib|bbbbbbbbbbbb"],[{"o": "#1a0f1c", "a": "#e6ebf3", "b": "#b4bfd2", "c": "#7d89a3", "d": "#4a5268", "1": "#b8693f", "2": "#9a5233", "3": "#7a3f28", "4": "#5a2d20", "5": "#3d1e18", "e": "#c9d3e4", "f": "#98a5bd", "g": "#5b6580", "h": "#242a3c"}, "..............oooo..............|..........ooooaaaboooo..........|........ooaaaaaabbbbbboo........|.......oaaaaaaoooobbbbbbo.......|.....ooaaaaoo511113oobbbboo.....|....ooaaaoo1151115222oobbcoo....|....oaaao51115112523112occco....|...oaaao1511151222222112occco...|..oaaao115111512152225112occco..|..oaao11151315111522252215occo..|.oaaao111222251oo522221212occco.|.oaao11151125ooeeoo25111532occo.|.oaao1115133oeeeeefo5111532occo.|.oaa5111522oeeaeefffo1113222cco.|oaao5111522oeaeeffffo1115123occo|oaao111152oeeeeffffggo125333ocdo|oabo511153oeeefffffggo125243oddo|obbo5121522oeffffhfgo1115443oddo|.obb1211522offffffggo1125343ddo.|.obbo1115233offggggo5122534oddo.|.obbo31253215ooggoo25332533oddo.|.obbbo123225113oo225223344odddo.|..obbo15222511152235222533oddo..|..obbbo532251113322532253odddo..|...obbco3325111533353235odddo...|....occco32111153335232odddo....|....oocccoo5111534352oodddoo....|.....ooccccoo225344ooddddoo.....|.......occccccooooddddddo.......|........ooccccccddddddoo........|..........oooocdddoooo..........|..............oooo.............."]];
(function(){const st=document.createElement('style');st.textContent='.sfa-vr .sfa-ax[data-pk]{pointer-events:auto;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}.sfa-vr .sfa-ax[data-pk]:hover{filter:brightness(1.2) drop-shadow(2px 3px 0 rgba(0,0,0,.5))}.sfa-vr .sfa-ax[data-pk].on{filter:brightness(1.25) drop-shadow(0 0 4px #ffd75a) drop-shadow(0 0 8px rgba(255,200,90,.8))}.sfa-vr .sfa-ax[data-pk]:focus-visible{outline:2px dashed #ffd75a;outline-offset:2px}.sfa-vr .sfa-ax[data-pk].gone{visibility:hidden;pointer-events:none}';document.head.appendChild(st)})();   /* tappable wall axes */
function sprIcon(sp,n){
  const t=document.createElement('canvas');t.width=t.height=16;const tx=t.getContext('2d');
  sp.r.forEach((row,y)=>{for(let x=0;x<16;x++){const c=sp.p[row[x]];if(c){tx.fillStyle=c;tx.fillRect(x,y,1,1)}}});
  const c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(t,0,0,n,n);c.className='px';c.style.imageRendering='pixelated';return c;
}
function px(e,n){if(typeof e==='string'&&e.slice(0,4)==='shd:'&&SHD[+e.slice(4)])return spIcon(SHD[+e.slice(4)],n);if(typeof e==='string'&&e.slice(0,4)==='wpn:')return skIcon(+e.slice(4),n);if(typeof e==='string'&&e.slice(0,3)==='mc:'){const q=e.split(':');return mcIcon(q[1],+q[2],n)}if(SHOP_SPR[e])return sprIcon(SHOP_SPR[e],n);if(typeof e==='string'&&e.slice(0,4)==='pet:')return petIcon(e.slice(4),n);if(typeof e==='string'&&e.slice(0,5)==='coin:')return coinIcon(e.slice(5));if(typeof e==='string'&&e.slice(0,4)==='trk:')return trkIcon(+e.slice(4),n);const c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');x.font=Math.round(n*.78)+'px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,n/2,n/2+1);c.className='px';return c}
/* ---------- currency: bronze, silver and gold ----------
   One number is saved (S.gold = the BRONZE count, so old saves keep working). 1 silver = 10 bronze, 1 gold = 100 bronze.
   Everything you see is just that number written as coins: 125 -> '1g 2s 5b'. */
const COIN_S=10,COIN_G=100,COIN_U=['g','s','b'];
const COINS={
  b:{o:'#3a1e0c',d:'#8a4a1c',m:'#c27a3a',l:'#e8a468',h:'#ffd8aa'},
  s:{o:'#2c3340',d:'#7a869c',m:'#b4bfd0',l:'#e2e9f4',h:'#ffffff'},
  g:{o:'#4a2f06',d:'#b07a10',m:'#e8b93c',l:'#f8d870',h:'#fff6c8'}
};
function trkIcon(r,n){   /* 12x12 pendant: a chain and a gem in the rarity's colour */
  const c=document.createElement('canvas');c.width=c.height=12;const x=c.getContext('2d'),g=(col,l)=>{x.fillStyle=col;l.forEach(([a,b,w,h])=>x.fillRect(a,b,w||1,h||1))};
  const col=RAR[r%RAR.length]||RAR[0],ink='#1a0f06';
  g(ink,[[0,0],[1,1],[2,2],[3,3],[4,4],[11,0],[10,1],[9,2],[8,3],[7,4]]);g('#d9c38c',[[1,0],[2,1],[3,2],[4,3],[5,4,2],[10,0],[9,1],[8,2],[7,3]]);
  g(ink,[[3,5,6,1],[2,6,8,4],[3,10,6,1],[4,11,4,1]]);
  g(col,[[4,6,4,1],[3,7,6,3],[4,10,4,1]]);g(hexMul(col,1.45),[[4,6,2,1],[3,7,2,1],[3,8,1,1]]);g(hexMul(col,.65),[[7,9,2,1],[8,8,1,1],[5,10,3,1]]);
  c.className='px';c.style.width=c.style.height=n+'px';return c}
function coinIcon(k){   /* 10x10 pixel coin; CSS scales it up unsmoothed */
  const C=COINS[k]||COINS.g,S=10,c=document.createElement('canvas');c.width=c.height=S;c.className='px coin';
  const x=c.getContext('2d');
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){
    const dx=i-4.5,dy=j-4.5,d=Math.hypot(dx,dy);
    if(d>5)continue;
    x.fillStyle=d>4.1?C.o:d>3.1?(dx+dy<-1?C.l:C.d):C.m;x.fillRect(i,j,1,1);
  }
  x.fillStyle=C.d;[[4,3],[5,3],[3,4],[4,4],[5,4],[6,4],[3,5],[4,5],[5,5],[6,5],[4,6],[5,6]].forEach(p=>x.fillRect(p[0],p[1],1,1));   /* stamped mark in the middle */
  x.fillStyle=C.l;x.fillRect(4,4,1,1);x.fillStyle=C.h;x.fillRect(2,2,1,1);   /* glints */
  return c;
}
const coinParts=n=>{n=Math.max(0,Math.round(n)||0);return [Math.floor(n/COIN_G),Math.floor(n%COIN_G/COIN_S),n%COIN_S]};   /* [gold, silver, bronze] */
const topCoin=n=>n>=COIN_G?'g':n>=COIN_S?'s':'b';   /* the biggest coin you can make from n bronze */
function coinText(n,max){   /* '1g 2s 5b'; empty units are skipped; max = most units shown, biggest first */
  const o=[];coinParts(n).forEach((v,i)=>{if(v)o.push(v+COIN_U[i])});
  return o.length?(max?o.slice(0,max):o).join(' '):'0b';
}
function coinEl(n,max){   /* the same, as coloured spans (used on dark panels) */
  const w=el('span','coins'),o=[];
  coinParts(n).forEach((v,i)=>{if(v)o.push([v,i])});
  if(!o.length)o.push([0,2]);
  (max?o.slice(0,max):o).forEach(([v,i])=>w.appendChild(el('span','cn '+COIN_U[i],v+COIN_U[i])));
  return w;
}

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
  /* behind the body (their bases hide under the fur): flames spouting off the spine only, from the shoulders to just past the rump. Nothing on the head or the rest of the tail. */
  flame(22,23,11,2.7,.3);flame(20,24,13,3,.2);flame(18,25,9,2.4,-.1);flame(16,25,8,2.3,-.3);flame(14,26,6,2,-.5);   /* along the back, tallest in the middle, shrinking toward the rump */
  flame(13,25,5,1.8,-.6);flame(11,27,5,1.6,-.7);flame(9,30,4,1.4,-.8);flame(7,34,3,1.2,-.8);                              /* a tiny bit past the rump, onto the base of the tail */
  WOLFPUP.r.forEach((segs,y)=>segs.forEach(([x0,rle])=>{
    let x=x0;
    rle.split(' ').forEach(t=>{const n=t.length>1?+t.slice(1):1;X.fillStyle=P[t[0]];for(let i=0;i<n;i++)X.fillRect(x++,y,1,1)});
  }));
  /* in front of the body: glowing magma cracks in the fur (only on fur pixels, never on the outline) */
  const fur=(px,py)=>{const d=X.getImageData(px,py,1,1).data;return d[3]>0&&d[0]+d[1]+d[2]>130&&d[0]<120};
  /* each crack is a connected, jagged line of pixels that starts at the spine (where the flames come out) and runs down the fur; hottest at the root, cooling to dark red at the tip, with a heat pulse that travels along it and a faint warm glow in the fur around it */
  const CRACKS=[
    [[19,24],[19,25],[19,26],[20,27],[20,28],[19,29],[19,30],[18,31],[18,32],[18,33]],             /* haunch */
    [[23,25],[24,26],[24,27],[25,28],[26,28],[26,29]],                                               /* flank */
    [[29,25],[29,26],[30,27],[30,28],[29,29],[29,30],[30,31],[30,32],[31,28],[32,29]]                /* shoulder (the last two pixels are a short fork off [30,28]) */
  ];
  const heat=[P.q,P.m,P.n,P.o],cp=[],isc={};
  CRACKS.forEach((path,ci)=>path.forEach(([cx,cy],i)=>{if(fur(cx,cy)){cp.push([cx,cy,i,path.length,ci]);isc[cx+','+cy]=1}}));
  const halo={};
  cp.forEach(([cx,cy])=>[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
    const k=(cx+dx)+','+(cy+dy);
    if(halo[k]||isc[k]||!fur(cx+dx,cy+dy))return;
    halo[k]=1;X.fillStyle='rgba(255,90,20,.14)';X.fillRect(cx+dx,cy+dy,1,1);
  }));
  cp.forEach(([cx,cy,i,n,ci])=>{
    let t=i<2?3:i<n*.5?2:i<n-2?1:0;
    if(i===(ph*2+ci*3)%(n+2))t=Math.min(3,t+1);   /* one bright spark travels down each crack */
    X.fillStyle=heat[t];X.fillRect(cx,cy,1,1);
  });
  /* embers drift up from the flames (only drawn over empty space) */
  [[16,16,0],[20,8,1],[23,11,2],[14,19,2],[19,13,0],[12,22,1],[9,23,0],[22,16,1],[17,11,2]].forEach(([ex,ey,k])=>{
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

/* Goblin Warrior boss: a green goblin with a double-headed axe wreathed in green fire (78x84, shown at 1.6x). Palette letters -> colours, '.' = clear. */
const GOBSPR={p:{"a":"#0e140a","b":"#d3ef98","c":"#56b438","d":"#a6be74","e":"#667165","f":"#a8d773","g":"#76974e","h":"#82ab3f","i":"#2f4915","j":"#507728","k":"#878980","l":"#97bd39","m":"#98a586","n":"#1c2a0e","o":"#658922","p":"#100d08","q":"#454d41","r":"#c9d790","s":"#47622c","t":"#7f7365","u":"#342e1e","v":"#5b5449","w":"#67d63d","x":"#dfefda","y":"#020001","z":"#000000","A":"#000003"},r:[
  '......aba.....................................................................',
  '.......c......................................................................',
  '..............................................................................',
  '..............................................................................',
  '..............................................................................',
  '..........a..........................a........................................',
  '.........ada........................aea.......................................',
  '..........f........................aghga......................................',
  '......f............................aifjka.....................................',
  '......cba..........................aiflima....................................',
  '......cc...........................anflima...........aaaaaaaa.................',
  '....abcc...........................anhloiea.......aaagiiiiiidaaaaaa...........',
  '...adccc.........................aaapnnnnnqaa....ajiihfffffrjsssiija..........',
  '....fccba.......................atuuvttttkvuea..agrrbbbfllnniiiiooija.........',
  '...fwlw.......................aavuutmddtmdmtvqaaslbrllllnnnnnjoollhosa........',
  '...wwlw.....................aakgiuuvvvvvvtttvvvgdfflllhinnjjjiiiiiiima........',
  '....fll....................agggoiuuuuuuuuuvvvvuilllhhoinijoohiqeeeeea.........',
  '...abwl...................aegohlosssuusssssvtvsiohhojnnijohdostaaaaa..........',
  '...abfw...................asmrlhhlllssllllsuvvussiiinniiojogvaa...............',
  '....a.c....................asfdsjlrrrfhghoinuvunupppniioonqqa.................',
  '.........................aaajdsiigbbfgnnpninnuunmuniijhlhnaa..................',
  '........................amiifuhlssldhpnlinijjnunmuiijhllmua...................',
  '.......................agjbxbrfllonnnllbsnsohuvunkgierrmua....................',
  '......c...wf..........akebxrrlllllgnnnuunglllouunmievnnqa.....................',
  '....fcc...wf.........atgrbrfllllhoiiiddddbrllhnvuukveaaa......................',
  '....fwc..fcf........akkbbrllllhjiiijiisrrrrlhivvunueeka.......................',
  '....wwc..ccwf......akgrbrllllosiijsingojdffloutvunneqea.......................',
  '...wcww..cccf.f....aedbbflllhiiijoojolhphflhoiqvunneqeaa......................',
  '...wclf..wwwffcf..agglfflllhoiohhhhhliinhllhojnvunnvqekka.....................',
  '...fwlc..wwb.fcc..ashlfllhloohggmmkjiypihlloojuvunnqekkkaaa...................',
  '....fwc..wwbabww..asolllhooommrqyyyyyynhllooojnvunukaxxxeeeaaaaaaa............',
  '....fwc..wwf.fw...ajoooooofmunnpniiiiinnglhojnuvpnmxxaaaxxxkeeeeeea...........',
  '.....bc...wcfdw...asmrrrknnnaaaqniillffrujlhjnuvuuuunexxaaaaxxxxmvea..........',
  '.....a....wf.a.....aqnnnqaaaavsiiijllllrupjhjpuvuqvvquqqqxxxxeqevqa...........',
  '.................w..aaaaa.aejlllldlllolllllonnnvukkeqqqquqqqqkeuuqa...........',
  '.........wf......c........aihfffffllooooodenninuummkkkkkkqqkkeqnqa............',
  '....f...dc.......c........aiolfffllloohmdeinninnnvmrrrrrrmqeeuqvua............',
  '...ww..fcw......fcf.....f.aioolflhhhhgeeeinnniiiinekkkkkkkunnnseeka...........',
  '...ww..cc..fwwffcccffwwwcf.jjohhoogjkkqqnniiijooosinnnnnnpniiiigmsma..........',
  '...fw..ccffwcccccwwccccccc.aejjjjgkvvvaaqijoohllloojsiissynnnnigdjsma.........',
  '..fcw..cccccwwwwwweeeeeeeka.aquuuuvaaa.aqsoohjlffllllhgrmynnpnijlfsia.........',
  '..wcw...cwwwlleeeeaaaaaaamea.aaaaaa...asnioohijfflhlhgknmnaauioooffsa.........',
  '..fccc.bcwlgekaaaaaaaaaamea...........asiniooosllljofenimnaaushlffflia........',
  '..fcwc.cwjvmaaaaaaeeeeeqva..........aasliinjllhiooodennirmuaaqihlfffia........',
  '.fcwwcwwjmmaaamekekkkkvva.....aa..aajjdliinjfffhihiiiniisrnqaavihlffnsa.......',
  '.wcwwcwcmaaameeekkmmmesga..aaagsaasgllhoiijdbbfflfhooojjijkua.avislfksa.......',
  '.wcwllcmaamkeekkmmmmmvera.asjshlgglllhiinofbbrffffllhoooiifua..avnsffsa.......',
  '.fwwllkaameeekmmmmmmksga.akgooffhhflhivislbrffflffllooooiifua...aqirfsa.......',
  '.flwdkaakeekmmmmmmmmqjf.akgxrrfflloosvgohlflhohlffflooosiideea...auflia.......',
  '.wllkaamvekmmmmmmmmmqjf.ajbbffllloosvashhlllhnollllooojniigrnea..aiflia.......',
  'abllmaavekkkkmmmmmmmqjf.asdhfllloojqaasoohllhiollllooojnnimmiea..aufljka......',
  'ablkarvemqunqeemmmmevuvavnnnhlloogmqaasooohllfffllooosnnnnnnjda.aaiflfska.....',
  '.wckamuuu.hcsuqeekeveqekuqkqnooiggva.arunnnniolloooinnioooohnkaakifllfjma.....',
  'aekaeqaaa..bdccnuevekmvqkquuningvva..asihoivtnnnnnneeiolllllnnisorfllfjma.....',
  'aekmka.....a.fcccqkkmmrmvqaaunkenqa.ajddflsvtvvvtvukeslflliiddrlfffflfska.....',
  '.akka.........wwwumxakvqq...anieaa..aiffllsvmvvtmtukeoflhsnhfbxbfffflfska.....',
  '..aa..w........iskrkkeqqqf..ateaeeaagifflljvtuuumtukeoffhijohfbrfffflfska.....',
  '....abcf.....ateueeevekeqgaa.f.kvemaihfflljvtuunmtukeslfhiojhfffbbffhfjma.....',
  '....abccf...aeqkuniqekmmkekkmjkveekairfllhsvtunnmtukeioflijnllldbbffodsma.....',
  '......wccb...aqqqqcukmmmmkuuuuuqmmegjfflljnvtunnmtukeiolloinsjjoffllhisa......',
  '.......cwbwf..aqq.cikmmmmkvvvvvemmeslfllljnvtunnmtukviollolinnnioloomqa.......',
  '.......cwbwf...aa.cnkmmmmkvvvvvkkkajlflloinvtunnmtuuunuolloonniioofmna........',
  '.......cwbwcf....anqkmmmkvvvevmakkrjrblooinvtunnktuueenioloolsnnnuuua.........',
  '......abwbcccwfw.auqkevevvvqraaemadjrbonnnnuvunnvvqueeuanolllogeqaaa..........',
  '.......ab.cwcwfccqqkmevvvvvxaakkaamiohonninuvunnvvuueevanollooosnuva..........',
  '........a.fwwcwcwukmmevvekmaakma..agiiinninnunpnttuvmevaeioooisgkkkqa.........',
  '...........wwlcsjqeeeevvemakkcra...aenisiijqqvvnmtuvmevaaeiiinijeggeea........',
  '...........flojuqvvvvkkkedkejcf.....anioiigevaapvqpveuva.aeeuiisiijrna........',
  '.........arfgeeevkkkkmakgljkcw......aqnoiigevaauuuqaeuea..aavjoojiimqea.......',
  '..........cjkmrakaaarmkjcww..........avjoijeea.aaaa.aaa.....avsoooiirua.......',
  '..........fwcjkrrrrrkjwwwd............ausiiemqa..............aksjooimqka......',
  '............fwlveeevwwf..a............aunsiemva...............aenioonmqta.....',
  '..............fcclcccf.................aqiiemva................aaanoiinka.....',
  '....................b.............aaaaaqnsiemqa...................annnkqea....',
  '....................a.........aaaarssssijoogmnqa.................ajhhoimeqa...',
  '.............................aesssjshhhhhhoogeua..............aaaeslloijgeva..',
  '..........................aaagsohhhlffflllhogmuaaaaaaaaaaaaaaamejihllojoosqa..',
  '..............aaaaaaaaaaaaqqqijolllllllhohoooqnqqqqqqqqqqqqeggjjoolllooojsaa..',
  '.............aqqqqqqqqqqqvyzynijssssssssssjjippzzzzzzzzzAAnjooohllllloojiuqea.',
  '.........aaaavzzzzzzzzzzzyzzAzpppppppppppppppzzzzzzzzzzzzyilffffffllloonnpzua.',
  '........aquuuuuuuuuuuuunyyyzAAyyyyyyyyyyyyyyyyzzzzzzzzzzAyiiijjjjjjjjnnpAAzpqa',
  '.........aaaaaaaaaaaaaavnppppppppppppppppyAAzzzzzzzzzzzyynnnnnuuuuuuunppppnqa.',
  '.......................aaaaaaaaaaaaaaaaaqyAAAyyyyyyyyyyyuaaaaaaaaaaaaaaaaaaa..',
  '........................................aaaaaaaaaaaaaaaaa.....................'
]};
/* the green fire never stops moving: the fire pixels (palette w/c plus the lighter pixels hugging them on the axe side) are kept apart from the rest of the art and redrawn
   every ~110 ms by one shared timer. The flames flicker light/dark, the tips grow and shrink, and a few sparks rise off them. Canvases that left the page are dropped. */
const GOBFX={ready:0,base:null,fire:[],tips:[],cvs:new Set(),timer:0,t:0,still:matchMedia('(prefers-reduced-motion:reduce)').matches};
function gobMix(a,b,f){const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),A=p(a),B=p(b);return 'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*f)).join(',')+')'}
function gobInit(){
  if(GOBFX.ready)return;GOBFX.ready=1;
  const R=GOBSPR.r,P=GOBSPR.p,H=R.length,W=R[0].length,core=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&(R[y][x]==='w'||R[y][x]==='c'),fs=new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const k=R[y][x];if(k==='.')continue;
    if(core(x,y)){fs.add(y*W+x);continue}
    if(x<=17&&'fbdl'.indexOf(k)>=0){let n=0;for(let dy=-2;dy<=2&&!n;dy++)for(let dx=-2;dx<=2;dx++)if(core(x+dx,y+dy)){n=1;break}if(n)fs.add(y*W+x)}
  }
  const b=document.createElement('canvas');b.width=W;b.height=H;const X=b.getContext('2d');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const k=R[y][x];if(k==='.')continue;
    if(fs.has(y*W+x)){const o=P[k];GOBFX.fire.push({x,y,o,l:gobMix(o,'#d3ef98',.45),d:gobMix(o,'#1f5a14',.4)});if(y>=2&&!fs.has((y-1)*W+x)&&R[y-1][x]==='.')GOBFX.tips.push({x,y})}
    else{X.fillStyle=P[k];X.fillRect(x,y,1,1)}
  }
  GOBFX.base=b;
}
function gobDraw(c,t){
  const X=c._x,F=GOBFX.fire,T=GOBFX.tips;X.clearRect(0,0,c.width,c.height);X.drawImage(GOBFX.base,0,0);
  for(let i=0;i<F.length;i++){
    const p=F[i],v=Math.sin(t*.9+p.x*.7)+Math.sin(t*1.7-p.y*.35+p.x*.2);
    X.fillStyle=v>1?p.l:v<-1?p.d:p.o;X.fillRect(p.x,p.y,1,1);
  }
  for(let i=0;i<T.length;i++){   /* tongues of flame: the tip stretches up one pixel when it flares */
    const p=T[i];if(Math.sin(t*1.3+p.x*1.1+p.y*.5)>.72){X.fillStyle='#a8d773';X.fillRect(p.x,p.y-1,1,1)}
  }
  for(let i=0;i<4&&T.length;i++){   /* sparks drift up from the flame tips and fade */
    const q=t*.5+i*2.3,ph=q%9,tp=T[(i*37+Math.floor(q/9)*13)%T.length],ey=tp.y-2-Math.floor(ph);
    if(ey<0)continue;X.globalAlpha=Math.max(0,1-ph/9);X.fillStyle='#d3ef98';X.fillRect(tp.x+Math.round(Math.sin(ph*.9+i)*1.5),ey,1,1);
  }
  X.globalAlpha=1;
}
function gobTick(){
  GOBFX.t++;
  GOBFX.cvs.forEach(c=>{
    if(!c.isConnected){if(++c._miss>40)GOBFX.cvs.delete(c);return}
    c._miss=0;if(c.offsetParent===null)return;   /* on another tab, nothing to redraw */
    gobDraw(c,GOBFX.t);
  });
  GOBFX.timer=GOBFX.cvs.size?setTimeout(gobTick,110):0;
}
function goblinbandCanvas(){
  gobInit();
  const R=GOBSPR.r,H=R.length,W=R[0].length,c=document.createElement('canvas');c.width=W;c.height=H;c.style.width=Math.round(W*1.6)+'px';c.style.height=Math.round(H*1.6)+'px';
  c._x=c.getContext('2d');c._miss=0;gobDraw(c,0);
  if(!GOBFX.still){GOBFX.cvs.add(c);if(!GOBFX.timer)GOBFX.timer=setTimeout(gobTick,110)}
  return c;
}

/* Wise Wizard Frog companion: a frog in a purple wizard hat and cloak with a gnarled staff (56x56, drawn 1:1 and zoomed in whole numbers by PETS.px). Palette letters -> colours, '.' = clear. */
const WIZFROG={p:{"a":"#020103","b":"#d1b285","c":"#0b050e","d":"#6a9c18","e":"#b65a21","f":"#0d0820","g":"#8f2a83","h":"#122014","i":"#260820","j":"#7d8266","k":"#87d11d","l":"#34073b","m":"#8ee612","n":"#4f1d1e","o":"#245119","p":"#d88933","q":"#2b224f","r":"#471647","s":"#f9f9b8","t":"#3d6d11","u":"#542457","v":"#ce51b4","w":"#7c3325","x":"#48800f","y":"#5d5a27","z":"#3f4375"},r:[
  '........................................................',
  '.........fccf...........................................',
  '.......qipppwf..........................................',
  '......lipppewnf.........................................',
  '......cleeeepwc.........................................',
  '......cweewweei.................facccccf................',
  '......cwenwwinwl................ffuuuuuuff..............',
  '......qniewwncwl.............fluuuuuuulruuff............',
  '.......cnwwwnnnf............ilnuuuuuuuaicrurf...........',
  '.......anwnnnwnc..........cailerrpruuuaaacruf...........',
  '.......fcnncceif..cfiiiiiiiiiiilnpwuuiaccaairf..........',
  '........ccaawnf.filllllfccccfllllliriic..faar...........',
  '........fwiwwizflaaaaaaaaaaaaaaccciccac...aac...........',
  '.........cnwni.ccaaaaaahxxtaaacmkocilfc....fc...........',
  '.........cwwwc.caaaaaaaccxxtxodosotacflf................',
  '........fwnwwc..caaaaaaahkmmddpaaceahaflcccccf..........',
  '.........innni..faaaaaakmmmmmmdnaaoooaacfffflff.........',
  '........fwciin...aaaaakmmmmmmmmdeeoooaaaaaaaccccf.......',
  '........cwccwn....ccchkjjjjjjxxkmkxxxhaaaaaaaaflc.......',
  '.........i.cww.......cjssssssssbxhkxxoaaaaaaaaacc.......',
  '.........f.cww.......ffbsssssssssbxxhcciaaaaaaaf........',
  '...........cwn.........fbsssssssstcfguriaaaaaaf.........',
  '............in.........fcbsssssbigvvvgllc...............',
  '............cw........fuccbsssbiugggrlllc...............',
  '............cw........cuglcssblguiiiffllf...............',
  '...........fwwf.......ucircbbigrlcuullcf................',
  '...........hnnah...qqilliccbciicluuuull.................',
  '...........htcmkcfacfullluiynwclrruuurrf................',
  '...........otomhcddflaiilgcnncrgucuuuuurf...............',
  '..........ctxocctxxclaaagrcwwccggcluuucccf..............',
  '..........ctccktaaaalaalglnwwwcugcclucthlif.............',
  '...........coctccaaalailuciccnwcglcircomccc.............',
  '............cccf.aaalaigucpnypccglclioomdepd............',
  '.............cnf.aaalclgiipccencgllindopeinyy...........',
  '.............cwc.aaalclgaacbpeccgrlceexeppppc...........',
  '.............cwc.aaalfrgccccciwcgulcecxceeecc...........',
  '.............iww..aallgcnciwwiiwuuuacyoycecc............',
  '.............cwc..aallgacwwohnciwvulcaaaaaf.............',
  '.............cwwc.faligcwwtaahwwcvuulaaafac.............',
  '.............fwwc..caigcwttaahwwivvuulurcaf.............',
  '..............awf...aiuoxxcaaaawocvuuruuulf.............',
  '..............cwn...cuqoxxaaaaaaoouguuuuuuf.............',
  '..............cwn...fgcxxxaaaaaatocvuuuuuulc............',
  '...............cn..ccgcaxxaaaaaahoovguuuuulcc...........',
  '...............cn..cigcahxcaaaaaahohvuuuuullic..........',
  '...............cn..ivvcaaocaaaaaaaxogvuuuullcf..........',
  '...............wc..rgicaahxcaaaaaxxoavvuuulff...........',
  '..............ric...cc.fchxtaaaaaxooacurulf.............',
  '..............ninq.....qhkxt.....odof...................',
  '..............fwncccottkmmtc.....omtf...................',
  '..........zqqlcchcttttdmmxcaaaaaaxkmxccaaaacffzz........',
  '..........f..zqchxtchtxdhaaaaaacoodmmtttaaaffcj.........',
  '...............fcchdktaaccaaactmoaahmhcxkccccf..........',
  '.................ffttccf......hxocccdoctxhq.............',
  '...................ff..........ff..aff.ff...............',
  '........................................................'
]};
function wizfrogCanvas(){
  const R=WIZFROG.r,H=R.length,W=R[0].length,c=document.createElement('canvas');c.width=W;c.height=H;
  const X=c.getContext('2d');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=R[y][x];if(k!=='.'){X.fillStyle=WIZFROG.p[k];X.fillRect(x,y,1,1)}}
  return c;
}

/* companion art registry: a pet whose emoji field is 'pet:<key>' is drawn from code instead of as an emoji */
const PETART={wendigo:(res,tier)=>wendigoCanvas(res,tier),wolfpup:()=>wolfpupCanvas(0)};
const PETCROP={wendigo:[0,0,64,64],wolfpup:[20,0,28,28]};
PETART.wizfrog=()=>wizfrogCanvas();PETCROP.wizfrog=[11,3,38,38];   /* the hat and face become the small icon */
PETART.goblinband=()=>goblinbandCanvas();PETCROP.goblinband=[16,2,48,48];   /* the goblin's head and shoulders */
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
      hammer:()=>{                                 /* two-handed war hammer: a long haft, both hands on it, a blocky head with a striking face and a spike that grow with the tier (kept right of the face, x 21-29) */
        const B=BLADE[m],BL=M(B,1.25),BD=M(B,.7),WD='#7a5a2a',gc=m>=4?GOLD:MATS[Math.min(m,3)],hy=8-(m>=3?1:0),hh=5+(m>=3?1:0);
        R(26,hy+hh,2,37-hy-hh,WD);R(27,hy+hh,1,37-hy-hh,M(WD,.72));P(26,37,M(WD,1.3));
        R(23,hy,6,hh,B);R(23,hy,6,1,BL);R(23,hy+hh-1,6,1,BD);                  /* the head */
        R(21,hy,2,hh,M(B,.88));R(21,hy,2,1,BL);R(21,hy+hh-1,2,1,BD);           /* striking face */
        R(29,hy+1,1,hh-2,B);P(29,hy+Math.floor(hh/2),BL);                      /* spike */
        R(25,hy+hh,4,1,gc);R(25,hy+hh+1,4,1,M(gc,.7));                         /* collar */
        if(m>=2)R(24,hy+2,5,1,BD);
        if(m>=4){R(25,hy-1,3,1,GOLD);R(26,29,2,1,GOLD)}
        if(m>=5){R(24,hy+1,4,hh-2,'#fff');P(20,hy+1,'rgba(255,240,150,.7)');P(29,hy+hh,'rgba(255,240,150,.7)')}
        R(26,20,3,2,SK);R(26,27,3,2,SK);                   /* both hands on the haft */
      },
      axe:()=>{                                    /* one-handed axe: a short haft with a broad head that grows with the tier */
        const B=BLADE[m],BL=M(B,1.25),WD='#7a5a2a',gc=m>=4?GOLD:MATS[Math.min(m,3)],hy=10-(m>=3?1:0),hh=6+(m>=3?1:0);
        R(25,hy-1,1,26,WD);R(26,hy-1,1,26,M(WD,.72));P(25,34,M(WD,1.3));
        R(21,hy,5,hh,B);R(19,hy+1,2,hh-2,B);R(19,hy+1,1,hh-2,BL);R(21,hy,5,1,BL);
        R(25,hy,2,hh,gc);P(25,hy-2,BL);P(26,hy-2,B);
        if(m>=2)R(22,hy+2,3,1,M(B,.7));
        if(m>=5){R(21,hy+1,3,hh-2,'#fff');P(18,hy+1,'rgba(255,240,150,.7)');P(28,hy+hh,'rgba(255,240,150,.7)')}
        R(25,22,3,2,SK);
      },
      spear:()=>{                                  /* two-handed spear: a long shaft, both hands on it, a leaf-shaped head that grows with the tier */
        const B=BLADE[m],BL=M(B,1.25),WD='#7a5a2a',gc=m>=4?GOLD:MATS[Math.min(m,3)],y0=3-(m>=3?1:0);
        R(26,y0+6,1,31-y0-6+4,WD);R(27,y0+6,1,31-y0-6+4,M(WD,.72));P(26,34,M(WD,1.3));
        P(26,y0,BL);R(25,y0+1,3,3,B);R(26,y0+1,1,3,BL);R(26,y0+4,1,1,B);
        if(m>=3){R(24,y0+2,1,2,B);R(28,y0+2,1,2,B)}
        R(25,y0+5,3,1,gc);if(m>=2)P(26,y0+6,RED);
        if(m>=5){R(26,y0+1,1,3,'#fff');P(23,y0,'rgba(255,240,150,.7)');P(29,y0+4,'rgba(255,240,150,.7)')}
        R(25,22,3,2,SK);R(25,16,3,2,SK);                   /* both hands on the shaft */
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
let PVS=null; /* dev preview of the subclass slot: {st:'off'|'ready'|'on',n:name} or null */
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
const SLOTS=['helm','armor','legs','boots','weapon','trinket','offhand','companion'];
const SLOTN={helm:'Helm',armor:'Armor',legs:'Legs',boots:'Boots',weapon:'Weapon',trinket:'Trinket',offhand:'Off-hand',companion:'Companion'};
const NOUN={legs:{warrior:'Leggings'},boots:{warrior:'Boots'},helm:{warrior:'Helm',mage:'Hat',rogue:'Hood',cleric:'Circlet'},armor:{warrior:'Plate',mage:'Robes',rogue:'Leathers',cleric:'Vestments'},weapon:{warrior:'Sword',great:'Greatsword',hammer:'War Hammer',axe:'Axe',spear:'Spear',mage:'Staff',rogue:'Daggers',cleric:'Mace'},offhand:{warrior:'Shield',mage:'Tome',rogue:'Dagger',cleric:'Lantern'}};
const MATN=['Plain','Iron','Steel','Tempered','Mythril','Golden','Dragon','Godforged'];
/* metal gear (pixel sprites): rarity -> metal. Names use the real metal: Copper, Chainmail, Iron, Diamond, Golden (swords: Wooden, Stone, Iron, Diamond, Golden) */
const MCN=['Copper','Chainmail','Iron','Diamond','Golden'],MCW=['Wooden','Stone','Iron','Diamond','Golden'],MCR=[0,1,2,2,3,4,4];
const RNAME=['Common','Uncommon','Rare','Very rare','Epic','Legendary','Mythical','Unique'];
const VIS=[0,1,2,2,3,4,5,5];                 /* rarity -> how the gear looks on the hero (6 looks) */
const OLD2NEW=[0,1,2,4,5,6];                 /* old 6-tier saves -> new rarity index */
const PETS={wolfpup:{e:'pet:wolfpup',n:'Fire Wolf Cub',sm:1,px:49,fire:1},sprite:{e:'🧚',n:'Sprite'},imp:{e:'😈',n:'Imp'},goblin:{e:'👺',n:'Goblin'},unicorn:{e:'🦄',n:'Unicorn'},golem:{e:'🗿',n:'Golem'},genie:{e:'🧞',n:'Genie'},troll:{e:'🧌',n:'Troll'},drake:{e:'🐲',n:'Drake'},dragon:{e:'🐉',n:'Dragon'},wendigo:{e:'pet:wendigo',n:'Wendigo',still:1},wizfrog:{e:'pet:wizfrog',n:'Wise Wizard Frog',sm:1,px:56,right:1}};
const PETMAP={cat:'imp',frog:'goblin',bunny:'sprite',turtle:'golem',bat:'wolfpup',wisp:'wolfpup',cinderpup:'wolfpup',owl:'genie',fox:'drake',wolf:'troll',duck:'sprite'};   /* old real-animal companions in saves become fantasy ones */
/* companion levels: a worn companion earns XP from every quest you finish (and loses it if you undo the quest); stronger and bigger each level */
const PMAX=60,BIG_LV=8;                                   /* from BIG_LV on it is big enough to stand behind the hero instead of beside it */
const pneed=l=>40*(l-1)*l;                                /* total companion XP for level l */
const PBASE=[1,5,10,15,20,25,35,45];                         /* a companion starts at a level set by its rarity (Common 1 ... Legendary 25 ... Unique 45) and still levels up from quests */
const pbase=it=>PBASE[Math.min(7,Math.max(0,it&&it.r|0))];
const ptot=it=>(it&&it.ce||0)+pneed(pbase(it));            /* total companion XP, counting the starting level */
const plv=it=>{const x=ptot(it);let l=1;while(l<PMAX&&x>=pneed(l+1))l++;return l};
const psize=l=>l<BIG_LV?34+7.5*(l-1):Math.min(250,130+10*(l-BIG_LV));   /* sprite size in px: Lv 1 = 34, Lv 7 = 79, Lv 8 = 130, Lv 20 = 250 (taller than the hero) */
const vlv=(k,l)=>PETS[k]&&PETS[k].sm?Math.min(l,BIG_LV-1):l;   /* look level: small companions (sm) stay in their small form forever; their bonuses still grow */
const psz=(k,l)=>{const p=PETS[k]&&PETS[k].px;return p?Math.max(2,Math.round(psize(l)/p))*p:psize(l)};   /* pixel-art companions (px = native size) only grow in whole-number zooms so their pixels stay sharp */
const pres=l=>l>=14?64:l>=BIG_LV?48:32;                   /* sprite resolution: bigger companions get more detail */
function eff(it,k){const v=it.b[k]||0;return it.slot==='companion'?Math.round(v*(1+.08*(plv(it)-1))):v}   /* companion bonuses grow +8% per level */
const PETQ=['Stray','Tame','Loyal','Clever','Noble','Fabled','Mythic','Spirit'];
const TNAME=['Bone Charm','Copper Ring','Silver Ring','Jade Ring','Gold Ring','Mythril Ring','Dragon Eye','Eye of the Void'];
const SUF={xp:'of Insight',gold:'of Fortune',dmg:'of Warding',hp:'of Vitality',bd:'of Slaying'};
const ICON={legs:{warrior:'👖'},boots:{warrior:'👢'},helm:{warrior:'\u26d1\ufe0f',mage:'\ud83c\udfa9',rogue:'\ud83e\udd77',cleric:'\ud83d\udc51'},armor:{warrior:'\ud83d\udee1\ufe0f',mage:'\ud83e\udde5',rogue:'\ud83e\udd4b',cleric:'\ud83d\udc58'},weapon:{warrior:'\u2694\ufe0f',great:'\ud83d\udde1\ufe0f',hammer:'\u2692\ufe0f',axe:'\ud83e\ude93',spear:'\ud83d\udd31',mage:'\ud83e\ude84',rogue:'\ud83d\udd2a',cleric:'\ud83d\udd28'},offhand:{warrior:'🛡️',mage:'📖',rogue:'🗡️',cleric:'🏮'}};
const RAR=['#8a7862','#58b368','#4a9ae0','#2fc7c0','#a56be0','#e8b93c','#ff7a4a','#ff4fd8'];   /* frame colour per rarity */
const STAT_TXT={xp:v=>(v<0?'':'+')+v+'% XP',gold:v=>(v<0?'':'+')+v+'% coins',dmg:v=>v<0?'+'+(-v)+'% damage taken':'-'+v+'% damage taken',hp:v=>(v<0?'':'+')+v+' max HP',bd:v=>(v<0?'':'+')+v+'% boss damage'};
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
  const base=it.slot==='trinket'?TNAME[it.r]:it.slot==='companion'?PETQ[it.r]+' '+(PETS[it.pet]||PETS.wolfpup).n:(it.ms!=null?(it.slot==='weapon'?MCW:MCN)[it.ms]:MATN[it.r])+' '+((it.slot==='weapon'&&it.sk!=null&&SKN[it.sk])||NOUN[it.slot][it.st]);
  return base+(main?' '+SUF[main]:'');
}
/* old saves had gear tiers per slot: turn them into loot items so nothing is lost */
const OLDCLS={cleric:'druid',monk:'bard'};   /* classes that were renamed: old saves keep their slot */
function migrate(s){
  if(OLDCLS[s.cls])s.cls=OLDCLS[s.cls];
  (s.inv||[]).forEach(i=>{if(i.slot==='companion'&&PETMAP[i.pet]){i.pet=PETMAP[i.pet];i.n=i.u&&UNIQ[i.u]?UNIQ[i.u].n:itemName(i)}});
  (s.inv||[]).forEach(i=>{if(i.slot==='weapon'&&!i.u&&i.sk!=null&&i.sk>=0&&i.sk<=15&&i.st!=='axe'){i.st='axe';i.n=itemName(i)}});   /* axe models only live on axes now */
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
const twoH=i=>!!i&&i.slot==='weapon'&&(i.st==='spear'||i.st==='great'||i.st==='hammer');   /* spears, greatswords and war hammers are two-handed */
const worn=k=>{if(k==='offhand'&&twoH(wornOf(S,'weapon')))return null;return wornOf(S,k)};   /* a two-hander in hand: nothing is held in the off-hand */
const hpOf=s=>SLOTS.reduce((a,k)=>{const i=wornOf(s,k);return a+(i?eff(i,'hp'):0)},0);
let TRYIT=null,WFX=null;   /* TRYIT: item being tried on in the Hero tab (only set briefly while previewing stats). WFX: slot just worn, for the flash */
function bsum(k){return SLOTS.reduce((a,s)=>{const i=TRYIT&&TRYIT.slot===s?TRYIT:worn(s);return a+(i?eff(i,k):0)},0)}

function fresh(){return {gems:0,freezes:0,pots:0,heals:0,echests:0,frozen:{},tasks:[],done:{},perfect:{},bonus:{},award:{},xp:0,badges:{},hp:hpBase(1),lastDay:addDays(today(),-1),log:[],defeats:0,gold:0,gAward:{},inv:[],worn:{},rv:2,cls:null,sub:null,chests:0,boss:null,look:null}}
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

/* consecutive perfect days ending at day d. A day with nothing scheduled, or a day covered by a Streak Freeze, does not break it (and does not add to it) */
function streakEnd(d,grace){
  let n=0,g=0;
  const rest=k=>!S.tasks.some(t=>t.created<=k&&active(t,k));
  while(g++<730){
    if(S.perfect[d])n++;
    else if(S.frozen&&S.frozen[d]){}
    else if(!rest(d)){if(grace)grace=false;else break}   /* Chronicler forgives one missed day */
    d=addDays(d,-1);
  }
  return n;
}
function streak(){let d=today();if(!S.perfect[d])d=addDays(d,-1);return streakEnd(d,hasSub('chronicler'))}
const sbm=()=>1+(S.cls==='bard'?.5*cm():0)+(hasSub('scholar')?.5*cm():0);   /* Bard: streak bonus per day and its cap are both multiplied */
const mult=()=>(1+Math.min(.5*sbm(),.1*sbm()*streak()))*(1+bsum('xp')/100)*(1+(S.cls==='mage'?.15*cm():0))*(1+.02*lvBonus());
const doneToday=()=>S.done[today()]||[];
let LT=null;   /* tag of the quest being completed right now: chronicle entries it causes are tagged so undo can remove them */
function addLog(m,c,tag,lv){S.log.unshift({d:today(),m,c,k:tag===undefined?LT:tag,lv});S.log=S.log.slice(0,8)}

/* ---------- check-in: before a day's missed quests cost HP, ask if they were really missed ----------
   You may just have forgotten to tick them. Days up to a week old can be corrected; anything you tick is marked done for that day
   (full rewards, boss damage, companion XP and perfect-day bonus, exactly as if ticked on the day), everything left unticked goes ahead with the usual penalties. */
let REV=0,REVDONE='';   /* REV = the check-in dialog is open; REVDONE = the last ended day that has already been checked in */
function missedDays(y){   /* ended days (a week back at most) that still have quests nobody marked */
  const out=[],from=addDays(today(),-7);
  for(let d=addDays(S.lastDay,1);d<=y;d=addDays(d,1)){
    if(d<from)continue;
    const done=S.done[d]||[],ts=S.tasks.filter(t=>t.created<=d&&active(t,d)&&!done.includes(t.id));
    if(ts.length)out.push({d,ts});
  }
  return out;
}
function applyReview(md,ticked){   /* mark the ticked quests as done on their own day, with the same rewards as ticking them on the day */
  let n=0,xp=0,gd=0,perf=0;const before=levelOf(S.xp);ensureBoss();
  md.forEach(({d,ts})=>{
    const arr=S.done[d]=S.done[d]||[];
    ts.forEach(task=>{
      const k=d+':'+task.id;
      if(!ticked.has(k)||arr.includes(task.id)||!S.tasks.some(z=>z.id===task.id))return;
      const fq=arr.length===0;arr.push(task.id);
      const a=xpGain(task.xp,fq,task),g=goldGain(task,fq);S.award[k]=a;S.gAward[k]=g;S.xp+=a;S.gold+=g;xp+=a;gd+=g;n++;
      const bd=bossDmg(task.xp);(S.bAward=S.bAward||{})[k]=bd;hitBoss(bd);
      if(hasSub('healer')&&task.xp>=40){const hh=Math.max(0,Math.min(Math.max(1,Math.round(hpBase(levelOf(S.xp))*.08*cm())),maxHp(levelOf(S.xp))-S.hp));if(hh){S.hp+=hh;(S.hAward=S.hAward||{})[k]=hh}}
      const cp=worn('companion');
      if(cp){const b4=plv(cp),cg=task.xp*(hasSub('beastmaster')?2:1);cp.ce=(cp.ce||0)+cg;(S.pAward=S.pAward||{})[k]={id:cp.id,x:cg};
        if(plv(cp)>b4){TR=bsum('hp');addLog(cp.n+' reached level '+plv(cp),'good')}}
    });
    const act=S.tasks.filter(z=>z.created<=d&&active(z,d));
    if(act.length&&act.every(z=>arr.includes(z.id))&&!S.bonus[d]){   /* the day is now fully done: perfect-day bonus and streak, as normal */
      const lv0=levelOf(S.xp),bx=Math.round(BONUS*lscale(lv0)*(hasSub('herald')?1+.5*cm():1)),hb=Math.max(2,Math.round(hpBase(lv0)*.25));
      const h=Math.max(0,Math.min(Math.round(hb*(S.cls==='druid'?1+cm():1)),maxHp(levelOf(S.xp+bx))-S.hp));
      const nc=1+(hasSub('herald')&&seedR('herald'+d)<.35?1:0);S.perfect[d]=1;const gm=streakEnd(d,hasSub('chronicler'))%7===0?2:0;
      S.bonus[d]={h,c:nc,x:bx,gm};S.chests+=nc;S.xp+=bx;S.hp+=h;S.gems=(S.gems||0)+gm;xp+=bx;perf++;
      addLog('Perfect day! +'+bx+' XP','good','p:'+d);
    }
  });
  if(!n)return;
  addLog('Marked '+n+' forgotten quest'+(n>1?'s':'')+' as done: +'+xp+' XP','good',null);
  const after=levelOf(S.xp);
  if(after>before){
    if(S.cls&&ctierAt(before)!==ctierAt(after))addLog('Promoted to '+CLS[S.cls].n[ctierAt(after)],'good');
    S.hp=maxHp(after);addLog('Reached level '+after,'good',undefined,after);
  }else S.hp=Math.min(S.hp,maxHp(after));
  toast('Marked '+n+' quest'+(n>1?'s':'')+' as done: +'+xp+' XP, +'+coinText(gd)+(perf?', '+perf+' perfect day'+(perf>1?'s':''):''));
  save();
}
function reviewMissed(md,y){
  const ticked=new Set(),keys=[],total=md.reduce((a,x)=>a+x.ts.length,0);
  const ov=el('div','modal on'),card=el('div','card rv'),list=el('div','rvlist'),rows=[];
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Unmarked quests');
  const info=el('p',''),ok=el('button','btn',''),all=el('button','ghost','Tick all'),box=el('div','stack');
  ok.type=all.type='button';
  const paint=()=>{
    const n=ticked.size;let hp=0;
    md.forEach(({d,ts})=>ts.forEach(t=>{if(!ticked.has(d+':'+t.id))hp+=penalty(t.xp)}));
    rows.forEach(([b,k])=>{const on=ticked.has(k);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);b.firstChild.textContent=on?'✓':''});
    info.textContent=hp?'Tap the ones you did. The rest will cost you '+hp+' HP.':'Everything is marked. No HP will be lost.';
    ok.textContent=n===0?'No, I missed them':n===total?'Yes, I did them all':'Mark '+n+' done, rest missed';
    all.textContent=n===total?'Untick all':'Tick all';
  };
  md.forEach(({d,ts})=>{
    list.appendChild(el('div','rvday',d===y?'Yesterday':new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})));
    ts.forEach(t=>{
      const k=d+':'+t.id,b=el('button','rvrow'),c=el('span','rvchk','');
      b.type='button';b.setAttribute('aria-label',t.name);keys.push(k);
      b.append(c,el('span','rvname',t.name),el('span','rvhp','-'+penalty(t.xp)+' HP'));
      b.onclick=()=>{if(ticked.has(k))ticked.delete(k);else ticked.add(k);paint()};
      rows.push([b,k]);list.appendChild(b);
    });
  });
  all.onclick=()=>{if(ticked.size===total)ticked.clear();else keys.forEach(k=>ticked.add(k));paint()};
  ok.onclick=()=>{ov.remove();REV=0;REVDONE=y;applyReview(md,ticked);process();render()};   /* what is left unticked now goes ahead with the penalties */
  box.append(ok,all);
  card.append(el('h2','','Did you finish these?'),info,list,box);
  ov.appendChild(card);document.body.appendChild(ov);   /* no outside tap or Esc: it has to be answered */
  paint();ok.focus();
}

/* ---------- consequences: runs for every day that has ended ---------- */
function process(){
  S.tasks=S.tasks.filter(t=>!(t.once&&t.once<addDays(today(),-90)));
  const y=addDays(today(),-1);
  if(S.lastDay>=y)return;
  if(S.lastDay<addDays(today(),-60))S.lastDay=addDays(today(),-60);
  if(REV)return;   /* the check-in is open: wait for the answer */
  if(REVDONE<y){const md=missedDays(y);if(md.length){REV=1;reviewMissed(md,y);return}}
  let hit=0,missed=0,days=0,fell=0,fz=0;
  for(let d=addDays(S.lastDay,1);d<=y;d=addDays(d,1)){
    const done=S.done[d]||[];let dmg=0,m=0;
    S.tasks.forEach(t=>{if(t.created<=d&&active(t,d)&&!done.includes(t.id)){dmg+=penalty(t.xp);m++}});
    if(!m)continue;
    days++;missed+=m;hit+=dmg;S.hp-=dmg;
    S.log.unshift({d,m:'Missed '+m+' quest'+(m>1?'s':'')+': -'+dmg+' HP',c:'bad'});
    if((S.freezes|0)>0&&streakEnd(addDays(d,-1),hasSub('chronicler'))>0){S.freezes--;(S.frozen=S.frozen||{})[d]=1;fz++;S.log.unshift({d,m:'Streak Freeze used: your streak is safe',c:'good'})}   /* only spent when there is a streak to protect */
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
    let msg='You missed '+missed+' quest'+(missed>1?'s':'')+' over '+days+' day'+(days>1?'s':'')+'.\nYou lost '+hit+' HP'+(fz?'. '+fz+' Streak Freeze'+(fz>1?'s':'')+' protected your streak.':' and your streak.');
    if(fell)msg+='\nYour HP ran out. You were defeated and dropped to level '+lv+'.';
    showModal(fell?'💀':'💔',fell?'Defeated':'Quests missed',msg,true);
    document.body.classList.add('shake');setTimeout(()=>document.body.classList.remove('shake'),500);
    try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}
  }
}

/* ---------- actions ---------- */
function toggle(id,ev){
  const t=today(),task=S.tasks.find(x=>x.id===id);if(!task||!active(task,t))return;ensureBoss();JUST=id;
  const arr=S.done[t]=S.done[t]||[],k=t+':'+id,before=levelOf(S.xp),i=arr.indexOf(id);
  if(i<0){
    LT=k;const fq=arr.length===0;arr.push(id);const a=xpGain(task.xp,fq,task),g=goldGain(task,fq);S.award[k]=a;S.gAward[k]=g;S.xp+=a;S.gold+=g;pop('+'+a+' XP +'+coinText(g),ev);buzz(30);const bd=bossDmg(task.xp);(S.bAward=S.bAward||{})[k]=bd;hitBoss(bd);attackFx(bd);if(hasSub('healer')&&task.xp>=40){const hh=Math.max(0,Math.min(Math.max(1,Math.round(hpBase(levelOf(S.xp))*.08*cm())),maxHp(levelOf(S.xp))-S.hp));if(hh){S.hp+=hh;(S.hAward=S.hAward||{})[k]=hh;toast('Healer: +'+hh+' HP')}}
    const cp=worn('companion');
    if(cp){const b4=plv(cp);const cg=task.xp*(hasSub('beastmaster')?2:1);cp.ce=(cp.ce||0)+cg;(S.pAward=S.pAward||{})[k]={id:cp.id,x:cg};
      if(plv(cp)>b4){TR=bsum('hp');addLog(cp.n+' reached level '+plv(cp),'good');toast('Your companion reached level '+plv(cp)+(plv(cp)===BIG_LV&&!(PETS[cp.pet]&&PETS[cp.pet].sm)?'. It is big enough to stand behind you now.':''))}}
  }else{
    LT=null;S.log=S.log.filter(l=>l.k!==k);
    arr.splice(i,1);S.xp=Math.max(0,S.xp-(S.award[k]||task.xp));delete S.award[k];S.gold=Math.max(0,S.gold-(S.gAward[k]||0));delete S.gAward[k];
    {const pa=(S.pAward||{})[k];if(pa){const ci=S.inv.find(z=>z.id===pa.id);if(ci){ci.ce=Math.max(0,(ci.ce||0)-pa.x);TR=bsum('hp')}delete S.pAward[k]}}
    const bd0=S.bAward&&S.bAward[k]!=null?S.bAward[k]:task.xp;if(S.bAward)delete S.bAward[k];{const ha=(S.hAward||{})[k];if(ha){S.hp=Math.max(1,S.hp-ha);delete S.hAward[k]}}
    if(S.boss&&S.boss.hp>0&&S.boss.hp<S.boss.max)S.boss.hp=Math.min(S.boss.max,S.boss.hp+bd0);
  }
  const act=S.tasks.filter(x=>active(x,t)),all=act.length>0&&act.every(x=>arr.includes(x.id));
  if(all&&!S.bonus[t]){
    const lv0=levelOf(S.xp),bx=Math.round(BONUS*lscale(lv0)*(hasSub('herald')?1+.5*cm():1)),hb=Math.max(2,Math.round(hpBase(lv0)*.25));
    const h=Math.max(0,Math.min(Math.round(hb*(S.cls==='druid'?1+cm():1)),maxHp(levelOf(S.xp+bx))-S.hp));
    const nc=1+(hasSub('herald')&&seedR('herald'+t)<.35?1:0);S.perfect[t]=1;const gm=streak()%7===0?2:0;S.bonus[t]={h,c:nc,x:bx,gm};S.chests+=nc;S.xp+=bx;S.hp+=h;S.gems=(S.gems||0)+gm;
    toast('Perfect day! +'+bx+' XP, +'+h+' HP, +'+nc+(nc>1?' chests (Herald bonus)':' chest')+(gm?', +'+gm+' gems (7-day streak)':''));buzz([40,60,40,60,120]);addLog('Perfect day! +'+bx+' XP','good','p:'+t);
  }else if(!all&&S.bonus[t]){
    S.xp=Math.max(0,S.xp-(S.bonus[t].x||BONUS));S.hp=Math.max(1,S.hp-(S.bonus[t].h||0));S.chests=Math.max(0,S.chests-(S.bonus[t].c||0));S.gems=Math.max(0,(S.gems||0)-(S.bonus[t].gm||0));delete S.bonus[t];delete S.perfect[t];S.log=S.log.filter(l=>l.k!=='p:'+t);
  }
  const after=levelOf(S.xp);
  if(i>=0){   /* undo: take back honours earned today that no longer hold, and level-ups that no longer hold */
    const E=earned();Object.keys(S.badges).forEach(id=>{if(!E[id]&&S.bDay&&S.bDay[id]===t){delete S.badges[id];delete S.bDay[id]}});
    S.log=S.log.filter(l=>!(l.lv&&l.lv>after));
  }
  if(after>before){
    if(S.cls&&ctierAt(before)!==ctierAt(after))addLog('Promoted to '+CLS[S.cls].n[ctierAt(after)],'good');
    S.hp=maxHp(after);addLog('Reached level '+after,'good',undefined,after);if(after===5)addLog('A class awaits in the Forge','good');if(before<15&&after>=15&&S.cls&&!S.sub)addLog('A subclass awaits in the Forge','good');
    showModal(S.cls?CLS[S.cls].e:rk(after)[1],'Level up!','You are now level '+after+', '+(S.cls?clsName():rk(after)[0])+'.\nMax HP raised, HP restored and all your stats improved.'+(before<15&&after>=15&&S.cls&&!S.sub?'\nA subclass awaits in the Forge.':'')+(after===5&&!S.cls?'\nA class awaits in the Forge.':''));
    confetti();
  }else S.hp=Math.min(S.hp,maxHp(after));
  LT=null;save();render();
}
function pop(txt,ev){
  if(!ev||!ev.currentTarget)return;
  const el=document.createElement('div');el.className='pop';el.textContent=txt;
  const r=ev.currentTarget.getBoundingClientRect();
  el.style.left=(r.left+r.width/2-30)+'px';el.style.top=(r.top-6)+'px';
  document.body.appendChild(el);setTimeout(()=>el.remove(),900);
}
let tt;
function toast(m){const t=$('toast');t.onclick=null;t.classList.remove('act');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2600)}
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
  rogue:{e:'🗡️',n:['Rogue','Thief','Trickster','Assassin','Shadowblade','Phantom'],d:'+20% coins'},
  druid:{e:'🌿',n:['Druid','Warden','Shaman','Hierophant','Archdruid','Wildheart'],d:'Double healing on perfect days'},
  bard:{e:'🎻',n:['Bard','Minstrel','Troubadour','Maestro','Virtuoso','Songweaver'],d:'Stronger streak bonus'},
  ranger:{e:'🏹',n:['Ranger','Tracker','Forester','Huntsman','Stalker','Deadeye'],d:'Bonus boss damage'}
};
const BOSSES=[['Goblin King','👹'],['Bog Troll','👺'],['Shadow Wraith','👻'],['Stone Golem','🗿'],['Ember Drake','🐲'],['The Lich','💀']];
const ctierAt=l=>Math.max(0,Math.min(5,Math.floor(l/5)-1));   /* a new class title every 5 levels: Lv 5, 10, 15, 20, 25, 30 */
const ctier=()=>ctierAt(levelOf(S.xp));
const cmAt=l=>.4+.07*Math.max(0,l-5);   /* class bonus strength: 40% of its base at Lv 5, +7% every level after (Lv 15 = 110%, Lv 25 = 180%) */
const cm=()=>cmAt(levelOf(S.xp));
const CB={warrior:[20,'% damage taken','-'],mage:[15,'% XP','+'],rogue:[20,'% coins','+'],bard:[50,'% streak bonus','+'],ranger:[20,'% boss damage','+']};
const clsBonusTxt=(k,l)=>{const m=cmAt(l);if(k==='druid')return 'Heals x'+(1+m).toFixed(2)+' on perfect days';const c=CB[k];return c[2]+(Math.round(c[0]*m*10)/10)+c[1]};
const roman=n=>{let r='';[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']].forEach(([v,s])=>{while(n>=v){r+=s;n-=v}});return r};
const clsName=()=>{const lv=levelOf(S.xp);return CLS[S.cls].n[ctier()]+(lv>=40?' '+roman(Math.floor(lv/10)-2):'')};   /* top title at Lv 30, then II at Lv 40, III at Lv 50... */
const goldMult=()=>(1+bsum('gold')/100)*(1+(S.cls==='rogue'?.2*cm():0))*(1+(hasSub('treasure')?.15*cm():0))*(1+.02*lvBonus());
const dmgMult=()=>{const r=bsum('dmg')/100+.01*lvBonus()+(S.cls==='warrior'?.2*cm():0)+(hasSub('guardian')?.1*cm():0);return r<=.5?1-r:.25/r};   /* diminishing returns, but every level still helps, forever */
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}

/* ---------- subclasses: unlock at level 15, permanent, chosen in the Forge ---------- */
const SUBS={warrior:['guardian','berserker'],mage:['scholar','battlemage'],rogue:['treasure','shadowblade'],druid:['healer','beastmaster'],bard:['chronicler','herald'],ranger:['sharpshooter','pathfinder']};
const SUBD={guardian:{n:'Guardian',e:'🏰'},berserker:{n:'Berserker',e:'🔥'},scholar:{n:'Scholar',e:'📚'},battlemage:{n:'Battlemage',e:'⚡'},treasure:{n:'Treasure Hunter',e:'💎'},shadowblade:{n:'Shadowblade',e:'🌑'},healer:{n:'Healer',e:'💚'},beastmaster:{n:'Beastmaster',e:'🐾'},chronicler:{n:'Chronicler',e:'📜'},herald:{n:'Herald',e:'📯'},sharpshooter:{n:'Sharpshooter',e:'🎯'},pathfinder:{n:'Pathfinder',e:'🧭'}};
const bossDmg=xp=>Math.round(xp*(S.boss&&S.boss.sc||1)*(1+bsum('bd')/100)*(1+(hasSub('berserker')?.3*cm():0)+(hasSub('battlemage')?.4*cm():0)+(S.cls==='ranger'?.2*cm():0)));
const seedR=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/10000};   /* same day = same roll, so undo/redo can't reroll */
function subTxt(id,l){
  const m=cmAt(l),r=x=>Math.round(x*m);
  return {
    guardian:'Extra '+r(10)+'% damage reduction, +'+Math.round(hpBase(l)*.2)+' max HP',
    berserker:'+'+r(30)+'% boss damage, but missed quests cost 25% more HP',
    scholar:'+'+r(50)+'% streak bonus',
    battlemage:'+'+r(40)+'% boss damage',
    treasure:'+'+r(15)+'% coins and better chest rolls',
    shadowblade:'+'+r(60)+'% XP and coins on your first quest each day',
    healer:'Heal '+Math.max(1,Math.round(hpBase(l)*.08*m))+' HP on every hard quest',
    beastmaster:'Companion XP doubled',
    chronicler:'One missed day will not break your streak',
    herald:'+'+r(50)+'% perfect-day XP and a 35% chance of a bonus chest',
    sharpshooter:'+'+r(40)+'% coins from hard quests',
    pathfinder:'+'+r(30)+'% XP and coins on custom-day and one-off quests'
  }[id];
}
/* subclass look + flavour: colours come from each subclass's plate under the rank, role is a one-word summary, fl is the tagline */
const SUBX={
  guardian:{c:'#4a5a78',c2:'#aab8d0',role:'Tank',fl:'A wall that walks. Little gets through.'},
  berserker:{c:'#9a2424',c2:'#ff8a4a',role:'Glass cannon',fl:'Hit harder, and hurt harder.'},
  scholar:{c:'#2a4a8a',c2:'#8fb8ff',role:'Streaker',fl:'Knowledge compounds, and so do streaks.'},
  battlemage:{c:'#5a2aa8',c2:'#c9a8ff',role:'Boss slayer',fl:'Spellfire saved for the weekly boss.'},
  treasure:{c:'#1f6a68',c2:'#ffd75a',role:'Looter',fl:'Every chest sings for you.'},
  shadowblade:{c:'#3a1a5a',c2:'#d9b8ff',role:'Opener',fl:'Strike first, and strike rich.'},
  healer:{c:'#2f8a4a',c2:'#c8ffd4',role:'Support',fl:'Hard days leave you stronger.'},
  beastmaster:{c:'#7a4a22',c2:'#ffd9a8',role:'Companion',fl:'Your companion never stops growing.'},
  chronicler:{c:'#8a6a3c',c2:'#f6dfae',role:'Safety net',fl:'Your story survives one bad day.'},
  herald:{c:'#a8283a',c2:'#ffe9a0',role:'Showman',fl:'Perfect days deserve a fanfare.'},
  sharpshooter:{c:'#2f5a2a',c2:'#ff8a7a',role:'Big game',fl:'One clean shot at the biggest target.'},
  pathfinder:{c:'#7a5a2a',c2:'#f4e2b0',role:'Explorer',fl:'The road less taken pays the best.'}
};
function subPerks(id,l){   /* up = what you gain, dn = what it costs */
  const m=cmAt(l),r=x=>Math.round(x*m);
  return {
    guardian:{up:['Extra '+r(10)+'% damage reduction','+'+Math.round(hpBase(l)*.2)+' max HP'],dn:[]},
    berserker:{up:['+'+r(30)+'% boss damage'],dn:['Missed quests cost 25% more HP']},
    scholar:{up:['+'+r(50)+'% streak bonus'],dn:[]},
    battlemage:{up:['+'+r(40)+'% boss damage'],dn:[]},
    treasure:{up:['+'+r(15)+'% coins','Chests drop gear more often, at better rarity'],dn:[]},
    shadowblade:{up:['+'+r(60)+'% XP and coins on your first quest each day'],dn:[]},
    healer:{up:['Heal '+Math.max(1,Math.round(hpBase(l)*.08*m))+' HP on every hard quest'],dn:[]},
    beastmaster:{up:['Companion XP doubled'],dn:[]},
    chronicler:{up:['One missed day will not break your streak'],dn:[]},
    herald:{up:['+'+r(50)+'% perfect-day XP','35% chance of a bonus chest'],dn:[]},
    sharpshooter:{up:['+'+r(40)+'% coins from hard quests'],dn:[]},
    pathfinder:{up:['+'+r(30)+'% XP and coins on custom-day and one-off quests'],dn:[]}
  }[id];
}
function subIconBig(st,id,k){const c=subIcon(st,id);c.classList.add('px');c.style.width=parseFloat(c.style.width)*(k||2)+'px';c.style.height=parseFloat(c.style.height)*(k||2)+'px';return c}
function subPerkList(id,lv){
  const p=subPerks(id,lv),w=el('div','spl');
  p.up.forEach(t=>{const r=el('div','spp up');r.append(el('i','','+'),el('span','',t));w.appendChild(r)});
  p.dn.forEach(t=>{const r=el('div','spp dn');r.append(el('i','','-'),el('span','',t));w.appendChild(r)});
  return w;
}
function subTheme(n,id){const X=SUBX[id];n.style.setProperty('--sc',X.c);n.style.setProperty('--sd',X.c2);return n}
let SUBSEL=null;   /* the path tapped in the picker (not chosen until you confirm) */
function subCard(id,lv,mode){   /* mode: 'pick' (tappable), 'skip' (the path you did not take) */
  const U=SUBD[id],X=SUBX[id],c=el(mode==='pick'?'button':'div','spc '+mode+(mode==='pick'&&lv<15?' lock':''));
  if(mode==='pick'){c.type='button';c.dataset.id=id}
  subTheme(c,id);
  const ic=el('span','spi');ic.appendChild(subIconBig('on',id,3));
  if(mode==='pick'&&lv<15){const pl=el('span','lockpad');pl.appendChild(px('🔒',16));ic.appendChild(pl)}
  c.append(ic,el('b','spn',U.n),el('span','spr',X.role),el('span','spt',X.fl));
  c.setAttribute('aria-label',U.n+', '+X.role+'. '+subPerks(id,Math.max(lv,15)).up.join(', ')+(lv<15?'. Locked until level 15':''));
  return c;
}
function subBox(lv){
  const box=el('div','subbox'),ids=SUBS[S.cls]||[],st=S.sub?'on':lv>=15?'ready':'off';
  const hd=el('div','sphd '+st);
  hd.append(subIconBig(st,S.sub,2),el('b','','Subclass'),el('span','sptag',st==='on'?'Chosen':st==='ready'?'Choose now':'Unlocks at Lv 15'));
  box.appendChild(hd);
  /* chosen: an emblem card for your path, and the road you did not take */
  if(S.sub){
    const U=SUBD[S.sub],X=SUBX[S.sub],own=subTheme(el('div','spown'),S.sub),top=el('div','spot'),ii=el('span','spi big'),tx=el('div','spx');
    ii.appendChild(subIconBig('on',S.sub,4));
    tx.append(el('b','spn',U.n),el('span','spr',X.role));
    top.append(ii,tx);
    own.append(top,el('div','spt',X.fl),subPerkList(S.sub,lv),el('i','spstamp','Permanent'));
    box.appendChild(own);
    const other=ids.find(i=>i!==S.sub);
    if(other){box.append(el('div','sub spskl','Path not taken'),subCard(other,lv,'skip'))}
    return box;
  }
  box.appendChild(el('div','sub',lv<15?'Two paths wait for you at level 15. Tap one to see what it does.':'Choose your path. It is permanent, so read both first.'));
  const g=el('div','spgrid'),det=el('div','spdet');
  const show=id=>{
    SUBSEL=id;g.querySelectorAll('.spc').forEach(x=>x.classList.toggle('on',x.dataset.id===id));
    det.replaceChildren();det.classList.toggle('has',!!id);
    if(!id){det.appendChild(el('div','sub','Tap a path to see exactly what it does.'));return}
    const U=SUBD[id],X=SUBX[id],hb=el('div','spdh'),ok=el('button','btn wide','Become a '+U.n);
    subTheme(det,id);hb.append(el('b','',U.n),el('span','spr',X.role));
    ok.type='button';
    if(lv<15){ok.textContent='Unlocks at level 15';ok.disabled=true}
    ok.onclick=()=>{
      if(levelOf(S.xp)<15)return;
      const l=levelOf(S.xp);S.sub=id;SUBSEL=null;S.hp=Math.min(maxHp(l),S.hp+subHp(id,l));
      addLog('Became a '+U.n,'good');buzz(40);
      const p=subPerks(id,l);showModal(U.e,'You are now a '+U.n,X.fl+'\n'+p.up.concat(p.dn).join('\n'));
      save();render();
    };
    det.append(hb,el('div','spt',X.fl),subPerkList(id,Math.max(lv,15)),el('div','spwarn','Permanent. You cannot change it later.'),ok);
  };
  ids.forEach(id=>{const c=subCard(id,lv,'pick');c.onclick=()=>show(SUBSEL===id?null:id);g.appendChild(c)});
  box.append(g,det);
  show(ids.includes(SUBSEL)?SUBSEL:null);
  if(lv<15){
    const pb=el('div','bar xp cbar'),pf=document.createElement('i');
    pf.style.width=Math.min(100,(lv-1+(S.xp-need(lv))/(need(lv+1)-need(lv)))/14*100)+'%';
    pb.append(pf,el('em','','Lv '+lv+' / 15'));box.append(pb,el('div','sub spgo',(15-lv)+(15-lv===1?' level':' levels')+' to go'));
  }
  return box;
}
/* ---------- classes: unlock at level 5, permanent, chosen in the Forge ----------
   same look as the subclass section: header plate, cards in each class's colours, a detail sheet (bonus, how it grows, title ladder, the subclasses it leads to),
   an emblem card once chosen with a progress bar to your next title. role = one word, fl = tagline, best = who it suits. */
const CLSX={
  warrior:{c:'#8a3030',c2:'#ffb4a0',role:'Defender',fl:'Take less from every missed quest.',best:'When you sometimes miss quests'},
  mage:{c:'#3a4a9a',c2:'#a8c0ff',role:'Fast learner',fl:'Turn every quest into more XP.',best:'Climbing levels fast'},
  rogue:{c:'#2a6a52',c2:'#ffd75a',role:'Coin hunter',fl:'Pocket more coins from every quest.',best:'Buying chests and gear'},
  druid:{c:'#2f7a45',c2:'#c8ffd4',role:'Healer',fl:'Perfect days restore far more HP.',best:'Chasing perfect days'},
  bard:{c:'#8a4a7a',c2:'#ffd0f0',role:'Streaker',fl:'Streaks pay out much bigger.',best:'Keeping long streaks'},
  ranger:{c:'#3a6a30',c2:'#c8e890',role:'Hunter',fl:'Every arrow finds the weekly boss.',best:'Taking down weekly bosses'}
};
const CLSL={warrior:'damage taken',mage:'XP',rogue:'coins',druid:'heal on perfect days',bard:'streak bonus',ranger:'boss damage'};
const clsVal=(k,l)=>{const m=cmAt(l);if(k==='druid')return 'x'+(1+m).toFixed(2);const c=CB[k];return c[2]+(Math.round(c[0]*m*10)/10)+'%'};
const clsPerk=(k,l)=>{const m=cmAt(l),v=k==='druid'?0:Math.round(CB[k][0]*m*10)/10;return k==='warrior'?'Take '+v+'% less damage':k==='druid'?'Heal x'+(1+m).toFixed(2)+' on perfect days':'+'+v+CB[k][1]};
const clsTheme=(n,k)=>{n.style.setProperty('--sc',CLSX[k].c);n.style.setProperty('--sd',CLSX[k].c2);return n};
function clsIcon(k,sz){const c=px(CLS[k].e,16);c.style.width=c.style.height=sz+'px';return c}
let CLSSEL=null;   /* the class tapped in the picker (not chosen until you confirm) */
function perkRow(t){const w=el('div','spl'),r=el('div','spp up');r.append(el('i','','+'),el('span','',t));w.appendChild(r);return w}
function clsGrowth(k,lv){   /* [label, row]: the bonus at Lv 5, 15 and 25; the step you have reached is lit */
  const w=el('div','clsg'),cur=[5,15,25].filter(L=>lv>=L).pop();
  [5,15,25].forEach(L=>{const d=el('div',L===cur?'cur':'');d.append(el('small','','Lv '+L),el('b','',clsVal(k,L)));w.appendChild(d)});
  return [el('div','spsl','Grows with level: '+CLSL[k]),w];
}
function clsLadder(k,lv){   /* the six titles, one every 5 levels, as a single wrapped line of chips */
  const w=el('div','clst'),t=lv>=5?ctierAt(lv):-1;
  CLS[k].n.forEach((n,i)=>{const d=el('span',lv<5?'':i<t?'done':i===t?'cur':'fut');d.title='Level '+(5+i*5);d.append(el('i','',String(5+i*5)),document.createTextNode(n));w.appendChild(d)});
  return w;
}
function clsPaths(k){   /* the two subclasses this class leads to */
  const w=el('div','clsp');w.appendChild(el('small','','Lv 15'));
  (SUBS[k]||[]).forEach(id=>{const d=el('div'),ic=subIcon('on',id);ic.classList.add('px');d.append(ic,el('span','',SUBD[id].n));w.appendChild(d)});
  return w;
}
function clsCard(k,lv){
  const X=CLSX[k],c=el('button','spc cls'+(lv<5?' lock':'')),ic=el('span','spi');
  c.type='button';c.dataset.id=k;clsTheme(c,k);
  ic.appendChild(clsIcon(k,36));
  if(lv<5){const pl=el('span','lockpad');pl.appendChild(px('🔒',16));ic.appendChild(pl)}
  c.append(ic,el('b','spn',CLS[k].n[0]),el('span','spr',X.role));
  c.setAttribute('aria-label',CLS[k].n[0]+', '+X.role+'. '+clsPerk(k,Math.max(lv,5))+(lv<5?'. Locked until level 5':''));
  return c;
}
function classBox(lv){
  const box=el('div','clsbox'),st=S.cls?'on':lv>=5?'ready':'off',hd=el('div','sphd '+st);
  hd.append(st==='on'?clsIcon(S.cls,28):subIconBig(st,null,2),el('b','','Class'),el('span','sptag',st==='on'?'Chosen':st==='ready'?'Choose now':'Unlocks at Lv 5'));
  box.appendChild(hd);
  /* chosen: emblem card with your current title, the bonus now, how it grows, the ladder, and the road to the next title */
  if(S.cls){
    const k=S.cls,X=CLSX[k],own=clsTheme(el('div','spown'),k),top=el('div','spot'),ii=el('span','spi big'),tx=el('div','spx');
    ii.appendChild(clsIcon(k,52));tx.append(el('b','spn',clsName()),el('span','spr',X.role));top.append(ii,tx);
    own.append(top,el('div','spt',X.fl),perkRow(clsPerk(k,lv)),...clsGrowth(k,lv),el('div','spsl','Titles'),clsLadder(k,lv));
    const prev=lv>=40?Math.floor(lv/10)*10:lv>=30?30:Math.floor(lv/5)*5,next=lv>=40?prev+10:lv>=30?40:prev+5;
    const pos=lv-1+(S.xp-need(lv))/(need(lv+1)-need(lv)),fr=Math.max(0,Math.min(1,(pos-(prev-1))/(next-prev)));
    const nt=lv>=30?CLS[k].n[5]+' '+roman(Math.floor(next/10)-2):CLS[k].n[ctierAt(next)];
    const pb=el('div','bar xp cbar'),pf=document.createElement('i');pf.style.width=Math.round(fr*100)+'%';pb.append(pf,el('em','','Lv '+lv+' / '+next));
    own.append(pb,el('div','sub spgo',nt+' at level '+next),el('i','spstamp','Permanent'));
    box.appendChild(own);
    return box;
  }
  box.appendChild(el('div','sub',lv<5?'Pick a class at level 5. Tap one to see what it does.':'Choose your class. It is permanent and only changes your bonuses, not your look.'));
  const g=el('div','spgrid cls'),det=el('div','spdet');
  const show=k=>{
    CLSSEL=k;g.querySelectorAll('.spc').forEach(x=>x.classList.toggle('on',x.dataset.id===k));
    det.replaceChildren();det.classList.toggle('has',!!k);
    if(!k){det.appendChild(el('div','sub','Tap a class to see its bonus, titles and subclasses.'));return}
    const X=CLSX[k],hb=el('div','spdh'),ok=el('button','btn wide','Become a '+CLS[k].n[0]);
    clsTheme(det,k);hb.append(el('b','',CLS[k].n[0]),el('span','spr',X.role));
    ok.type='button';
    if(lv<5){ok.textContent='Unlocks at level 5';ok.disabled=true}
    ok.onclick=()=>{
      const l=levelOf(S.xp);if(l<5)return;
      S.cls=k;CLSSEL=null;addLog('Became a '+CLS[k].n[0],'good');buzz(40);
      showModal(CLS[k].e,'You are now a '+CLS[k].n[0],X.fl+'\n'+clsPerk(k,l)+'\nA subclass awaits at level 15.');
      save();render();
    };
    det.append(hb,el('div','spt',X.fl),perkRow(clsPerk(k,Math.max(lv,5))),el('div','spbest','Best for: '+X.best),...clsGrowth(k,lv),el('div','spsl','Titles'),clsLadder(k,lv),el('div','spsl','Leads to'),clsPaths(k),el('div','spwarn','Permanent choice'),ok);
  };
  Object.keys(CLS).forEach(k=>{const c=clsCard(k,lv);c.onclick=()=>show(CLSSEL===k?null:k);g.appendChild(c)});
  box.append(g,det);
  show(CLSSEL&&CLS[CLSSEL]?CLSSEL:null);
  if(lv<5){
    const pb=el('div','bar xp cbar'),pf=document.createElement('i');
    pf.style.width=Math.min(100,(lv-1+(S.xp-need(lv))/(need(lv+1)-need(lv)))/4*100)+'%';
    pb.append(pf,el('em','','Lv '+lv+' / 5'));box.append(pb,el('div','sub spgo',(5-lv)+(5-lv===1?' level':' levels')+' to go'));
  }
  return box;
}
/* weekly bosses: the tier follows your level (goblins and wolves early, dragons much later).
   [name, emoji, base HP at Lv 1]. HP and your hits are both multiplied by the level scale (sc), so every tier stays beatable. */
const BTIERS=[
  {min:1,pool:[['Goblin Warrior','👺',120],['Direwolf Pack','🐺',140],['Bandit Gang','🥷',160]]},
  {min:5,pool:[['Spider Nest','🕷️',190],['Bog Troll','🧌',210],['Skeleton Warband','💀',230]]},
  {min:10,pool:[['Ogre Brute','👹',260],['Stone Golem','🗿',280],['Shadow Wraith','👻',300]]},
  {min:15,pool:[['Ember Drake','🐲',330],['Frost Giant','🧊',350],['Marsh Hydra','🐍',370]]},
  {min:20,pool:[['Ancient Dragon','🐉',400],['Demon Lord','😈',420],['The Lich','🧟',440]]},
  {min:30,pool:[['Elder Dragon','🐉',480],['Archdemon','👿',500],['Abyssal Kraken','🦑',520]]}
];
const BSHARE=[.35,.45,.55,.65,.75,.85];   /* boss HP = this share of what a perfect week of your posted quests would deal, by tier. Board size cancels out; class, subclass and gear are your edge. */
function weekCap(){let c=0,d=weekKey();for(let i=0;i<7;i++,d=addDays(d,1))S.tasks.forEach(t=>{if(active(t,d))c+=t.xp});return c}   /* every quest scheduled Mon-Sun, at base damage */
const BART={'Direwolf Pack':'pet:direwolfpack','Goblin Warrior':'pet:goblinband'};   /* bosses drawn as pixel art instead of an emoji */
const BALIAS={'Goblin Band':'Goblin Warrior'};   /* saves made before the rename still hold the old name */
const bossOf=b=>{const n=b.n&&(BALIAS[b.n]||b.n);return n?[n,BART[n]||b.e]:BOSSES[b.idx]};   /* old saves only stored an index into BOSSES */
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
    const rw=b.rw||{g:50,c:1};const gm=2+(b.tier||0);S.chests+=rw.c;S.kills=(S.kills|0)+1;S.gold+=rw.g;S.gems=(S.gems||0)+gm;addLog('Defeated '+bossOf(b)[0]+'! +'+coinText(rw.g)+', +'+rw.c+' chest'+(rw.c>1?'s':'')+', +'+gm+' gems','good',null);
    showModal('🏆','Boss defeated!',bossOf(b)[0]+' has fallen.\n+'+coinText(rw.g)+', '+(rw.c>1?rw.c+' chests':'a chest')+' and '+gm+' gems.');confetti();
  }
}
/* ---------- shop: gold and gems ----------
   Gold comes from quests and bosses. Gems are rarer: the weekly boss drops 2+ and every 7th day of a perfect streak gives 2. */
const FREEZE_MAX=3,POT_MAX=10,HEAL_MAX=5,EPIC_MAX=10;   /* how many of each you can carry in the Hero tab inventory */
function healHp(f){const m=maxHp(levelOf(S.xp));S.hp=Math.min(m,S.hp+Math.max(1,Math.round(m*f)))}
function epicChest(){
  S.copened=(S.copened|0)+1;
  const it=rollLoot(3);S.inv.push(it);addLog('Found '+it.n,'good');
  showModal(iicon(it),RNAME[it.r]+' loot!',it.n+'\n'+bonusTxt(it)+(it.u&&UNIQ[it.u]?'\n'+UNIQ[it.u].d:'')+'\nFind it in the Hero tab.');
}
const SHOP={
  g:[
    {id:'fz',cost:120,e:'🧊',n:'Streak Freeze',d:'Saves your streak when you miss a day. It sits in your Hero tab inventory and kicks in by itself at midnight. Hold up to '+FREEZE_MAX+'.',ok:()=>(S.freezes|0)<FREEZE_MAX,full:'Max',buy:()=>{S.freezes=(S.freezes|0)+1;toast('Streak Freeze ready')}},
    {id:'pot',cost:50,e:'🧪',n:'Healing Potion',d:'Goes into your Hero tab inventory. Use it there to restore 40% of your max HP. Carry up to '+POT_MAX+'.',ok:()=>(S.pots|0)<POT_MAX,full:'Max',buy:()=>{S.pots=(S.pots|0)+1;toast('Healing Potion added to your inventory')}},
    {id:'ch',cost:150,e:'🎁',n:'Loot Chest',d:'A random chest. Goes into your inventory: open it in the Hero tab (or at the shop counter).',buy:()=>{S.chests++;toast('Bought a chest')}}
  ],
  m:[
    {id:'fz',cost:4,e:'🧊',n:'Streak Freeze',d:'The same freeze, paid in gems.',ok:()=>(S.freezes|0)<FREEZE_MAX,full:'Max',buy:()=>{S.freezes=(S.freezes|0)+1;toast('Streak Freeze ready')}},
    {id:'heal',cost:3,e:'💖',n:'Full Heal',d:'Goes into your Hero tab inventory. Use it there to restore all your HP. Carry up to '+HEAL_MAX+'.',ok:()=>(S.heals|0)<HEAL_MAX,full:'Max',buy:()=>{S.heals=(S.heals|0)+1;toast('Full Heal added to your inventory')}},
    {id:'epic',cost:6,e:'💠',n:'Epic Chest',d:'Goes into your Hero tab inventory. Open it there: loot of Very rare quality or better. Carry up to '+EPIC_MAX+'.',ok:()=>(S.echests|0)<EPIC_MAX,full:'Max',buy:()=>{S.echests=(S.echests|0)+1;toast('Epic Chest added to your inventory')}}
  ]
};
function shopBuy(cur,it){
  const have=cur==='g'?S.gold:(S.gems||0);
  if(have<it.cost||(it.ok&&!it.ok()))return;
  if(cur==='g')S.gold-=it.cost;else S.gems-=it.cost;
  it.buy();buzz(30);save();render();
}
/* item view + confirm before any purchase (shop shelves or armoury / pens) */
function confirmBuy(it,priceLabel,doBuy){
  const ov=el('div','modal on'),card=el('div','card');
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label',it.n||'Item');
  const esc=e=>{if(e.key==='Escape')close()};
  const close=()=>{ov.remove();document.removeEventListener('keydown',esc)};
  const me=el('div','me');me.appendChild(px(typeof it.e==='string'?it.e:iicon(it),48));
  const title=el('h2','',it.n||'Item');
  const bits=[];
  if(it.r!=null)bits.push(RNAME[it.r]||'');
  if(it.slot)bits.push(SLOTN[it.slot]||it.slot);
  let desc=(bits.filter(Boolean).join(' · ')||'')+(it.d?'\n'+it.d:'');
  if(it.b&&Object.keys(it.b).length){
    desc+=(desc?'\n':'')+bonusTxt(it);
    if(it.u&&typeof UNIQ!=='undefined'&&UNIQ[it.u])desc+='\n'+UNIQ[it.u].d;
  }
  if(it.slot==='companion'){
    const L=typeof pbase==='function'?pbase(it):1;
    desc+='\nStarts at Lv '+L+' for its rarity and grows as you finish quests.';
  }
  const sub=el('p','',desc);
  const price=el('p','');price.style.font='400 14px var(--head)';price.style.color='var(--gold)';price.textContent='Price: '+priceLabel;
  const acts=el('div','stack');
  const buy=el('button','btn','Buy');buy.type='button';
  buy.onclick=()=>{close();doBuy()};
  const cancel=el('button','ghost','Cancel');cancel.type='button';cancel.onclick=close;
  acts.append(buy,cancel);
  card.append(me,title,sub,price,acts);
  ov.onclick=e=>{if(e.target===ov)close()};
  ov.appendChild(card);document.body.appendChild(ov);
  document.addEventListener('keydown',esc);buy.focus();
}
function renderShop(){
  const ds=$('dot-shop');if(ds)ds.hidden=!(S.chests>0);
  if(window.sfShelfRefresh)window.sfShelfRefresh();   /* keep the zoomed-in shelves in step with your purse and stock */
  if(window.sfFloorRefresh)window.sfFloorRefresh();   /* and the armoury / companion pens on the floor */
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
function rollLoot(minR){
  let r=rollRarity();if(minR&&r!==7&&r<minR)r=minR;   /* minR: guaranteed minimum rarity (Epic Chest) */
  if(r===7){   /* a unique: pick a named item you don't already own */
    const own=new Set(S.inv.map(i=>i.u).filter(Boolean)),pool=Object.keys(UNIQ).filter(k=>!own.has(k));
    if(pool.length){
      const k=pool[Math.floor(Math.random()*pool.length)],U=UNIQ[k];
      return {id:uid(),slot:U.slot,r:7,u:k,v:U.v,st:U.st,pet:U.pet,b:Object.assign({},U.b),n:U.n,isNew:true};
    }
    r=6;   /* you own every unique: this one drops as Mythical gear instead */
  }
  return buildGear(SLOTS[Math.floor(Math.random()*SLOTS.length)],r);
}
/* one piece of gear or one companion of a given slot and rarity: random drops use it, and so do the shop's armoury and companion pens (st = look, pet = which companion; both optional) */
function buildGear(slot,r,st,pet){
  const n=Math.min(4,1+(r>=2?1:0)+(r>=4?1:0)),b={};
  Object.keys(STAT_STEP).sort(()=>Math.random()-.5).slice(0,n).forEach(k=>{b[k]=Math.max(1,Math.round(STAT_STEP[k]*RSC[r]*(.6+Math.random()*.8)))});
  const ks=Object.keys(NOUN[slot]||{});
  const pool=r>=5?['dragon','drake','unicorn','genie','wendigo','wizfrog']:r>=3?['unicorn','genie','golem','troll','drake','wendigo','wizfrog']:['wolfpup','sprite','imp','goblin','wendigo','wizfrog'];
  let s0=st!=null?st:(ks.length?ks[Math.floor(Math.random()*ks.length)]:null);
  /* random drops (no look given) lean toward the metal sets: half of all helms and chestplates, a fifth of all weapons */
  if(st==null&&((slot==='helm'||slot==='armor')&&Math.random()<.5||slot==='weapon'&&Math.random()<.2))s0='warrior';
  const it={id:uid(),slot,r,b,st:s0,isNew:true},mi=MCR[Math.min(6,r)];
  if(slot==='companion')it.pet=pet||pool[Math.floor(Math.random()*pool.length)];
  if(MCA[slot]&&(slot==='legs'||slot==='boots'||s0==='warrior'))it.ms=mi;   /* helm, chestplate, leggings, boots: a metal and its sprite */
  if(slot==='weapon'){
    if(s0==='warrior'&&Math.random()<(st==null?1:.5)){it.ms=mi;it.sk=mi===3?[67,69,70][Math.floor(Math.random()*3)]:64+mi}   /* the wood / stone / iron / diamond / gold sword; diamond is the sword, the sheet's sword or the pickaxe */
    else{it.sk=pickSkin(it.st,r);if(it.sk===69||it.sk===70)it.ms=3}   /* the diamond sword and pickaxe are always named Diamond */
  }
  if(slot==='offhand'&&s0==='warrior')it.shk=Math.floor(Math.random()*SHD.length);   /* a shield gets the heraldic shield or the plank shield */
  it.n=itemName(it);return it;
}
const iicon=it=>(it.slot==='offhand'&&it.shk!=null)?'shd:'+(it.shk%SHD.length):it.slot==='trinket'?'trk:'+it.r:it.slot==='companion'?(PETS[it.pet]||PETS.wolfpup).e:(it.slot==='weapon'&&it.sk!=null&&SKIN[it.sk])?'wpn:'+it.sk:(it.ms!=null&&MCA[it.slot])?'mc:'+it.slot+':'+it.ms:ICON[it.slot][it.st];
const dicon=k=>k==='trinket'?'\ud83d\udcff':k==='companion'?'🐾':ICON[k][S.cls&&NOUN[k][S.cls]?S.cls:'warrior'];
const sellVal=it=>it.u?120:10*(it.r+1)*(it.r+1);
function openChest(){
  if(S.chests<1)return;S.chests--;S.copened=(S.copened|0)+1;
  const r=Math.random();let e,t,m;
  const lp=hasSub('treasure')?.84:.72;if(r<lp){
    const it=rollLoot();S.inv.push(it);
    e=iicon(it);t=RNAME[it.r]+' loot!';m=it.n+'\n'+bonusTxt(it)+(it.u&&UNIQ[it.u]?'\n'+UNIQ[it.u].d:'')+'\nFind it in the Hero tab.';
    addLog('Found '+it.n,'good');
  }else{
    if(r<lp+(1-lp)*.64){const g=30+Math.floor(Math.random()*51);S.gold+=g;e='coin:'+topCoin(g);t='Coins!';m='You found '+coinText(g)+'.'}
    else{const h=Math.max(0,Math.min(Math.round(hpBase(levelOf(S.xp))*.4),maxHp(levelOf(S.xp))-S.hp));S.hp+=h;e='🧪';t='Healing potion';m='You recovered '+h+' HP.'}
    addLog('Opened a chest: '+t,'good');
  }
  showModal(e,t,m);buzz(40);save();render();
}
function wear(id){
  const it=S.inv.find(i=>i.id===id);if(!it)return;
  S.worn=S.worn||{};
  if(S.worn[it.slot]===id)delete S.worn[it.slot];
  else{
    if(it.slot==='offhand'&&twoH(wornOf(S,'weapon'))){toast('A '+(({great:'greatsword',hammer:'war hammer'})[wornOf(S,'weapon').st]||'spear')+' needs both hands. Put it away to use an off-hand.');buzz(20);return}
    if(twoH(it)&&S.worn.offhand){delete S.worn.offhand;toast('Two-handed: your off-hand item was put away')}
    S.worn[it.slot]=id;WFX=it.slot
  }
  TR=bsum('hp');save();render();
}
function sell(id){
  const it=S.inv.find(i=>i.id===id);if(!it||(S.worn||{})[it.slot]===id)return;
  const v=sellVal(it);S.inv=S.inv.filter(i=>i.id!==id);S.gold+=v;
  toast('Sold '+it.n+' for '+coinText(v));save();render();
}
/* ---------- inventory (Hero tab): things you buy are kept here and only used when you tap Use / Open ---------- */
function usePotion(){
  if((S.pots|0)<1)return;
  if(S.hp>=maxHp(levelOf(S.xp))){toast('Your HP is already full');return}
  S.pots--;const b=S.hp;healHp(.4);const g=Math.round(S.hp-b);
  addLog('Drank a Healing Potion: +'+g+' HP','good');toast('+'+g+' HP');buzz(30);save();render();
}
function useFullHeal(){
  if((S.heals|0)<1)return;
  if(S.hp>=maxHp(levelOf(S.xp))){toast('Your HP is already full');return}
  S.heals--;const b=S.hp;healHp(1);const g=Math.round(S.hp-b);
  addLog('Used a Full Heal: +'+g+' HP','good');toast('Fully healed');buzz([30,40,30]);save();render();
}
function openEpic(){
  if((S.echests|0)<1||CHEST_BUSY)return;
  S.echests--;epicChest();buzz(40);save();render();
}
function openLootChest(){
  if(S.chests<1||CHEST_BUSY)return;
  openChest();
}
function invRows(){   /* what is in the pack right now: [icon, name, count, text, button label, handler, disabled?, label when disabled] */
  const fullHp=S.hp>=maxHp(levelOf(S.xp)),r=[];
  if((S.pots|0)>0)r.push(['🧪','Healing Potion',S.pots|0,'Restores 40% of your max HP.','Use',usePotion,fullHp,'HP full']);
  if((S.heals|0)>0)r.push(['💖','Full Heal',S.heals|0,'Restores all your HP.','Use',useFullHeal,fullHp,'HP full']);
  if((S.chests|0)>0)r.push(['🎁','Loot Chest',S.chests|0,'A random chest: gear, coins or a potion.','Open',openLootChest,false]);
  if((S.echests|0)>0)r.push(['💠','Epic Chest',S.echests|0,'Loot of Very rare quality or better.','Open',openEpic,false]);
  if((S.freezes|0)>0)r.push(['🧊','Streak Freeze',S.freezes|0,'Held. Saves your streak by itself if you miss a day.',null,null,true]);
  return r;
}
function renderInv(){
  const box=$('inv');if(!box)return;
  const rows=invRows(),total=rows.reduce((a,x)=>a+x[2],0);
  box.replaceChildren();
  const hd=el('div','invhd');hd.append(el('b','','Pack'),el('span','',total?total+' item'+(total===1?'':'s'):'Empty'));
  box.appendChild(hd);
  if(!rows.length){box.appendChild(el('div','invempty','Nothing here yet. Potions, heals and chests you buy in the Shop are kept in this pack until you use them.'));return}
  const g=el('div','invlist');
  rows.forEach(([e,n,c,d,lab,fn,off,offLab])=>{
    const row=el('div','invrow'+(lab?'':' passive')),ic=el('div','invic');ic.appendChild(px(e,32));
    ic.appendChild(el('i','invn','x'+c));
    const tx=el('div','invtx');tx.append(el('b','',n),el('small','',d));
    row.append(ic,tx);
    if(lab){const b=el('button','btn',off&&offLab?offLab:lab);b.type='button';b.disabled=!!off;b.onclick=fn;row.appendChild(b)}
    else row.appendChild(el('span','invtag','AUTO'));
    g.appendChild(row);
  });
  box.appendChild(g);
}
/* ---------- hero tab: equipment showcase ---------- */
/* what you wear sets your bonuses and your look. Nothing worn in a slot = plain starter look. */
function eqLook(over){   /* over = an item to show instead of what is worn in its slot (try-on) */
  const e={},dflt=k=>S.cls&&NOUN[k][S.cls]?S.cls:'warrior',sk={helm:'sH',armor:'sA',weapon:'sW'},wk=k=>over&&over.slot===k?over:worn(k);
  ['helm','armor','weapon'].forEach(k=>{const i=wk(k);e[k]=i?visOf(i):0;e[sk[k]]=i?i.st:dflt(k)});
  e.nH=!wk('helm');e.nA=!wk('armor');e.nW=!wk('weapon');
  const t=wk('trinket');e.trinket=t?Math.max(1,visOf(t)):0;
  const w2=wk('weapon'),oh=twoH(w2)?null:wk('offhand');e.offhand=oh?visOf(oh):0;e.sO=oh?oh.st:dflt('offhand');e.nO=!oh;
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
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitCap);   /* re-fit the name once the pixel font has loaded */
if(window.ResizeObserver){let w0=0;new ResizeObserver(es=>{const w=Math.round(es[0].contentRect.width);if(w!==w0){w0=w;fitCap()}}).observe($('rank'))}   /* and whenever the card changes width, so the name always shrinks to fit instead of being cut */
let SEL='weapon',SELI=null;   /* slot being browsed / item selected in the picker */
let TRYI=null;                /* item being tried on: selected in the picker but not worn. It is shown on the hero, with its stat changes as +/- numbers */
/* the four sheet numbers as they would be with `it` worn (null = what you wear now) */
function previewStats(it){
  const sv=TR;TRYIT=it;TR=bsum('hp');
  try{return {xp:mult(),gold:goldMult(),dmg:dmgMult(),hp:maxHp(levelOf(S.xp))}}
  finally{TRYIT=null;TR=sv}
}
/* rarity aura: the best item you wear (or are trying on) tints the stage. tier 0 none, 1 glow, 2 sparkles, 3 embers, 4 unique */
const AURA_TIER=r=>r<2?0:r<4?1:r<5?2:r<7?3:4;
function setAura(sg,pv){
  let r=-1;SLOTS.forEach(k=>{const i=pv&&pv.slot===k?pv:worn(k);if(i&&i.r>r)r=i.r});
  const t=r<0?0:AURA_TIER(r);
  sg.dataset.at=t;sg.style.setProperty('--aura',RAR[Math.max(0,r)]);
  const a=$('aura');if(!a||a.dataset.k===String(t))return;
  a.dataset.k=String(t);a.replaceChildren();
  const n=t>=3?16:t===2?9:0;
  for(let i=0;i<n;i++){
    const p=el('i','ap'+(t>=3?' em':''));
    p.style.left=(10+Math.random()*80)+'%';p.style.setProperty('--d',(Math.random()*4).toFixed(2)+'s');
    p.style.setProperty('--t',(2.6+Math.random()*2.4).toFixed(2)+'s');p.style.setProperty('--x',Math.round((Math.random()-.5)*36)+'px');
    a.appendChild(p);
  }
}
/* glowing links: a curve from each slot to the part of the hero it belongs to (x, y as a share of the hero canvas) */
const LANCH={helm:[.5,.2],armor:[.56,.68],legs:[.5,.82],boots:[.5,.95],trinket:[.52,.5],weapon:[.88,.52],offhand:[.14,.58],companion:[.3,.93]};
function drawLinks(){
  const sg=document.querySelector('.stage'),sv=$('links'),cv=document.querySelector('#figure canvas');
  if(!sg||!sv||!cv||!sg.offsetParent)return;
  const sr=sg.getBoundingClientRect(),cr=cv.getBoundingClientRect(),ox=sr.left+sg.clientLeft,oy=sr.top+sg.clientTop;
  if(!sg.clientWidth||!cr.width)return;
  const NS='http://www.w3.org/2000/svg',pv=TRYI,mk=(t,c,o)=>{const n=document.createElementNS(NS,t);n.setAttribute('class',c);Object.keys(o).forEach(k=>n.setAttribute(k,o[k]));return n};
  sv.setAttribute('viewBox','0 0 '+sg.clientWidth+' '+sg.clientHeight);sv.replaceChildren();
  SLOTS.forEach(k=>{
    const b=sg.querySelector('.eslot[data-k="'+k+'"]');if(!b)return;
    const br=b.getBoundingClientRect(),left=br.left+br.width/2<cr.left+cr.width/2;
    const sx=(left?br.right:br.left)-ox,sy=br.top+br.height/2-oy;
    let ax=cr.left+cr.width*LANCH[k][0]-ox,ay=cr.top+cr.height*LANCH[k][1]-oy;
    if(k==='companion'){const fp=$('fpet'),pc=fp&&!fp.hidden&&fp.querySelector('canvas');if(pc){const q=pc.getBoundingClientRect();ax=q.left+q.width/2-ox;ay=q.top+q.height*.7-oy}}
    const tr=!!pv&&pv.slot===k,it=tr?pv:worn(k),col=it?RAR[it.r]:'rgba(255,255,255,.3)',mx=sx+(ax-sx)*.5;
    const d='M'+sx+' '+sy+' C'+mx+' '+sy+' '+mx+' '+ay+' '+ax+' '+ay;
    const p1=mk('path','lk'+(it?'':' off')+(tr?' try':''),{d});p1.style.setProperty('--c',col);sv.appendChild(p1);
    if(it){const p2=mk('path','lk fl',{d});p2.style.setProperty('--c',col);sv.appendChild(p2)}
    const dot=mk('circle','ld'+(it?'':' off'),{cx:ax,cy:ay,r:it?3.5:2.5});dot.style.setProperty('--c',col);sv.appendChild(dot);
  });
}
/* docked workbench under the niches: clear any leftover absolute styles, then scroll it into view */
function placePicker(pk){
  if(!pk)return;
  pk.hidden=false;
  pk.style.left=pk.style.right=pk.style.top=pk.style.bottom=pk.style.width='';
  requestAnimationFrame(()=>{
    const pr=pk.getBoundingClientRect(),margin=12;
    if(pr.top<margin||pr.bottom>window.innerHeight-margin){
      pk.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
  });
}
function renderGear(){
  const lv=levelOf(S.xp),R=rk(lv);applyScene();
  const cur=worn(SEL),items=S.inv.filter(i=>i.slot===SEL).sort((a,c)=>c.r-a.r||a.n.localeCompare(c.n));
  if(items.length&&!items.some(i=>i.id===SELI))SELI=cur&&items.some(i=>i.id===cur.id)?cur.id:items[0].id;
  const sel=items.find(i=>i.id===SELI)||null,pv=sel&&(!cur||cur.id!==sel.id)?sel:null;   /* pv = the selected item when it is not worn yet: it is tried on */
  TRYI=pv;
  const E=eqLook(pv),sg=document.querySelector('.stage');
  const fg=$('figure'),fk=(PV?'pv'+PV.n:Object.values(E).join('.'))+'|'+(S.look?Object.values(S.look).join(','):'');
  if(fg.dataset.k!==fk){fg.dataset.k=fk;fg.replaceChildren(heroPx(lv,undefined,null,E))}
  fg.classList.toggle('tryon',!!pv);
  {const tt=$('trytag');if(tt){tt.hidden=!pv;if(pv)tt.textContent='Try on: '+pv.n}}
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
  {   /* companion beside the hero (a dev preview overrides what is worn; a companion being tried on shows too) */
    const cw=pv&&pv.slot==='companion'?pv:worn('companion'),fk2=PVP||(cw?(PETS[cw.pet]?cw.pet:'wolfpup'):null),fp=$('fpet'),cl=PVP?PVL:(cw?plv(cw):1);
    if(fk2){fp.hidden=false;fp.title=(PVP?PETS[fk2].n:cw.n)+' (Lv '+cl+')';const vl=vlv(fk2,cl);fp.classList.toggle('solid',!!PETS[fk2].sm);fp.classList.toggle('rside',!!PETS[fk2].right);fp.classList.toggle('still',!!PETS[fk2].still);fp.classList.toggle('big',vl>=BIG_LV);fp.parentNode.style.setProperty('--pz',psz(fk2,vl));setSprite('fpet',PETS[fk2].e,pres(vl),vl);fp.classList.toggle('fire',!!PETS[fk2].fire)}else fp.hidden=true;
  }
  /* gear mounts: six plaques in an arc around the hero, each with an iron hook; what you wear hangs from it */
  const slot=k=>{
    const tr=!!pv&&pv.slot===k,it=tr?pv:worn(k),b=el('button','eslot'+(SEL===k?' on':'')+(it?'':' base')+(tr?' try':'')),ic=el('span','ei'),lab=it?it.n+(it.slot==='companion'?' Lv '+plv(it):''):'Empty';
    b.type='button';b.dataset.k=k;b.title=lab;b.style.setProperty('--rar',RAR[it?it.r:0]);b.setAttribute('aria-pressed',SEL===k);
    b.setAttribute('aria-label',SLOTN[k]+': '+(it?it.n:'empty')+(tr?' (trying on)':''));ic.appendChild(px(it?iicon(it):dicon(k),16));
    b.append(el('i','hook'),el('span','ek',SLOTN[k]),ic,el('small','',lab));
    if(tr)b.appendChild(el('i','tryb','TRY'));
    else if(S.inv.some(i=>i.slot===k&&i.isNew))b.appendChild(el('i','up','!'));
    b.onclick=()=>{
      SEL=k;let ch=false;
      S.inv.forEach(i=>{if(i.slot===k&&i.isNew){delete i.isNew;ch=true}});
      if(ch){save();render()}else renderGear();
    };
    return b;
  };
  $('rack').replaceChildren(slot('helm'),slot('armor'),slot('weapon'),slot('offhand'),slot('trinket'),slot('legs'),slot('boots'),slot('companion'));
  setAura(sg,pv);
  const pk=$('picker'),hd=el('div','pkhead');
  hd.append(el('b','',SLOTN[SEL]),el('span','',(items.length?items.length+(items.length===1?' item':' items')+' · ':'')+coinText(S.gold)));
  pk.replaceChildren(hd);
  if(!items.length){   /* nothing for this slot: one compact line instead of a big empty panel */
    const e=el('div','pkempty'),ic=el('span','ei');ic.appendChild(px(dicon(SEL),16));
    e.append(ic,el('span','','Nothing yet. Chests drop random loot.'));pk.appendChild(e);
  }else{
    /* inventory grid: one small tile per item, tap one to try it on and see its details below */
    const g=el('div','ig');
    items.forEach(i=>{
      const isOn=!!cur&&cur.id===i.id,t=el('button','itile'+(i.id===SELI?' sel':'')+(isOn?' on':'')),ic=el('span','ei');
      t.type='button';t.style.setProperty('--rar',RAR[i.r]);t.setAttribute('aria-pressed',i.id===SELI);
      t.setAttribute('aria-label',i.n+(isOn?' (worn)':''));t.title=i.n;
      ic.appendChild(px(iicon(i),16));t.appendChild(ic);
      if(isOn)t.appendChild(el('i','wn','✓'));
      t.onclick=()=>{SELI=i.id;renderGear()};
      g.appendChild(t);
    });
    pk.appendChild(g);
    const on=!!cur&&cur.id===sel.id,d=el('div','idet'),act=el('div','iact2');
    d.style.setProperty('--rar',RAR[sel.r]);
    d.append(el('b','',sel.n),el('small','',RNAME[sel.r]+': '+bonusTxt(sel)));
    if(sel.slot==='companion'){const L=plv(sel);d.appendChild(el('small','',L>=PMAX?'Level '+L+' (max)':'Level '+L+': '+(ptot(sel)-pneed(L))+' / '+(pneed(L+1)-pneed(L))+' XP. Starts at Lv '+pbase(sel)+' for its rarity and grows as you finish quests. Bonuses grow with its level.'))}
    if(sel.u&&UNIQ[sel.u])d.appendChild(el('small','',UNIQ[sel.u].d));
    if(!on){
      const dl=el('div','tdelta');   /* what changes if you wear it instead of what you wear now */
      ['xp','gold','dmg','hp','bd'].forEach(k=>{const df=eff(sel,k)-(cur?eff(cur,k):0);if(df)dl.appendChild(el('span','dc '+(df>0?'up':'dn'),STAT_TXT[k](df)))});
      if(dl.children.length){d.appendChild(el('small','dim',cur?'Compared with what you wear:':'If you wear it:'));d.appendChild(dl)}
      d.appendChild(el('small','dim','Bonuses only count while worn.'));
    }
    const wb=el('button','btn',on?'Take off':'Wear');wb.type='button';wb.onclick=()=>wear(sel.id);act.appendChild(wb);
    if(!on){const sb=el('button','ghost','Sell '+coinText(sellVal(sel)));sb.type='button';sb.onclick=()=>sell(sel.id);act.appendChild(sb)}
    d.appendChild(act);pk.appendChild(d);
  }
  placePicker(pk);
  {   /* the four numbers at the bottom show how they would change with the item you are trying on */
    const sh=$('sheet');sh.querySelectorAll('.dl').forEach(n=>n.remove());
    if(pv){
      const a=previewStats(null),b=previewStats(pv),ks=['xp','gold','dmg','hp'];
      [...sh.children].forEach((st,i)=>{
        const k=ks[i],df=b[k]-a[k];if(!k||Math.abs(df)<(k==='hp'?.5:.005))return;
        const good=k==='dmg'?df<0:df>0,tx=k==='hp'?(df>0?'+':'')+Math.round(df):(df>0?'+':'')+df.toFixed(2);
        st.appendChild(el('i','dl '+(good?'up':'dn'),tx));
      });
    }
  }
  if(WFX){   /* just put something on: a flash on the hero and on its mount */
    const k=WFX;WFX=null;
    fg.classList.remove('wfx');void fg.offsetWidth;fg.classList.add('wfx');setTimeout(()=>fg.classList.remove('wfx'),850);
    const sb=sg.querySelector('.eslot[data-k="'+k+'"]');if(sb){sb.classList.add('flash');setTimeout(()=>sb.classList.remove('flash'),800)}
  }
  requestAnimationFrame(drawLinks);setTimeout(drawLinks,300);   /* the hero and companion slide a little, so measure once more when they settle */
}
addEventListener('resize',()=>requestAnimationFrame(drawLinks));
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>drawLinks());
if(window.ResizeObserver){const sg0=document.querySelector('.stage');if(sg0)new ResizeObserver(()=>requestAnimationFrame(drawLinks)).observe(sg0)}
/* ---------- chest stage: pixel chest that shakes, glows and bursts open ---------- */
let CHEST_BUSY=false;
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
  const bb=$('bossbox');bb.innerHTML='';bb.className='panel boss bx';
  const b=S.boss;
  if(b){   /* weekly boss card: living portrait scene, name banner, skull-marked HP bar, reward tiles */
    const B=bossOf(b),dead=b.hp<=0,pct=Math.max(0,Math.min(100,b.hp/b.max*100)),rage=!dead&&pct<=30,tr=b.tier||0;
    const pf=el('div','bxp'+(dead?' dead':'')+(rage?' rage':'')),ak=B[1].slice(0,4)==='pet:'&&PETART[B[1].slice(4)]?B[1].slice(4):null;
    let sp;if(ak){sp=PETART[ak]();sp.removeAttribute('style');sp.className='px art k-'+ak}else{sp=px(B[1],24);sp.classList.add('em')}
    pf.append(el('i','bxst'),el('i','bxf'),sp);
    if(!dead)for(let q=0;q<9;q++){const m=el('b','bxe');m.style.setProperty('--x',(8+q*10.5)+'%');m.style.setProperty('--d',(-(q*.47)%4).toFixed(2)+'s');m.style.setProperty('--dx',((q%2?1:-1)*(5+q%3*5))+'px');pf.appendChild(m)}
    pf.appendChild(el('i','bxl'));if(dead)pf.appendChild(el('i','bxs','DEFEATED'));
    const info=el('div','bxi'),tg=el('div','bxt'),th=el('span','bxg th',['Minor','Dangerous','Elite','Deadly','Legendary','Mythic'][tr]||'Minor');
    th.style.setProperty('--rar',RAR[Math.min(7,tr+1)]);tg.append(el('span','bxg','BOSS'),th);if(rage)tg.appendChild(el('span','bxg rage','ENRAGED'));
    const sk=el('span','bxsk');sk.title='Threat level';for(let q=0;q<=tr;q++)sk.appendChild(px('\ud83d\udc80',16));tg.appendChild(sk);
    const bar=el('div','bar hp bxbar'+(rage?' rage':'')),fill=document.createElement('i'),hr=el('div','bxh');
    fill.style.width=pct+'%';bar.append(fill,el('em','',dead?'Defeated':b.hp+' / '+b.max));hr.append(px(dead?'\u2620\ufe0f':'\u2694\ufe0f',16),bar);
    const rw=b.rw||{g:50,c:1},dn=(8-new Date().getDay())%7||7,cs=el('div','bxc');
    const tile=(lab,e,val,ti,c)=>{const s=el('span','bxk'+(c?' '+c:'')),v=el('span','v');s.title=ti;v.append(px(e,16),document.createTextNode(val));s.append(el('small','',lab),v);return s};
    cs.append(tile(dead?'CLAIMED':'REWARD','coin:'+topCoin(rw.g),'+'+coinText(rw.g),'Coin reward',dead?'got':''),tile(dead?'CLAIMED':'REWARD','\ud83d\udce6','+'+rw.c+(rw.c>1?' chests':' chest'),'Chest reward',dead?'got':''),tile('RESETS IN','\u23f3',dn+(dn===1?' day':' days'),'A new boss arrives on Monday'));
    info.append(el('div','bxn',B[0]),tg,hr,cs,el('div','bxm',dead?'Reward claimed. Rest up for the next one.':'Every quest you finish deals damage.'));
    bb.append(pf,info);
  }
  /* forge */
  const f=$('forge');f.innerHTML='';
  f.appendChild(classBox(lv));
  if(S.cls)f.appendChild(subBox(lv));
  const aff=S.inv.some(i=>i.isNew);
  $('dot-hero').hidden=!(aff||(lv>=5&&!S.cls)||(lv>=15&&S.cls&&!S.sub));
}

/* ---------- arena, character sheet, tabs ---------- */
function setSprite(id,emoji,n,lv){const e=$(id),art=emoji.slice(0,4)==='pet:',res=lv<BIG_LV?64:96,tier=petTier(lv||1),key=art?emoji+res+tier:emoji+n;if(e.dataset.k===key)return;e.dataset.k=key;e.replaceChildren(art?petSprite(emoji.slice(4),res,tier):px(emoji,n));if(emoji==='pet:wizfrog')manaOrbs(e)}
/* Wise Wizard Frog: seven glowing mana orbs fly around it (pure CSS motion; each orb gets its own speed, offset and flight path). Some pass behind the frog. Replaced with the sprite when another pet is shown. */
function manaOrbs(box){
  for(let i=0;i<7;i++){
    const o=el('i','mana'+(i%3===2?' back':'')),st=o.style;
    st.setProperty('--mt',(2.4+(i*.55)%1.9).toFixed(2)+'s');st.setProperty('--md',(-i*.83).toFixed(2)+'s');
    st.setProperty('--x0',(-18+(i%3)*5)+'%');st.setProperty('--x1',(112+(i%4)*5)+'%');st.setProperty('--y0',(-4+(i%2)*8)+'%');st.setProperty('--y1',(78+(i%3)*10)+'%');
    st.setProperty('--mz',(6+(i%3)*1.6).toFixed(1)+'%');
    if(i===6){st.setProperty('--x0','0%');st.setProperty('--x1','26%');st.setProperty('--y0','-6%');st.setProperty('--y1','20%');st.setProperty('--mt','1.9s')}   /* one circles the head of the staff */
    box.appendChild(o);
  }
}
function renderArena(){
  const lv=levelOf(S.xp),R=rk(lv);
  const ah=$('ahero'),hk=(PV?'pv'+PV.n:Object.values(eqLook()).join('.'))+(S.look?Object.values(S.look).join(','):'');if(ah.dataset.k!==hk){ah.dataset.k=hk;ah.replaceChildren(heroPx(lv))}
  $('atag').textContent='Lv '+lv+' '+(S.cls?clsName():R[0]);
  {const mh=maxHp(lv),hp=Math.max(0,Math.round(S.hp)),hb=$('ahbar');$('ahfill').style.width=(hp/mh*100)+'%';$('ahtxt').textContent=hp+' / '+mh;hb.classList.toggle('low',hp/mh<.3)}   /* your own HP in the fight */
  const pt=worn('companion'),ap=$('apet'),pk=PVP||(pt?(PETS[pt.pet]?pt.pet:'wolfpup'):null),al=PVP?PVL:(pt?plv(pt):1);
  if(pk){ap.hidden=false;ap.title=(PVP?PETS[pk].n:pt.n)+' (Lv '+al+')';const vl=vlv(pk,al);ap.classList.toggle('solid',!!PETS[pk].sm);ap.classList.toggle('rside',!!PETS[pk].right);ap.classList.toggle('still',!!PETS[pk].still);ap.classList.toggle('big',vl>=BIG_LV);ap.style.setProperty('--pz',PETS[pk].px?PETS[pk].px/.4737:psize(vl));setSprite('apet',PETS[pk].e,pres(vl),vl);ap.classList.toggle('fire',!!PETS[pk].fire)}else ap.hidden=true;
  const b=S.boss;if(!b)return;
  const B=bossOf(b);setSprite('aboss',B[1],24);$('aboss').classList.toggle('art',B[1].slice(0,4)==='pet:');
  $('abname').textContent=B[0];{const pc=(b.hp/b.max*100)+'%';$('abfill').style.width=pc;$('abghost').style.width=pc;const ar=$('arena');ar.classList.toggle('rage',b.hp>0&&b.hp/b.max<=.3);ar.classList.toggle('won',b.hp<=0)}$('abtxt').textContent=b.hp+' / '+b.max;   /* abghost = the pale trail that lags behind the real bar; rage = boss under 30%; won = defeated */
  $('aboss').classList.toggle('dead',b.hp<=0);
}
function attackFx(dmg){
  const h=$('ahero'),b=$('aboss');
  [[h,'atk'],[b,'hit'],[$('apet'),'hop']].forEach(([e,c])=>{e.classList.remove(c);void e.offsetWidth;e.classList.add(c);setTimeout(()=>e.classList.remove(c),800)});
  setTimeout(()=>{   /* the blow lands when the hero's lunge reaches the boss */
    const a=$('arena');
    a.classList.remove('shk','hit');void a.offsetWidth;a.classList.add('shk','hit');setTimeout(()=>a.classList.remove('shk','hit'),450);
    const sl=el('div','slash'),sl2=el('div','slash s2');a.append(sl,sl2);setTimeout(()=>{sl.remove();sl2.remove()},600);
    const d=el('div','dmg','-'+dmg);a.appendChild(d);setTimeout(()=>d.remove(),1000);
  },250);
}
function renderSheet(){
  const s=$('sheet');s.innerHTML='';
  [['XP','x'+mult().toFixed(2),'\u2728'],['Coins','x'+goldMult().toFixed(2),'coin:g'],['Damage','x'+dmgMult().toFixed(2),'\ud83d\udee1\ufe0f'],['Max HP',maxHp(levelOf(S.xp)),'\u2764\ufe0f']].forEach(([k,v,ic])=>{
    const d=el('div','stat'),i=el('span','sti');i.appendChild(px(ic,16));
    d.append(i,el('small','',k),el('b','',v));s.appendChild(d);
  });
  const gb=$('gearbonus');
  if(gb){
    gb.replaceChildren();
    const ks=['xp','gold','dmg','hp','bd'].filter(k=>bsum(k));
    gb.classList.toggle('none',!ks.length);
    if(!ks.length)gb.appendChild(el('span','gbn','No gear bonuses yet. Wear some loot to gain them.'));
    else{
      gb.appendChild(el('span','gbt','Gear bonuses'));
      const w=el('div','gbc');
      ks.forEach(k=>w.appendChild(el('span','gbp g-'+k,STAT_TXT[k](bsum(k)))));
      gb.appendChild(w);
    }
  }
}
function tab(n){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.id==='tab-'+n));
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('on',b.dataset.tab===n));
  document.body.dataset.tab=n;   /* the tavern backdrop only shows on the Quests tab */
  const hud=document.querySelector('.hud');if(hud)hud.hidden=n==='hero';   /* Hero tab: just the full avatar and its gear */
  const th=$('tab-hero');if(th)th.style.paddingTop=n==='hero'?'env(safe-area-inset-top,0px)':'';
  sfFit();fitCap();requestAnimationFrame(drawLinks);scrollTo(0,0);try{localStorage.setItem('dq.tab',n)}catch(e){}
}
function initNav(){
  const ic={quests:'📜',hero:'🍺',shop:'⚖️',realm:'🚪'};
  document.querySelectorAll('.navbtn').forEach(b=>{b.querySelector('.ni').appendChild(px(ic[b.dataset.tab],16));b.onclick=()=>tab(b.dataset.tab)});
  let t='quests';try{t=localStorage.getItem('dq.tab')||t}catch(e){}
  tab(ic[t]?t:'quests');
}

/* ---------- render ---------- */
function hstat(){   /* every number the honours count, in one place */
  const lv=levelOf(S.xp),inv=S.inv||[],tk={};
  S.tasks.forEach(t=>tk[t.id]=t);
  let done=0,hard=0;
  Object.keys(S.done||{}).forEach(d=>(S.done[d]||[]).forEach(id=>{done++;if(tk[id]&&tk[id].xp>=40)hard++}));
  let qs=0;try{S.tasks.forEach(t=>{qs=Math.max(qs,qStreak(t))})}catch(e){}
  const pets=inv.filter(i=>i.slot==='companion');
  return {done,hard,perf:Object.keys(S.perfect||{}).length,str:streak(),lv,tasks:S.tasks.length,qs,
    frz:S.freezes|0,cls:S.cls?1:0,sub:S.sub?1:0,wn:Object.keys(S.worn||{}).filter(k=>wornOf(S,k)).length,
    pets:pets.length,plv:pets.reduce((m,i)=>Math.max(m,plv(i)),0),prar:pets.reduce((m,i)=>Math.max(m,(i.r|0)+1),0),inv:inv.length,gold:S.gold|0,gems:S.gems|0,
    kills:S.kills|0,chs:S.copened|0,rar:inv.reduce((m,i)=>Math.max(m,(i.r|0)+1),0),uniq:inv.filter(i=>i.u).length,fell:S.defeats|0};
}
function earned(){
  const st=hstat(),E={};
  BADGES.forEach(b=>E[b.id]=st[b.m]>=b.v);
  return E;
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
function tweenCoins(b,to){   /* same count-up as tween(), but written as coins */
  const paint=v=>b.replaceChildren(coinEl(v,2));
  if(b._v==null||NOMOVE){b._v=to;b._to=to;paint(to);return}
  if(b._to===to)return;
  const from=b._v;b._to=to;cancelAnimationFrame(b._raf);
  const t0=performance.now();
  const step=n=>{const k=Math.min(1,(n-t0)/550),v=from+(to-from)*(1-Math.pow(1-k,3));b._v=v;paint(Math.round(v));if(k<1)b._raf=requestAnimationFrame(step);else{b._v=to;paint(to)}};
  b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump');
  b._raf=requestAnimationFrame(step);
}
function flashBar(b){b.classList.remove('flash');void b.offsetWidth;b.classList.add('flash');setTimeout(()=>b.classList.remove('flash'),750)}
function flipCoin(){const g=$('gc');g.classList.remove('flip');void g.offsetWidth;g.classList.add('flip');setTimeout(()=>g.classList.remove('flip'),650)}
/* pixel-art icons for the subclass slot under the rank: a closed padlock (locked), an open padlock (ready to choose) and a gem (chosen) */
const SUBPIX={
  guardian:{p:{d:'#6a7488',s:'#c3ccda',g:'#e8b93c'},r:['.ddddddd.','dsssgsssd','dsssgsssd','dgggggggd','dsssgsssd','.dssgssd.','.dssgssd.','..dsgsd..','...ddd...']},
  berserker:{p:{r:'#c9302c',o:'#ff7a1a',y:'#ffc02a'},r:['....r....','...rr....','...rro.r.','..rroorr.','.rroooorr','.rooyyoor','.rooyyoor','..roooor.','...rrrr..']},
  scholar:{p:{b:'#3a6ac0',p:'#f4ecd6',d:'#8a7a58',g:'#e8b93c'},r:['.bbbbbbb.','bpppbpppb','bpddbddpb','bpppbpppb','bpddbddpb','bpppbpppb','bpddbddpb','bbbbbbbbb','..ggggg..']},
  battlemage:{p:{y:'#ffd75a',w:'#ffffff',c:'#4aa8d8'},r:['....wyyy.','...wyyy..','..wyyy...','.yyyyyyy.','...yyyy..','..yyyy...','..yyy....','.yy......','.y.......']},
  treasure:{p:{l:'#bff4ff',c:'#4aa8d8',d:'#2a6aa0'},r:['...lll...','..lcccd..','.lcccccd.','lcccccccd','.lcccccd.','..lcccd..','...lcd...','....d....']},
  shadowblade:{p:{p:'#a56be0',d:'#5a3a8a',l:'#d9b8ff',y:'#ffd75a'},r:['...llpp..','..lpp....','.lpp..y..','.lp......','.lp......','.lpp.....','..lppp...','...lppppd','....dddd.']},
  healer:{p:{g:'#58b368',l:'#a8f0b8',d:'#2f7d3e',w:'#ffffff'},r:['.ggg.ggg.','glgggwggd','gggwwwggd','gggggwggd','.gggwgggd','..gggggd.','...gggd..','....d....']},
  beastmaster:{p:{b:'#c2682f',l:'#e8a060'},r:['..bb.bb..','..bb.bb..','bb.....bb','bb.....bb','...bbb...','..lbbbb..','.lbbbbbb.','.bbbbbbb.','..bbbbb..']},
  chronicler:{p:{p:'#f2d3a0',d:'#a97f4a',k:'#6a4a2a',r:'#a8283a'},r:['.ddddddd.','dpppppppd','.pkkkkkp.','.ppppppp.','.pkkkkkp.','.ppppppp.','.pkkkprp.','dpppppppd','.ddddddd.']},
  sharpshooter:{p:{r:'#c9302c',w:'#f4efd0',y:'#ffc02a'},r:['..rrrrr..','.rwwwwwr.','rwwrrrwwr','rwrrwrrwr','rwrwywrwr','rwrrwrrwr','rwwrrrwwr','.rwwwwwr.','..rrrrr..']},
  pathfinder:{p:{d:'#8a5a12',w:'#f4ecd6',r:'#d63a47',g:'#e8b93c',b:'#3a6ac0'},r:['..ddddd..','.dwwwwwd.','dwwwrwwwd','dwwrrrwwd','dwwwgwwwd','dwwbbbwwd','dwwwbwwwd','.dwwwwwd.','..ddddd..']},
  herald:{p:{g:'#e8b93c',l:'#fff1a8',d:'#a8761c'},r:['......ggd','.....glgd','..gggllgd','gllgglggd','ggdd.glgd','.gd...ggd','......ggd','.......dd']}
};
/* pixel-art icons for the subclass slot under the rank: a closed padlock (locked), an open padlock (ready to choose) and one custom icon per subclass (chosen) */
function subIcon(st,id){
  const sp=st==='on'&&SUBPIX[id],open=st==='ready';
  const P=sp?sp.p:open?{s:'#ffc04a',b:'#e0801a',h:'#ff9f3a',k:'#3a1d05'}:{s:'#a29cab',b:'#615b69',h:'#7d7786',k:'#15100f'};
  const rows=sp?sp.r:[ '..sss..','.s...s.',open?'.s.....':'.s...s.','bbbbbbb','bhhhhhb','bhhkhhb','bhhkhhb','bhhhhhb','bbbbbbb'];
  const W=Math.max(...rows.map(r=>r.length)),H=rows.length,O=Array.from({length:H+2},()=>Array(W+2).fill(null));
  rows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c!=='.')O[y+1][x+1]=P[c]}));
  const Q=O.map(r=>r.slice());
  for(let y=0;y<H+2;y++)for(let x=0;x<W+2;x++)if(!O[y][x]&&((O[y-1]||[])[x]||O[y][x-1]||O[y][x+1]||(O[y+1]||[])[x]))Q[y][x]='#0a0812';
  const cv=gridCanvas(Q,W+2,H+2);cv.style.width=(W+2)*2+'px';cv.style.height=(H+2)*2+'px';cv.style.flex='none';
  return cv;
}
function initHud(){   /* a heart in front of HP, a star in front of XP */
  const ls=document.querySelectorAll('.hud .stats .row label');
  [['\u2764\ufe0f'],['\u2b50']].forEach((a,i)=>{const l=ls[i];if(l&&!l.querySelector('.px'))l.prepend(px(a[0],16))});
}
function render(){
  if(DRAG)return;   /* never rebuild the board under a scroll that is being dragged */
  if(!S.cqv&&canRun()){const E0=earned();S.log=[];S.badges={};S.bDay={};S.bSkip=Object.keys(E0).filter(k=>E0[k]);S.cqv=1;save()}   /* one-time: empty chronicle and honours (honours already true now stay empty until they are earned again) */
  const lv=levelOf(S.xp),lo=need(lv),hi=need(lv+1),mh=maxHp(lv),R=rk(lv);
  if(S.hp>mh)S.hp=mh;
  $('lvl').textContent=lv;$('av').replaceChildren(heroPx(lv,1));{const fr=document.querySelector('.hud .av');if(fr)fr.dataset.tier=lv>=40?4:lv>=25?3:lv>=15?2:lv>=5?1:0}   /* frame tier */{   /* top bar: your name big, rank small underneath (just the rank if there is no name) */
    const rn=$('rank'),nm=heroName(),rl='Rank '+Math.min(lv,5)+': '+(S.cls?clsName():R[0]),sst=PVS?PVS.st:S.sub?'on':(lv>=15&&S.cls?'ready':'off'),sbk=PVS&&PVS.n?PVS.n:S.sub&&!PVS?SUBD[S.sub].n:sst==='ready'?'Choose subclass':'Subclass',ck=nm+'|'+rl+'|'+sbk+'|'+sst;   /* subclass line: greyed out until level 15, then a prompt, then the chosen subclass */   /* rank number 1-5 (you stay at Rank 5 after level 5) */
    if(rn.dataset.k!==ck){
      rn.dataset.k=ck;
      /* banner name plate: name on a ribbon, rank / class underneath as a title */
      const a=el('span','rk-name',nm||rl);a.dataset.max=21;
      const rib=el('div','rk-rib');rib.appendChild(a);
      const bn=el('div','rk-banner');bn.append(rib);
      const kids=[bn];if(nm){const b=el('span','rk-sub',rl);b.dataset.max=12;kids.push(b)}
      const sb=el('div','rk-subc '+sst);if(sst==='on')sb.dataset.sub=PVS&&PVS.id?PVS.id:S.sub;sb.title=sst==='off'?'Subclass unlocks at level 15':'Subclass';sb.append(subIcon(sst,PVS&&PVS.id?PVS.id:S.sub),el('b','',sbk));if(sst==='on')for(let q=1;q<=4;q++)sb.appendChild(el('span','sp s'+q));   /* four empty layers the subclass styles turn into embers, sparkles, confetti and so on */if(sst==='off')sb.appendChild(el('i','','Lv 15'));kids.push(sb);rn.replaceChildren(...kids);
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
  tween($('sn'),sk,0,'');$('streak').title='Perfect-day streak'+((S.freezes|0)?' ('+(S.freezes|0)+' Streak Freeze'+(S.freezes>1?'s':'')+' ready)':'');$('streak').classList.toggle('off',sk===0);
  {const st=$('streak');st.classList.remove('s1','s2','s3','s4');st.classList.add(sk>=14?'s4':sk>=7?'s3':sk>=3?'s2':'s1')}
  tween($('mv'),mult(),2,'x');tweenCoins($('gd'),S.gold);{const g=$('gc'),tc=topCoin(S.gold);if(g._k!==tc){g._k=tc;g.replaceChildren(px('coin:'+tc,10))}$('gd').parentNode.title='Coins: '+coinText(S.gold)}
  if(lastGold!=null&&S.gold>lastGold)flipCoin();lastGold=S.gold;

  const d=doneToday(),list=$('list');list.innerHTML='';
  const act=S.tasks.filter(t=>active(t)),vis=S.tasks.filter(t=>!expired(t)),shown=vis.filter(t=>QT==='any'||tabOf(t)===QT);
  document.querySelectorAll('.qtab').forEach(b=>{const on=b.dataset.g===QT;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
  if(!shown.length){
    const e=document.createElement('div');e.className='empty';
    e.textContent=!vis.length?'The board is bare. Pin a daily quest below. Finish it for XP, neglect it and you take damage.':QT==='cu'?'No custom days yet. Pin a quest and tap the days you want it on.':QT==='once'?'No one-off quests for today. Pin one with Once selected.':'No every-day quests yet. Pin one with Daily selected.';
    list.appendChild(e);
  }
  renderQuests(shown,d,list);
  const done=act.filter(t=>d.includes(t.id)).length;
  $('count').textContent=done+' / '+act.length+' done';$('dfill').style.width=(act.length?done/act.length*100:0)+'%';
  $('winbox').innerHTML=(act.length&&done===act.length)?'<div class="win">The realm is safe. Rest well, hero.</div>':'';
  timer();
  if(!addTouched)setAdd(!vis.length);   /* open by default only while the board is empty */

  renderRPG();
  renderInv();
  renderShop();
  updatePv();
  const lg=$('log');lg.innerHTML='';
  if(!S.log.length)lg.innerHTML='<div><small>Nothing yet.</small>Your wins and losses will show up here.</div>';
  S.log.forEach(l=>{const r=document.createElement('div');const s=document.createElement('small');s.textContent=l.d.slice(5);const m=document.createElement('span');m.className=l.c||'';m.textContent=l.m;r.append(s,m);lg.appendChild(r)});

  renderHonours();
  maybeCreator();
}

/* ---------- honours: one row per "track" (e.g. Quests finished) showing its tier pips and the next goal. Category tabs keep each page short; tap a row to see all its tiers. ---------- */
let HC='q',HX=null;   /* selected category / expanded track */
let HOPEN=true;try{HOPEN=localStorage.getItem('hnOpen')!=='0'}catch(e){}   /* whole Honours section open / closed (remembered) */
function setHonoursOpen(o){HOPEN=o;try{localStorage.setItem('hnOpen',o?'1':'0')}catch(e){}$('tab-hero').classList.toggle('hn-closed',!o);$('hhead').setAttribute('aria-expanded',o)}
$('hhead').onclick=()=>setHonoursOpen(!HOPEN);
$('hhead').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setHonoursOpen(!HOPEN)}};
setHonoursOpen(HOPEN);
const TRACKN={done:'Quests finished',perf:'Perfect days',tasks:'Quests on your board',hard:'Hard quests',str:'Streak',qs:'Single-quest streak',frz:'Streak Freezes',lv:'Level',cls:'Class',sub:'Subclass',wn:'Gear worn',pets:'Companions',plv:'Companion level',prar:'Best companion',inv:'Items owned',gold:'Gold held',gems:'Gems held',kills:'Bosses defeated',chs:'Chests opened',rar:'Best loot',uniq:'Unique items',fell:'Knockouts'};
function renderHonours(){
  const st=hstat(),E={};BADGES.forEach(b=>E[b.id]=st[b.m]>=b.v);
  const fresh=[];
  BADGES.forEach(b=>{
    if(S.bSkip&&S.bSkip.includes(b.id)&&!E[b.id]){S.bSkip=S.bSkip.filter(x=>x!==b.id);save()}
    if(E[b.id]&&!S.badges[b.id]&&!(S.bSkip&&S.bSkip.includes(b.id))){S.badges[b.id]=1;(S.bDay=S.bDay||{})[b.id]=today();fresh.push(b.n)}
  });
  if(fresh.length){save();setTimeout(()=>toast(fresh.length===1?'Honour unlocked: '+fresh[0]:fresh.length+' honours unlocked: '+fresh.slice(0,3).join(', ')+(fresh.length>3?'...':'')),900)}
  const got=b=>!!S.badges[b.id];
  const have=BADGES.filter(got).length,tot=BADGES.length;
  const sh=(m,v)=>m==='gold'?Math.floor(v/100):v;
  /* summary: a single slim row */
  const sm=$('hsum');sm.replaceChildren();
  const ic=el('span','hn-big');ic.appendChild(px('🏅',20));
  const bar=el('div','hn-bar'),fi=document.createElement('i');fi.style.width=(have/tot*100)+'%';bar.appendChild(fi);
  const tiers=el('div','hn-tiers');
  HTIER.forEach((n,i)=>{const L=BADGES.filter(b=>b.t===i),r=el('span','hn-tr t'+i);r.title=n+' honours';r.append(el('i'),el('b','',L.filter(got).length+'/'+L.length));tiers.appendChild(r)});
  sm.append(ic,el('b','hn-n',have+'/'+tot),bar,tiers);
  /* tabs */
  const tb=$('htabs');tb.replaceChildren();
  HCATS.forEach(([k,n,i2])=>{
    const L=BADGES.filter(b=>b.c===k),b=el('button','htab'+(HC===k?' on':''));
    b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',HC===k);
    const i=el('span','hi');i.appendChild(px(i2,14));b.append(i,el('span','hl',n),el('em','',L.filter(got).length+'/'+L.length));
    b.onclick=()=>{HC=k;HX=null;renderHonours()};tb.appendChild(b)});
  /* tracks of this category */
  const bx=$('badges');bx.replaceChildren();
  const keys=[];BADGES.filter(b=>b.c===HC).forEach(b=>{if(!keys.includes(b.m))keys.push(b.m)});
  keys.forEach(m=>{
    const L=BADGES.filter(b=>b.m===m).sort((x,y)=>x.v-y.v),nx=L.find(b=>!got(b)),done=L.filter(got),top=done[done.length-1]||L[0];
    const cur=st[m],open=HX===m,t=nx?nx.t:top.t;
    const r=el('div','tk t'+t+(nx?'':' full')+(open?' open':'')),hd=el('button','tk-h');
    hd.type='button';hd.setAttribute('aria-expanded',open);
    const me=el('span','tk-m'+(done.length?' got':' lock'));me.appendChild(px(top.e,20));
    if(!done.length){const pl=document.createElement('i');pl.className='bl';pl.appendChild(px('🔒',16));me.appendChild(pl)}
    const tx=el('span','tk-t'),h=el('b','',TRACKN[m]||m);
    tx.append(h,el('small','',nx?'Next: '+nx.n+' ('+nx.d+')':'All done: '+top.n));
    const pips=el('span','tk-p');L.forEach(b=>{const p=el('i','t'+b.t+(got(b)?' on':''));p.title=b.n;pips.appendChild(p)});
    hd.append(me,tx,pips);
    const pb=el('div','bp'),pf=document.createElement('i');pf.style.width=(nx?Math.min(1,cur/nx.v)*100:100)+'%';pb.appendChild(pf);
    if(nx&&nx.v>1){pb.appendChild(el('em','',sh(m,Math.min(cur,nx.v))+' / '+sh(m,nx.v)))}
    else if(!nx)pb.appendChild(el('em','','Complete'));
    r.append(hd,pb);
    if(open){
      const ls=el('div','tk-l');
      L.forEach(b=>{
        const g=got(b),row=el('div','tk-r t'+b.t+(g?' got':' lock')),i=el('span','tk-ri');i.appendChild(px(b.e,16));
        const d=S.bDay&&S.bDay[b.id],t2=el('span','tk-rt');t2.append(el('b','',b.n),el('small','',b.d));
        row.append(i,t2,el('em','',g?(d?d.slice(5):'Earned'):HTIER[b.t]));ls.appendChild(row)});
      r.appendChild(ls);
    }
    hd.onclick=()=>{HX=open?null:m;renderHonours()};
    bx.appendChild(r);
  });
}

/* ---------- quest board: pending first, 7-day history, per-quest streaks, inline edit, undo delete ---------- */
let EDIT=null,JUST=null,DRAG=null;   /* DRAG = the scroll being dragged right now */
const QDIFF=[[10,'Easy'],[20,'Medium'],[40,'Hard']],QSCHED=[['all','Daily'],['wk','Mon-Fri'],['we','Sat-Sun']];
function qStreak(t){   /* consecutive active days done, counting back from today (a day with nothing scheduled is skipped) */
  const dn=k=>(S.done[k]||[]).includes(t.id);let k=today(),n=0,g=0;
  if(!dn(k))k=addDays(k,-1);
  while(g++<365&&k>=t.created){if(active(t,k)){if(dn(k))n++;else break}k=addDays(k,-1)}
  return n;
}
/* ---- weekly mastery: every FULL Mon-Sun week in which you finish a quest on ALL of its scheduled days adds +3% XP and gold to that quest
   (max 10 weeks = +30%). A week with a missed scheduled day sets it back ONE week (never below 0). The quest must have existed for the whole week.
   The bonus multiplies the level-scaled reward, so it is worth more the higher your level. ---- */
const MASTERY={step:.03,max:10};
function masteryWeeks(t){
  const M=weekKey();let n=0;
  for(let i=60;i>=1;i--){   /* oldest week first */
    const w=addDays(M,-7*i);
    if(t.created>w)continue;
    let ok=true,any=false;
    for(let j=0;j<7;j++){const d=addDays(w,j);if(active(t,d)){any=true;if(!(S.done[d]||[]).includes(t.id)){ok=false;break}}}
    if(!any)continue;
    n=ok?Math.min(MASTERY.max,n+1):Math.max(0,n-1);
  }
  return n;
}
const masteryMult=t=>1+MASTERY.step*Math.min(MASTERY.max,t?masteryWeeks(t):0);
function qDots(t){   /* streak meter: one dot per day of the current streak, green from the left; the next dot blinks while today is still open (7 dots, a longer streak just keeps them all green) */
  const w=el('span','qd'),n=qStreak(t),T=today(),open=active(t,T)&&!(S.done[T]||[]).includes(t.id);
  for(let i=0;i<7;i++)w.appendChild(el('i','dt'+(i<n?' on':i===n&&open?' now':'')));
  w.title=n?n+(n===1?' day':' days')+' in a row':'No streak yet';
  return w;
}
function renderSum(d){
  const b=$('bsum'),p=S.tasks.filter(t=>active(t)&&!d.includes(t.id));
  if(!S.tasks.some(t=>active(t))){b.replaceChildren();return}
  /* everything still obtainable today: each open quest, the Shadowblade first-quest boost (if nothing is done yet; the best quest gets it) and the perfect-day bonus once the last one is done */
  const fi=(!d.length&&hasSub('shadowblade'))?p.reduce((m,t,i)=>t.xp>p[m].xp?i:m,0):-1;
  const lv=levelOf(S.xp),pb=S.bonus[today()]?0:Math.round(BONUS*lscale(lv)*(hasSub('herald')?1+.5*cm():1));
  const xp=p.reduce((a,t,i)=>a+xpGain(t.xp,i===fi,t),0)+pb,g=p.reduce((a,t,i)=>a+goldGain(t,i===fi),0);
  const chip=(l,v)=>{const s=el('span','bs');s.append(el('small','',l),el('b','',v));return s};
  b.replaceChildren(chip('Left',p.length),chip('XP to earn','+'+xp),chip('Coin to earn','+'+coinText(g)));
}
function delQuest(t){
  const i=S.tasks.findIndex(z=>z.id===t.id);if(i<0)return;
  S.tasks.splice(i,1);EDIT=null;save();render();
  const T=$('toast');T.textContent='Quest removed. Tap to undo.';T.classList.add('on','act');
  const off=()=>{T.classList.remove('on','act');T.onclick=null};
  T.onclick=()=>{S.tasks.splice(Math.min(i,S.tasks.length),0,t);clearTimeout(tt);off();save();render()};
  clearTimeout(tt);tt=setTimeout(off,5000);
}
function confirmDelete(t){   /* the x on a scroll asks first: a deliberate second tap on a red button is needed */
  const ov=el('div','modal on'),card=el('div','card down'),box=el('div','stack');
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  const esc=e=>{if(e.key==='Escape')close()};
  const close=()=>{ov.remove();document.removeEventListener('keydown',esc)};
  const keep=el('button','btn','Keep it'),del=el('button','btn danger','Delete');
  keep.type=del.type='button';keep.onclick=close;
  del.disabled=true;setTimeout(()=>{del.disabled=false},500);   /* a quick double tap cannot go straight through */
  del.onclick=()=>{close();delQuest(t)};
  box.append(keep,del);
  card.append(el('h2','','Delete quest?'),el('p','','\u201c'+t.name+'\u201d will be removed from your board.'),box);
  ov.onclick=e=>{if(e.target===ov)close()};
  ov.appendChild(card);document.body.appendChild(ov);document.addEventListener('keydown',esc);keep.focus();
}
const QRANK=[['Rank E'],['Rank C'],['Rank A']];
function dayRow(get,set,after){   /* seven weekday toggles (Mon..Sun); at least one day always stays on */
  const w=el('div','dayrow');w.setAttribute('role','group');w.setAttribute('aria-label','Days of the week');
  DORDER.forEach(d=>{
    const b=el('button','dbt',DNAMES[d].slice(0,2));b.type='button';b.dataset.d=d;b.title=DNAMES[d];b.setAttribute('aria-label',DNAMES[d]);
    b.onclick=()=>{const c=get().slice(),i=c.indexOf(d);if(i>=0){if(c.length<2)return;c.splice(i,1)}else c.push(d);set(c);if(after)after()};
    w.appendChild(b);
  });
  w.paint=()=>{const c=get();w.querySelectorAll('.dbt').forEach(b=>{const on=c.includes(+b.dataset.d);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})};
  return w;
}
function qEditor(t){
  const li=el('li','qc edit'),cd=el('div','qcard'),bd=el('div','qedit'),inp=document.createElement('input');
  let xp=t.xp,ds=dayList(t).slice();
  inp.type='text';inp.maxLength=80;inp.value=t.name;inp.setAttribute('aria-label','Quest name');
  const seg=(items,get,set)=>{
    const g=el('div','diffs');
    items.forEach(it=>{
      const b=el('button','sbtn'+(get()===it[0]?' on':''),it[1]);b.type='button';b.setAttribute('aria-pressed',get()===it[0]);
      b.onclick=()=>{set(it[0]);g.querySelectorAll('.sbtn').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)})};
      g.appendChild(b);
    });
    return g;
  };
  const pg=el('div','diffs');   /* presets + your own days */
  QSCHED.forEach(it=>{const b=el('button','sbtn',it[1]);b.type='button';b.dataset.g=it[0];b.onclick=()=>{ds=DAYSETS[it[0]].slice();paintD()};pg.appendChild(b)});
  const dr=dayRow(()=>ds,v=>{ds=v},()=>paintD());
  const paintD=()=>{const k=dayKey(ds);pg.querySelectorAll('.sbtn').forEach(x=>{const on=x.dataset.g===k;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});dr.paint()};
  paintD();
  const ok=el('button','btn','Save quest'),no=el('button','ghost','Cancel');ok.type=no.type='button';
  const saveIt=()=>{
    const nm=inp.value.trim();if(!nm){inp.focus();return}
    t.name=nm;t.xp=xp;if(!t.once)t.days=saveDays(ds);
    if(QT!=='any')QT=tabOf(t);
    EDIT=null;save();render();toast('Quest updated');
  };
  const cancel=()=>{EDIT=null;render()};
  ok.onclick=saveIt;no.onclick=cancel;
  inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveIt()}else if(e.key==='Escape')cancel()};
  const ea=el('div','eacts');ea.append(ok,no);
  const band=el('div','qband');band.appendChild(el('span','qrk','Edit quest'));
  if(t.once)bd.append(inp,seg(QDIFF,()=>xp,v=>{xp=v}),el('div','sub onehint','One-off quest: only for today.'),ea);
  else bd.append(inp,seg(QDIFF,()=>xp,v=>{xp=v}),pg,dr,ea);
  cd.append(band,bd);li.appendChild(cd);
  setTimeout(()=>{inp.focus();inp.select()},0);
  return li;
}
/* ---------- tap a scroll: full details of that quest ---------- */
function qStats(t){   /* history numbers for one quest, from the day it was posted until today (today only counts once it is done) */
  const T=today(),dn=k=>(S.done[k]||[]).includes(t.id),lim=addDays(T,-799);
  let k=t.created<lim?lim:t.created,done=0,due=0,run=0,best=0;
  while(k<=T){
    if(active(t,k)){
      if(dn(k)){done++;due++;run++;if(run>best)best=run}
      else if(k<T){due++;run=0}
    }
    k=addDays(k,1);
  }
  return {done,best,cur:qStreak(t),rate:due?Math.round(done/due*100):0};
}
function qDetails(t){
  const T=today(),d=doneToday(),on=d.includes(t.id),rest=!active(t),first=!d.length,k=T+':'+t.id,lv=t.xp>=40?3:t.xp>=20?2:1;
  const st=qStats(t),dn=z=>(S.done[z]||[]).includes(t.id);
  const xv=on&&S.award[k]!=null?S.award[k]:xpGain(t.xp,first,t),gv=on&&S.gAward[k]!=null?S.gAward[k]:goldGain(t,first);
  const ov=el('div','modal qdm on'),card=el('div','card qdet d'+lv),paper=el('div','qdsc qcard');   /* the paper reuses the quest-card scroll art */
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label',t.name);
  const esc=e=>{if(e.key==='Escape')close()};
  let closing=false;
  const close=()=>{
    if(closing)return;closing=true;document.removeEventListener('keydown',esc);
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){ov.remove();return}
    card.classList.add('closing');                                   /* roll the scroll back up, then remove it */
    const fin=()=>ov.remove();
    card.addEventListener('animationend',fin,{once:true});
    setTimeout(fin,600);                                            /* safety net if animationend never fires */
  };
  /* rank header: diamonds in the difficulty colour, double rule underneath (same as the cards) */
  const band=el('div','qdb');band.append(el('div','qdk',QRANK[lv-1][0]),el('div','qdd','\u2605'.repeat(lv)+' '+QDIFF[lv-1][1]));   /* big rank, stars + difficulty under it */
  /* name, schedule, and today's status as a rubber stamp */
  const sched=t.once?'Today only':({all:'Every day',wk:'Mon-Fri',we:'Sat-Sun'})[dayKey(dayList(t))]||DORDER.filter(z=>dayList(t).includes(z)).map(z=>DNAMES[z].slice(0,2)).join(' ');
  let nxt='';if(rest){let n=1;while(n<=7&&!active(t,addDays(T,n)))n++;if(n<=7)nxt=n===1?' \u00b7 back tomorrow':' \u00b7 back '+DNAMES[dow(addDays(T,n))]}
  const sub=el('div','qds',sched+nxt);
  const stw=el('div','qdsw'),stamp=el('span','qst '+(rest?'st-rest':on?'st-done':'st-open'),rest?'Not active':on?'Done today':'Active');stw.appendChild(stamp);
  /* this week, Sunday to Saturday, left to right (days still to come are dashed) */
  const wk=el('div','qdw'),sun=addDays(T,-dow(T));
  for(let i=0;i<7;i++){
    const z=addDays(sun,i);let c='na',m='';
    if(z>=t.created){if(!active(t,z)){c='off';m='\u2013'}else if(dn(z)){c='on';m='\u2713'}else if(z>T){c='fut'}else if(z===T){c='now';m='?'}else{c='miss';m='\u00d7'}}
    const cell=el('div',c+(z===T?' tdy':''));cell.title=z;cell.append(el('small','',DNAMES[dow(z)].slice(0,2)),el('b','',m));wk.appendChild(cell);
  }
  /* numbers in one plaque */
  const tile=(l,v)=>{const q=el('div');q.append(el('b','',String(v)),el('small','',l));return q};
  const grid=el('div','qdg');grid.append(tile('Streak',st.cur),tile('Best',st.best),tile('Done',st.done),tile('Rate',st.rate+'%'));
  /* rewards and risk: a 2x2 plaque of icon chips */
  const chip=(ic,txt,c,ti)=>{const s=el('span','qdc '+c);s.title=ti;s.append(px(ic,16),document.createTextNode(txt));return s};
  const rw=el('div','qdp');
  rw.append(chip('\u2b50','+'+xv,'c-xp',on?'XP earned today':'XP reward'),chip('coin:'+topCoin(gv),'+'+coinText(gv,2),'c-g','Coins: '+coinText(gv)),chip('\u2764\ufe0f','-'+penalty(t.xp),'c-hp','HP lost if you miss it'),chip('\u2694\ufe0f',String(bossDmg(t.xp)),'c-bd','Damage to the weekly boss'));
  paper.append(band,el('h2','qdn',t.name),sub,stw,wk,grid,rw);
  if(!t.once){
    const mw=masteryWeeks(t);
    if(mw){const q=el('div','qdq'+(mw>=MASTERY.max?' max':''),'\u2605 Wk '+mw+' \u00b7 +'+Math.round(Math.min(mw,MASTERY.max)*MASTERY.step*100)+'%');q.title='Weekly mastery: finish this quest on every scheduled day of a Mon-Sun week to grow it.';paper.appendChild(q)}
  }
  const yr=new Date(t.created+'T12:00:00').getFullYear()!==new Date().getFullYear();
  paper.appendChild(el('div','qdy','Posted '+new Date(t.created+'T12:00:00').toLocaleDateString(undefined,yr?{day:'numeric',month:'short',year:'numeric'}:{day:'numeric',month:'short'})));
  const acts=el('div','qda'),ed=el('button','qdbn','Edit');
  ed.type='button';ed.onclick=()=>{close();EDIT=t.id;render()};
  acts.appendChild(ed);paper.appendChild(acts);
  card.appendChild(paper);
  ov.onclick=e=>{if(e.target===ov)close()};
  ov.appendChild(card);document.body.appendChild(ov);document.addEventListener('keydown',esc);   /* close: tap outside the scroll, or Esc */
}
function renderQuests(shown,d,list){
  renderSum(d);
  const rw=(c,e,txt,ti)=>{const s=el('span','rw '+c);s.title=ti||'';s.append(px(e,16),document.createTextNode(txt));return s};
  shown.forEach(t=>{   /* order = S.tasks order, which you set by dragging */
    if(EDIT===t.id){list.appendChild(qEditor(t));return}
    const T=today(),on=d.includes(t.id),rest=!active(t),first=!d.length,k=T+':'+t.id,lv=t.xp>=40?3:t.xp>=20?2:1,R=QRANK[lv-1];
    const li=el('li','qc d'+lv+(on?' done':'')+(rest?' rest':'')+(on&&JUST===t.id?' just':'')),cd=el('div','qcard');li.dataset.id=t.id;
    /* rank band: difficulty as a guild rank, with edit / delete tucked into the corner */
    const band=el('div','qband'),ed=el('button','qbtn','\u270e'),x=el('button','qbtn','\u00d7');
    band.appendChild(el('span','qrk',rest?dayLabel(t):R[0]));
    ed.type=x.type='button';ed.setAttribute('aria-label','Edit '+t.name);x.setAttribute('aria-label','Delete '+t.name);
    ed.onclick=()=>{EDIT=t.id;render()};x.onclick=()=>confirmDelete(t);band.append(x);
    /* wax seal */
    const c=el('button','qchk');c.type='button';c.setAttribute('aria-label',(on?'Undo ':'Complete ')+t.name);c.textContent=rest?'Resting':on?'\u2713 Done':'Complete';c.disabled=rest;c.onclick=ev=>toggle(t.id,ev);
    const xv=on&&S.award[k]!=null?S.award[k]:xpGain(t.xp,first,t),gv=on&&S.gAward[k]!=null?S.gAward[k]:goldGain(t,first);
    const rws=el('div','qrw');rws.append(rw('xp','\u2b50','+'+xv,'XP'),rw('g','coin:'+topCoin(gv),'+'+coinText(gv,2),'Coins: '+coinText(gv)));
        const nm=el('div','qname'),ft=el('div','qfoot');nm.appendChild(el('span','',t.name));nm.title=t.name;if(t.once)ft.append(c);else ft.append(qDots(t),c);
    const mw=t.once?0:masteryWeeks(t),ms=t.once?el('div','qms once','\u26a1 Today only'):mw?el('div','qms'+(mw>=MASTERY.max?' max':''),'\u2605 Wk '+mw+' \u00b7 +'+Math.round(Math.min(mw,MASTERY.max)*MASTERY.step*100)+'%'):null;
    if(ms&&!t.once)ms.title='Weekly mastery: '+mw+' perfect week'+(mw>1?'s':'')+' in a row. Finish this quest on every scheduled day each week to keep it growing; a missed week sets it back one week (max +'+Math.round(MASTERY.max*MASTERY.step*100)+'% XP and coins).';
    cd.append(band,nm);if(ms)cd.appendChild(ms);cd.append(rws,ft);
    cd.onclick=ev=>{if(ev.target.closest('button'))return;qDetails(t)};   /* tap the scroll (not a button) for its details; a drag is swallowed by the capture handler below */
    li.appendChild(cd);list.appendChild(li);
  });
  JUST=null;
}
/* ---------- drag the scrolls to rearrange them ----------
   Mouse: press a scroll and move. Touch: press and hold a moment, then drag (a quick swipe still scrolls the page).
   The scrolls shuffle out of the way live; on drop the new order is saved into S.tasks (and so synced to the cloud). */
(function(){
  const list=$('list'),HOLD=380,MOVE=10;
  let P=null,SUP=0;                                   /* P = a press that has not turned into a drag yet */
  const cards=()=>[...list.children].filter(c=>c.dataset&&c.dataset.id);
  const stop=()=>{if(P){clearTimeout(P.timer);P=null}};
  function place(x,y){                                 /* keep the grabbed scroll under the pointer */
    const li=DRAG.li;li.style.transform='none';
    const r=li.getBoundingClientRect();
    li.style.transform='translate('+(x-DRAG.gx-r.left)+'px,'+(y-DRAG.gy-r.top)+'px) scale(1.05) rotate(-2deg)';
  }
  function reorder(x,y){                               /* hovering another scroll: take its slot, the others slide over */
    const t=document.elementFromPoint(x,y),over=t&&t.closest&&t.closest('li.qc');
    if(!over||over===DRAG.li||over.parentNode!==list||!over.dataset.id||over.classList.contains('edit'))return;
    const all=cards(),sibs=all.filter(l=>l!==DRAG.li),was=new Map(sibs.map(l=>[l,l.getBoundingClientRect()]));
    list.insertBefore(DRAG.li,all.indexOf(DRAG.li)<all.indexOf(over)?over.nextSibling:over);
    sibs.forEach(l=>{
      const a=was.get(l),b=l.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;
      if(!dx&&!dy)return;
      l.style.transition='none';l.style.transform='translate('+dx+'px,'+dy+'px)';void l.offsetWidth;
      l.style.transition='';l.style.transform='';
    });
    place(x,y);buzz(10);
  }
  function loop(){                                     /* scroll the page when the scroll is held near the top or bottom edge */
    if(!DRAG)return;
    const m=80,h=innerHeight;let dy=0;
    if(DRAG.y<m)dy=-Math.ceil((m-DRAG.y)/4);else if(DRAG.y>h-m)dy=Math.ceil((DRAG.y-(h-m))/4);
    if(dy){scrollBy(0,dy);place(DRAG.x,DRAG.y);reorder(DRAG.x,DRAG.y)}
    DRAG.raf=requestAnimationFrame(loop);
  }
  function begin(x,y){
    const li=P.li,r=li.getBoundingClientRect();
    clearTimeout(P.timer);
    DRAG={li,pid:P.pid,gx:x-r.left,gy:y-r.top,x,y,raf:0};P=null;
    li.classList.add('dragging');list.classList.add('sorting');document.body.classList.add('dragmode');
    place(x,y);buzz(20);loop();
  }
  function end(commit){
    if(!DRAG)return;
    const li=DRAG.li;cancelAnimationFrame(DRAG.raf);
    if(commit){                                        /* the visible scrolls take the slots they already held in S.tasks, in their new order */
      const ids=cards().map(l=>l.dataset.id),have=new Set(ids),pos=[],by={};
      S.tasks.forEach((t,i)=>{if(have.has(t.id)){pos.push(i);by[t.id]=t}});
      const nt=S.tasks.slice();ids.forEach((id,k)=>{if(by[id])nt[pos[k]]=by[id]});
      if(nt.some((t,i)=>t!==S.tasks[i])){S.tasks=nt;save()}
    }
    DRAG=null;SUP=Date.now()+350;
    li.style.transition='transform .15s ease';li.style.transform='';   /* settle into its slot, then redraw */
    list.classList.remove('sorting');document.body.classList.remove('dragmode');
    setTimeout(()=>{li.classList.remove('dragging');render()},160);
  }
  list.addEventListener('pointerdown',e=>{
    if(DRAG||(e.pointerType==='mouse'&&e.button!==0))return;
    const li=e.target.closest('li.qc');
    if(!li||!li.dataset.id||li.classList.contains('edit')||e.target.closest('button,input'))return;
    stop();P={li,pid:e.pointerId,x:e.clientX,y:e.clientY,touch:e.pointerType!=='mouse',timer:0};
    if(P.touch)P.timer=setTimeout(()=>{if(P)begin(P.x,P.y)},HOLD);
  });
  addEventListener('pointermove',e=>{
    if(DRAG){
      if(e.pointerId!==DRAG.pid)return;
      DRAG.x=e.clientX;DRAG.y=e.clientY;place(DRAG.x,DRAG.y);reorder(DRAG.x,DRAG.y);return;
    }
    if(!P||e.pointerId!==P.pid||Math.hypot(e.clientX-P.x,e.clientY-P.y)<=MOVE)return;
    if(P.touch)stop();else begin(e.clientX,e.clientY);   /* touch: moved before the hold finished = the user is scrolling */
  });
  addEventListener('pointerup',e=>{stop();if(DRAG&&e.pointerId===DRAG.pid)end(true)});
  addEventListener('pointercancel',e=>{stop();if(DRAG&&e.pointerId===DRAG.pid)end(false)});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&DRAG)end(false)});
  addEventListener('touchmove',e=>{if(DRAG&&e.cancelable)e.preventDefault()},{passive:false});   /* no page scroll while a scroll is held */
  list.addEventListener('contextmenu',e=>{if(P||DRAG)e.preventDefault()});
  list.addEventListener('click',e=>{if(Date.now()<SUP){e.stopPropagation();e.preventDefault()}},true);   /* a drop is not a tap on the tick box */
})();
function updatePv(){const v=+$('diff').value;$('pvx').textContent='+'+xpGain(v)+' XP';$('pvg').textContent='+'+coinText(Math.round(v/2*goldMult()));$('pvh').textContent='-'+penalty(v)+' HP'}
function setAdd(o){ADDOPEN=o;$('addbody').hidden=!o;$('addtoggle').setAttribute('aria-expanded',o?'true':'false');$('add').classList.toggle('open',o)}
$('addtoggle').onclick=()=>{addTouched=true;setAdd(!ADDOPEN);if(ADDOPEN)$('newname').focus()};
$('add').onsubmit=e=>{
  e.preventDefault();
  const inp=$('newname'),name=inp.value.trim();if(!name)return;
  const nt={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name,xp:+$('diff').value,created:today(),days:AONCE?'all':saveDays(ADAYS)};
  if(AONCE)nt.once=today();   /* one-off: exists only today */
  S.tasks.push(nt);
  if(QT!=='any')QT=tabOf(nt);   /* jump to the tab where the new quest lives */
  inp.value='';addTouched=true;setAdd(false);save();render();toast('Quest pinned');
};
document.querySelectorAll('.dbtn').forEach(b=>b.onclick=()=>{
  $('diff').value=b.dataset.v;updatePv();
  document.querySelectorAll('.dbtn').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});
});
let ADAYS=DAYSETS.all.slice(),AONCE=false;   /* days picked in the new-quest note; AONCE = a one-off quest for today only */
const addDR=$('dayhost')?dayRow(()=>ADAYS,v=>{ADAYS=v;AONCE=false},()=>syncAddDays()):null;
const onceHint=el('div','sub onehint','Just for today. Finish it before midnight or take the damage.');onceHint.hidden=true;
function syncAddDays(){
  const k=AONCE?'once':dayKey(ADAYS);$('days').value=AONCE?'once':(k||saveDays(ADAYS).join());
  document.querySelectorAll('#add .sbtn').forEach(x=>{const on=x.dataset.g===k;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});
  if(addDR){addDR.paint();addDR.style.display=AONCE?'none':''}
  onceHint.hidden=!AONCE;
}
document.querySelectorAll('#add .sbtn').forEach(b=>b.onclick=()=>{if(b.dataset.g==='once')AONCE=true;else{AONCE=false;ADAYS=DAYSETS[b.dataset.g].slice()}syncAddDays()});
if(addDR)$('dayhost').appendChild(addDR);$('dayhost').appendChild(onceHint);
syncAddDays();
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
      h.textContent='Reset progress?';p.textContent='This erases your hero, gear, quests and coins.';
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
/* ONE-TIME RESTORE of lost progress (runs once, then S.restored stops it; the flag syncs, so it never runs twice across devices).
   Edit these numbers if they are not what you want. Values only ever go UP, never down. */
const RESTORE={id:'r1',level:2,streak:2,gold:70,chests:2,boss:'Direwolf Pack'};
function restoreProgress(){
  if(S.restored===RESTORE.id)return;
  const t=today();
  S.xp=Math.max(S.xp,need(RESTORE.level));
  S.gold=Math.max(S.gold,RESTORE.gold);
  S.chests=Math.max(S.chests,RESTORE.chests);
  for(let i=1;i<=RESTORE.streak;i++){                       /* the last N days count as perfect days */
    const d=addDays(t,-i);
    S.perfect[d]=1;
    S.done[d]=S.tasks.filter(x=>active(x,d)).map(x=>x.id);
  }
  if(S.lastDay<addDays(t,-1))S.lastDay=addDays(t,-1);        /* those days are settled: no penalties for them */
  S.boss=null;                                               /* last week's boss is already beaten; this week gets a fresh one */
  TR=bsum('hp');S.hp=maxHp(levelOf(S.xp));
  addLog('Defeated '+RESTORE.boss+'! (progress restored)','good',null);
  S.restored=RESTORE.id;save();
  toast('Progress restored: level '+levelOf(S.xp)+', '+streak()+'-day streak');
}
function daily(){if(!canRun())return;restoreProgress();ensureBoss();process()}
let lastPull=0,pulling=null;
/* ask the server for the newest copy and apply it (a sleeping tab / computer can miss live updates). resolves false if the server could not be reached */
function pullFresh(){
  if(!user||!fb||!synced||dirty)return Promise.resolve(true);   /* nothing to compare, or our own change is on its way up */
  if(Date.now()-lastPull<5000)return Promise.resolve(true);
  if(pulling)return pulling;
  pulling=docRef().get({source:'server'}).then(snap=>{lastPull=Date.now();if(!dirty)onCloud(snap,false);return true}).catch(()=>false).then(ok=>{pulling=null;return ok});
  return pulling;
}
function checkDay(){
  if(dirty&&user&&synced&&!pushT)pushNow();   /* retry any save that failed or was interrupted */
  if(!canRun()){timer();return}
  if(shown!==today()){
    pullFresh().then(ok=>{
      if(!ok){timer();return}   /* cloud unreachable: no penalties from a possibly stale copy, try again next tick */
      if(shown!==today()){shown=today();process();ensureBoss();render()}else timer();
    });
  }else timer();
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){flushPush();return}   /* leaving the app: save to cloud right now */
  pullFresh().then(()=>checkDay());                                 /* coming back: catch up with the cloud first, then check the day */
});
addEventListener('pagehide',flushPush);
setInterval(checkDay,30000);
$('fl').appendChild(px('🔥',16));$('mi').appendChild(px('⚡',16));initNav();initCreator();initScene();initHud();
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
  /* dev: preview the subclass slot under the rank in every state (locked, ready, each of the 10 subclasses). Sits at the top of the Realm tab, right under the profile card. */
  const sLIST=[{st:'off',t:'Locked (before Lv 15)'},{st:'ready',t:'Ready to choose'}].concat(Object.keys(SUBD).map(id=>({st:'on',id,n:SUBD[id].n,t:SUBD[id].n})));
  let si=-1;
  const sp=el('div','panel dev'),sRow=el('div','devrow'),sPrev=el('button','ghost','<'),sNext=el('button','ghost','>'),sMid=el('div','devmid'),sName=el('b','','My subclass'),sReset=el('button','ghost','Back to my subclass');
  sPrev.type=sNext.type=sReset.type='button';sPrev.setAttribute('aria-label','Previous subclass look');sNext.setAttribute('aria-label','Next subclass look');
  sMid.appendChild(sName);sRow.append(sPrev,sMid,sNext);
  sp.append(sRow,el('div','sub','Dev: preview the subclass slot under your rank. Your save is not changed.'),sReset);
  const sdraw=()=>{sName.textContent=PVS?sLIST[si].t:'My subclass';render()};
  const sgo=n=>{si=PVS?(si+n+sLIST.length)%sLIST.length:(n>0?0:sLIST.length-1);PVS=sLIST[si];sdraw()};
  sPrev.onclick=()=>sgo(-1);sNext.onclick=()=>sgo(1);
  sReset.onclick=()=>{PVS=null;si=-1;sdraw()};
  $('arena').closest('.arenaframe').after(sp);   /* after the frame, so the chains always hang from the hero card */
  const dtb=el('button','ghost','');dtb.type='button';dtb.id='devtoggle';
  const applyDev=()=>{
    if(!DEVON){PVS=null;si=-1;sName.textContent='My subclass';$('dreset').onclick();$('dpreset').onclick()}   /* drop any preview so you see your real hero and companion */
    $('dev').hidden=!DEVON;$('devpet').hidden=!DEVON;sp.hidden=!DEVON;
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
const BASE='dq.base';   /* the cloud timestamp this device last pulled or pushed: tells us if ANOTHER device has written since */
const getBase=()=>{try{return localStorage.getItem(BASE)}catch(e){return null}};
const setBase=t=>{try{if(t==null)localStorage.removeItem(BASE);else localStorage.setItem(BASE,String(t))}catch(e){}};
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
  const ts=S.ts||Date.now();
  docRef().set({data:JSON.stringify(S),ts})
    .then(()=>{
      setBase(ts);
      if(seq===saveSeq){dirty=false;setPending(false)}   /* only "done" if nothing changed while it was uploading */
      setMsg('Saved to cloud at '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
    })
    .catch(e=>setMsg('Cloud save failed ('+(e.code||'error')+'). Your progress is still saved on this device.'));
}
function applyCloud(c){
  setBase(c.ts);
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
    const cloudSame=getBase()!=null&&getBase()===String(c.ts);   /* nobody else wrote since this device last synced */
    if(!emptyState(S)&&((unsent&&cloudSame)||adopt)&&sig(c)!==sig(S)){dirty=true;pushNow();daily();setMsg('Synced');render();return}
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
      if(first&&snap.metadata.fromCache){done();return}   /* not confirmed by the server yet: never treat it as the real copy */
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


/* ---------- shop: on tall phones the Guild Store front grows (instead of the stone floor), so it fills the screen like it does on desktop ----------
   --sfh = shop front height in px (336 = the designed size, never smaller). --sfk = how much the hatch contents (shelves, keeper) are enlarged to fill the taller window.
   The floor under it keeps about the height it has on a short window, so the Armoury and Companion walls fill it the same way. */
function sfFit(){
  const r=document.documentElement,tab=document.getElementById('tab-shop');if(!tab)return;
  const FLOOR=215,MIN=336,MAX=380;
  const mh=parseFloat(getComputedStyle(tab).minHeight)||Math.max(0,innerHeight-116);   /* the Shop tab's min-height already subtracts the nav and safe areas */
  const h=Math.round(Math.max(MIN,Math.min(MAX,mh-10-FLOOR)));
  const k=Math.min(1.22,1+(h-MIN)/MIN*0.9);
  r.style.setProperty('--sfh',h+'px');r.style.setProperty('--sfe',(h-MIN)+'px');r.style.setProperty('--sfk',k.toFixed(3));r.style.setProperty('--sfx',h>MIN+40?'1':'0');
  sfSpread();
}
/* when the stone floor is tall, the armoury scene is cut into its three props (rack + mannequin, shield, anvil) that are spread down the wall instead of sitting in a heap at the bottom */
function sfSpread(){
  const fl=document.querySelector('#tab-shop .sf-floor'),aw=fl&&fl.querySelector('.sf-armwall'),pw=fl&&fl.querySelector('.sf-petwall');if(!aw)return;
  const tall=fl.offsetHeight>270;
  if(tall&&!aw._seg){
    const src=aw.querySelector('.aw-scene');
    [['0 15 52 39','a'],['0 54 27 24','b'],['23 52 29 32','c']].forEach(([vb,c])=>{
      const s=src.cloneNode(true);s.setAttribute('viewBox',vb);s.setAttribute('class','aw-scene aw-seg aw-s'+c);
      s.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));aw.appendChild(s)});
    aw._seg=1;
  }
  aw.classList.toggle('spread',tall);if(pw)pw.classList.toggle('spread',tall);
}
addEventListener('resize',sfFit);addEventListener('orientationchange',sfFit);sfFit();

/* shop front: tap the keeper and he rings the bell and says something. His line appears on a small sideways parchment scroll that floats above his hatch, then fades away.
   Lines are dealt from a shuffled bag so none repeats until he has said them all; a few depend on how your hero is doing. */
(function(){
  const sf=document.querySelector('.storefront');if(!sf)return;
  const say=document.getElementById('sfsay'),inn=document.getElementById('sfsayin');
  const L=[
    'Welcome! Everything here is sturdy, long-lasting and sold without refunds. Seriously no refunds.',
    'Try the staff. Its very well polished. I polish it nightly. Alone. Pause....',
    'That sword is long, hard and surprisingly affordable.',
    'No refunds. Once its out of the box, it is yours.',
    'Whatever your into, I dont judge. I will charge extra, though.',
    'Do not ask what is in the sack. White stuff. Probably flour.',
    'Rub the lamp all you like. Nothing comes out but oil and disappointment.',
    'A smart hero buys protection. I meant armour you pervert.',
    'I sell bows, whips, rods and rope. What you do with them is between you and God.',
    'I used to be an adventurer like you, till I took an arrow to the knee.',
    'If it glows, it is probably enchanted. If it looks cursed, leave it alone. Yes, dont touch that one.',
    'The bell is for emergencies. Or for fun. I like the sound.',
    'You can handle a big weapon, right? Pause, i heard it as i said it out loud.',
    'Take your time and feel the quality. Bro not that, thats my arm.',
    'Buy two potions, get a third one free. The third ones mine. I drank it already.',
    'If a dragon asks, Ive never heard of you. Ive also never heard of dragons. Dragon these nuts on your face',
    'I accept grass, cash, and ass and im all good on grass and cash.',
    'We do not take returns, but we do take compliments. Please compliment my hat, im really insecure about it.',
    'Business has been slow. A goblin came in last week and just wanted to talk. Goblin these nuts in your mouth.',
  ];
  /* tapping the cat: the keeper comments on it (the cat itself says nothing), dealt from its own shuffled bag */
  const C=[
    'That cat has been asleep on my best cloak for three days. I started charging it rent. It has not paid.',
    'Dont let the cat fool you. Its not sleeping. Its judging me.',
    'The cat caught a rat yesterday and left its head on my pillow. I think it was a Godfather reference.',
    'I named the cat Jimothy. It does not answer to Jimothy. It does not answer to anything.',
    'People ask if the cat is for sale. I dont own the cat. Im its familliar.',
  ];
  /* lines that only make sense for how you are doing right now */
  const pool=()=>{
    const a=L.slice();
    try{
      if(typeof S==='object'&&S){
        if(typeof CHEST_COST!=='undefined'&&S.gold>=CHEST_COST)a.push('Thats a heavy sack you are carrying.','All that coin and so reluctant to spend it, are you jewish?');
        if(S.gold<20)a.push('Light purse today? Come back when you have something to put on the counter brokie.','Empty pockets again? Pft, brokie.');
        if(S.freezes>0)a.push('Keep those Streak Freezes handy. Cold showers are a hero\u2019s best friend.');
        const st=typeof streak==='function'?streak():0;
        if(st>=3)a.push(st+' days in a row! Goddamn tryhard.');
        if(typeof maxHp==='function'&&typeof levelOf==='function'&&S.hp<maxHp(levelOf(S.xp))*.4)a.push('You look rough. Rest up, drink something and stay out of the wolf pit tonight.');
      }
    }catch(e){}
    return a;
  };
  let rt=null,hideT=null;
  const bagOf=get=>{
    let bag=[],last='';
    return()=>{
      if(!bag.length){
        bag=get();
        for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]]}
        if(bag.length>1&&bag[bag.length-1]===last){const t=bag.pop();bag.unshift(t)}   /* never the same line twice in a row */
      }
      last=bag.pop();return last;
    };
  };
  const next=bagOf(pool),nextCat=bagOf(()=>C.slice());
  function speak(text){
    if(!say||!inn){toast('\u201C'+text+'\u201D');return}   /* no scroll in the page: fall back to the old toast */
    clearTimeout(hideT);
    inn.textContent='\u201C'+text+'\u201D';
    say.classList.add('on');
    hideT=setTimeout(()=>say.classList.remove('on'),1500+text.length*28);   /* short stay: about 2.5s for a short line, 4s for a long one */
  }
  /* ---- up close: tap the shop front and it zooms in on the shelves. Pick wares off them while the keeper stays in view behind his counter. ---- */
  let zo=null,zsel=null,zHide=null,zcat='all';
  const ZKIND={fz:'supplies',pot:'supplies',heal:'supplies',ch:'chests',epic:'chests'};   /* which shelf each ware belongs to */
  const ZCATS=[['all','All wares',null],['supplies','Supplies','🧪'],['chests','Chests','🎁']];
  const ZLINES={
    fz:'Streak Freeze. Keeps your streak alive when you slack. I dont judge. Out loud.',
    pot:'Healing Potion. Tastes like feet. Works like magic.',
    ch:'A loot chest. Could be a legendary blade. Could be a sock. No refunds.',
    heal:'Full Heal. Dont ask what the gem does inside it. It just works.',
    epic:'An Epic Chest. Open it from your pack. Dont shake it. Itl finish.'
  };
  const BUYL=['Pleasure doing business.','Coin received. Items yours. No refunds.','A fine choice. A very expensive choice, but a fine one.'];
  const BROKE=['Short on coin? The wolves pay well, I hear.','Come back when your purse is heavier brokie. I mean that kindly.'];
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const zsay=text=>{
    if(!zo)return;const b=zo.querySelector('.sfz-say');if(!b)return;
    clearTimeout(zHide);
    b.querySelector('.sf-say-in').textContent='\u201C'+text+'\u201D';
    b.classList.add('on');
    zHide=setTimeout(()=>b.classList.remove('on'),2200+text.length*30);
  };
  const zFind=()=>{
    if(!zsel)return null;
    const i=zsel.indexOf(':'),c=zsel.slice(0,i),id=zsel.slice(i+1),it=SHOP[c]&&SHOP[c].find(x=>x.id===id);
    return it?{cur:c,it}:null;
  };
  const zPrice=(cur,it)=>cur==='g'?coinText(it.cost):it.cost+' 💎';
  /* the chest stage lives on the stone floor under the counter: the chest and Open button (skipped while the open animation plays so it is not rebuilt mid-shake) */
  function zChest(){
    const box=zo&&zo.querySelector('.sfz-chest');if(!box||CHEST_BUSY)return;
    box.replaceChildren();
    const nc=S.chests,fg=el('button','chestfig'+(nc>0?' ready':''));
    fg.type='button';fg.setAttribute('aria-label',nc>0?'Open a chest':'No chests to open');fg.appendChild(chestPx(false));
    const go=()=>{if(nc<1){zsay('No chests yet. Perfect days and weekly bosses drop them.');return}openChestFx(fg,box)};
    fg.onclick=go;
    const ob=el('button','btn','Open chest');ob.type='button';ob.disabled=nc<1;ob.onclick=go;
    const info=el('div','sfz-ci');info.append(el('b','','Chests: '+nc),el('small','',nc>0?'Tap the chest to open it.':'None yet. Earn them from perfect days and weekly bosses.'),ob);
    box.append(fg,info);
  }
  function zRender(){
    if(!zo)return;
    const have=c=>c==='g'?S.gold:(S.gems||0);
    const chip=(ico,txt)=>{const d=el('span','sfz-chip');if(ico)d.appendChild(ico);d.appendChild(el('b','',txt));return d};
    /* money first and big (coins by denomination, then gems); what you are holding is smaller beside it. The currency of the ware you picked glows. */
    const f0=zFind(),act=c=>f0&&f0.cur===c?' act':'';
    const purse=el('span','sfz-chip cur sfz-purse'+act('g'));purse.title='1 gold = 10 silver = 100 bronze';
    coinParts(S.gold).forEach((v,i)=>{const g=el('span','sfz-pc');g.title=['Gold','Silver','Bronze'][i];g.append(px('coin:'+COIN_U[i],10),el('b','',String(v)));purse.appendChild(g)});
    const gems=chip(px('💎',16),String(S.gems||0));gems.className='sfz-chip cur gem'+act('m');gems.title='Gems';
    const fz=chip(px('🧊',16),(S.freezes|0)+'/'+FREEZE_MAX),ch=chip(px('🎁',16),String(S.chests)),po=chip(px('🧪',16),String(S.pots|0));
    fz.classList.add('sm');ch.classList.add('sm');po.classList.add('sm');fz.title='Streak Freezes held';ch.title='Chests to open';po.title='Healing Potions in your inventory';
    zo.querySelector('.sfz-wal').replaceChildren(purse,gems,fz,ch,po);
    zChest();
    zo.querySelectorAll('.sfz-tab').forEach(t=>{const on=t.dataset.cat===zcat;t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1});
    /* coin goods on the back shelf at the left of the hatch, gem goods on the right */
    [['g','l'],['m','r']].forEach(([cur,side])=>{
      const u=zo.querySelector('.zbs.'+side);u.replaceChildren();
      const items=SHOP[cur].filter(it=>zcat==='all'||ZKIND[it.id]===zcat);
      u.className='zbs '+side+(items.length<3?' few':'');
      items.forEach(it=>{
        const key=cur+':'+it.id,blocked=!!(it.ok&&!it.ok()),poor=have(cur)<it.cost,slot=el('div','zslot');
        const b=el('button','zi'+(zsel===key?' sel':'')+(blocked?' full':(poor?' poor':''))),ic=el('span','zi-ic');
        b.type='button';b.title=it.n;b.setAttribute('aria-label',it.n+', '+(blocked?it.full:zPrice(cur,it)));b.setAttribute('aria-pressed',zsel===key?'true':'false');
        ic.appendChild(px(it.e,32));
        b.append(ic,el('span','zi-tag',blocked?it.full:(cur==='g'?coinText(it.cost):it.cost+'\u{1F48E}')));
        b.onclick=()=>{zsel=key;zsay(poor&&!blocked?pick(BROKE):(ZLINES[it.id]||it.d));zRender()};
        slot.append(b,el('i','zi-pl'));u.appendChild(slot);
      });
    });
    const det=zo.querySelector('.sfz-det');det.replaceChildren();
    const f=zFind();
    det.hidden=!f;
    if(!f)return;
    const {cur,it}=f,blocked=!!(it.ok&&!it.ok()),poor=have(cur)<it.cost,t=el('div','sfz-dt');
    t.append(el('b','',it.n),el('span','sfz-pr',zPrice(cur,it)),el('small','',it.d));   /* the price lives here now, not on a tag under the shelf */
    const buy=el('button','btn',blocked?it.full:'Buy');
    buy.type='button';buy.disabled=blocked||poor;
    buy.onclick=()=>{
      if(blocked||poor)return;
      confirmBuy(it,zPrice(cur,it),()=>{shopBuy(cur,it);zsay(pick(BUYL));zRender()});
    };
    det.append(t,buy);
    if(poor&&!blocked)det.appendChild(el('div','sfz-poor','Not enough '+(cur==='g'?'coin':'gems')+' yet.'));
  }
  const zKey=e=>{if(e.key==='Escape')zClose()};
  const zReduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  /* the shop front itself is what zooms: a copy sits exactly on top of the real one, then scales up on the hatch */
  function zPlace(wrap,rect,zoomed){
    if(!zoomed){wrap.style.transform='translate('+rect.left+'px,'+rect.top+'px) scale(1)';return}
    const o=wrap._off,vw=window.innerWidth,vh=window.innerHeight,hud=zo.querySelector('.sfz-hud'),bot=zo.querySelector('.sfz-bot');
    const top=hud.offsetHeight+2,bottom=vh-140,h=Math.max(120,bottom-top),W=o.W;
    const s=Math.max(1.25,Math.min((vw-8)/(.58*W),h/180));
    const x=vw/2-s*(o.x+W/2),y=top+h/2-s*(o.y+240);   /* 240 sits the awning just under the top bar */
    wrap.style.transform='translate('+x+'px,'+y+'px) scale('+s+')';
  }
  function zClose(){
    if(!zo)return;
    const r=zo,wrap=r.querySelector('.sfz-zoom');zo=null;zsel=null;clearTimeout(zHide);
    document.removeEventListener('keydown',zKey);window.removeEventListener('resize',zResize);
    document.body.classList.remove('sfz-open');
    /* shrink back to exactly where it started: the whole Shop tab, not just the storefront (same target zOpen began from) */
    const tab=sf.closest('.tab')||sf,rect=tab.getBoundingClientRect();
    r.classList.remove('in');r.classList.add('closing');r.style.backgroundColor='transparent';
    zPlace(wrap,rect,false);
    setTimeout(()=>r.remove(),zReduce()?30:520);
  }
  const zResize=()=>{if(!zo)return;const w=zo.querySelector('.sfz-zoom');zPlace(w,w._rect,true)};
  function zOpen(){
    if(zo)return;
    /* the whole shop page is copied (not just the storefront) so everything around the shop zooms with it */
    const tab=sf.closest('.tab')||sf,tr=tab.getBoundingClientRect(),rect=sf.getBoundingClientRect();
    const root=el('div','sfz'),wrap=el('div','sfz-zoom'),c=tab.cloneNode(true);
    const oc=tab.querySelectorAll('canvas'),cc=c.querySelectorAll('canvas');
    cc.forEach((k,i)=>{try{if(oc[i]){k.width=oc[i].width;k.height=oc[i].height;k.getContext('2d').drawImage(oc[i],0,0)}}catch(e){}});   /* cloned canvases come out blank */
    c.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    if(tab.id)c.id=tab.id;   /* only so the #tab-shop styles still apply to the copy */
    c.removeAttribute('aria-hidden');
    c.classList.add('sfz-pg');
    c.querySelectorAll('.sf-say,.sf-hint').forEach(n=>n.remove());
    const sfc=c.querySelector('.storefront');if(sfc){sfc.classList.add('sfz-sf');const fl=el('div','sfz-floor');fl.onclick=zClose;sfc.prepend(fl)}   /* the stone wall continues down from inside the shop front, so there is no seam */
    const hatch=c.querySelector('.sf-hatch');
    if(hatch)hatch.append(el('div','zbs l'),el('div','zbs r'));
    wrap.style.width=tr.width+'px';wrap.style.height=tr.height+'px';
    wrap._rect=tr;wrap._off={x:rect.left-tr.left,y:rect.top-tr.top,W:rect.width};
    wrap.appendChild(c);
    c.querySelectorAll(':scope > :not(.storefront)').forEach(n=>{n.style.visibility='hidden'});
    
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','The Guild Store');
    const hud=el('div','sfz-hud'),sayrow=el('div','sfz-sayrow'),sayEl=el('div','sfz-say'),box=el('div','sf-say-box');
    box.appendChild(el('span','sf-say-in'));sayEl.appendChild(box);sayrow.appendChild(sayEl);
    hud.append(el('div','sfz-wal'),sayrow);
    const bot=el('div','sfz-bot'),det0=el('div','sfz-det'),tabs=el('div','sfz-tabs');det0.hidden=true;
    tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Shop shelves');
    ZCATS.forEach(([id,label,ico])=>{
      const t=el('button','sfz-tab');t.type='button';t.dataset.cat=id;t.setAttribute('role','tab');
      if(ico)t.appendChild(px(ico,14));t.appendChild(el('span','',label));
      t.onclick=()=>{zcat=id;const f=zFind();if(f&&zcat!=='all'&&ZKIND[f.it.id]!==zcat)zsel=null;zsay(id==='all'?'Everything I have, laid out for you.':id==='supplies'?'Supplies. For heroes who plan ahead. Or panic.':'Chests. Lovely things. Some of them are even legal.');zRender()};
      tabs.appendChild(t);
    });
    bot.append(det0,el('div','sfz-chest'),tabs);
    root.append(wrap,hud,bot);
    root.addEventListener('click',e=>{if(e.target===root)zClose()});
    document.addEventListener('keydown',zKey);window.addEventListener('resize',zResize);
    document.body.appendChild(root);
    zo=root;zsel=null;zRender();
    zPlace(wrap,tr,false);void wrap.offsetWidth;   /* start exactly where the real page is */
    document.body.classList.add('sfz-open');
    root.classList.add('in');root.style.backgroundColor=getComputedStyle(document.body).backgroundColor;zPlace(wrap,tr,true);
    setTimeout(()=>zsay('Take a look around. Touch nothing you cannot afford.'),zReduce()?60:520);
  }
  window.sfShelfRefresh=zRender;
  sf.addEventListener('click',e=>{
    if(e.target.closest('.sf-cat')){const ct=sf.querySelector('.sf-cat');ct.classList.remove('wake');void ct.offsetWidth;ct.classList.add('wake');speak(nextCat());return}
    if(!e.target.closest('.sf-keeper')){zOpen();return}   /* anywhere else on the shop front: zoom in on the shelves */
    sf.classList.remove('ring');void sf.offsetWidth;sf.classList.add('ring');clearTimeout(rt);rt=setTimeout(()=>sf.classList.remove('ring'),600);
    speak(next());
  });
})();

/* ---------- shop floor: the Armoury (left) and the Companion pens (right) ----------
   Both restock once a day. Today's stock is saved (S.sa = armoury, S.sp = pens) so reloading the app never re-rolls it.
   The stands and pens on the floor show the real stock; tapping one (or a sign) opens a sheet with every item and a Buy button. */
(function(){
  const fl=document.getElementById('sffloor');if(!fl)return;
  const ARM_SLOTS=['helm','weapon','armor','offhand'];            /* the four stands, in order */
  const ARM_COST=[80,260,700,1600];                                /* bronze, by rarity 0-3 (Common ... Very rare) */
  const PET_COST={0:['g',400],1:['g',1200],2:['m',7],3:['m',14],4:['m',28]};   /* by rarity: 'g' = coins (bronze), 'm' = gems */
  const PET_POOL=r=>r>=3?['unicorn','genie','golem','troll','drake','wendigo','wizfrog']:['wolfpup','sprite','imp','goblin','wendigo','wizfrog'];
  const LINES={
    a:['Steel is honest. My prices, less so.','New stock every dawn. Early heroes get the good plate.','Try the shield. Everyone looks braver behind one.','Mind the edges. Mind the prices more.','Bring more levels and I will bring out better steel.'],
    p:['They bite. Mostly the ones that do not.','Feed them. Pat them. Do not name them until you have paid.','Every one is house trained. Mostly.','A companion fights harder when it likes you.'],
    buy:['Pleasure doing business.','Sold. It is yours now, along with all its problems.','A fine choice.'],
    poor:['Your purse says no. Your quests say yes.','Come back with more coin.']
  };
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const price=e=>e.cur==='g'?coinText(e.cost,2):e.cost+'\u{1F48E}';
  const stk=k=>k==='a'?S.sa.s:S.sp.s;
  const stkAll=k=>k==='a'?S.sa.s.concat((S.sv&&S.sv.s)||[],(S.sc&&S.sc.s)||[]):S.sp.s;   /* the armoury's four bays, the three vault pieces (index 4-6), then the pieces standing in the scene (index 7+, each has a .pk key) */

  /* ---- stock ---- */
  const armCap=()=>{const l=levelOf(S.xp);return l>=22?3:l>=12?2:l>=5?1:0};   /* best rarity (and weapon skin tier) the shelves carry: Lv 1 plain, Lv 5 steel, Lv 12 ornate, Lv 22 rare */
  function armRarity(){   /* Common..Very rare; the odds slide toward the better stuff as you level */
    const p=Math.min(1,(levelOf(S.xp)-1)/39),w=[50-30*p,30,15+15*p,5+15*p].slice(0,armCap()+1);
    let r=Math.random()*w.reduce((a,b)=>a+b,0);
    for(let i=0;i<w.length;i++){if((r-=w[i])<0)return i}
    return 0;
  }
  function genArm(){
    return ARM_SLOTS.map(slot=>{
      const r=armRarity(),ks=Object.keys(NOUN[slot]),own=S.cls&&NOUN[slot][S.cls]?S.cls:null;
      const st=own&&Math.random()<.7?own:ks[Math.floor(Math.random()*ks.length)];   /* mostly gear that suits your class */
      const it=buildGear(slot,r,st);delete it.isNew;
      return {it,cur:'g',cost:ARM_COST[r],sold:false};
    });
  }
  /* the Vault: three pieces from above your station, hanging on the rail. One costs a lot of coin, two cost gems. */
  const VG=r=>Math.round([80,260,700,1600,4000,9000][r]*1.6),VM=[0,5,9,14,22,34];
  function genVault(){
    const cap=armCap(),rs=[Math.min(5,cap+1),Math.min(5,cap+2),Math.min(5,cap+2)],cur=['g','m','m'];
    const other=['helm','armor','offhand','weapon'],sl=['weapon',other[Math.floor(Math.random()*3)],null];
    sl[2]=other.filter(s=>s!==sl[1])[Math.floor(Math.random()*3)];
    return sl.map((slot,j)=>{
      const r=rs[j],ks=Object.keys(NOUN[slot]),own=S.cls&&NOUN[slot][S.cls]?S.cls:null;
      const st=own&&Math.random()<.7?own:ks[Math.floor(Math.random()*ks.length)];
      const it=buildGear(slot,r,st);delete it.isNew;
      return {it,cur:cur[j],cost:cur[j]==='g'?VG(r):VM[r],sold:false,vault:true};
    });
  }
  /* The pieces you can see in the Armoury scene are the wares: the hanging helm ('helm'), the hanging chestplate ('plate'), the diamond armour stand ('stand'),
     every sword in the long rack ('sw0'..) and every staff or spear in the barrel ('sp0'..). Tap one to select it, then Buy on the plaque.
     Rolled once a day (S.sc). The rack swords keep the exact sprite you see (its skin and tier); a sold piece disappears from the scene. */
  function swTier(v){const id=50+v;for(const st of ['warrior','great'])for(let k=0;k<4;k++)if(SKT[st][k].indexOf(id)>-1)return [st,k];return ['warrior',0]}
  /* what stands in the barrel today: four spears (models 8-12 are the five spear models) and four staffs (models 0-7 are the eight staffs of the sheet, 13 the gnarled druid staff), picked and arranged by the date. genScene() and aFill() both use it, so every model is also its own ware. */
  function barrelSet(){
    const sp=aShuffle(5).slice(0,4).map(k=>({c:8+k,k:'spear',sk:80+k})),st=aShuffle(9).slice(0,4).map(k=>k<8?{c:k,k:'staff',sk:72+k}:{c:13,k:'staff',sk:85});   /* model 13 / skin 85 = the gnarled druid staff */
    const all=sp.concat(st);return aShuffle(8).map(i=>all[i]);
  }
  /* the wall axes (skins 0-15): the weapon style and rarity tier each one belongs to in SKT, so an axe is sold as the exact model you see */
  function axTier(id){for(let k=0;k<4;k++)if(SKT.axe[k].indexOf(id)>-1)return ['axe',k];return ['axe',Math.min(1,armCap())]}
  function genScene(){
    const out=[],mk=(pk,it,r)=>{delete it.isNew;out.push({it,cur:'g',cost:ARM_COST[r],sold:false,pk})};
    let r=armRarity();mk('helm',buildGear('helm',r,'warrior'),r);
    r=armRarity();mk('plate',buildGear('armor',r,'warrior'),r);
    /* the diamond armour stand is four wares: its helm ('sthelm'), chestplate ('stand'), leggings ('stlegs') and boots ('stboots'), each picked on its own */
    [['sthelm','helm'],['stand','armor'],['stlegs','legs'],['stboots','boots']].forEach(([pk,sl])=>{const it=buildGear(sl,3,'warrior');it.ms=3;it.n=itemName(it);mk(pk,it,3)});
    aRack().forEach((v,q)=>{const [st,k]=swTier(v),it=buildGear('weapon',k,st);delete it.ms;it.sk=50+v;it.n=itemName(it);mk('sw'+q,it,k)});
    /* the barrel holds four spears and four staffs (see barrelSet); slot q shows model q of that set, and its ware is that exact model */
    barrelSet().forEach((b,q)=>{r=armRarity();const it=buildGear('weapon',r,b.k==='spear'?'spear':'mage');it.sk=b.sk;it.n=itemName(it);mk('sp'+q,it,r)});
    /* the six axes on the two wall rails ('ax<skin>'): aAxR() hangs aShuffle(16)'s first six, so those are exactly the wares */
    aShuffle(16).slice(0,6).forEach(id=>{const [st,k]=axTier(id),it=buildGear('weapon',k,st);delete it.ms;it.sk=id;it.n=itemName(it);mk('ax'+id,it,k)});
    /* the three shields on the wall rail under the beam ('sh0'..'sh2') */
    [0,1,2].forEach(i=>{r=armRarity();const sh=buildGear('offhand',r,'warrior');sh.shk=i%SHD.length;mk('sh'+i,sh,r)});
    /* the two crates on the shelf hold four trinkets each ('cr0'..'cr3' in the left crate, 'cr4'..'cr7' in the right one) */
    for(let c=0;c<8;c++){r=armRarity();const it=buildGear('trinket',r,null);mk('cr'+c,it,r)}
    return out;
  }
  function genPets(){
    const rs=[0,1,2,Math.random()<.25?4:3],seen=[];
    return rs.map(r=>{
      const pool=PET_POOL(r);let k=pool[Math.floor(Math.random()*pool.length)];
      for(let t=0;t<8&&seen.indexOf(k)>-1;t++)k=pool[Math.floor(Math.random()*pool.length)];
      seen.push(k);
      const it=buildGear('companion',r,null,k);delete it.isNew;
      const c=PET_COST[r];return {it,cur:c[0],cost:c[1],sold:false};
    });
  }
  function ensure(){
    const d=today();let ch=false;
    if(!S.sa||S.sa.d!==d||!Array.isArray(S.sa.s)||S.sa.s.length!==4||S.sa.g!==2){S.sa={d,g:2,s:genArm()};ch=true}
    if(!S.sv||S.sv.d!==d||!Array.isArray(S.sv.s)||S.sv.s.length!==3||S.sv.g!==2){S.sv={d,g:2,s:genVault()};ch=true}
    if(!S.sc||S.sc.d!==d||!Array.isArray(S.sc.s)||S.sc.s.length!==41||S.sc.g!==9){S.sc={d,g:9,s:genScene()};ch=true}
    if(!S.sp||S.sp.d!==d||!Array.isArray(S.sp.s)||S.sp.s.length!==4){S.sp={d,s:genPets()};ch=true}
    if(ch)save();
  }

  /* ---- the floor ---- */
  let lastSig='';
  function cell(k,i,e,fn){
    const it=e.it,b=el('button','fz-c'+(e.sold?' sold':'')+(it.r>=2?' rare':''));
    b.type='button';b.dataset.k=k==='a'?it.slot:'pet';b.style.setProperty('--rar',RAR[it.r]);
    b.setAttribute('aria-label',e.sold?'Sold out':it.n+', '+price(e));
    const ic=el('span','fz-ic');if(!e.sold)ic.appendChild(px(iicon(it),32));
    b.append(el('i','fz-st'),ic,el('span','fz-pr',e.sold?'SOLD':price(e)));
    b.onclick=fn||(()=>openSheet(k,i));
    return b;
  }
  function paint(){
    ensure();
    const sig=[S.sa,S.sp].map(o=>o.d+':'+o.s.map(e=>e.it.id+(e.sold?'x':'')).join(',')).join('|');
    if(sig!==lastSig){
      lastSig=sig;
      [['a','fzarmgrid'],['p','fzpetgrid']].forEach(([k,id])=>{const g=document.getElementById(id);if(g)g.replaceChildren(...stk(k).map((e,i)=>cell(k,i,e)))});
    }
    if(sheet)fill();
    if(zf)zfRender();
  }

  /* ---- the sheet ---- */
  let sheet=null,kind='a',hl=null,sayEl=null;
  const onKey=e=>{if(e.key==='Escape')closeSheet()};
  function say(t){if(sayEl)sayEl.textContent='\u201C'+t+'\u201D';if(zf)zfSay(t)}
  function row(e,i){
    const it=e.it,have=e.cur==='g'?S.gold:(S.gems||0),poor=have<e.cost;
    const r=el('div','fzv-row'+(e.sold?' sold':'')+(hl===i?' hl':''));r.style.setProperty('--rar',RAR[it.r]);
    const ic=el('span','fzv-ic');if(!e.sold)ic.appendChild(px(iicon(it),36));
    const tx=el('div','fzv-tx');
    tx.append(el('b','',it.n),el('small','rr',RNAME[it.r]+' \u00B7 '+(it.slot==='companion'?'starts at Lv '+pbase(it):SLOTN[it.slot])),el('small','bn',bonusTxt(it)));
    const btn=el('button','btn',e.sold?'Sold':'Buy \u00B7 '+price(e));btn.type='button';btn.disabled=e.sold||poor;
    btn.onclick=()=>{
      if(e.sold||poor)return;
      confirmBuy(it,price(e),()=>buy(i));
    };
    if(poor&&!e.sold)btn.title='Not enough '+(e.cur==='g'?'coin':'gems');
    r.append(ic,tx,btn);
    return r;
  }
  function fill(){
    if(!sheet)return;
    const w=sheet.querySelector('.fzv-wal'),purse=el('span','sfz-chip cur sfz-purse');
    coinParts(S.gold).forEach((v,i)=>{const g=el('span','sfz-pc');g.title=['Gold','Silver','Bronze'][i];g.append(px('coin:'+COIN_U[i],10),el('b','',String(v)));purse.appendChild(g)});
    const gem=el('span','sfz-chip cur gem');gem.title='Gems';gem.append(px('\u{1F48E}',16),el('b','',String(S.gems||0)));
    w.replaceChildren(purse,gem);
    const list=sheet.querySelector('.fzv-list');
    list.replaceChildren(...stk(kind).map((e,i)=>row(e,i)));
  }
  function openSheetOld(k,i){
    if(sheet)closeSheet(true);
    ensure();kind=k;hl=i==null?null:i;
    const src=document.getElementById(k==='a'?'fzarm':'fzpet');
    const root=el('div','fzv'),card=el('div','fzv-card'),hd=el('div','fzv-hd'),x=el('button','fzv-x','\u2715');
    root.dataset.k=k;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',k==='a'?'The Armoury':'The Companion Pens');
    x.type='button';x.setAttribute('aria-label','Close');x.onclick=()=>closeSheet();
    hd.append(el('div','fzv-tt',k==='a'?'The Armoury':'Companion Pens'),x);
    sayEl=el('div','fzv-say');
    card.append(hd,el('div','fzv-wal'),sayEl,el('div','fzv-list'),el('div','fzv-ft','Fresh stock every dawn.'));
    root.appendChild(card);
    root.addEventListener('click',e=>{if(e.target===root)closeSheet()});
    document.addEventListener('keydown',onKey);
    document.body.appendChild(root);document.body.classList.add('sfz-open');
    sheet=root;fill();say(pick(LINES[k]));
    /* zoom-from-source: start the card scaled/positioned over the Armoury or pens, then expand to full (same feel as the Guild Store zoom) */
    if(src&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)){
      const r=src.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;
      const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const s=Math.max(0.35,Math.min(r.width/Math.min(560,vw*0.9),r.height/(vh*0.5)));
      card.style.transition='none';
      card.style.transform='translate('+(cx-vw/2)+'px,'+(cy-vh+vh*0.25)+'px) scale('+s+')';
      card.style.opacity='0.6';
      void card.offsetWidth;
      card.style.transition='transform .45s cubic-bezier(.22,.7,.2,1),opacity .3s';
      card.style.transform='';
      card.style.opacity='';
    }
    requestAnimationFrame(()=>root.classList.add('in'));
    x.focus({preventScroll:true});
  }
  function closeSheet(now){
    if(!sheet)return;
    const r=sheet;sheet=null;sayEl=null;
    document.removeEventListener('keydown',onKey);document.body.classList.remove('sfz-open');
    r.classList.remove('in');
    setTimeout(()=>r.remove(),now||(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)?0:260);
  }


  /* ---- turn to face the Armoury / Companion pens ----
     Standing at the counter you turn your head: the shop slides away and the wall of weapons and armour (or the pens) slides in, as if you had turned left
     (Armoury) or right (Companions). The real stock stands in four niches; tap one to see its card and buy it. "Turn back" (or Esc) swings you round again. */
  let zf=null,zfK='a',zfSel=null;
  const zfReduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  const zfKey=e=>{if(e.key==='Escape'){if(zf&&zf.querySelector('.sfz-cm'))zfCmClose();else zfClose()}};
  /* leaving: tap one of the two wall torches (see zfBuild); tapping bare wall no longer takes you back */
  /* The wall is drawn in 3D (perspective + a quarter turn), and browsers do not hit-test through that reliably: a tap on a piece lands on the room itself and nothing happens.
     So when a tap lands on the bare room, the piece under the finger is found by its on-screen box and clicked for you. Taps the browser did route to the wall are left alone. */
  const zfHit=e=>{
    if(!zf)return;
    const room=document.getElementById('sfroom');if(!room||!room.classList.contains('done'))return;
    const t=e.target;if(!t||!t.closest||!room.contains(t)||t.closest('.sfz-hud,.sfz-bot,.sfz-cm,.sfz-cmb,.modal,[data-pk],.sfa-cr[data-cr],.sfa-v,.fz-c,.sfw-th'))return;   /* not on the HUD or a modal, and not already on a piece */
    const x=e.clientX,y=e.clientY;let best=null,bd=1e9;
    zf._wall.querySelectorAll('[data-pk]:not(.gone),.sfa-cr[data-cr],.sfa-v,.fz-c,.sfw-th').forEach(n=>{
      const r=n.getBoundingClientRect();if(!r.width||!r.height||x<r.left||x>r.right||y<r.top||y>r.bottom)return;
      const d=((x-r.left-r.width/2)/r.width)**2+((y-r.top-r.height/2)/r.height)**2;   /* several boxes overlap (swords, spears): the one whose centre is nearest wins */
      if(d<bd){bd=d;best=n}
    });
    if(best){e.stopPropagation();e.preventDefault();best.click()}
  };
  function zfSay(t){
    if(!zf)return;const b=zf.querySelector('.sfz-say');if(!b)return;
    clearTimeout(zf._h);b.querySelector('.sf-say-in').textContent='\u201C'+t+'\u201D';b.classList.add('on');
    zf._h=setTimeout(()=>b.classList.remove('on'),2400+t.length*30);
  }
  /* pixel-art decor for the companion pens (viewBox 100 x 170, drawn flat like the rest of the shop). The Armoury has none: it is an HTML wall of displays. */
    function aShuffle(n,salt){
    let h=2166136261;for(const ch of today()+(salt||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
    let s=h>>>0;const rnd=()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
    const a=[...Array(n).keys()];for(let i=n-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;
  }
  /* fill the two wall boards with as many different blades as fit (each blade appears once) */
  function aPack(wall){
    const L=wall&&wall.querySelector('.sfa-col.l'),R=wall&&wall.querySelector('.sfa-col.r');if(!L||!R)return;
    const hh=L.clientHeight;if(!hh||L._h===hh)return;L._h=hh;
    const used=new Set(aRack().map(j=>34+j)),ord=aShuffle(BLADES.length).filter(i=>!used.has(i));[0,1,2,3,4].forEach(j=>ord.splice(j*2,0,'d'+j));let p=0;   /* the five board daggers ('d0'..'d4') are spread through the first slots of both boards */
    [L,R].forEach(col=>{
      col.replaceChildren();let used=0,n=0;const room=hh-14;
      while(p<ord.length){const c=typeof ord[p]==='string'?dgCv(+ord[p].slice(1),1.6):wpnCv(ord[p],1),h=parseFloat(c.style.height),need=h+(n?5:0);if(used+need>room)break;col.appendChild(c);used+=need;n++;p++}
    });
  }
  const SV=(vb,w,h,b)=>'<svg viewBox="'+vb+'" width="'+w+'" height="'+h+'" shape-rendering="crispEdges" aria-hidden="true">'+b+'</svg>';
  const IK='#1a0f06',ST='#aab3c2',SD='#6a7384',SL='#eef3fa',GD='#e8b93c',RD='#a8283a',WD='#8a5a2a',WK='#6b4423';
  /* Armoury decor: chained plate and helm up top, an axe rail between the rows, and the floor: weapon rack, armour stand with axes behind it, barrel of axes */
  /* Armoury decor: every piece is a hand-built pixel sprite (see style.css): beam, hanging plate and helm, vault rail, axe crates on a shelf, flagstone floor with a runner, upright racks, armour stand */
  const RK=s=>'<div class="sfa-rk '+s+'"><i class="bk"></i><div class="it"></div><i class="fr"></i></div>';
  const ADEC='<div class="sfa-dec" aria-hidden="true">'
    +'<i class="sfa-beam"></i>'
    +'<div class="sfa-ch l"><i class="sfa-cu"></i></div><div class="sfa-ch c"><i class="sfa-cs"></i></div><div class="sfa-ch r"><i class="sfa-hm"></i></div>'
    +'<div class="sfa-rail"><i></i><b class="p l"></b><b class="p r"></b><div class="sfa-rowx"></div></div>'
    +'<div class="sfa-axr"><i class="rl"></i><i class="pk p1"></i><i class="pk p2"></i><i class="pk p3"></i><div class="sh">'+[0,1,2].map(i=>'<div class="sd"><b class="sfa-w" data-pk="sh'+i+'"></b></div>').join('')+'</div></div>'
    +'<div class="sfa-vr l"><i class="rl"></i><div class="ax"></div></div><div class="sfa-vr r"><i class="rl"></i><div class="ax"></div></div>'

    +'<div class="sfa-shelf"><i class="sfa-sbr l"></i><i class="sfa-sbr r"></i>'+'<div class="sfa-cr"><div class="ax"></div><i class="sfa-crf"></i></div>'.repeat(2)+'</div>'
    +'<div class="sfa-dgr"><div class="sfa-gbr"><div class="ax"></div></div><div class="gr g1"><i class="rl"></i><div class="ax"></div></div><div class="gr g2"><i class="rl"></i><div class="ax"></div></div></div>'
    +'<div class="sfa-floor"><i class="sfa-run"></i></div>'
    +'<div class="sfa-sd l"><i><b class="sfa-sz zh"></b><b class="sfa-sz zc"></b><b class="sfa-sz zg"></b><b class="sfa-sz zb"></b><b class="sfa-sz zb2"></b></i></div>'+RK('w')
    +'<div class="sfa-sd r br"><i class="bk"></i><div class="it"></div><i class="fr"></i></div></div>';
  /* one sword standing in the long rack; extra = blade rows added so it can reach up toward the top beam */
  function rackSword(v,q,k,VF){
    VF=VF||[0,1,0,1,0,0,0,1,1,0,1,1,0,1];
    const e=wpnCv(34+v,k||.9);if(VF[v])e.style.transform='scaleY(-1)';const w=parseFloat(e.style.width);
    e.dataset.v=v;e.dataset.q=q;e.dataset.rows=BLADES[34+v][1].split('|').length;e.dataset.pk='sw'+q;e.onclick=()=>zfPickKey('sw'+q);   /* each sword is its own ware */
    e.style.setProperty('--ih',e.style.height||'60px');e.style.position='absolute';e.style.bottom=(q%2?0:6)+'px';   /* every other sword sits 6px lower, so each hilt and guard reads on its own instead of piling up */e.style.left=(24.1+q*14.2-w/2).toFixed(1)+'px';   /* centres spread across the inner frame (rack is 176 wide) so the guards of the end swords stay inside the posts */
    return e;
  }
  /* zfFrame() calls this with the rack's height: the tallest sword is stretched (by adding blade rows, never by squashing pixels) until its pommel sits just under the top beam; the others keep their natural differences in length */
  function aRackFit(inn,rh,cs){
    const it=inn.querySelector('.sfa-rk.w .it');if(!it)return;
    const cvs=[...it.querySelectorAll('canvas[data-v]')];if(!cvs.length)return;
    /* every sword is drawn bigger as a whole (same proportions, never a longer blade) until its pommel rests on the top bar; 26 = the bar (about 20) plus the 6px the swords sink into the trough */
    const ks=cvs.map(c=>Math.max(.9,(rh-26)/cs/(+c.dataset.rows)));
    const key=ks.map(k=>k.toFixed(3)).join(',');if(it.dataset.xr===key)return;
    it.dataset.xr=key;
    cvs.forEach((c,i)=>c.replaceWith(rackSword(+c.dataset.v,+c.dataset.q,ks[i])));
  }
  const aRack=()=>aShuffle(14).slice(0,10);   /* the eight upright swords standing in the racks today (four a rack, swords only; never repeated on the boards) */
  const hqDone=new Set();
  function aHQ(root){
    root.querySelectorAll('.sfa-run').forEach(e=>e.style.display='none');
    root.querySelectorAll('.sfa-rk>i,.sfa-sd.br>i').forEach(el=>{
      const cs=getComputedStyle(el),bk=el.classList.contains('bk'),src=bk&&cs.borderImageSource!=='none'?cs.borderImageSource:cs.backgroundImage;
      const m=/url\(["']?(data:image\/png[^"')]+)["']?\)/.exec(src);if(!m)return;
      const key=m[1].slice(-60)+el.className;if(hqDone.has(el))return;hqDone.add(el);
      const im=new Image();im.onload=()=>{
        const c=document.createElement('canvas');c.width=im.width*HQ;c.height=im.height*HQ;
        const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(im,0,0,c.width,c.height);
        const u='url('+c.toDataURL('image/png')+')';
        if(bk&&cs.borderImageSource!=='none')el.style.borderImageSource=u;else el.style.backgroundImage=u;
        el.style.imageRendering='auto';
      };im.src=m[1];
    });
  }
  /* the axes hang on two upright wall rails, one in each free column under the torches (they used to stand in the crates): three to a rail, each hung from an iron peg.
     The axes are drawn as big as the shorter rail allows (never more than 0.9x), the same size on both sides, and may overlap a little like real hung tools. */
  /* a mace drawn on a 40x40 art grid (same scale and tilt as the axe sprites: head top-left, haft running down to the lower right). t = 0 spiked morningstar, 1 flanged gold mace, 2 ruby war-mace */
  function maceCv(t,k){
    const c=document.createElement('canvas'),x=c.getContext('2d');c.width=c.height=40*HQ;
    const P=(px,py,col)=>{x.fillStyle=col;x.fillRect(px*HQ,py*HQ,HQ,HQ)};
    const disc=(cx,cy,r,col)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(Math.hypot(dx,dy)<=r+.4)P(cx+dx,cy+dy,col)};
    const IK='#1a0f06',cx=13,cy=13,len=22;
    /* haft: dark outline first, then the wood, a lit edge, leather wraps near the butt, and a pommel */
    for(let i=0;i<=len;i++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=2;dx++)P(cx+i+dx,cy+i+dy,IK);
    for(let i=0;i<=len;i++){P(cx+i,cy+i,'#8a5a2a');P(cx+i+1,cy+i,'#6b4423');P(cx+i,cy+i-1<0?0:cy+i-1,'#8a5a2a')}
    for(let i=0;i<=len;i++)P(cx+i,cy+i,i%2?'#b07a42':'#9a6a34');
    for(let i=len-9;i<=len-2;i++)if(i%3===0){P(cx+i,cy+i,'#2a1a0a');P(cx+i+1,cy+i,'#2a1a0a')}
    disc(cx+len+2,cy+len+2,2,IK);disc(cx+len+2,cy+len+2,1,'#e8b93c');
    const ball=(r,base,hi,sh)=>{disc(cx,cy,r+1,IK);disc(cx,cy,r,base);
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const d=Math.hypot(dx,dy);if(d>r+.4)continue;
        if(dx+dy<=-r*.7&&d>r*.35)P(cx+dx,cy+dy,hi);else if(dx+dy>=r*.8)P(cx+dx,cy+dy,sh)}};
    const spike=(dx,dy,n,col)=>{for(let i=0;i<n;i++){P(cx+dx*i,cy+dy*i,IK);P(cx+dx*i+1,cy+dy*i,IK);P(cx+dx*i,cy+dy*i+1,IK)}for(let i=0;i<n-1;i++)P(cx+dx*i,cy+dy*i,col)};
    if(t===0){          /* iron ball with eight spikes */
      const R=5;[[-1,0],[0,-1],[1,0],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx,dy])=>{for(let i=0;i<4;i++){const px=cx+dx*(R+i),py=cy+dy*(R+i);P(px,py,i===3?IK:'#dfe6f0');if(i<3){P(px+(dy?1:0),py+(dx?1:0),'#6a7384')}}});
      ball(R,'#8d96a6','#e6edf6','#4a5266');P(cx,cy,'#c9d1de');
    }else if(t===1){    /* gold-banded steel head with four flanges */
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx,dy])=>{for(let i=3;i<8;i++){const px=cx+dx*i,py=cy+dy*i;P(px-1,py,IK);P(px+1,py,IK);P(px,py-1,IK);P(px,py+1,IK)}for(let i=3;i<7;i++)P(cx+dx*i,cy+dy*i,i%2?'#e8b93c':'#fbe08a')});
      ball(5,'#aab3c2','#eef3fa','#5a6478');disc(cx,cy,2,'#e8b93c');P(cx-1,cy-1,'#fff2b8');
      for(let i=0;i<3;i++){P(cx+6+i,cy+3-i+1,IK)}
    }else{              /* dark iron head, ruby core, four short horns */
      [[-1,0],[0,-1],[1,0],[0,1]].forEach(([dx,dy])=>spike(dx,dy,9,'#b9c2d0'));
      ball(5,'#4a4f5e','#8a93a6','#23262f');disc(cx,cy,2,IK);disc(cx,cy,1,'#e0364a');P(cx-1,cy-1,'#ff9aa6');
    }
    c.className='sfa-ax';c.style.imageRendering='auto';c.style.width=c.style.height=40*k+'px';return c;
  }
  /* the weapons hang on two upright wall rails, one in each free column under the torches: six hooks to a rail, an axe, a mace, an axe, a mace, an axe, a mace (three of each per side),
     each hung from an iron peg. They are drawn as big as the shorter rail allows (never more than 1.7x, so neighbours overlap a little), the same size on both sides, and may overlap a little like real hung tools.
     Only the axes are wares (the maces are wall decoration, so they have no tap target). */
  function aAxR(sc){
    const rs=[...sc.querySelectorAll('.sfa-vr')];if(!rs.length)return;
    if(rs.some(r=>!r.clientWidth||r.clientHeight<40))return;
    const N=3,M=6,k=Math.max(.5,Math.min(1.7,Math.min(...rs.map(r=>((r.clientHeight-12)/M)*1.65/40))));
    const o=aShuffle(16);let p=0;
    rs.forEach((r,ri)=>{
      const h=r.querySelector('.ax'),W=r.clientWidth,H=r.clientHeight,key='m'+W+'x'+H+'x'+k.toFixed(3);if(!h)return;
      if(r._k===key){p+=N;return}
      r._k=key;h.replaceChildren();r.querySelectorAll('.pk').forEach(x=>x.remove());
      const sz=40*k,step=(H-12)/M,right=r.classList.contains('r');
      for(let s=0;s<M;s++){
        const isAxe=s%2===0,t=6+s*step+(step-sz)/2;let cv;
        if(isAxe){
          const aid=o[p++];cv=axeCv(aid,k);
          cv.dataset.pk='ax'+aid;cv.tabIndex=0;cv.setAttribute('role','button');cv.setAttribute('aria-label','Inspect the wall axe');cv.onclick=()=>zfPickKey('ax'+aid);cv.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();zfPickKey('ax'+aid)}};
          if((s/2+p)%2)cv.style.transform='scaleX(-1)';
        }else{
          cv=maceCv(((s-1)/2+ri)%3,k);cv.setAttribute('aria-hidden','true');
          if(right)cv.style.transform='scaleX(-1)';   /* the right-hand maces face the other way, so the two columns mirror each other */
        }
        cv.style.left=((W-sz)/2).toFixed(1)+'px';cv.style.top=t.toFixed(1)+'px';h.appendChild(cv);
        const pk=document.createElement('i');pk.className='pk';pk.style.top=(t+sz*.25).toFixed(1)+'px';r.appendChild(pk);
      }
    });
    zfMark();   /* the freshly hung axes pick up their glow / sold state */
  }
  /* The brick above the dagger rods: two big weapons (a greatsword or a war hammer each) and two bows, re-rolled at every dawn. Decoration only.
     H is the free height (in the dagger board's own px) between the shield rail and the top dagger rod, worked out in zfFrame. When there is plenty of room the four pieces stand upright in four columns
     (big | bow | bow | big), each scaled up to fill the space and pinned to the wall; on a very short wall they fall back to the old low strip, lying down. */
  function aGBR(sc,H){
    const g=sc.querySelector('.sfa-gbr .ax');if(!g)return;
    const W=224,key=W+'x'+Math.round(H);if(g._k===key)return;g._k=key;g.replaceChildren();
    const gk=aShuffle(6,'gbr'),gs=aShuffle(2,'gbg'),hs=aShuffle(5,'gbh'),bs=aShuffle(7,'gbb'),BW=BOWSK.concat(BOWN),
      big=[0,1,2].map(j=>gk[j]%2?{h:1,sp:HAMSK[hs[j]]}:{h:0,id:[34,43][(gs[j%2]+j)%2]}),
      bow=j=>({sp:BW[bs[j]]});
    const peg=(x,y)=>{const pk=document.createElement('i');pk.className='pk';pk.style.left=x.toFixed(1)+'px';pk.style.top=y.toFixed(1)+'px';g.appendChild(pk)};
    if(H<96){   /* short wall: the old strip, everything lying down in one row */
      const bo=j=>{const q=bs[j];return q<2?{sp:BOWSK[q],k:q?2.6:1.6}:{sp:BW[q],k:.44}};
      [[big[0],12.5],[bo(0),37.5,0],[big[1],62.5],[bo(1),87.5,1]].forEach(([o,pct,flip])=>{
        const isB=!!o.k,cv=o.h?skCv(o.sp,.5):isB?skCv(o.sp,o.k):wpnCv(o.id,o.id===34?.78:.72),w=parseFloat(cv.style.width),h=parseFloat(cv.style.height);
        cv.setAttribute('aria-hidden','true');cv.style.left='calc('+pct+'% - '+(w/2).toFixed(1)+'px)';cv.style.top=(H/2-h/2).toFixed(1)+'px';
        if(!isB)cv.style.transform=o.h?'rotate(90deg)':'rotate(-90deg)';else if(flip)cv.style.transform='scaleX(-1)';
        g.appendChild(cv);
        if(!isB)[-.27,.27].forEach(f=>peg(W*pct/100+h*f,H/2+w/2));
      });
      return;
    }
    /* tall wall: two rows of three. Top row: three bows. Bottom row: three big weapons (greatswords point-down as drawn, war hammers head-up as drawn). Each piece is scaled evenly to fill its cell. */
    const cw=W/3,rows=[{y:H*.25,h:H*.44,list:[bow(0),bow(1),bow(2)]},{y:H*.73,h:H*.5,list:big}];
    rows.forEach((row,ri)=>row.list.forEach((o,i)=>{
      const cx=cw*(i+.5),isB=!o.h&&o.id==null,cv=o.h||isB?skCv(o.sp,1):wpnCv(o.id,1),w0=parseFloat(cv.style.width),h0=parseFloat(cv.style.height);
      let f=Math.min((cw-6)/w0,row.h/h0);
      if(isB&&w0/h0>.6)f=Math.min(f*1.1,(cw-2)/w0,row.h*.9/h0);   /* the two small squarish bows would look lost: let them grow a little */
      const w=w0*f,h=h0*f,y=row.y-h/2;
      cv.style.width=w.toFixed(1)+'px';cv.style.height=h.toFixed(1)+'px';cv.style.left=(cx-w/2).toFixed(1)+'px';cv.style.top=y.toFixed(1)+'px';cv.setAttribute('aria-hidden','true');
      if(isB&&i===2)cv.style.transform='scaleX(-1)';   /* the right-hand bow is mirrored so the row is symmetrical */
      g.appendChild(cv);
      if(isB)peg(i===2?cx+w*.2:cx-w*.2,row.y);         /* one iron pin through the grip */
      else[.3,.7].forEach(p=>peg(cx,y+h*p));            /* two pins hold a sword or hammer to the brick */
    }));
  }
  function aFill(sc){
    aHQ(sc);
    /* two rods over the crates, three hooks each; a dagger hangs from every hook by its pommel, point down. The dagger art is drawn blade up-left / hilt down-right, so it is turned 225deg (hilt up, blade down; the angle is worked out from each sprite's own diagonal so every dagger hangs straight; sprites 2 and 4 are drawn the other way round, hilt down-left) inside a square box as wide as its diagonal. */
    {const hd=aShuffle(6).map(i=>i<5?{j:i}:{id:[9,15,11,13,20,31,2,4][aShuffle(8,'d')[0]]}),HX=[[17,50,83],[17,50,83]];let hn=0;
      sc.querySelectorAll('.sfa-dgr .gr').forEach((r,ri)=>{const ax=r.querySelector('.ax');
        HX[ri].forEach(px=>{
          const dq=hd[hn++],isD=dq.j!=null,id=dq.id,rows=(isD?DAGSK[dq.j][1]:BLADES[id][1]).split('|'),bw=Math.max(...rows.map(q=>q.length)),bh=rows.length,k=isD?2:1.75,cv=isD?dgCv(dq.j,k):wpnCv(id,k),D=Math.ceil(Math.hypot(bw,bh)*k)+2;
          const d=document.createElement('i');d.className='dg';d.style.width=d.style.height=D+'px';d.style.left='calc('+px+'% - '+(D/2).toFixed(1)+'px)';
          cv.style.left='50%';cv.style.top='50%';cv.style.marginLeft=(-bw*k/2).toFixed(1)+'px';cv.style.marginTop=(-bh*k/2).toFixed(1)+'px';cv.style.transform=isD?'none':'rotate('+(-90-Math.atan2(bh,id===2||id===4?-bw:bw)*180/Math.PI).toFixed(1)+'deg)';   /* the board daggers are already drawn upright, pommel up, so they hang as they are */
          d.appendChild(cv);ax.appendChild(d);
          const pg=document.createElement('i');pg.className='pg';pg.style.left=px+'%';ax.appendChild(pg);
        });
      });}
    /* the brick above the dagger rods (greatswords, war hammers, bows) is laid out by aGBR once zfFrame knows how much wall is free */
    {const gb=sc.querySelector('.sfa-gbr');if(gb&&gb.dataset.h)aGBR(sc,+gb.dataset.h)}
    const vs=aRack();
    /* ONE long rack: eight swords, every one pommel up and point down in the trough. VSW sprites 1,3,7,8,10,11,13 are drawn blade-up, so those are flipped; the rest are already drawn pommel-up. */
    const VF=[0,1,0,1,0,0,0,1,1,0,1,1,0,1];
    const it=sc.querySelector('.sfa-rk.w .it');
    if(it)vs.forEach((v,q)=>it.appendChild(rackSword(v,q,0,VF)));
    /* the barrel on the right of the floor: the staffs and spears (red-banded pike, halberd, diamond staff, plain spear, orb staff), leaning out of it at different angles */
    const bi=sc.querySelector('.sfa-sd.br .it');
    /* the 24 spear models (drawn from the reference sheets): [height, butt x, lean, width] in css px; eight of them stand in the barrel today */
    const SPR=[[137.3,16.0,0,32.0],[137.0,16.0,0,32.0],[139.7,16.0,0,32.0],[138.0,16.0,0,32.0],[139.0,16.0,0,32.0],[139.3,16.0,0,32.0],[137.7,16.0,0,32.0],[140.0,16.0,0,32.0],[166.4,16,0,32],[172.4,16,0,32],[166.4,16,0,32],[170.8,16,0,32],[172.0,16,0,32],[140.0,24.67,0,49.3]],SK=1,SL=1;   /* the 8 staff and spear models: [height, butt x, lean, width] in css px (art is 3x) */   /* SL stretches the spears' length only (the art is smooth, so it stays clean) */
    const SLOT=[[12,-4,0],[18.5,-3,5],[25,-2,2],[31.5,-1,6],[38,1,3],[44.5,2,6],[51,3,1],[57.5,4,5]];   /* butt x in the barrel, fan angle, how far it is pushed up */
    if(bi)barrelSet().forEach((bm,q)=>{const id=bm.c;
      const [h,xb,ang,sw]=SPR[id],[cx,rot,up]=SLOT[q],e=document.createElement('i');e.className='stf w'+id;
      e.style.width=(sw*SK).toFixed(1)+'px';e.style.height=(h*SK*SL).toFixed(1)+'px';e.style.backgroundSize='100% 100%';e.style.imageRendering='auto';   /* hi-res art: drawn smooth, not blocky */
      e.style.transformOrigin=(xb*SK).toFixed(1)+'px 100%';e.style.left=(cx-xb*SK).toFixed(1)+'px';e.style.bottom=(8+up)+'px';
      e.style.transform='rotate('+(ang+rot).toFixed(2)+'deg)';bi.appendChild(e);
      /* the spears overlap, so each one gets a thin invisible strip down its shaft (one slot wide, same tilt) to tap */
      const hw=6.5,ht=document.createElement('b');ht.className='stf-hit';ht.dataset.pk='sp'+q;ht._art=e;
      ht.style.width=hw+'px';ht.style.height=e.style.height;ht.style.left=(cx-hw/2).toFixed(1)+'px';ht.style.bottom=(8+up)+'px';
      ht.style.transformOrigin=(hw/2)+'px 100%';ht.style.transform='rotate('+(ang+rot).toFixed(2)+'deg)';ht.onclick=()=>zfPickKey('sp'+q);bi.appendChild(ht);
    });
  }
  const ZD={
    p:'<rect x="0" y="116" width="100" height="1.6" fill="#1a0f06" opacity=".5"/>'
      +'<g stroke="#1a0f06" stroke-width=".8"><path d="M50 0V14" fill="none" stroke="#8a93a3"/><rect x="45" y="14" width="10" height="13" fill="#ffe9a8" opacity=".95"/><rect x="44" y="12" width="12" height="3" fill="#6b4423"/><rect x="44" y="26" width="12" height="3" fill="#6b4423"/></g><ellipse cx="50" cy="21" rx="14" ry="12" fill="#ffb04a" opacity=".22"/>'
      +'<g stroke="#1a0f06" stroke-width="1"><rect x="6" y="124" width="30" height="20" rx="3" fill="#d9a848"/><rect x="6" y="132" width="30" height="2" fill="#a8782c" stroke="none"/><rect x="38" y="130" width="26" height="14" rx="3" fill="#c89838"/><rect x="66" y="122" width="28" height="22" rx="3" fill="#d9a848"/><rect x="66" y="132" width="28" height="2" fill="#a8782c" stroke="none"/></g>'
      +'<g stroke="#1a0f06" stroke-width="1"><rect x="10" y="150" width="30" height="14" fill="#6b4423"/><rect x="12" y="152" width="26" height="6" fill="#4a8ac8" stroke="none"/><rect x="62" y="146" width="12" height="16" fill="#8a5a2a"/><rect x="62" y="146" width="12" height="3" fill="#aab3c2"/><rect x="78" y="150" width="16" height="14" fill="#a8764a"/><path d="M78 150L94 164M94 150L78 164" stroke="#4a2e16" fill="none"/></g>'
      +'<path d="M0 120C12 116 24 118 38 120M62 116C76 118 88 116 100 120" stroke="#c9a46a" stroke-width="1.2" fill="none"/>'
  };
  const ZSAY={
    helm:['Heads are fragile. Helmets are not.','Dented in all the right places.'],
    weapon:['Sharp end away from you. Always.','That blade has opinions. Mostly about goblins.'],
    armor:['Fits better than it looks. Mostly.','Heavy. But so is regret.'],
    legs:['Good greaves make a good stride.','Knees are the first to go. Protect them.'],
    boots:['Walk softly. Wear heavy boots.','A hero is only as good as their boots.'],
    offhand:['Everyone looks braver behind a shield.','Hold it higher. Now you are a wall.'],
    vault:['Vault piece. Not for the faint of purse.','Above your station, for now. Save up.','Only the best steel hangs on the rail.'],
    gone:['That one is already gone. New stock every dawn.','Sold. Early heroes get the good plate.']
  };
  /* ---- the Armoury wall: four display bays, one for each of today's wares (0 helm, 1 weapon, 2 armour, 3 shield).
     Every bay shows the real item mounted on its own fixture (pedestal, peg rail, mannequin stand, hook and chain) with its price tag under it.
     Tap a bay to select it; its details and Buy button appear under the wall. The shopkeeper stays at the main counter. ---- */
  function aBay(e,i){
    const it=e.it,n=el('div','sfw-s s'+i+(zfSel===i?' sel':'')+(e.sold?' sold':'')),b=el('button','sfa-b');
    b.type='button';b.dataset.i=i;b.style.setProperty('--rar',RAR[it.r]);
    b.setAttribute('aria-pressed',zfSel===i?'true':'false');
    b.setAttribute('aria-label',(e.sold?'Sold: ':'')+it.n+', '+(SLOTN[it.slot]||it.slot)+(e.sold?'':', '+price(e)));
    const ic=el('span','sfa-it');ic.dataset.k=it.slot;ic.appendChild(el('i','sfa-prop'));
    if(!e.sold){const g=el('span','sfa-gl'),p=px(iicon(it),64);ic.append(g,p)}
    const tg=el('span','sfa-tag'+(e.sold?' gone':''),e.sold?'SOLD':price(e));
    b.append(el('span','sfa-k',SLOTN[it.slot]||it.slot),ic,tg);
    b.onclick=()=>{if(zfSel===i){zfSel=null;zfRender();return}zfSel=i;kind='a';zfSay(e.sold?pick(ZSAY.gone):pick(ZSAY[it.slot]||LINES.a));zfRender()};
    n.appendChild(b);return n;
  }
  function vBtn(e,i){
    const it=e.it,b=el('button','sfa-v'+(zfSel===i?' sel':'')+(e.sold?' sold':''));
    b.type='button';b.dataset.i=i;b.style.setProperty('--rar',RAR[it.r]);
    b.setAttribute('aria-pressed',zfSel===i?'true':'false');
    b.setAttribute('aria-label','Vault piece: '+(e.sold?'sold, ':'')+it.n+', '+price(e));
    if(!e.sold){b.appendChild(px(iicon(it),30));const cb=el('i','sfa-cur');cb.appendChild(e.cur==='g'?px('coin:'+COIN_U[0],8):px('\u{1F48E}',10));b.appendChild(cb)}
    b.onclick=()=>{if(zfSel===i){zfSel=null;zfRender();return}zfSel=i;kind='a';zfSay(e.sold?pick(ZSAY.gone):pick(ZSAY.vault));zfRender()};
    return b;
  }
  /* put today's real item on each shield (called on every render, so a new day or a purchase is always shown) */
  /* a shield icon cropped to its own pixels (no empty border), drawn at the same pixel scale as px() and shown k times that size, so its top edge sits right at the beam */
  function shCrop(sp,k){
    const P=sp[0],rows=sp[1].split('|'),h=rows.length,w=Math.max(...rows.map(r=>r.length));
    let x0=w,y0=h,x1=-1,y1=-1;rows.forEach((r,y)=>{for(let j=0;j<r.length;j++)if(P[r[j]]){if(j<x0)x0=j;if(j>x1)x1=j;if(y<y0)y0=y;if(y>y1)y1=y}});
    if(x1<0)return null;
    const bw=x1-x0+1,bh=y1-y0+1,sc=64/Math.max(bw,bh),t=document.createElement('canvas'),tx=t.getContext('2d');
    t.width=bw;t.height=bh;rows.forEach((r,y)=>{for(let j=0;j<r.length;j++){const col=P[r[j]];if(col&&j>=x0&&j<=x1&&y>=y0&&y<=y1){tx.fillStyle=col;tx.fillRect(j-x0,y-y0,1,1)}}});
    const dw=Math.max(1,Math.round(bw*sc)),dh=Math.max(1,Math.round(bh*sc)),c=document.createElement('canvas');c.width=dw;c.height=dh;
    const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(t,0,0,dw,dh);
    c.className='px';c.style.imageRendering='pixelated';c.style.width=(dw/64*k*100).toFixed(1)+'%';c.style.height='auto';return c;
  }
  function aWares(sc){
    const all=stkAll('a');
    sc.querySelectorAll('.sfa-w[data-pk]').forEach(n=>{
      const e=all.find(x=>x.pk===n.dataset.pk);if(!e)return;
      n.style.setProperty('--rar',RAR[e.it.r]);
      const ic=iicon(e.it),shc=(typeof ic==='string'&&ic.slice(0,4)==='shd:'&&SHD[+ic.slice(4)])?shCrop(SHD[+ic.slice(4)],1.3):null;   /* every shield is scaled so its longest side matches the round wooden shield */
      n.replaceChildren(...(e.sold?[]:[shc||px(ic,64)]));
      n.setAttribute('aria-label','Inspect the '+e.it.n);
    });
  }
  /* the crates on the shelf: each holds four trinkets (wares 'cr0'..'cr7'); a bought one leaves the crate. Tap a crate for the menu. */
  function aCrates(sc){
    const all=stkAll('a');
    sc.querySelectorAll('.sfa-cr').forEach((cr,c)=>{
      if(!cr.dataset.cr){cr.dataset.cr=c;cr.tabIndex=0;cr.setAttribute('role','button');cr.onclick=()=>zfCrateMenu(c);cr.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();zfCrateMenu(c)}}}
      const left=[0,1,2,3].filter(q=>{const e=all.find(x=>x.pk==='cr'+(c*4+q));return e&&!e.sold});
      cr.setAttribute('aria-label','Crate of trinkets, '+left.length+' left');cr.classList.toggle('empty',!left.length);
      const h=cr.querySelector('.ax');if(!h)return;h.replaceChildren();
      [0,1,2,3].forEach(q=>{const e=all.find(x=>x.pk==='cr'+(c*4+q));if(!e||e.sold)return;const ic=px(iicon(e.it),20);ic.classList.add('ti');ic.style.left=(5+q*16)+'px';ic.style.bottom=(23+(q%2)*3)+'px';h.appendChild(ic)});
    });
  }
  /* the small menu a crate opens: its trinkets, one row each; pick one and its plaque (with Buy) comes up like any other piece */
  function zfCrateMenu(c){
    if(!zf||zfK!=='a')return;
    const open=zf.querySelector('.sfz-cm'),same=open&&+open.dataset.c===c;
    zfCmClose();if(same)return;
    const all=stkAll('a'),bd=el('div','sfz-cmb'),m=el('div','sfz-cm');m.dataset.c=c;m.setAttribute('role','dialog');m.setAttribute('aria-label','Trinkets in the crate');
    bd.onclick=zfCmClose;
    const hd=el('div','sfz-cmh'),x=el('button','sfz-cmx','\u00D7');x.type='button';x.setAttribute('aria-label','Close');x.onclick=zfCmClose;
    hd.append(el('b','','Crate '+(c+1)+' \u00B7 Trinkets'),x);m.appendChild(hd);
    [0,1,2,3].forEach(q=>{
      const pk='cr'+(c*4+q),e=all.find(v=>v.pk===pk);if(!e)return;
      const b=el('button','sfz-cmr'+(e.sold?' sold':'')+(zfSel!=null&&all[zfSel]&&all[zfSel].pk===pk?' on':''));b.type='button';b.disabled=e.sold;
      b.style.setProperty('--rar',RAR[e.it.r]);
      const ic=el('span','sfz-cmi');if(!e.sold)ic.appendChild(px(iicon(e.it),28));
      const t=el('span','sfz-cmt');t.append(el('b','',e.sold?'Sold out':e.it.n),el('small','',e.sold?'New stock every dawn.':RNAME[e.it.r]+' \u00B7 '+bonusTxt(e.it)));
      b.append(ic,t,el('span','sfz-cmp',e.sold?'':price(e)));
      b.onclick=()=>{zfCmClose();if(zfSel==null||!all[zfSel]||all[zfSel].pk!==pk)zfPickKey(pk)};
      m.appendChild(b);
    });
    zf.append(bd,m);
    const f=m.querySelector('.sfz-cmr:not(:disabled)')||x;f.focus();
  }
  function zfCmClose(){if(!zf)return;zf.querySelectorAll('.sfz-cm,.sfz-cmb').forEach(n=>n.remove())}
  function zfBuild(k){
    const sc=el('div','sfw-scene sfw-'+k),A=k==='a';
    sc.innerHTML='<div class="sfw-wall"></div><div class="sfw-ceil"></div><i class="sfw-post l"></i><i class="sfw-post r"></i>'
      +'<div class="sfw-in">'+(A?ADEC:'<svg class="sfw-decor up" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" aria-hidden="true">'+ZD[k]+'</svg><svg class="sfw-decor lo" viewBox="0 100 100 70" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges" aria-hidden="true">'+ZD[k]+'</svg>')
      +'<div class="sfw-sign fz-sign">'+(A?'Armoury':'Companions')+'</div>'
      +'<i class="sfw-torch l"></i><i class="sfw-torch r"></i><div class="sfw-slots"></div></div><div class="sfw-shade"></div>';
    /* the two wall torches are the way back to the store (only once the camera has arrived) */
    sc.querySelectorAll('.sfw-torch').forEach(n=>{
      const go=()=>{const rm=document.getElementById('sfroom');if(rm&&rm.classList.contains('done'))zfClose()};
      n.classList.add('tap');n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-label','Torch: back to the store');n.title='Back to the store';
      n.appendChild(el('b','sfw-th'));n.onclick=go;n.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go()}};
    });
    if(A){aFill(sc);
      sc.querySelectorAll('.sfa-w[data-pk]').forEach(n=>{const k2=n.dataset.pk;n.tabIndex=0;n.setAttribute('role','button');n.onclick=()=>zfPickKey(k2);n.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();zfPickKey(k2)}}});
      aWares(sc);aCrates(sc);
      /* the hanging helm and chestplate, and the four parts of the armour stand (helm, chestplate, leggings, boots) are each their own ware */
      [['.sfa-ch.r','helm','helm'],['.sfa-ch.l','plate','chestplate'],['.sfa-sz.zh','sthelm','stand helm'],['.sfa-sz.zc','stand','stand chestplate'],['.sfa-sz.zg','stlegs','stand leggings'],['.sfa-sz.zb','stboots','stand boots']].forEach(([q,k,lb])=>{
        const n=sc.querySelector(q);if(!n)return;
        n.dataset.pk=k;n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-label','Inspect the '+lb);
        if(k==='stboots')n._art=sc.querySelector('.sfa-sz.zb2');   /* the boots on the plinth glow / vanish with the boots ware */
        n.onclick=()=>zfPickKey(k);n.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();zfPickKey(k)}};
      });
    }
    return sc;
  }
  /* ---- the Armoury's description plaque (oak, like the Guild Store's chest panel). Hidden until you pick a piece; tap the same piece again to put it away. ---- */
  /* ---- swipe the description plaque to flick through the same kind of piece: swords, spears, the armour stand's four parts, the vault rail, the hanging plate and helm. Sold pieces are skipped. ---- */
  function zfGroup(all,e){
    const pk=e.pk||'',at=all.indexOf(e);
    const same=x=>{const k=x.pk||'',xi=all.indexOf(x);
      if(/^sw\d+$/.test(pk))return /^sw\d+$/.test(k);
      if(/^sp\d+$/.test(pk))return /^sp\d+$/.test(k);
      if(/^sh\d$/.test(pk))return /^sh\d$/.test(k);
      if(/^ax\d+$/.test(pk))return /^ax\d+$/.test(k);
      if(/^cr\d+$/.test(pk))return /^cr\d+$/.test(k);
      if(!pk)return !k&&xi>=4&&at>=4;
      if(/^st/.test(pk))return /^st/.test(k);
      return k==='helm'||k==='plate'};
    return all.map((x,i)=>i).filter(i=>same(all[i]));
  }
  function zfCycle(dir){
    if(!zf||zfK!=='a'||zfSel==null)return false;
    const all=stkAll('a'),e=all[zfSel];if(!e)return false;
    const g=zfGroup(all,e),at=g.indexOf(zfSel);if(g.length<2)return false;
    for(let n=1;n<g.length;n++){
      const j=g[(at+dir*n+g.length*n)%g.length],t=all[j];
      if(t&&!t.sold){zfSel=j;kind='a';zfSay(pick(ZSAY[t.it.slot]||LINES.a));zfRender();
        const pl=zf.querySelector('.sfz-plq');
        if(pl&&pl.animate&&!zfReduce())pl.animate([{transform:'translateX('+(dir*-28)+'px)',opacity:.25},{transform:'none',opacity:1}],{duration:170,easing:'ease-out'});
        return true}
    }
    return false;
  }
  function zfSwipe(pl){
    let x0=0,y0=0,id=null,moved=false;
    pl.style.touchAction='pan-y';
    pl.addEventListener('pointerdown',ev=>{if(ev.pointerType==='mouse'&&ev.button!==0)return;id=ev.pointerId;x0=ev.clientX;y0=ev.clientY;moved=false});
    pl.addEventListener('pointerup',ev=>{
      if(ev.pointerId!==id)return;id=null;
      const dx=ev.clientX-x0,dy=ev.clientY-y0;
      if(Math.abs(dx)>=36&&Math.abs(dx)>Math.abs(dy)*1.4){moved=true;zfCycle(dx<0?1:-1)}
    });
    pl.addEventListener('pointercancel',()=>{id=null});
    pl.addEventListener('click',ev=>{if(moved){ev.preventDefault();ev.stopPropagation();moved=false}},true);   /* a swipe that started or ended on the Buy button must not buy */
  }
  function zfDock(){
    const pl=zf.querySelector('.sfz-plq');if(!pl)return;
    const all=stkAll('a'),e=zfSel!=null?all[zfSel]:null,ic=el('span','sfz-di');
    pl.hidden=!e;
    if(!e){pl.replaceChildren();return}
    const it=e.it,have=e.cur==='g'?S.gold:(S.gems||0),poor=have<e.cost;
    ic.style.setProperty('--rar',RAR[it.r]);if(!e.sold)ic.appendChild(px(iicon(it),36));
    const t=el('div','sfz-pn');
    t.append(el('b','',e.sold?'Sold out':it.n),el('small','',e.sold?'New stock every dawn.':RNAME[it.r]+' \u00B7 '+(SLOTN[it.slot]||it.slot)+'. '+bonusTxt(it)));
    const buyb=el('button','btn',e.sold?'Sold':'Buy');buyb.type='button';buyb.disabled=e.sold||poor;
    if(poor&&!e.sold)buyb.title='Not enough '+(e.cur==='g'?'coin':'gems');
    buyb.onclick=()=>{if(e.sold||poor)return;kind='a';confirmBuy(it,price(e),()=>buy(zfSel))};
    const r=el('div','sfz-pb');
    if(!e.sold)r.appendChild(el('span','sfz-pp'+(poor?' poor':''),price(e)));
    r.appendChild(buyb);
    const gi=zfGroup(all,e);
    if(gi.length>1)t.append(el('i','sfz-sw','\u2039  '+(gi.indexOf(zfSel)+1)+' / '+gi.length+'  \u203A  swipe'));
    pl.replaceChildren(ic,t,r);
  }
  /* tap a piece in the scene: select it (its plaque and Buy button appear), tap it again to put it back */
  function zfPickKey(key){
    if(!zf||zfK!=='a')return;
    const all=stkAll('a'),i=all.findIndex(e=>e.pk===key);if(i<0||all[i].sold)return;
    if(zfSel===i)zfSel=null;
    else{zfSel=i;kind='a';zfSay(pick(ZSAY[all[i].it.slot]||LINES.a))}
    zfRender();
  }
  /* glow the selected piece; hide the ones already bought */
  function zfMark(){
    if(!zf||!zf._wall)return;
    const all=stkAll('a'),sel=zfSel!=null&&all[zfSel]?all[zfSel].pk:null;
    const sdl=zf._wall.querySelector('.sfa-sd.l'),bo=all.find(x=>x.pk==='stboots');if(sdl)sdl.classList.toggle('nb',!!bo&&bo.sold);   /* bought boots leave the plinth too */
    zf._wall.querySelectorAll('.sfa-cr[data-cr]').forEach(n=>n.classList.toggle('on',!!sel&&/^cr\d+$/.test(sel)&&Math.floor(+sel.slice(2)/4)===+n.dataset.cr));   /* the crate the picked trinket is in glows */
    zf._wall.querySelectorAll('[data-pk]').forEach(n=>{
      const e=all.find(x=>x.pk===n.dataset.pk),on=!!sel&&n.dataset.pk===sel,gone=!!e&&e.sold;
      [n,n._art].forEach(m=>{if(m){m.classList.toggle('on',on);m.classList.toggle('gone',gone)}});
    });
  }
  function zfRender(){
    if(!zf)return;
    ensure();
    const list=stk(zfK);
    const purse=el('span','sfz-chip cur sfz-purse');
    coinParts(S.gold).forEach((v,i)=>{const g=el('span','sfz-pc');g.title=['Gold','Silver','Bronze'][i];g.append(px('coin:'+COIN_U[i],10),el('b','',String(v)));purse.appendChild(g)});
    const gem=el('span','sfz-chip cur gem');gem.title='Gems';gem.append(px('\u{1F48E}',16),el('b','',String(S.gems||0)));
    zf.querySelector('.sfz-wal').replaceChildren(purse,gem);
    const box=zf._wall.querySelector('.sfw-slots');
    if(zfK==='a'){box.replaceChildren();   /* the four display bays (helm, weapon, armour, off-hand) are gone from the wall; only the vault rail is left */
      const rl=zf._wall.querySelector('.sfa-rowx');if(rl)rl.replaceChildren(...S.sv.s.map((e,j)=>vBtn(e,4+j)));aWares(zf._wall);aCrates(zf._wall)}
    else box.replaceChildren(...list.map((e,i)=>{
      const n=el('div','sfw-s s'+i+(zfSel===i?' sel':'')+(e.sold?' sold':'')),b=cell(zfK,i,e,()=>{zfSel=i;kind=zfK;if(!e.sold)zfSay(e.it.slot==='companion'?'A good one. Keep it fed.':pick(LINES.a));zfRender()});
      n.appendChild(b);return n;
    }));
    if(zfK==='a'){if(zfSel!=null){const se=stkAll('a')[zfSel];if(se&&se.pk&&se.sold)zfSel=null}   /* bought: the piece leaves the scene, so put its plaque away */
      zfDock();zfMark();zfFit();return}
    const det=zf.querySelector('.sfz-det'),ft=zf.querySelector('.sfz-ft');det.replaceChildren();
    const e=zfSel!=null?stkAll(zfK)[zfSel]:null;
    det.hidden=!e;ft.hidden=!!e;
    if(e){
      const it=e.it,have=e.cur==='g'?S.gold:(S.gems||0),poor=have<e.cost,t=el('div','sfz-dt');
      t.append(el('b','',it.n),el('span','sfz-pr',e.sold?'Sold':price(e)),
        el('small','',RNAME[it.r]+' \u00B7 '+(it.slot==='companion'?'starts at Lv '+pbase(it):SLOTN[it.slot])+'. '+bonusTxt(it)));
      const buyb=el('button','btn',e.sold?'Sold':'Buy');buyb.type='button';buyb.disabled=e.sold||poor;
      buyb.onclick=()=>{if(e.sold||poor)return;kind=zfK;confirmBuy(it,price(e),()=>buy(zfSel))};
      const ic=el('span','sfz-di');ic.style.setProperty('--rar',RAR[it.r]);if(!e.sold)ic.appendChild(px(iicon(it),36));
      const lf=el('div','sfz-dl');lf.append(ic,t);det.append(lf,buyb);
      if(poor&&!e.sold)det.appendChild(el('div','sfz-poor','Not enough '+(e.cur==='g'?'coin':'gems')+' yet.'));
    }
    zfFit();
  }
  /* the four stands are drawn for a 70px-wide cell; scale them to the niche so they fill it on any phone */
  function zfFit(){
    if(!zf||!zf._wall)return;
    if(zfK==='a'){aPack(zf._wall);aAxR(zf._wall)}

    const n=zf._wall.querySelector('.sfw-s');if(!n||!n.clientWidth)return;
    const z=Math.max(.8,Math.min(2.5,(n.clientWidth-10)/70,(n.clientHeight-8)/68));
    zf._wall.style.setProperty('--zf',z.toFixed(3));
  }
  /* the room: the real Shop tab is wrapped (once) so it can be the front wall of a 3D room. Nothing is cloned. */
  function sfRoom(){
    let r=document.getElementById('sfroom');if(r)return r;
    const tab=document.getElementById('tab-shop');if(!tab||!tab.parentNode)return null;
    r=el('div','sf-room');r.id='sfroom';
    const w=el('div','sf-world');
    tab.parentNode.insertBefore(r,tab);r.appendChild(w);w.appendChild(tab);
    return r;
  }
  function zfDims(room){
    const R=Math.round(room.getBoundingClientRect().width/2)||180;
    room.style.setProperty('--rr',R+'px');room.style.setProperty('--pp',Math.round(R*1.5)+'px');room.style.setProperty('--zc',Math.round(R*1.5)+'px');
  }
  /* the camera ends zoomed in (ZS x). Work out which part of the wall is on screen, clear of the coin bar above and the ware card below,
     and lay the wall's contents (decor, sign, torches, niches) out inside it, keeping the artwork's 100:170 shape. */
  const ZS=1.5;
  function zfFrame(room,wall){
    const inn=wall&&wall.querySelector('.sfw-in');if(!inn||!room)return;
    const rc=room.getBoundingClientRect();if(!rc.width||!rc.height)return;
    const cx=rc.width/2,cy=rc.height/2,vw=window.innerWidth,vh=window.innerHeight;
    const toY=y=>cy+(y-rc.top-cy)/ZS;
    /* HORIZONTAL: measure where the wall really ends up on screen (the camera's final pose: zoomed in, facing the wall) instead of assuming a 1.5x zoom about the room's centre.
       The wall is narrower than the room and the real zoom is a bit more than ZS, so the old maths left the whole scene ~10px right of centre and clipped the right-hand rack. */
    let sxz=ZS,wcx=cx,Xc=rc.left+cx,wwid=rc.width;
    {
      const cl=room.classList,tc=zfK==='a'?'turn-l':'turn-r',add=['moving','done',tc].filter(c=>!cl.contains(c)),wasOn=wall.classList.contains('on');
      add.forEach(c=>cl.add(c));wall.classList.add('on');
      const q=wall.getBoundingClientRect(),ow=wall.offsetWidth;
      if(ow>0&&q.width>0){sxz=q.width/ow;wcx=ow/2;Xc=(q.left+q.right)/2;wwid=ow}
      add.forEach(c=>cl.remove(c));if(!wasOn)wall.classList.remove('on');
    }
    const toX=x=>wcx+(x-Xc)/sxz;
    const x0=Math.max(0,toX(5)),x1=Math.min(wwid,toX(vw-5));   /* the wall fills the whole screen width, 5px in from each edge (the same on both sides, so the scene is centred) */
    /* the wall box ends 140-176px above the screen bottom (taller screens get more): the floor, the weapon racks and the armour stand are drawn below the box, so they need that strip to be seen.
       The description plaque floats over that strip only while a piece is picked. */
    const yb=zfK==='a'?Math.min(rc.bottom,vh)-Math.max(140,Math.min(176,Math.round(vh*.205))):vh-165;   /* the strip grows with the screen height, so short phones keep room for the four wall bays */
    const y0=Math.max(0,toY(105)),y1=Math.min(rc.height,toY(yb));
    const aw=x1-x0,ah=y1-y0;if(aw<80||ah<120)return;
    const s=inn.style;
    s.left=x0.toFixed(1)+'px';s.top=y0.toFixed(1)+'px';s.width=aw.toFixed(1)+'px';s.height=ah.toFixed(1)+'px';s.right='auto';s.bottom='auto';
    /* the lower artwork (rack, shelves, floor) fills the bottom 40% edge to edge: widen what it shows to match, up to the 140 units drawn */
    const lo=inn.querySelector('.sfw-decor.lo');
    if(wall.querySelector('.sfw-a')){   /* the Armoury is plain HTML bays and needs no artwork re-crop. Its racks and armour stand are scaled up and set down to fill the strip of floor under the wall. */
      const vis=Math.max(60,(Math.min(rc.bottom,vh)-yb)/ZS),base=Math.min(vis-20,150);   /* floor showing under the wall box (wall px) and where the feet of the racks go */
      /* everything is scaled evenly (never stretched). The racks' posts and the stands' poles get longer instead: --rh / --sh are their own heights. */
      const hr=base+34;   /* height a rack needs to reach the top of the shelf plank it leans on (shelf 22px up, plank 12px thick) */
      const hs=Math.min((hr+30)*1.35,ah+base-6);     /* the stands rise well past that, so they are always the tallest: 1.35x lifts the helm up to the brick course above the shelf (never higher than the wall box itself) */
      /* the armour stand (40 wide) and the barrel of staffs (80 wide, its spears lean out ~27px to the right) are drawn bigger than the weapon rack (160 wide): the stands scale KS times the rack.
         All three are sized together so they exactly fit inside the wall; the stands tuck OV px behind the rack's ends, and nothing is pushed past the edge of the room. */
      const M=4,KS=1.35,OV=2,LEAN=24,BK=1.3;   /* BK: the barrel is drawn 1.3x bigger (taller and wider) than the other stands */
      /* the diamond set fills the armour stand: it is drawn as tall as the stand minus a short pole and the base, and the stand is exactly as wide as that armour (the art is 20x33 with 14px of armour in it). These are screen sizes; they are divided by ss below because the stand itself is scaled by ss. */
      const hArm=Math.max(60,hs/(1+10/33)),wArm=hArm*14/33,us=hArm/33;   /* 10 art pixels are left under the armour for the diamond boots and the plinth; the slab is 1 pixel wider than the armour on each side (us) */
      const BX=70,BO=10;   /* barrel sprite width and how far the spears lean past it (barrel px) */
      const sc=Math.max(.3,Math.min(1.2,(aw-2*M-8-wArm-2*us)/(176+(BX+BO)*KS*BK))),ss=Math.min(1.8,sc*KS),bs=Math.min(2.4,sc*KS*BK);
      const SH=9,G=3,wst0=wArm+2*us,wb0=(BX+BO)*bs,d=Math.max(0,Math.min(.3,(aw-2*M+SH-wst0-176*sc-wb0-2*G)/176)),rsc=sc+d;   /* the armour stand slides SH px left, and the weapon rack takes that space (and any slack) so it grows, uniformly, wider and taller */
      const RHK=.85,rh=Math.max(72,hr*RHK/sc);   /* RHK: the rack's posts and swords are 15% shorter than the bare floor-to-shelf height */s.setProperty('--rs',rsc.toFixed(3));s.setProperty('--rh',rh.toFixed(1)+'px');
      const csv=Math.max(1,Math.min(1.6,(rh-12)/66));s.setProperty('--cs',csv.toFixed(3));aRackFit(inn,rh,csv);   /* the weapons in the racks grow evenly with the taller frame (about their own feet) */
      s.setProperty('--ss',ss.toFixed(3));s.setProperty('--bs',bs.toFixed(3));s.setProperty('--sh',Math.max(80,hs/ss).toFixed(1)+'px');s.setProperty('--sw',(wArm/ss).toFixed(1)+'px');s.setProperty('--aah',(hArm/ss).toFixed(1)+'px');s.setProperty('--rdy',(base-56).toFixed(1)+'px');
      /* lay the three out left to right: armour stand (diamond set), the long weapon rack, barrel of staffs and spears */
      const its=[...inn.querySelectorAll('.sfa-sd.l,.sfa-rk.w,.sfa-sd.r')],ws=[wArm+2*us,176*rsc,(BX+BO)*bs],gap=Math.max(-OV,(aw-2*M+SH-ws.reduce((p,q)=>p+q,0))/2);
      const NS=5;   /* NS: nudge the armour stand this many wall px to the right */
      const CX=3;   /* CX: shift the whole armour stand / rack / barrel group this many wall px to the right so it sits centred under the wall */
      const xs=[];let x=M-SH+CX;its.forEach((n,i)=>{xs.push(x);n.style.left=(x+(i===0?us+NS:0)).toFixed(1)+'px';n.style.right='auto';n.style.marginLeft='0';x+=ws[i]+gap});
      /* the shelf's two crates stand in the gap between the armour stand and the barrel (the plank itself still runs the full width): pad the shelf to that gap, and shrink the crates if it is narrow */
      const shf=inn.querySelector('.sfa-shelf');
      if(shf){const gl=Math.max(0,xs[0]+ws[0]+us+NS),gr=Math.max(gl,xs[2]-4);shf.style.paddingLeft=gl.toFixed(1)+'px';shf.style.paddingRight=Math.max(0,aw-gr).toFixed(1)+'px';inn.style.setProperty('--crs',Math.max(.55,Math.min(1,(gr-gl)/176)).toFixed(3));inn.style.setProperty('--dgx',((gl+gr)/2).toFixed(1)+'px');
        /* the dagger display has its own scale (it may grow a little past the crates) and takes all the brick height that is free above the crates, so the two rows get room */
        const dcs=Math.max(.55,Math.min(1,(gr-gl)/176)),dgs=Math.max(.6,Math.min(1.12,(gr-gl+10)/204)),dgb=44+46*dcs,dgh=Math.max(120,Math.min(176,(ah-dgb-62)/dgs));
        inn.style.setProperty('--dgs',dgs.toFixed(3));inn.style.setProperty('--dgh',dgh.toFixed(1)+'px')
        /* the free brick between the shield rail and the top dagger rod: from just under the shields down to the top of the (scaled) dagger board. The big weapons and bows fill it. */
        {const sdw=(aw-104)/3,gTop=34+5+sdw*1.25+8,gBot=ah-dgb-dgh*dgs-8*dgs-2,gH=Math.max(48,Math.min(300,(gBot-gTop)/dgs)),gb=inn.querySelector('.sfa-gbr');
        inn.style.setProperty('--gbh',gH.toFixed(1)+'px');if(gb){gb.dataset.h=gH.toFixed(1);aGBR(inn,gH)}}}   /* real widths (rack 176, barrel 70 + lean), so the right-hand barrel and its spears always end inside the wall */
      return;
    }
    const W=Math.max(100,Math.min(140,70*aw/(ah*.4)));
    if(lo)lo.setAttribute('viewBox',(50-W/2).toFixed(1)+' 100 '+W.toFixed(1)+' 70');
  }
  function zfClose(){
    if(!zf)return;
    const r=zf,room=document.getElementById('sfroom'),wall=r._wall;zf=null;zfSel=null;clearTimeout(r._h);
    document.removeEventListener('keydown',zfKey);document.removeEventListener('click',zfHit,true);window.removeEventListener('resize',zfResize);
    document.body.classList.remove('sfz-open');
    r.classList.remove('in');r.classList.add('closing');
    /* the same camera move, played backwards: turn back to the counter, then pull out of the middle of the room */
    room.classList.remove('done','go');room.classList.add('back');
    setTimeout(()=>{room.classList.remove('moving','back','turn-l','turn-r');if(room.firstChild)room.firstChild.style.paddingBottom='';if(wall)wall.classList.remove('on')},zfReduce()?30:1200);
    setTimeout(()=>r.remove(),zfReduce()?30:900);
  }
  const zfResize=()=>{const room=document.getElementById('sfroom');if(room&&zf){zfDims(room);zfFrame(room,zf._wall);zfMark();zfFit()}};
  function zoomFloor(k,i){
    if(zf)return;if(sheet)closeSheet(true);
    const room=sfRoom();if(!room)return;
    const world=room.firstChild;
    if(room.classList.contains('moving'))return;                       /* still arriving or leaving */
    ensure();zfK=k;kind=k;zfSel=i==null?null:i;
    /* the wall you are about to face (built once, then reused) */
    let wall=world.querySelector('.sf-rwall.'+(k==='a'?'l':'r'));
    if(!wall){wall=el('div','sf-rwall '+(k==='a'?'l':'r'));wall.appendChild(zfBuild(k));world.appendChild(wall)}
    /* the Armoury's floor, racks and armour stand hang BELOW the wall box, and the room box clips everything outside it (it stops at the nav bar): stretch the room down to the screen bottom while it is open */
    if(k==='a')world.style.paddingBottom=Math.max(0,Math.round(window.innerHeight-room.getBoundingClientRect().bottom))+'px';
    zfDims(room);zfFrame(room,wall);
    /* the coin purse, the keeper's words and the ware card sit above the room; the room itself is the real shop */
    const root=el('div','sfz sfw-root');
    root.setAttribute('role','dialog');root.setAttribute('aria-label',k==='a'?'The Armoury':'The Companion Pens');
    const hud=el('div','sfz-hud'),sayrow=el('div','sfz-sayrow'),sayEl2=el('div','sfz-say'),box=el('div','sf-say-box');
    box.appendChild(el('span','sf-say-in'));sayEl2.appendChild(box);sayrow.appendChild(sayEl2);
    hud.append(el('div','sfz-wal'),sayrow);
    const bot=el('div','sfz-bot'),det=el('div','sfz-det'),ft=el('div','sfz-ft','Fresh stock every dawn. Tap a pen to see it. Tap a torch to leave.');
    det.hidden=true;
    if(k==='a'){const pq=el('div','sfz-plq');pq.hidden=true;zfSwipe(pq);bot.append(pq)}   /* Armoury: nothing under the wall until you pick a piece */
    else bot.append(det,ft);
    root.append(hud,bot);
    document.addEventListener('keydown',zfKey);window.addEventListener('resize',zfResize);
    document.body.appendChild(root);
    root._wall=wall;wall.classList.add('on');
    room.classList.add('moving',k==='a'?'turn-l':'turn-r');
    zf=root;zfRender();
    void room.offsetWidth;
    document.body.classList.add('sfz-open');
    root.classList.add('in');room.classList.add('go');
    /* once the camera has arrived (zoomed in, no pull-back), draw the wall flat and crisp at the same zoom */
    setTimeout(()=>{if(zf===root){room.classList.add('done');zfFit();document.addEventListener('click',zfHit,true)}},zfReduce()?20:1420);
    setTimeout(()=>zfSay(pick(LINES[k])),zfReduce()?60:1460);
  }
  function openSheet(k,i){zoomFloor(k,i)}

  /* ---- buying: the item goes into your bag (the Hero tab shows a "!" until you look at it) ---- */
  function buy(i){
    ensure();const e=stkAll(kind)[i];if(!e||e.sold)return;
    const have=e.cur==='g'?S.gold:(S.gems||0);
    if(have<e.cost){say(pick(LINES.poor));return}
    if(e.cur==='g')S.gold-=e.cost;else S.gems=(S.gems||0)-e.cost;
    const it=Object.assign({},e.it,{id:uid(),b:Object.assign({},e.it.b),isNew:true});
    S.inv.push(it);e.sold=true;hl=i;
    addLog('Bought '+it.n,'good');toast('Bought '+it.n);buzz(30);
    save();render();paint();
    say(pick(LINES.buy));
  }

  document.getElementById('fzarmsign').onclick=()=>openSheet('a',null);
  document.getElementById('fzpetsign').onclick=()=>openSheet('p',null);
  [['.sf-armwall','a'],['.sf-petwall','p']].forEach(([q,k])=>{const w=fl.querySelector(q);if(w)w.onclick=()=>openSheet(k,null)});   /* the whole wall is the button */
  window.sfFloorRefresh=paint;
  sfRoom();
  paint();})();
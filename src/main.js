import { getSongLibrary, getChart } from './data.js';

// VAWE TAP • responsive canvas with a constant logical 390px width.
// Gameplay height and hit-line positions follow the available screen height.
// Menus follow the viewport height; very short screens may scroll vertically.
// Song data and synced note charts are external files, not hard-coded in this file.
const W=390, MENU_H=844, LANES=4, FIELD_X=24, FIELD_W=342, LANE_W=FIELD_W/4;
// VERSION 0.4: adaptive viewport menus, no overlapping blocks or forced aspect ratio.
let H=844, FIELD_TOP=176, FIELD_BOTTOM=728, HIT_Y=653, PAD_Y=690, FOOTER_Y=748;
const TRAVEL_SECONDS=1.78;
let uiScale=1, uiOffsetX=0, uiOffsetY=0;
const NOTE_W=74, NOTE_H=51, JUDGE_WINDOWS={perfect:.065, great:.115, good:.185};
const C={ink:'#080911',panel:'#171b27',frame:'#323747',white:'#f4f4e9',muted:'#9fa9b5',lime:'#a5ff48',orange:'#ffb147',pink:'#ff6eb6',blue:'#61e4fb',red:'#ff596d',darkLime:'#456721'};
const LANE_COLORS=[C.blue,C.lime,C.orange,C.pink];
const canvas=document.querySelector('#game');
const ctx=canvas.getContext('2d',{alpha:false});
ctx.imageSmoothingEnabled=false;
function setAppViewportHeight(){
 const v=window.visualViewport;
 const height=Math.round(v?.height||window.innerHeight);
 document.documentElement.style.setProperty('--app-height',height+'px');
}
function resizeCanvas(){
 setAppViewportHeight();
 const bounds=canvas.getBoundingClientRect();
 if(bounds.width<1 || bounds.height<1)return;
 // No non-uniform CSS stretching: 390 logical px always equals the entire canvas width.
 const nextH=Math.max(1,Math.round(W*bounds.height/bounds.width));
 if(canvas.width!==W || canvas.height!==nextH){canvas.width=W;canvas.height=nextH;}
 H=nextH;
 FIELD_TOP=Math.max(129,Math.min(176,H*.26));
 FIELD_BOTTOM=H-116;
 HIT_Y=H-191;
 PAD_Y=H-154;
 FOOTER_Y=H-96;
 ctx.imageSmoothingEnabled=false;
}
const resizeObserver=new ResizeObserver(resizeCanvas);
resizeObserver.observe(canvas);
window.addEventListener('resize',resizeCanvas);
window.visualViewport?.addEventListener('resize',resizeCanvas);
window.visualViewport?.addEventListener('scroll',resizeCanvas);
resizeCanvas();
const audio=document.querySelector('#track');
const errorEl=document.querySelector('#error');
const S={scene:'loading',songs:[],song:null,cover:null,originalCover:null,mode:'normal',chart:null,notes:[],score:0,combo:0,maxCombo:0,perfect:0,great:0,good:0,miss:0,life:100,pressed:new Set(),pointerLanes:new Map(),startTime:0,lastHit:null,particles:[],shake:0,loadedDifficulty:{},result:null,offsetMs:0,volume:.85,loadingMessage:'LOADING ASSETS',pauseFrom:'game',chartsByDiff:{},preparing:false,libraryToken:0};
try { S.offsetMs=Number(localStorage.getItem('vawe.audioOffsetMs')||0)||0; } catch {}
try { S.volume=Math.max(.2,Math.min(1,Number(localStorage.getItem('vawe.volume')||.85))); } catch {}
let clickZones=[];
let lastFrame=performance.now();

function px(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function t(text,x,y,size=16,color=C.white,align='left',shadow=false,bold=true){
 ctx.font=`${bold?'900':'600'} ${size}px ${/[ก-๙]/.test(text)?'Tahoma, sans-serif':'monospace'}`;
 ctx.textAlign=align;ctx.textBaseline='top';
 if(shadow){ctx.fillStyle='#06060c';ctx.fillText(String(text),x+2,y+3);}
 ctx.fillStyle=color;ctx.fillText(String(text),x,y);
}
function line(x,y,w,h,color){px(x,y,w,h,color);}
function panel(x,y,w,h,fill=C.panel,border=C.frame,shadow=true){
 if(shadow)px(x+5,y+6,w,h,'#05060b');
 px(x-2,y+5,w+4,h-10,border);px(x+5,y-2,w-10,h+4,border);px(x+1,y+1,w-2,h-2,fill);
 px(x+5,y+5,w-10,2,'#ffffff19');
}
function button(text,x,y,w,h,action,accent=C.lime,opts={}){
 const active=opts.active!==false;
 px(x+3,y+5,w,h,'#030408');
 px(x,y,w,h,active?accent:'#484c55');
 px(x+6,y+5,w-12,h-11,opts.dark?C.panel:'#10131b');
 px(x+7,y+6,w-14,3,accent);
 if(opts.square)px(x+12,y+h/2-5,10,10,accent);
 t(text,x+w/2,y+(h-(opts.size||17))/2-1,opts.size||17,active?C.white:'#989898','center',true);
 if(active)zone(x,y,w,h,action);
}
function zone(x,y,w,h,fn){
 // Menu click targets use the same transform as the visual elements.
 clickZones.push({x:uiOffsetX+x*uiScale,y:uiOffsetY+y*uiScale,w:w*uiScale,h:h*uiScale,fn});
}
function fmtTime(n){n=Number(n)||0;return `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;}
function alphaColor(color,alpha){ctx.globalAlpha=alpha;}
function drawCover(x,y,w,h,pixel=true){
 const image=pixel?S.cover:S.originalCover;
 if(!image || (image instanceof HTMLImageElement && (!image.complete || !image.naturalWidth))){px(x,y,w,h,'#263028');t('♫',x+w/2,y+h/2-30,64,C.lime,'center');return;}
 ctx.imageSmoothingEnabled=!pixel;
 ctx.drawImage(image,Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h));
 ctx.imageSmoothingEnabled=false;
}
function loadImage(url){if(!url)return Promise.resolve(null);return new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=url;});}
function bg(variant='home',now=0){
 px(0,0,W,H,'#0a0d12');
 // Tiny hard-edged city lights and console scanlines.
 for(let i=0;i<45;i++){
  const x=(i*113+29)%W,y=(i*67+13)%H;
  px(x,y,((i%3)+1)*2,2,i%3===0?'#35442a':'#252a31');
 }
 for(let y=0;y<H;y+=7){px(0,y,W,1,'#10171b');}
 alphaColor('#fff',.24);
 for(let i=0;i<11;i++){
  const x=(i*48+8)%W,top=530+(i*37)%125,ww=25+(i*9)%34;
  px(x,top,ww,H-top,'#233126');
  for(let k=top+20;k<H-8;k+=19){for(let j=x+5;j<x+ww-5;j+=11){if((j+k+i)%4!==0)px(j,k,4,6,'#414e28');}}
 }
 ctx.globalAlpha=1;
 const neon=variant==='game'?C.blue:C.lime;
 px(0,0,6,H,neon+'22');px(W-6,0,6,H,C.orange+'22');
 px(0,H-10,W,10,'#111912');
}
function cornerTag(text,x,y,color=C.lime){px(x,y,7,7,color);t(text,x+13,y-3,11,C.muted);}
function topBar(title,left='◀',right=''){t(left,28,29,22,C.lime);t(title,W/2,30,18,C.white,'center',true);if(right)t(right,360,31,11,C.muted,'right');zone(16,18,55,48,()=>go('home'));px(22,66,346,2,'#424848');}
function chips(x,y,items){let xx=x;for(const [label,color] of items){const width=label.length*8+26;px(xx,y,width,24,'#171c22');px(xx,y,3,24,color);t(label,xx+11,y+5,11,C.white);xx+=width+8;}}
function sceneHome(now){
 bg('home',now);
 px(24,26,6,26,C.orange);t('VAWE',39,24,36,C.lime,'left',true);t('TAP',282,26,35,C.white,'left',true);
 t('P I X E L    R H Y T H M    A R C A D E',W/2,83,11,C.muted,'center');
 px(28,111,334,3,C.lime);
 panel(45,146,300,335,'#1a1d21','#484f52');
 drawCover(59,158,272,272,true);
 px(59,158,92,25,C.lime);t('DEMO #001',69,164,11,C.ink);
 px(59,398,272,32,'#0a0b11da');
 t('รับครับพี่',W/2,401,18,C.white,'center',true);
 t('WACHII  /  130 BPM  /  '+fmtTime(S.song?.duration),W/2,447,12,C.muted,'center');
 t('NEW TRACK LOADED',W/2,499,15,C.orange,'center',true);
 t('HIT THE BEAT. KEEP THE COMBO.',W/2,530,11,C.muted,'center');
 button('▶  START GAME',35,568,320,70,()=>go('songs'),C.lime,{size:24});
 button('⚙  TIMING / SETTINGS',64,657,262,49,()=>go('settings'),C.blue,{size:14});
 t('4 LANES  •  BIG PIXEL NOTES',W/2,742,12,C.white,'center');
 for(let i=0;i<4;i++){px(58+i*73,770,56,36,LANE_COLORS[i]);px(62+i*73,774,48,28,'#131821');t('DFJK'[i],86+i*73,780,16,LANE_COLORS[i],'center');}
 t('v0.1   /   NO LOGIN REQUIRED',W/2,825,10,C.muted,'center');
}
function sceneSongs(now){
 bg('home',now);topBar('SONG SELECT','◀',String(S.songs.indexOf(S.song)+1).padStart(2,'0')+' / '+String(S.songs.length).padStart(2,'0'));
 t('PICK YOUR NEXT TRACK',W/2,96,15,C.lime,'center');
 panel(31,136,328,505,'#191c25','#475042');
 drawCover(49,154,292,292,true);
 px(49,154,100,27,C.orange);t('FEATURED',58,160,11,C.ink);
 t(S.song?.title||'รับครับพี่',W/2,471,28,C.white,'center',true);
 t('by '+(S.song?.artist||'wachii'),W/2,513,15,C.muted,'center');
 px(57,556,276,2,'#43474d');
 t('♫  '+(S.song?.bpm||130)+' BPM',58,572,15,C.lime);
 t('◷  '+fmtTime(S.song?.duration),333,572,15,C.orange,'right');
 if(S.songs.length>1){
  px(42,596,150,48,'#232a33');px(198,596,150,48,'#232a33');
  t('◀  PREV',117,610,16,C.lime,'center');t('NEXT  ▶',273,610,16,C.lime,'center');
  zone(36,590,160,60,()=>changeSong(-1));zone(194,590,160,60,()=>changeSong(1));
 }
 button(S.preparing?'LOADING...':'▶  SELECT TRACK',44,665,302,72,()=>{if(!S.preparing)go('preplay');},C.lime,{size:21,active:!S.preparing});
 t('SWIPE OR ← → TO CHANGE TRACK',W/2,780,11,C.muted,'center');
}
function modeInfo(mode){return {easy:{label:'EASY',desc:'RELAXED • 1-BEAT',color:C.blue},normal:{label:'NORMAL',desc:'GROOVE • HALF-BEAT',color:C.lime},hard:{label:'HARD',desc:'ARCADE • RAPID NOTES',color:C.pink}}[mode];}
function scenePreplay(now){
 bg('home',now);topBar('READY TO PLAY','◀','');
 panel(24,93,342,151,'#161b21','#485443');
 drawCover(39,108,119,119,true);
 t(S.song?.title||'รับครับพี่',177,125,22,C.white,'left',true);
 t(S.song?.artist||'wachii',177,163,14,C.muted);
 t('♫ '+(S.song?.bpm||130)+' BPM',177,191,13,C.lime);
 t('CHOOSE DIFFICULTY',W/2,277,18,C.white,'center',true);
 const all=['easy','normal','hard'];
 all.forEach((mode,i)=>{
  const {label,desc,color}=modeInfo(mode),y=318+i*88,chosen=S.mode===mode;
  panel(32,y,326,72,chosen?'#253027':'#181c24',chosen?color:'#353d47');
  px(43,y+13,12,47,color);
  t(label,73,y+11,21,chosen?color:C.white,'left',true);
  t(desc,73,y+41,11,C.muted);
  t(chosen?'✓':'○',325,y+23,25,color,'center');
  zone(34,y,322,72,()=>{S.mode=mode;S.chart=S.chartsByDiff[mode]||null;});
 });
 t('Large notes  •  D F J K  •  Touch',W/2,617,12,C.muted,'center');
 button('▶  PLAY SONG',36,672,318,68,()=>startGame(),C.lime,{size:22});
 button('⚙ SYNC '+(S.offsetMs>=0?'+':'')+S.offsetMs+'ms',98,762,194,42,()=>go('settings'),C.blue,{size:14});
}
function sceneSettings(now){
 bg('home',now);topBar('TIMING SETTINGS');
 panel(24,118,342,521,'#171b24','#4b525e');
 t('AUDIO OFFSET',W/2,157,21,C.white,'center');
 t('Adjust if notes feel early / late',W/2,197,13,C.muted,'center',false,false);
 panel(80,256,230,88,'#11151d','#50585d');
 t((S.offsetMs>=0?'+':'')+S.offsetMs+' ms',W/2,280,31,C.lime,'center',true);
 button('− 25',46,384,138,67,()=>changeOffset(-25),C.blue,{size:20});
 button('+ 25',205,384,138,67,()=>changeOffset(25),C.orange,{size:20});
 t('NEGATIVE  ◀          ▶  POSITIVE',W/2,475,11,C.muted,'center');
 button('RESET',103,528,184,48,()=>{S.offsetMs=0;saveSettings();},C.pink,{size:17});
 t('Use audio time as source of truth.',W/2,605,11,C.muted,'center');
 button('✓  DONE',51,687,288,68,()=>go('preplay'),C.lime,{size:22});
}
function changeOffset(by){S.offsetMs=Math.min(250,Math.max(-250,S.offsetMs+by));saveSettings();}
function saveSettings(){try{localStorage.setItem('vawe.audioOffsetMs',S.offsetMs.toString());localStorage.setItem('vawe.volume',S.volume.toString());}catch{}}
function drawTinyHeart(x,y,color){px(x+4,y,8,4,color);px(x+15,y,8,4,color);px(x,y+4,27,9,color);px(x+4,y+13,19,4,color);px(x+8,y+17,11,4,color);px(x+12,y+21,3,4,color);}
function gameBackground(now){
 px(0,0,W,H,'#080b10');
 // Dark pixel stage with pixel shimmer and pulsing equalizer lights.
 for(let i=0;i<12;i++){
  const x=20+i*32,pulse=7+(Math.sin(now*0.004+i*0.9)+1)*7;
  px(x,130,8,pulse,i%2?C.darkLime:'#344a54');
 }
 // HUD
 px(0,0,W,120,'#11141e');px(0,118,W,4,C.lime);
 if(S.cover){drawCover(14,16,58,58,true);px(12,14,62,3,C.lime);}
 t('NOW PLAYING',85,15,11,C.lime);t(S.song?.title||'รับครับพี่',85,33,18,C.white);t(S.mode.toUpperCase()+' • '+(S.song?.bpm||130)+' BPM',85,63,11,C.muted);
 t('SCORE',376,15,11,C.muted,'right');t(S.score.toLocaleString('en-US').padStart(7,'0'),376,33,22,C.white,'right',true);
 const progress=audio.duration?audio.currentTime/audio.duration:0;
 px(15,96,360,8,'#303641');px(15,96,Math.round(Math.max(0,Math.min(1,progress))*360),8,C.lime);
 t(fmtTime(audio.currentTime),15,108,9,C.muted);t(fmtTime(audio.duration||S.song?.duration),375,108,9,C.muted,'right');
 // Playfield lane walls
 px(FIELD_X-6,FIELD_TOP-5,FIELD_W+12,FIELD_BOTTOM-FIELD_TOP+8,'#050608');
 for(let i=0;i<LANES;i++){
  const lx=FIELD_X+i*LANE_W;
  px(lx,FIELD_TOP,LANE_W,FIELD_BOTTOM-FIELD_TOP,i%2?'#171a24':'#111621');
  px(lx,FIELD_TOP,2,FIELD_BOTTOM-FIELD_TOP,LANE_COLORS[i]+'4d');
  px(lx+4,FIELD_TOP+15,LANE_W-8,3,LANE_COLORS[i]+'30');
  // Each lane is a full-width tappable region, not just a tiny note target.
  if(S.pressed.has(i)){
   px(lx+3,FIELD_TOP+4,LANE_W-6,FIELD_BOTTOM-FIELD_TOP-8,LANE_COLORS[i]+'22');
   px(lx+3,HIT_Y-24,LANE_W-6,51,LANE_COLORS[i]+'70');
  }
 }
 px(FIELD_X+FIELD_W-2,FIELD_TOP,2,FIELD_BOTTOM-FIELD_TOP,C.pink+'55');
 // Sparse industrial dashed grid line, moving with the soundtrack.
 const currT=effectiveTime();
 const phase=((currT*255)%62+62)%62;
 for(let y=FIELD_TOP-phase;y<HIT_Y;y+=62)if(y>=FIELD_TOP)px(FIELD_X+2,y,FIELD_W-4,1,'#8ca9be12');
 // Judgement line and pixelated light rods.
 px(FIELD_X-8,HIT_Y-7,FIELD_W+16,21,'#7bca5f20');
 px(FIELD_X-8,HIT_Y-4,FIELD_W+16,8,'#e4ff9c');
 px(FIELD_X-8,HIT_Y-2,FIELD_W+16,4,C.lime);
 px(FIELD_X-13,HIT_Y-14,6,29,C.orange);px(FIELD_X+FIELD_W+7,HIT_Y-14,6,29,C.orange);
 // Lane pads
 for(let i=0;i<LANES;i++){
  const x=FIELD_X+i*LANE_W;
  px(x+3,PAD_Y,LANE_W-6,51,'#050609');
  px(x+6,PAD_Y+3,LANE_W-12,45,S.pressed.has(i)?LANE_COLORS[i]:'#262b36');
  px(x+10,PAD_Y+7,LANE_W-20,37,'#10151e');
  t('DFJK'[i],x+LANE_W/2,PAD_Y+12,23,LANE_COLORS[i],'center',true);
 }
 px(0,FOOTER_Y,W,96,'#0f141c');
 for(let i=0;i<4;i++){
  const col=LANE_COLORS[i];px(27+i*87,FOOTER_Y+2,77,3,col);
 }
 t('✦',20,FOOTER_Y+13,20,C.lime);t('ACCURACY',46,FOOTER_Y+15,10,C.muted);
 const total=S.perfect+S.great+S.good+S.miss;
 const accuracy=total?Math.round(100*(S.perfect+S.great*.82+S.good*.55)/total):100;
 t(accuracy+'%',46,FOOTER_Y+33,22,C.white);
 t('LIFE',230,FOOTER_Y+15,10,C.muted);
 const liveColor=S.life<30?C.red:S.life<60?C.orange:C.lime;
 px(231,FOOTER_Y+40,128,15,'#323640');px(234,FOOTER_Y+43,Math.max(0,Math.round((S.life/100)*122)),9,liveColor);
 // Pause zone top left of playback progress track
 px(344,69,31,23,'#343b3b');t('Ⅱ',359,72,16,C.lime,'center');zone(338,60,46,42,()=>pauseGame());
}
const ARROW_UP=['...X...','..XXX..','.XXXXX.','...X...','...X...','...X...','...X...'];
function arrowCell(dir,r,c){
 const [rr,cc]={up:[r,c],left:[c,6-r],down:[6-r,6-c],right:[6-c,r]}[dir];
 return ARROW_UP[rr][cc]==='X';
}
function drawArrow(cx,cy,dir){
 const u=5,x0=Math.round(cx-3.5*u),y0=Math.round(cy-3.5*u);
 for(const [color,o] of [['#ffffff',1],['#0b1322',0]]){
  for(let r=0;r<7;r++)for(let c=0;c<7;c++){
   if(arrowCell(dir,r,c))px(x0+c*u+(o?-1:0),y0+r*u+(o?-1:0),u+(o?2:0),u+(o?2:0),color);
  }
 }
}
function drawNote(x,centerY,lane,type='tap',duration=0,dir=null){
 const y=Math.round(centerY-NOTE_H/2),color=LANE_COLORS[lane],x0=Math.round(x);
 // Large chunky 8-bit note, 86% of lane width. Sharp stepped corners, zero gradients.
 if(type==='hold' && duration>0){
  const len=Math.round(duration*(HIT_Y-FIELD_TOP)/TRAVEL_SECONDS);
  const top=Math.max(FIELD_TOP,centerY-len);
  px(x0+24,top,NOTE_W-48,centerY-top,color+'9c');
  px(x0+29,top,NOTE_W-58,centerY-top,'#101721');
 }
 px(x0+5,y+10,NOTE_W-10,NOTE_H-2,'#03040a');
 px(x0+6,y-3,NOTE_W-12,NOTE_H+6,'#040609');
 px(x0,y+5,NOTE_W,NOTE_H-10,'#05060a');
 px(x0+5,y,NOTE_W-10,NOTE_H,color);
 px(x0,y+5,NOTE_W,NOTE_H-10,color);
 px(x0+4,y+7,NOTE_W-8,12,'#e9faff85');
 px(x0+5,y+25,NOTE_W-10,NOTE_H-31,'#10152150');
 px(x0+11,y+13,12,9,'#ffffffbb');
 px(x0+26,y+13,8,9,'#ffffff66');
 px(x0+NOTE_W-15,y+13,5,9,'#06070955');
 // Two black pixels in the right corner act as an arcade icon.
 px(x0+NOTE_W-21,y+31,6,7,'#0b1322');
 px(x0+NOTE_W-14,y+31,6,7,'#0b1322');
 px(x0+8,y+NOTE_H-7,NOTE_W-16,5,'#00000066');
 if(type==='swipe'&&dir)drawArrow(x0+NOTE_W/2,y+NOTE_H/2,dir);
}
function drawNotes(){
 if(!S.notes.length)return;
 const ct=effectiveTime();
 for(const n of S.notes){
  if(n.status!=='pending'&&n.status!=='holding')continue;
  const delta=n.time-ct;
  if(delta>TRAVEL_SECONDS+.14)continue;
  if(delta<-.3 && n.status!=='holding')continue;
  const mid=HIT_Y-delta*(HIT_Y-FIELD_TOP+31)/TRAVEL_SECONDS;
  if(mid>FIELD_BOTTOM+50 || mid<FIELD_TOP-75)continue;
  const x=FIELD_X+n.lane*LANE_W+(LANE_W-NOTE_W)/2;
  drawNote(x,mid,n.lane,n.type,n.duration,n.dir);
 }
}
function drawFeedback(now){
 if(S.combo>=2){
  t('COMBO',W/2,139,13,C.white,'center',true);
  t(String(S.combo),W/2,157,35,C.lime,'center',true);
 }
 if(S.lastHit && now-S.lastHit.when<750){
  const k=(now-S.lastHit.when)/750;
  const label=S.lastHit.label;
  const color=label==='PERFECT'?C.lime:label==='GREAT'?C.blue:label==='GOOD'?C.orange:C.red;
  ctx.globalAlpha=1-k*.8;
  t(label,W/2,260-k*28,29,color,'center',true);
  ctx.globalAlpha=1;
 }
 for(const p of S.particles){
  const elapsed=(now-p.born)/p.life;
  if(elapsed>=1)continue;
  ctx.globalAlpha=Math.max(0,1-elapsed);
  px(p.x+p.vx*elapsed,p.y+p.vy*elapsed+30*elapsed*elapsed,p.size,p.size,p.color);
 }
 ctx.globalAlpha=1;
}
function sceneGame(now){
 gameBackground(now);
 ctx.save();if(S.shake>0)ctx.translate(Math.round((Math.random()-.5)*S.shake),Math.round((Math.random()-.5)*S.shake));
 drawNotes();ctx.restore();drawFeedback(now);
}
function scenePause(now){
 sceneGame(now);px(0,0,W,H,'#06080bdd');
 withMenuLayout(()=>{
 panel(37,246,316,348,'#171d23',C.lime);
 t('Ⅱ',W/2,270,39,C.orange,'center');
 t('PAUSED',W/2,327,28,C.white,'center',true);
 t('STAY IN THE GROOVE',W/2,367,12,C.muted,'center');
 button('▶  RESUME',63,414,264,58,()=>resumeGame(),C.lime,{size:20});
 button('↻  RESTART',63,485,264,47,()=>startGame(),C.blue,{size:18});
 button('⌂  EXIT',63,545,264,47,()=>exitGame(),C.orange,{size:18});
 });
}
function grade(){
 const n=S.perfect+S.great+S.good+S.miss;
 const accuracy=n?(S.perfect+S.great*.82+S.good*.55)/n*100:0;
 return {accuracy,letter:accuracy>=97?'S':accuracy>=89?'A':accuracy>=78?'B':accuracy>=65?'C':'D'};
}
function sceneResults(now){
 bg('home',now);
 t('TRACK COMPLETE',W/2,45,19,C.lime,'center',true);
 panel(31,111,328,522,'#1a1d27','#49554c');
 const {letter,accuracy}=grade();
 t('RANK',W/2,138,15,C.muted,'center');
 t(letter,W/2,170,122,letter==='S'?C.lime:letter==='A'?C.blue:C.orange,'center',true);
 t('FINAL SCORE',W/2,327,15,C.muted,'center');
 t(S.score.toLocaleString('en-US'),W/2,351,35,C.white,'center',true);
 px(56,421,278,2,'#3f4850');
 const data=[['ACCURACY',accuracy.toFixed(1)+'%'],['MAX COMBO',String(S.maxCombo)],['PERFECT',String(S.perfect)],['GREAT / GOOD',S.great+' / '+S.good],['MISS',String(S.miss)]];
 data.forEach(([label,val],i)=>{t(label,57,439+i*36,13,C.muted);t(val,328,439+i*36,14,i===4?C.red:C.white,'right');});
 button('↻  PLAY AGAIN',43,662,304,61,()=>startGame(),C.lime,{size:20});
 button('⌂  SONG SELECT',60,743,270,48,()=>go('songs'),C.blue,{size:16});
}
function sceneLoading(){bg();t('VAWE TAP',W/2,286,41,C.lime,'center',true);t(S.loadingMessage,W/2,361,14,C.white,'center');t('■■■■■■■□□□□□',W/2,405,21,C.lime,'center');t('INITIALIZING PIXEL ARCADE',W/2,448,12,C.muted,'center');}
// The original art board is 390×844, but iPhone browser chrome leaves far less
// vertical space. Draw compact layouts at 390 logical units across FULL width;
// NEVER scale the entire art board down and center it with horizontal gutters.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
// v0.4: Each menu scene uses the ACTUAL logical viewport height (H).
// Components flow from the top and from the bottom, with measured non-overlapping blocks.
// Short mobile viewports can vertically scroll as a last resort; no page-wide scaling.
const SMALL_LABEL='P I X E L  R H Y T H M  A R C A D E';
function compactHeader(title,right=''){
 t('◀',22,18,23,C.lime);
 t(title,W/2,21,18,C.white,'center',true);
 if(right)t(right,370,27,10,C.muted,'right');
 px(19,62,W-38,2,'#42494b');zone(9,7,52,52,()=>go('home'));
}
// ── Home cover slideshow: covers slide and loop forever; START GAME plays the visible song ──
const SLIDE_MS=3200, SLIDE_ANIM=450;
const slide={idx:0,from:0,dir:1,t0:0};
const arts={}; // songId -> pixelated cover
function slideTo(i,dir,now=performance.now()){
 const n=S.songs.length;if(n<1)return;
 slide.from=slide.idx;slide.idx=(i+n)%n;slide.dir=dir;slide.t0=now;
}
function syncSlideToSong(){const i=S.songs.indexOf(S.song);if(i>=0){slide.idx=slide.from=i;slide.t0=performance.now();}}
function drawArt(img,x,y,w,h){
 if(!img){px(x,y,w,h,'#263028');t('♫',x+w/2,y+h/2-30,64,C.lime,'center');return;}
 ctx.imageSmoothingEnabled=false;ctx.drawImage(img,Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
}
function artOf(song){return arts[song.id]||(song===S.song?S.cover:null);}
function drawSlideshow(x,y,w,now){
 const n=S.songs.length;if(!n)return null;
 if(n>1&&now-slide.t0>SLIDE_MS)slideTo(slide.idx+1,1,now);
 const p=Math.min(1,(now-slide.t0)/SLIDE_ANIM),e=p*p*(3-2*p);
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,w);ctx.clip();
 if(p<1&&slide.from!==slide.idx){
  drawArt(artOf(S.songs[slide.from]),x-slide.dir*e*w,y,w,w);
  drawArt(artOf(S.songs[slide.idx]),x+slide.dir*(1-e)*w,y,w,w);
 }else drawArt(artOf(S.songs[slide.idx]),x,y,w,w);
 ctx.restore();
 // page dots
 if(n>1){const gap=14,x0=x+w/2-((n-1)*gap)/2;for(let i=0;i<n;i++){px(x0+i*gap-4,y+w-16,8,8,i===slide.idx?C.lime:'#ffffff55');}}
 return S.songs[p>=.5?slide.idx:slide.from];
}
function startFromHome(){
 const song=S.songs[slide.idx];
 if(song&&song!==S.song)prepareSong(song);
 go('songs');
}
function compactHome(now){
 bg('home',now);
 t('VAWE',24,14,36,C.lime,'left',true);
 t('TAP',W-24,15,34,C.white,'right',true);
 t(SMALL_LABEL,W/2,64,10,C.muted,'center');
 px(24,90,342,3,C.lime);
 const settingsY=H-57, startY=settingsY-72, taglineY=startY-30;
 const upper=105,bottom=taglineY-20,available=bottom-upper;
 const cover=Math.min(315,Math.max(165,available-72));
 const cardH=cover+68;
 const cardY=upper+Math.max(0,(available-cardH)/2);
 const coverY=cardY+10,coverX=(W-cover)/2;
 panel(27,cardY,336,cardH,'#191d22','#464e4e');
 const shown=drawSlideshow(coverX,coverY,cover,now)||S.song;
 px(coverX,coverY,118,23,C.lime);t('TRACK '+String(slide.idx+1).padStart(2,'0')+'/'+String(S.songs.length).padStart(2,'0'),coverX+9,coverY+5,10,C.ink);
 const titleY=coverY+cover+11;
 t(shown?.title||'',W/2,titleY,21,C.white,'center',true);
 t((shown?.artist||'').toUpperCase()+'  •  '+(shown?.bpm||0)+' BPM  •  '+fmtTime(shown?.duration),W/2,titleY+30,11,C.muted,'center');
 t('HIT THE BEAT. KEEP THE COMBO.',W/2,taglineY,12,C.orange,'center');
 button('▶  START GAME',25,startY,340,56,startFromHome,C.lime,{size:21});
 button('⚙  TIMING / SETTINGS',55,settingsY,280,43,()=>go('settings'),C.blue,{size:15});
}
function compactSongs(now){
 bg('home',now);
 compactHeader('SONG SELECT',String(S.songs.indexOf(S.song)+1).padStart(2,'0')+' / '+String(S.songs.length).padStart(2,'0'));
 t('PICK YOUR NEXT TRACK',W/2,80,15,C.lime,'center');
 const btnY=H-72,areaTop=108,areaBottom=btnY-15;
 const cardH=Math.min(470,areaBottom-areaTop);
 const cardY=areaTop+Math.max(0,(areaBottom-areaTop-cardH)/2),cardBottom=cardY+cardH;
 panel(22,cardY,346,cardH,'#191d25','#485148');
 const cover=Math.min(280,Math.max(156,cardH-142)),coverY=cardY+12,coverX=(W-cover)/2;
 drawCover(coverX,coverY,cover,cover,true);
 px(coverX,coverY,95,23,C.orange);t('FEATURED',coverX+8,coverY+5,10,C.ink);
 const titleY=coverY+cover+12;
 t(S.song?.title||'รับครับพี่',W/2,titleY,24,C.white,'center',true);
 t('by '+(S.song?.artist||'wachii'),W/2,titleY+33,12,C.muted,'center');
 const statsY=cardBottom-33;
 px(42,statsY-12,306,2,'#434b52');
 t('♫ '+(S.song?.bpm||130)+' BPM',43,statsY,14,C.lime);
 t('◷ '+fmtTime(S.song?.duration),348,statsY,14,C.orange,'right');
 if(S.songs.length>1){
   // Large tap targets (also: swipe the card left/right, or use ← → keys).
   px(30,statsY-62,150,44,'#232a33');px(210,statsY-62,150,44,'#232a33');
   t('◀  PREV',105,statsY-50,15,C.lime,'center');t('NEXT  ▶',285,statsY-50,15,C.lime,'center');
   zone(22,statsY-70,172,60,()=>changeSong(-1));zone(196,statsY-70,172,60,()=>changeSong(1));
 }
 button(S.preparing?'LOADING...':'▶  SELECT TRACK',25,btnY,340,56,()=>{if(!S.preparing)go('preplay')},C.lime,{size:19,active:!S.preparing});
}
function compactPreplay(now){
 bg('home',now);compactHeader('READY TO PLAY');
 const top=81,boxH=105,cover=86;
 panel(20,top,350,boxH,'#171c23','#495349');
 drawCover(31,top+9,cover,cover,true);
 t(S.song?.title||'รับครับพี่',131,top+14,21,C.white,'left',true);
 t(S.song?.artist||'wachii',131,top+48,13,C.muted);
 t('♫ '+(S.song?.bpm||130)+' BPM',131,top+75,12,C.lime);
 t('CHOOSE DIFFICULTY',W/2,205,17,C.white,'center',true);
 const baseStart=242,gap=10,playY=H-67,syncY=playY-43;
 const cardH=Math.min(76,Math.max(45,Math.floor((syncY-14-baseStart-2*gap)/3)));
 const groupH=3*cardH+2*gap;
 const cardStart=baseStart+Math.max(0,(syncY-14-baseStart-groupH)/2);
 ['easy','normal','hard'].forEach((mode,i)=>{
   const info=modeInfo(mode),y=cardStart+i*(cardH+gap),active=S.mode===mode;
   panel(27,y,336,cardH,active?'#243026':'#191e27',active?info.color:'#38434a',false);
   px(36,y+8,9,cardH-16,info.color);
   t(info.label,60,y+6,Math.min(20,Math.max(17,cardH*.33)),active?info.color:C.white,'left',true);
   t(info.desc,60,y+cardH-19,10,C.muted);
   t(active?'✓':'○',337,y+cardH/2-12,23,info.color,'center');
   zone(28,y,335,cardH,()=>{S.mode=mode;S.chart=S.chartsByDiff[mode]||null});
 });
 button('⚙ SYNC '+(S.offsetMs>=0?'+':'')+S.offsetMs+'ms',96,syncY,198,34,()=>go('settings'),C.blue,{size:12});
 button('▶  PLAY SONG',25,playY,340,56,()=>startGame(),C.lime,{size:21});
}
function compactSettings(now){
 bg('home',now);compactHeader('TIMING SETTINGS');
 const btnY=H-69;
 panel(23,82,344,btnY-95,'#171c24','#465054');
 t('AUDIO OFFSET',W/2,102,20,C.white,'center',true);
 t('ADJUST NOTE / AUDIO TIMING',W/2,144,12,C.muted,'center');
 panel(79,191,232,70,'#0e131b','#4c575c');
 t((S.offsetMs>=0?'+':'')+S.offsetMs+' ms',W/2,210,28,C.lime,'center',true);
 button('− 25',30,283,158,51,()=>changeOffset(-25),C.blue,{size:20});
 button('+ 25',202,283,158,51,()=>changeOffset(25),C.orange,{size:20});
 t('NEGATIVE ◀  ▶ POSITIVE',W/2,349,12,C.muted,'center');
 button('RESET',93,383,204,44,()=>{S.offsetMs=0;saveSettings()},C.pink,{size:17});
 t('Song audio is the source of truth.',W/2,Math.max(450,btnY-31),11,C.muted,'center');
 button('✓  DONE',32,btnY,326,58,()=>go('preplay'),C.lime,{size:21});
}
function compactResults(now){
 bg('home',now);
 const failed=S.scene==='gameover';
 t(failed?'GAME OVER':'TRACK COMPLETE',W/2,23,20,failed?C.red:C.lime,'center',true);
 const btnY=H-118,cardY=69,cardBottom=btnY-14;
 panel(22,cardY,346,cardBottom-cardY,'#191d25',failed?C.red:'#475148');
 const {letter,accuracy}=grade();
 t(failed?'LIFE DEPLETED':'RANK',W/2,cardY+13,13,failed?C.red:C.muted,'center');
 t(failed?'F':letter,W/2,cardY+32,76,failed?C.red:letter==='S'?C.lime:letter==='A'?C.blue:C.orange,'center',true);
 const scoreY=cardY+136;
 t('FINAL SCORE',W/2,scoreY,13,C.muted,'center');
 t(S.score.toLocaleString('en-US'),W/2,scoreY+21,28,C.white,'center',true);
 px(43,scoreY+64,304,2,'#42494c');
 const data=[['ACCURACY',accuracy.toFixed(1)+'%'],['MAX COMBO',String(S.maxCombo)],['PERFECT',String(S.perfect)],['GREAT / GOOD',S.great+' / '+S.good],['MISS',String(S.miss)]];
 const rowsStart=scoreY+78,rowH=Math.max(23,Math.min(29,(cardBottom-rowsStart-10)/5));
 data.forEach(([label,v],i)=>{t(label,43,rowsStart+i*rowH,12,C.muted);t(v,346,rowsStart+i*rowH,14,i===4?C.red:C.white,'right')});
 button('↻  PLAY AGAIN',27,btnY,336,54,()=>startGame(),C.lime,{size:20});
 button('⌂  SONG SELECT',57,H-54,276,41,()=>go('songs'),C.blue,{size:16});
}
function compactPause(now){
 sceneGame(now);px(0,0,W,H,'#06080bdd');
 const dialogH=360,dy=Math.round((H-dialogH)/2);
 panel(31,dy,328,dialogH,'#171d23',C.lime);
 t('Ⅱ',W/2,dy+18,37,C.orange,'center');
 t('PAUSED',W/2,dy+68,27,C.white,'center',true);
 t('STAY IN THE GROOVE',W/2,dy+106,12,C.muted,'center');
 button('▶  RESUME',52,dy+150,286,57,()=>resumeGame(),C.lime,{size:21});
 button('↻  RESTART',52,dy+218,286,47,()=>startGame(),C.blue,{size:18});
 button('⌂  EXIT',52,dy+277,286,47,()=>exitGame(),C.orange,{size:18});
}
function compactLoading(){bg();t('VAWE TAP',W/2,H*.32,38,C.lime,'center',true);t(S.loadingMessage,W/2,H*.44,13,C.white,'center');}
// Legacy artboard layout for unusually tall displays; short screens use compact scenes.

function withMenuLayout(callback){
 const realH=H;
 const scale=Math.min(1,(realH-12)/MENU_H);
 uiScale=scale;
 uiOffsetX=(W-W*scale)/2;
 uiOffsetY=(realH-MENU_H*scale)/2;
 ctx.save();
 ctx.translate(uiOffsetX,uiOffsetY);ctx.scale(scale,scale);
 H=MENU_H;
 try{callback();}
 finally{
  H=realH;ctx.restore();uiScale=1;uiOffsetX=0;uiOffsetY=0;
 }
}
function draw(now){
 clickZones=[];
 px(0,0,W,H,'#0a0d12');
 uiScale=1;uiOffsetX=0;uiOffsetY=0;
 const playing=S.scene==='game'||S.scene==='pause';
 document.body.classList.toggle('is-playing',playing);
 if(S.scene==='game')sceneGame(now);
 else if(S.scene==='pause')compactPause(now);
 else if(S.scene==='loading')compactLoading();
 else if(S.scene==='home')compactHome(now);
 else if(S.scene==='songs')compactSongs(now);
 else if(S.scene==='preplay')compactPreplay(now);
 else if(S.scene==='settings')compactSettings(now);
 else if(S.scene==='results'||S.scene==='gameover')compactResults(now);
}
function tick(now){
 const dt=Math.min(100,now-lastFrame);lastFrame=now;
 if(S.scene==='game')updateGame(now);
 if(S.scene!=='songs'&&!previewAudio.paused)stopPreview();
 S.shake=Math.max(0,S.shake-dt*.18);
 S.particles=S.particles.filter(p=>now-p.born<p.life);
 draw(now);requestAnimationFrame(tick);
}
// ── 15s song preview on the song-select screen ──
const previewAudio=new Audio();previewAudio.loop=true;previewAudio.preload='auto';
let previewSongId=null;
function playPreview(song){
 if(!song||S.scene!=='songs')return;
 if(previewSongId===song.id&&!previewAudio.paused)return;
 previewSongId=song.id;
 // Older songs have no cut preview yet: fall back to the start of the full track.
 const src=song.previewUrl||song.audioUrl;
 if(previewAudio.src!==src)previewAudio.src=src;
 previewAudio.currentTime=0;previewAudio.volume=Math.min(1,S.volume*.9);
 const started=previewAudio.play();
 if(started&&started.catch)started.catch(()=>{previewSongId=null;}); // blocked until a user gesture: retried on next interaction
}
function stopPreview(){if(!previewAudio.paused)previewAudio.pause();previewSongId=null;}
function go(scene){if(scene==='songs')setTimeout(()=>playPreview(S.song),0);else stopPreview();if(scene==='home')syncSlideToSong();if(S.scene==='game'&&scene!=='pause')audio.pause();S.scene=scene;}
function effectiveTime(){return audio.currentTime+S.offsetMs/1000;}
function resetRun(){
 S.notes=S.chart.notes.map(n=>({...n,status:'pending',hitGrade:null}));
 S.score=0;S.combo=0;S.maxCombo=0;S.perfect=0;S.great=0;S.good=0;S.miss=0;S.life=100;S.result=null;S.lastHit=null;S.particles=[];S.shake=0;S.pressed.clear();S.pointerLanes.clear();
}
function startGame(){
 // Chart is preloaded before a screen is shown. audio.play() is called directly
 // from the button event, preserving iOS/Safari's required user gesture.
 S.chart=S.chartsByDiff[S.mode]||null;
 if(!S.song||!S.chart){showError(new Error('ยังโหลดเพลงหรือ Beat Chart ไม่เสร็จ'));return;}
 resetRun();audio.pause();audio.currentTime=0;audio.volume=S.volume;
 S.scene='game';
 audio.play().catch(()=>{S.scene='preplay';showError(new Error('เปิดเสียงไม่ได้ กรุณากด PLAY อีกครั้ง หรือเปิดผ่าน localhost / HTTPS'));});
}

function pauseGame(){if(S.scene!=='game')return;audio.pause();S.scene='pause';S.pressed.clear();}
async function resumeGame(){S.scene='game';try{await audio.play();}catch(error){showError(error);}}
function exitGame(){audio.pause();audio.currentTime=0;S.pressed.clear();go('songs');}
function finishGame(){
 if(S.scene!=='game')return;
 if(S.life<=0){failGame();return;}
 audio.pause();S.pressed.clear();S.pointerLanes.clear();
 // Count any missed notes after song ends, including all notes not reached by player.
 for(const n of S.notes)if(n.status==='pending'){n.status='miss';S.miss++;}
 S.result={score:S.score,combo:S.maxCombo,grade:grade(),failed:false};S.scene='results';
}
function failGame(){
 // One-way transition: stop the soundtrack, all note updates and input on this frame.
 if(S.scene!=='game'||S.life>0)return;
 S.life=0;
 audio.pause();
 S.pressed.clear();S.pointerLanes.clear();
 S.result={score:S.score,combo:S.maxCombo,grade:grade(),failed:true};
 S.scene='gameover';
}
function showError(error){console.error(error);errorEl.hidden=false;errorEl.textContent=error.message||String(error);setTimeout(()=>{errorEl.hidden=true;},6500);}
function emitParticles(lane,grade){
 const now=performance.now(),center=FIELD_X+(lane+.5)*LANE_W;
 for(let i=0;i<17;i++){
  S.particles.push({x:center,y:HIT_Y,vx:(Math.random()-.5)*160,vy:-20-Math.random()*130,size:3+Math.round(Math.random()*7),life:350+Math.random()*300,born:now,color:grade==='miss'?C.red:LANE_COLORS[lane]});
 }
}
function reward(n,label,lane){
 n.hitGrade=label;
 if(label==='PERFECT'){S.perfect++;S.score+=300;S.life=Math.min(100,S.life+1.5);}
 if(label==='GREAT'){S.great++;S.score+=190;S.life=Math.min(100,S.life+.8);}
 if(label==='GOOD'){S.good++;S.score+=95;}
 S.combo++;S.maxCombo=Math.max(S.combo,S.maxCombo);
 S.score+=Math.min(180,Math.floor(S.combo/10)*8);
 S.shake=label==='PERFECT'?5:2;
 S.lastHit={label,when:performance.now()};
 emitParticles(lane,label);
 if(n.type==='hold'&&n.duration>0){n.status='holding';} else {n.status='hit';}
 if(navigator.vibrate)try{navigator.vibrate(12);}catch{}
}
function miss(n){
 if(S.scene!=='game'||n.status!=='pending')return;
 n.status='miss';S.miss++;S.life=Math.max(0,S.life-3.5);S.combo=0;
 S.lastHit={label:'MISS',when:performance.now()};
 if(S.life<=0)failGame();
}
function updateGame(now){
 if(S.scene!=='game')return;
 if(S.life<=0){failGame();return;}
 const tnow=effectiveTime();
 for(const n of S.notes){
  if(n.status==='pending' && n.time<tnow-JUDGE_WINDOWS.good)miss(n);
  // A miss may end the run. Don't process further notes after that transition.
  if(S.scene!=='game')return;
  if(n.status==='holding' && tnow>=n.time+n.duration-.06){n.status='hit';S.score+=100;emitParticles(n.lane,'PERFECT');}
 }
 if(audio.ended || (audio.duration && audio.currentTime>=audio.duration-.035))finishGame();
}
function hitLane(lane){
 if(S.scene!=='game')return;
 S.pressed.add(lane);
 const when=effectiveTime();
 let nearest=null,closest=Infinity;
 for(const n of S.notes){
  if(n.lane!==lane || n.status!=='pending' || n.type==='swipe')continue;
  const d=Math.abs(when-n.time);
  if(d<closest){closest=d;nearest=n;}
 }
 if(nearest && closest<=JUDGE_WINDOWS.good){
  const label=closest<=JUDGE_WINDOWS.perfect?'PERFECT':closest<=JUDGE_WINDOWS.great?'GREAT':'GOOD';
  reward(nearest,label,lane);
 }else{S.shake=1.5;}
}
// Swipe notes: judged when a gesture (or arrow key) in the note's direction lands near its time.
const SWIPE_MIN_PX=26;
function hitSwipe(dir,lanes){
 if(S.scene!=='game')return false;
 const when=effectiveTime();
 let nearest=null,closest=Infinity;
 for(const n of S.notes){
  if(n.type!=='swipe'||n.status!=='pending'||n.dir!==dir)continue;
  if(lanes&&!lanes.includes(n.lane))continue;
  const d=Math.abs(when-n.time);
  if(d<closest){closest=d;nearest=n;}
 }
 if(nearest&&closest<=JUDGE_WINDOWS.good+.06){
  const label=closest<=JUDGE_WINDOWS.great?'PERFECT':closest<=JUDGE_WINDOWS.good?'GREAT':'GOOD';
  reward(nearest,label,nearest.lane);
  return true;
 }
 S.shake=1.5;return false;
}
function laneAt(x){return Math.min(3,Math.max(0,Math.floor((x-FIELD_X)/LANE_W)));}
function releaseLane(lane){
 S.pressed.delete(lane);
 if(S.scene!=='game')return;
 const now=effectiveTime();
 for(const n of S.notes){
  if(n.lane===lane && n.status==='holding' && now<n.time+n.duration-.15){
    n.status='miss';S.combo=0;S.miss++;S.life=Math.max(0,S.life-3);
    S.lastHit={label:'MISS',when:performance.now()};
    if(S.life<=0){failGame();return;}
  }
 }
}
function coords(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};}
function inField(x,y){return x>=FIELD_X-6 && x<FIELD_X+FIELD_W+6 && y>=FIELD_TOP && y<FOOTER_Y;}
const pendingMenuTaps=new Map();
const swipeStarts=new Map();
canvas.addEventListener('pointermove',ev=>{
 const st=swipeStarts.get(ev.pointerId);
 if(!st||st.done||S.scene!=='game')return;
 const {x,y}=coords(ev);
 const dx=x-st.x,dy=y-st.y;
 if(Math.hypot(dx,dy)<SWIPE_MIN_PX)return;
 st.done=true;
 const dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
 hitSwipe(dir,[...new Set([st.lane,laneAt(x)])]);
});
canvas.addEventListener('pointerdown',ev=>{
 const {x,y}=coords(ev);
 if(S.scene==='game' && inField(x,y)){
  ev.preventDefault();
  const lane=Math.min(3,Math.max(0,Math.floor((x-FIELD_X)/LANE_W)));
  S.pointerLanes.set(ev.pointerId,lane);swipeStarts.set(ev.pointerId,{x,y,lane,done:false});hitLane(lane);
  try{canvas.setPointerCapture(ev.pointerId);}catch{}
  return;
 }
 if(S.scene==='game'||S.scene==='pause')ev.preventDefault();
 pendingMenuTaps.set(ev.pointerId,{x,y});
});
function pointerRelease(ev){
 swipeStarts.delete(ev.pointerId);
 const lane=S.pointerLanes.get(ev.pointerId);
 if(lane!==undefined){S.pointerLanes.delete(ev.pointerId);releaseLane(lane);return;}
 const initial=pendingMenuTaps.get(ev.pointerId);
 pendingMenuTaps.delete(ev.pointerId);
 if(!initial)return;
 const {x,y}=coords(ev);
 const mdx=x-initial.x,mdy=y-initial.y;
 if(S.scene==='home'&&Math.abs(mdx)>40&&Math.abs(mdx)>Math.abs(mdy)*1.5){slideTo(slide.idx+(mdx<0?1:-1),mdx<0?1:-1);return;}
 if(S.scene==='songs'&&Math.abs(mdx)>40&&Math.abs(mdx)>Math.abs(mdy)*1.5){changeSong(mdx<0?1:-1);return;}
 if(Math.hypot(mdx,mdy)>13)return;
 for(let i=clickZones.length-1;i>=0;i--){
  const z=clickZones[i];
  if(x>=z.x && x<=z.x+z.w && y>=z.y && y<=z.y+z.h){z.fn();break;}
 }
}
canvas.addEventListener('pointerup',pointerRelease);
canvas.addEventListener('pointercancel',ev=>{
 swipeStarts.delete(ev.pointerId);
 const lane=S.pointerLanes.get(ev.pointerId);
 if(lane!==undefined){S.pointerLanes.delete(ev.pointerId);releaseLane(lane);}
 pendingMenuTaps.delete(ev.pointerId);
});
const keys=['KeyD','KeyF','KeyJ','KeyK'];
const arrowKeys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
window.addEventListener('keydown',e=>{
 if(S.scene==='home'&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){e.preventDefault();const d=e.code==='ArrowRight'?1:-1;slideTo(slide.idx+d,d);return;}
 if(S.scene==='songs'&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){e.preventDefault();changeSong(e.code==='ArrowRight'?1:-1);return;}
 if(arrowKeys[e.code]&&S.scene==='game'){e.preventDefault();if(!e.repeat)hitSwipe(arrowKeys[e.code]);return;}
 if(keys.includes(e.code)){
  e.preventDefault();if(!e.repeat)hitLane(keys.indexOf(e.code));return;
 }
 if(e.code==='Escape'||e.code==='Space'){
  if(['game','pause'].includes(S.scene)){e.preventDefault();S.scene==='game'?pauseGame():resumeGame();}
 }
 if(e.code==='Enter' && !e.repeat){if(S.scene==='home')startFromHome();else if(S.scene==='songs')go('preplay');else if(S.scene==='preplay')startGame();else if(S.scene==='results'||S.scene==='gameover')startGame();}
});
window.addEventListener('keyup',e=>{if(keys.includes(e.code))releaseLane(keys.indexOf(e.code));});
window.addEventListener('blur',()=>{if(S.scene==='game')pauseGame();stopPreview();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&S.scene==='game')pauseGame();});
audio.addEventListener('ended',()=>finishGame());
audio.addEventListener('error',()=>{if(S.scene==='game')showError(new Error('ไม่สามารถโหลดไฟล์เสียงได้ เพลงอาจถูกถอดออกหรือเครือข่ายมีปัญหา'));});
// Cover art comes from the CDN at full size: downsample it so it keeps the pixel-art look.
function pixelate(image,size=160){
 if(!image)return null;
 try{const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.drawImage(image,0,0,size,size);return c;}catch{return image;}
}
async function prepareSong(song){
 const token=++S.libraryToken;
 S.song=song;S.preparing=true;S.chart=null;S.chartsByDiff={};
 try {
  const [pixelCover,originalCover,charts]=await Promise.all([
   loadImage(song.pixelCoverUrl).then(pixelate),loadImage(song.coverUrl),
   Promise.all(['easy','normal','hard'].map(d=>getChart(song,d)))
  ]);
  if(token!==S.libraryToken){S.preparing=false;return;}
  S.cover=pixelCover;S.originalCover=originalCover;
  S.chartsByDiff={easy:charts[0],normal:charts[1],hard:charts[2]};
  S.chart=S.chartsByDiff[S.mode];
  audio.pause();audio.src=song.audioUrl;audio.load();audio.volume=S.volume;
  S.preparing=false;
 } catch(error) {
  S.preparing=false;showError(error);
 }
}
async function changeSong(delta){
 if(S.preparing||S.songs.length<2)return;
 const index=S.songs.indexOf(S.song);
 const next=S.songs[(index+delta+S.songs.length)%S.songs.length];
 playPreview(next);
 await prepareSong(next);
}
async function boot(){
 try {
  S.songs=await getSongLibrary();
  await prepareSong(S.songs[0]);
  if(!S.chart)throw new Error('ไม่พบ Beat Chart ของเพลงแรก');
  S.songs.forEach(sg=>loadImage(sg.coverUrl).then(img=>{if(img)arts[sg.id]=pixelate(img);}));
  syncSlideToSong();
  S.scene='home';
 }catch(error){showError(new Error('เริ่มเกมไม่สำเร็จ: '+error.message+''));S.loadingMessage='CANNOT LOAD SONG';}
}

requestAnimationFrame(tick);
boot();

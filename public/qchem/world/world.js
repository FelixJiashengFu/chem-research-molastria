/* 游乐场 20「量子世界」的画面与交互（WebGL2）。原作是站长 Fe 的单文件页（2026-11-10）；物理在 world-models.js。
   相对原作的改动：物理拆成纯函数并加了测试；势垒按整数个格点取宽度（原来两端各多半格）；中英两版文字；
   浅色主题（合成时把发光点画成纸上的墨点）；嵌在游乐场里时滚轮只在点过画面后才缩放，不在屏幕上时暂停。 */
(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const W=window.MOLASTRIA_WORLD, root=document.documentElement, EN=root.lang==='en', EMBED=root.dataset.embed==='1';
const L=(zh,en)=>EN?en:zh;
document.title=L('量子世界 · MolAstria 游乐场','Quantum world · MolAstria Playground');
if(EN){
  for(const el of $$('[data-en]'))el.innerHTML=el.dataset.en;
  for(const el of $$('[data-en-aria]'))el.setAttribute('aria-label',el.dataset.enAria);
  for(const el of $$('[data-en-title]'))el.title=el.dataset.enTitle;
}
$('#hint').textContent=EMBED?L('拖动旋转 · 点一下画面后滚轮缩放 · 数字键 1–5 切换','Drag to turn · click the scene, then scroll to zoom · keys 1–5 switch'):L('拖动旋转 · 滚轮缩放 · 数字键 1–5 切换','Drag to turn · scroll to zoom · keys 1–5 switch');
// 主题：跟站点（chemhub-theme，没存就跟系统），站点换了主题时 storage 事件会到这里
const mq=matchMedia('(prefers-color-scheme: dark)');
function isLight(){const t=root.dataset.theme;return t==='light'||(t!=='dark'&&!mq.matches)}
let light=isLight(),redrawChart=null;
const css=(n)=>getComputedStyle(root).getPropertyValue(n).trim();
function themeChanged(){light=isLight();if(redrawChart)redrawChart()}
addEventListener('storage',e=>{if(e.key==='chemhub-theme'){const t=e.newValue;if(t==='dark'||t==='light')root.dataset.theme=t;else delete root.dataset.theme;themeChanged()}});
mq.addEventListener?.('change',themeChanged);
addEventListener('message',e=>{if(e.origin!==location.origin||!e.data||e.data.molastriaWorld==null)return;const m=e.data.molastriaWorld;
  if(m==='pause')setRun('host',false);else if(m==='resume')setRun('host',true);
  else if(m==='dark'||m==='light'){root.dataset.theme=m;themeChanged()}});
const canvas=$('#gl');
const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'});
const stops={host:false,offscreen:false,hidden:false};
function setRun(k,v){stops[k]=!v;}
if(!gl){ $('#nogl').hidden=false; return; }

/* ───────── 基础 ───────── */
const TAU=Math.PI*2, rand=Math.random;
const clamp=(x,a,b)=>x<a?a:x>b?b:x, lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const wrapPi=a=>{a=(a+Math.PI)%TAU;if(a<0)a+=TAU;return a-Math.PI};
function gauss(){let u=0;while(u===0)u=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*rand())}
let time=0, active='overview';

// 相位 → 颜色（全场统一：0 相位天蓝，π 相位橙红）
const PH={r:0,g:0,b:0};
const phaseRGB=(c,s)=>W.phaseRGB(c,s,PH);
{ const st=[]; for(let i=0;i<=24;i++){const a=i/24*TAU;phaseRGB(Math.cos(a),Math.sin(a));st.push(`rgb(${PH.r*255|0},${PH.g*255|0},${PH.b*255|0})`)}
  document.documentElement.style.setProperty('--wheel',`conic-gradient(from 90deg,${st.join(',')})`); }

const M4={
  mul(a,b,o){for(let c=0;c<16;c+=4){const b0=b[c],b1=b[c+1],b2=b[c+2],b3=b[c+3];
    o[c]=a[0]*b0+a[4]*b1+a[8]*b2+a[12]*b3;o[c+1]=a[1]*b0+a[5]*b1+a[9]*b2+a[13]*b3;
    o[c+2]=a[2]*b0+a[6]*b1+a[10]*b2+a[14]*b3;o[c+3]=a[3]*b0+a[7]*b1+a[11]*b2+a[15]*b3}return o},
  persp(o,fovy,asp,n,f){o.fill(0);const t=1/Math.tan(fovy/2);o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o},
  look(o,e,t){let zx=e[0]-t[0],zy=e[1]-t[1],zz=e[2]-t[2],l=Math.hypot(zx,zy,zz);zx/=l;zy/=l;zz/=l;
    let xx=zz,xz=-zx;l=Math.hypot(xx,xz);xx/=l;xz/=l;
    const yx=zy*xz,yy=zz*xx-zx*xz,yz=-zy*xx;
    o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0;o[4]=0;o[5]=yy;o[6]=zy;o[7]=0;o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;
    o[12]=-(xx*e[0]+xz*e[2]);o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);o[15]=1;return o},
  rotYT(rot,p){const o=new Float32Array(16),c=Math.cos(rot),s=Math.sin(rot);o[0]=c;o[2]=-s;o[5]=1;o[8]=s;o[10]=c;o[12]=p[0];o[13]=p[1];o[14]=p[2];o[15]=1;return o}
};

/* ───────── WebGL：两个着色器 + HDR 泛光 ───────── */
function mkShader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function mkProg(vs,fs,names){const p=gl.createProgram();gl.attachShader(p,mkShader(gl.VERTEX_SHADER,vs));gl.attachShader(p,mkShader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  const u={};for(const n of names)u[n]=gl.getUniformLocation(p,n);return {p,u}}

const PP=mkProg(`#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in float aSize;
uniform mat4 uMVP; uniform float uScale, uTime, uWave, uMaxPt;
out vec4 vCol;
void main(){
  vec3 p=aPos; float g=1.0;
  if(uWave>0.5){
    float h=sin(p.x*0.07+uTime*0.9)*cos(p.z*0.06-uTime*0.7)
          +0.6*sin(p.x*0.11-p.z*0.13+uTime*1.3)
          +0.5*sin(length(p.xz)*0.17-uTime*1.7)
          +0.3*sin(p.x*0.31+p.z*0.27+uTime*2.3);
    p.y+=h*1.5; g=clamp(0.55+0.42*h,0.06,1.7);
  }
  vec4 c=uMVP*vec4(p,1.0);
  gl_Position=c;
  float s=aSize*uScale/max(c.w,0.01), f=1.0;
  if(s<2.0){ f=max(s*s*0.25,0.05); s=2.0; }
  gl_PointSize=min(s,uMaxPt);
  vCol=vec4(aCol.rgb,aCol.a*f*g);
}`,`#version 300 es
precision highp float; in vec4 vCol; out vec4 o;
void main(){
  vec2 d=gl_PointCoord*2.0-1.0; float r2=dot(d,d);
  if(r2>1.0) discard;
  o=vec4(vCol.rgb*vCol.a*exp(-r2*3.5)*(1.0-r2),1.0);
}`,['uMVP','uScale','uTime','uWave','uMaxPt']);

const PF=mkProg(`#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol;
uniform mat4 uMVP; out vec4 vCol;
void main(){ gl_Position=uMVP*vec4(aPos,1.0); vCol=aCol; }`,`#version 300 es
precision highp float; in vec4 vCol; out vec4 o;
void main(){ o=vec4(vCol.rgb*vCol.a,1.0); }`,['uMVP']);

const VSQ=`#version 300 es
out vec2 vUV;
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); vUV=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0); }`;
const PD=mkProg(VSQ,`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){
  vec3 c=texture(uTex,vUV+uTexel*vec2(-1.,-1.)).rgb+texture(uTex,vUV+uTexel*vec2(1.,-1.)).rgb
        +texture(uTex,vUV+uTexel*vec2(-1.,1.)).rgb+texture(uTex,vUV+uTexel*vec2(1.,1.)).rgb;
  o=vec4(c*0.25,1.0);
}`,['uTex','uTexel']);
const PB=mkProg(VSQ,`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){
  vec3 c=texture(uTex,vUV).rgb*0.227027;
  c+=(texture(uTex,vUV+uDir*1.384615).rgb+texture(uTex,vUV-uDir*1.384615).rgb)*0.316216;
  c+=(texture(uTex,vUV+uDir*3.230769).rgb+texture(uTex,vUV-uDir*3.230769).rgb)*0.070270;
  o=vec4(c,1.0);
}`,['uTex','uDir']);
const PC=mkProg(VSQ,`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uScene,uB1,uB2; uniform float uTime, uLight; out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec3 c=texture(uScene,vUV).rgb+texture(uB1,vUV).rgb*0.45+texture(uB2,vUV).rgb*0.65;
  vec2 q=vUV-0.5; float v=dot(q,q);
  if(uLight>0.5){
    // 浅色：发光量变成墨的浓度，颜色保留色相、压暗，纸面是站点的米白
    vec3 t=1.0-exp(-c*0.75); float a=max(t.r,max(t.g,t.b));
    vec3 ink=pow(t/max(a,1e-4),vec3(1.6))*0.62;
    vec3 paper=mix(vec3(0.965,0.961,0.933),vec3(0.905,0.91,0.875),smoothstep(0.05,0.6,v));
    vec3 lc=mix(paper,ink,clamp(a*0.96,0.0,1.0));
    lc+=(hash(gl_FragCoord.xy+fract(uTime)*100.0)-0.5)/255.0;
    o=vec4(lc,1.0); return;
  }
  float l=max(c.r,max(c.g,c.b));
  vec3 hue=c*((1.0-exp(-l*1.1))/max(l,1e-4));
  vec3 wht=1.0-exp(-c*1.1);
  vec3 col=mix(hue,wht,0.38);
  vec3 bg=mix(vec3(0.016,0.024,0.060),vec3(0.002,0.003,0.010),smoothstep(0.0,0.55,v));
  col=bg+col*(1.0-0.3*smoothstep(0.1,0.6,v));
  col=pow(col,vec3(0.92));
  col+=(hash(gl_FragCoord.xy+fract(uTime)*100.0)-0.5)/255.0;
  o=vec4(col,1.0);
}`,['uScene','uB1','uB2','uTime','uLight']);

const MAXPT=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]||64;
const batches=[];
class Batch{
  constructor(mode,cap,dyn,st){this.mode=mode;this.cap=cap;this.n=0;this.st=st||null;this.wave=0;
    this.data=new Float32Array(cap*8);this.vao=gl.createVertexArray();this.buf=gl.createBuffer();
    gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);
    gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,dyn?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,12);
    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,32,28);
    gl.bindVertexArray(null);batches.push(this)}
  reset(){this.n=0;return this}
  v(x,y,z,r,g,b,a,s){if(this.n>=this.cap)return;const d=this.data,o=this.n*8;d[o]=x;d[o+1]=y;d[o+2]=z;d[o+3]=r;d[o+4]=g;d[o+5]=b;d[o+6]=a;d[o+7]=s||0;this.n++}
  seg(x0,y0,z0,x1,y1,z1,r,g,b,a){this.v(x0,y0,z0,r,g,b,a,0);this.v(x1,y1,z1,r,g,b,a,0)}
  quad(p0,p1,p2,p3,r,g,b,a){for(const p of [p0,p1,p2,p0,p2,p3])this.v(p[0],p[1],p[2],r,g,b,a,0)}
  loop(ps,r,g,b,a){for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length];this.seg(p[0],p[1],p[2],q[0],q[1],q[2],r,g,b,a)}}
  up(){if(this.n){gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data,0,this.n*8)}return this}
}
function ringXZ(b,r,y,n,cr,cg,cb,a){for(let i=0;i<n;i++){const p=i/n*TAU,q=(i+1)/n*TAU;b.seg(r*Math.cos(p),y,r*Math.sin(p),r*Math.cos(q),y,r*Math.sin(q),cr,cg,cb,a)}}

let HDR=!!(gl.getExtension('EXT_color_buffer_float')||gl.getExtension('EXT_color_buffer_half_float'));
function mkTarget(w,h){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,HDR?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,HDR?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {tex,fb,w,h,ok}}
function freeTarget(t){gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fb)}
if(HDR){const t=mkTarget(4,4);if(!t.ok)HDR=false;freeTarget(t)}
let T=null;
function allocTargets(w,h){if(T)for(const k in T)freeTarget(T[k]);
  const d=s=>[Math.max(2,w>>s),Math.max(2,h>>s)];
  T={scene:mkTarget(w,h),half:mkTarget(...d(1)),q1:mkTarget(...d(2)),q2:mkTarget(...d(2)),e1:mkTarget(...d(3)),e2:mkTarget(...d(3))}}
const quadVAO=gl.createVertexArray();
function pass(P,dst,setup){gl.bindFramebuffer(gl.FRAMEBUFFER,dst?dst.fb:null);gl.viewport(0,0,dst?dst.w:canvas.width,dst?dst.h:canvas.height);
  gl.useProgram(P.p);setup(P.u);gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,3)}
function bindTex(unit,tex,loc){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(loc,unit)}

/* ───────── 世界布局与相机 ───────── */
const RING=74, FOV=48*Math.PI/180;
function mkSt(deg,tLocal,yawOff,pitch,dist){const a=deg*Math.PI/180,rot=Math.PI/2-a,pos=[RING*Math.cos(a),0,RING*Math.sin(a)];
  return {pos,rot,model:M4.rotYT(rot,pos),tLocal,yawOff,pitch,dist}}
const ST={
  overview:{pos:[0,0,0],rot:0,model:M4.rotYT(0,[0,0,0]),tLocal:[0,-6,0],yawOff:.7,pitch:.5,dist:162},
  atom:{pos:[0,0,0],rot:0,model:M4.rotYT(0,[0,0,0]),tLocal:[0,0,0],yawOff:.6,pitch:.2,dist:41},
  slit:mkSt(90,[1,1.5,0],-.95,.4,62),
  tun:mkSt(210,[0,-1.5,0],.3,.16,60),
  bell:mkSt(330,[0,0,0],.62,.24,45)
};
function toWorld(st,p){const c=Math.cos(st.rot),s=Math.sin(st.rot);return [st.pos[0]+c*p[0]+s*p[2],st.pos[1]+p[1],st.pos[2]-s*p[0]+c*p[2]]}
const cam={tgt:[0,-6,0],yaw:.1,pitch:.7,dist:420,fit:1,g:{tgt:[0,-6,0],yaw:.7,pitch:.5,zoom:1},shx:0,shy:0,gsx:0,gsy:0};
const view=new Float32Array(16),proj=new Float32Array(16),VP=new Float32Array(16),MVP=new Float32Array(16),ID=M4.rotYT(0,[0,0,0]),eye=[0,0,0];
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastInput=-99;
function updateCamera(dt){
  const a=1-Math.exp(-dt*3);
  if(!calm&&time-lastInput>5&&(active==='overview'||active==='atom'))cam.g.yaw+=dt*(active==='overview'?.045:.07);
  for(let i=0;i<3;i++)cam.tgt[i]+=(cam.g.tgt[i]-cam.tgt[i])*a;
  cam.yaw+=(cam.g.yaw-cam.yaw)*a;cam.pitch+=(cam.g.pitch-cam.pitch)*a;
  const asp=canvas.width/canvas.height;
  cam.dist+=(ST[active].dist*cam.g.zoom*cam.fit-cam.dist)*a;
  cam.shx+=(cam.gsx-cam.shx)*a;cam.shy+=(cam.gsy-cam.shy)*a;
  const cp=Math.cos(cam.pitch);
  eye[0]=cam.tgt[0]+cam.dist*cp*Math.sin(cam.yaw);eye[1]=cam.tgt[1]+cam.dist*Math.sin(cam.pitch);eye[2]=cam.tgt[2]+cam.dist*cp*Math.cos(cam.yaw);
  M4.look(view,eye,cam.tgt);M4.persp(proj,FOV,asp,1,4000);proj[8]=cam.shx;proj[9]=cam.shy;M4.mul(proj,view,VP);
}

/* ───────── 标签 ───────── */
const labels=[], labelBox=$('#labels');
function addLabel(st,p,text,o={}){const el=document.createElement(o.major?'button':'div');
  el.className='lbl'+(o.major?' major':'')+(o.cls?' '+o.cls:'');el.textContent=text;
  if(o.major){el.tabIndex=-1;el.onclick=()=>goTo(st)}
  labelBox.appendChild(el);const L={st,p,el,major:!!o.major,show:o.show||null,vis:false};labels.push(L);return L}
function updateLabels(){
  const W=innerWidth,H=innerHeight;
  for(const L of labels){
    let show=L.major?active!==L.st:(active===L.st&&(!L.show||L.show()));
    let x=0,y=0;
    if(show){const w=toWorld(ST[L.st],L.p);
      const cw=VP[3]*w[0]+VP[7]*w[1]+VP[11]*w[2]+VP[15];
      if(cw<2)show=false;else{
        x=((VP[0]*w[0]+VP[4]*w[1]+VP[8]*w[2]+VP[12])/cw*.5+.5)*W;
        y=(1-((VP[1]*w[0]+VP[5]*w[1]+VP[9]*w[2]+VP[13])/cw*.5+.5))*H;
        if(x<-80||x>W+80||y<-40||y>H+40)show=false}}
    if(show){L.el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
      if(!L.vis){L.vis=true;L.el.style.opacity=1;L.el.style.pointerEvents=L.major?'auto':'none'}}
    else if(L.vis){L.vis=false;L.el.style.opacity=0;L.el.style.pointerEvents='none'}
  }
}
function seg(sel,fn){const box=$(sel);for(const b of $$('button',box))b.onclick=()=>{for(const c of $$('button',box))c.classList.toggle('on',c===b);fn(b.dataset.v)}}

/* ───────── 真空：涨落的场 + 虚粒子对 + 远处的尘 ───────── */
const env=(()=>{
  const GYL=-22;
  const ground=new Batch(gl.POINTS,10500,false);ground.wave=1;
  {const sp=3.1;for(let iz=-60;iz<=60;iz++)for(let ix=-54;ix<=54;ix++){
    const x=(ix+(iz&1)*.5)*sp,z=iz*sp*.866,r=Math.hypot(x,z);if(r>158)continue;
    const f=1-smooth((r-60)/98);ground.v(x,GYL,z,.3,.46,1,.62*f+.02,.6)}ground.up()}
  const dust=new Batch(gl.POINTS,2000,false);
  for(let i=0;i<2000;i++){const u=rand()*2-1,ph=rand()*TAU,r=280+rand()*520,s=Math.sqrt(1-u*u);
    dust.v(r*s*Math.cos(ph),r*u*.8+30,r*s*Math.sin(ph),.7+.3*rand(),.75+.25*rand(),1,.2+.6*rand(),.9+rand()*1.3)}
  dust.up();
  const pairs=[],vp=new Batch(gl.POINTS,140,true);let acc=0;
  function update(dt){
    acc+=dt*16;
    while(acc>=1){acc--;if(pairs.length<60){const r=18+Math.sqrt(rand())*125,a=rand()*TAU;
      pairs.push({x:r*Math.cos(a),z:r*Math.sin(a),t:0,d:.45+rand()*.7,dir:rand()*TAU,s:1.2+rand()*2.6})}}
    vp.reset();
    for(let i=pairs.length-1;i>=0;i--){const p=pairs[i];p.t+=dt;const u=p.t/p.d;if(u>=1){pairs.splice(i,1);continue}
      const e=Math.sin(Math.PI*u),sx=Math.cos(p.dir)*p.s*e,sz=Math.sin(p.dir)*p.s*e,y=GYL+2+p.s*1.1*e;
      vp.v(p.x+sx,y,p.z+sz,.4,.8,1,e*.9,.7);vp.v(p.x-sx,y,p.z-sz,1,.6,.35,e*.9,.7)}
    vp.up();
  }
  return {update};
})();

/* ───────── 原子：氢原子波函数的 Metropolis 采样 ───────── */
const atom=(()=>{
  const st=ST.atom,NMAX=36000;let N=30000;
  const X=new Float32Array(NMAX),Y=new Float32Array(NMAX),Z=new Float32Array(NMAX),SD=new Float32Array(NMAX);
  const AR=[new Float32Array(NMAX),new Float32Array(NMAX)],AI=[new Float32Array(NMAX),new Float32Array(NMAX)];
  const tAr=[0,0],tAi=[0,0],cE=[1,1],sE=[0,0];
  const cloud=new Batch(gl.POINTS,NMAX,true,st),extra=new Batch(gl.POINTS,1300,true,st),wire=new Batch(gl.LINES,8,false,st);
  wire.seg(0,-15,0,0,15,0,.6,.7,1,.14);wire.up();
  addLabel('atom',[0,16.2,0],L('z 轴','z axis'));
  const GMAX=900,GX=new Float32Array(GMAX),GY=new Float32Array(GMAX),GZ=new Float32Array(GMAX),GT=new Float32Array(GMAX);
  let gN=0,gI=0,meas=0,lastR=0;
  let comps=[],step=.5,scale=3,ext=4,tA=0,rate=1,burst=0,parity=0,cur=null;
  let phase='idle',phT=0,tg=[0,0,0],tgA=[0,0,0],auto=false,autoAcc=0,flashT=-9;
  for(let i=0;i<NMAX;i++){X[i]=gauss()*1.2;Y[i]=gauss()*1.2;Z[i]=gauss()*1.2;SD[i]=rand()}
  // ψ_nlm = R_nl(r)·Y_l^m(θ,φ)，单位：玻尔半径（world-models.js）
  const evalAt=(x,y,z)=>W.hEval(comps,x,y,z,tAr,tAi);
  function recalc(){const K=comps.length;for(let i=0;i<NMAX;i++){evalAt(X[i],Y[i],Z[i]);for(let k=0;k<K;k++){AR[k][i]=tAr[k];AI[k][i]=tAi[k]}}}
  function metro(i0,stride){
    const K=comps.length;
    for(let i=i0;i<N;i+=stride){
      let re=0,im=0;for(let k=0;k<K;k++){const a=AR[k][i],b=AI[k][i];re+=a*cE[k]+b*sE[k];im+=b*cE[k]-a*sE[k]}
      const w=re*re+im*im,s2=step*2*(rand()<.08?3.5:1);
      const x=X[i]+(rand()-.5)*s2,y=Y[i]+(rand()-.5)*s2,z=Z[i]+(rand()-.5)*s2;
      evalAt(x,y,z);
      let r2=0,i2=0;for(let k=0;k<K;k++){const a=tAr[k],b=tAi[k];r2+=a*cE[k]+b*sE[k];i2+=b*cE[k]-a*sE[k]}
      if(r2*r2+i2*i2>=w*rand()){X[i]=x;Y[i]=y;Z[i]=z;for(let k=0;k<K;k++){AR[k][i]=tAr[k];AI[k][i]=tAi[k]}}
    }
  }
  const HTML={'1s':'1s','2s':'2s','2pz':'2p<sub>z</sub>','2p1':'2p<sub>+1</sub>','3pz':'3p<sub>z</sub>','3dz':'3d<sub>z²</sub>','3d1':'3d<sub>+1</sub>','4f':'4f<sub>z³</sub>',
    sp:L('1s + 2p<sub>z</sub> 摆动','1s + 2p<sub>z</sub> swing'),ss:L('1s + 2s 呼吸','1s + 2s breathing')};
  const PRE=W.H_PRESETS.map(p=>({...p,h:HTML[p.id],wide:p.c.length>1?1:0}));
  function set(id){
    const p=PRE.find(q=>q.id===id);cur=p;
    comps=W.hComps(p);
    const nm=Math.max(...p.c.map(c=>c[0])),e2=2.5*nm*nm+1.5,f=e2/ext;
    for(let i=0;i<NMAX;i++){X[i]*=f;Y[i]*=f;Z[i]*=f}
    ext=e2;scale=12/ext;step=.45*Math.pow(nm,1.5);
    rate=comps.length===1?1.3/Math.abs(comps[0].E):2.1/Math.abs(comps[0].E-comps[1].E);
    tA=0;cE[0]=cE[1]=1;sE[0]=sE[1]=0;recalc();burst=70;gN=0;gI=0;meas=0;phase='idle';
    for(const b of $$('#orbs .b'))b.classList.toggle('on',b.dataset.id===id);read();
  }
  function measure(silent){
    const j=(rand()*N)|0;GX[gI]=X[j];GY[gI]=Y[j];GZ[gI]=Z[j];GT[gI]=time;gI=(gI+1)%GMAX;if(gN<GMAX)gN++;meas++;
    lastR=Math.hypot(X[j],Y[j],Z[j]);
    if(!silent){phase='collapsing';phT=0;tgA=[X[j],Y[j],Z[j]];tg=[X[j]*scale,Z[j]*scale,-Y[j]*scale];read()}
  }
  function release(){
    for(let i=0;i<N;i++){X[i]=tgA[0]+gauss()*step*.25;Y[i]=tgA[1]+gauss()*step*.25;Z[i]=tgA[2]+gauss()*step*.25}
    recalc();phase='idle';burst=90;
  }
  function fill(){
    const K=comps.length,d=cloud.data,s=scale;let o=0;
    const e=phase==='collapsing'?smooth(phT/.3):phase==='hold'?1:0;
    const al=.46*Math.sqrt(30000/N)*(1-.86*e);
    for(let i=0;i<N;i++){
      let re=0,im=0;for(let k=0;k<K;k++){const a=AR[k][i],b=AI[k][i];re+=a*cE[k]+b*sE[k];im+=b*cE[k]-a*sE[k]}
      const m=Math.sqrt(re*re+im*im)+1e-30;phaseRGB(re/m,im/m);
      let x=X[i]*s,y=Z[i]*s,z=-Y[i]*s;
      if(e>0){const ei=clamp(e*1.6-SD[i]*.6,0,1);x+=(tg[0]-x)*ei;y+=(tg[1]-y)*ei;z+=(tg[2]-z)*ei}
      d[o]=x;d[o+1]=y;d[o+2]=z;d[o+3]=PH.r;d[o+4]=PH.g;d[o+5]=PH.b;d[o+6]=al;d[o+7]=.28*(.75+.5*SD[i]);o+=8;
    }
    cloud.n=N;cloud.up();
    extra.reset();extra.v(0,0,0,1,.95,.85,.9,.9);
    for(let i=0;i<gN;i++){const age=time-GT[i],f=age<.5?1-age/.5:0;
      extra.v(GX[i]*s,GZ[i]*s,-GY[i]*s,1,.86+.14*f,.5+.5*f,.75+.25*f,.42+1.4*f)}
    const ft=time-flashT;
    if(ft<.9){const f=1-ft/.9,R=(1-f)*5;extra.v(tg[0],tg[1],tg[2],1,1,1,f,2+4*f);
      for(let j=0;j<40;j++){const a=j/40*TAU;extra.v(tg[0]+R*Math.cos(a),tg[1],tg[2]+R*Math.sin(a),1,.9,.6,f*.8,.4)}}
    extra.up();
  }
  function update(dt){
    const K=comps.length;
    if(phase==='idle'){
      tA+=dt*rate;for(let k=0;k<K;k++){cE[k]=Math.cos(comps[k].E*tA);sE[k]=Math.sin(comps[k].E*tA)}
      if(burst>0){burst--;metro(0,1);metro(0,1);metro(0,1)}
      else if(active==='atom'||K>1)metro(0,1);
      else{metro(parity,2);parity^=1}
      if(auto){autoAcc+=dt*40;while(autoAcc>=1){autoAcc--;measure(true)}}
    }else{phT+=dt;
      if(phase==='collapsing'&&phT>=.3){phase='hold';phT=0;flashT=time}
      else if(phase==='hold'&&phT>=.8)release()}
    fill();
  }
  function read(){
    if(!cur)return;let s;
    const ly=W.lyman(),dE=ly.dE.toFixed(2);
    if(comps.length===1){const c=comps[0];s=`<b>n = ${c.n}, l = ${c.l}, m = ${c.m}</b> · E = ${W.levelEV(c.n).toFixed(2)} eV<br>`+L('定态：整体相位匀速转动，|ψ|² 不随时间变化','Stationary state: the overall phase turns steadily, |ψ|² does not change')}
    else if(cur.id==='sp')s=`<b>(|1s⟩ + |2p<sub>z</sub>⟩)/√2</b> · ΔE = ${dE} eV<br>`+L(`电荷上下摆动 → 辐射 ${ly.nm.toFixed(1)} nm 紫外光（莱曼 α）`,`The charge swings up and down → it radiates ${ly.nm.toFixed(1)} nm ultraviolet light (Lyman α)`);
    else s=`<b>(|1s⟩ + |2s⟩)/√2</b> · ΔE = ${dE} eV<br>`+L('球对称地“呼吸”，没有偶极矩——不能单光子跃迁回 1s，所以 2s 是亚稳态（寿命约 0.12 秒，靠双光子衰变）','It “breathes” with spherical symmetry and has no dipole: it cannot fall back to 1s by emitting one photon, so 2s is metastable (lifetime about 0.12 s, decaying by two photons)');
    if(meas)s+='<br>'+L(`已测量 <b>${meas}</b> 次 · 最近一次 r = ${lastR.toFixed(2)} a₀`,`Measured <b>${meas}</b> times · last r = ${lastR.toFixed(2)} a₀`);
    $('#aRead').innerHTML=s;
  }
  const orbs=$('#orbs');
  for(const p of PRE){const b=document.createElement('button');b.className='b'+(p.wide?' wide':'');b.dataset.id=p.id;b.innerHTML=p.h;b.onclick=()=>set(p.id);orbs.appendChild(b)}
  $('#aMeasure').onclick=()=>{if(phase==='idle')measure(false)};
  $('#aAuto').onclick=e=>{auto=!auto;e.currentTarget.classList.toggle('on',auto)};
  set('3dz');
  return {update,read,setN(n){N=n},get N(){return N}};
})();

/* ───────── 双缝：两条路径的振幅相加 ───────── */
const slit=(()=>{
  const {SX,BX,EX,ZW,D,LAM}=W.SLIT,st=ST.slit,YH=7,K=TAU/LAM,LEN=EX-BX,Z1=D/2,Z2=-D/2,VEL=42,T1=(BX-SX)/VEL;
  const tri=new Batch(gl.TRIANGLES,60,false,st),wire=new Batch(gl.LINES,400,false,st);
  const wave=new Batch(gl.POINTS,16000,true,st),hitB=new Batch(gl.POINTS,14000,true,st),dynP=new Batch(gl.POINTS,2600,true,st),dynL=new Batch(gl.LINES,900,true,st);
  const A=W.SLIT.A,ampAt=W.slitAmp;
  for(const [a,b] of [[-ZW,Z2-A/2],[Z2+A/2,Z1-A/2],[Z1+A/2,ZW]]){const q=[[BX,-YH,a],[BX,-YH,b],[BX,YH,b],[BX,YH,a]];tri.quad(...q,.4,.5,1,.07);wire.loop(q,.55,.65,1,.5)}
  {const q=[[EX,-YH,-ZW],[EX,-YH,ZW],[EX,YH,ZW],[EX,YH,-ZW]];tri.quad(...q,.45,.6,1,.028);wire.loop(q,.55,.7,1,.42)}
  wire.seg(EX,YH+1.2,-ZW,EX,YH+1.2,ZW,.6,.7,1,.3);
  {const s=1.3,V=[[s,0,0],[-s,0,0],[0,s,0],[0,-s,0],[0,0,s],[0,0,-s]];
    for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){if((i>>1)===(j>>1))continue;wire.seg(SX+V[i][0],V[i][1],V[i][2],SX+V[j][0],V[j][1],V[j][2],.8,.8,1,.45)}}
  ringXZ(wire,34,-13,96,.45,.55,1,.12);tri.up();wire.up();
  addLabel('slit',[SX,3.4,0],L('粒子源','source'));addLabel('slit',[BX,YH+1.6,0],L('双缝','double slit'));addLabel('slit',[EX,-YH-1.6,0],L('探测屏','screen'));addLabel('slit',[EX,YH+10.4,0],L('落点统计','hit counts'));
  // 波面采样点：0 = 缝后（两束相干波），1 = 缝前（源发出的波）
  const tmp=[],G=.3;
  for(let x=BX+.45;x<EX-.1;x+=G)for(let z=-ZW;z<=ZW;z+=G)tmp.push(x+(rand()-.5)*G*.9,z+(rand()-.5)*G*.9,0);
  for(let i=0;i<2600;i++)tmp.push(SX+.5+rand()*(BX-SX-.9),(rand()*2-1)*ZW,1);
  const WN=tmp.length/3,wx=new Float32Array(WN),wz=new Float32Array(WN),wt=new Uint8Array(WN);
  const c1=new Float32Array(WN),s1=new Float32Array(WN),c2=new Float32Array(WN),s2=new Float32Array(WN),m1=new Float32Array(WN),m2=new Float32Array(WN);
  for(let i=0;i<WN;i++){const x=tmp[i*3],z=tmp[i*3+1];wx[i]=x;wz[i]=z;wt[i]=tmp[i*3+2];
    if(wt[i]===0){let a=ampAt(x-BX,z-Z1),r=Math.hypot(x-BX,z-Z1);m1[i]=a;c1[i]=a*Math.cos(K*r);s1[i]=a*Math.sin(K*r);
      a=ampAt(x-BX,z-Z2);r=Math.hypot(x-BX,z-Z2);m2[i]=a;c2[i]=a*Math.cos(K*r);s2[i]=a*Math.sin(K*r)}
    else{const r=Math.hypot(x-SX,z),q=z/(x-SX+4),a=Math.sqrt(2.5/(r+2.5))*Math.exp(-q*q*1.1);m1[i]=a;c1[i]=a*Math.cos(K*r);s1[i]=a*Math.sin(K*r)}}
  // 屏上的概率分布
  const NB=720,{Ic,I1,I2}=W.slitScreen(NB);
  const mkCdf=I=>{const c=new Float64Array(NB);let s=0;for(let b=0;b<NB;b++){s+=I[b];c[b]=s}for(let b=0;b<NB;b++)c[b]/=s;return c};
  const cdfC=mkCdf(Ic),cdf1=mkCdf(I1),cdf2=mkCdf(I2);
  function sample(cdf){const u=rand();let lo=0,hi=NB-1;while(lo<hi){const m=(lo+hi)>>1;if(cdf[m]<u)lo=m+1;else hi=m}return -ZW+(lo+rand())*(2*ZW/NB)}
  const HB=120,thC=new Float64Array(HB),thW=new Float64Array(HB);let thMax=0;
  {let sc=0,sw=0;for(let b=0;b<NB;b++){const h=(b*HB/NB)|0;thC[h]+=Ic[b];thW[h]+=I1[b]+I2[b];sc+=Ic[b];sw+=I1[b]+I2[b]}
    for(let h=0;h<HB;h++){thC[h]/=sc;thW[h]/=sw;thMax=Math.max(thMax,thC[h])}}
  const HMAX=14000,hz=new Float32Array(HMAX),hy=new Float32Array(HMAX),ht=new Float32Array(HMAX),hist=new Float32Array(HB);
  let hn=0,hI=0,total=0,detect=false,rateIdx=1,acc=0,credit=0;const RATES=[1.6,24,420],flights=[],flashDet=[-9,-9];
  function addHit(z,y){hz[hI]=z;hy[hI]=y;ht[hI]=time;hI=(hI+1)%HMAX;if(hn<HMAX)hn++;total++;hist[clamp(((z+ZW)/(2*ZW)*HB)|0,0,HB-1)]++}
  function clear(){hn=0;hI=0;total=0;hist.fill(0);flights.length=0}
  function emit(){
    let which=-1,z;
    if(detect){which=rand()<.5?0:1;z=sample(which===0?cdf1:cdf2)}else z=sample(cdfC);
    const y=(rand()*2-1)*(YH-.7);
    if(credit>=1&&flights.length<14){credit-=1;flights.push({t:0,which,z,y,det:false})}
    else{addHit(z,y);if(which>=0&&rand()<.2)flashDet[which]=time}
  }
  function fillWave(){
    const w=time*TAU*1.1,cw=Math.cos(w),sw=Math.sin(w),d=wave.data;let o=0;
    for(let i=0;i<WN;i++){
      let re,a,r,g,b;
      if(wt[i]===1){const m=m1[i];re=c1[i]*cw+s1[i]*sw;const cr=re>0?re/m:0;a=1.3*m*m*(.08+.92*cr*cr);r=.72;g=.74;b=1}
      else if(!detect){const cc=c1[i]+c2[i],ss=s1[i]+s2[i];re=cc*cw+ss*sw;const im=ss*cw-cc*sw,mm=re*re+im*im;
        a=2.2*mm*(.06+.94*(re>0?re*re/(mm+1e-12):0));r=.5;g=.8;b=1}
      else if(i&1){const m=m1[i];re=c1[i]*cw+s1[i]*sw;const cr=re>0?re/m:0;a=4.4*m*m*(.06+.94*cr*cr);r=.35;g=.78;b=1}
      else{const m=m2[i];re=c2[i]*cw+s2[i]*sw;const cr=re>0?re/m:0;a=4.4*m*m*(.06+.94*cr*cr);r=1;g=.58;b=.32}
      d[o]=wx[i];d[o+1]=re*.9;d[o+2]=wz[i];d[o+3]=r;d[o+4]=g;d[o+5]=b;d[o+6]=a>1?1:a;d[o+7]=.4;o+=8;
    }
    wave.n=WN;wave.up();
  }
  function update(dt){
    acc+=dt*RATES[rateIdx];credit=Math.min(2,credit+dt*Math.min(RATES[rateIdx],4.5));
    let n=Math.min(60,acc|0);acc-=acc|0;for(let i=0;i<n;i++)emit();
    fillWave();dynP.reset();dynL.reset();
    dynP.v(SX,0,0,.9,.9,1,.6+.25*Math.sin(time*6),1.6);
    for(let i=flights.length-1;i>=0;i--){const f=flights[i];f.t+=dt;
      if(f.t<T1){const x=SX+VEL*f.t;for(let j=0;j<12;j++)dynP.v(x+gauss()*.5,gauss()*.45,gauss()*.5,.9,.92,1,.55,.5);dynP.v(x,0,0,1,1,1,.9,1.1);continue}
      if(!f.det){f.det=true;if(f.which>=0)flashDet[f.which]=time}
      const rho=VEL*(f.t-T1),dA=Math.hypot(LEN,f.z-Z1),dB=Math.hypot(LEN,f.z-Z2),dHit=f.which===0?dA:f.which===1?dB:Math.min(dA,dB);
      if(rho>=dHit){addHit(f.z,f.y);flights.splice(i,1);continue}
      const fade=.8*(1-.6*rho/dHit);
      for(let s=0;s<2;s++){if(f.which>=0&&f.which!==s)continue;const zc=s===0?Z1:Z2;
        const cr=f.which<0?.8:s===0?.4:1,cg=f.which<0?.9:s===0?.8:.62,cb=f.which<0?1:s===0?1:.36;
        for(let j=0;j<=60;j++){const ph=(j/60-.5)*2.6,x=BX+rho*Math.cos(ph),z=zc+rho*Math.sin(ph);if(x>EX||Math.abs(z)>ZW)continue;dynP.v(x,.3,z,cr,cg,cb,fade,.42)}}
    }
    dynP.up();
    // 落点
    {const d=hitB.data,dim=hn>6000?.75:1,fk=[1,.7,.2][rateIdx];let o=0;
      for(let i=0;i<hn;i++){const age=time-ht[i],fl=age<.45?(1-age/.45)*fk:0;
        d[o]=EX;d[o+1]=hy[i];d[o+2]=hz[i];d[o+3]=.62+.38*fl;d[o+4]=.86+.14*fl;d[o+5]=1;d[o+6]=(.6+.4*fl)*dim;d[o+7]=.36+1.3*fl;o+=8}
      hitB.n=hn;hitB.up()}
    // 统计柱 + 理论曲线 + 探测器
    const base=YH+1.2,HH=7,th=detect?thW:thC,bw=2*ZW/HB;
    if(total>0)for(let h=0;h<HB;h++){const v=Math.min(1.5,hist[h]/total/thMax);if(v>0){const z=-ZW+(h+.5)*bw;dynL.seg(EX,base,z,EX,base+v*HH,z,.7,.9,1,.75)}}
    for(let h=0;h<HB-1;h++)dynL.seg(EX,base+th[h]/thMax*HH,-ZW+(h+.5)*bw,EX,base+th[h+1]/thMax*HH,-ZW+(h+1.5)*bw,1,.75,.4,.6);
    if(detect)for(let s=0;s<2;s++){const zc=s===0?Z1:Z2,f=Math.max(0,1-(time-flashDet[s])/.35),cr=s===0?.4:1,cg=s===0?.8:.62,cb=s===0?1:.36;
      for(let j=0;j<20;j++){const p=j/20*TAU,q=(j+1)/20*TAU;dynL.seg(BX+.8,1.7*Math.cos(p),zc+1.7*Math.sin(p),BX+.8,1.7*Math.cos(q),zc+1.7*Math.sin(q),cr,cg,cb,.35+.65*f)}
      if(f>0)dynP.v(BX+.8,0,zc,cr,cg,cb,f,2.6),dynP.up()}
    dynL.up();
  }
  function read(){$('#sRead').innerHTML=L(`已落屏 <b>${total}</b> 个粒子`,`<b>${total}</b> particles on the screen`)+'<br>'+(detect?L('探测器开着：落点是两团单缝分布之和，没有条纹','Detector on: the hits are the sum of two single-slit patterns, no fringes'):L('探测器关着：落点聚成明暗相间的干涉条纹','Detector off: the hits gather into bright and dark interference fringes'))}
  $('#sDetTxt').textContent=L('关','off');
  $('#sDetect').onchange=e=>{detect=e.target.checked;$('#sDetTxt').textContent=detect?L('开','on'):L('关','off');clear();read()};
  seg('#sRate',v=>{rateIdx=+v});
  $('#sClear').onclick=()=>{clear();read()};
  return {update,read};
})();

/* ───────── 隧穿：一维含时薛定谔方程（Crank–Nicolson） ───────── */
const tun=(()=>{
  const sim=W.tunnel(),{N,DX,XB,TM}=sim.P,DT=sim.P.DT,E0=sim.E0,re=sim.re,im=sim.im,st=ST.tun,TA=6,SPEED=5.5;
  const hel=new Batch(gl.LINE_STRIP,N,true,st),helP=new Batch(gl.POINTS,N,true,st),prob=new Batch(gl.LINE_STRIP,N,true,st);
  const dynL=new Batch(gl.LINES,1500,true,st),slab=new Batch(gl.TRIANGLES,12,true,st),wire=new Batch(gl.LINES,200,false,st);
  ringXZ(wire,34,-13,96,.45,.55,1,.12);wire.up();
  const Y0=3,YB=-8.5,AMP=14,PS=52,EH=3;
  let v0=1.4,t=0,acc=0,state='run',fade=0,cs=0,outcome=false,nT=0,nR=0,pLive=0,resT=-9;
  addLabel('tun',[0,Y0+7.6,0],L('势垒 V₀','barrier V₀'));addLabel('tun',[-31.5,YB+EH,0],'E');addLabel('tun',[-33,YB,0],'|ψ|²');
  const resL=addLabel('tun',[0,0,0],'',{cls:'res',show:()=>time-resT<2});
  const edges=()=>[(sim.left-XB)*.5,(sim.right-XB)*.5]; // 场景里横向缩了一半
  function build(w){
    sim.build(v0,w);
    const [xa,xb]=edges(),yt=Y0+6.5,zz=6,al=.05+.03*v0;
    slab.reset();slab.quad([xa,YB,-zz],[xa,YB,zz],[xa,yt,zz],[xa,yt,-zz],1,.6,.35,al);
    slab.quad([xb,YB,-zz],[xb,YB,zz],[xb,yt,zz],[xb,yt,-zz],1,.6,.35,al);slab.up();
  }
  function launch(){sim.launch();t=0;state='run';fade=0;acc=0}
  function measure(){
    outcome=rand()<sim.pRight();if(outcome)nT++;else nR++;state='collapse';cs=0;resT=time;
    resL.p=[outcome?17:-17,Y0+8.5,0];resL.el.textContent=outcome?L('测量：穿过去了','Measured: it got through'):L('测量：弹回来了','Measured: it bounced back');read();
  }
  function fill(){
    const dH=hel.data,dQ=prob.data,dP=helP.data;let o=0,op=0,np=0;dynL.reset();
    for(let j=0;j<N;j++){
      const a=re[j],b=im[j],m2=a*a+b*b,m=Math.sqrt(m2),xw=(j*DX-XB)*.5;
      if(m>1e-9)phaseRGB(a/m,b/m);else{PH.r=PH.g=PH.b=.5}
      const al=Math.min(1,Math.pow(m/.3,.6))*fade;
      dH[o]=xw;dH[o+1]=Y0+AMP*a;dH[o+2]=AMP*b;dH[o+3]=PH.r;dH[o+4]=PH.g;dH[o+5]=PH.b;dH[o+6]=al*.9;dH[o+7]=0;
      dQ[o]=xw;dQ[o+1]=YB+m2*PS;dQ[o+2]=0;dQ[o+3]=.9;dQ[o+4]=.95;dQ[o+5]=1;dQ[o+6]=(.16+.6*Math.min(1,m2*60))*fade;dQ[o+7]=0;o+=8;
      if(m>.006){dP[op]=xw;dP[op+1]=Y0+AMP*a;dP[op+2]=AMP*b;dP[op+3]=PH.r;dP[op+4]=PH.g;dP[op+5]=PH.b;dP[op+6]=al;dP[op+7]=.44;op+=8;np++}
      if((j&3)===0&&m2>2e-4)dynL.seg(xw,YB,0,xw,YB+m2*PS,0,.7,.85,1,.13*fade);
    }
    hel.n=N;prob.n=N;helP.n=np;hel.up();prob.up();helP.up();
    const [xa,xb]=edges(),top=YB+EH*v0,yt=Y0+6.5,zz=6;
    dynL.seg(-30,Y0,0,30,Y0,0,.6,.7,1,.12);
    dynL.seg(-30,YB,0,xa,YB,0,.6,.7,1,.3);dynL.seg(xb,YB,0,30,YB,0,.6,.7,1,.3);
    dynL.seg(xa,YB,0,xa,top,0,1,.6,.35,.9);dynL.seg(xa,top,0,xb,top,0,1,.6,.35,.9);dynL.seg(xb,top,0,xb,YB,0,1,.6,.35,.9);
    for(let x=-30;x<30;x+=2)dynL.seg(x,YB+EH,0,x+1,YB+EH,0,1,.82,.4,.4);
    for(const x of [xa,xb]){dynL.loop([[x,YB,-zz],[x,YB,zz],[x,yt,zz],[x,yt,-zz]],1,.6,.35,.35)}
    for(const [y,z] of [[YB,-zz],[YB,zz],[yt,zz],[yt,-zz]])dynL.seg(xa,y,z,xb,y,z,1,.6,.35,.35);
    dynL.up();
  }
  function update(dt){
    if(state==='fadeout'){fade-=dt*2.2;if(fade<=0)launch()}
    else{if(fade<1)fade=Math.min(1,fade+dt*2.5);
      acc+=dt*SPEED/DT;const n=Math.min(8,acc|0);acc-=acc|0;
      for(let s=0;s<n;s++){sim.step();t+=DT;
        if(state==='run'&&t>=TM)measure();
        else if(state==='collapse'){sim.squeeze(outcome);if(++cs>=24)state='after'}
        else if(state==='after'&&t>=TM+TA){state='fadeout';break}}
      pLive=sim.pRight()}
    fill();
  }
  function read(){const n=nT+nR,Vb=v0*E0,w=sim.w;
    $('#tRead').innerHTML=L(`平面波理论透射率 <b>T = ${(W.transmission(E0,Vb,w)*100).toFixed(1)}%</b> · 按波包的动量分布平均 <b>${(W.packetTransmission(Vb,w)*100).toFixed(1)}%</b>`,`Plane-wave transmission <b>T = ${(W.transmission(E0,Vb,w)*100).toFixed(1)}%</b> · averaged over the packet's momenta <b>${(W.packetTransmission(Vb,w)*100).toFixed(1)}%</b>`)+'<br>'+
      L(`此刻墙后的概率 <b>${(pLive*100).toFixed(1)}%</b>`,`Probability behind the wall now <b>${(pLive*100).toFixed(1)}%</b>`)+'<br>'+
      (n?L(`已测量 ${n} 次：穿过 <b>${nT}</b>（${(nT/n*100).toFixed(0)}%）· 弹回 <b>${nR}</b>`,`Measured ${n} times: through <b>${nT}</b> (${(nT/n*100).toFixed(0)}%) · back <b>${nR}</b>`):L('等待第一次测量…','Waiting for the first measurement…'))}
  const sv=$('#tV0'),sw=$('#tW');
  function onSl(){v0=+sv.value;build(+sw.value);$('#tV0o').textContent=v0.toFixed(2);$('#tWo').textContent=sim.w.toFixed(2);nT=nR=0;launch();read()}
  sv.oninput=onSl;sw.oninput=onSl;$('#tReset').onclick=()=>{nT=nR=0;read()};
  build(+sw.value);launch();
  return {update,read,sim};
})();

/* ───────── 纠缠：单态的测量统计与 CHSH ───────── */
const bell=(()=>{
  const st=ST.bell,DXA=18,RR=3.6,TF=.95,GOLD=[1,.82,.35],VIO=[.69,.55,1];
  const pts=new Batch(gl.POINTS,400,true,st),lines=new Batch(gl.LINES,600,true,st),wire=new Batch(gl.LINES,200,false,st);
  ringXZ(wire,30,-13,96,.45,.55,1,.12);wire.up();
  const SA=W.CHSH.A,SB=W.CHSH.B;
  const n4=[0,0,0,0],s4=[0,0,0,0],nb=new Float64Array(37),sb=new Float64Array(37);
  let mode='chsh',theta=Math.PI/3,speed=1,pair=null,tNext=.5,accS=0;
  let angA=0,angB=Math.PI/4,goalA=0,goalB=Math.PI/4,resA=1,resB=-1,flA=-9,flB=-9;
  const lA=addLabel('bell',[-DXA,RR+2,0],'Alice'),lB=addLabel('bell',[DXA,RR+2,0],'Bob');addLabel('bell',[0,-2.6,0],L('纠缠源','entangled source'));
  function pick(){if(mode==='chsh'){const i=rand()<.5?0:1,j=rand()<.5?0:1;return [SA[i],SB[j],i*2+j]}return [0,theta,-1]}
  // 单态：Alice 的结果纯随机；Bob 与她相同的概率是 sin²(Δ/2)  ⇒  E = −cos Δ
  function trial(a,b,idx){
    const [A,B]=W.singlet(a,b,rand);
    if(idx>=0){n4[idx]++;s4[idx]+=A*B}
    let d=Math.abs(a-b)%TAU;if(d>Math.PI)d=TAU-d;const bin=Math.round(d/(Math.PI/36));nb[bin]++;sb[bin]+=A*B;
    return [A,B];
  }
  function reset(){n4.fill(0);s4.fill(0);nb.fill(0);sb.fill(0)}
  function det(x,a,fl,res){
    const oc=res>0?GOLD:VIO,f=Math.max(0,1-(time-fl)/.8);
    for(let i=0;i<40;i++){const p=i/40*TAU,q=(i+1)/40*TAU;
      const cr=lerp(.55,oc[0],f),cg=lerp(.65,oc[1],f),cb=lerp(1,oc[2],f);
      lines.seg(x,RR*Math.cos(p),RR*Math.sin(p),x,RR*Math.cos(q),RR*Math.sin(q),cr,cg,cb,.4+.6*f);
      pts.v(x,RR*Math.cos(p),RR*Math.sin(p),cr,cg,cb,.3+.6*f,.34)}
    const ay=Math.cos(a)*RR,az=Math.sin(a)*RR;
    lines.seg(x,-ay,-az,x,ay,az,.8,.86,1,.5);
    pts.v(x,ay,az,GOLD[0],GOLD[1],GOLD[2],.9,.8);pts.v(x,-ay,-az,VIO[0],VIO[1],VIO[2],.9,.8);
    if(f>0){pts.v(x,res*ay,res*az,oc[0],oc[1],oc[2],f,1.4+3*f);pts.v(x,res*ay,res*az,1,1,1,f*.7,.9)}
  }
  function update(dt){
    pts.reset();lines.reset();
    const k=1-Math.exp(-dt*10);angA+=(goalA-angA)*k;angB+=(goalB-angB)*k;
    if(pair){pair.t+=dt;const u=pair.t/TF;
      if(u>=1){const r=trial(pair.a,pair.b,pair.idx);resA=r[0];resB=r[1];flA=flB=time;pair=null;tNext=.3;
        lA.el.textContent='Alice  '+(resA>0?'+1':'−1');lB.el.textContent='Bob  '+(resB>0?'+1':'−1')}
      else{const x=DXA*u;
        for(let s=-1;s<=1;s+=2){for(let j=0;j<18;j++)pts.v(s*x+gauss()*.5,gauss()*.5,gauss()*.5,.86,.86,1,.5,.42);pts.v(s*x,0,0,1,1,1,.85,.9)}
        lines.seg(-x,0,0,x,0,0,.72,.62,1,.26+.12*Math.sin(time*16))}}
    else{tNext-=dt;if(tNext<=0){const p=pick();pair={t:0,a:p[0],b:p[1],idx:p[2]};goalA=p[0];goalB=p[1]}}
    accS+=dt*[0,60,3000][speed];const n=accS|0;accS-=n;for(let i=0;i<n;i++){const p=pick();trial(p[0],p[1],p[2])}
    pts.v(0,0,0,.8,.7,1,.7+.2*Math.sin(time*5),1.5);
    lines.seg(-DXA,0,0,DXA,0,0,.6,.7,1,.07);
    det(-DXA,angA,flA,resA);det(DXA,angB,flB,resB);
    pts.up();lines.up();
  }
  function drawChart(){
    const c=$('#bChart'),g=c.getContext('2d'),CW=c.width,H=c.height,pl=52,pr=16,pt=18,pb=40;
    const Xp=th=>pl+(CW-pl-pr)*th/Math.PI,Yp=e=>pt+(H-pt-pb)*(1-e)/2;
    const cg=css('--chart-grid'),ct=css('--chart-text'),ca=css('--a'),cb=css('--b'),cd=css('--chart-dot');
    g.clearRect(0,0,CW,H);g.lineWidth=1;g.strokeStyle=cg;g.beginPath();
    for(const e of [-1,0,1]){g.moveTo(Xp(0),Yp(e));g.lineTo(Xp(Math.PI),Yp(e))}
    for(const th of [0,Math.PI/2,Math.PI]){g.moveTo(Xp(th),Yp(-1));g.lineTo(Xp(th),Yp(1))}g.stroke();
    g.fillStyle=ct;g.font='20px '+(css('--font-sans')||'sans-serif');g.textAlign='right';g.textBaseline='middle';
    g.fillText('+1',pl-8,Yp(1));g.fillText('0',pl-8,Yp(0));g.fillText('−1',pl-8,Yp(-1));
    g.textAlign='center';g.textBaseline='top';g.fillText('0°',Xp(0),H-pb+8);g.fillText('90°',Xp(Math.PI/2),H-pb+8);g.fillText('180°',Xp(Math.PI)-12,H-pb+8);
    g.setLineDash([9,7]);g.strokeStyle=cb;g.lineWidth=2.5;g.beginPath();g.moveTo(Xp(0),Yp(-1));g.lineTo(Xp(Math.PI),Yp(1));g.stroke();g.setLineDash([]);
    g.strokeStyle=ca;g.lineWidth=3;g.beginPath();for(let i=0;i<=90;i++){const th=i/90*Math.PI;g.lineTo(Xp(th),Yp(-Math.cos(th)))}g.stroke();
    g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle=ca;g.fillText(L('量子 −cos θ','quantum −cos θ'),pl+14,pt+24);g.fillStyle=cb;g.fillText(L('一种局域模型（直线）','a local model (straight line)'),pl+14,pt+52);
    for(let b=0;b<37;b++){if(nb[b]<12)continue;const E=sb[b]/nb[b],se=Math.sqrt(Math.max(1e-6,1-E*E)/nb[b]),x=Xp(b*Math.PI/36);
      g.strokeStyle=cd;g.globalAlpha=.7;g.lineWidth=2;g.beginPath();g.moveTo(x,Yp(E-2*se));g.lineTo(x,Yp(E+2*se));g.stroke();g.globalAlpha=1;
      g.fillStyle=cd;g.beginPath();g.arc(x,Yp(E),6,0,TAU);g.fill()}
  }
  function read(){
    const E=i=>n4[i]?s4[i]/n4[i]:0;let h;
    if(mode==='chsh'){
      const S=E(0)-E(1)+E(2)+E(3),nn=n4[0]+n4[1]+n4[2]+n4[3],ok=Math.min(n4[0],n4[1],n4[2],n4[3])>=5;
      let v=0;for(let i=0;i<4;i++)v+=n4[i]?(1-E(i)*E(i))/n4[i]:1;
      h=`<span class="big">|S| = ${ok?Math.abs(S).toFixed(3):'—'}</span>${ok?' ± '+Math.sqrt(v).toFixed(3):''}<br>`+L(`已统计 <b>${nn}</b> 对 · 经典上限 2 · 量子预言 2√2 ≈ 2.828`,`<b>${nn}</b> pairs counted · classical bound 2 · quantum prediction 2√2 ≈ 2.828`);
      $('#bFill').style.width=(ok?clamp(Math.abs(S)/3,0,1)*100:0)+'%';
    }else{
      const bin=Math.round(theta/(Math.PI/36)),n=nb[bin],e=n?sb[bin]/n:0,deg=Math.round(theta*180/Math.PI);
      h=`<span class="big">E(${deg}°) = ${n>=5?e.toFixed(3):'—'}</span><br>`+L(`量子 −cos θ = ${W.correlation(theta).toFixed(3)} · 局域模型的直线 = ${W.linearModel(theta).toFixed(3)}<br>该角度已统计 <b>${n}</b> 对`,`quantum −cos θ = ${W.correlation(theta).toFixed(3)} · local-model line = ${W.linearModel(theta).toFixed(3)}<br><b>${n}</b> pairs counted at this angle`);
    }
    $('#bRead').innerHTML=h;drawChart();
  }
  seg('#bMode',v=>{mode=v;$('#bThetaRow').hidden=v!=='free';$('#bBar').hidden=v==='free';if(v==='free'){goalA=0;goalB=theta}read()});
  seg('#bSpeed',v=>{speed=+v});
  $('#bTh').oninput=e=>{theta=+e.target.value*Math.PI/180;$('#bThO').textContent=e.target.value+'°';goalB=theta;read()};
  $('#bReset').onclick=()=>{reset();read()};
  return {update,read,drawChart};
})();
redrawChart=()=>bell.drawChart();

addLabel('atom',[0,19,0],L('原子 · 概率云','Atom · probability cloud'),{major:1});
addLabel('slit',[0,20,0],L('双缝 · 干涉','Double slit · interference'),{major:1});
addLabel('tun',[0,15,0],L('隧穿 · 势垒','Tunnelling · barrier'),{major:1});
addLabel('bell',[0,10,0],L('纠缠 · 贝尔检验','Entanglement · Bell test'),{major:1});

/* ───────── 导航与输入 ───────── */
const KEYS=['overview','atom','slit','tun','bell'],MODS={atom,slit,tun,bell};
function goTo(k){
  active=k;const s=ST[k];cam.g.tgt=toWorld(s,s.tLocal);
  if(k!=='overview'&&k!=='atom')cam.g.yaw=cam.yaw+wrapPi(s.rot+s.yawOff-cam.yaw);
  cam.g.pitch=s.pitch;cam.g.zoom=1;
  for(const b of $$('#nav button'))b.classList.toggle('on',b.dataset.k===k);
  for(const sec of $$('#panel section'))sec.hidden=sec.dataset.k!==k;
  $('#panel').scrollTop=0;if(MODS[k])MODS[k].read();
}
for(const b of $$('#nav button'))b.onclick=()=>goTo(b.dataset.k);
// 手机上嵌在游乐场里时先收起面板，先看到场景（面板右上角“展开”）
if(EMBED&&innerWidth<520&&innerHeight<760){$('#panel').classList.add('folded');$('#fold').textContent=L('展开','Unfold')}
for(const b of $$('[data-go]'))b.onclick=()=>goTo(b.dataset.go);
$('#fold').onclick=e=>{const f=$('#panel').classList.toggle('folded');e.currentTarget.textContent=f?L('展开','Unfold'):L('收起','Fold')};
addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement||e.metaKey||e.ctrlKey||e.altKey)return;
  const i='12345'.indexOf(e.key);if(i>=0)goTo(KEYS[i]);
  else if(e.key==='ArrowRight')goTo(KEYS[(KEYS.indexOf(active)+1)%5]);
  else if(e.key==='ArrowLeft')goTo(KEYS[(KEYS.indexOf(active)+4)%5]);
});
const ptrs=new Map();let pinch0=0;
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);canvas.classList.add('drag');lastInput=time});
canvas.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];p[0]=e.clientX;p[1]=e.clientY;
  if(ptrs.size===1){cam.g.yaw-=dx*.0055;cam.g.pitch=clamp(cam.g.pitch+dy*.0045,-.25,1.45)}
  else if(ptrs.size===2){const q=[...ptrs.values()],d=Math.hypot(q[0][0]-q[1][0],q[0][1]-q[1][1]);if(pinch0>0)cam.g.zoom=clamp(cam.g.zoom*pinch0/d,.3,2.6);pinch0=d}
  lastInput=time});
const ptrUp=e=>{ptrs.delete(e.pointerId);pinch0=0;if(!ptrs.size)canvas.classList.remove('drag')};
canvas.addEventListener('pointerup',ptrUp);canvas.addEventListener('pointercancel',ptrUp);
// 嵌在游乐场里时，没点过画面的滚轮留给外面的页面滚动
canvas.addEventListener('wheel',e=>{if(EMBED&&!e.ctrlKey&&document.activeElement!==canvas)return;e.preventDefault();cam.g.zoom=clamp(cam.g.zoom*Math.exp(e.deltaY*.0012),.3,2.6);lastInput=time},{passive:false});

/* ───────── 渲染循环 ───────── */
let dprCap=Math.min(2,window.devicePixelRatio||1);
function resize(){
  const dpr=Math.min(dprCap,window.devicePixelRatio||1);
  const w=Math.max(2,Math.round(canvas.clientWidth*dpr)),h=Math.max(2,Math.round(canvas.clientHeight*dpr));
  if(canvas.width!==w||canvas.height!==h||!T){canvas.width=w;canvas.height=h;allocTargets(w,h)}
}
function drawScene(){
  gl.useProgram(PP.p);gl.uniform1f(PP.u.uScale,canvas.height/(2*Math.tan(FOV/2)));gl.uniform1f(PP.u.uTime,time);gl.uniform1f(PP.u.uMaxPt,MAXPT);
  for(const b of batches){if(!b.n||b.mode!==gl.POINTS)continue;
    gl.uniformMatrix4fv(PP.u.uMVP,false,M4.mul(VP,b.st?b.st.model:ID,MVP));gl.uniform1f(PP.u.uWave,b.wave);gl.bindVertexArray(b.vao);gl.drawArrays(gl.POINTS,0,b.n)}
  gl.useProgram(PF.p);
  for(const b of batches){if(!b.n||b.mode===gl.POINTS)continue;
    gl.uniformMatrix4fv(PF.u.uMVP,false,M4.mul(VP,b.st?b.st.model:ID,MVP));gl.bindVertexArray(b.vao);gl.drawArrays(b.mode,0,b.n)}
}
function render(){
  const W=canvas.width,H=canvas.height;
  gl.bindFramebuffer(gl.FRAMEBUFFER,T.scene.fb);gl.viewport(0,0,W,H);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);drawScene();gl.disable(gl.BLEND);
  pass(PD,T.half,u=>{bindTex(0,T.scene.tex,u.uTex);gl.uniform2f(u.uTexel,1/W,1/H)});
  pass(PD,T.q1,u=>{bindTex(0,T.half.tex,u.uTex);gl.uniform2f(u.uTexel,1/T.half.w,1/T.half.h)});
  pass(PB,T.q2,u=>{bindTex(0,T.q1.tex,u.uTex);gl.uniform2f(u.uDir,1/T.q1.w,0)});
  pass(PB,T.q1,u=>{bindTex(0,T.q2.tex,u.uTex);gl.uniform2f(u.uDir,0,1/T.q1.h)});
  pass(PD,T.e1,u=>{bindTex(0,T.q1.tex,u.uTex);gl.uniform2f(u.uTexel,1/T.q1.w,1/T.q1.h)});
  pass(PB,T.e2,u=>{bindTex(0,T.e1.tex,u.uTex);gl.uniform2f(u.uDir,1/T.e1.w,0)});
  pass(PB,T.e1,u=>{bindTex(0,T.e2.tex,u.uTex);gl.uniform2f(u.uDir,0,1/T.e1.h)});
  pass(PC,null,u=>{bindTex(0,T.scene.tex,u.uScene);bindTex(1,T.q1.tex,u.uB1);bindTex(2,T.e1.tex,u.uB2);gl.uniform1f(u.uTime,time);gl.uniform1f(u.uLight,light?1:0)});
}
let last=performance.now(),frameAvg=16,slow=0,tick=0;
function degrade(){
  if(dprCap>1.01)dprCap=Math.max(1,dprCap-.5);
  else if(atom.N>12000)atom.setN(atom.N-9000);
  frameAvg=16;
}
function frame(now){
  if(stops.host||stops.offscreen||stops.hidden){last=now;requestAnimationFrame(frame);return}
  const raw=(now-last)/1000;last=now;
  if(raw<.2)frameAvg+=(raw*1000-frameAvg)*.05;
  if(frameAvg>26&&time>4){if(++slow>90){slow=0;degrade()}}else slow=Math.max(0,slow-1);
  step(clamp(raw,.001,.05));
  requestAnimationFrame(frame);
}
function step(dt){
  time+=dt;
  if((tick++&15)===0){
    const p=$('#panel').getBoundingClientRect();
    const W=innerWidth,H=innerHeight;   // 让出面板占的地方，并按剩余可视区调整取景距离
    if(W>820){cam.gsx=p.width/W*.9;cam.gsy=0;cam.fit=Math.max(1,1.5*H/Math.max(200,W-p.width-20))}
    else{cam.gsx=0;cam.gsy=-p.height/H*.8;cam.fit=Math.max(1,1.5*H/W,1/Math.max(.3,1-p.height/H))}
    if(MODS[active])MODS[active].read();
  }
  resize();updateCamera(dt);
  env.update(dt);atom.update(dt);slit.update(dt);tun.update(dt);bell.update(dt);
  render();updateLabels();
}
goTo('overview');
// 不在屏幕上（滚走了、标签页在后台、游乐场换到别的游戏）时不算也不画
document.addEventListener('visibilitychange',()=>{stops.hidden=document.hidden});
if('IntersectionObserver' in window)new IntersectionObserver(es=>{for(const e of es)stops.offscreen=!e.isIntersecting}).observe(canvas);
requestAnimationFrame(t=>{last=t;requestAnimationFrame(frame)});
// 调试用：__quantum.advance(秒) 按固定步长推进整个世界
window.__quantum={get fps(){return 1000/frameAvg},get time(){return time},get running(){return !(stops.host||stops.offscreen||stops.hidden)},get light(){return light},goTo,HDR,mods:MODS,advance(s){for(let i=0,n=Math.round(s*60);i<n;i++)step(1/60)}};
})();

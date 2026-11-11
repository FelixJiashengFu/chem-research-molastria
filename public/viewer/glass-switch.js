/* 液态玻璃音乐开关：一颗玻璃透镜在胶囊里滑动，打开时音乐慢慢涌出，关掉时被吸走。原作是站长 Fe 的两件作品
   （“电子跃迁开关”和“黑洞开关”，2026-11-11），这里把两件共用的部分（玻璃、拖动的弹簧、Web Audio 合成）合成一份，
   画面（WebGL 片元着色器）、音乐和文字按 variant 区分：
     hydrogen   氢原子 1s → 2p 的叠加态 ψ = cos θ·1s + sin θ·2p_z·e^{−iφ}，背景是像素光波，钟声按巴耳末系 Hα–Hδ 的频率比
     blackhole  像素星空被引力透镜扭曲，吸积盘和光子环（示意，不是光线追踪），四个和弦循环
   用法：MolAstriaGlassSwitch.mount(el, { variant: 'hydrogen' | 'blackhole', lang: 'zh' | 'en', mute: false })，返回 { off, destroy }；
   mute: false 时不在提示里重复“关掉静音模式”（页面自己写一次）。
   规矩：不自动出声（AudioContext 只在点按或拖动时建）；同一页只让一个开关出声（打开一个，别的自动关）；
   滚出视野或页面藏起来时不画；页面藏起来时声音暂停，回来再接着放；prefers-reduced-motion 时不弹跳、直接滑到位。
   界面文字自带中英两版（跟 opts.lang，缺省看 <html lang>），整块标 translate="no"，不走站点词典。
   没有 WebGL 时退回 canvas 2D 画一个简单的圆。window.MolAstriaGlassSwitch。 */
(function (root) {
  'use strict';

  const COMMON_HEAD = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime,uX,uT,uS,uLevel,uA,uPh;',
    'const float PX=60.;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float s=0.,m=.5;for(int i=0;i<4;i++){s+=m*noise(p);p=p*2.03+vec2(17.1,9.2);m*=.5;}return s;}',
    'float b2(vec2 c){c=floor(c);return fract(c.x/2.+c.y*c.y*.75);}',
    'float b4(vec2 c){return b2(.5*c)*.25+b2(c);}',
    'vec3 ramp(float t,vec3 c0,vec3 c1,vec3 c2,vec3 c3){',
    ' vec3 c=mix(c0,c1,smoothstep(0.,.34,t));c=mix(c,c2,smoothstep(.34,.67,t));return mix(c,c3,smoothstep(.67,1.,t));}',
  ];
  // 液态玻璃透镜：边缘菲涅耳、左上高光、右下焦散（两件作品相同，只有边缘色调和弧光强度不同）
  const lensTail = (rimTint, arcK) => [
    ' vec2 L=normalize(vec2(-.6,.8));float nl=dot(dir,L);',
    ' float rim=smoothstep(R-.05,R-.002,r)*inL;',
    ` col+=rim*.13*vec3(${rimTint});`,
    ' float edge=exp(-pow((r-R+.007)/.0055,2.));',
    ' col+=edge*(.12+.8*pow(max(nl,0.),3.)+.4*pow(max(-nl,0.),6.));',
    ' float arc=smoothstep(.7*R,.79*R,r)*(1.-smoothstep(.84*R,.92*R,r))*pow(max(nl,0.),9.);',
    ` col+=arc*${arcK};`,
    ' gl_FragColor=vec4(col,1.);}',
  ];

  const HYDROGEN_FS = COMMON_HEAD.concat([
    // 背景：像素化的光波（沿 x 传播的平面波条纹），振幅跟随音量
    'vec3 scene(vec2 q){',
    ' vec2 cell=floor(q*PX);vec2 qp=cell/PX;',
    ' float k=mix(24.,38.,uT);',
    ' float w=sin(qp.x*k-uTime*1.7+2.6*fbm(qp*1.5+uTime*.03));',
    ' float n=fbm(qp*2.3+vec2(0.,uTime*.025));',
    ' float t=.37+.27*w*(.3+.7*uA)+(n-.5)*.75-abs(qp.y)*.22;',
    ' t+=(b4(cell)-.5)*.2;',
    ' t=floor(clamp(t,0.,1.)*6.)/6.;',
    ' vec3 cOff=ramp(t,vec3(.01,.045,.06),vec3(.02,.17,.2),vec3(.06,.4,.42),vec3(.4,.88,.78));',
    ' vec3 cOn=ramp(t,vec3(.06,.025,.13),vec3(.22,.09,.4),vec3(.52,.2,.7),vec3(1.,.62,.88));',
    ' vec3 col=mix(cOff,cOn,uT);',
    ' float h=hash(cell+3.7);',
    ' if(h>.99)col+=vec3(.8,1.,.95)*(.5+.5*sin(uTime*2.+h*40.))*(.5+.6*uA);',
    ' return col;}',
    // 氢原子波函数（原子单位）：psi = c1*1s + c2*2pz*exp(-i*phi)，返回复数；1/√π = .5642，1/(4√(2π)) = .09974
    'vec2 psi(vec3 P,float c1,float c2,float cp,float sp){',
    ' float r=length(P);float a=c1*.5642*exp(-r);float b=c2*.09974*P.z*exp(-.5*r);',
    ' return vec2(a+b*cp,-b*sp);}',
    'void main(){',
    ' vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    ' vec2 c=vec2(uX,0.);vec2 d=p-c;d.x/=(1.+uS);d.y*=(1.+uS*.45);',
    ' float r=length(d);vec2 dir=d/max(r,1e-4);',
    ' float R=.452;',
    ' float inL=1.-smoothstep(R-.004,R+.004,r);',
    ' vec3 col;',
    ' if(inL>.001){',
    '  float gl=.7+.65*pow(r/R,4.);',
    '  col=scene(c+d*gl)*.42;',
    '  float th=uT*1.5708;float c1=cos(th),c2=sin(th);float cp=cos(uPh),sp=sin(uPh);',
    '  vec2 cell=floor(d*PX*2.);vec2 dq=(cell+.5)/(PX*2.);',
    '  vec2 A=dq/R*mix(3.6,7.5,c2*c2);',
    '  float rho=0.;',
    '  for(int i=0;i<9;i++){float y=float(i)-4.;vec2 z=psi(vec3(A.x,y,A.y),c1,c2,cp,sp);rho+=dot(z,z);}',
    '  vec2 z0=psi(vec3(A.x,0.,A.y),c1,c2,cp,sp);',
    '  float gain=1./mix(.42,.018,c2*c2);',
    '  float tone=pow(min(rho*gain,1.),.36)*(1.+uLevel*.45);',
    '  vec2 zn=z0/max(length(z0),1e-9);',
    '  vec3 kk=vec3(2.2,0.,4.4);vec3 pc=vec3(.6)+vec3(.4)*(zn.x*cos(kk)-zn.y*sin(kk));',
    '  pc=mix(pc,mix(vec3(.3,1.,.82),vec3(.82,.5,1.),uT),.35);',
    '  float rnd=hash(cell+floor(uTime*10.)*7.31);',
    '  float dotp=step(rnd,tone*tone*.9);',
    '  float fade=1.-smoothstep(R*.86,R*.98,r);',
    '  col+=pc*(tone*tone*.5+dotp*.5)*fade;',
    '  col+=vec3(1.)*pow(min(tone,1.2),6.)*.16*fade;',
    '  col+=vec3(1.,.98,.9)*exp(-r*r/.00006);',
    '  if(inL<.999)col=mix(scene(p),col,inL);',
    ' }else{',
    '  col=scene(p);',
    '  float shd=exp(-max(length(d-vec2(0.,-.025))-R,0.)/.05)*.5;col*=1.-shd;',
    ' }',
  ], lensTail('.8,.95,1.', '.22')).join('\n');

  const BLACKHOLE_FS = COMMON_HEAD.concat([
    // 像素宇宙：抖动星云 + 星点 + 十字星 + 一颗带环小行星
    'vec3 scene(vec2 q){',
    ' vec2 cell=floor(q*PX);vec2 qp=cell/PX;',
    ' float n=fbm(qp*2.1+vec2(uTime*.02,0.));',
    ' float t=n*.95+(-qp.y)*.5-.12;',
    ' t+=(b4(cell)-.5)*.2;',
    ' float tOff=floor(clamp(t*.8,0.,1.)*6.)/6.;float tOn=floor(clamp(t+.16,0.,1.)*6.)/6.;',
    ' vec3 cOff=ramp(tOff,vec3(.02,.02,.08),vec3(.07,.08,.3),vec3(.2,.17,.62),vec3(.45,.36,.9));',
    ' vec3 cOn=ramp(tOn,vec3(.1,.04,.17),vec3(.34,.13,.42),vec3(.74,.31,.3),vec3(.97,.66,.36));',
    ' vec3 col=mix(cOff,cOn,uT);',
    ' float h=hash(cell+3.7);',
    ' if(h>.988)col+=vec3(.85,.88,1.)*(.55+.45*sin(uTime*2.+h*40.))*(.8+.5*uA);',
    ' vec2 g=floor(cell/11.);vec2 l=cell-g*11.;float hg=hash(g+9.1);',
    ' vec2 o=floor(vec2(hash(g+1.3),hash(g+2.9))*7.)+2.;vec2 d=abs(l-o);',
    ' float arm=hg>.9?2.:1.;',
    ' if(hg>.66&&((d.x<.5&&d.y<arm+.5)||(d.y<.5&&d.x<arm+.5)))',
    '  col=mix(col,vec3(1.,.97,.9),.55+.45*sin(uTime*1.3+hg*30.));',
    ' vec2 pd=qp-vec2(.03,.13);float pr=length(pd);',
    ' float ca=cos(.42),sa=sin(.42);vec2 e=vec2(ca*pd.x+sa*pd.y,-sa*pd.x+ca*pd.y);',
    ' float rr=length(e*vec2(1.,3.4));bool ring=abs(rr-.15)<.016;',
    ' if(ring&&e.y>0.)col=vec3(.9,.76,.55);',
    ' if(pr<.082){float sh=dot(normalize(pd+vec2(1e-4)),vec2(-.6,.75))*pr/.082;',
    '  sh+=(b4(cell)-.5)*.5;col=sh>.1?vec3(.42,.86,.8):(sh>-.45?vec3(.2,.56,.62):vec3(.1,.28,.42));',
    '  if(mod(cell.y,4.)<1.)col*=.82;}',
    ' if(ring&&e.y<=0.)col=vec3(.98,.86,.62);',
    ' return col;}',
    'void main(){',
    ' vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    ' vec2 c=vec2(uX,0.);vec2 d=p-c;d.x/=(1.+uS);d.y*=(1.+uS*.45);',
    ' float r=length(d);vec2 dir=d/max(r,1e-4);',
    ' float R=.452,rh=.132;',
    ' float inL=1.-smoothstep(R-.004,R+.004,r);',
    ' float k=rh*rh*1.2;',
    ' float fall=r>R?exp(-(r-R)*7.):1.;',
    ' float sw=1.7*pow(rh/max(r,rh*.5),2.)*(1.+uS*5.)*fall;',
    ' float cs=cos(sw),sn=sin(sw);',
    ' vec3 col;',
    ' if(inL>.001){',
    '  float gl=.76+.6*pow(r/R,4.);',
    '  vec3 acc=vec3(0.);',
    '  for(int i=0;i<3;i++){float f=.9+.1*float(i);',
    '   vec2 dd=d*(1.-k*f/max(r*r,1e-4))*gl;dd=vec2(cs*dd.x-sn*dd.y,sn*dd.x+cs*dd.y);',
    '   vec3 s=scene(c+dd);if(i==0)acc.r=s.r;else if(i==1)acc.g=s.g;else acc.b=s.b;}',
    '  col=acc*1.1+.015;',
    '  if(inL<.999)col=mix(scene(p),col,inL);',
    ' }else{',
    '  vec2 dd=d*(1.-k*fall/max(r*r,1e-4));dd=vec2(cs*dd.x-sn*dd.y,sn*dd.x+cs*dd.y);',
    '  col=scene(c+dd);',
    '  float shd=exp(-max(length(d-vec2(0.,-.025))-R,0.)/.05)*.5;col*=1.-shd;',
    ' }',
    // 吸积盘与光子环
    ' float ang=atan(d.y,d.x);',
    ' float sp=ang+3.2*log(max(r,1e-3)/rh)-uTime*.55;',
    ' float streak=fbm(vec2(cos(sp),sin(sp))*2.4+r*7.);',
    ' float energy=mix(.6,1.,uT)*(1.+uLevel*1.6);',
    ' float dop=1.+.45*cos(ang-2.5);',
    ' vec3 hot=mix(vec3(.56,.48,1.),vec3(1.,.6,.28),uT);',
    ' float disk=pow(rh/max(r,rh),2.7)*(.25+1.1*streak)*smoothstep(rh,rh*1.3,r)*(1.-smoothstep(R*.85,R*1.25,r));',
    ' col+=hot*disk*1.15*dop*energy;',
    ' float ring=exp(-pow((r-rh*1.17)/(rh*.085),2.));',
    ' col+=mix(hot,vec3(1.),.78)*ring*1.55*dop*energy;',
    ' float fr=exp(-pow((r-rh*1.36)/(rh*.07),2.));',
    ' col+=fr*.3*energy*(.5+.5*cos(6.2832*(ang/3.1416+uTime*.05+vec3(0.,.33,.67))));',
    ' col*=smoothstep(rh*.95,rh*1.02,r);',
  ], lensTail('.8,.86,1.', '.2')).join('\n');

  // 巴耳末系 Hα Hβ Hγ Hδ 的频率比 5/36 : 3/16 : 21/100 : 2/9（1/4 − 1/n²，n = 3…6），把 Hα 定在 330 Hz
  const BALMER = [330, 330 * (3 / 16) / (5 / 36), 330 * (21 / 100) / (5 / 36), 330 * (2 / 9) / (5 / 36)];
  const SEQ = [0, 2, 1, 3, -1, 2, 3, -1, 1, 3, 2, -1, 0, 3, -1, 2];

  const VARIANTS = {
    hydrogen: {
      fs: HYDROGEN_FS,
      chords: [{ b: 55, n: [110, 165, 220, 330] }],
      bell: (s, step) => BALMER[s] * (step % 7 === 0 ? 2 : 1),
      bg: '#02090b',
      fallback: { off: ['#03161a', '#128078', '#8ff5dc'], on: ['#1a0a33', '#8a3ac0', '#e3b0ff'], core: 0.02, coreFill: '#fff' },
      name: ['氢原子音乐', 'Hydrogen music'],
      state: [['1s 基态', '1s ground state'], ['2p 激发态', '2p excited state']],
      read: (t, a, en) => {
        const th = t * Math.PI / 2, s2 = Math.sin(th) ** 2;
        const E = (13.6 * (1 - s2) + 3.4 * s2).toFixed(2);
        return en ? `⟨E⟩ = −${E} eV · volume ${Math.round(a * 100)}%` : `⟨E⟩ = −${E} eV · 音量 ${Math.round(a * 100)}%`;
      },
      hint: ['点按或拖动电子云，相当于给氢原子打一个 π 脉冲。', 'Tap or drag the electron cloud: it is like giving the hydrogen atom a π pulse.'],
      phase: (t, dt) => { const th = t * Math.PI / 2; return dt * (0.35 + 5 * Math.sin(2 * th) ** 2); },
    },
    blackhole: {
      fs: BLACKHOLE_FS,
      chords: [
        { b: 110.00, n: [220.00, 261.63, 329.63, 493.88] },
        { b: 87.31, n: [174.61, 261.63, 329.63, 440.00] },
        { b: 130.81, n: [196.00, 261.63, 329.63, 493.88] },
        { b: 82.41, n: [196.00, 246.94, 293.66, 392.00] },
      ],
      bell: (s, step, chord) => chord.n[s] * (step % 7 === 0 ? 4 : 2),
      bg: '#05040f',
      fallback: { off: ['#0a0a2a', '#2c2596', '#c9c2ff'], on: ['#3a1650', '#d4683f', '#ffd9a8'], core: 0.132, coreFill: '#000' },
      name: ['宇宙音乐', 'Cosmic music'],
      state: [['静默', 'Silent'], ['播放中', 'Playing']],
      read: (t, a, en) => (en ? `accretion volume ${Math.round(a * 100)}%` : `吸积音量 ${Math.round(a * 100)}%`),
      hint: ['点按或拖动黑洞。', 'Tap or drag the black hole.'],
      phase: () => 0,
    },
  };
  const MUTE = ['听不到声音时，请关闭设备的静音模式。', 'No sound? Turn off your device’s silent mode.'];

  const live = new Set(); // 已挂上的开关；同一时间只让一个出声
  const pageLang = () => (/^en/i.test(document.documentElement.lang) ? 'en' : 'zh');

  function mount(host, opts = {}) {
    const V = VARIANTS[opts.variant] || VARIANTS.hydrogen;
    const en = (opts.lang === 'en' || opts.lang === 'zh' ? opts.lang : pageLang()) === 'en';
    const L = (pair) => pair[en ? 1 : 0];
    host.classList.add('gsw', `gsw-${opts.variant in VARIANTS ? opts.variant : 'hydrogen'}`);
    host.setAttribute('translate', 'no');
    host.lang = en ? 'en' : 'zh-CN';
    host.innerHTML = '<div class="gsw-wrap"><div class="gsw-glow"></div>'
      + '<button class="gsw-switch" type="button" role="switch" aria-checked="false"><canvas></canvas></button></div>'
      + '<div class="gsw-status"><div class="gsw-state" aria-live="polite"></div><div class="gsw-read"></div><p class="gsw-hint"></p></div>';
    const sw = host.querySelector('.gsw-switch'), stateEl = host.querySelector('.gsw-state'), readEl = host.querySelector('.gsw-read');
    let cv = sw.querySelector('canvas');
    sw.style.background = V.bg;
    sw.setAttribute('aria-label', L(V.name));
    stateEl.textContent = L(V.state[0]);
    host.querySelector('.gsw-hint').textContent = opts.mute === false ? L(V.hint) : `${L(V.hint)}${en ? ' ' : ''}${L(MUTE)}`;
    const reduce = !!(root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    let on = false, x = 0, v = 0, dragging = false, a = 0, level = 0, ph = 0, stretch = 0;
    let visible = false, raf = 0, prev = 0, dead = false;

    // ── WebGL ──
    let gl = null, U = {}, ctx2d = null;
    try { gl = cv.getContext('webgl', { antialias: false, alpha: false }) || cv.getContext('experimental-webgl'); } catch { gl = null; }
    if (gl) {
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const vs = mk(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'), fs = mk(gl.FRAGMENT_SHADER, V.fs);
      const pr = gl.createProgram();
      if (vs && fs) { gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr); }
      if (!vs || !fs || !gl.getProgramParameter(pr, gl.LINK_STATUS)) gl = null;
      else {
        gl.useProgram(pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        for (const n of ['uRes', 'uTime', 'uX', 'uT', 'uS', 'uLevel', 'uA', 'uPh']) U[n] = gl.getUniformLocation(pr, n);
      }
    }
    if (!gl) { const c2 = cv.cloneNode(false); sw.replaceChild(c2, cv); cv = c2; ctx2d = cv.getContext('2d'); }

    function resize() {
      const r = sw.getBoundingClientRect(), dpr = Math.min(root.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; if (gl) gl.viewport(0, 0, w, h); }
    }
    function draw(time) {
      const w = cv.width, h = cv.height, span = w / h / 2 - 0.5, t = Math.min(1, Math.max(0, x));
      if (gl) {
        gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uX, (x * 2 - 1) * span);
        gl.uniform1f(U.uT, t); gl.uniform1f(U.uS, stretch); gl.uniform1f(U.uLevel, level); gl.uniform1f(U.uA, a); gl.uniform1f(U.uPh, ph);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else if (ctx2d) {
        const F = V.fallback, c = t > 0.5 ? F.on : F.off, g = ctx2d.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); ctx2d.fillStyle = g; ctx2d.fillRect(0, 0, w, h);
        const cx = w / 2 + (x * 2 - 1) * span * h;
        ctx2d.beginPath(); ctx2d.arc(cx, h / 2, h * 0.17, 0, 7); ctx2d.fillStyle = c[2]; ctx2d.fill();
        ctx2d.beginPath(); ctx2d.arc(cx, h / 2, h * F.core, 0, 7); ctx2d.fillStyle = F.coreFill; ctx2d.fill();
      }
    }

    // ── 音频：全部用 Web Audio 合成，第一次点按时才建 ──
    const AC = root.AudioContext || root.webkitAudioContext;
    let ac = null, master, filter, detuneBus, bellBus, comp, analyser, noiseBuf, tdata, bass;
    const voices = [];
    let chordIdx = 0, nextChord = 0, nextNote = 0, step = 0;
    const CH = V.chords;
    function initAudio() {
      if (ac || !AC) return;
      try { ac = new AC(); } catch { ac = null; return; }
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      analyser = ac.createAnalyser(); analyser.fftSize = 512; tdata = new Uint8Array(analyser.fftSize);
      comp.connect(analyser); analyser.connect(ac.destination);
      master = ac.createGain(); master.gain.value = 0; master.connect(comp);
      filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 90; filter.Q.value = 0.7;
      const dry = ac.createGain(); dry.gain.value = 0.75; filter.connect(dry); dry.connect(master);
      // 合成混响
      const len = Math.floor(ac.sampleRate * 3.6), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      const conv = ac.createConvolver(); conv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.55;
      filter.connect(conv); conv.connect(wet); wet.connect(master);
      // 噪声素材（吸入 / 涌出的气流声）
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
      // 统一的音高总线：被吸入时所有声音一起下坠
      detuneBus = ac.createConstantSource ? ac.createConstantSource() : null;
      if (detuneBus) { detuneBus.offset.value = -1400; detuneBus.start(); }
      // 铺底和弦
      const padBus = ac.createGain(); padBus.gain.value = 0.5; padBus.connect(filter);
      for (let k = 0; k < 4; k++) {
        const vg = ac.createGain(); vg.gain.value = 0.11;
        const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
        if (pan) { pan.pan.value = [-0.6, 0.35, -0.25, 0.6][k]; vg.connect(pan); pan.connect(padBus); } else vg.connect(padBus);
        voices.push([-8, 8].map((dt) => {
          const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = CH[0].n[k]; o.detune.value = dt;
          if (detuneBus) detuneBus.connect(o.detune); o.connect(vg); o.start(); return o;
        }));
      }
      bass = ac.createOscillator(); bass.type = 'triangle'; bass.frequency.value = CH[0].b;
      if (detuneBus) detuneBus.connect(bass.detune);
      const bg = ac.createGain(); bg.gain.value = 0.22; bass.connect(bg); bg.connect(filter); bass.start();
      // 钟声琶音 + 回声
      bellBus = ac.createGain(); bellBus.gain.value = 1; bellBus.connect(filter);
      const dl = ac.createDelay(1); dl.delayTime.value = 0.42; const fb = ac.createGain(); fb.gain.value = 0.42;
      bellBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(filter);
      nextChord = ac.currentTime + 9; nextNote = ac.currentTime + 0.6;
    }
    function bell(t, f) {
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6); g.connect(bellBus);
      for (const [m, amp] of [[1, 1], [2.01, 0.28]]) {
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
        const og = ac.createGain(); og.gain.value = amp; if (detuneBus) detuneBus.connect(o.detune);
        o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.7);
      }
    }
    function schedule() {
      const t = ac.currentTime;
      if (nextChord < t - 1) nextChord = t; if (nextNote < t) nextNote = t + 0.05;
      while (nextChord < t + 0.3) {
        chordIdx = (chordIdx + 1) % CH.length; const ch = CH[chordIdx];
        for (let k = 0; k < 4; k++) voices[k].forEach((o) => o.frequency.setTargetAtTime(ch.n[k], nextChord, 0.5));
        bass.frequency.setTargetAtTime(ch.b, nextChord, 0.4); nextChord += 9;
      }
      while (nextNote < t + 0.3) {
        const s = SEQ[step % SEQ.length]; step++;
        if (s >= 0 && on) bell(nextNote, V.bell(s, step, CH[chordIdx]));
        nextNote += 0.5625;
      }
    }
    function whoosh(inward) {
      if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t);
      if (inward) {
        bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(60, t + 1.7);
        g.gain.linearRampToValueAtTime(0.16, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        src.playbackRate.setValueAtTime(1, t); src.playbackRate.exponentialRampToValueAtTime(0.3, t + 1.7);
      } else {
        bp.frequency.setValueAtTime(120, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 2.4);
        g.gain.linearRampToValueAtTime(0.07, t + 1.3); g.gain.linearRampToValueAtTime(0, t + 2.6);
      }
      src.connect(bp); bp.connect(g); g.connect(comp); src.start(t); src.stop(t + 2.8);
    }
    function driveAudio() {
      if (!ac) return; const t = ac.currentTime;
      master.gain.setTargetAtTime(Math.pow(a, 1.6) * 0.85, t, 0.03);
      filter.frequency.setTargetAtTime(90 * Math.pow(2, a * 5.4), t, 0.03);
      filter.Q.setTargetAtTime(0.7 + (1 - a) * 5 * (a > 0 ? 1 : 0), t, 0.05);
      if (detuneBus) detuneBus.offset.setTargetAtTime(-Math.pow(1 - a, 1.6) * 1400, t, 0.03);
      if (ac.state === 'running') {
        schedule();
        analyser.getByteTimeDomainData(tdata); let s = 0;
        for (let i = 0; i < tdata.length; i += 4) { const q = (tdata[i] - 128) / 128; s += q * q; }
        const rms = Math.sqrt(s / (tdata.length / 4)); level += (Math.min(1, rms * 5) - level) * 0.2;
        if (!on && !dragging && a === 0) { level = 0; ac.suspend(); }
      }
    }

    // ── 交互 ──
    const api = {};
    function setOn(next, fromGesture) {
      const changed = next !== on; on = next;
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      stateEl.textContent = L(V.state[on ? 1 : 0]);
      host.classList.toggle('gsw-on', on);
      if (on) for (const other of live) if (other !== api) other.off();
      if (fromGesture) { initAudio(); if (ac && ac.state !== 'running' && on) ac.resume(); }
      if (changed && ac) whoosh(!on);
      wake();
    }
    let pid = null, sx = 0, x0 = 0, moved = 0, lastX = 0, lastT = 0;
    sw.addEventListener('pointerdown', (e) => {
      if (e.button) return; pid = e.pointerId; sx = e.clientX; x0 = x; moved = 0; lastX = e.clientX; lastT = performance.now();
      try { sw.setPointerCapture(pid); } catch { /* old browsers */ }
      if (ac && ac.state !== 'running') ac.resume();
      wake();
    });
    sw.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      const r = sw.getBoundingClientRect(), travel = Math.max(1, r.width - r.height), dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 6) {
        if (!dragging) { dragging = true; initAudio(); if (ac && ac.state !== 'running') ac.resume(); for (const other of live) if (other !== api) other.off(); }
        const nx = Math.min(1.03, Math.max(-0.03, x0 + dx / travel)), now = performance.now(), dt = Math.max(1, now - lastT) / 1000;
        v = v * 0.6 + 0.4 * ((e.clientX - lastX) / travel / dt); lastX = e.clientX; lastT = now; x = nx;
      }
    });
    function end(e, cancel) {
      if (e.pointerId !== pid) return; pid = null;
      if (dragging) { dragging = false; setOn(v > 1.5 ? true : (v < -1.5 ? false : x > 0.5), !cancel); } else if (!cancel) setOn(!on, true);
    }
    sw.addEventListener('pointerup', (e) => end(e, false));
    sw.addEventListener('pointercancel', (e) => end(e, true));
    sw.addEventListener('click', (e) => { if (e.detail === 0) setOn(!on, true); }); // 键盘（Enter / 空格）

    // ── 主循环：看得见时画；看不见但还在出声或还在动时只推进声音和弹簧 ──
    function settled() { return !dragging && Math.abs((on ? 1 : 0) - x) < 1e-4 && v === 0 && a === (on ? 1 : 0); }
    function frame(now) {
      raf = 0;
      if (dead) return;
      const dt = Math.min(0.05, (now - (prev || now)) / 1000); prev = now;
      if (!dragging) {
        const tgt = on ? 1 : 0;
        if (reduce) { x += (tgt - x) * Math.min(1, dt * 10); v = 0; } else { const n = 4, h = dt / n; for (let i = 0; i < n; i++) { v += (120 * (tgt - x) - 14 * v) * h; x += v * h; } }
        if (Math.abs(tgt - x) < 1e-4 && Math.abs(v) < 1e-3) { x = tgt; v = 0; }
      }
      const st = Math.min(0.12, Math.abs(v) * 0.035); stretch += (st - stretch) * Math.min(1, dt * 14);
      // 音量“存在感”：开启慢慢涌出，关闭被吸走
      const at = dragging ? Math.min(1, Math.max(0, x)) : (on ? 1 : 0);
      const up = dragging ? dt / 0.35 : dt / 3.2, down = dragging ? dt / 0.35 : dt / 1.9;
      a += Math.min(up, Math.max(-down, at - a));
      driveAudio();
      const t = Math.min(1, Math.max(0, x));
      ph += V.phase(t, dt);
      if (visible) {
        host.style.setProperty('--t', t.toFixed(3));
        readEl.textContent = V.read(t, a, en);
        resize(); draw(now / 1000);
      }
      if (visible || on || !settled() || (ac && ac.state === 'running')) raf = requestAnimationFrame(frame);
      else prev = 0;
    }
    function wake() { if (!raf && !dead) raf = requestAnimationFrame(frame); }

    readEl.textContent = V.read(0, 0, en);
    const io = root.IntersectionObserver ? new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) wake(); }) : null;
    if (io) io.observe(sw); else { visible = true; wake(); }
    const onVis = () => {
      if (!ac) return;
      if (document.hidden) ac.suspend(); else if (on) { ac.resume(); wake(); }
    };
    document.addEventListener('visibilitychange', onVis);

    api.off = () => { if (on) setOn(false, false); else if (dragging) { dragging = false; pid = null; wake(); } };
    api.destroy = () => {
      dead = true; live.delete(api); io?.disconnect(); document.removeEventListener('visibilitychange', onVis);
      if (raf) cancelAnimationFrame(raf);
      try { ac?.close(); } catch { /* already closed */ }
      try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* no extension */ }
      host.replaceChildren();
    };
    live.add(api);
    return api;
  }

  const offAll = () => { for (const s of live) s.off(); };
  root.MolAstriaGlassSwitch = { mount, offAll, variants: Object.keys(VARIANTS) };
})(typeof window !== 'undefined' ? window : globalThis);

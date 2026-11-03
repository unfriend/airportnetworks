// The studio: your own scenes. A scene is a folder of files (models, their textures, sounds) and its layout.json:
// objects placed from the models (GLTF/GLB and FBX, textured, animated), see-through trigger cubes that show and hide
// them as you walk in and out, and sounds placed in the room. Not one of the stories: no narration and no chapters, it
// opens straight into the scene. Scenes come from a relay started with --scenes <folder> (which also saves layouts), or
// from a plain folder with an index.json (&scenes=<folder>).
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/studio/build.mjs from the tour's kit, three.js r128's own loaders (tools/studio/vendor/), the sets
// and the engine in tools/studio: edit those, not this file. The contract is tools/studio/SPEC.md.
HOST.register('studio', function (HOST) {
'use strict';
const D2R = Math.PI / 180;
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// =================================================================== KIT ==
// Shared helpers for the 3D sets (the tour's kit): makeKit(THREE) returns K.
function makeKit(THREE) {
  const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, x) => a + (b - a) * x;
  // 0..1 progress of x through [a, b], smoothed
  const prog = (x, a, b) => smooth((x - a) / (b - a));
  // seeded random numbers: const r = rng(7); r() -> [0, 1)
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // normally distributed numbers from a seeded rng
  const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  // small vector helpers on plain arrays
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, x) => [a[0] + (b[0] - a[0]) * x, a[1] + (b[1] - a[1]) * x, a[2] + (b[2] - a[2]) * x],
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  };
  // a random unit vector
  const unit = r => { const z = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - z * z); return [s * Math.cos(t), z, s * Math.sin(t)]; };
  // '#ff8800' or [r, g, b] (0..1) -> [r, g, b]
  const rgb = c => (Array.isArray(c) ? c : (n => [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255])(parseInt(String(c).replace('#', ''), 16)));
  // colour ramp through stops [[t, [r,g,b]], ...]
  const ramp = (stops, t) => {
    if (t <= stops[0][0]) return stops[0][1].slice();
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return v3.lerp(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    return stops[stops.length - 1][1].slice();
  };

  // Uniforms shared by every set material. The story engine keeps them current:
  // uPx = half the drawing-buffer height in pixels times the world scale (so point sizes are in local units),
  // uTime = the clock in seconds (story time while the story plays).
  const U = { uPx: { value: 400 }, uTime: { value: 0 } };
  const GLSL = `
uniform float uPx, uTime;
// point size in pixels for a point 'size' local units across (never vanishes)
float pointPx(float size, vec4 mv) { return clamp(size * uPx * projectionMatrix[1][1] / max(-mv.z, 0.01), 1.5, 160.0); }
`;
  // every ShaderMaterial of a set gets the set's own fade uniform uA (0..1)
  // Glowing round points. Geometry attributes: position, aCol (vec3), aSize (float, local units), aA (float alpha)
  // opts: additive (default true), uniforms (extra), vertex (extra GLSL run at the end of main, may change
  // gl_PointSize, vC, vA, or gl_Position), head (extra declarations), hard (crisp discs instead of glow)
  function points(set, opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: U.uPx, uTime: U.uTime }, opts.uniforms || {}),
      transparent: true, depthWrite: false, blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: GLSL + `
attribute vec3 aCol; attribute float aSize, aA;
uniform float uA;
varying vec3 vC; varying float vA;
${opts.head || ''}
void main() {
  vec3 pos = position;
  vC = aCol; vA = aA * uA;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  ${opts.vertex || ''}
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `
varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  ${opts.hard ? 'float a = smoothstep(0.5, 0.42, d); vec3 col = vC;'
    : 'float core = smoothstep(0.5, 0.18, d), glow = pow(1.0 - d * 2.0, 1.6); float a = max(core * 0.85, glow * 0.6); vec3 col = mix(vC, vec3(1.0), smoothstep(0.22, 0.0, d) * 0.35);'}
  gl_FragColor = vec4(col, vA * a);
}`,
    });
    set.mats.push(m);
    return m;
  }
  // Lines (THREE.LineSegments). Attributes: position, aCol (vec3), aA (float alpha), aT (float 0..1, for reveals)
  // uniforms: uReveal (segments with aT > uReveal are hidden), plus opts.uniforms; opts.vertex as for points
  function lines(set, opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: U.uPx, uTime: U.uTime, uReveal: { value: 1 } }, opts.uniforms || {}),
      transparent: true, depthWrite: false, blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: GLSL + `
attribute vec3 aCol; attribute float aA, aT;
uniform float uA, uReveal;
varying vec3 vC; varying float vA;
${opts.head || ''}
void main() {
  vec3 pos = position;
  vC = aCol; vA = aA * uA * step(aT, uReveal + 0.0001);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  ${opts.vertex || ''}
}`,
      fragmentShader: `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`,
    });
    set.mats.push(m);
    return m;
  }
  // Lit surfaces: any built-in material (MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial ...).
  // The set's fade multiplies its opacity; base is the opacity at full fade-in.
  function fade(set, mat, base = 1) {
    mat.transparent = true;
    mat.userData.base = base;
    mat.opacity = base;
    set.fades.push(mat);
    return mat;
  }
  // a glassy bubble that glows at its rim (spheres, domes). opts: color, a0 (face-on alpha), a1 (rim alpha)
  function rim(set, opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uC: { value: new THREE.Color(...rgb(opts.color || [0.4, 0.8, 1.0])) }, uK: { value: 1 },
        uA0: { value: opts.a0 === undefined ? 0.06 : opts.a0 }, uA1: { value: opts.a1 === undefined ? 0.7 : opts.a1 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN, vW;
void main() {
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vN = normalize((modelMatrix * vec4(n, 0.0)).xyz); vec4 w = modelMatrix * p; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
      fragmentShader: `uniform float uA, uA0, uA1, uK; uniform vec3 uC; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float r = pow(1.0 - abs(dot(n, v)), 2.5);
  gl_FragColor = vec4(uC * (0.6 + 0.6 * r), (uA0 + uA1 * r) * uA * uK);
}`,
    });
    set.mats.push(m);
    return m;
  }
  // A new set: call at the start of makeSetXxx(K). Returns { group, uA, mats, fades, setAlpha(a) }
  function newSet(key) {
    const set = { key, group: new THREE.Group(), uA: { value: 1 }, mats: [], fades: [] };
    set.group.name = key;
    set.setAlpha = a => {
      set.uA.value = a;
      for (const m of set.fades) {
        const o = m.userData.base * a;
        m.opacity = o;
        m.depthWrite = o > 0.97 && m.userData.base > 0.97;
      }
      set.group.visible = a > 0.003;
    };
    return set;
  }
  // geometry for points: n points with position, aCol, aSize, aA (all zero; fill the arrays yourself)
  function pointsGeo(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    return g;
  }
  // geometry for n line segments (2n vertices): position, aCol, aA (1), aT (0)
  function linesGeo(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n * 2).fill(1), 1));
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(n * 2), 1));
    return g;
  }
  // a smooth tube through points [[x,y,z], ...]
  function tube(pts, radius, tubular, radial, closed) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), !!closed);
    return new THREE.TubeGeometry(curve, tubular || pts.length * 4, radius, radial || 6, !!closed);
  }
  // merge geometries that share the same attributes (indexed or not) into one
  function merge(list) {
    const geos = list.map(g => (g.index ? g.toNonIndexed() : g));
    const out = new THREE.BufferGeometry();
    for (const name of Object.keys(geos[0].attributes)) {
      const size = geos[0].attributes[name].itemSize;
      const arr = new Float32Array(geos.reduce((s, g) => s + g.attributes[name].count * size, 0));
      let o = 0;
      for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return out;
  }
  // give a geometry a constant vertex colour (for merged, vertexColors materials)
  function paint(geo, c) {
    const n = geo.attributes.position.count, a = new Float32Array(n * 3), col = rgb(c);
    for (let i = 0; i < n; i++) a.set(col, 3 * i);
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  }
  // free GPU memory of a set (the engine calls this on dispose)
  function dispose(set) {
    set.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }
  return { THREE, smooth, clamp, lerp, prog, rng, gauss, v3, unit, rgb, ramp, U, GLSL, points, lines, fade, rim, newSet,
    pointsGeo, linesGeo, tube, merge, paint, dispose };
}
const K = makeKit(THREE);
const { smooth, clamp } = K;

// ================================================================ VENDOR ==
// three.js r128's own add-ons (three@0.128.0, examples/js; MIT, as three.min.js: three.LICENSE.txt), unchanged, and
// fflate 0.6.9 (MIT, Arjun Barrett, https://github.com/101arrowz/fflate), which the FBX loader needs to unpack
// compressed binary arrays. Each add-on is its own function that sets THREE.<name> only; fflate is kept in this
// story's closure (its UMD wrapper finds no module, exports, define or global self).
const fflate = (function () {
  const module = undefined, exports = undefined, define = undefined, self = {};   // (only self.fflate is set)
/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.6.9
*/
!function(f){typeof module!='undefined'&&typeof exports=='object'?module.exports=f():typeof define!='undefined'&&define.amd?define(['fflate',f]):(typeof self!='undefined'?self:this).fflate=f()}(function(){var _e={};"use strict";var t=(typeof module!='undefined'&&typeof exports=='object'?function(_f){"use strict";var e,t=";var __w=require('worker_threads');__w.parentPort.on('message',function(m){onmessage({data:m})}),postMessage=function(m,t){__w.parentPort.postMessage(m,t)},close=process.exit;self=global";try{e=require("worker_threads").Worker}catch(e){}exports.default=e?function(r,n,o,a,s){var u=!1,i=new e(r+t,{eval:!0}).on("error",(function(e){return s(e,null)})).on("message",(function(e){return s(null,e)})).on("exit",(function(e){e&&!u&&s(Error("exited with code "+e),null)}));return i.postMessage(o,a),i.terminate=function(){return u=!0,e.prototype.terminate.call(i)},i}:function(e,t,r,n,o){setImmediate((function(){return o(Error("async operations unsupported - update to Node 12+ (or Node 10-11 with the --experimental-worker CLI flag)"),null)}));var a=function(){};return{terminate:a,postMessage:a}};return _f}:function(_f){"use strict";var e={},r=function(e){return URL.createObjectURL(new Blob([e],{type:"text/javascript"}))},t=function(e){return new Worker(e)};try{URL.revokeObjectURL(r(""))}catch(e){r=function(e){return"data:application/javascript;charset=UTF-8,"+encodeURI(e)},t=function(e){return new Worker(e,{type:"module"})}}_f.default=function(n,o,u,a,c){var i=t(e[o]||(e[o]=r(n)));return i.onerror=function(e){return c(e.error,null)},i.onmessage=function(e){return c(null,e.data)},i.postMessage(u,a),i};return _f})({}),n=Uint8Array,r=Uint16Array,e=Uint32Array,i=new n([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),o=new n([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),a=new n([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),s=function(t,n){for(var i=new r(31),o=0;o<31;++o)i[o]=n+=1<<t[o-1];var a=new e(i[30]);for(o=1;o<30;++o)for(var s=i[o];s<i[o+1];++s)a[s]=s-i[o]<<5|o;return[i,a]},f=s(i,2),u=f[0],h=f[1];u[28]=258,h[258]=28;for(var c=s(o,0),l=c[0],p=c[1],v=new r(32768),d=0;d<32768;++d){var g=(43690&d)>>>1|(21845&d)<<1;v[d]=((65280&(g=(61680&(g=(52428&g)>>>2|(13107&g)<<2))>>>4|(3855&g)<<4))>>>8|(255&g)<<8)>>>1}var w=function(t,n,e){for(var i=t.length,o=0,a=new r(n);o<i;++o)++a[t[o]-1];var s,f=new r(n);for(o=0;o<n;++o)f[o]=f[o-1]+a[o-1]<<1;if(e){s=new r(1<<n);var u=15-n;for(o=0;o<i;++o)if(t[o])for(var h=o<<4|t[o],c=n-t[o],l=f[t[o]-1]++<<c,p=l|(1<<c)-1;l<=p;++l)s[v[l]>>>u]=h}else for(s=new r(i),o=0;o<i;++o)t[o]&&(s[o]=v[f[t[o]-1]++]>>>15-t[o]);return s},y=new n(288);for(d=0;d<144;++d)y[d]=8;for(d=144;d<256;++d)y[d]=9;for(d=256;d<280;++d)y[d]=7;for(d=280;d<288;++d)y[d]=8;var m=new n(32);for(d=0;d<32;++d)m[d]=5;var b=w(y,9,0),x=w(y,9,1),z=w(m,5,0),k=w(m,5,1),M=function(t){for(var n=t[0],r=1;r<t.length;++r)t[r]>n&&(n=t[r]);return n},A=function(t,n,r){var e=n/8|0;return(t[e]|t[e+1]<<8)>>(7&n)&r},S=function(t,n){var r=n/8|0;return(t[r]|t[r+1]<<8|t[r+2]<<16)>>(7&n)},D=function(t){return(t/8|0)+(7&t&&1)},C=function(t,i,o){(null==i||i<0)&&(i=0),(null==o||o>t.length)&&(o=t.length);var a=new(t instanceof r?r:t instanceof e?e:n)(o-i);return a.set(t.subarray(i,o)),a},U=function(t,r,e){var s=t.length;if(!s||e&&!e.l&&s<5)return r||new n(0);var f=!r||e,h=!e||e.i;e||(e={}),r||(r=new n(3*s));var c=function(t){var e=r.length;if(t>e){var i=new n(Math.max(2*e,t));i.set(r),r=i}},p=e.f||0,v=e.p||0,d=e.b||0,g=e.l,y=e.d,m=e.m,b=e.n,z=8*s;do{if(!g){e.f=p=A(t,v,1);var U=A(t,v+1,3);if(v+=3,!U){var O=t[(Y=D(v)+4)-4]|t[Y-3]<<8,T=Y+O;if(T>s){if(h)throw"unexpected EOF";break}f&&c(d+O),r.set(t.subarray(Y,T),d),e.b=d+=O,e.p=v=8*T;continue}if(1==U)g=x,y=k,m=9,b=5;else{if(2!=U)throw"invalid block type";var Z=A(t,v,31)+257,I=A(t,v+10,15)+4,F=Z+A(t,v+5,31)+1;v+=14;for(var E=new n(F),G=new n(19),P=0;P<I;++P)G[a[P]]=A(t,v+3*P,7);v+=3*I;var j=M(G),q=(1<<j)-1,H=w(G,j,1);for(P=0;P<F;){var Y,B=H[A(t,v,q)];if(v+=15&B,(Y=B>>>4)<16)E[P++]=Y;else{var J=0,K=0;for(16==Y?(K=3+A(t,v,3),v+=2,J=E[P-1]):17==Y?(K=3+A(t,v,7),v+=3):18==Y&&(K=11+A(t,v,127),v+=7);K--;)E[P++]=J}}var L=E.subarray(0,Z),N=E.subarray(Z);m=M(L),b=M(N),g=w(L,m,1),y=w(N,b,1)}if(v>z){if(h)throw"unexpected EOF";break}}f&&c(d+131072);for(var Q=(1<<m)-1,R=(1<<b)-1,V=v;;V=v){var W=(J=g[S(t,v)&Q])>>>4;if((v+=15&J)>z){if(h)throw"unexpected EOF";break}if(!J)throw"invalid length/literal";if(W<256)r[d++]=W;else{if(256==W){V=v,g=null;break}var X=W-254;W>264&&(X=A(t,v,(1<<(tt=i[P=W-257]))-1)+u[P],v+=tt);var $=y[S(t,v)&R],_=$>>>4;if(!$)throw"invalid distance";if(v+=15&$,N=l[_],_>3){var tt=o[_];N+=S(t,v)&(1<<tt)-1,v+=tt}if(v>z){if(h)throw"unexpected EOF";break}f&&c(d+131072);for(var nt=d+X;d<nt;d+=4)r[d]=r[d-N],r[d+1]=r[d+1-N],r[d+2]=r[d+2-N],r[d+3]=r[d+3-N];d=nt}}e.l=g,e.p=V,e.b=d,g&&(p=1,e.m=m,e.d=y,e.n=b)}while(!p);return d==r.length?r:C(r,0,d)},O=function(t,n,r){var e=n/8|0;t[e]|=r<<=7&n,t[e+1]|=r>>>8},T=function(t,n,r){var e=n/8|0;t[e]|=r<<=7&n,t[e+1]|=r>>>8,t[e+2]|=r>>>16},Z=function(t,e){for(var i=[],o=0;o<t.length;++o)t[o]&&i.push({s:o,f:t[o]});var a=i.length,s=i.slice();if(!a)return[q,0];if(1==a){var f=new n(i[0].s+1);return f[i[0].s]=1,[f,1]}i.sort((function(t,n){return t.f-n.f})),i.push({s:-1,f:25001});var u=i[0],h=i[1],c=0,l=1,p=2;for(i[0]={s:-1,f:u.f+h.f,l:u,r:h};l!=a-1;)u=i[i[c].f<i[p].f?c++:p++],h=i[c!=l&&i[c].f<i[p].f?c++:p++],i[l++]={s:-1,f:u.f+h.f,l:u,r:h};var v=s[0].s;for(o=1;o<a;++o)s[o].s>v&&(v=s[o].s);var d=new r(v+1),g=I(i[l-1],d,0);if(g>e){o=0;var w=0,y=g-e,m=1<<y;for(s.sort((function(t,n){return d[n.s]-d[t.s]||t.f-n.f}));o<a;++o){var b=s[o].s;if(!(d[b]>e))break;w+=m-(1<<g-d[b]),d[b]=e}for(w>>>=y;w>0;){var x=s[o].s;d[x]<e?w-=1<<e-d[x]++-1:++o}for(;o>=0&&w;--o){var z=s[o].s;d[z]==e&&(--d[z],++w)}g=e}return[new n(d),g]},I=function(t,n,r){return-1==t.s?Math.max(I(t.l,n,r+1),I(t.r,n,r+1)):n[t.s]=r},F=function(t){for(var n=t.length;n&&!t[--n];);for(var e=new r(++n),i=0,o=t[0],a=1,s=function(t){e[i++]=t},f=1;f<=n;++f)if(t[f]==o&&f!=n)++a;else{if(!o&&a>2){for(;a>138;a-=138)s(32754);a>2&&(s(a>10?a-11<<5|28690:a-3<<5|12305),a=0)}else if(a>3){for(s(o),--a;a>6;a-=6)s(8304);a>2&&(s(a-3<<5|8208),a=0)}for(;a--;)s(o);a=1,o=t[f]}return[e.subarray(0,i),n]},E=function(t,n){for(var r=0,e=0;e<n.length;++e)r+=t[e]*n[e];return r},G=function(t,n,r){var e=r.length,i=D(n+2);t[i]=255&e,t[i+1]=e>>>8,t[i+2]=255^t[i],t[i+3]=255^t[i+1];for(var o=0;o<e;++o)t[i+o+4]=r[o];return 8*(i+4+e)},P=function(t,n,e,s,f,u,h,c,l,p,v){O(n,v++,e),++f[256];for(var d=Z(f,15),g=d[0],x=d[1],k=Z(u,15),M=k[0],A=k[1],S=F(g),D=S[0],C=S[1],U=F(M),I=U[0],P=U[1],j=new r(19),q=0;q<D.length;++q)j[31&D[q]]++;for(q=0;q<I.length;++q)j[31&I[q]]++;for(var H=Z(j,7),Y=H[0],B=H[1],J=19;J>4&&!Y[a[J-1]];--J);var K,L,N,Q,R=p+5<<3,V=E(f,y)+E(u,m)+h,W=E(f,g)+E(u,M)+h+14+3*J+E(j,Y)+(2*j[16]+3*j[17]+7*j[18]);if(R<=V&&R<=W)return G(n,v,t.subarray(l,l+p));if(O(n,v,1+(W<V)),v+=2,W<V){K=w(g,x,0),L=g,N=w(M,A,0),Q=M;var X=w(Y,B,0);for(O(n,v,C-257),O(n,v+5,P-1),O(n,v+10,J-4),v+=14,q=0;q<J;++q)O(n,v+3*q,Y[a[q]]);v+=3*J;for(var $=[D,I],_=0;_<2;++_){var tt=$[_];for(q=0;q<tt.length;++q)O(n,v,X[nt=31&tt[q]]),v+=Y[nt],nt>15&&(O(n,v,tt[q]>>>5&127),v+=tt[q]>>>12)}}else K=b,L=y,N=z,Q=m;for(q=0;q<c;++q)if(s[q]>255){var nt;T(n,v,K[257+(nt=s[q]>>>18&31)]),v+=L[nt+257],nt>7&&(O(n,v,s[q]>>>23&31),v+=i[nt]);var rt=31&s[q];T(n,v,N[rt]),v+=Q[rt],rt>3&&(T(n,v,s[q]>>>5&8191),v+=o[rt])}else T(n,v,K[s[q]]),v+=L[s[q]];return T(n,v,K[256]),v+L[256]},j=new e([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),q=new n(0),H=function(t,a,s,f,u,c){var l=t.length,v=new n(f+l+5*(1+Math.ceil(l/7e3))+u),d=v.subarray(f,v.length-u),g=0;if(!a||l<8)for(var w=0;w<=l;w+=65535){var y=w+65535;y<l?g=G(d,g,t.subarray(w,y)):(d[w]=c,g=G(d,g,t.subarray(w,l)))}else{for(var m=j[a-1],b=m>>>13,x=8191&m,z=(1<<s)-1,k=new r(32768),M=new r(z+1),A=Math.ceil(s/3),S=2*A,U=function(n){return(t[n]^t[n+1]<<A^t[n+2]<<S)&z},O=new e(25e3),T=new r(288),Z=new r(32),I=0,F=0,E=(w=0,0),H=0,Y=0;w<l;++w){var B=U(w),J=32767&w,K=M[B];if(k[J]=K,M[B]=J,H<=w){var L=l-w;if((I>7e3||E>24576)&&L>423){g=P(t,d,0,O,T,Z,F,E,Y,w-Y,g),E=I=F=0,Y=w;for(var N=0;N<286;++N)T[N]=0;for(N=0;N<30;++N)Z[N]=0}var Q=2,R=0,V=x,W=J-K&32767;if(L>2&&B==U(w-W))for(var X=Math.min(b,L)-1,$=Math.min(32767,w),_=Math.min(258,L);W<=$&&--V&&J!=K;){if(t[w+Q]==t[w+Q-W]){for(var tt=0;tt<_&&t[w+tt]==t[w+tt-W];++tt);if(tt>Q){if(Q=tt,R=W,tt>X)break;var nt=Math.min(W,tt-2),rt=0;for(N=0;N<nt;++N){var et=w-W+N+32768&32767,it=et-k[et]+32768&32767;it>rt&&(rt=it,K=et)}}}W+=(J=K)-(K=k[J])+32768&32767}if(R){O[E++]=268435456|h[Q]<<18|p[R];var ot=31&h[Q],at=31&p[R];F+=i[ot]+o[at],++T[257+ot],++Z[at],H=w+Q,++I}else O[E++]=t[w],++T[t[w]]}}g=P(t,d,c,O,T,Z,F,E,Y,w-Y,g),!c&&7&g&&(g=G(d,g+1,q))}return C(v,0,f+D(g)+u)},Y=function(){for(var t=new e(256),n=0;n<256;++n){for(var r=n,i=9;--i;)r=(1&r&&3988292384)^r>>>1;t[n]=r}return t}(),B=function(){var t=-1;return{p:function(n){for(var r=t,e=0;e<n.length;++e)r=Y[255&r^n[e]]^r>>>8;t=r},d:function(){return~t}}},J=function(){var t=1,n=0;return{p:function(r){for(var e=t,i=n,o=r.length,a=0;a!=o;){for(var s=Math.min(a+2655,o);a<s;++a)i+=e+=r[a];e=(65535&e)+15*(e>>16),i=(65535&i)+15*(i>>16)}t=e,n=i},d:function(){return(255&(t%=65521))<<24|t>>>8<<16|(255&(n%=65521))<<8|n>>>8}}},K=function(t,n,r,e,i){return H(t,null==n.level?6:n.level,null==n.mem?Math.ceil(1.5*Math.max(8,Math.min(13,Math.log(t.length)))):12+n.mem,r,e,!i)},L=function(t,n){var r={};for(var e in t)r[e]=t[e];for(var e in n)r[e]=n[e];return r},N=function(t,n,r){for(var e=t(),i=""+t,o=i.slice(i.indexOf("[")+1,i.lastIndexOf("]")).replace(/ /g,"").split(","),a=0;a<e.length;++a){var s=e[a],f=o[a];if("function"==typeof s){n+=";"+f+"=";var u=""+s;if(s.prototype)if(-1!=u.indexOf("[native code]")){var h=u.indexOf(" ",8)+1;n+=u.slice(h,u.indexOf("(",h))}else for(var c in n+=u,s.prototype)n+=";"+f+".prototype."+c+"="+s.prototype[c];else n+=u}else r[f]=s}return[n,r]},Q=[],R=function(t){var i=[];for(var o in t)(t[o]instanceof n||t[o]instanceof r||t[o]instanceof e)&&i.push((t[o]=new t[o].constructor(t[o])).buffer);return i},V=function(n,r,e,i){var o;if(!Q[e]){for(var a="",s={},f=n.length-1,u=0;u<f;++u)a=(o=N(n[u],a,s))[0],s=o[1];Q[e]=N(n[f],a,s)}var h=L({},Q[e][1]);return t.default(Q[e][0]+";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage="+r+"}",e,h,R(h),i)},W=function(){return[n,r,e,i,o,a,u,l,x,k,v,w,M,A,S,D,C,U,At,rt,et]},X=function(){return[n,r,e,i,o,a,h,p,b,y,z,m,v,j,q,w,O,T,Z,I,F,E,G,P,D,C,H,K,xt,rt]},$=function(){return[ct,vt,ht,B,Y]},_=function(){return[lt,pt]},tt=function(){return[dt,ht,J]},nt=function(){return[gt]},rt=function(t){return postMessage(t,[t.buffer])},et=function(t){return t&&t.size&&new n(t.size)},it=function(t,n,r,e,i,o){var a=V(r,e,i,(function(t,n){a.terminate(),o(t,n)}));return a.postMessage([t,n],n.consume?[t.buffer]:[]),function(){a.terminate()}},ot=function(t){return t.ondata=function(t,n){return postMessage([t,n],[t.buffer])},function(n){return t.push(n.data[0],n.data[1])}},at=function(t,n,r,e,i){var o,a=V(t,e,i,(function(t,r){t?(a.terminate(),n.ondata.call(n,t)):(r[1]&&a.terminate(),n.ondata.call(n,t,r[0],r[1]))}));a.postMessage(r),n.push=function(t,r){if(o)throw"stream finished";if(!n.ondata)throw"no stream handler";a.postMessage([t,o=r],[t.buffer])},n.terminate=function(){a.terminate()}},st=function(t,n){return t[n]|t[n+1]<<8},ft=function(t,n){return(t[n]|t[n+1]<<8|t[n+2]<<16|t[n+3]<<24)>>>0},ut=function(t,n){return ft(t,n)+4294967296*ft(t,n+4)},ht=function(t,n,r){for(;r;++n)t[n]=r,r>>>=8},ct=function(t,n){var r=n.filename;if(t[0]=31,t[1]=139,t[2]=8,t[8]=n.level<2?4:9==n.level?2:0,t[9]=3,0!=n.mtime&&ht(t,4,Math.floor(new Date(n.mtime||Date.now())/1e3)),r){t[3]=8;for(var e=0;e<=r.length;++e)t[e+10]=r.charCodeAt(e)}},lt=function(t){if(31!=t[0]||139!=t[1]||8!=t[2])throw"invalid gzip data";var n=t[3],r=10;4&n&&(r+=t[10]|2+(t[11]<<8));for(var e=(n>>3&1)+(n>>4&1);e>0;e-=!t[r++]);return r+(2&n)},pt=function(t){var n=t.length;return(t[n-4]|t[n-3]<<8|t[n-2]<<16|t[n-1]<<24)>>>0},vt=function(t){return 10+(t.filename&&t.filename.length+1||0)},dt=function(t,n){var r=n.level,e=0==r?0:r<6?1:9==r?3:2;t[0]=120,t[1]=e<<6|(e?32-2*e:1)},gt=function(t){if(8!=(15&t[0])||t[0]>>>4>7||(t[0]<<8|t[1])%31)throw"invalid zlib data";if(32&t[1])throw"invalid zlib data: preset dictionaries not supported"};function wt(t,n){return n||"function"!=typeof t||(n=t,t={}),this.ondata=n,t}var yt=function(){function t(t,n){n||"function"!=typeof t||(n=t,t={}),this.ondata=n,this.o=t||{}}return t.prototype.p=function(t,n){this.ondata(K(t,this.o,0,0,!n),n)},t.prototype.push=function(t,n){if(this.d)throw"stream finished";if(!this.ondata)throw"no stream handler";this.d=n,this.p(t,n||!1)},t}();_e.Deflate=yt;var mt=function(){return function(t,n){at([X,function(){return[ot,yt]}],this,wt.call(this,t,n),(function(t){var n=new yt(t.data);onmessage=ot(n)}),6)}}();function bt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X],(function(t){return rt(xt(t.data[0],t.data[1]))}),0,r)}function xt(t,n){return K(t,n||{},0,0)}_e.AsyncDeflate=mt,_e.deflate=bt,_e.deflateSync=xt;var zt=function(){function t(t){this.s={},this.p=new n(0),this.ondata=t}return t.prototype.e=function(t){if(this.d)throw"stream finished";if(!this.ondata)throw"no stream handler";var r=this.p.length,e=new n(r+t.length);e.set(this.p),e.set(t,r),this.p=e},t.prototype.c=function(t){this.d=this.s.i=t||!1;var n=this.s.b,r=U(this.p,this.o,this.s);this.ondata(C(r,n,this.s.b),this.d),this.o=C(r,this.s.b-32768),this.s.b=this.o.length,this.p=C(this.p,this.s.p/8|0),this.s.p&=7},t.prototype.push=function(t,n){this.e(t),this.c(n)},t}();_e.Inflate=zt;var kt=function(){return function(t){this.ondata=t,at([W,function(){return[ot,zt]}],this,0,(function(){var t=new zt;onmessage=ot(t)}),7)}}();function Mt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W],(function(t){return rt(At(t.data[0],et(t.data[1])))}),1,r)}function At(t,n){return U(t,n)}_e.AsyncInflate=kt,_e.inflate=Mt,_e.inflateSync=At;var St=function(){function t(t,n){this.c=B(),this.l=0,this.v=1,yt.call(this,t,n)}return t.prototype.push=function(t,n){yt.prototype.push.call(this,t,n)},t.prototype.p=function(t,n){this.c.p(t),this.l+=t.length;var r=K(t,this.o,this.v&&vt(this.o),n&&8,!n);this.v&&(ct(r,this.o),this.v=0),n&&(ht(r,r.length-8,this.c.d()),ht(r,r.length-4,this.l)),this.ondata(r,n)},t}();_e.Gzip=St,_e.Compress=St;var Dt=function(){return function(t,n){at([X,$,function(){return[ot,yt,St]}],this,wt.call(this,t,n),(function(t){var n=new St(t.data);onmessage=ot(n)}),8)}}();function Ct(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X,$,function(){return[Ut]}],(function(t){return rt(Ut(t.data[0],t.data[1]))}),2,r)}function Ut(t,n){n||(n={});var r=B(),e=t.length;r.p(t);var i=K(t,n,vt(n),8),o=i.length;return ct(i,n),ht(i,o-8,r.d()),ht(i,o-4,e),i}_e.AsyncGzip=Dt,_e.AsyncCompress=Dt,_e.gzip=Ct,_e.compress=Ct,_e.gzipSync=Ut,_e.compressSync=Ut;var Ot=function(){function t(t){this.v=1,zt.call(this,t)}return t.prototype.push=function(t,n){if(zt.prototype.e.call(this,t),this.v){var r=this.p.length>3?lt(this.p):4;if(r>=this.p.length&&!n)return;this.p=this.p.subarray(r),this.v=0}if(n){if(this.p.length<8)throw"invalid gzip stream";this.p=this.p.subarray(0,-8)}zt.prototype.c.call(this,n)},t}();_e.Gunzip=Ot;var Tt=function(){return function(t){this.ondata=t,at([W,_,function(){return[ot,zt,Ot]}],this,0,(function(){var t=new Ot;onmessage=ot(t)}),9)}}();function Zt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W,_,function(){return[It]}],(function(t){return rt(It(t.data[0]))}),3,r)}function It(t,r){return U(t.subarray(lt(t),-8),r||new n(pt(t)))}_e.AsyncGunzip=Tt,_e.gunzip=Zt,_e.gunzipSync=It;var Ft=function(){function t(t,n){this.c=J(),this.v=1,yt.call(this,t,n)}return t.prototype.push=function(t,n){yt.prototype.push.call(this,t,n)},t.prototype.p=function(t,n){this.c.p(t);var r=K(t,this.o,this.v&&2,n&&4,!n);this.v&&(dt(r,this.o),this.v=0),n&&ht(r,r.length-4,this.c.d()),this.ondata(r,n)},t}();_e.Zlib=Ft;var Et=function(){return function(t,n){at([X,tt,function(){return[ot,yt,Ft]}],this,wt.call(this,t,n),(function(t){var n=new Ft(t.data);onmessage=ot(n)}),10)}}();function Gt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X,tt,function(){return[Pt]}],(function(t){return rt(Pt(t.data[0],t.data[1]))}),4,r)}function Pt(t,n){n||(n={});var r=J();r.p(t);var e=K(t,n,2,4);return dt(e,n),ht(e,e.length-4,r.d()),e}_e.AsyncZlib=Et,_e.zlib=Gt,_e.zlibSync=Pt;var jt=function(){function t(t){this.v=1,zt.call(this,t)}return t.prototype.push=function(t,n){if(zt.prototype.e.call(this,t),this.v){if(this.p.length<2&&!n)return;this.p=this.p.subarray(2),this.v=0}if(n){if(this.p.length<4)throw"invalid zlib stream";this.p=this.p.subarray(0,-4)}zt.prototype.c.call(this,n)},t}();_e.Unzlib=jt;var qt=function(){return function(t){this.ondata=t,at([W,nt,function(){return[ot,zt,jt]}],this,0,(function(){var t=new jt;onmessage=ot(t)}),11)}}();function Ht(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W,nt,function(){return[Yt]}],(function(t){return rt(Yt(t.data[0],et(t.data[1])))}),5,r)}function Yt(t,n){return U((gt(t),t.subarray(2,-4)),n)}_e.AsyncUnzlib=qt,_e.unzlib=Ht,_e.unzlibSync=Yt;var Bt=function(){function t(t){this.G=Ot,this.I=zt,this.Z=jt,this.ondata=t}return t.prototype.push=function(t,r){if(!this.ondata)throw"no stream handler";if(this.s)this.s.push(t,r);else{if(this.p&&this.p.length){var e=new n(this.p.length+t.length);e.set(this.p),e.set(t,this.p.length)}else this.p=t;if(this.p.length>2){var i=this,o=function(){i.ondata.apply(i,arguments)};this.s=31==this.p[0]&&139==this.p[1]&&8==this.p[2]?new this.G(o):8!=(15&this.p[0])||this.p[0]>>4>7||(this.p[0]<<8|this.p[1])%31?new this.I(o):new this.Z(o),this.s.push(this.p,r),this.p=null}}},t}();_e.Decompress=Bt;var Jt=function(){function t(t){this.G=Tt,this.I=kt,this.Z=qt,this.ondata=t}return t.prototype.push=function(t,n){Bt.prototype.push.call(this,t,n)},t}();function Kt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return 31==t[0]&&139==t[1]&&8==t[2]?Zt(t,n,r):8!=(15&t[0])||t[0]>>4>7||(t[0]<<8|t[1])%31?Mt(t,n,r):Ht(t,n,r)}function Lt(t,n){return 31==t[0]&&139==t[1]&&8==t[2]?It(t,n):8!=(15&t[0])||t[0]>>4>7||(t[0]<<8|t[1])%31?At(t,n):Yt(t,n)}_e.AsyncDecompress=Jt,_e.decompress=Kt,_e.decompressSync=Lt;var Nt=function(t,r,e,i){for(var o in t){var a=t[o],s=r+o;a instanceof n?e[s]=[a,i]:Array.isArray(a)?e[s]=[a[0],L(i,a[1])]:Nt(a,s+"/",e,i)}},Qt="undefined"!=typeof TextEncoder&&new TextEncoder,Rt="undefined"!=typeof TextDecoder&&new TextDecoder,Vt=0;try{Rt.decode(q,{stream:!0}),Vt=1}catch(t){}var Wt=function(t){for(var n="",r=0;;){var e=t[r++],i=(e>127)+(e>223)+(e>239);if(r+i>t.length)return[n,C(t,r-1)];i?3==i?(e=((15&e)<<18|(63&t[r++])<<12|(63&t[r++])<<6|63&t[r++])-65536,n+=String.fromCharCode(55296|e>>10,56320|1023&e)):n+=String.fromCharCode(1&i?(31&e)<<6|63&t[r++]:(15&e)<<12|(63&t[r++])<<6|63&t[r++]):n+=String.fromCharCode(e)}},Xt=function(){function t(t){this.ondata=t,Vt?this.t=new TextDecoder:this.p=q}return t.prototype.push=function(t,r){if(!this.ondata)throw"no callback";if(r=!!r,this.t){if(this.ondata(this.t.decode(t,{stream:!0}),r),r){if(this.t.decode().length)throw"invalid utf-8 data";this.t=null}}else{if(!this.p)throw"stream finished";var e=new n(this.p.length+t.length);e.set(this.p),e.set(t,this.p.length);var i=Wt(e),o=i[0],a=i[1];if(r){if(a.length)throw"invalid utf-8 data";this.p=null}else this.p=a;this.ondata(o,r)}},t}();_e.DecodeUTF8=Xt;var $t=function(){function t(t){this.ondata=t}return t.prototype.push=function(t,n){if(!this.ondata)throw"no callback";if(this.d)throw"stream finished";this.ondata(_t(t),this.d=n||!1)},t}();function _t(t,r){if(r){for(var e=new n(t.length),i=0;i<t.length;++i)e[i]=t.charCodeAt(i);return e}if(Qt)return Qt.encode(t);var o=t.length,a=new n(t.length+(t.length>>1)),s=0,f=function(t){a[s++]=t};for(i=0;i<o;++i){if(s+5>a.length){var u=new n(s+8+(o-i<<1));u.set(a),a=u}var h=t.charCodeAt(i);h<128||r?f(h):h<2048?(f(192|h>>6),f(128|63&h)):h>55295&&h<57344?(f(240|(h=65536+(1047552&h)|1023&t.charCodeAt(++i))>>18),f(128|h>>12&63),f(128|h>>6&63),f(128|63&h)):(f(224|h>>12),f(128|h>>6&63),f(128|63&h))}return C(a,0,s)}function tn(t,n){if(n){for(var r="",e=0;e<t.length;e+=16384)r+=String.fromCharCode.apply(null,t.subarray(e,e+16384));return r}if(Rt)return Rt.decode(t);var i=Wt(t);if(i[1].length)throw"invalid utf-8 data";return i[0]}_e.EncodeUTF8=$t,_e.strToU8=_t,_e.strFromU8=tn;var nn=function(t){return 1==t?3:t<6?2:9==t?1:0},rn=function(t,n){return n+30+st(t,n+26)+st(t,n+28)},en=function(t,n,r){var e=st(t,n+28),i=tn(t.subarray(n+46,n+46+e),!(2048&st(t,n+8))),o=n+46+e,a=ft(t,n+20),s=r&&4294967295==a?on(t,o):[a,ft(t,n+24),ft(t,n+42)],f=s[0],u=s[1],h=s[2];return[st(t,n+10),f,u,i,o+st(t,n+30)+st(t,n+32),h]},on=function(t,n){for(;1!=st(t,n);n+=4+st(t,n+2));return[ut(t,n+12),ut(t,n+4),ut(t,n+20)]},an=function(t){var n=0;if(t)for(var r in t){var e=t[r].length;if(e>65535)throw"extra field too long";n+=e+4}return n},sn=function(t,n,r,e,i,o,a,s){var f=e.length,u=r.extra,h=s&&s.length,c=an(u);ht(t,n,null!=a?33639248:67324752),n+=4,null!=a&&(t[n++]=20,t[n++]=r.os),t[n]=20,n+=2,t[n++]=r.flag<<1|(null==o&&8),t[n++]=i&&8,t[n++]=255&r.compression,t[n++]=r.compression>>8;var l=new Date(null==r.mtime?Date.now():r.mtime),p=l.getFullYear()-1980;if(p<0||p>119)throw"date not in range 1980-2099";if(ht(t,n,p<<25|l.getMonth()+1<<21|l.getDate()<<16|l.getHours()<<11|l.getMinutes()<<5|l.getSeconds()>>>1),n+=4,null!=o&&(ht(t,n,r.crc),ht(t,n+4,o),ht(t,n+8,r.size)),ht(t,n+12,f),ht(t,n+14,c),n+=16,null!=a&&(ht(t,n,h),ht(t,n+6,r.attrs),ht(t,n+10,a),n+=14),t.set(e,n),n+=f,c)for(var v in u){var d=u[v],g=d.length;ht(t,n,+v),ht(t,n+2,g),t.set(d,n+4),n+=4+g}return h&&(t.set(s,n),n+=h),n},fn=function(t,n,r,e,i){ht(t,n,101010256),ht(t,n+8,r),ht(t,n+10,r),ht(t,n+12,e),ht(t,n+16,i)},un=function(){function t(t){this.filename=t,this.c=B(),this.size=0,this.compression=0}return t.prototype.process=function(t,n){this.ondata(null,t,n)},t.prototype.push=function(t,n){if(!this.ondata)throw"no callback - add to ZIP archive before pushing";this.c.p(t),this.size+=t.length,n&&(this.crc=this.c.d()),this.process(t,n||!1)},t}();_e.ZipPassThrough=un;var hn=function(){function t(t,n){var r=this;n||(n={}),un.call(this,t),this.d=new yt(n,(function(t,n){r.ondata(null,t,n)})),this.compression=8,this.flag=nn(n.level)}return t.prototype.process=function(t,n){try{this.d.push(t,n)}catch(t){this.ondata(t,null,n)}},t.prototype.push=function(t,n){un.prototype.push.call(this,t,n)},t}();_e.ZipDeflate=hn;var cn=function(){function t(t,n){var r=this;n||(n={}),un.call(this,t),this.d=new mt(n,(function(t,n,e){r.ondata(t,n,e)})),this.compression=8,this.flag=nn(n.level),this.terminate=this.d.terminate}return t.prototype.process=function(t,n){this.d.push(t,n)},t.prototype.push=function(t,n){un.prototype.push.call(this,t,n)},t}();_e.AsyncZipDeflate=cn;var ln=function(){function t(t){this.ondata=t,this.u=[],this.d=1}return t.prototype.add=function(t){var r=this;if(2&this.d)throw"stream finished";var e=_t(t.filename),i=e.length,o=t.comment,a=o&&_t(o),s=i!=t.filename.length||a&&o.length!=a.length,f=i+an(t.extra)+30;if(i>65535)throw"filename too long";var u=new n(f);sn(u,0,t,e,s);var h=[u],c=function(){for(var t=0,n=h;t<n.length;t++)r.ondata(null,n[t],!1);h=[]},l=this.d;this.d=0;var p=this.u.length,v=L(t,{f:e,u:s,o:a,t:function(){t.terminate&&t.terminate()},r:function(){if(c(),l){var t=r.u[p+1];t?t.r():r.d=1}l=1}}),d=0;t.ondata=function(e,i,o){if(e)r.ondata(e,i,o),r.terminate();else if(d+=i.length,h.push(i),o){var a=new n(16);ht(a,0,134695760),ht(a,4,t.crc),ht(a,8,d),ht(a,12,t.size),h.push(a),v.c=d,v.b=f+d+16,v.crc=t.crc,v.size=t.size,l&&v.r(),l=1}else l&&c()},this.u.push(v)},t.prototype.end=function(){var t=this;if(2&this.d){if(1&this.d)throw"stream finishing";throw"stream finished"}this.d?this.e():this.u.push({r:function(){1&t.d&&(t.u.splice(-1,1),t.e())},t:function(){}}),this.d=3},t.prototype.e=function(){for(var t=0,r=0,e=0,i=0,o=this.u;i<o.length;i++)e+=46+(u=o[i]).f.length+an(u.extra)+(u.o?u.o.length:0);for(var a=new n(e+22),s=0,f=this.u;s<f.length;s++){var u;sn(a,t,u=f[s],u.f,u.u,u.c,r,u.o),t+=46+u.f.length+an(u.extra)+(u.o?u.o.length:0),r+=u.b}fn(a,t,this.u.length,e,r),this.ondata(null,a,!0),this.d=2},t.prototype.terminate=function(){for(var t=0,n=this.u;t<n.length;t++)n[t].t();this.d=2},t}();function pn(t,r,e){if(e||(e=r,r={}),"function"!=typeof e)throw"no callback";var i={};Nt(t,"",i,r);var o=Object.keys(i),a=o.length,s=0,f=0,u=a,h=Array(a),c=[],l=function(){for(var t=0;t<c.length;++t)c[t]()},p=function(){var t=new n(f+22),r=s,i=f-s;f=0;for(var o=0;o<u;++o){var a=h[o];try{var c=a.c.length;sn(t,f,a,a.f,a.u,c);var l=30+a.f.length+an(a.extra),p=f+l;t.set(a.c,p),sn(t,s,a,a.f,a.u,c,f,a.m),s+=16+l+(a.m?a.m.length:0),f=p+c}catch(t){return e(t,null)}}fn(t,s,h.length,i,r),e(null,t)};a||p();for(var v=function(t){var n=o[t],r=i[n],u=r[0],v=r[1],d=B(),g=u.length;d.p(u);var w=_t(n),y=w.length,m=v.comment,b=m&&_t(m),x=b&&b.length,z=an(v.extra),k=0==v.level?0:8,M=function(r,i){if(r)l(),e(r,null);else{var o=i.length;h[t]=L(v,{size:g,crc:d.d(),c:i,f:w,m:b,u:y!=n.length||b&&m.length!=x,compression:k}),s+=30+y+z+o,f+=76+2*(y+z)+(x||0)+o,--a||p()}};if(y>65535&&M("filename too long",null),k)if(g<16e4)try{M(null,xt(u,v))}catch(t){M(t,null)}else c.push(bt(u,v,M));else M(null,u)},d=0;d<u;++d)v(d);return l}function vn(t,r){r||(r={});var e={},i=[];Nt(t,"",e,r);var o=0,a=0;for(var s in e){var f=e[s],u=f[0],h=f[1],c=0==h.level?0:8,l=(M=_t(s)).length,p=h.comment,v=p&&_t(p),d=v&&v.length,g=an(h.extra);if(l>65535)throw"filename too long";var w=c?xt(u,h):u,y=w.length,m=B();m.p(u),i.push(L(h,{size:u.length,crc:m.d(),c:w,f:M,m:v,u:l!=s.length||v&&p.length!=d,o:o,compression:c})),o+=30+l+g+y,a+=76+2*(l+g)+(d||0)+y}for(var b=new n(a+22),x=o,z=a-o,k=0;k<i.length;++k){var M;sn(b,(M=i[k]).o,M,M.f,M.u,M.c.length);var A=30+M.f.length+an(M.extra);b.set(M.c,M.o+A),sn(b,o,M,M.f,M.u,M.c.length,M.o,M.m),o+=16+A+(M.m?M.m.length:0)}return fn(b,o,i.length,z,x),b}_e.Zip=ln,_e.zip=pn,_e.zipSync=vn;var dn=function(){function t(){}return t.prototype.push=function(t,n){this.ondata(null,t,n)},t.compression=0,t}();_e.UnzipPassThrough=dn;var gn=function(){function t(){var t=this;this.i=new zt((function(n,r){t.ondata(null,n,r)}))}return t.prototype.push=function(t,n){try{this.i.push(t,n)}catch(r){this.ondata(r,t,n)}},t.compression=8,t}();_e.UnzipInflate=gn;var wn=function(){function t(t,n){var r=this;n<32e4?this.i=new zt((function(t,n){r.ondata(null,t,n)})):(this.i=new kt((function(t,n,e){r.ondata(t,n,e)})),this.terminate=this.i.terminate)}return t.prototype.push=function(t,n){this.i.terminate&&(t=C(t,0)),this.i.push(t,n)},t.compression=8,t}();_e.AsyncUnzipInflate=wn;var yn=function(){function t(t){this.onfile=t,this.k=[],this.o={0:dn},this.p=q}return t.prototype.push=function(t,r){var e=this;if(!this.onfile)throw"no callback";if(!this.p)throw"stream finished";if(this.c>0){var i=Math.min(this.c,t.length),o=t.subarray(0,i);if(this.c-=i,this.d?this.d.push(o,!this.c):this.k[0].push(o),(t=t.subarray(i)).length)return this.push(t,r)}else{var a=0,s=0,f=void 0,u=void 0;this.p.length?t.length?((u=new n(this.p.length+t.length)).set(this.p),u.set(t,this.p.length)):u=this.p:u=t;for(var h=u.length,c=this.c,l=c&&this.d,p=function(){var t,n=ft(u,s);if(67324752==n){a=1,f=s,v.d=null,v.c=0;var r=st(u,s+6),i=st(u,s+8),o=2048&r,l=8&r,p=st(u,s+26),d=st(u,s+28);if(h>s+30+p+d){var g=[];v.k.unshift(g),a=2;var w,y=ft(u,s+18),m=ft(u,s+22),b=tn(u.subarray(s+30,s+=30+p),!o);4294967295==y?(t=l?[-2]:on(u,s),y=t[0],m=t[1]):l&&(y=-1),s+=d,v.c=y;var x={name:b,compression:i,start:function(){if(!x.ondata)throw"no callback";if(y){var t=e.o[i];if(!t)throw"unknown compression type "+i;(w=y<0?new t(b):new t(b,y,m)).ondata=function(t,n,r){x.ondata(t,n,r)};for(var n=0,r=g;n<r.length;n++)w.push(r[n],!1);e.k[0]==g&&e.c?e.d=w:w.push(q,!0)}else x.ondata(null,q,!0)},terminate:function(){w&&w.terminate&&w.terminate()}};y>=0&&(x.size=y,x.originalSize=m),v.onfile(x)}return"break"}if(c){if(134695760==n)return f=s+=12+(-2==c&&8),a=3,v.c=0,"break";if(33639248==n)return f=s-=4,a=3,v.c=0,"break"}},v=this;s<h-4&&"break"!==p();++s);if(this.p=q,c<0){var d=u.subarray(0,a?f-12-(-2==c&&8)-(134695760==ft(u,f-16)&&4):s);l?l.push(d,!!a):this.k[+(2==a)].push(d)}if(2&a)return this.push(u.subarray(s),r);this.p=u.subarray(s)}if(r){if(this.c)throw"invalid zip file";this.p=null}},t.prototype.register=function(t){this.o[t.compression]=t},t}();function mn(t,r){if("function"!=typeof r)throw"no callback";for(var e=[],i=function(){for(var t=0;t<e.length;++t)e[t]()},o={},a=t.length-22;101010256!=ft(t,a);--a)if(!a||t.length-a>65558)return void r("invalid zip file",null);var s=st(t,a+8);s||r(null,{});var f=s,u=ft(t,a+16),h=4294967295==u;if(h){if(a=ft(t,a-12),101075792!=ft(t,a))return void r("invalid zip file",null);f=s=ft(t,a+32),u=ft(t,a+48)}for(var c=function(a){var f=en(t,u,h),c=f[0],l=f[1],p=f[2],v=f[3],d=f[4],g=rn(t,f[5]);u=d;var w=function(t,n){t?(i(),r(t,null)):(o[v]=n,--s||r(null,o))};if(c)if(8==c){var y=t.subarray(g,g+l);if(l<32e4)try{w(null,At(y,new n(p)))}catch(t){w(t,null)}else e.push(Mt(y,{size:p},w))}else w("unknown compression type "+c,null);else w(null,C(t,g,g+l))},l=0;l<f;++l)c();return i}function bn(t){for(var r={},e=t.length-22;101010256!=ft(t,e);--e)if(!e||t.length-e>65558)throw"invalid zip file";var i=st(t,e+8);if(!i)return{};var o=ft(t,e+16),a=4294967295==o;if(a){if(e=ft(t,e-12),101075792!=ft(t,e))throw"invalid zip file";i=ft(t,e+32),o=ft(t,e+48)}for(var s=0;s<i;++s){var f=en(t,o,a),u=f[0],h=f[1],c=f[2],l=f[3],p=f[4],v=rn(t,f[5]);if(o=p,u){if(8!=u)throw"unknown compression type "+u;r[l]=At(t.subarray(v,v+h),new n(c))}else r[l]=C(t,v,v+h)}return r}_e.Unzip=yn,_e.unzip=mn,_e.unzipSync=bn;return _e})
  return self.fflate;
})();
// ---- NURBSUtils.js
( function () {

	/**
 * NURBS utils
 *
 * See NURBSCurve and NURBSSurface.
 **/

	/**************************************************************
 *	NURBS Utils
 **************************************************************/

	class NURBSUtils {

		/*
  Finds knot vector span.
  	p : degree
  u : parametric value
  U : knot vector
  	returns the span
  */
		static findSpan( p, u, U ) {

			const n = U.length - p - 1;

			if ( u >= U[ n ] ) {

				return n - 1;

			}

			if ( u <= U[ p ] ) {

				return p;

			}

			let low = p;
			let high = n;
			let mid = Math.floor( ( low + high ) / 2 );

			while ( u < U[ mid ] || u >= U[ mid + 1 ] ) {

				if ( u < U[ mid ] ) {

					high = mid;

				} else {

					low = mid;

				}

				mid = Math.floor( ( low + high ) / 2 );

			}

			return mid;

		}
		/*
  Calculate basis functions. See The NURBS Book, page 70, algorithm A2.2
  	span : span in which u lies
  u    : parametric point
  p    : degree
  U    : knot vector
  	returns array[p+1] with basis functions values.
  */


		static calcBasisFunctions( span, u, p, U ) {

			const N = [];
			const left = [];
			const right = [];
			N[ 0 ] = 1.0;

			for ( let j = 1; j <= p; ++ j ) {

				left[ j ] = u - U[ span + 1 - j ];
				right[ j ] = U[ span + j ] - u;
				let saved = 0.0;

				for ( let r = 0; r < j; ++ r ) {

					const rv = right[ r + 1 ];
					const lv = left[ j - r ];
					const temp = N[ r ] / ( rv + lv );
					N[ r ] = saved + rv * temp;
					saved = lv * temp;

				}

				N[ j ] = saved;

			}

			return N;

		}
		/*
  Calculate B-Spline curve points. See The NURBS Book, page 82, algorithm A3.1.
  	p : degree of B-Spline
  U : knot vector
  P : control points (x, y, z, w)
  u : parametric point
  	returns point for given u
  */


		static calcBSplinePoint( p, U, P, u ) {

			const span = this.findSpan( p, u, U );
			const N = this.calcBasisFunctions( span, u, p, U );
			const C = new THREE.Vector4( 0, 0, 0, 0 );

			for ( let j = 0; j <= p; ++ j ) {

				const point = P[ span - p + j ];
				const Nj = N[ j ];
				const wNj = point.w * Nj;
				C.x += point.x * wNj;
				C.y += point.y * wNj;
				C.z += point.z * wNj;
				C.w += point.w * Nj;

			}

			return C;

		}
		/*
  Calculate basis functions derivatives. See The NURBS Book, page 72, algorithm A2.3.
  	span : span in which u lies
  u    : parametric point
  p    : degree
  n    : number of derivatives to calculate
  U    : knot vector
  	returns array[n+1][p+1] with basis functions derivatives
  */


		static calcBasisFunctionDerivatives( span, u, p, n, U ) {

			const zeroArr = [];

			for ( let i = 0; i <= p; ++ i ) zeroArr[ i ] = 0.0;

			const ders = [];

			for ( let i = 0; i <= n; ++ i ) ders[ i ] = zeroArr.slice( 0 );

			const ndu = [];

			for ( let i = 0; i <= p; ++ i ) ndu[ i ] = zeroArr.slice( 0 );

			ndu[ 0 ][ 0 ] = 1.0;
			const left = zeroArr.slice( 0 );
			const right = zeroArr.slice( 0 );

			for ( let j = 1; j <= p; ++ j ) {

				left[ j ] = u - U[ span + 1 - j ];
				right[ j ] = U[ span + j ] - u;
				let saved = 0.0;

				for ( let r = 0; r < j; ++ r ) {

					const rv = right[ r + 1 ];
					const lv = left[ j - r ];
					ndu[ j ][ r ] = rv + lv;
					const temp = ndu[ r ][ j - 1 ] / ndu[ j ][ r ];
					ndu[ r ][ j ] = saved + rv * temp;
					saved = lv * temp;

				}

				ndu[ j ][ j ] = saved;

			}

			for ( let j = 0; j <= p; ++ j ) {

				ders[ 0 ][ j ] = ndu[ j ][ p ];

			}

			for ( let r = 0; r <= p; ++ r ) {

				let s1 = 0;
				let s2 = 1;
				const a = [];

				for ( let i = 0; i <= p; ++ i ) {

					a[ i ] = zeroArr.slice( 0 );

				}

				a[ 0 ][ 0 ] = 1.0;

				for ( let k = 1; k <= n; ++ k ) {

					let d = 0.0;
					const rk = r - k;
					const pk = p - k;

					if ( r >= k ) {

						a[ s2 ][ 0 ] = a[ s1 ][ 0 ] / ndu[ pk + 1 ][ rk ];
						d = a[ s2 ][ 0 ] * ndu[ rk ][ pk ];

					}

					const j1 = rk >= - 1 ? 1 : - rk;
					const j2 = r - 1 <= pk ? k - 1 : p - r;

					for ( let j = j1; j <= j2; ++ j ) {

						a[ s2 ][ j ] = ( a[ s1 ][ j ] - a[ s1 ][ j - 1 ] ) / ndu[ pk + 1 ][ rk + j ];
						d += a[ s2 ][ j ] * ndu[ rk + j ][ pk ];

					}

					if ( r <= pk ) {

						a[ s2 ][ k ] = - a[ s1 ][ k - 1 ] / ndu[ pk + 1 ][ r ];
						d += a[ s2 ][ k ] * ndu[ r ][ pk ];

					}

					ders[ k ][ r ] = d;
					const j = s1;
					s1 = s2;
					s2 = j;

				}

			}

			let r = p;

			for ( let k = 1; k <= n; ++ k ) {

				for ( let j = 0; j <= p; ++ j ) {

					ders[ k ][ j ] *= r;

				}

				r *= p - k;

			}

			return ders;

		}
		/*
  	Calculate derivatives of a B-Spline. See The NURBS Book, page 93, algorithm A3.2.
  		p  : degree
  	U  : knot vector
  	P  : control points
  	u  : Parametric points
  	nd : number of derivatives
  		returns array[d+1] with derivatives
  	*/


		static calcBSplineDerivatives( p, U, P, u, nd ) {

			const du = nd < p ? nd : p;
			const CK = [];
			const span = this.findSpan( p, u, U );
			const nders = this.calcBasisFunctionDerivatives( span, u, p, du, U );
			const Pw = [];

			for ( let i = 0; i < P.length; ++ i ) {

				const point = P[ i ].clone();
				const w = point.w;
				point.x *= w;
				point.y *= w;
				point.z *= w;
				Pw[ i ] = point;

			}

			for ( let k = 0; k <= du; ++ k ) {

				const point = Pw[ span - p ].clone().multiplyScalar( nders[ k ][ 0 ] );

				for ( let j = 1; j <= p; ++ j ) {

					point.add( Pw[ span - p + j ].clone().multiplyScalar( nders[ k ][ j ] ) );

				}

				CK[ k ] = point;

			}

			for ( let k = du + 1; k <= nd + 1; ++ k ) {

				CK[ k ] = new THREE.Vector4( 0, 0, 0 );

			}

			return CK;

		}
		/*
  Calculate "K over I"
  	returns k!/(i!(k-i)!)
  */


		static calcKoverI( k, i ) {

			let nom = 1;

			for ( let j = 2; j <= k; ++ j ) {

				nom *= j;

			}

			let denom = 1;

			for ( let j = 2; j <= i; ++ j ) {

				denom *= j;

			}

			for ( let j = 2; j <= k - i; ++ j ) {

				denom *= j;

			}

			return nom / denom;

		}
		/*
  Calculate derivatives (0-nd) of rational curve. See The NURBS Book, page 127, algorithm A4.2.
  	Pders : result of function calcBSplineDerivatives
  	returns array with derivatives for rational curve.
  */


		static calcRationalCurveDerivatives( Pders ) {

			const nd = Pders.length;
			const Aders = [];
			const wders = [];

			for ( let i = 0; i < nd; ++ i ) {

				const point = Pders[ i ];
				Aders[ i ] = new THREE.Vector3( point.x, point.y, point.z );
				wders[ i ] = point.w;

			}

			const CK = [];

			for ( let k = 0; k < nd; ++ k ) {

				const v = Aders[ k ].clone();

				for ( let i = 1; i <= k; ++ i ) {

					v.sub( CK[ k - i ].clone().multiplyScalar( this.calcKoverI( k, i ) * wders[ i ] ) );

				}

				CK[ k ] = v.divideScalar( wders[ 0 ] );

			}

			return CK;

		}
		/*
  Calculate NURBS curve derivatives. See The NURBS Book, page 127, algorithm A4.2.
  	p  : degree
  U  : knot vector
  P  : control points in homogeneous space
  u  : parametric points
  nd : number of derivatives
  	returns array with derivatives.
  */


		static calcNURBSDerivatives( p, U, P, u, nd ) {

			const Pders = this.calcBSplineDerivatives( p, U, P, u, nd );
			return this.calcRationalCurveDerivatives( Pders );

		}
		/*
  Calculate rational B-Spline surface point. See The NURBS Book, page 134, algorithm A4.3.
  	p1, p2 : degrees of B-Spline surface
  U1, U2 : knot vectors
  P      : control points (x, y, z, w)
  u, v   : parametric values
  	returns point for given (u, v)
  */


		static calcSurfacePoint( p, q, U, V, P, u, v, target ) {

			const uspan = this.findSpan( p, u, U );
			const vspan = this.findSpan( q, v, V );
			const Nu = this.calcBasisFunctions( uspan, u, p, U );
			const Nv = this.calcBasisFunctions( vspan, v, q, V );
			const temp = [];

			for ( let l = 0; l <= q; ++ l ) {

				temp[ l ] = new THREE.Vector4( 0, 0, 0, 0 );

				for ( let k = 0; k <= p; ++ k ) {

					const point = P[ uspan - p + k ][ vspan - q + l ].clone();
					const w = point.w;
					point.x *= w;
					point.y *= w;
					point.z *= w;
					temp[ l ].add( point.multiplyScalar( Nu[ k ] ) );

				}

			}

			const Sw = new THREE.Vector4( 0, 0, 0, 0 );

			for ( let l = 0; l <= q; ++ l ) {

				Sw.add( temp[ l ].multiplyScalar( Nv[ l ] ) );

			}

			Sw.divideScalar( Sw.w );
			target.set( Sw.x, Sw.y, Sw.z );

		}

	}

	THREE.NURBSUtils = NURBSUtils;

} )();

// ---- NURBSCurve.js
( function () {

	/**
 * NURBS curve object
 *
 * Derives from THREE.Curve, overriding getPoint and getTangent.
 *
 * Implementation is based on (x, y [, z=0 [, w=1]]) control points with w=weight.
 *
 **/

	class NURBSCurve extends THREE.Curve {

		constructor( degree, knots
			/* array of reals */
			, controlPoints
			/* array of Vector(2|3|4) */
			, startKnot
			/* index in knots */
			, endKnot
			/* index in knots */
		) {

			super();
			this.degree = degree;
			this.knots = knots;
			this.controlPoints = []; // Used by periodic NURBS to remove hidden spans

			this.startKnot = startKnot || 0;
			this.endKnot = endKnot || this.knots.length - 1;

			for ( let i = 0; i < controlPoints.length; ++ i ) {

				// ensure THREE.Vector4 for control points
				const point = controlPoints[ i ];
				this.controlPoints[ i ] = new THREE.Vector4( point.x, point.y, point.z, point.w );

			}

		}

		getPoint( t, optionalTarget = new THREE.Vector3() ) {

			const point = optionalTarget;
			const u = this.knots[ this.startKnot ] + t * ( this.knots[ this.endKnot ] - this.knots[ this.startKnot ] ); // linear mapping t->u
			// following results in (wx, wy, wz, w) homogeneous point

			const hpoint = THREE.NURBSUtils.calcBSplinePoint( this.degree, this.knots, this.controlPoints, u );

			if ( hpoint.w !== 1.0 ) {

				// project to 3D space: (wx, wy, wz, w) -> (x, y, z, 1)
				hpoint.divideScalar( hpoint.w );

			}

			return point.set( hpoint.x, hpoint.y, hpoint.z );

		}

		getTangent( t, optionalTarget = new THREE.Vector3() ) {

			const tangent = optionalTarget;
			const u = this.knots[ 0 ] + t * ( this.knots[ this.knots.length - 1 ] - this.knots[ 0 ] );
			const ders = THREE.NURBSUtils.calcNURBSDerivatives( this.degree, this.knots, this.controlPoints, u, 1 );
			tangent.copy( ders[ 1 ] ).normalize();
			return tangent;

		}

	}

	THREE.NURBSCurve = NURBSCurve;

} )();

// ---- TGALoader.js
( function () {

	class TGALoader extends THREE.DataTextureLoader {

		constructor( manager ) {

			super( manager );

		}

		parse( buffer ) {

			// reference from vthibault, https://github.com/vthibault/roBrowser/blob/master/src/Loaders/Targa.js
			function tgaCheckHeader( header ) {

				switch ( header.image_type ) {

					// check indexed type
					case TGA_TYPE_INDEXED:
					case TGA_TYPE_RLE_INDEXED:
						if ( header.colormap_length > 256 || header.colormap_size !== 24 || header.colormap_type !== 1 ) {

							console.error( 'THREE.TGALoader: Invalid type colormap data for indexed type.' );

						}

						break;
						// check colormap type

					case TGA_TYPE_RGB:
					case TGA_TYPE_GREY:
					case TGA_TYPE_RLE_RGB:
					case TGA_TYPE_RLE_GREY:
						if ( header.colormap_type ) {

							console.error( 'THREE.TGALoader: Invalid type colormap data for colormap type.' );

						}

						break;
						// What the need of a file without data ?

					case TGA_TYPE_NO_DATA:
						console.error( 'THREE.TGALoader: No data.' );
						// Invalid type ?

					default:
						console.error( 'THREE.TGALoader: Invalid type "%s".', header.image_type );

				} // check image width and height


				if ( header.width <= 0 || header.height <= 0 ) {

					console.error( 'THREE.TGALoader: Invalid image size.' );

				} // check image pixel size


				if ( header.pixel_size !== 8 && header.pixel_size !== 16 && header.pixel_size !== 24 && header.pixel_size !== 32 ) {

					console.error( 'THREE.TGALoader: Invalid pixel size "%s".', header.pixel_size );

				}

			} // parse tga image buffer


			function tgaParse( use_rle, use_pal, header, offset, data ) {

				let pixel_data, palettes;
				const pixel_size = header.pixel_size >> 3;
				const pixel_total = header.width * header.height * pixel_size; // read palettes

				if ( use_pal ) {

					palettes = data.subarray( offset, offset += header.colormap_length * ( header.colormap_size >> 3 ) );

				} // read RLE


				if ( use_rle ) {

					pixel_data = new Uint8Array( pixel_total );
					let c, count, i;
					let shift = 0;
					const pixels = new Uint8Array( pixel_size );

					while ( shift < pixel_total ) {

						c = data[ offset ++ ];
						count = ( c & 0x7f ) + 1; // RLE pixels

						if ( c & 0x80 ) {

							// bind pixel tmp array
							for ( i = 0; i < pixel_size; ++ i ) {

								pixels[ i ] = data[ offset ++ ];

							} // copy pixel array


							for ( i = 0; i < count; ++ i ) {

								pixel_data.set( pixels, shift + i * pixel_size );

							}

							shift += pixel_size * count;

						} else {

							// raw pixels
							count *= pixel_size;

							for ( i = 0; i < count; ++ i ) {

								pixel_data[ shift + i ] = data[ offset ++ ];

							}

							shift += count;

						}

					}

				} else {

					// raw pixels
					pixel_data = data.subarray( offset, offset += use_pal ? header.width * header.height : pixel_total );

				}

				return {
					pixel_data: pixel_data,
					palettes: palettes
				};

			}

			function tgaGetImageData8bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image, palettes ) {

				const colormap = palettes;
				let color,
					i = 0,
					x,
					y;
				const width = header.width;

				for ( y = y_start; y !== y_end; y += y_step ) {

					for ( x = x_start; x !== x_end; x += x_step, i ++ ) {

						color = image[ i ];
						imageData[ ( x + width * y ) * 4 + 3 ] = 255;
						imageData[ ( x + width * y ) * 4 + 2 ] = colormap[ color * 3 + 0 ];
						imageData[ ( x + width * y ) * 4 + 1 ] = colormap[ color * 3 + 1 ];
						imageData[ ( x + width * y ) * 4 + 0 ] = colormap[ color * 3 + 2 ];

					}

				}

				return imageData;

			}

			function tgaGetImageData16bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

				let color,
					i = 0,
					x,
					y;
				const width = header.width;

				for ( y = y_start; y !== y_end; y += y_step ) {

					for ( x = x_start; x !== x_end; x += x_step, i += 2 ) {

						color = image[ i + 0 ] + ( image[ i + 1 ] << 8 ); // Inversed ?

						imageData[ ( x + width * y ) * 4 + 0 ] = ( color & 0x7C00 ) >> 7;
						imageData[ ( x + width * y ) * 4 + 1 ] = ( color & 0x03E0 ) >> 2;
						imageData[ ( x + width * y ) * 4 + 2 ] = ( color & 0x001F ) >> 3;
						imageData[ ( x + width * y ) * 4 + 3 ] = color & 0x8000 ? 0 : 255;

					}

				}

				return imageData;

			}

			function tgaGetImageData24bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

				let i = 0,
					x,
					y;
				const width = header.width;

				for ( y = y_start; y !== y_end; y += y_step ) {

					for ( x = x_start; x !== x_end; x += x_step, i += 3 ) {

						imageData[ ( x + width * y ) * 4 + 3 ] = 255;
						imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 1 ];
						imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 2 ];

					}

				}

				return imageData;

			}

			function tgaGetImageData32bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

				let i = 0,
					x,
					y;
				const width = header.width;

				for ( y = y_start; y !== y_end; y += y_step ) {

					for ( x = x_start; x !== x_end; x += x_step, i += 4 ) {

						imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 1 ];
						imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 2 ];
						imageData[ ( x + width * y ) * 4 + 3 ] = image[ i + 3 ];

					}

				}

				return imageData;

			}

			function tgaGetImageDataGrey8bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

				let color,
					i = 0,
					x,
					y;
				const width = header.width;

				for ( y = y_start; y !== y_end; y += y_step ) {

					for ( x = x_start; x !== x_end; x += x_step, i ++ ) {

						color = image[ i ];
						imageData[ ( x + width * y ) * 4 + 0 ] = color;
						imageData[ ( x + width * y ) * 4 + 1 ] = color;
						imageData[ ( x + width * y ) * 4 + 2 ] = color;
						imageData[ ( x + width * y ) * 4 + 3 ] = 255;

					}

				}

				return imageData;

			}

			function tgaGetImageDataGrey16bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

				let i = 0,
					x,
					y;
				const width = header.width;

				for ( y = y_start; y !== y_end; y += y_step ) {

					for ( x = x_start; x !== x_end; x += x_step, i += 2 ) {

						imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 3 ] = image[ i + 1 ];

					}

				}

				return imageData;

			}

			function getTgaRGBA( data, width, height, image, palette ) {

				let x_start, y_start, x_step, y_step, x_end, y_end;

				switch ( ( header.flags & TGA_ORIGIN_MASK ) >> TGA_ORIGIN_SHIFT ) {

					default:
					case TGA_ORIGIN_UL:
						x_start = 0;
						x_step = 1;
						x_end = width;
						y_start = 0;
						y_step = 1;
						y_end = height;
						break;

					case TGA_ORIGIN_BL:
						x_start = 0;
						x_step = 1;
						x_end = width;
						y_start = height - 1;
						y_step = - 1;
						y_end = - 1;
						break;

					case TGA_ORIGIN_UR:
						x_start = width - 1;
						x_step = - 1;
						x_end = - 1;
						y_start = 0;
						y_step = 1;
						y_end = height;
						break;

					case TGA_ORIGIN_BR:
						x_start = width - 1;
						x_step = - 1;
						x_end = - 1;
						y_start = height - 1;
						y_step = - 1;
						y_end = - 1;
						break;

				}

				if ( use_grey ) {

					switch ( header.pixel_size ) {

						case 8:
							tgaGetImageDataGrey8bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;

						case 16:
							tgaGetImageDataGrey16bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;

						default:
							console.error( 'THREE.TGALoader: Format not supported.' );
							break;

					}

				} else {

					switch ( header.pixel_size ) {

						case 8:
							tgaGetImageData8bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image, palette );
							break;

						case 16:
							tgaGetImageData16bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;

						case 24:
							tgaGetImageData24bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;

						case 32:
							tgaGetImageData32bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;

						default:
							console.error( 'THREE.TGALoader: Format not supported.' );
							break;

					}

				} // Load image data according to specific method
				// let func = 'tgaGetImageData' + (use_grey ? 'Grey' : '') + (header.pixel_size) + 'bits';
				// func(data, y_start, y_step, y_end, x_start, x_step, x_end, width, image, palette );


				return data;

			} // TGA constants


			const TGA_TYPE_NO_DATA = 0,
				TGA_TYPE_INDEXED = 1,
				TGA_TYPE_RGB = 2,
				TGA_TYPE_GREY = 3,
				TGA_TYPE_RLE_INDEXED = 9,
				TGA_TYPE_RLE_RGB = 10,
				TGA_TYPE_RLE_GREY = 11,
				TGA_ORIGIN_MASK = 0x30,
				TGA_ORIGIN_SHIFT = 0x04,
				TGA_ORIGIN_BL = 0x00,
				TGA_ORIGIN_BR = 0x01,
				TGA_ORIGIN_UL = 0x02,
				TGA_ORIGIN_UR = 0x03;
			if ( buffer.length < 19 ) console.error( 'THREE.TGALoader: Not enough data to contain header.' );
			let offset = 0;
			const content = new Uint8Array( buffer ),
				header = {
					id_length: content[ offset ++ ],
					colormap_type: content[ offset ++ ],
					image_type: content[ offset ++ ],
					colormap_index: content[ offset ++ ] | content[ offset ++ ] << 8,
					colormap_length: content[ offset ++ ] | content[ offset ++ ] << 8,
					colormap_size: content[ offset ++ ],
					origin: [ content[ offset ++ ] | content[ offset ++ ] << 8, content[ offset ++ ] | content[ offset ++ ] << 8 ],
					width: content[ offset ++ ] | content[ offset ++ ] << 8,
					height: content[ offset ++ ] | content[ offset ++ ] << 8,
					pixel_size: content[ offset ++ ],
					flags: content[ offset ++ ]
				}; // check tga if it is valid format

			tgaCheckHeader( header );

			if ( header.id_length + offset > buffer.length ) {

				console.error( 'THREE.TGALoader: No data.' );

			} // skip the needn't data


			offset += header.id_length; // get targa information about RLE compression and palette

			let use_rle = false,
				use_pal = false,
				use_grey = false;

			switch ( header.image_type ) {

				case TGA_TYPE_RLE_INDEXED:
					use_rle = true;
					use_pal = true;
					break;

				case TGA_TYPE_INDEXED:
					use_pal = true;
					break;

				case TGA_TYPE_RLE_RGB:
					use_rle = true;
					break;

				case TGA_TYPE_RGB:
					break;

				case TGA_TYPE_RLE_GREY:
					use_rle = true;
					use_grey = true;
					break;

				case TGA_TYPE_GREY:
					use_grey = true;
					break;

			} //


			const imageData = new Uint8Array( header.width * header.height * 4 );
			const result = tgaParse( use_rle, use_pal, header, offset, content );
			getTgaRGBA( imageData, header.width, header.height, result.pixel_data, result.palettes );
			return {
				data: imageData,
				width: header.width,
				height: header.height,
				flipY: true,
				generateMipmaps: true,
				minFilter: THREE.LinearMipmapLinearFilter
			};

		}

	}

	THREE.TGALoader = TGALoader;

} )();

// ---- FBXLoader.js
( function () {

	/**
 * THREE.Loader loads FBX file and generates THREE.Group representing FBX scene.
 * Requires FBX file to be >= 7.0 and in ASCII or >= 6400 in Binary format
 * Versions lower than this may load but will probably have errors
 *
 * Needs Support:
 *  Morph normals / blend shape normals
 *
 * FBX format references:
 * 	https://wiki.blender.org/index.php/User:Mont29/Foundation/FBX_File_Structure
 * 	http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_index_html (C++ SDK reference)
 *
 * 	Binary format specification:
 *		https://code.blender.org/2013/08/fbx-binary-file-format-specification/
 */

	let fbxTree;
	let connections;
	let sceneGraph;

	class FBXLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const path = scope.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( scope.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( scope.requestHeader );
			loader.setWithCredentials( scope.withCredentials );
			loader.load( url, function ( buffer ) {

				try {

					onLoad( scope.parse( buffer, path ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		parse( FBXBuffer, path ) {

			if ( isFbxFormatBinary( FBXBuffer ) ) {

				fbxTree = new BinaryParser().parse( FBXBuffer );

			} else {

				const FBXText = convertArrayBufferToString( FBXBuffer );

				if ( ! isFbxFormatASCII( FBXText ) ) {

					throw new Error( 'THREE.FBXLoader: Unknown format.' );

				}

				if ( getFbxVersion( FBXText ) < 7000 ) {

					throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + getFbxVersion( FBXText ) );

				}

				fbxTree = new TextParser().parse( FBXText );

			} // console.log( fbxTree );


			const textureLoader = new THREE.TextureLoader( this.manager ).setPath( this.resourcePath || path ).setCrossOrigin( this.crossOrigin );
			return new FBXTreeParser( textureLoader, this.manager ).parse( fbxTree );

		}

	} // Parse the FBXTree object returned by the BinaryParser or TextParser and return a THREE.Group


	class FBXTreeParser {

		constructor( textureLoader, manager ) {

			this.textureLoader = textureLoader;
			this.manager = manager;

		}

		parse() {

			connections = this.parseConnections();
			const images = this.parseImages();
			const textures = this.parseTextures( images );
			const materials = this.parseMaterials( textures );
			const deformers = this.parseDeformers();
			const geometryMap = new GeometryParser().parse( deformers );
			this.parseScene( deformers, geometryMap, materials );
			return sceneGraph;

		} // Parses FBXTree.Connections which holds parent-child connections between objects (e.g. material -> texture, model->geometry )
		// and details the connection type


		parseConnections() {

			const connectionMap = new Map();

			if ( 'Connections' in fbxTree ) {

				const rawConnections = fbxTree.Connections.connections;
				rawConnections.forEach( function ( rawConnection ) {

					const fromID = rawConnection[ 0 ];
					const toID = rawConnection[ 1 ];
					const relationship = rawConnection[ 2 ];

					if ( ! connectionMap.has( fromID ) ) {

						connectionMap.set( fromID, {
							parents: [],
							children: []
						} );

					}

					const parentRelationship = {
						ID: toID,
						relationship: relationship
					};
					connectionMap.get( fromID ).parents.push( parentRelationship );

					if ( ! connectionMap.has( toID ) ) {

						connectionMap.set( toID, {
							parents: [],
							children: []
						} );

					}

					const childRelationship = {
						ID: fromID,
						relationship: relationship
					};
					connectionMap.get( toID ).children.push( childRelationship );

				} );

			}

			return connectionMap;

		} // Parse FBXTree.Objects.Video for embedded image data
		// These images are connected to textures in FBXTree.Objects.Textures
		// via FBXTree.Connections.


		parseImages() {

			const images = {};
			const blobs = {};

			if ( 'Video' in fbxTree.Objects ) {

				const videoNodes = fbxTree.Objects.Video;

				for ( const nodeID in videoNodes ) {

					const videoNode = videoNodes[ nodeID ];
					const id = parseInt( nodeID );
					images[ id ] = videoNode.RelativeFilename || videoNode.Filename; // raw image data is in videoNode.Content

					if ( 'Content' in videoNode ) {

						const arrayBufferContent = videoNode.Content instanceof ArrayBuffer && videoNode.Content.byteLength > 0;
						const base64Content = typeof videoNode.Content === 'string' && videoNode.Content !== '';

						if ( arrayBufferContent || base64Content ) {

							const image = this.parseImage( videoNodes[ nodeID ] );
							blobs[ videoNode.RelativeFilename || videoNode.Filename ] = image;

						}

					}

				}

			}

			for ( const id in images ) {

				const filename = images[ id ];
				if ( blobs[ filename ] !== undefined ) images[ id ] = blobs[ filename ]; else images[ id ] = images[ id ].split( '\\' ).pop();

			}

			return images;

		} // Parse embedded image data in FBXTree.Video.Content


		parseImage( videoNode ) {

			const content = videoNode.Content;
			const fileName = videoNode.RelativeFilename || videoNode.Filename;
			const extension = fileName.slice( fileName.lastIndexOf( '.' ) + 1 ).toLowerCase();
			let type;

			switch ( extension ) {

				case 'bmp':
					type = 'image/bmp';
					break;

				case 'jpg':
				case 'jpeg':
					type = 'image/jpeg';
					break;

				case 'png':
					type = 'image/png';
					break;

				case 'tif':
					type = 'image/tiff';
					break;

				case 'tga':
					if ( this.manager.getHandler( '.tga' ) === null ) {

						console.warn( 'FBXLoader: TGA loader not found, skipping ', fileName );

					}

					type = 'image/tga';
					break;

				default:
					console.warn( 'FBXLoader: Image type "' + extension + '" is not supported.' );
					return;

			}

			if ( typeof content === 'string' ) {

				// ASCII format
				return 'data:' + type + ';base64,' + content;

			} else {

				// Binary Format
				const array = new Uint8Array( content );
				return window.URL.createObjectURL( new Blob( [ array ], {
					type: type
				} ) );

			}

		} // Parse nodes in FBXTree.Objects.Texture
		// These contain details such as UV scaling, cropping, rotation etc and are connected
		// to images in FBXTree.Objects.Video


		parseTextures( images ) {

			const textureMap = new Map();

			if ( 'Texture' in fbxTree.Objects ) {

				const textureNodes = fbxTree.Objects.Texture;

				for ( const nodeID in textureNodes ) {

					const texture = this.parseTexture( textureNodes[ nodeID ], images );
					textureMap.set( parseInt( nodeID ), texture );

				}

			}

			return textureMap;

		} // Parse individual node in FBXTree.Objects.Texture


		parseTexture( textureNode, images ) {

			const texture = this.loadTexture( textureNode, images );
			texture.ID = textureNode.id;
			texture.name = textureNode.attrName;
			const wrapModeU = textureNode.WrapModeU;
			const wrapModeV = textureNode.WrapModeV;
			const valueU = wrapModeU !== undefined ? wrapModeU.value : 0;
			const valueV = wrapModeV !== undefined ? wrapModeV.value : 0; // http://download.autodesk.com/us/fbx/SDKdocs/FBX_SDK_Help/files/fbxsdkref/class_k_fbx_texture.html#889640e63e2e681259ea81061b85143a
			// 0: repeat(default), 1: clamp

			texture.wrapS = valueU === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
			texture.wrapT = valueV === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

			if ( 'Scaling' in textureNode ) {

				const values = textureNode.Scaling.value;
				texture.repeat.x = values[ 0 ];
				texture.repeat.y = values[ 1 ];

			}

			return texture;

		} // load a texture specified as a blob or data URI, or via an external URL using THREE.TextureLoader


		loadTexture( textureNode, images ) {

			let fileName;
			const currentPath = this.textureLoader.path;
			const children = connections.get( textureNode.id ).children;

			if ( children !== undefined && children.length > 0 && images[ children[ 0 ].ID ] !== undefined ) {

				fileName = images[ children[ 0 ].ID ];

				if ( fileName.indexOf( 'blob:' ) === 0 || fileName.indexOf( 'data:' ) === 0 ) {

					this.textureLoader.setPath( undefined );

				}

			}

			let texture;
			const extension = textureNode.FileName.slice( - 3 ).toLowerCase();

			if ( extension === 'tga' ) {

				const loader = this.manager.getHandler( '.tga' );

				if ( loader === null ) {

					console.warn( 'FBXLoader: TGA loader not found, creating placeholder texture for', textureNode.RelativeFilename );
					texture = new THREE.Texture();

				} else {

					texture = loader.load( fileName );

				}

			} else if ( extension === 'psd' ) {

				console.warn( 'FBXLoader: PSD textures are not supported, creating placeholder texture for', textureNode.RelativeFilename );
				texture = new THREE.Texture();

			} else {

				texture = this.textureLoader.load( fileName );

			}

			this.textureLoader.setPath( currentPath );
			return texture;

		} // Parse nodes in FBXTree.Objects.Material


		parseMaterials( textureMap ) {

			const materialMap = new Map();

			if ( 'Material' in fbxTree.Objects ) {

				const materialNodes = fbxTree.Objects.Material;

				for ( const nodeID in materialNodes ) {

					const material = this.parseMaterial( materialNodes[ nodeID ], textureMap );
					if ( material !== null ) materialMap.set( parseInt( nodeID ), material );

				}

			}

			return materialMap;

		} // Parse single node in FBXTree.Objects.Material
		// Materials are connected to texture maps in FBXTree.Objects.Textures
		// FBX format currently only supports Lambert and Phong shading models


		parseMaterial( materialNode, textureMap ) {

			const ID = materialNode.id;
			const name = materialNode.attrName;
			let type = materialNode.ShadingModel; // Case where FBX wraps shading model in property object.

			if ( typeof type === 'object' ) {

				type = type.value;

			} // Ignore unused materials which don't have any connections.


			if ( ! connections.has( ID ) ) return null;
			const parameters = this.parseParameters( materialNode, textureMap, ID );
			let material;

			switch ( type.toLowerCase() ) {

				case 'phong':
					material = new THREE.MeshPhongMaterial();
					break;

				case 'lambert':
					material = new THREE.MeshLambertMaterial();
					break;

				default:
					console.warn( 'THREE.FBXLoader: unknown material type "%s". Defaulting to THREE.MeshPhongMaterial.', type );
					material = new THREE.MeshPhongMaterial();
					break;

			}

			material.setValues( parameters );
			material.name = name;
			return material;

		} // Parse FBX material and return parameters suitable for a three.js material
		// Also parse the texture map and return any textures associated with the material


		parseParameters( materialNode, textureMap, ID ) {

			const parameters = {};

			if ( materialNode.BumpFactor ) {

				parameters.bumpScale = materialNode.BumpFactor.value;

			}

			if ( materialNode.Diffuse ) {

				parameters.color = new THREE.Color().fromArray( materialNode.Diffuse.value );

			} else if ( materialNode.DiffuseColor && ( materialNode.DiffuseColor.type === 'Color' || materialNode.DiffuseColor.type === 'ColorRGB' ) ) {

				// The blender exporter exports diffuse here instead of in materialNode.Diffuse
				parameters.color = new THREE.Color().fromArray( materialNode.DiffuseColor.value );

			}

			if ( materialNode.DisplacementFactor ) {

				parameters.displacementScale = materialNode.DisplacementFactor.value;

			}

			if ( materialNode.Emissive ) {

				parameters.emissive = new THREE.Color().fromArray( materialNode.Emissive.value );

			} else if ( materialNode.EmissiveColor && ( materialNode.EmissiveColor.type === 'Color' || materialNode.EmissiveColor.type === 'ColorRGB' ) ) {

				// The blender exporter exports emissive color here instead of in materialNode.Emissive
				parameters.emissive = new THREE.Color().fromArray( materialNode.EmissiveColor.value );

			}

			if ( materialNode.EmissiveFactor ) {

				parameters.emissiveIntensity = parseFloat( materialNode.EmissiveFactor.value );

			}

			if ( materialNode.Opacity ) {

				parameters.opacity = parseFloat( materialNode.Opacity.value );

			}

			if ( parameters.opacity < 1.0 ) {

				parameters.transparent = true;

			}

			if ( materialNode.ReflectionFactor ) {

				parameters.reflectivity = materialNode.ReflectionFactor.value;

			}

			if ( materialNode.Shininess ) {

				parameters.shininess = materialNode.Shininess.value;

			}

			if ( materialNode.Specular ) {

				parameters.specular = new THREE.Color().fromArray( materialNode.Specular.value );

			} else if ( materialNode.SpecularColor && materialNode.SpecularColor.type === 'Color' ) {

				// The blender exporter exports specular color here instead of in materialNode.Specular
				parameters.specular = new THREE.Color().fromArray( materialNode.SpecularColor.value );

			}

			const scope = this;
			connections.get( ID ).children.forEach( function ( child ) {

				const type = child.relationship;

				switch ( type ) {

					case 'Bump':
						parameters.bumpMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'Maya|TEX_ao_map':
						parameters.aoMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'DiffuseColor':
					case 'Maya|TEX_color_map':
						parameters.map = scope.getTexture( textureMap, child.ID );
						parameters.map.encoding = THREE.sRGBEncoding;
						break;

					case 'DisplacementColor':
						parameters.displacementMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'EmissiveColor':
						parameters.emissiveMap = scope.getTexture( textureMap, child.ID );
						parameters.emissiveMap.encoding = THREE.sRGBEncoding;
						break;

					case 'NormalMap':
					case 'Maya|TEX_normal_map':
						parameters.normalMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'ReflectionColor':
						parameters.envMap = scope.getTexture( textureMap, child.ID );
						parameters.envMap.mapping = THREE.EquirectangularReflectionMapping;
						parameters.envMap.encoding = THREE.sRGBEncoding;
						break;

					case 'SpecularColor':
						parameters.specularMap = scope.getTexture( textureMap, child.ID );
						parameters.specularMap.encoding = THREE.sRGBEncoding;
						break;

					case 'TransparentColor':
					case 'TransparencyFactor':
						parameters.alphaMap = scope.getTexture( textureMap, child.ID );
						parameters.transparent = true;
						break;

					case 'AmbientColor':
					case 'ShininessExponent': // AKA glossiness map

					case 'SpecularFactor': // AKA specularLevel

					case 'VectorDisplacementColor': // NOTE: Seems to be a copy of DisplacementColor

					default:
						console.warn( 'THREE.FBXLoader: %s map is not supported in three.js, skipping texture.', type );
						break;

				}

			} );
			return parameters;

		} // get a texture from the textureMap for use by a material.


		getTexture( textureMap, id ) {

			// if the texture is a layered texture, just use the first layer and issue a warning
			if ( 'LayeredTexture' in fbxTree.Objects && id in fbxTree.Objects.LayeredTexture ) {

				console.warn( 'THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer.' );
				id = connections.get( id ).children[ 0 ].ID;

			}

			return textureMap.get( id );

		} // Parse nodes in FBXTree.Objects.Deformer
		// Deformer node can contain skinning or Vertex Cache animation data, however only skinning is supported here
		// Generates map of THREE.Skeleton-like objects for use later when generating and binding skeletons.


		parseDeformers() {

			const skeletons = {};
			const morphTargets = {};

			if ( 'Deformer' in fbxTree.Objects ) {

				const DeformerNodes = fbxTree.Objects.Deformer;

				for ( const nodeID in DeformerNodes ) {

					const deformerNode = DeformerNodes[ nodeID ];
					const relationships = connections.get( parseInt( nodeID ) );

					if ( deformerNode.attrType === 'Skin' ) {

						const skeleton = this.parseSkeleton( relationships, DeformerNodes );
						skeleton.ID = nodeID;
						if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: skeleton attached to more than one geometry is not supported.' );
						skeleton.geometryID = relationships.parents[ 0 ].ID;
						skeletons[ nodeID ] = skeleton;

					} else if ( deformerNode.attrType === 'BlendShape' ) {

						const morphTarget = {
							id: nodeID
						};
						morphTarget.rawTargets = this.parseMorphTargets( relationships, DeformerNodes );
						morphTarget.id = nodeID;
						if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: morph target attached to more than one geometry is not supported.' );
						morphTargets[ nodeID ] = morphTarget;

					}

				}

			}

			return {
				skeletons: skeletons,
				morphTargets: morphTargets
			};

		} // Parse single nodes in FBXTree.Objects.Deformer
		// The top level skeleton node has type 'Skin' and sub nodes have type 'Cluster'
		// Each skin node represents a skeleton and each cluster node represents a bone


		parseSkeleton( relationships, deformerNodes ) {

			const rawBones = [];
			relationships.children.forEach( function ( child ) {

				const boneNode = deformerNodes[ child.ID ];
				if ( boneNode.attrType !== 'Cluster' ) return;
				const rawBone = {
					ID: child.ID,
					indices: [],
					weights: [],
					transformLink: new THREE.Matrix4().fromArray( boneNode.TransformLink.a ) // transform: new THREE.Matrix4().fromArray( boneNode.Transform.a ),
					// linkMode: boneNode.Mode,

				};

				if ( 'Indexes' in boneNode ) {

					rawBone.indices = boneNode.Indexes.a;
					rawBone.weights = boneNode.Weights.a;

				}

				rawBones.push( rawBone );

			} );
			return {
				rawBones: rawBones,
				bones: []
			};

		} // The top level morph deformer node has type "BlendShape" and sub nodes have type "BlendShapeChannel"


		parseMorphTargets( relationships, deformerNodes ) {

			const rawMorphTargets = [];

			for ( let i = 0; i < relationships.children.length; i ++ ) {

				const child = relationships.children[ i ];
				const morphTargetNode = deformerNodes[ child.ID ];
				const rawMorphTarget = {
					name: morphTargetNode.attrName,
					initialWeight: morphTargetNode.DeformPercent,
					id: morphTargetNode.id,
					fullWeights: morphTargetNode.FullWeights.a
				};
				if ( morphTargetNode.attrType !== 'BlendShapeChannel' ) return;
				rawMorphTarget.geoID = connections.get( parseInt( child.ID ) ).children.filter( function ( child ) {

					return child.relationship === undefined;

				} )[ 0 ].ID;
				rawMorphTargets.push( rawMorphTarget );

			}

			return rawMorphTargets;

		} // create the main THREE.Group() to be returned by the loader


		parseScene( deformers, geometryMap, materialMap ) {

			sceneGraph = new THREE.Group();
			const modelMap = this.parseModels( deformers.skeletons, geometryMap, materialMap );
			const modelNodes = fbxTree.Objects.Model;
			const scope = this;
			modelMap.forEach( function ( model ) {

				const modelNode = modelNodes[ model.ID ];
				scope.setLookAtProperties( model, modelNode );
				const parentConnections = connections.get( model.ID ).parents;
				parentConnections.forEach( function ( connection ) {

					const parent = modelMap.get( connection.ID );
					if ( parent !== undefined ) parent.add( model );

				} );

				if ( model.parent === null ) {

					sceneGraph.add( model );

				}

			} );
			this.bindSkeleton( deformers.skeletons, geometryMap, modelMap );
			this.createAmbientLight();
			this.setupMorphMaterials();
			sceneGraph.traverse( function ( node ) {

				if ( node.userData.transformData ) {

					if ( node.parent ) {

						node.userData.transformData.parentMatrix = node.parent.matrix;
						node.userData.transformData.parentMatrixWorld = node.parent.matrixWorld;

					}

					const transform = generateTransform( node.userData.transformData );
					node.applyMatrix4( transform );
					node.updateWorldMatrix();

				}

			} );
			const animations = new AnimationParser().parse(); // if all the models where already combined in a single group, just return that

			if ( sceneGraph.children.length === 1 && sceneGraph.children[ 0 ].isGroup ) {

				sceneGraph.children[ 0 ].animations = animations;
				sceneGraph = sceneGraph.children[ 0 ];

			}

			sceneGraph.animations = animations;

		} // parse nodes in FBXTree.Objects.Model


		parseModels( skeletons, geometryMap, materialMap ) {

			const modelMap = new Map();
			const modelNodes = fbxTree.Objects.Model;

			for ( const nodeID in modelNodes ) {

				const id = parseInt( nodeID );
				const node = modelNodes[ nodeID ];
				const relationships = connections.get( id );
				let model = this.buildSkeleton( relationships, skeletons, id, node.attrName );

				if ( ! model ) {

					switch ( node.attrType ) {

						case 'Camera':
							model = this.createCamera( relationships );
							break;

						case 'Light':
							model = this.createLight( relationships );
							break;

						case 'Mesh':
							model = this.createMesh( relationships, geometryMap, materialMap );
							break;

						case 'NurbsCurve':
							model = this.createCurve( relationships, geometryMap );
							break;

						case 'LimbNode':
						case 'Root':
							model = new THREE.Bone();
							break;

						case 'Null':
						default:
							model = new THREE.Group();
							break;

					}

					model.name = node.attrName ? THREE.PropertyBinding.sanitizeNodeName( node.attrName ) : '';
					model.ID = id;

				}

				this.getTransformData( model, node );
				modelMap.set( id, model );

			}

			return modelMap;

		}

		buildSkeleton( relationships, skeletons, id, name ) {

			let bone = null;
			relationships.parents.forEach( function ( parent ) {

				for ( const ID in skeletons ) {

					const skeleton = skeletons[ ID ];
					skeleton.rawBones.forEach( function ( rawBone, i ) {

						if ( rawBone.ID === parent.ID ) {

							const subBone = bone;
							bone = new THREE.Bone();
							bone.matrixWorld.copy( rawBone.transformLink ); // set name and id here - otherwise in cases where "subBone" is created it will not have a name / id

							bone.name = name ? THREE.PropertyBinding.sanitizeNodeName( name ) : '';
							bone.ID = id;
							skeleton.bones[ i ] = bone; // In cases where a bone is shared between multiple meshes
							// duplicate the bone here and and it as a child of the first bone

							if ( subBone !== null ) {

								bone.add( subBone );

							}

						}

					} );

				}

			} );
			return bone;

		} // create a THREE.PerspectiveCamera or THREE.OrthographicCamera


		createCamera( relationships ) {

			let model;
			let cameraAttribute;
			relationships.children.forEach( function ( child ) {

				const attr = fbxTree.Objects.NodeAttribute[ child.ID ];

				if ( attr !== undefined ) {

					cameraAttribute = attr;

				}

			} );

			if ( cameraAttribute === undefined ) {

				model = new THREE.Object3D();

			} else {

				let type = 0;

				if ( cameraAttribute.CameraProjectionType !== undefined && cameraAttribute.CameraProjectionType.value === 1 ) {

					type = 1;

				}

				let nearClippingPlane = 1;

				if ( cameraAttribute.NearPlane !== undefined ) {

					nearClippingPlane = cameraAttribute.NearPlane.value / 1000;

				}

				let farClippingPlane = 1000;

				if ( cameraAttribute.FarPlane !== undefined ) {

					farClippingPlane = cameraAttribute.FarPlane.value / 1000;

				}

				let width = window.innerWidth;
				let height = window.innerHeight;

				if ( cameraAttribute.AspectWidth !== undefined && cameraAttribute.AspectHeight !== undefined ) {

					width = cameraAttribute.AspectWidth.value;
					height = cameraAttribute.AspectHeight.value;

				}

				const aspect = width / height;
				let fov = 45;

				if ( cameraAttribute.FieldOfView !== undefined ) {

					fov = cameraAttribute.FieldOfView.value;

				}

				const focalLength = cameraAttribute.FocalLength ? cameraAttribute.FocalLength.value : null;

				switch ( type ) {

					case 0:
						// Perspective
						model = new THREE.PerspectiveCamera( fov, aspect, nearClippingPlane, farClippingPlane );
						if ( focalLength !== null ) model.setFocalLength( focalLength );
						break;

					case 1:
						// Orthographic
						model = new THREE.OrthographicCamera( - width / 2, width / 2, height / 2, - height / 2, nearClippingPlane, farClippingPlane );
						break;

					default:
						console.warn( 'THREE.FBXLoader: Unknown camera type ' + type + '.' );
						model = new THREE.Object3D();
						break;

				}

			}

			return model;

		} // Create a THREE.DirectionalLight, THREE.PointLight or THREE.SpotLight


		createLight( relationships ) {

			let model;
			let lightAttribute;
			relationships.children.forEach( function ( child ) {

				const attr = fbxTree.Objects.NodeAttribute[ child.ID ];

				if ( attr !== undefined ) {

					lightAttribute = attr;

				}

			} );

			if ( lightAttribute === undefined ) {

				model = new THREE.Object3D();

			} else {

				let type; // LightType can be undefined for Point lights

				if ( lightAttribute.LightType === undefined ) {

					type = 0;

				} else {

					type = lightAttribute.LightType.value;

				}

				let color = 0xffffff;

				if ( lightAttribute.Color !== undefined ) {

					color = new THREE.Color().fromArray( lightAttribute.Color.value );

				}

				let intensity = lightAttribute.Intensity === undefined ? 1 : lightAttribute.Intensity.value / 100; // light disabled

				if ( lightAttribute.CastLightOnObject !== undefined && lightAttribute.CastLightOnObject.value === 0 ) {

					intensity = 0;

				}

				let distance = 0;

				if ( lightAttribute.FarAttenuationEnd !== undefined ) {

					if ( lightAttribute.EnableFarAttenuation !== undefined && lightAttribute.EnableFarAttenuation.value === 0 ) {

						distance = 0;

					} else {

						distance = lightAttribute.FarAttenuationEnd.value;

					}

				} // TODO: could this be calculated linearly from FarAttenuationStart to FarAttenuationEnd?


				const decay = 1;

				switch ( type ) {

					case 0:
						// Point
						model = new THREE.PointLight( color, intensity, distance, decay );
						break;

					case 1:
						// Directional
						model = new THREE.DirectionalLight( color, intensity );
						break;

					case 2:
						// Spot
						let angle = Math.PI / 3;

						if ( lightAttribute.InnerAngle !== undefined ) {

							angle = THREE.MathUtils.degToRad( lightAttribute.InnerAngle.value );

						}

						let penumbra = 0;

						if ( lightAttribute.OuterAngle !== undefined ) {

							// TODO: this is not correct - FBX calculates outer and inner angle in degrees
							// with OuterAngle > InnerAngle && OuterAngle <= Math.PI
							// while three.js uses a penumbra between (0, 1) to attenuate the inner angle
							penumbra = THREE.MathUtils.degToRad( lightAttribute.OuterAngle.value );
							penumbra = Math.max( penumbra, 1 );

						}

						model = new THREE.SpotLight( color, intensity, distance, angle, penumbra, decay );
						break;

					default:
						console.warn( 'THREE.FBXLoader: Unknown light type ' + lightAttribute.LightType.value + ', defaulting to a THREE.PointLight.' );
						model = new THREE.PointLight( color, intensity );
						break;

				}

				if ( lightAttribute.CastShadows !== undefined && lightAttribute.CastShadows.value === 1 ) {

					model.castShadow = true;

				}

			}

			return model;

		}

		createMesh( relationships, geometryMap, materialMap ) {

			let model;
			let geometry = null;
			let material = null;
			const materials = []; // get geometry and materials(s) from connections

			relationships.children.forEach( function ( child ) {

				if ( geometryMap.has( child.ID ) ) {

					geometry = geometryMap.get( child.ID );

				}

				if ( materialMap.has( child.ID ) ) {

					materials.push( materialMap.get( child.ID ) );

				}

			} );

			if ( materials.length > 1 ) {

				material = materials;

			} else if ( materials.length > 0 ) {

				material = materials[ 0 ];

			} else {

				material = new THREE.MeshPhongMaterial( {
					color: 0xcccccc
				} );
				materials.push( material );

			}

			if ( 'color' in geometry.attributes ) {

				materials.forEach( function ( material ) {

					material.vertexColors = true;

				} );

			}

			if ( geometry.FBX_Deformer ) {

				materials.forEach( function ( material ) {

					material.skinning = true;

				} );
				model = new THREE.SkinnedMesh( geometry, material );
				model.normalizeSkinWeights();

			} else {

				model = new THREE.Mesh( geometry, material );

			}

			return model;

		}

		createCurve( relationships, geometryMap ) {

			const geometry = relationships.children.reduce( function ( geo, child ) {

				if ( geometryMap.has( child.ID ) ) geo = geometryMap.get( child.ID );
				return geo;

			}, null ); // FBX does not list materials for Nurbs lines, so we'll just put our own in here.

			const material = new THREE.LineBasicMaterial( {
				color: 0x3300ff,
				linewidth: 1
			} );
			return new THREE.Line( geometry, material );

		} // parse the model node for transform data


		getTransformData( model, modelNode ) {

			const transformData = {};
			if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );
			if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value ); else transformData.eulerOrder = 'ZYX';
			if ( 'Lcl_Translation' in modelNode ) transformData.translation = modelNode.Lcl_Translation.value;
			if ( 'PreRotation' in modelNode ) transformData.preRotation = modelNode.PreRotation.value;
			if ( 'Lcl_Rotation' in modelNode ) transformData.rotation = modelNode.Lcl_Rotation.value;
			if ( 'PostRotation' in modelNode ) transformData.postRotation = modelNode.PostRotation.value;
			if ( 'Lcl_Scaling' in modelNode ) transformData.scale = modelNode.Lcl_Scaling.value;
			if ( 'ScalingOffset' in modelNode ) transformData.scalingOffset = modelNode.ScalingOffset.value;
			if ( 'ScalingPivot' in modelNode ) transformData.scalingPivot = modelNode.ScalingPivot.value;
			if ( 'RotationOffset' in modelNode ) transformData.rotationOffset = modelNode.RotationOffset.value;
			if ( 'RotationPivot' in modelNode ) transformData.rotationPivot = modelNode.RotationPivot.value;
			model.userData.transformData = transformData;

		}

		setLookAtProperties( model, modelNode ) {

			if ( 'LookAtProperty' in modelNode ) {

				const children = connections.get( model.ID ).children;
				children.forEach( function ( child ) {

					if ( child.relationship === 'LookAtProperty' ) {

						const lookAtTarget = fbxTree.Objects.Model[ child.ID ];

						if ( 'Lcl_Translation' in lookAtTarget ) {

							const pos = lookAtTarget.Lcl_Translation.value; // THREE.DirectionalLight, THREE.SpotLight

							if ( model.target !== undefined ) {

								model.target.position.fromArray( pos );
								sceneGraph.add( model.target );

							} else {

								// Cameras and other Object3Ds
								model.lookAt( new THREE.Vector3().fromArray( pos ) );

							}

						}

					}

				} );

			}

		}

		bindSkeleton( skeletons, geometryMap, modelMap ) {

			const bindMatrices = this.parsePoseNodes();

			for ( const ID in skeletons ) {

				const skeleton = skeletons[ ID ];
				const parents = connections.get( parseInt( skeleton.ID ) ).parents;
				parents.forEach( function ( parent ) {

					if ( geometryMap.has( parent.ID ) ) {

						const geoID = parent.ID;
						const geoRelationships = connections.get( geoID );
						geoRelationships.parents.forEach( function ( geoConnParent ) {

							if ( modelMap.has( geoConnParent.ID ) ) {

								const model = modelMap.get( geoConnParent.ID );
								model.bind( new THREE.Skeleton( skeleton.bones ), bindMatrices[ geoConnParent.ID ] );

							}

						} );

					}

				} );

			}

		}

		parsePoseNodes() {

			const bindMatrices = {};

			if ( 'Pose' in fbxTree.Objects ) {

				const BindPoseNode = fbxTree.Objects.Pose;

				for ( const nodeID in BindPoseNode ) {

					if ( BindPoseNode[ nodeID ].attrType === 'BindPose' ) {

						const poseNodes = BindPoseNode[ nodeID ].PoseNode;

						if ( Array.isArray( poseNodes ) ) {

							poseNodes.forEach( function ( poseNode ) {

								bindMatrices[ poseNode.Node ] = new THREE.Matrix4().fromArray( poseNode.Matrix.a );

							} );

						} else {

							bindMatrices[ poseNodes.Node ] = new THREE.Matrix4().fromArray( poseNodes.Matrix.a );

						}

					}

				}

			}

			return bindMatrices;

		} // Parse ambient color in FBXTree.GlobalSettings - if it's not set to black (default), create an ambient light


		createAmbientLight() {

			if ( 'GlobalSettings' in fbxTree && 'AmbientColor' in fbxTree.GlobalSettings ) {

				const ambientColor = fbxTree.GlobalSettings.AmbientColor.value;
				const r = ambientColor[ 0 ];
				const g = ambientColor[ 1 ];
				const b = ambientColor[ 2 ];

				if ( r !== 0 || g !== 0 || b !== 0 ) {

					const color = new THREE.Color( r, g, b );
					sceneGraph.add( new THREE.AmbientLight( color, 1 ) );

				}

			}

		}

		setupMorphMaterials() {

			const scope = this;
			sceneGraph.traverse( function ( child ) {

				if ( child.isMesh ) {

					if ( child.geometry.morphAttributes.position && child.geometry.morphAttributes.position.length ) {

						if ( Array.isArray( child.material ) ) {

							child.material.forEach( function ( material, i ) {

								scope.setupMorphMaterial( child, material, i );

							} );

						} else {

							scope.setupMorphMaterial( child, child.material );

						}

					}

				}

			} );

		}

		setupMorphMaterial( child, material, index ) {

			const uuid = child.uuid;
			const matUuid = material.uuid; // if a geometry has morph targets, it cannot share the material with other geometries

			let sharedMat = false;
			sceneGraph.traverse( function ( node ) {

				if ( node.isMesh ) {

					if ( Array.isArray( node.material ) ) {

						node.material.forEach( function ( mat ) {

							if ( mat.uuid === matUuid && node.uuid !== uuid ) sharedMat = true;

						} );

					} else if ( node.material.uuid === matUuid && node.uuid !== uuid ) sharedMat = true;

				}

			} );

			if ( sharedMat === true ) {

				const clonedMat = material.clone();
				clonedMat.morphTargets = true;
				if ( index === undefined ) child.material = clonedMat; else child.material[ index ] = clonedMat;

			} else material.morphTargets = true;

		}

	} // parse Geometry data from FBXTree and return map of BufferGeometries


	class GeometryParser {

		// Parse nodes in FBXTree.Objects.Geometry
		parse( deformers ) {

			const geometryMap = new Map();

			if ( 'Geometry' in fbxTree.Objects ) {

				const geoNodes = fbxTree.Objects.Geometry;

				for ( const nodeID in geoNodes ) {

					const relationships = connections.get( parseInt( nodeID ) );
					const geo = this.parseGeometry( relationships, geoNodes[ nodeID ], deformers );
					geometryMap.set( parseInt( nodeID ), geo );

				}

			}

			return geometryMap;

		} // Parse single node in FBXTree.Objects.Geometry


		parseGeometry( relationships, geoNode, deformers ) {

			switch ( geoNode.attrType ) {

				case 'Mesh':
					return this.parseMeshGeometry( relationships, geoNode, deformers );
					break;

				case 'NurbsCurve':
					return this.parseNurbsGeometry( geoNode );
					break;

			}

		} // Parse single node mesh geometry in FBXTree.Objects.Geometry


		parseMeshGeometry( relationships, geoNode, deformers ) {

			const skeletons = deformers.skeletons;
			const morphTargets = [];
			const modelNodes = relationships.parents.map( function ( parent ) {

				return fbxTree.Objects.Model[ parent.ID ];

			} ); // don't create geometry if it is not associated with any models

			if ( modelNodes.length === 0 ) return;
			const skeleton = relationships.children.reduce( function ( skeleton, child ) {

				if ( skeletons[ child.ID ] !== undefined ) skeleton = skeletons[ child.ID ];
				return skeleton;

			}, null );
			relationships.children.forEach( function ( child ) {

				if ( deformers.morphTargets[ child.ID ] !== undefined ) {

					morphTargets.push( deformers.morphTargets[ child.ID ] );

				}

			} ); // Assume one model and get the preRotation from that
			// if there is more than one model associated with the geometry this may cause problems

			const modelNode = modelNodes[ 0 ];
			const transformData = {};
			if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value );
			if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );
			if ( 'GeometricTranslation' in modelNode ) transformData.translation = modelNode.GeometricTranslation.value;
			if ( 'GeometricRotation' in modelNode ) transformData.rotation = modelNode.GeometricRotation.value;
			if ( 'GeometricScaling' in modelNode ) transformData.scale = modelNode.GeometricScaling.value;
			const transform = generateTransform( transformData );
			return this.genGeometry( geoNode, skeleton, morphTargets, transform );

		} // Generate a THREE.BufferGeometry from a node in FBXTree.Objects.Geometry


		genGeometry( geoNode, skeleton, morphTargets, preTransform ) {

			const geo = new THREE.BufferGeometry();
			if ( geoNode.attrName ) geo.name = geoNode.attrName;
			const geoInfo = this.parseGeoNode( geoNode, skeleton );
			const buffers = this.genBuffers( geoInfo );
			const positionAttribute = new THREE.Float32BufferAttribute( buffers.vertex, 3 );
			positionAttribute.applyMatrix4( preTransform );
			geo.setAttribute( 'position', positionAttribute );

			if ( buffers.colors.length > 0 ) {

				geo.setAttribute( 'color', new THREE.Float32BufferAttribute( buffers.colors, 3 ) );

			}

			if ( skeleton ) {

				geo.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( buffers.weightsIndices, 4 ) );
				geo.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( buffers.vertexWeights, 4 ) ); // used later to bind the skeleton to the model

				geo.FBX_Deformer = skeleton;

			}

			if ( buffers.normal.length > 0 ) {

				const normalMatrix = new THREE.Matrix3().getNormalMatrix( preTransform );
				const normalAttribute = new THREE.Float32BufferAttribute( buffers.normal, 3 );
				normalAttribute.applyNormalMatrix( normalMatrix );
				geo.setAttribute( 'normal', normalAttribute );

			}

			buffers.uvs.forEach( function ( uvBuffer, i ) {

				// subsequent uv buffers are called 'uv1', 'uv2', ...
				let name = 'uv' + ( i + 1 ).toString(); // the first uv buffer is just called 'uv'

				if ( i === 0 ) {

					name = 'uv';

				}

				geo.setAttribute( name, new THREE.Float32BufferAttribute( buffers.uvs[ i ], 2 ) );

			} );

			if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

				// Convert the material indices of each vertex into rendering groups on the geometry.
				let prevMaterialIndex = buffers.materialIndex[ 0 ];
				let startIndex = 0;
				buffers.materialIndex.forEach( function ( currentIndex, i ) {

					if ( currentIndex !== prevMaterialIndex ) {

						geo.addGroup( startIndex, i - startIndex, prevMaterialIndex );
						prevMaterialIndex = currentIndex;
						startIndex = i;

					}

				} ); // the loop above doesn't add the last group, do that here.

				if ( geo.groups.length > 0 ) {

					const lastGroup = geo.groups[ geo.groups.length - 1 ];
					const lastIndex = lastGroup.start + lastGroup.count;

					if ( lastIndex !== buffers.materialIndex.length ) {

						geo.addGroup( lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex );

					}

				} // case where there are multiple materials but the whole geometry is only
				// using one of them


				if ( geo.groups.length === 0 ) {

					geo.addGroup( 0, buffers.materialIndex.length, buffers.materialIndex[ 0 ] );

				}

			}

			this.addMorphTargets( geo, geoNode, morphTargets, preTransform );
			return geo;

		}

		parseGeoNode( geoNode, skeleton ) {

			const geoInfo = {};
			geoInfo.vertexPositions = geoNode.Vertices !== undefined ? geoNode.Vertices.a : [];
			geoInfo.vertexIndices = geoNode.PolygonVertexIndex !== undefined ? geoNode.PolygonVertexIndex.a : [];

			if ( geoNode.LayerElementColor ) {

				geoInfo.color = this.parseVertexColors( geoNode.LayerElementColor[ 0 ] );

			}

			if ( geoNode.LayerElementMaterial ) {

				geoInfo.material = this.parseMaterialIndices( geoNode.LayerElementMaterial[ 0 ] );

			}

			if ( geoNode.LayerElementNormal ) {

				geoInfo.normal = this.parseNormals( geoNode.LayerElementNormal[ 0 ] );

			}

			if ( geoNode.LayerElementUV ) {

				geoInfo.uv = [];
				let i = 0;

				while ( geoNode.LayerElementUV[ i ] ) {

					if ( geoNode.LayerElementUV[ i ].UV ) {

						geoInfo.uv.push( this.parseUVs( geoNode.LayerElementUV[ i ] ) );

					}

					i ++;

				}

			}

			geoInfo.weightTable = {};

			if ( skeleton !== null ) {

				geoInfo.skeleton = skeleton;
				skeleton.rawBones.forEach( function ( rawBone, i ) {

					// loop over the bone's vertex indices and weights
					rawBone.indices.forEach( function ( index, j ) {

						if ( geoInfo.weightTable[ index ] === undefined ) geoInfo.weightTable[ index ] = [];
						geoInfo.weightTable[ index ].push( {
							id: i,
							weight: rawBone.weights[ j ]
						} );

					} );

				} );

			}

			return geoInfo;

		}

		genBuffers( geoInfo ) {

			const buffers = {
				vertex: [],
				normal: [],
				colors: [],
				uvs: [],
				materialIndex: [],
				vertexWeights: [],
				weightsIndices: []
			};
			let polygonIndex = 0;
			let faceLength = 0;
			let displayedWeightsWarning = false; // these will hold data for a single face

			let facePositionIndexes = [];
			let faceNormals = [];
			let faceColors = [];
			let faceUVs = [];
			let faceWeights = [];
			let faceWeightIndices = [];
			const scope = this;
			geoInfo.vertexIndices.forEach( function ( vertexIndex, polygonVertexIndex ) {

				let materialIndex;
				let endOfFace = false; // Face index and vertex index arrays are combined in a single array
				// A cube with quad faces looks like this:
				// PolygonVertexIndex: *24 {
				//  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
				//  }
				// Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
				// to find index of last vertex bit shift the index: ^ - 1

				if ( vertexIndex < 0 ) {

					vertexIndex = vertexIndex ^ - 1; // equivalent to ( x * -1 ) - 1

					endOfFace = true;

				}

				let weightIndices = [];
				let weights = [];
				facePositionIndexes.push( vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2 );

				if ( geoInfo.color ) {

					const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color );
					faceColors.push( data[ 0 ], data[ 1 ], data[ 2 ] );

				}

				if ( geoInfo.skeleton ) {

					if ( geoInfo.weightTable[ vertexIndex ] !== undefined ) {

						geoInfo.weightTable[ vertexIndex ].forEach( function ( wt ) {

							weights.push( wt.weight );
							weightIndices.push( wt.id );

						} );

					}

					if ( weights.length > 4 ) {

						if ( ! displayedWeightsWarning ) {

							console.warn( 'THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.' );
							displayedWeightsWarning = true;

						}

						const wIndex = [ 0, 0, 0, 0 ];
						const Weight = [ 0, 0, 0, 0 ];
						weights.forEach( function ( weight, weightIndex ) {

							let currentWeight = weight;
							let currentIndex = weightIndices[ weightIndex ];
							Weight.forEach( function ( comparedWeight, comparedWeightIndex, comparedWeightArray ) {

								if ( currentWeight > comparedWeight ) {

									comparedWeightArray[ comparedWeightIndex ] = currentWeight;
									currentWeight = comparedWeight;
									const tmp = wIndex[ comparedWeightIndex ];
									wIndex[ comparedWeightIndex ] = currentIndex;
									currentIndex = tmp;

								}

							} );

						} );
						weightIndices = wIndex;
						weights = Weight;

					} // if the weight array is shorter than 4 pad with 0s


					while ( weights.length < 4 ) {

						weights.push( 0 );
						weightIndices.push( 0 );

					}

					for ( let i = 0; i < 4; ++ i ) {

						faceWeights.push( weights[ i ] );
						faceWeightIndices.push( weightIndices[ i ] );

					}

				}

				if ( geoInfo.normal ) {

					const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal );
					faceNormals.push( data[ 0 ], data[ 1 ], data[ 2 ] );

				}

				if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

					materialIndex = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.material )[ 0 ];

				}

				if ( geoInfo.uv ) {

					geoInfo.uv.forEach( function ( uv, i ) {

						const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, uv );

						if ( faceUVs[ i ] === undefined ) {

							faceUVs[ i ] = [];

						}

						faceUVs[ i ].push( data[ 0 ] );
						faceUVs[ i ].push( data[ 1 ] );

					} );

				}

				faceLength ++;

				if ( endOfFace ) {

					scope.genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength );
					polygonIndex ++;
					faceLength = 0; // reset arrays for the next face

					facePositionIndexes = [];
					faceNormals = [];
					faceColors = [];
					faceUVs = [];
					faceWeights = [];
					faceWeightIndices = [];

				}

			} );
			return buffers;

		} // Generate data for a single face in a geometry. If the face is a quad then split it into 2 tris


		genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength ) {

			for ( let i = 2; i < faceLength; i ++ ) {

				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 0 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 2 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 2 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 2 ] ] );

				if ( geoInfo.skeleton ) {

					buffers.vertexWeights.push( faceWeights[ 0 ] );
					buffers.vertexWeights.push( faceWeights[ 1 ] );
					buffers.vertexWeights.push( faceWeights[ 2 ] );
					buffers.vertexWeights.push( faceWeights[ 3 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 1 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 2 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 3 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 1 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 2 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 0 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 3 ] );

				}

				if ( geoInfo.color ) {

					buffers.colors.push( faceColors[ 0 ] );
					buffers.colors.push( faceColors[ 1 ] );
					buffers.colors.push( faceColors[ 2 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 1 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 2 ] );
					buffers.colors.push( faceColors[ i * 3 ] );
					buffers.colors.push( faceColors[ i * 3 + 1 ] );
					buffers.colors.push( faceColors[ i * 3 + 2 ] );

				}

				if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

					buffers.materialIndex.push( materialIndex );
					buffers.materialIndex.push( materialIndex );
					buffers.materialIndex.push( materialIndex );

				}

				if ( geoInfo.normal ) {

					buffers.normal.push( faceNormals[ 0 ] );
					buffers.normal.push( faceNormals[ 1 ] );
					buffers.normal.push( faceNormals[ 2 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 1 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 2 ] );
					buffers.normal.push( faceNormals[ i * 3 ] );
					buffers.normal.push( faceNormals[ i * 3 + 1 ] );
					buffers.normal.push( faceNormals[ i * 3 + 2 ] );

				}

				if ( geoInfo.uv ) {

					geoInfo.uv.forEach( function ( uv, j ) {

						if ( buffers.uvs[ j ] === undefined ) buffers.uvs[ j ] = [];
						buffers.uvs[ j ].push( faceUVs[ j ][ 0 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ 1 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 + 1 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 + 1 ] );

					} );

				}

			}

		}

		addMorphTargets( parentGeo, parentGeoNode, morphTargets, preTransform ) {

			if ( morphTargets.length === 0 ) return;
			parentGeo.morphTargetsRelative = true;
			parentGeo.morphAttributes.position = []; // parentGeo.morphAttributes.normal = []; // not implemented

			const scope = this;
			morphTargets.forEach( function ( morphTarget ) {

				morphTarget.rawTargets.forEach( function ( rawTarget ) {

					const morphGeoNode = fbxTree.Objects.Geometry[ rawTarget.geoID ];

					if ( morphGeoNode !== undefined ) {

						scope.genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, rawTarget.name );

					}

				} );

			} );

		} // a morph geometry node is similar to a standard  node, and the node is also contained
		// in FBXTree.Objects.Geometry, however it can only have attributes for position, normal
		// and a special attribute Index defining which vertices of the original geometry are affected
		// Normal and position attributes only have data for the vertices that are affected by the morph


		genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, name ) {

			const vertexIndices = parentGeoNode.PolygonVertexIndex !== undefined ? parentGeoNode.PolygonVertexIndex.a : [];
			const morphPositionsSparse = morphGeoNode.Vertices !== undefined ? morphGeoNode.Vertices.a : [];
			const indices = morphGeoNode.Indexes !== undefined ? morphGeoNode.Indexes.a : [];
			const length = parentGeo.attributes.position.count * 3;
			const morphPositions = new Float32Array( length );

			for ( let i = 0; i < indices.length; i ++ ) {

				const morphIndex = indices[ i ] * 3;
				morphPositions[ morphIndex ] = morphPositionsSparse[ i * 3 ];
				morphPositions[ morphIndex + 1 ] = morphPositionsSparse[ i * 3 + 1 ];
				morphPositions[ morphIndex + 2 ] = morphPositionsSparse[ i * 3 + 2 ];

			} // TODO: add morph normal support


			const morphGeoInfo = {
				vertexIndices: vertexIndices,
				vertexPositions: morphPositions
			};
			const morphBuffers = this.genBuffers( morphGeoInfo );
			const positionAttribute = new THREE.Float32BufferAttribute( morphBuffers.vertex, 3 );
			positionAttribute.name = name || morphGeoNode.attrName;
			positionAttribute.applyMatrix4( preTransform );
			parentGeo.morphAttributes.position.push( positionAttribute );

		} // Parse normal from FBXTree.Objects.Geometry.LayerElementNormal if it exists


		parseNormals( NormalNode ) {

			const mappingType = NormalNode.MappingInformationType;
			const referenceType = NormalNode.ReferenceInformationType;
			const buffer = NormalNode.Normals.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				if ( 'NormalIndex' in NormalNode ) {

					indexBuffer = NormalNode.NormalIndex.a;

				} else if ( 'NormalsIndex' in NormalNode ) {

					indexBuffer = NormalNode.NormalsIndex.a;

				}

			}

			return {
				dataSize: 3,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse UVs from FBXTree.Objects.Geometry.LayerElementUV if it exists


		parseUVs( UVNode ) {

			const mappingType = UVNode.MappingInformationType;
			const referenceType = UVNode.ReferenceInformationType;
			const buffer = UVNode.UV.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				indexBuffer = UVNode.UVIndex.a;

			}

			return {
				dataSize: 2,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse Vertex Colors from FBXTree.Objects.Geometry.LayerElementColor if it exists


		parseVertexColors( ColorNode ) {

			const mappingType = ColorNode.MappingInformationType;
			const referenceType = ColorNode.ReferenceInformationType;
			const buffer = ColorNode.Colors.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				indexBuffer = ColorNode.ColorIndex.a;

			}

			return {
				dataSize: 4,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse mapping and material data in FBXTree.Objects.Geometry.LayerElementMaterial if it exists


		parseMaterialIndices( MaterialNode ) {

			const mappingType = MaterialNode.MappingInformationType;
			const referenceType = MaterialNode.ReferenceInformationType;

			if ( mappingType === 'NoMappingInformation' ) {

				return {
					dataSize: 1,
					buffer: [ 0 ],
					indices: [ 0 ],
					mappingType: 'AllSame',
					referenceType: referenceType
				};

			}

			const materialIndexBuffer = MaterialNode.Materials.a; // Since materials are stored as indices, there's a bit of a mismatch between FBX and what
			// we expect.So we create an intermediate buffer that points to the index in the buffer,
			// for conforming with the other functions we've written for other data.

			const materialIndices = [];

			for ( let i = 0; i < materialIndexBuffer.length; ++ i ) {

				materialIndices.push( i );

			}

			return {
				dataSize: 1,
				buffer: materialIndexBuffer,
				indices: materialIndices,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Generate a NurbGeometry from a node in FBXTree.Objects.Geometry


		parseNurbsGeometry( geoNode ) {

			if ( THREE.NURBSCurve === undefined ) {

				console.error( 'THREE.FBXLoader: The loader relies on THREE.NURBSCurve for any nurbs present in the model. Nurbs will show up as empty geometry.' );
				return new THREE.BufferGeometry();

			}

			const order = parseInt( geoNode.Order );

			if ( isNaN( order ) ) {

				console.error( 'THREE.FBXLoader: Invalid Order %s given for geometry ID: %s', geoNode.Order, geoNode.id );
				return new THREE.BufferGeometry();

			}

			const degree = order - 1;
			const knots = geoNode.KnotVector.a;
			const controlPoints = [];
			const pointsValues = geoNode.Points.a;

			for ( let i = 0, l = pointsValues.length; i < l; i += 4 ) {

				controlPoints.push( new THREE.Vector4().fromArray( pointsValues, i ) );

			}

			let startKnot, endKnot;

			if ( geoNode.Form === 'Closed' ) {

				controlPoints.push( controlPoints[ 0 ] );

			} else if ( geoNode.Form === 'Periodic' ) {

				startKnot = degree;
				endKnot = knots.length - 1 - startKnot;

				for ( let i = 0; i < degree; ++ i ) {

					controlPoints.push( controlPoints[ i ] );

				}

			}

			const curve = new THREE.NURBSCurve( degree, knots, controlPoints, startKnot, endKnot );
			const vertices = curve.getPoints( controlPoints.length * 7 );
			const positions = new Float32Array( vertices.length * 3 );
			vertices.forEach( function ( vertex, i ) {

				vertex.toArray( positions, i * 3 );

			} );
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
			return geometry;

		}

	} // parse animation data from FBXTree


	class AnimationParser {

		// take raw animation clips and turn them into three.js animation clips
		parse() {

			const animationClips = [];
			const rawClips = this.parseClips();

			if ( rawClips !== undefined ) {

				for ( const key in rawClips ) {

					const rawClip = rawClips[ key ];
					const clip = this.addClip( rawClip );
					animationClips.push( clip );

				}

			}

			return animationClips;

		}

		parseClips() {

			// since the actual transformation data is stored in FBXTree.Objects.AnimationCurve,
			// if this is undefined we can safely assume there are no animations
			if ( fbxTree.Objects.AnimationCurve === undefined ) return undefined;
			const curveNodesMap = this.parseAnimationCurveNodes();
			this.parseAnimationCurves( curveNodesMap );
			const layersMap = this.parseAnimationLayers( curveNodesMap );
			const rawClips = this.parseAnimStacks( layersMap );
			return rawClips;

		} // parse nodes in FBXTree.Objects.AnimationCurveNode
		// each AnimationCurveNode holds data for an animation transform for a model (e.g. left arm rotation )
		// and is referenced by an AnimationLayer


		parseAnimationCurveNodes() {

			const rawCurveNodes = fbxTree.Objects.AnimationCurveNode;
			const curveNodesMap = new Map();

			for ( const nodeID in rawCurveNodes ) {

				const rawCurveNode = rawCurveNodes[ nodeID ];

				if ( rawCurveNode.attrName.match( /S|R|T|DeformPercent/ ) !== null ) {

					const curveNode = {
						id: rawCurveNode.id,
						attr: rawCurveNode.attrName,
						curves: {}
					};
					curveNodesMap.set( curveNode.id, curveNode );

				}

			}

			return curveNodesMap;

		} // parse nodes in FBXTree.Objects.AnimationCurve and connect them up to
		// previously parsed AnimationCurveNodes. Each AnimationCurve holds data for a single animated
		// axis ( e.g. times and values of x rotation)


		parseAnimationCurves( curveNodesMap ) {

			const rawCurves = fbxTree.Objects.AnimationCurve; // TODO: Many values are identical up to roundoff error, but won't be optimised
			// e.g. position times: [0, 0.4, 0. 8]
			// position values: [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.235384487103147e-7, 93.67520904541016, -0.9982695579528809]
			// clearly, this should be optimised to
			// times: [0], positions [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809]
			// this shows up in nearly every FBX file, and generally time array is length > 100

			for ( const nodeID in rawCurves ) {

				const animationCurve = {
					id: rawCurves[ nodeID ].id,
					times: rawCurves[ nodeID ].KeyTime.a.map( convertFBXTimeToSeconds ),
					values: rawCurves[ nodeID ].KeyValueFloat.a
				};
				const relationships = connections.get( animationCurve.id );

				if ( relationships !== undefined ) {

					const animationCurveID = relationships.parents[ 0 ].ID;
					const animationCurveRelationship = relationships.parents[ 0 ].relationship;

					if ( animationCurveRelationship.match( /X/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'x' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /Y/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'y' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /Z/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'z' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /d|DeformPercent/ ) && curveNodesMap.has( animationCurveID ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'morph' ] = animationCurve;

					}

				}

			}

		} // parse nodes in FBXTree.Objects.AnimationLayer. Each layers holds references
		// to various AnimationCurveNodes and is referenced by an AnimationStack node
		// note: theoretically a stack can have multiple layers, however in practice there always seems to be one per stack


		parseAnimationLayers( curveNodesMap ) {

			const rawLayers = fbxTree.Objects.AnimationLayer;
			const layersMap = new Map();

			for ( const nodeID in rawLayers ) {

				const layerCurveNodes = [];
				const connection = connections.get( parseInt( nodeID ) );

				if ( connection !== undefined ) {

					// all the animationCurveNodes used in the layer
					const children = connection.children;
					children.forEach( function ( child, i ) {

						if ( curveNodesMap.has( child.ID ) ) {

							const curveNode = curveNodesMap.get( child.ID ); // check that the curves are defined for at least one axis, otherwise ignore the curveNode

							if ( curveNode.curves.x !== undefined || curveNode.curves.y !== undefined || curveNode.curves.z !== undefined ) {

								if ( layerCurveNodes[ i ] === undefined ) {

									const modelID = connections.get( child.ID ).parents.filter( function ( parent ) {

										return parent.relationship !== undefined;

									} )[ 0 ].ID;

									if ( modelID !== undefined ) {

										const rawModel = fbxTree.Objects.Model[ modelID.toString() ];

										if ( rawModel === undefined ) {

											console.warn( 'THREE.FBXLoader: Encountered a unused curve.', child );
											return;

										}

										const node = {
											modelName: rawModel.attrName ? THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ) : '',
											ID: rawModel.id,
											initialPosition: [ 0, 0, 0 ],
											initialRotation: [ 0, 0, 0 ],
											initialScale: [ 1, 1, 1 ]
										};
										sceneGraph.traverse( function ( child ) {

											if ( child.ID === rawModel.id ) {

												node.transform = child.matrix;
												if ( child.userData.transformData ) node.eulerOrder = child.userData.transformData.eulerOrder;

											}

										} );
										if ( ! node.transform ) node.transform = new THREE.Matrix4(); // if the animated model is pre rotated, we'll have to apply the pre rotations to every
										// animation value as well

										if ( 'PreRotation' in rawModel ) node.preRotation = rawModel.PreRotation.value;
										if ( 'PostRotation' in rawModel ) node.postRotation = rawModel.PostRotation.value;
										layerCurveNodes[ i ] = node;

									}

								}

								if ( layerCurveNodes[ i ] ) layerCurveNodes[ i ][ curveNode.attr ] = curveNode;

							} else if ( curveNode.curves.morph !== undefined ) {

								if ( layerCurveNodes[ i ] === undefined ) {

									const deformerID = connections.get( child.ID ).parents.filter( function ( parent ) {

										return parent.relationship !== undefined;

									} )[ 0 ].ID;
									const morpherID = connections.get( deformerID ).parents[ 0 ].ID;
									const geoID = connections.get( morpherID ).parents[ 0 ].ID; // assuming geometry is not used in more than one model

									const modelID = connections.get( geoID ).parents[ 0 ].ID;
									const rawModel = fbxTree.Objects.Model[ modelID ];
									const node = {
										modelName: rawModel.attrName ? THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ) : '',
										morphName: fbxTree.Objects.Deformer[ deformerID ].attrName
									};
									layerCurveNodes[ i ] = node;

								}

								layerCurveNodes[ i ][ curveNode.attr ] = curveNode;

							}

						}

					} );
					layersMap.set( parseInt( nodeID ), layerCurveNodes );

				}

			}

			return layersMap;

		} // parse nodes in FBXTree.Objects.AnimationStack. These are the top level node in the animation
		// hierarchy. Each Stack node will be used to create a THREE.AnimationClip


		parseAnimStacks( layersMap ) {

			const rawStacks = fbxTree.Objects.AnimationStack; // connect the stacks (clips) up to the layers

			const rawClips = {};

			for ( const nodeID in rawStacks ) {

				const children = connections.get( parseInt( nodeID ) ).children;

				if ( children.length > 1 ) {

					// it seems like stacks will always be associated with a single layer. But just in case there are files
					// where there are multiple layers per stack, we'll display a warning
					console.warn( 'THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.' );

				}

				const layer = layersMap.get( children[ 0 ].ID );
				rawClips[ nodeID ] = {
					name: rawStacks[ nodeID ].attrName,
					layer: layer
				};

			}

			return rawClips;

		}

		addClip( rawClip ) {

			let tracks = [];
			const scope = this;
			rawClip.layer.forEach( function ( rawTracks ) {

				tracks = tracks.concat( scope.generateTracks( rawTracks ) );

			} );
			return new THREE.AnimationClip( rawClip.name, - 1, tracks );

		}

		generateTracks( rawTracks ) {

			const tracks = [];
			let initialPosition = new THREE.Vector3();
			let initialRotation = new THREE.Quaternion();
			let initialScale = new THREE.Vector3();
			if ( rawTracks.transform ) rawTracks.transform.decompose( initialPosition, initialRotation, initialScale );
			initialPosition = initialPosition.toArray();
			initialRotation = new THREE.Euler().setFromQuaternion( initialRotation, rawTracks.eulerOrder ).toArray();
			initialScale = initialScale.toArray();

			if ( rawTracks.T !== undefined && Object.keys( rawTracks.T.curves ).length > 0 ) {

				const positionTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.T.curves, initialPosition, 'position' );
				if ( positionTrack !== undefined ) tracks.push( positionTrack );

			}

			if ( rawTracks.R !== undefined && Object.keys( rawTracks.R.curves ).length > 0 ) {

				const rotationTrack = this.generateRotationTrack( rawTracks.modelName, rawTracks.R.curves, initialRotation, rawTracks.preRotation, rawTracks.postRotation, rawTracks.eulerOrder );
				if ( rotationTrack !== undefined ) tracks.push( rotationTrack );

			}

			if ( rawTracks.S !== undefined && Object.keys( rawTracks.S.curves ).length > 0 ) {

				const scaleTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.S.curves, initialScale, 'scale' );
				if ( scaleTrack !== undefined ) tracks.push( scaleTrack );

			}

			if ( rawTracks.DeformPercent !== undefined ) {

				const morphTrack = this.generateMorphTrack( rawTracks );
				if ( morphTrack !== undefined ) tracks.push( morphTrack );

			}

			return tracks;

		}

		generateVectorTrack( modelName, curves, initialValue, type ) {

			const times = this.getTimesForAllAxes( curves );
			const values = this.getKeyframeTrackValues( times, curves, initialValue );
			return new THREE.VectorKeyframeTrack( modelName + '.' + type, times, values );

		}

		generateRotationTrack( modelName, curves, initialValue, preRotation, postRotation, eulerOrder ) {

			if ( curves.x !== undefined ) {

				this.interpolateRotations( curves.x );
				curves.x.values = curves.x.values.map( THREE.MathUtils.degToRad );

			}

			if ( curves.y !== undefined ) {

				this.interpolateRotations( curves.y );
				curves.y.values = curves.y.values.map( THREE.MathUtils.degToRad );

			}

			if ( curves.z !== undefined ) {

				this.interpolateRotations( curves.z );
				curves.z.values = curves.z.values.map( THREE.MathUtils.degToRad );

			}

			const times = this.getTimesForAllAxes( curves );
			const values = this.getKeyframeTrackValues( times, curves, initialValue );

			if ( preRotation !== undefined ) {

				preRotation = preRotation.map( THREE.MathUtils.degToRad );
				preRotation.push( eulerOrder );
				preRotation = new THREE.Euler().fromArray( preRotation );
				preRotation = new THREE.Quaternion().setFromEuler( preRotation );

			}

			if ( postRotation !== undefined ) {

				postRotation = postRotation.map( THREE.MathUtils.degToRad );
				postRotation.push( eulerOrder );
				postRotation = new THREE.Euler().fromArray( postRotation );
				postRotation = new THREE.Quaternion().setFromEuler( postRotation ).invert();

			}

			const quaternion = new THREE.Quaternion();
			const euler = new THREE.Euler();
			const quaternionValues = [];

			for ( let i = 0; i < values.length; i += 3 ) {

				euler.set( values[ i ], values[ i + 1 ], values[ i + 2 ], eulerOrder );
				quaternion.setFromEuler( euler );
				if ( preRotation !== undefined ) quaternion.premultiply( preRotation );
				if ( postRotation !== undefined ) quaternion.multiply( postRotation );
				quaternion.toArray( quaternionValues, i / 3 * 4 );

			}

			return new THREE.QuaternionKeyframeTrack( modelName + '.quaternion', times, quaternionValues );

		}

		generateMorphTrack( rawTracks ) {

			const curves = rawTracks.DeformPercent.curves.morph;
			const values = curves.values.map( function ( val ) {

				return val / 100;

			} );
			const morphNum = sceneGraph.getObjectByName( rawTracks.modelName ).morphTargetDictionary[ rawTracks.morphName ];
			return new THREE.NumberKeyframeTrack( rawTracks.modelName + '.morphTargetInfluences[' + morphNum + ']', curves.times, values );

		} // For all animated objects, times are defined separately for each axis
		// Here we'll combine the times into one sorted array without duplicates


		getTimesForAllAxes( curves ) {

			let times = []; // first join together the times for each axis, if defined

			if ( curves.x !== undefined ) times = times.concat( curves.x.times );
			if ( curves.y !== undefined ) times = times.concat( curves.y.times );
			if ( curves.z !== undefined ) times = times.concat( curves.z.times ); // then sort them

			times = times.sort( function ( a, b ) {

				return a - b;

			} ); // and remove duplicates

			if ( times.length > 1 ) {

				let targetIndex = 1;
				let lastValue = times[ 0 ];

				for ( let i = 1; i < times.length; i ++ ) {

					const currentValue = times[ i ];

					if ( currentValue !== lastValue ) {

						times[ targetIndex ] = currentValue;
						lastValue = currentValue;
						targetIndex ++;

					}

				}

				times = times.slice( 0, targetIndex );

			}

			return times;

		}

		getKeyframeTrackValues( times, curves, initialValue ) {

			const prevValue = initialValue;
			const values = [];
			let xIndex = - 1;
			let yIndex = - 1;
			let zIndex = - 1;
			times.forEach( function ( time ) {

				if ( curves.x ) xIndex = curves.x.times.indexOf( time );
				if ( curves.y ) yIndex = curves.y.times.indexOf( time );
				if ( curves.z ) zIndex = curves.z.times.indexOf( time ); // if there is an x value defined for this frame, use that

				if ( xIndex !== - 1 ) {

					const xValue = curves.x.values[ xIndex ];
					values.push( xValue );
					prevValue[ 0 ] = xValue;

				} else {

					// otherwise use the x value from the previous frame
					values.push( prevValue[ 0 ] );

				}

				if ( yIndex !== - 1 ) {

					const yValue = curves.y.values[ yIndex ];
					values.push( yValue );
					prevValue[ 1 ] = yValue;

				} else {

					values.push( prevValue[ 1 ] );

				}

				if ( zIndex !== - 1 ) {

					const zValue = curves.z.values[ zIndex ];
					values.push( zValue );
					prevValue[ 2 ] = zValue;

				} else {

					values.push( prevValue[ 2 ] );

				}

			} );
			return values;

		} // Rotations are defined as THREE.Euler angles which can have values  of any size
		// These will be converted to quaternions which don't support values greater than
		// PI, so we'll interpolate large rotations


		interpolateRotations( curve ) {

			for ( let i = 1; i < curve.values.length; i ++ ) {

				const initialValue = curve.values[ i - 1 ];
				const valuesSpan = curve.values[ i ] - initialValue;
				const absoluteSpan = Math.abs( valuesSpan );

				if ( absoluteSpan >= 180 ) {

					const numSubIntervals = absoluteSpan / 180;
					const step = valuesSpan / numSubIntervals;
					let nextValue = initialValue + step;
					const initialTime = curve.times[ i - 1 ];
					const timeSpan = curve.times[ i ] - initialTime;
					const interval = timeSpan / numSubIntervals;
					let nextTime = initialTime + interval;
					const interpolatedTimes = [];
					const interpolatedValues = [];

					while ( nextTime < curve.times[ i ] ) {

						interpolatedTimes.push( nextTime );
						nextTime += interval;
						interpolatedValues.push( nextValue );
						nextValue += step;

					}

					curve.times = inject( curve.times, i, interpolatedTimes );
					curve.values = inject( curve.values, i, interpolatedValues );

				}

			}

		}

	} // parse an FBX file in ASCII format


	class TextParser {

		getPrevNode() {

			return this.nodeStack[ this.currentIndent - 2 ];

		}

		getCurrentNode() {

			return this.nodeStack[ this.currentIndent - 1 ];

		}

		getCurrentProp() {

			return this.currentProp;

		}

		pushStack( node ) {

			this.nodeStack.push( node );
			this.currentIndent += 1;

		}

		popStack() {

			this.nodeStack.pop();
			this.currentIndent -= 1;

		}

		setCurrentProp( val, name ) {

			this.currentProp = val;
			this.currentPropName = name;

		}

		parse( text ) {

			this.currentIndent = 0;
			this.allNodes = new FBXTree();
			this.nodeStack = [];
			this.currentProp = [];
			this.currentPropName = '';
			const scope = this;
			const split = text.split( /[\r\n]+/ );
			split.forEach( function ( line, i ) {

				const matchComment = line.match( /^[\s\t]*;/ );
				const matchEmpty = line.match( /^[\s\t]*$/ );
				if ( matchComment || matchEmpty ) return;
				const matchBeginning = line.match( '^\\t{' + scope.currentIndent + '}(\\w+):(.*){', '' );
				const matchProperty = line.match( '^\\t{' + scope.currentIndent + '}(\\w+):[\\s\\t\\r\\n](.*)' );
				const matchEnd = line.match( '^\\t{' + ( scope.currentIndent - 1 ) + '}}' );

				if ( matchBeginning ) {

					scope.parseNodeBegin( line, matchBeginning );

				} else if ( matchProperty ) {

					scope.parseNodeProperty( line, matchProperty, split[ ++ i ] );

				} else if ( matchEnd ) {

					scope.popStack();

				} else if ( line.match( /^[^\s\t}]/ ) ) {

					// large arrays are split over multiple lines terminated with a ',' character
					// if this is encountered the line needs to be joined to the previous line
					scope.parseNodePropertyContinued( line );

				}

			} );
			return this.allNodes;

		}

		parseNodeBegin( line, property ) {

			const nodeName = property[ 1 ].trim().replace( /^"/, '' ).replace( /"$/, '' );
			const nodeAttrs = property[ 2 ].split( ',' ).map( function ( attr ) {

				return attr.trim().replace( /^"/, '' ).replace( /"$/, '' );

			} );
			const node = {
				name: nodeName
			};
			const attrs = this.parseNodeAttr( nodeAttrs );
			const currentNode = this.getCurrentNode(); // a top node

			if ( this.currentIndent === 0 ) {

				this.allNodes.add( nodeName, node );

			} else {

				// a subnode
				// if the subnode already exists, append it
				if ( nodeName in currentNode ) {

					// special case Pose needs PoseNodes as an array
					if ( nodeName === 'PoseNode' ) {

						currentNode.PoseNode.push( node );

					} else if ( currentNode[ nodeName ].id !== undefined ) {

						currentNode[ nodeName ] = {};
						currentNode[ nodeName ][ currentNode[ nodeName ].id ] = currentNode[ nodeName ];

					}

					if ( attrs.id !== '' ) currentNode[ nodeName ][ attrs.id ] = node;

				} else if ( typeof attrs.id === 'number' ) {

					currentNode[ nodeName ] = {};
					currentNode[ nodeName ][ attrs.id ] = node;

				} else if ( nodeName !== 'Properties70' ) {

					if ( nodeName === 'PoseNode' ) currentNode[ nodeName ] = [ node ]; else currentNode[ nodeName ] = node;

				}

			}

			if ( typeof attrs.id === 'number' ) node.id = attrs.id;
			if ( attrs.name !== '' ) node.attrName = attrs.name;
			if ( attrs.type !== '' ) node.attrType = attrs.type;
			this.pushStack( node );

		}

		parseNodeAttr( attrs ) {

			let id = attrs[ 0 ];

			if ( attrs[ 0 ] !== '' ) {

				id = parseInt( attrs[ 0 ] );

				if ( isNaN( id ) ) {

					id = attrs[ 0 ];

				}

			}

			let name = '',
				type = '';

			if ( attrs.length > 1 ) {

				name = attrs[ 1 ].replace( /^(\w+)::/, '' );
				type = attrs[ 2 ];

			}

			return {
				id: id,
				name: name,
				type: type
			};

		}

		parseNodeProperty( line, property, contentLine ) {

			let propName = property[ 1 ].replace( /^"/, '' ).replace( /"$/, '' ).trim();
			let propValue = property[ 2 ].replace( /^"/, '' ).replace( /"$/, '' ).trim(); // for special case: base64 image data follows "Content: ," line
			//	Content: ,
			//	 "/9j/4RDaRXhpZgAATU0A..."

			if ( propName === 'Content' && propValue === ',' ) {

				propValue = contentLine.replace( /"/g, '' ).replace( /,$/, '' ).trim();

			}

			const currentNode = this.getCurrentNode();
			const parentName = currentNode.name;

			if ( parentName === 'Properties70' ) {

				this.parseNodeSpecialProperty( line, propName, propValue );
				return;

			} // Connections


			if ( propName === 'C' ) {

				const connProps = propValue.split( ',' ).slice( 1 );
				const from = parseInt( connProps[ 0 ] );
				const to = parseInt( connProps[ 1 ] );
				let rest = propValue.split( ',' ).slice( 3 );
				rest = rest.map( function ( elem ) {

					return elem.trim().replace( /^"/, '' );

				} );
				propName = 'connections';
				propValue = [ from, to ];
				append( propValue, rest );

				if ( currentNode[ propName ] === undefined ) {

					currentNode[ propName ] = [];

				}

			} // Node


			if ( propName === 'Node' ) currentNode.id = propValue; // connections

			if ( propName in currentNode && Array.isArray( currentNode[ propName ] ) ) {

				currentNode[ propName ].push( propValue );

			} else {

				if ( propName !== 'a' ) currentNode[ propName ] = propValue; else currentNode.a = propValue;

			}

			this.setCurrentProp( currentNode, propName ); // convert string to array, unless it ends in ',' in which case more will be added to it

			if ( propName === 'a' && propValue.slice( - 1 ) !== ',' ) {

				currentNode.a = parseNumberArray( propValue );

			}

		}

		parseNodePropertyContinued( line ) {

			const currentNode = this.getCurrentNode();
			currentNode.a += line; // if the line doesn't end in ',' we have reached the end of the property value
			// so convert the string to an array

			if ( line.slice( - 1 ) !== ',' ) {

				currentNode.a = parseNumberArray( currentNode.a );

			}

		} // parse "Property70"


		parseNodeSpecialProperty( line, propName, propValue ) {

			// split this
			// P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
			// into array like below
			// ["Lcl Scaling", "Lcl Scaling", "", "A", "1,1,1" ]
			const props = propValue.split( '",' ).map( function ( prop ) {

				return prop.trim().replace( /^\"/, '' ).replace( /\s/, '_' );

			} );
			const innerPropName = props[ 0 ];
			const innerPropType1 = props[ 1 ];
			const innerPropType2 = props[ 2 ];
			const innerPropFlag = props[ 3 ];
			let innerPropValue = props[ 4 ]; // cast values where needed, otherwise leave as strings

			switch ( innerPropType1 ) {

				case 'int':
				case 'enum':
				case 'bool':
				case 'ULongLong':
				case 'double':
				case 'Number':
				case 'FieldOfView':
					innerPropValue = parseFloat( innerPropValue );
					break;

				case 'Color':
				case 'ColorRGB':
				case 'Vector3D':
				case 'Lcl_Translation':
				case 'Lcl_Rotation':
				case 'Lcl_Scaling':
					innerPropValue = parseNumberArray( innerPropValue );
					break;

			} // CAUTION: these props must append to parent's parent


			this.getPrevNode()[ innerPropName ] = {
				'type': innerPropType1,
				'type2': innerPropType2,
				'flag': innerPropFlag,
				'value': innerPropValue
			};
			this.setCurrentProp( this.getPrevNode(), innerPropName );

		}

	} // Parse an FBX file in Binary format


	class BinaryParser {

		parse( buffer ) {

			const reader = new BinaryReader( buffer );
			reader.skip( 23 ); // skip magic 23 bytes

			const version = reader.getUint32();

			if ( version < 6400 ) {

				throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + version );

			}

			const allNodes = new FBXTree();

			while ( ! this.endOfContent( reader ) ) {

				const node = this.parseNode( reader, version );
				if ( node !== null ) allNodes.add( node.name, node );

			}

			return allNodes;

		} // Check if reader has reached the end of content.


		endOfContent( reader ) {

			// footer size: 160bytes + 16-byte alignment padding
			// - 16bytes: magic
			// - padding til 16-byte alignment (at least 1byte?)
			//	(seems like some exporters embed fixed 15 or 16bytes?)
			// - 4bytes: magic
			// - 4bytes: version
			// - 120bytes: zero
			// - 16bytes: magic
			if ( reader.size() % 16 === 0 ) {

				return ( reader.getOffset() + 160 + 16 & ~ 0xf ) >= reader.size();

			} else {

				return reader.getOffset() + 160 + 16 >= reader.size();

			}

		} // recursively parse nodes until the end of the file is reached


		parseNode( reader, version ) {

			const node = {}; // The first three data sizes depends on version.

			const endOffset = version >= 7500 ? reader.getUint64() : reader.getUint32();
			const numProperties = version >= 7500 ? reader.getUint64() : reader.getUint32();
			version >= 7500 ? reader.getUint64() : reader.getUint32(); // the returned propertyListLen is not used

			const nameLen = reader.getUint8();
			const name = reader.getString( nameLen ); // Regards this node as NULL-record if endOffset is zero

			if ( endOffset === 0 ) return null;
			const propertyList = [];

			for ( let i = 0; i < numProperties; i ++ ) {

				propertyList.push( this.parseProperty( reader ) );

			} // Regards the first three elements in propertyList as id, attrName, and attrType


			const id = propertyList.length > 0 ? propertyList[ 0 ] : '';
			const attrName = propertyList.length > 1 ? propertyList[ 1 ] : '';
			const attrType = propertyList.length > 2 ? propertyList[ 2 ] : ''; // check if this node represents just a single property
			// like (name, 0) set or (name2, [0, 1, 2]) set of {name: 0, name2: [0, 1, 2]}

			node.singleProperty = numProperties === 1 && reader.getOffset() === endOffset ? true : false;

			while ( endOffset > reader.getOffset() ) {

				const subNode = this.parseNode( reader, version );
				if ( subNode !== null ) this.parseSubNode( name, node, subNode );

			}

			node.propertyList = propertyList; // raw property list used by parent

			if ( typeof id === 'number' ) node.id = id;
			if ( attrName !== '' ) node.attrName = attrName;
			if ( attrType !== '' ) node.attrType = attrType;
			if ( name !== '' ) node.name = name;
			return node;

		}

		parseSubNode( name, node, subNode ) {

			// special case: child node is single property
			if ( subNode.singleProperty === true ) {

				const value = subNode.propertyList[ 0 ];

				if ( Array.isArray( value ) ) {

					node[ subNode.name ] = subNode;
					subNode.a = value;

				} else {

					node[ subNode.name ] = value;

				}

			} else if ( name === 'Connections' && subNode.name === 'C' ) {

				const array = [];
				subNode.propertyList.forEach( function ( property, i ) {

					// first Connection is FBX type (OO, OP, etc.). We'll discard these
					if ( i !== 0 ) array.push( property );

				} );

				if ( node.connections === undefined ) {

					node.connections = [];

				}

				node.connections.push( array );

			} else if ( subNode.name === 'Properties70' ) {

				const keys = Object.keys( subNode );
				keys.forEach( function ( key ) {

					node[ key ] = subNode[ key ];

				} );

			} else if ( name === 'Properties70' && subNode.name === 'P' ) {

				let innerPropName = subNode.propertyList[ 0 ];
				let innerPropType1 = subNode.propertyList[ 1 ];
				const innerPropType2 = subNode.propertyList[ 2 ];
				const innerPropFlag = subNode.propertyList[ 3 ];
				let innerPropValue;
				if ( innerPropName.indexOf( 'Lcl ' ) === 0 ) innerPropName = innerPropName.replace( 'Lcl ', 'Lcl_' );
				if ( innerPropType1.indexOf( 'Lcl ' ) === 0 ) innerPropType1 = innerPropType1.replace( 'Lcl ', 'Lcl_' );

				if ( innerPropType1 === 'Color' || innerPropType1 === 'ColorRGB' || innerPropType1 === 'Vector' || innerPropType1 === 'Vector3D' || innerPropType1.indexOf( 'Lcl_' ) === 0 ) {

					innerPropValue = [ subNode.propertyList[ 4 ], subNode.propertyList[ 5 ], subNode.propertyList[ 6 ] ];

				} else {

					innerPropValue = subNode.propertyList[ 4 ];

				} // this will be copied to parent, see above


				node[ innerPropName ] = {
					'type': innerPropType1,
					'type2': innerPropType2,
					'flag': innerPropFlag,
					'value': innerPropValue
				};

			} else if ( node[ subNode.name ] === undefined ) {

				if ( typeof subNode.id === 'number' ) {

					node[ subNode.name ] = {};
					node[ subNode.name ][ subNode.id ] = subNode;

				} else {

					node[ subNode.name ] = subNode;

				}

			} else {

				if ( subNode.name === 'PoseNode' ) {

					if ( ! Array.isArray( node[ subNode.name ] ) ) {

						node[ subNode.name ] = [ node[ subNode.name ] ];

					}

					node[ subNode.name ].push( subNode );

				} else if ( node[ subNode.name ][ subNode.id ] === undefined ) {

					node[ subNode.name ][ subNode.id ] = subNode;

				}

			}

		}

		parseProperty( reader ) {

			const type = reader.getString( 1 );
			let length;

			switch ( type ) {

				case 'C':
					return reader.getBoolean();

				case 'D':
					return reader.getFloat64();

				case 'F':
					return reader.getFloat32();

				case 'I':
					return reader.getInt32();

				case 'L':
					return reader.getInt64();

				case 'R':
					length = reader.getUint32();
					return reader.getArrayBuffer( length );

				case 'S':
					length = reader.getUint32();
					return reader.getString( length );

				case 'Y':
					return reader.getInt16();

				case 'b':
				case 'c':
				case 'd':
				case 'f':
				case 'i':
				case 'l':
					const arrayLength = reader.getUint32();
					const encoding = reader.getUint32(); // 0: non-compressed, 1: compressed

					const compressedLength = reader.getUint32();

					if ( encoding === 0 ) {

						switch ( type ) {

							case 'b':
							case 'c':
								return reader.getBooleanArray( arrayLength );

							case 'd':
								return reader.getFloat64Array( arrayLength );

							case 'f':
								return reader.getFloat32Array( arrayLength );

							case 'i':
								return reader.getInt32Array( arrayLength );

							case 'l':
								return reader.getInt64Array( arrayLength );

						}

					}

					if ( typeof fflate === 'undefined' ) {

						console.error( 'THREE.FBXLoader: External library fflate.min.js required.' );

					}

					const data = fflate.unzlibSync( new Uint8Array( reader.getArrayBuffer( compressedLength ) ) ); // eslint-disable-line no-undef

					const reader2 = new BinaryReader( data.buffer );

					switch ( type ) {

						case 'b':
						case 'c':
							return reader2.getBooleanArray( arrayLength );

						case 'd':
							return reader2.getFloat64Array( arrayLength );

						case 'f':
							return reader2.getFloat32Array( arrayLength );

						case 'i':
							return reader2.getInt32Array( arrayLength );

						case 'l':
							return reader2.getInt64Array( arrayLength );

					}

				default:
					throw new Error( 'THREE.FBXLoader: Unknown property type ' + type );

			}

		}

	}

	class BinaryReader {

		constructor( buffer, littleEndian ) {

			this.dv = new DataView( buffer );
			this.offset = 0;
			this.littleEndian = littleEndian !== undefined ? littleEndian : true;

		}

		getOffset() {

			return this.offset;

		}

		size() {

			return this.dv.buffer.byteLength;

		}

		skip( length ) {

			this.offset += length;

		} // seems like true/false representation depends on exporter.
		// true: 1 or 'Y'(=0x59), false: 0 or 'T'(=0x54)
		// then sees LSB.


		getBoolean() {

			return ( this.getUint8() & 1 ) === 1;

		}

		getBooleanArray( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getBoolean() );

			}

			return a;

		}

		getUint8() {

			const value = this.dv.getUint8( this.offset );
			this.offset += 1;
			return value;

		}

		getInt16() {

			const value = this.dv.getInt16( this.offset, this.littleEndian );
			this.offset += 2;
			return value;

		}

		getInt32() {

			const value = this.dv.getInt32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		}

		getInt32Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getInt32() );

			}

			return a;

		}

		getUint32() {

			const value = this.dv.getUint32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		} // JavaScript doesn't support 64-bit integer so calculate this here
		// 1 << 32 will return 1 so using multiply operation instead here.
		// There's a possibility that this method returns wrong value if the value
		// is out of the range between Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER.
		// TODO: safely handle 64-bit integer


		getInt64() {

			let low, high;

			if ( this.littleEndian ) {

				low = this.getUint32();
				high = this.getUint32();

			} else {

				high = this.getUint32();
				low = this.getUint32();

			} // calculate negative value


			if ( high & 0x80000000 ) {

				high = ~ high & 0xFFFFFFFF;
				low = ~ low & 0xFFFFFFFF;
				if ( low === 0xFFFFFFFF ) high = high + 1 & 0xFFFFFFFF;
				low = low + 1 & 0xFFFFFFFF;
				return - ( high * 0x100000000 + low );

			}

			return high * 0x100000000 + low;

		}

		getInt64Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getInt64() );

			}

			return a;

		} // Note: see getInt64() comment


		getUint64() {

			let low, high;

			if ( this.littleEndian ) {

				low = this.getUint32();
				high = this.getUint32();

			} else {

				high = this.getUint32();
				low = this.getUint32();

			}

			return high * 0x100000000 + low;

		}

		getFloat32() {

			const value = this.dv.getFloat32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		}

		getFloat32Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getFloat32() );

			}

			return a;

		}

		getFloat64() {

			const value = this.dv.getFloat64( this.offset, this.littleEndian );
			this.offset += 8;
			return value;

		}

		getFloat64Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getFloat64() );

			}

			return a;

		}

		getArrayBuffer( size ) {

			const value = this.dv.buffer.slice( this.offset, this.offset + size );
			this.offset += size;
			return value;

		}

		getString( size ) {

			// note: safari 9 doesn't support Uint8Array.indexOf; create intermediate array instead
			let a = [];

			for ( let i = 0; i < size; i ++ ) {

				a[ i ] = this.getUint8();

			}

			const nullByte = a.indexOf( 0 );
			if ( nullByte >= 0 ) a = a.slice( 0, nullByte );
			return THREE.LoaderUtils.decodeText( new Uint8Array( a ) );

		}

	} // FBXTree holds a representation of the FBX data, returned by the TextParser ( FBX ASCII format)
	// and BinaryParser( FBX Binary format)


	class FBXTree {

		add( key, val ) {

			this[ key ] = val;

		}

	} // ************** UTILITY FUNCTIONS **************


	function isFbxFormatBinary( buffer ) {

		const CORRECT = 'Kaydara\u0020FBX\u0020Binary\u0020\u0020\0';
		return buffer.byteLength >= CORRECT.length && CORRECT === convertArrayBufferToString( buffer, 0, CORRECT.length );

	}

	function isFbxFormatASCII( text ) {

		const CORRECT = [ 'K', 'a', 'y', 'd', 'a', 'r', 'a', '\\', 'F', 'B', 'X', '\\', 'B', 'i', 'n', 'a', 'r', 'y', '\\', '\\' ];
		let cursor = 0;

		function read( offset ) {

			const result = text[ offset - 1 ];
			text = text.slice( cursor + offset );
			cursor ++;
			return result;

		}

		for ( let i = 0; i < CORRECT.length; ++ i ) {

			const num = read( 1 );

			if ( num === CORRECT[ i ] ) {

				return false;

			}

		}

		return true;

	}

	function getFbxVersion( text ) {

		const versionRegExp = /FBXVersion: (\d+)/;
		const match = text.match( versionRegExp );

		if ( match ) {

			const version = parseInt( match[ 1 ] );
			return version;

		}

		throw new Error( 'THREE.FBXLoader: Cannot find the version number for the file given.' );

	} // Converts FBX ticks into real time seconds.


	function convertFBXTimeToSeconds( time ) {

		return time / 46186158000;

	}

	const dataArray = []; // extracts the data from the correct position in the FBX array based on indexing type

	function getData( polygonVertexIndex, polygonIndex, vertexIndex, infoObject ) {

		let index;

		switch ( infoObject.mappingType ) {

			case 'ByPolygonVertex':
				index = polygonVertexIndex;
				break;

			case 'ByPolygon':
				index = polygonIndex;
				break;

			case 'ByVertice':
				index = vertexIndex;
				break;

			case 'AllSame':
				index = infoObject.indices[ 0 ];
				break;

			default:
				console.warn( 'THREE.FBXLoader: unknown attribute mapping type ' + infoObject.mappingType );

		}

		if ( infoObject.referenceType === 'IndexToDirect' ) index = infoObject.indices[ index ];
		const from = index * infoObject.dataSize;
		const to = from + infoObject.dataSize;
		return slice( dataArray, infoObject.buffer, from, to );

	}

	const tempEuler = new THREE.Euler();
	const tempVec = new THREE.Vector3(); // generate transformation from FBX transform data
	// ref: https://help.autodesk.com/view/FBX/2017/ENU/?guid=__files_GUID_10CDD63C_79C1_4F2D_BB28_AD2BE65A02ED_htm
	// ref: http://docs.autodesk.com/FBX/2014/ENU/FBX-SDK-Documentation/index.html?url=cpp_ref/_transformations_2main_8cxx-example.html,topicNumber=cpp_ref__transformations_2main_8cxx_example_htmlfc10a1e1-b18d-4e72-9dc0-70d0f1959f5e

	function generateTransform( transformData ) {

		const lTranslationM = new THREE.Matrix4();
		const lPreRotationM = new THREE.Matrix4();
		const lRotationM = new THREE.Matrix4();
		const lPostRotationM = new THREE.Matrix4();
		const lScalingM = new THREE.Matrix4();
		const lScalingPivotM = new THREE.Matrix4();
		const lScalingOffsetM = new THREE.Matrix4();
		const lRotationOffsetM = new THREE.Matrix4();
		const lRotationPivotM = new THREE.Matrix4();
		const lParentGX = new THREE.Matrix4();
		const lParentLX = new THREE.Matrix4();
		const lGlobalT = new THREE.Matrix4();
		const inheritType = transformData.inheritType ? transformData.inheritType : 0;
		if ( transformData.translation ) lTranslationM.setPosition( tempVec.fromArray( transformData.translation ) );

		if ( transformData.preRotation ) {

			const array = transformData.preRotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lPreRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

		}

		if ( transformData.rotation ) {

			const array = transformData.rotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

		}

		if ( transformData.postRotation ) {

			const array = transformData.postRotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lPostRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );
			lPostRotationM.invert();

		}

		if ( transformData.scale ) lScalingM.scale( tempVec.fromArray( transformData.scale ) ); // Pivots and offsets

		if ( transformData.scalingOffset ) lScalingOffsetM.setPosition( tempVec.fromArray( transformData.scalingOffset ) );
		if ( transformData.scalingPivot ) lScalingPivotM.setPosition( tempVec.fromArray( transformData.scalingPivot ) );
		if ( transformData.rotationOffset ) lRotationOffsetM.setPosition( tempVec.fromArray( transformData.rotationOffset ) );
		if ( transformData.rotationPivot ) lRotationPivotM.setPosition( tempVec.fromArray( transformData.rotationPivot ) ); // parent transform

		if ( transformData.parentMatrixWorld ) {

			lParentLX.copy( transformData.parentMatrix );
			lParentGX.copy( transformData.parentMatrixWorld );

		}

		const lLRM = new THREE.Matrix4().copy( lPreRotationM ).multiply( lRotationM ).multiply( lPostRotationM ); // Global Rotation

		const lParentGRM = new THREE.Matrix4();
		lParentGRM.extractRotation( lParentGX ); // Global Shear*Scaling

		const lParentTM = new THREE.Matrix4();
		lParentTM.copyPosition( lParentGX );
		const lParentGSM = new THREE.Matrix4();
		const lParentGRSM = new THREE.Matrix4().copy( lParentTM ).invert().multiply( lParentGX );
		lParentGSM.copy( lParentGRM ).invert().multiply( lParentGRSM );
		const lLSM = lScalingM;
		const lGlobalRS = new THREE.Matrix4();

		if ( inheritType === 0 ) {

			lGlobalRS.copy( lParentGRM ).multiply( lLRM ).multiply( lParentGSM ).multiply( lLSM );

		} else if ( inheritType === 1 ) {

			lGlobalRS.copy( lParentGRM ).multiply( lParentGSM ).multiply( lLRM ).multiply( lLSM );

		} else {

			const lParentLSM = new THREE.Matrix4().scale( new THREE.Vector3().setFromMatrixScale( lParentLX ) );
			const lParentLSM_inv = new THREE.Matrix4().copy( lParentLSM ).invert();
			const lParentGSM_noLocal = new THREE.Matrix4().copy( lParentGSM ).multiply( lParentLSM_inv );
			lGlobalRS.copy( lParentGRM ).multiply( lLRM ).multiply( lParentGSM_noLocal ).multiply( lLSM );

		}

		const lRotationPivotM_inv = new THREE.Matrix4();
		lRotationPivotM_inv.copy( lRotationPivotM ).invert();
		const lScalingPivotM_inv = new THREE.Matrix4();
		lScalingPivotM_inv.copy( lScalingPivotM ).invert(); // Calculate the local transform matrix

		let lTransform = new THREE.Matrix4();
		lTransform.copy( lTranslationM ).multiply( lRotationOffsetM ).multiply( lRotationPivotM ).multiply( lPreRotationM ).multiply( lRotationM ).multiply( lPostRotationM ).multiply( lRotationPivotM_inv ).multiply( lScalingOffsetM ).multiply( lScalingPivotM ).multiply( lScalingM ).multiply( lScalingPivotM_inv );
		const lLocalTWithAllPivotAndOffsetInfo = new THREE.Matrix4().copyPosition( lTransform );
		const lGlobalTranslation = new THREE.Matrix4().copy( lParentGX ).multiply( lLocalTWithAllPivotAndOffsetInfo );
		lGlobalT.copyPosition( lGlobalTranslation );
		lTransform = new THREE.Matrix4().copy( lGlobalT ).multiply( lGlobalRS ); // from global to local

		lTransform.premultiply( lParentGX.invert() );
		return lTransform;

	} // Returns the three.js intrinsic THREE.Euler order corresponding to FBX extrinsic THREE.Euler order
	// ref: http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_class_fbx_euler_html


	function getEulerOrder( order ) {

		order = order || 0;
		const enums = [ 'ZYX', // -> XYZ extrinsic
			'YZX', // -> XZY extrinsic
			'XZY', // -> YZX extrinsic
			'ZXY', // -> YXZ extrinsic
			'YXZ', // -> ZXY extrinsic
			'XYZ' // -> ZYX extrinsic
			//'SphericXYZ', // not possible to support
		];

		if ( order === 6 ) {

			console.warn( 'THREE.FBXLoader: unsupported THREE.Euler Order: Spherical XYZ. Animations and rotations may be incorrect.' );
			return enums[ 0 ];

		}

		return enums[ order ];

	} // Parses comma separated list of numbers and returns them an array.
	// Used internally by the TextParser


	function parseNumberArray( value ) {

		const array = value.split( ',' ).map( function ( val ) {

			return parseFloat( val );

		} );
		return array;

	}

	function convertArrayBufferToString( buffer, from, to ) {

		if ( from === undefined ) from = 0;
		if ( to === undefined ) to = buffer.byteLength;
		return THREE.LoaderUtils.decodeText( new Uint8Array( buffer, from, to ) );

	}

	function append( a, b ) {

		for ( let i = 0, j = a.length, l = b.length; i < l; i ++, j ++ ) {

			a[ j ] = b[ i ];

		}

	}

	function slice( a, b, from, to ) {

		for ( let i = from, j = 0; i < to; i ++, j ++ ) {

			a[ j ] = b[ i ];

		}

		return a;

	} // inject array a2 into array a1 at index


	function inject( a1, index, a2 ) {

		return a1.slice( 0, index ).concat( a2 ).concat( a1.slice( index ) );

	}

	THREE.FBXLoader = FBXLoader;

} )();

// ---- GLTFLoader.js
( function () {

	class GLTFLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.dracoLoader = null;
			this.ktx2Loader = null;
			this.meshoptDecoder = null;
			this.pluginCallbacks = [];
			this.register( function ( parser ) {

				return new GLTFMaterialsClearcoatExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFTextureBasisUExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFTextureWebPExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMaterialsTransmissionExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFLightsExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMeshoptCompression( parser );

			} );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			let resourcePath;

			if ( this.resourcePath !== '' ) {

				resourcePath = this.resourcePath;

			} else if ( this.path !== '' ) {

				resourcePath = this.path;

			} else {

				resourcePath = THREE.LoaderUtils.extractUrlBase( url );

			} // Tells the LoadingManager to track an extra item, which resolves after
			// the model is fully loaded. This means the count of items loaded will
			// be incorrect, but ensures manager.onLoad() does not fire early.


			this.manager.itemStart( url );

			const _onError = function ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );
				scope.manager.itemEnd( url );

			};

			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( data ) {

				try {

					scope.parse( data, resourcePath, function ( gltf ) {

						onLoad( gltf );
						scope.manager.itemEnd( url );

					}, _onError );

				} catch ( e ) {

					_onError( e );

				}

			}, onProgress, _onError );

		}

		setDRACOLoader( dracoLoader ) {

			this.dracoLoader = dracoLoader;
			return this;

		}

		setDDSLoader() {

			throw new Error( 'THREE.GLTFLoader: "MSFT_texture_dds" no longer supported. Please update to "KHR_texture_basisu".' );

		}

		setKTX2Loader( ktx2Loader ) {

			this.ktx2Loader = ktx2Loader;
			return this;

		}

		setMeshoptDecoder( meshoptDecoder ) {

			this.meshoptDecoder = meshoptDecoder;
			return this;

		}

		register( callback ) {

			if ( this.pluginCallbacks.indexOf( callback ) === - 1 ) {

				this.pluginCallbacks.push( callback );

			}

			return this;

		}

		unregister( callback ) {

			if ( this.pluginCallbacks.indexOf( callback ) !== - 1 ) {

				this.pluginCallbacks.splice( this.pluginCallbacks.indexOf( callback ), 1 );

			}

			return this;

		}

		parse( data, path, onLoad, onError ) {

			let content;
			const extensions = {};
			const plugins = {};

			if ( typeof data === 'string' ) {

				content = data;

			} else {

				const magic = THREE.LoaderUtils.decodeText( new Uint8Array( data, 0, 4 ) );

				if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {

					try {

						extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );

					} catch ( error ) {

						if ( onError ) onError( error );
						return;

					}

					content = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content;

				} else {

					content = THREE.LoaderUtils.decodeText( new Uint8Array( data ) );

				}

			}

			const json = JSON.parse( content );

			if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

				if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' ) );
				return;

			}

			const parser = new GLTFParser( json, {
				path: path || this.resourcePath || '',
				crossOrigin: this.crossOrigin,
				requestHeader: this.requestHeader,
				manager: this.manager,
				ktx2Loader: this.ktx2Loader,
				meshoptDecoder: this.meshoptDecoder
			} );
			parser.fileLoader.setRequestHeader( this.requestHeader );

			for ( let i = 0; i < this.pluginCallbacks.length; i ++ ) {

				const plugin = this.pluginCallbacks[ i ]( parser );
				plugins[ plugin.name ] = plugin; // Workaround to avoid determining as unknown extension
				// in addUnknownExtensionsToUserData().
				// Remove this workaround if we move all the existing
				// extension handlers to plugin system

				extensions[ plugin.name ] = true;

			}

			if ( json.extensionsUsed ) {

				for ( let i = 0; i < json.extensionsUsed.length; ++ i ) {

					const extensionName = json.extensionsUsed[ i ];
					const extensionsRequired = json.extensionsRequired || [];

					switch ( extensionName ) {

						case EXTENSIONS.KHR_MATERIALS_UNLIT:
							extensions[ extensionName ] = new GLTFMaterialsUnlitExtension();
							break;

						case EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS:
							extensions[ extensionName ] = new GLTFMaterialsPbrSpecularGlossinessExtension();
							break;

						case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
							extensions[ extensionName ] = new GLTFDracoMeshCompressionExtension( json, this.dracoLoader );
							break;

						case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
							extensions[ extensionName ] = new GLTFTextureTransformExtension();
							break;

						case EXTENSIONS.KHR_MESH_QUANTIZATION:
							extensions[ extensionName ] = new GLTFMeshQuantizationExtension();
							break;

						default:
							if ( extensionsRequired.indexOf( extensionName ) >= 0 && plugins[ extensionName ] === undefined ) {

								console.warn( 'THREE.GLTFLoader: Unknown extension "' + extensionName + '".' );

							}

					}

				}

			}

			parser.setExtensions( extensions );
			parser.setPlugins( plugins );
			parser.parse( onLoad, onError );

		}

	}
	/* GLTFREGISTRY */


	function GLTFRegistry() {

		let objects = {};
		return {
			get: function ( key ) {

				return objects[ key ];

			},
			add: function ( key, object ) {

				objects[ key ] = object;

			},
			remove: function ( key ) {

				delete objects[ key ];

			},
			removeAll: function () {

				objects = {};

			}
		};

	}
	/*********************************/

	/********** EXTENSIONS ***********/

	/*********************************/


	const EXTENSIONS = {
		KHR_BINARY_GLTF: 'KHR_binary_glTF',
		KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
		KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
		KHR_MATERIALS_CLEARCOAT: 'KHR_materials_clearcoat',
		KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
		KHR_MATERIALS_TRANSMISSION: 'KHR_materials_transmission',
		KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
		KHR_TEXTURE_BASISU: 'KHR_texture_basisu',
		KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
		KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization',
		EXT_TEXTURE_WEBP: 'EXT_texture_webp',
		EXT_MESHOPT_COMPRESSION: 'EXT_meshopt_compression'
	};
	/**
	 * Punctual Lights Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual
	 */

	class GLTFLightsExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL; // THREE.Object3D instance caches

			this.cache = {
				refs: {},
				uses: {}
			};

		}

		_markDefs() {

			const parser = this.parser;
			const nodeDefs = this.parser.json.nodes || [];

			for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

				const nodeDef = nodeDefs[ nodeIndex ];

				if ( nodeDef.extensions && nodeDef.extensions[ this.name ] && nodeDef.extensions[ this.name ].light !== undefined ) {

					parser._addNodeRef( this.cache, nodeDef.extensions[ this.name ].light );

				}

			}

		}

		_loadLight( lightIndex ) {

			const parser = this.parser;
			const cacheKey = 'light:' + lightIndex;
			let dependency = parser.cache.get( cacheKey );
			if ( dependency ) return dependency;
			const json = parser.json;
			const extensions = json.extensions && json.extensions[ this.name ] || {};
			const lightDefs = extensions.lights || [];
			const lightDef = lightDefs[ lightIndex ];
			let lightNode;
			const color = new THREE.Color( 0xffffff );
			if ( lightDef.color !== undefined ) color.fromArray( lightDef.color );
			const range = lightDef.range !== undefined ? lightDef.range : 0;

			switch ( lightDef.type ) {

				case 'directional':
					lightNode = new THREE.DirectionalLight( color );
					lightNode.target.position.set( 0, 0, - 1 );
					lightNode.add( lightNode.target );
					break;

				case 'point':
					lightNode = new THREE.PointLight( color );
					lightNode.distance = range;
					break;

				case 'spot':
					lightNode = new THREE.SpotLight( color );
					lightNode.distance = range; // Handle spotlight properties.

					lightDef.spot = lightDef.spot || {};
					lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== undefined ? lightDef.spot.innerConeAngle : 0;
					lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== undefined ? lightDef.spot.outerConeAngle : Math.PI / 4.0;
					lightNode.angle = lightDef.spot.outerConeAngle;
					lightNode.penumbra = 1.0 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
					lightNode.target.position.set( 0, 0, - 1 );
					lightNode.add( lightNode.target );
					break;

				default:
					throw new Error( 'THREE.GLTFLoader: Unexpected light type: ' + lightDef.type );

			} // Some lights (e.g. spot) default to a position other than the origin. Reset the position
			// here, because node-level parsing will only override position if explicitly specified.


			lightNode.position.set( 0, 0, 0 );
			lightNode.decay = 2;
			if ( lightDef.intensity !== undefined ) lightNode.intensity = lightDef.intensity;
			lightNode.name = parser.createUniqueName( lightDef.name || 'light_' + lightIndex );
			dependency = Promise.resolve( lightNode );
			parser.cache.add( cacheKey, dependency );
			return dependency;

		}

		createNodeAttachment( nodeIndex ) {

			const self = this;
			const parser = this.parser;
			const json = parser.json;
			const nodeDef = json.nodes[ nodeIndex ];
			const lightDef = nodeDef.extensions && nodeDef.extensions[ this.name ] || {};
			const lightIndex = lightDef.light;
			if ( lightIndex === undefined ) return null;
			return this._loadLight( lightIndex ).then( function ( light ) {

				return parser._getNodeRef( self.cache, lightIndex, light );

			} );

		}

	}
	/**
	 * Unlit Materials Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
	 */


	class GLTFMaterialsUnlitExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;

		}

		getMaterialType() {

			return THREE.MeshBasicMaterial;

		}

		extendParams( materialParams, materialDef, parser ) {

			const pending = [];
			materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
			materialParams.opacity = 1.0;
			const metallicRoughness = materialDef.pbrMetallicRoughness;

			if ( metallicRoughness ) {

				if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

					const array = metallicRoughness.baseColorFactor;
					materialParams.color.fromArray( array );
					materialParams.opacity = array[ 3 ];

				}

				if ( metallicRoughness.baseColorTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture ) );

				}

			}

			return Promise.all( pending );

		}

	}
	/**
	 * Clearcoat Materials Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_clearcoat
	 */


	class GLTFMaterialsClearcoatExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			const extension = materialDef.extensions[ this.name ];

			if ( extension.clearcoatFactor !== undefined ) {

				materialParams.clearcoat = extension.clearcoatFactor;

			}

			if ( extension.clearcoatTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatMap', extension.clearcoatTexture ) );

			}

			if ( extension.clearcoatRoughnessFactor !== undefined ) {

				materialParams.clearcoatRoughness = extension.clearcoatRoughnessFactor;

			}

			if ( extension.clearcoatRoughnessTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatRoughnessMap', extension.clearcoatRoughnessTexture ) );

			}

			if ( extension.clearcoatNormalTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatNormalMap', extension.clearcoatNormalTexture ) );

				if ( extension.clearcoatNormalTexture.scale !== undefined ) {

					const scale = extension.clearcoatNormalTexture.scale; // https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995

					materialParams.clearcoatNormalScale = new THREE.Vector2( scale, - scale );

				}

			}

			return Promise.all( pending );

		}

	}
	/**
	 * Transmission Materials Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
	 * Draft: https://github.com/KhronosGroup/glTF/pull/1698
	 */


	class GLTFMaterialsTransmissionExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			const extension = materialDef.extensions[ this.name ];

			if ( extension.transmissionFactor !== undefined ) {

				materialParams.transmission = extension.transmissionFactor;

			}

			if ( extension.transmissionTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'transmissionMap', extension.transmissionTexture ) );

			}

			return Promise.all( pending );

		}

	}
	/**
	 * BasisU Texture Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_basisu
	 */


	class GLTFTextureBasisUExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_TEXTURE_BASISU;

		}

		loadTexture( textureIndex ) {

			const parser = this.parser;
			const json = parser.json;
			const textureDef = json.textures[ textureIndex ];

			if ( ! textureDef.extensions || ! textureDef.extensions[ this.name ] ) {

				return null;

			}

			const extension = textureDef.extensions[ this.name ];
			const source = json.images[ extension.source ];
			const loader = parser.options.ktx2Loader;

			if ( ! loader ) {

				if ( json.extensionsRequired && json.extensionsRequired.indexOf( this.name ) >= 0 ) {

					throw new Error( 'THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures' );

				} else {

					// Assumes that the extension is optional and that a fallback texture is present
					return null;

				}

			}

			return parser.loadTextureImage( textureIndex, source, loader );

		}

	}
	/**
	 * WebP Texture Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_texture_webp
	 */


	class GLTFTextureWebPExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.EXT_TEXTURE_WEBP;
			this.isSupported = null;

		}

		loadTexture( textureIndex ) {

			const name = this.name;
			const parser = this.parser;
			const json = parser.json;
			const textureDef = json.textures[ textureIndex ];

			if ( ! textureDef.extensions || ! textureDef.extensions[ name ] ) {

				return null;

			}

			const extension = textureDef.extensions[ name ];
			const source = json.images[ extension.source ];
			let loader = parser.textureLoader;

			if ( source.uri ) {

				const handler = parser.options.manager.getHandler( source.uri );
				if ( handler !== null ) loader = handler;

			}

			return this.detectSupport().then( function ( isSupported ) {

				if ( isSupported ) return parser.loadTextureImage( textureIndex, source, loader );

				if ( json.extensionsRequired && json.extensionsRequired.indexOf( name ) >= 0 ) {

					throw new Error( 'THREE.GLTFLoader: WebP required by asset but unsupported.' );

				} // Fall back to PNG or JPEG.


				return parser.loadTexture( textureIndex );

			} );

		}

		detectSupport() {

			if ( ! this.isSupported ) {

				this.isSupported = new Promise( function ( resolve ) {

					const image = new Image(); // Lossy test image. Support for lossy images doesn't guarantee support for all
					// WebP images, unfortunately.

					image.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

					image.onload = image.onerror = function () {

						resolve( image.height === 1 );

					};

				} );

			}

			return this.isSupported;

		}

	}
	/**
	* meshopt BufferView Compression Extension
	*
	* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_meshopt_compression
	*/


	class GLTFMeshoptCompression {

		constructor( parser ) {

			this.name = EXTENSIONS.EXT_MESHOPT_COMPRESSION;
			this.parser = parser;

		}

		loadBufferView( index ) {

			const json = this.parser.json;
			const bufferView = json.bufferViews[ index ];

			if ( bufferView.extensions && bufferView.extensions[ this.name ] ) {

				const extensionDef = bufferView.extensions[ this.name ];
				const buffer = this.parser.getDependency( 'buffer', extensionDef.buffer );
				const decoder = this.parser.options.meshoptDecoder;

				if ( ! decoder || ! decoder.supported ) {

					if ( json.extensionsRequired && json.extensionsRequired.indexOf( this.name ) >= 0 ) {

						throw new Error( 'THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files' );

					} else {

						// Assumes that the extension is optional and that fallback buffer data is present
						return null;

					}

				}

				return Promise.all( [ buffer, decoder.ready ] ).then( function ( res ) {

					const byteOffset = extensionDef.byteOffset || 0;
					const byteLength = extensionDef.byteLength || 0;
					const count = extensionDef.count;
					const stride = extensionDef.byteStride;
					const result = new ArrayBuffer( count * stride );
					const source = new Uint8Array( res[ 0 ], byteOffset, byteLength );
					decoder.decodeGltfBuffer( new Uint8Array( result ), count, stride, source, extensionDef.mode, extensionDef.filter );
					return result;

				} );

			} else {

				return null;

			}

		}

	}
	/* BINARY EXTENSION */


	const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
	const BINARY_EXTENSION_HEADER_LENGTH = 12;
	const BINARY_EXTENSION_CHUNK_TYPES = {
		JSON: 0x4E4F534A,
		BIN: 0x004E4942
	};

	class GLTFBinaryExtension {

		constructor( data ) {

			this.name = EXTENSIONS.KHR_BINARY_GLTF;
			this.content = null;
			this.body = null;
			const headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );
			this.header = {
				magic: THREE.LoaderUtils.decodeText( new Uint8Array( data.slice( 0, 4 ) ) ),
				version: headerView.getUint32( 4, true ),
				length: headerView.getUint32( 8, true )
			};

			if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

				throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );

			} else if ( this.header.version < 2.0 ) {

				throw new Error( 'THREE.GLTFLoader: Legacy binary file detected.' );

			}

			const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
			const chunkView = new DataView( data, BINARY_EXTENSION_HEADER_LENGTH );
			let chunkIndex = 0;

			while ( chunkIndex < chunkContentsLength ) {

				const chunkLength = chunkView.getUint32( chunkIndex, true );
				chunkIndex += 4;
				const chunkType = chunkView.getUint32( chunkIndex, true );
				chunkIndex += 4;

				if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {

					const contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
					this.content = THREE.LoaderUtils.decodeText( contentArray );

				} else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {

					const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
					this.body = data.slice( byteOffset, byteOffset + chunkLength );

				} // Clients must ignore chunks with unknown types.


				chunkIndex += chunkLength;

			}

			if ( this.content === null ) {

				throw new Error( 'THREE.GLTFLoader: JSON content not found.' );

			}

		}

	}
	/**
	 * DRACO THREE.Mesh Compression Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
	 */


	class GLTFDracoMeshCompressionExtension {

		constructor( json, dracoLoader ) {

			if ( ! dracoLoader ) {

				throw new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' );

			}

			this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
			this.json = json;
			this.dracoLoader = dracoLoader;
			this.dracoLoader.preload();

		}

		decodePrimitive( primitive, parser ) {

			const json = this.json;
			const dracoLoader = this.dracoLoader;
			const bufferViewIndex = primitive.extensions[ this.name ].bufferView;
			const gltfAttributeMap = primitive.extensions[ this.name ].attributes;
			const threeAttributeMap = {};
			const attributeNormalizedMap = {};
			const attributeTypeMap = {};

			for ( const attributeName in gltfAttributeMap ) {

				const threeAttributeName = ATTRIBUTES[ attributeName ] || attributeName.toLowerCase();
				threeAttributeMap[ threeAttributeName ] = gltfAttributeMap[ attributeName ];

			}

			for ( const attributeName in primitive.attributes ) {

				const threeAttributeName = ATTRIBUTES[ attributeName ] || attributeName.toLowerCase();

				if ( gltfAttributeMap[ attributeName ] !== undefined ) {

					const accessorDef = json.accessors[ primitive.attributes[ attributeName ] ];
					const componentType = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];
					attributeTypeMap[ threeAttributeName ] = componentType;
					attributeNormalizedMap[ threeAttributeName ] = accessorDef.normalized === true;

				}

			}

			return parser.getDependency( 'bufferView', bufferViewIndex ).then( function ( bufferView ) {

				return new Promise( function ( resolve ) {

					dracoLoader.decodeDracoFile( bufferView, function ( geometry ) {

						for ( const attributeName in geometry.attributes ) {

							const attribute = geometry.attributes[ attributeName ];
							const normalized = attributeNormalizedMap[ attributeName ];
							if ( normalized !== undefined ) attribute.normalized = normalized;

						}

						resolve( geometry );

					}, threeAttributeMap, attributeTypeMap );

				} );

			} );

		}

	}
	/**
	 * Texture Transform Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
	 */


	class GLTFTextureTransformExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;

		}

		extendTexture( texture, transform ) {

			texture = texture.clone();

			if ( transform.offset !== undefined ) {

				texture.offset.fromArray( transform.offset );

			}

			if ( transform.rotation !== undefined ) {

				texture.rotation = transform.rotation;

			}

			if ( transform.scale !== undefined ) {

				texture.repeat.fromArray( transform.scale );

			}

			if ( transform.texCoord !== undefined ) {

				console.warn( 'THREE.GLTFLoader: Custom UV sets in "' + this.name + '" extension not yet supported.' );

			}

			texture.needsUpdate = true;
			return texture;

		}

	}
	/**
	 * Specular-Glossiness Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
	 */

	/**
	 * A sub class of StandardMaterial with some of the functionality
	 * changed via the `onBeforeCompile` callback
	 * @pailhead
	 */


	class GLTFMeshStandardSGMaterial extends THREE.MeshStandardMaterial {

		constructor( params ) {

			super();
			this.isGLTFSpecularGlossinessMaterial = true; //various chunks that need replacing

			const specularMapParsFragmentChunk = [ '#ifdef USE_SPECULARMAP', '	uniform sampler2D specularMap;', '#endif' ].join( '\n' );
			const glossinessMapParsFragmentChunk = [ '#ifdef USE_GLOSSINESSMAP', '	uniform sampler2D glossinessMap;', '#endif' ].join( '\n' );
			const specularMapFragmentChunk = [ 'vec3 specularFactor = specular;', '#ifdef USE_SPECULARMAP', '	vec4 texelSpecular = texture2D( specularMap, vUv );', '	texelSpecular = sRGBToLinear( texelSpecular );', '	// reads channel RGB, compatible with a glTF Specular-Glossiness (RGBA) texture', '	specularFactor *= texelSpecular.rgb;', '#endif' ].join( '\n' );
			const glossinessMapFragmentChunk = [ 'float glossinessFactor = glossiness;', '#ifdef USE_GLOSSINESSMAP', '	vec4 texelGlossiness = texture2D( glossinessMap, vUv );', '	// reads channel A, compatible with a glTF Specular-Glossiness (RGBA) texture', '	glossinessFactor *= texelGlossiness.a;', '#endif' ].join( '\n' );
			const lightPhysicalFragmentChunk = [ 'PhysicalMaterial material;', 'material.diffuseColor = diffuseColor.rgb * ( 1. - max( specularFactor.r, max( specularFactor.g, specularFactor.b ) ) );', 'vec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );', 'float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );', 'material.specularRoughness = max( 1.0 - glossinessFactor, 0.0525 ); // 0.0525 corresponds to the base mip of a 256 cubemap.', 'material.specularRoughness += geometryRoughness;', 'material.specularRoughness = min( material.specularRoughness, 1.0 );', 'material.specularColor = specularFactor;' ].join( '\n' );
			const uniforms = {
				specular: {
					value: new THREE.Color().setHex( 0xffffff )
				},
				glossiness: {
					value: 1
				},
				specularMap: {
					value: null
				},
				glossinessMap: {
					value: null
				}
			};
			this._extraUniforms = uniforms;

			this.onBeforeCompile = function ( shader ) {

				for ( const uniformName in uniforms ) {

					shader.uniforms[ uniformName ] = uniforms[ uniformName ];

				}

				shader.fragmentShader = shader.fragmentShader.replace( 'uniform float roughness;', 'uniform vec3 specular;' ).replace( 'uniform float metalness;', 'uniform float glossiness;' ).replace( '#include <roughnessmap_pars_fragment>', specularMapParsFragmentChunk ).replace( '#include <metalnessmap_pars_fragment>', glossinessMapParsFragmentChunk ).replace( '#include <roughnessmap_fragment>', specularMapFragmentChunk ).replace( '#include <metalnessmap_fragment>', glossinessMapFragmentChunk ).replace( '#include <lights_physical_fragment>', lightPhysicalFragmentChunk );

			};

			Object.defineProperties( this, {
				specular: {
					get: function () {

						return uniforms.specular.value;

					},
					set: function ( v ) {

						uniforms.specular.value = v;

					}
				},
				specularMap: {
					get: function () {

						return uniforms.specularMap.value;

					},
					set: function ( v ) {

						uniforms.specularMap.value = v;

						if ( v ) {

							this.defines.USE_SPECULARMAP = ''; // USE_UV is set by the renderer for specular maps

						} else {

							delete this.defines.USE_SPECULARMAP;

						}

					}
				},
				glossiness: {
					get: function () {

						return uniforms.glossiness.value;

					},
					set: function ( v ) {

						uniforms.glossiness.value = v;

					}
				},
				glossinessMap: {
					get: function () {

						return uniforms.glossinessMap.value;

					},
					set: function ( v ) {

						uniforms.glossinessMap.value = v;

						if ( v ) {

							this.defines.USE_GLOSSINESSMAP = '';
							this.defines.USE_UV = '';

						} else {

							delete this.defines.USE_GLOSSINESSMAP;
							delete this.defines.USE_UV;

						}

					}
				}
			} );
			delete this.metalness;
			delete this.roughness;
			delete this.metalnessMap;
			delete this.roughnessMap;
			this.setValues( params );

		}

		copy( source ) {

			super.copy( source );
			this.specularMap = source.specularMap;
			this.specular.copy( source.specular );
			this.glossinessMap = source.glossinessMap;
			this.glossiness = source.glossiness;
			delete this.metalness;
			delete this.roughness;
			delete this.metalnessMap;
			delete this.roughnessMap;
			return this;

		}

	}

	class GLTFMaterialsPbrSpecularGlossinessExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS;
			this.specularGlossinessParams = [ 'color', 'map', 'lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity', 'emissive', 'emissiveIntensity', 'emissiveMap', 'bumpMap', 'bumpScale', 'normalMap', 'normalMapType', 'displacementMap', 'displacementScale', 'displacementBias', 'specularMap', 'specular', 'glossinessMap', 'glossiness', 'alphaMap', 'envMap', 'envMapIntensity', 'refractionRatio' ];

		}

		getMaterialType() {

			return GLTFMeshStandardSGMaterial;

		}

		extendParams( materialParams, materialDef, parser ) {

			const pbrSpecularGlossiness = materialDef.extensions[ this.name ];
			materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
			materialParams.opacity = 1.0;
			const pending = [];

			if ( Array.isArray( pbrSpecularGlossiness.diffuseFactor ) ) {

				const array = pbrSpecularGlossiness.diffuseFactor;
				materialParams.color.fromArray( array );
				materialParams.opacity = array[ 3 ];

			}

			if ( pbrSpecularGlossiness.diffuseTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'map', pbrSpecularGlossiness.diffuseTexture ) );

			}

			materialParams.emissive = new THREE.Color( 0.0, 0.0, 0.0 );
			materialParams.glossiness = pbrSpecularGlossiness.glossinessFactor !== undefined ? pbrSpecularGlossiness.glossinessFactor : 1.0;
			materialParams.specular = new THREE.Color( 1.0, 1.0, 1.0 );

			if ( Array.isArray( pbrSpecularGlossiness.specularFactor ) ) {

				materialParams.specular.fromArray( pbrSpecularGlossiness.specularFactor );

			}

			if ( pbrSpecularGlossiness.specularGlossinessTexture !== undefined ) {

				const specGlossMapDef = pbrSpecularGlossiness.specularGlossinessTexture;
				pending.push( parser.assignTexture( materialParams, 'glossinessMap', specGlossMapDef ) );
				pending.push( parser.assignTexture( materialParams, 'specularMap', specGlossMapDef ) );

			}

			return Promise.all( pending );

		}

		createMaterial( materialParams ) {

			const material = new GLTFMeshStandardSGMaterial( materialParams );
			material.fog = true;
			material.color = materialParams.color;
			material.map = materialParams.map === undefined ? null : materialParams.map;
			material.lightMap = null;
			material.lightMapIntensity = 1.0;
			material.aoMap = materialParams.aoMap === undefined ? null : materialParams.aoMap;
			material.aoMapIntensity = 1.0;
			material.emissive = materialParams.emissive;
			material.emissiveIntensity = 1.0;
			material.emissiveMap = materialParams.emissiveMap === undefined ? null : materialParams.emissiveMap;
			material.bumpMap = materialParams.bumpMap === undefined ? null : materialParams.bumpMap;
			material.bumpScale = 1;
			material.normalMap = materialParams.normalMap === undefined ? null : materialParams.normalMap;
			material.normalMapType = THREE.TangentSpaceNormalMap;
			if ( materialParams.normalScale ) material.normalScale = materialParams.normalScale;
			material.displacementMap = null;
			material.displacementScale = 1;
			material.displacementBias = 0;
			material.specularMap = materialParams.specularMap === undefined ? null : materialParams.specularMap;
			material.specular = materialParams.specular;
			material.glossinessMap = materialParams.glossinessMap === undefined ? null : materialParams.glossinessMap;
			material.glossiness = materialParams.glossiness;
			material.alphaMap = null;
			material.envMap = materialParams.envMap === undefined ? null : materialParams.envMap;
			material.envMapIntensity = 1.0;
			material.refractionRatio = 0.98;
			return material;

		}

	}
	/**
	 * THREE.Mesh Quantization Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization
	 */


	class GLTFMeshQuantizationExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;

		}

	}
	/*********************************/

	/********** INTERPOLATION ********/

	/*********************************/
	// Spline Interpolation
	// Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation


	class GLTFCubicSplineInterpolant extends THREE.Interpolant {

		constructor( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

			super( parameterPositions, sampleValues, sampleSize, resultBuffer );

		}

		copySampleValue_( index ) {

			// Copies a sample value to the result buffer. See description of glTF
			// CUBICSPLINE values layout in interpolate_() function below.
			const result = this.resultBuffer,
				values = this.sampleValues,
				valueSize = this.valueSize,
				offset = index * valueSize * 3 + valueSize;

			for ( let i = 0; i !== valueSize; i ++ ) {

				result[ i ] = values[ offset + i ];

			}

			return result;

		}

	}

	GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;
	GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

	GLTFCubicSplineInterpolant.prototype.interpolate_ = function ( i1, t0, t, t1 ) {

		const result = this.resultBuffer;
		const values = this.sampleValues;
		const stride = this.valueSize;
		const stride2 = stride * 2;
		const stride3 = stride * 3;
		const td = t1 - t0;
		const p = ( t - t0 ) / td;
		const pp = p * p;
		const ppp = pp * p;
		const offset1 = i1 * stride3;
		const offset0 = offset1 - stride3;
		const s2 = - 2 * ppp + 3 * pp;
		const s3 = ppp - pp;
		const s0 = 1 - s2;
		const s1 = s3 - pp + p; // Layout of keyframe output values for CUBICSPLINE animations:
		//   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]

		for ( let i = 0; i !== stride; i ++ ) {

			const p0 = values[ offset0 + i + stride ]; // splineVertex_k

			const m0 = values[ offset0 + i + stride2 ] * td; // outTangent_k * (t_k+1 - t_k)

			const p1 = values[ offset1 + i + stride ]; // splineVertex_k+1

			const m1 = values[ offset1 + i ] * td; // inTangent_k+1 * (t_k+1 - t_k)

			result[ i ] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

		}

		return result;

	};
	/*********************************/

	/********** INTERNALS ************/

	/*********************************/

	/* CONSTANTS */


	const WEBGL_CONSTANTS = {
		FLOAT: 5126,
		//FLOAT_MAT2: 35674,
		FLOAT_MAT3: 35675,
		FLOAT_MAT4: 35676,
		FLOAT_VEC2: 35664,
		FLOAT_VEC3: 35665,
		FLOAT_VEC4: 35666,
		LINEAR: 9729,
		REPEAT: 10497,
		SAMPLER_2D: 35678,
		POINTS: 0,
		LINES: 1,
		LINE_LOOP: 2,
		LINE_STRIP: 3,
		TRIANGLES: 4,
		TRIANGLE_STRIP: 5,
		TRIANGLE_FAN: 6,
		UNSIGNED_BYTE: 5121,
		UNSIGNED_SHORT: 5123
	};
	const WEBGL_COMPONENT_TYPES = {
		5120: Int8Array,
		5121: Uint8Array,
		5122: Int16Array,
		5123: Uint16Array,
		5125: Uint32Array,
		5126: Float32Array
	};
	const WEBGL_FILTERS = {
		9728: THREE.NearestFilter,
		9729: THREE.LinearFilter,
		9984: THREE.NearestMipmapNearestFilter,
		9985: THREE.LinearMipmapNearestFilter,
		9986: THREE.NearestMipmapLinearFilter,
		9987: THREE.LinearMipmapLinearFilter
	};
	const WEBGL_WRAPPINGS = {
		33071: THREE.ClampToEdgeWrapping,
		33648: THREE.MirroredRepeatWrapping,
		10497: THREE.RepeatWrapping
	};
	const WEBGL_TYPE_SIZES = {
		'SCALAR': 1,
		'VEC2': 2,
		'VEC3': 3,
		'VEC4': 4,
		'MAT2': 4,
		'MAT3': 9,
		'MAT4': 16
	};
	const ATTRIBUTES = {
		POSITION: 'position',
		NORMAL: 'normal',
		TANGENT: 'tangent',
		TEXCOORD_0: 'uv',
		TEXCOORD_1: 'uv2',
		COLOR_0: 'color',
		WEIGHTS_0: 'skinWeight',
		JOINTS_0: 'skinIndex'
	};
	const PATH_PROPERTIES = {
		scale: 'scale',
		translation: 'position',
		rotation: 'quaternion',
		weights: 'morphTargetInfluences'
	};
	const INTERPOLATION = {
		CUBICSPLINE: undefined,
		// We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
		// keyframe track will be initialized with a default interpolation type, then modified.
		LINEAR: THREE.InterpolateLinear,
		STEP: THREE.InterpolateDiscrete
	};
	const ALPHA_MODES = {
		OPAQUE: 'OPAQUE',
		MASK: 'MASK',
		BLEND: 'BLEND'
	};
	/* UTILITY FUNCTIONS */

	function resolveURL( url, path ) {

		// Invalid URL
		if ( typeof url !== 'string' || url === '' ) return ''; // Host Relative URL

		if ( /^https?:\/\//i.test( path ) && /^\//.test( url ) ) {

			path = path.replace( /(^https?:\/\/[^\/]+).*/i, '$1' );

		} // Absolute URL http://,https://,//


		if ( /^(https?:)?\/\//i.test( url ) ) return url; // Data URI

		if ( /^data:.*,.*$/i.test( url ) ) return url; // Blob URL

		if ( /^blob:.*$/i.test( url ) ) return url; // Relative URL

		return path + url;

	}
	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
	 */


	function createDefaultMaterial( cache ) {

		if ( cache[ 'DefaultMaterial' ] === undefined ) {

			cache[ 'DefaultMaterial' ] = new THREE.MeshStandardMaterial( {
				color: 0xFFFFFF,
				emissive: 0x000000,
				metalness: 1,
				roughness: 1,
				transparent: false,
				depthTest: true,
				side: THREE.FrontSide
			} );

		}

		return cache[ 'DefaultMaterial' ];

	}

	function addUnknownExtensionsToUserData( knownExtensions, object, objectDef ) {

		// Add unknown glTF extensions to an object's userData.
		for ( const name in objectDef.extensions ) {

			if ( knownExtensions[ name ] === undefined ) {

				object.userData.gltfExtensions = object.userData.gltfExtensions || {};
				object.userData.gltfExtensions[ name ] = objectDef.extensions[ name ];

			}

		}

	}
	/**
	 * @param {Object3D|Material|BufferGeometry} object
	 * @param {GLTF.definition} gltfDef
	 */


	function assignExtrasToUserData( object, gltfDef ) {

		if ( gltfDef.extras !== undefined ) {

			if ( typeof gltfDef.extras === 'object' ) {

				Object.assign( object.userData, gltfDef.extras );

			} else {

				console.warn( 'THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras );

			}

		}

	}
	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
	 *
	 * @param {BufferGeometry} geometry
	 * @param {Array<GLTF.Target>} targets
	 * @param {GLTFParser} parser
	 * @return {Promise<BufferGeometry>}
	 */


	function addMorphTargets( geometry, targets, parser ) {

		let hasMorphPosition = false;
		let hasMorphNormal = false;

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];
			if ( target.POSITION !== undefined ) hasMorphPosition = true;
			if ( target.NORMAL !== undefined ) hasMorphNormal = true;
			if ( hasMorphPosition && hasMorphNormal ) break;

		}

		if ( ! hasMorphPosition && ! hasMorphNormal ) return Promise.resolve( geometry );
		const pendingPositionAccessors = [];
		const pendingNormalAccessors = [];

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];

			if ( hasMorphPosition ) {

				const pendingAccessor = target.POSITION !== undefined ? parser.getDependency( 'accessor', target.POSITION ) : geometry.attributes.position;
				pendingPositionAccessors.push( pendingAccessor );

			}

			if ( hasMorphNormal ) {

				const pendingAccessor = target.NORMAL !== undefined ? parser.getDependency( 'accessor', target.NORMAL ) : geometry.attributes.normal;
				pendingNormalAccessors.push( pendingAccessor );

			}

		}

		return Promise.all( [ Promise.all( pendingPositionAccessors ), Promise.all( pendingNormalAccessors ) ] ).then( function ( accessors ) {

			const morphPositions = accessors[ 0 ];
			const morphNormals = accessors[ 1 ];
			if ( hasMorphPosition ) geometry.morphAttributes.position = morphPositions;
			if ( hasMorphNormal ) geometry.morphAttributes.normal = morphNormals;
			geometry.morphTargetsRelative = true;
			return geometry;

		} );

	}
	/**
	 * @param {Mesh} mesh
	 * @param {GLTF.Mesh} meshDef
	 */


	function updateMorphTargets( mesh, meshDef ) {

		mesh.updateMorphTargets();

		if ( meshDef.weights !== undefined ) {

			for ( let i = 0, il = meshDef.weights.length; i < il; i ++ ) {

				mesh.morphTargetInfluences[ i ] = meshDef.weights[ i ];

			}

		} // .extras has user-defined data, so check that .extras.targetNames is an array.


		if ( meshDef.extras && Array.isArray( meshDef.extras.targetNames ) ) {

			const targetNames = meshDef.extras.targetNames;

			if ( mesh.morphTargetInfluences.length === targetNames.length ) {

				mesh.morphTargetDictionary = {};

				for ( let i = 0, il = targetNames.length; i < il; i ++ ) {

					mesh.morphTargetDictionary[ targetNames[ i ] ] = i;

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.' );

			}

		}

	}

	function createPrimitiveKey( primitiveDef ) {

		const dracoExtension = primitiveDef.extensions && primitiveDef.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ];
		let geometryKey;

		if ( dracoExtension ) {

			geometryKey = 'draco:' + dracoExtension.bufferView + ':' + dracoExtension.indices + ':' + createAttributesKey( dracoExtension.attributes );

		} else {

			geometryKey = primitiveDef.indices + ':' + createAttributesKey( primitiveDef.attributes ) + ':' + primitiveDef.mode;

		}

		return geometryKey;

	}

	function createAttributesKey( attributes ) {

		let attributesKey = '';
		const keys = Object.keys( attributes ).sort();

		for ( let i = 0, il = keys.length; i < il; i ++ ) {

			attributesKey += keys[ i ] + ':' + attributes[ keys[ i ] ] + ';';

		}

		return attributesKey;

	}

	function getNormalizedComponentScale( constructor ) {

		// Reference:
		// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
		switch ( constructor ) {

			case Int8Array:
				return 1 / 127;

			case Uint8Array:
				return 1 / 255;

			case Int16Array:
				return 1 / 32767;

			case Uint16Array:
				return 1 / 65535;

			default:
				throw new Error( 'THREE.GLTFLoader: Unsupported normalized accessor component type.' );

		}

	}
	/* GLTF PARSER */


	class GLTFParser {

		constructor( json = {}, options = {} ) {

			this.json = json;
			this.extensions = {};
			this.plugins = {};
			this.options = options; // loader object cache

			this.cache = new GLTFRegistry(); // associations between Three.js objects and glTF elements

			this.associations = new Map(); // THREE.BufferGeometry caching

			this.primitiveCache = {}; // THREE.Object3D instance caches

			this.meshCache = {
				refs: {},
				uses: {}
			};
			this.cameraCache = {
				refs: {},
				uses: {}
			};
			this.lightCache = {
				refs: {},
				uses: {}
			}; // Track node names, to ensure no duplicates

			this.nodeNamesUsed = {}; // Use an THREE.ImageBitmapLoader if imageBitmaps are supported. Moves much of the
			// expensive work of uploading a texture to the GPU off the main thread.

			if ( typeof createImageBitmap !== 'undefined' && /Firefox/.test( navigator.userAgent ) === false ) {

				this.textureLoader = new THREE.ImageBitmapLoader( this.options.manager );

			} else {

				this.textureLoader = new THREE.TextureLoader( this.options.manager );

			}

			this.textureLoader.setCrossOrigin( this.options.crossOrigin );
			this.textureLoader.setRequestHeader( this.options.requestHeader );
			this.fileLoader = new THREE.FileLoader( this.options.manager );
			this.fileLoader.setResponseType( 'arraybuffer' );

			if ( this.options.crossOrigin === 'use-credentials' ) {

				this.fileLoader.setWithCredentials( true );

			}

		}

		setExtensions( extensions ) {

			this.extensions = extensions;

		}

		setPlugins( plugins ) {

			this.plugins = plugins;

		}

		parse( onLoad, onError ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions; // Clear the loader cache

			this.cache.removeAll(); // Mark the special nodes/meshes in json for efficient parse

			this._invokeAll( function ( ext ) {

				return ext._markDefs && ext._markDefs();

			} );

			Promise.all( this._invokeAll( function ( ext ) {

				return ext.beforeRoot && ext.beforeRoot();

			} ) ).then( function () {

				return Promise.all( [ parser.getDependencies( 'scene' ), parser.getDependencies( 'animation' ), parser.getDependencies( 'camera' ) ] );

			} ).then( function ( dependencies ) {

				const result = {
					scene: dependencies[ 0 ][ json.scene || 0 ],
					scenes: dependencies[ 0 ],
					animations: dependencies[ 1 ],
					cameras: dependencies[ 2 ],
					asset: json.asset,
					parser: parser,
					userData: {}
				};
				addUnknownExtensionsToUserData( extensions, result, json );
				assignExtrasToUserData( result, json );
				Promise.all( parser._invokeAll( function ( ext ) {

					return ext.afterRoot && ext.afterRoot( result );

				} ) ).then( function () {

					onLoad( result );

				} );

			} ).catch( onError );

		}
		/**
   * Marks the special nodes/meshes in json for efficient parse.
   */


		_markDefs() {

			const nodeDefs = this.json.nodes || [];
			const skinDefs = this.json.skins || [];
			const meshDefs = this.json.meshes || []; // Nothing in the node definition indicates whether it is a THREE.Bone or an
			// THREE.Object3D. Use the skins' joint references to mark bones.

			for ( let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex ++ ) {

				const joints = skinDefs[ skinIndex ].joints;

				for ( let i = 0, il = joints.length; i < il; i ++ ) {

					nodeDefs[ joints[ i ] ].isBone = true;

				}

			} // Iterate over all nodes, marking references to shared resources,
			// as well as skeleton joints.


			for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

				const nodeDef = nodeDefs[ nodeIndex ];

				if ( nodeDef.mesh !== undefined ) {

					this._addNodeRef( this.meshCache, nodeDef.mesh ); // Nothing in the mesh definition indicates whether it is
					// a THREE.SkinnedMesh or THREE.Mesh. Use the node's mesh reference
					// to mark THREE.SkinnedMesh if node has skin.


					if ( nodeDef.skin !== undefined ) {

						meshDefs[ nodeDef.mesh ].isSkinnedMesh = true;

					}

				}

				if ( nodeDef.camera !== undefined ) {

					this._addNodeRef( this.cameraCache, nodeDef.camera );

				}

			}

		}
		/**
   * Counts references to shared node / THREE.Object3D resources. These resources
   * can be reused, or "instantiated", at multiple nodes in the scene
   * hierarchy. THREE.Mesh, Camera, and Light instances are instantiated and must
   * be marked. Non-scenegraph resources (like Materials, Geometries, and
   * Textures) can be reused directly and are not marked here.
   *
   * Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
   */


		_addNodeRef( cache, index ) {

			if ( index === undefined ) return;

			if ( cache.refs[ index ] === undefined ) {

				cache.refs[ index ] = cache.uses[ index ] = 0;

			}

			cache.refs[ index ] ++;

		}
		/** Returns a reference to a shared resource, cloning it if necessary. */


		_getNodeRef( cache, index, object ) {

			if ( cache.refs[ index ] <= 1 ) return object;
			const ref = object.clone();
			ref.name += '_instance_' + cache.uses[ index ] ++;
			return ref;

		}

		_invokeOne( func ) {

			const extensions = Object.values( this.plugins );
			extensions.push( this );

			for ( let i = 0; i < extensions.length; i ++ ) {

				const result = func( extensions[ i ] );
				if ( result ) return result;

			}

			return null;

		}

		_invokeAll( func ) {

			const extensions = Object.values( this.plugins );
			extensions.unshift( this );
			const pending = [];

			for ( let i = 0; i < extensions.length; i ++ ) {

				const result = func( extensions[ i ] );
				if ( result ) pending.push( result );

			}

			return pending;

		}
		/**
   * Requests the specified dependency asynchronously, with caching.
   * @param {string} type
   * @param {number} index
   * @return {Promise<Object3D|Material|THREE.Texture|AnimationClip|ArrayBuffer|Object>}
   */


		getDependency( type, index ) {

			const cacheKey = type + ':' + index;
			let dependency = this.cache.get( cacheKey );

			if ( ! dependency ) {

				switch ( type ) {

					case 'scene':
						dependency = this.loadScene( index );
						break;

					case 'node':
						dependency = this.loadNode( index );
						break;

					case 'mesh':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadMesh && ext.loadMesh( index );

						} );
						break;

					case 'accessor':
						dependency = this.loadAccessor( index );
						break;

					case 'bufferView':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadBufferView && ext.loadBufferView( index );

						} );
						break;

					case 'buffer':
						dependency = this.loadBuffer( index );
						break;

					case 'material':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadMaterial && ext.loadMaterial( index );

						} );
						break;

					case 'texture':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadTexture && ext.loadTexture( index );

						} );
						break;

					case 'skin':
						dependency = this.loadSkin( index );
						break;

					case 'animation':
						dependency = this.loadAnimation( index );
						break;

					case 'camera':
						dependency = this.loadCamera( index );
						break;

					default:
						throw new Error( 'Unknown type: ' + type );

				}

				this.cache.add( cacheKey, dependency );

			}

			return dependency;

		}
		/**
   * Requests all dependencies of the specified type asynchronously, with caching.
   * @param {string} type
   * @return {Promise<Array<Object>>}
   */


		getDependencies( type ) {

			let dependencies = this.cache.get( type );

			if ( ! dependencies ) {

				const parser = this;
				const defs = this.json[ type + ( type === 'mesh' ? 'es' : 's' ) ] || [];
				dependencies = Promise.all( defs.map( function ( def, index ) {

					return parser.getDependency( type, index );

				} ) );
				this.cache.add( type, dependencies );

			}

			return dependencies;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferIndex
   * @return {Promise<ArrayBuffer>}
   */


		loadBuffer( bufferIndex ) {

			const bufferDef = this.json.buffers[ bufferIndex ];
			const loader = this.fileLoader;

			if ( bufferDef.type && bufferDef.type !== 'arraybuffer' ) {

				throw new Error( 'THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.' );

			} // If present, GLB container is required to be the first buffer.


			if ( bufferDef.uri === undefined && bufferIndex === 0 ) {

				return Promise.resolve( this.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body );

			}

			const options = this.options;
			return new Promise( function ( resolve, reject ) {

				loader.load( resolveURL( bufferDef.uri, options.path ), resolve, undefined, function () {

					reject( new Error( 'THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".' ) );

				} );

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferViewIndex
   * @return {Promise<ArrayBuffer>}
   */


		loadBufferView( bufferViewIndex ) {

			const bufferViewDef = this.json.bufferViews[ bufferViewIndex ];
			return this.getDependency( 'buffer', bufferViewDef.buffer ).then( function ( buffer ) {

				const byteLength = bufferViewDef.byteLength || 0;
				const byteOffset = bufferViewDef.byteOffset || 0;
				return buffer.slice( byteOffset, byteOffset + byteLength );

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
   * @param {number} accessorIndex
   * @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
   */


		loadAccessor( accessorIndex ) {

			const parser = this;
			const json = this.json;
			const accessorDef = this.json.accessors[ accessorIndex ];

			if ( accessorDef.bufferView === undefined && accessorDef.sparse === undefined ) {

				// Ignore empty accessors, which may be used to declare runtime
				// information about attributes coming from another source (e.g. Draco
				// compression extension).
				return Promise.resolve( null );

			}

			const pendingBufferViews = [];

			if ( accessorDef.bufferView !== undefined ) {

				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.bufferView ) );

			} else {

				pendingBufferViews.push( null );

			}

			if ( accessorDef.sparse !== undefined ) {

				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.indices.bufferView ) );
				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.values.bufferView ) );

			}

			return Promise.all( pendingBufferViews ).then( function ( bufferViews ) {

				const bufferView = bufferViews[ 0 ];
				const itemSize = WEBGL_TYPE_SIZES[ accessorDef.type ];
				const TypedArray = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ]; // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.

				const elementBytes = TypedArray.BYTES_PER_ELEMENT;
				const itemBytes = elementBytes * itemSize;
				const byteOffset = accessorDef.byteOffset || 0;
				const byteStride = accessorDef.bufferView !== undefined ? json.bufferViews[ accessorDef.bufferView ].byteStride : undefined;
				const normalized = accessorDef.normalized === true;
				let array, bufferAttribute; // The buffer is not interleaved if the stride is the item size in bytes.

				if ( byteStride && byteStride !== itemBytes ) {

					// Each "slice" of the buffer, as defined by 'count' elements of 'byteStride' bytes, gets its own THREE.InterleavedBuffer
					// This makes sure that IBA.count reflects accessor.count properly
					const ibSlice = Math.floor( byteOffset / byteStride );
					const ibCacheKey = 'InterleavedBuffer:' + accessorDef.bufferView + ':' + accessorDef.componentType + ':' + ibSlice + ':' + accessorDef.count;
					let ib = parser.cache.get( ibCacheKey );

					if ( ! ib ) {

						array = new TypedArray( bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes ); // Integer parameters to IB/IBA are in array elements, not bytes.

						ib = new THREE.InterleavedBuffer( array, byteStride / elementBytes );
						parser.cache.add( ibCacheKey, ib );

					}

					bufferAttribute = new THREE.InterleavedBufferAttribute( ib, itemSize, byteOffset % byteStride / elementBytes, normalized );

				} else {

					if ( bufferView === null ) {

						array = new TypedArray( accessorDef.count * itemSize );

					} else {

						array = new TypedArray( bufferView, byteOffset, accessorDef.count * itemSize );

					}

					bufferAttribute = new THREE.BufferAttribute( array, itemSize, normalized );

				} // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors


				if ( accessorDef.sparse !== undefined ) {

					const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
					const TypedArrayIndices = WEBGL_COMPONENT_TYPES[ accessorDef.sparse.indices.componentType ];
					const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
					const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;
					const sparseIndices = new TypedArrayIndices( bufferViews[ 1 ], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices );
					const sparseValues = new TypedArray( bufferViews[ 2 ], byteOffsetValues, accessorDef.sparse.count * itemSize );

					if ( bufferView !== null ) {

						// Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
						bufferAttribute = new THREE.BufferAttribute( bufferAttribute.array.slice(), bufferAttribute.itemSize, bufferAttribute.normalized );

					}

					for ( let i = 0, il = sparseIndices.length; i < il; i ++ ) {

						const index = sparseIndices[ i ];
						bufferAttribute.setX( index, sparseValues[ i * itemSize ] );
						if ( itemSize >= 2 ) bufferAttribute.setY( index, sparseValues[ i * itemSize + 1 ] );
						if ( itemSize >= 3 ) bufferAttribute.setZ( index, sparseValues[ i * itemSize + 2 ] );
						if ( itemSize >= 4 ) bufferAttribute.setW( index, sparseValues[ i * itemSize + 3 ] );
						if ( itemSize >= 5 ) throw new Error( 'THREE.GLTFLoader: Unsupported itemSize in sparse THREE.BufferAttribute.' );

					}

				}

				return bufferAttribute;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
   * @param {number} textureIndex
   * @return {Promise<THREE.Texture>}
   */


		loadTexture( textureIndex ) {

			const json = this.json;
			const options = this.options;
			const textureDef = json.textures[ textureIndex ];
			const source = json.images[ textureDef.source ];
			let loader = this.textureLoader;

			if ( source.uri ) {

				const handler = options.manager.getHandler( source.uri );
				if ( handler !== null ) loader = handler;

			}

			return this.loadTextureImage( textureIndex, source, loader );

		}

		loadTextureImage( textureIndex, source, loader ) {

			const parser = this;
			const json = this.json;
			const options = this.options;
			const textureDef = json.textures[ textureIndex ];
			const URL = self.URL || self.webkitURL;
			let sourceURI = source.uri;
			let isObjectURL = false;
			let hasAlpha = true;
			if ( source.mimeType === 'image/jpeg' ) hasAlpha = false;

			if ( source.bufferView !== undefined ) {

				// Load binary image data from bufferView, if provided.
				sourceURI = parser.getDependency( 'bufferView', source.bufferView ).then( function ( bufferView ) {

					if ( source.mimeType === 'image/png' ) {

						// Inspect the PNG 'IHDR' chunk to determine whether the image could have an
						// alpha channel. This check is conservative — the image could have an alpha
						// channel with all values == 1, and the indexed type (colorType == 3) only
						// sometimes contains alpha.
						//
						// https://en.wikipedia.org/wiki/Portable_Network_Graphics#File_header
						const colorType = new DataView( bufferView, 25, 1 ).getUint8( 0, false );
						hasAlpha = colorType === 6 || colorType === 4 || colorType === 3;

					}

					isObjectURL = true;
					const blob = new Blob( [ bufferView ], {
						type: source.mimeType
					} );
					sourceURI = URL.createObjectURL( blob );
					return sourceURI;

				} );

			} else if ( source.uri === undefined ) {

				throw new Error( 'THREE.GLTFLoader: Image ' + textureIndex + ' is missing URI and bufferView' );

			}

			return Promise.resolve( sourceURI ).then( function ( sourceURI ) {

				return new Promise( function ( resolve, reject ) {

					let onLoad = resolve;

					if ( loader.isImageBitmapLoader === true ) {

						onLoad = function ( imageBitmap ) {

							resolve( new THREE.CanvasTexture( imageBitmap ) );

						};

					}

					loader.load( resolveURL( sourceURI, options.path ), onLoad, undefined, reject );

				} );

			} ).then( function ( texture ) {

				// Clean up resources and configure Texture.
				if ( isObjectURL === true ) {

					URL.revokeObjectURL( sourceURI );

				}

				texture.flipY = false;
				if ( textureDef.name ) texture.name = textureDef.name; // When there is definitely no alpha channel in the texture, set THREE.RGBFormat to save space.

				if ( ! hasAlpha ) texture.format = THREE.RGBFormat;
				const samplers = json.samplers || {};
				const sampler = samplers[ textureDef.sampler ] || {};
				texture.magFilter = WEBGL_FILTERS[ sampler.magFilter ] || THREE.LinearFilter;
				texture.minFilter = WEBGL_FILTERS[ sampler.minFilter ] || THREE.LinearMipmapLinearFilter;
				texture.wrapS = WEBGL_WRAPPINGS[ sampler.wrapS ] || THREE.RepeatWrapping;
				texture.wrapT = WEBGL_WRAPPINGS[ sampler.wrapT ] || THREE.RepeatWrapping;
				parser.associations.set( texture, {
					type: 'textures',
					index: textureIndex
				} );
				return texture;

			} );

		}
		/**
   * Asynchronously assigns a texture to the given material parameters.
   * @param {Object} materialParams
   * @param {string} mapName
   * @param {Object} mapDef
   * @return {Promise}
   */


		assignTexture( materialParams, mapName, mapDef ) {

			const parser = this;
			return this.getDependency( 'texture', mapDef.index ).then( function ( texture ) {

				// Materials sample aoMap from UV set 1 and other maps from UV set 0 - this can't be configured
				// However, we will copy UV set 0 to UV set 1 on demand for aoMap
				if ( mapDef.texCoord !== undefined && mapDef.texCoord != 0 && ! ( mapName === 'aoMap' && mapDef.texCoord == 1 ) ) {

					console.warn( 'THREE.GLTFLoader: Custom UV set ' + mapDef.texCoord + ' for texture ' + mapName + ' not yet supported.' );

				}

				if ( parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] ) {

					const transform = mapDef.extensions !== undefined ? mapDef.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] : undefined;

					if ( transform ) {

						const gltfReference = parser.associations.get( texture );
						texture = parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ].extendTexture( texture, transform );
						parser.associations.set( texture, gltfReference );

					}

				}

				materialParams[ mapName ] = texture;

			} );

		}
		/**
   * Assigns final material to a THREE.Mesh, THREE.Line, or THREE.Points instance. The instance
   * already has a material (generated from the glTF material options alone)
   * but reuse of the same glTF material may require multiple threejs materials
   * to accommodate different primitive types, defines, etc. New materials will
   * be created if necessary, and reused from a cache.
   * @param  {Object3D} mesh THREE.Mesh, THREE.Line, or THREE.Points instance.
   */


		assignFinalMaterial( mesh ) {

			const geometry = mesh.geometry;
			let material = mesh.material;
			const useVertexTangents = geometry.attributes.tangent !== undefined;
			const useVertexColors = geometry.attributes.color !== undefined;
			const useFlatShading = geometry.attributes.normal === undefined;
			const useSkinning = mesh.isSkinnedMesh === true;
			const useMorphTargets = Object.keys( geometry.morphAttributes ).length > 0;
			const useMorphNormals = useMorphTargets && geometry.morphAttributes.normal !== undefined;

			if ( mesh.isPoints ) {

				const cacheKey = 'PointsMaterial:' + material.uuid;
				let pointsMaterial = this.cache.get( cacheKey );

				if ( ! pointsMaterial ) {

					pointsMaterial = new THREE.PointsMaterial();
					THREE.Material.prototype.copy.call( pointsMaterial, material );
					pointsMaterial.color.copy( material.color );
					pointsMaterial.map = material.map;
					pointsMaterial.sizeAttenuation = false; // glTF spec says points should be 1px

					this.cache.add( cacheKey, pointsMaterial );

				}

				material = pointsMaterial;

			} else if ( mesh.isLine ) {

				const cacheKey = 'LineBasicMaterial:' + material.uuid;
				let lineMaterial = this.cache.get( cacheKey );

				if ( ! lineMaterial ) {

					lineMaterial = new THREE.LineBasicMaterial();
					THREE.Material.prototype.copy.call( lineMaterial, material );
					lineMaterial.color.copy( material.color );
					this.cache.add( cacheKey, lineMaterial );

				}

				material = lineMaterial;

			} // Clone the material if it will be modified


			if ( useVertexTangents || useVertexColors || useFlatShading || useSkinning || useMorphTargets ) {

				let cacheKey = 'ClonedMaterial:' + material.uuid + ':';
				if ( material.isGLTFSpecularGlossinessMaterial ) cacheKey += 'specular-glossiness:';
				if ( useSkinning ) cacheKey += 'skinning:';
				if ( useVertexTangents ) cacheKey += 'vertex-tangents:';
				if ( useVertexColors ) cacheKey += 'vertex-colors:';
				if ( useFlatShading ) cacheKey += 'flat-shading:';
				if ( useMorphTargets ) cacheKey += 'morph-targets:';
				if ( useMorphNormals ) cacheKey += 'morph-normals:';
				let cachedMaterial = this.cache.get( cacheKey );

				if ( ! cachedMaterial ) {

					cachedMaterial = material.clone();
					if ( useSkinning ) cachedMaterial.skinning = true;
					if ( useVertexColors ) cachedMaterial.vertexColors = true;
					if ( useFlatShading ) cachedMaterial.flatShading = true;
					if ( useMorphTargets ) cachedMaterial.morphTargets = true;
					if ( useMorphNormals ) cachedMaterial.morphNormals = true;

					if ( useVertexTangents ) {

						cachedMaterial.vertexTangents = true; // https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995

						if ( cachedMaterial.normalScale ) cachedMaterial.normalScale.y *= - 1;
						if ( cachedMaterial.clearcoatNormalScale ) cachedMaterial.clearcoatNormalScale.y *= - 1;

					}

					this.cache.add( cacheKey, cachedMaterial );
					this.associations.set( cachedMaterial, this.associations.get( material ) );

				}

				material = cachedMaterial;

			} // workarounds for mesh and geometry


			if ( material.aoMap && geometry.attributes.uv2 === undefined && geometry.attributes.uv !== undefined ) {

				geometry.setAttribute( 'uv2', geometry.attributes.uv );

			}

			mesh.material = material;

		}

		getMaterialType( ) {

			return THREE.MeshStandardMaterial;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
   * @param {number} materialIndex
   * @return {Promise<Material>}
   */


		loadMaterial( materialIndex ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;
			const materialDef = json.materials[ materialIndex ];
			let materialType;
			const materialParams = {};
			const materialExtensions = materialDef.extensions || {};
			const pending = [];

			if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ] ) {

				const sgExtension = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ];
				materialType = sgExtension.getMaterialType();
				pending.push( sgExtension.extendParams( materialParams, materialDef, parser ) );

			} else if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ] ) {

				const kmuExtension = extensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ];
				materialType = kmuExtension.getMaterialType();
				pending.push( kmuExtension.extendParams( materialParams, materialDef, parser ) );

			} else {

				// Specification:
				// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
				const metallicRoughness = materialDef.pbrMetallicRoughness || {};
				materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
				materialParams.opacity = 1.0;

				if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

					const array = metallicRoughness.baseColorFactor;
					materialParams.color.fromArray( array );
					materialParams.opacity = array[ 3 ];

				}

				if ( metallicRoughness.baseColorTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture ) );

				}

				materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
				materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

				if ( metallicRoughness.metallicRoughnessTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'metalnessMap', metallicRoughness.metallicRoughnessTexture ) );
					pending.push( parser.assignTexture( materialParams, 'roughnessMap', metallicRoughness.metallicRoughnessTexture ) );

				}

				materialType = this._invokeOne( function ( ext ) {

					return ext.getMaterialType && ext.getMaterialType( materialIndex );

				} );
				pending.push( Promise.all( this._invokeAll( function ( ext ) {

					return ext.extendMaterialParams && ext.extendMaterialParams( materialIndex, materialParams );

				} ) ) );

			}

			if ( materialDef.doubleSided === true ) {

				materialParams.side = THREE.DoubleSide;

			}

			const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

			if ( alphaMode === ALPHA_MODES.BLEND ) {

				materialParams.transparent = true; // See: https://github.com/mrdoob/three.js/issues/17706

				materialParams.depthWrite = false;

			} else {

				materialParams.transparent = false;

				if ( alphaMode === ALPHA_MODES.MASK ) {

					materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;

				}

			}

			if ( materialDef.normalTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'normalMap', materialDef.normalTexture ) ); // https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995

				materialParams.normalScale = new THREE.Vector2( 1, - 1 );

				if ( materialDef.normalTexture.scale !== undefined ) {

					materialParams.normalScale.set( materialDef.normalTexture.scale, - materialDef.normalTexture.scale );

				}

			}

			if ( materialDef.occlusionTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'aoMap', materialDef.occlusionTexture ) );

				if ( materialDef.occlusionTexture.strength !== undefined ) {

					materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;

				}

			}

			if ( materialDef.emissiveFactor !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				materialParams.emissive = new THREE.Color().fromArray( materialDef.emissiveFactor );

			}

			if ( materialDef.emissiveTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'emissiveMap', materialDef.emissiveTexture ) );

			}

			return Promise.all( pending ).then( function () {

				let material;

				if ( materialType === GLTFMeshStandardSGMaterial ) {

					material = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].createMaterial( materialParams );

				} else {

					material = new materialType( materialParams );

				}

				if ( materialDef.name ) material.name = materialDef.name; // baseColorTexture, emissiveTexture, and specularGlossinessTexture use sRGB encoding.

				if ( material.map ) material.map.encoding = THREE.sRGBEncoding;
				if ( material.emissiveMap ) material.emissiveMap.encoding = THREE.sRGBEncoding;
				assignExtrasToUserData( material, materialDef );
				parser.associations.set( material, {
					type: 'materials',
					index: materialIndex
				} );
				if ( materialDef.extensions ) addUnknownExtensionsToUserData( extensions, material, materialDef );
				return material;

			} );

		}
		/** When THREE.Object3D instances are targeted by animation, they need unique names. */


		createUniqueName( originalName ) {

			const sanitizedName = THREE.PropertyBinding.sanitizeNodeName( originalName || '' );
			let name = sanitizedName;

			for ( let i = 1; this.nodeNamesUsed[ name ]; ++ i ) {

				name = sanitizedName + '_' + i;

			}

			this.nodeNamesUsed[ name ] = true;
			return name;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
   *
   * Creates BufferGeometries from primitives.
   *
   * @param {Array<GLTF.Primitive>} primitives
   * @return {Promise<Array<BufferGeometry>>}
   */


		loadGeometries( primitives ) {

			const parser = this;
			const extensions = this.extensions;
			const cache = this.primitiveCache;

			function createDracoPrimitive( primitive ) {

				return extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ].decodePrimitive( primitive, parser ).then( function ( geometry ) {

					return addPrimitiveAttributes( geometry, primitive, parser );

				} );

			}

			const pending = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const primitive = primitives[ i ];
				const cacheKey = createPrimitiveKey( primitive ); // See if we've already created this geometry

				const cached = cache[ cacheKey ];

				if ( cached ) {

					// Use the cached geometry if it exists
					pending.push( cached.promise );

				} else {

					let geometryPromise;

					if ( primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) {

						// Use DRACO geometry if available
						geometryPromise = createDracoPrimitive( primitive );

					} else {

						// Otherwise create a new geometry
						geometryPromise = addPrimitiveAttributes( new THREE.BufferGeometry(), primitive, parser );

					} // Cache this geometry


					cache[ cacheKey ] = {
						primitive: primitive,
						promise: geometryPromise
					};
					pending.push( geometryPromise );

				}

			}

			return Promise.all( pending );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
   * @param {number} meshIndex
   * @return {Promise<Group|Mesh|SkinnedMesh>}
   */


		loadMesh( meshIndex ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;
			const meshDef = json.meshes[ meshIndex ];
			const primitives = meshDef.primitives;
			const pending = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const material = primitives[ i ].material === undefined ? createDefaultMaterial( this.cache ) : this.getDependency( 'material', primitives[ i ].material );
				pending.push( material );

			}

			pending.push( parser.loadGeometries( primitives ) );
			return Promise.all( pending ).then( function ( results ) {

				const materials = results.slice( 0, results.length - 1 );
				const geometries = results[ results.length - 1 ];
				const meshes = [];

				for ( let i = 0, il = geometries.length; i < il; i ++ ) {

					const geometry = geometries[ i ];
					const primitive = primitives[ i ]; // 1. create THREE.Mesh

					let mesh;
					const material = materials[ i ];

					if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN || primitive.mode === undefined ) {

						// .isSkinnedMesh isn't in glTF spec. See ._markDefs()
						mesh = meshDef.isSkinnedMesh === true ? new THREE.SkinnedMesh( geometry, material ) : new THREE.Mesh( geometry, material );

						if ( mesh.isSkinnedMesh === true && ! mesh.geometry.attributes.skinWeight.normalized ) {

							// we normalize floating point skin weight array to fix malformed assets (see #15319)
							// it's important to skip this for non-float32 data since normalizeSkinWeights assumes non-normalized inputs
							mesh.normalizeSkinWeights();

						}

						if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ) {

							mesh.geometry = toTrianglesDrawMode( mesh.geometry, THREE.TriangleStripDrawMode );

						} else if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ) {

							mesh.geometry = toTrianglesDrawMode( mesh.geometry, THREE.TriangleFanDrawMode );

						}

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

						mesh = new THREE.LineSegments( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_STRIP ) {

						mesh = new THREE.Line( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_LOOP ) {

						mesh = new THREE.LineLoop( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.POINTS ) {

						mesh = new THREE.Points( geometry, material );

					} else {

						throw new Error( 'THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode );

					}

					if ( Object.keys( mesh.geometry.morphAttributes ).length > 0 ) {

						updateMorphTargets( mesh, meshDef );

					}

					mesh.name = parser.createUniqueName( meshDef.name || 'mesh_' + meshIndex );
					assignExtrasToUserData( mesh, meshDef );
					if ( primitive.extensions ) addUnknownExtensionsToUserData( extensions, mesh, primitive );
					parser.assignFinalMaterial( mesh );
					meshes.push( mesh );

				}

				if ( meshes.length === 1 ) {

					return meshes[ 0 ];

				}

				const group = new THREE.Group();

				for ( let i = 0, il = meshes.length; i < il; i ++ ) {

					group.add( meshes[ i ] );

				}

				return group;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
   * @param {number} cameraIndex
   * @return {Promise<THREE.Camera>}
   */


		loadCamera( cameraIndex ) {

			let camera;
			const cameraDef = this.json.cameras[ cameraIndex ];
			const params = cameraDef[ cameraDef.type ];

			if ( ! params ) {

				console.warn( 'THREE.GLTFLoader: Missing camera parameters.' );
				return;

			}

			if ( cameraDef.type === 'perspective' ) {

				camera = new THREE.PerspectiveCamera( THREE.MathUtils.radToDeg( params.yfov ), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6 );

			} else if ( cameraDef.type === 'orthographic' ) {

				camera = new THREE.OrthographicCamera( - params.xmag, params.xmag, params.ymag, - params.ymag, params.znear, params.zfar );

			}

			if ( cameraDef.name ) camera.name = this.createUniqueName( cameraDef.name );
			assignExtrasToUserData( camera, cameraDef );
			return Promise.resolve( camera );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
   * @param {number} skinIndex
   * @return {Promise<Object>}
   */


		loadSkin( skinIndex ) {

			const skinDef = this.json.skins[ skinIndex ];
			const skinEntry = {
				joints: skinDef.joints
			};

			if ( skinDef.inverseBindMatrices === undefined ) {

				return Promise.resolve( skinEntry );

			}

			return this.getDependency( 'accessor', skinDef.inverseBindMatrices ).then( function ( accessor ) {

				skinEntry.inverseBindMatrices = accessor;
				return skinEntry;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
   * @param {number} animationIndex
   * @return {Promise<AnimationClip>}
   */


		loadAnimation( animationIndex ) {

			const json = this.json;
			const animationDef = json.animations[ animationIndex ];
			const pendingNodes = [];
			const pendingInputAccessors = [];
			const pendingOutputAccessors = [];
			const pendingSamplers = [];
			const pendingTargets = [];

			for ( let i = 0, il = animationDef.channels.length; i < il; i ++ ) {

				const channel = animationDef.channels[ i ];
				const sampler = animationDef.samplers[ channel.sampler ];
				const target = channel.target;
				const name = target.node !== undefined ? target.node : target.id; // NOTE: target.id is deprecated.

				const input = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.input ] : sampler.input;
				const output = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.output ] : sampler.output;
				pendingNodes.push( this.getDependency( 'node', name ) );
				pendingInputAccessors.push( this.getDependency( 'accessor', input ) );
				pendingOutputAccessors.push( this.getDependency( 'accessor', output ) );
				pendingSamplers.push( sampler );
				pendingTargets.push( target );

			}

			return Promise.all( [ Promise.all( pendingNodes ), Promise.all( pendingInputAccessors ), Promise.all( pendingOutputAccessors ), Promise.all( pendingSamplers ), Promise.all( pendingTargets ) ] ).then( function ( dependencies ) {

				const nodes = dependencies[ 0 ];
				const inputAccessors = dependencies[ 1 ];
				const outputAccessors = dependencies[ 2 ];
				const samplers = dependencies[ 3 ];
				const targets = dependencies[ 4 ];
				const tracks = [];

				for ( let i = 0, il = nodes.length; i < il; i ++ ) {

					const node = nodes[ i ];
					const inputAccessor = inputAccessors[ i ];
					const outputAccessor = outputAccessors[ i ];
					const sampler = samplers[ i ];
					const target = targets[ i ];
					if ( node === undefined ) continue;
					node.updateMatrix();
					node.matrixAutoUpdate = true;
					let TypedKeyframeTrack;

					switch ( PATH_PROPERTIES[ target.path ] ) {

						case PATH_PROPERTIES.weights:
							TypedKeyframeTrack = THREE.NumberKeyframeTrack;
							break;

						case PATH_PROPERTIES.rotation:
							TypedKeyframeTrack = THREE.QuaternionKeyframeTrack;
							break;

						case PATH_PROPERTIES.position:
						case PATH_PROPERTIES.scale:
						default:
							TypedKeyframeTrack = THREE.VectorKeyframeTrack;
							break;

					}

					const targetName = node.name ? node.name : node.uuid;
					const interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : THREE.InterpolateLinear;
					const targetNames = [];

					if ( PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.weights ) {

						// Node may be a THREE.Group (glTF mesh with several primitives) or a THREE.Mesh.
						node.traverse( function ( object ) {

							if ( object.isMesh === true && object.morphTargetInfluences ) {

								targetNames.push( object.name ? object.name : object.uuid );

							}

						} );

					} else {

						targetNames.push( targetName );

					}

					let outputArray = outputAccessor.array;

					if ( outputAccessor.normalized ) {

						const scale = getNormalizedComponentScale( outputArray.constructor );
						const scaled = new Float32Array( outputArray.length );

						for ( let j = 0, jl = outputArray.length; j < jl; j ++ ) {

							scaled[ j ] = outputArray[ j ] * scale;

						}

						outputArray = scaled;

					}

					for ( let j = 0, jl = targetNames.length; j < jl; j ++ ) {

						const track = new TypedKeyframeTrack( targetNames[ j ] + '.' + PATH_PROPERTIES[ target.path ], inputAccessor.array, outputArray, interpolation ); // Override interpolation with custom factory method.

						if ( sampler.interpolation === 'CUBICSPLINE' ) {

							track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline( result ) {

								// A CUBICSPLINE keyframe in glTF has three output values for each input value,
								// representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
								// must be divided by three to get the interpolant's sampleSize argument.
								return new GLTFCubicSplineInterpolant( this.times, this.values, this.getValueSize() / 3, result );

							}; // Mark as CUBICSPLINE. `track.getInterpolation()` doesn't support custom interpolants.


							track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;

						}

						tracks.push( track );

					}

				}

				const name = animationDef.name ? animationDef.name : 'animation_' + animationIndex;
				return new THREE.AnimationClip( name, undefined, tracks );

			} );

		}

		createNodeMesh( nodeIndex ) {

			const json = this.json;
			const parser = this;
			const nodeDef = json.nodes[ nodeIndex ];
			if ( nodeDef.mesh === undefined ) return null;
			return parser.getDependency( 'mesh', nodeDef.mesh ).then( function ( mesh ) {

				const node = parser._getNodeRef( parser.meshCache, nodeDef.mesh, mesh ); // if weights are provided on the node, override weights on the mesh.


				if ( nodeDef.weights !== undefined ) {

					node.traverse( function ( o ) {

						if ( ! o.isMesh ) return;

						for ( let i = 0, il = nodeDef.weights.length; i < il; i ++ ) {

							o.morphTargetInfluences[ i ] = nodeDef.weights[ i ];

						}

					} );

				}

				return node;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
   * @param {number} nodeIndex
   * @return {Promise<Object3D>}
   */


		loadNode( nodeIndex ) {

			const json = this.json;
			const extensions = this.extensions;
			const parser = this;
			const nodeDef = json.nodes[ nodeIndex ]; // reserve node's name before its dependencies, so the root has the intended name.

			const nodeName = nodeDef.name ? parser.createUniqueName( nodeDef.name ) : '';
			return function () {

				const pending = [];

				const meshPromise = parser._invokeOne( function ( ext ) {

					return ext.createNodeMesh && ext.createNodeMesh( nodeIndex );

				} );

				if ( meshPromise ) {

					pending.push( meshPromise );

				}

				if ( nodeDef.camera !== undefined ) {

					pending.push( parser.getDependency( 'camera', nodeDef.camera ).then( function ( camera ) {

						return parser._getNodeRef( parser.cameraCache, nodeDef.camera, camera );

					} ) );

				}

				parser._invokeAll( function ( ext ) {

					return ext.createNodeAttachment && ext.createNodeAttachment( nodeIndex );

				} ).forEach( function ( promise ) {

					pending.push( promise );

				} );

				return Promise.all( pending );

			}().then( function ( objects ) {

				let node; // .isBone isn't in glTF spec. See ._markDefs

				if ( nodeDef.isBone === true ) {

					node = new THREE.Bone();

				} else if ( objects.length > 1 ) {

					node = new THREE.Group();

				} else if ( objects.length === 1 ) {

					node = objects[ 0 ];

				} else {

					node = new THREE.Object3D();

				}

				if ( node !== objects[ 0 ] ) {

					for ( let i = 0, il = objects.length; i < il; i ++ ) {

						node.add( objects[ i ] );

					}

				}

				if ( nodeDef.name ) {

					node.userData.name = nodeDef.name;
					node.name = nodeName;

				}

				assignExtrasToUserData( node, nodeDef );
				if ( nodeDef.extensions ) addUnknownExtensionsToUserData( extensions, node, nodeDef );

				if ( nodeDef.matrix !== undefined ) {

					const matrix = new THREE.Matrix4();
					matrix.fromArray( nodeDef.matrix );
					node.applyMatrix4( matrix );

				} else {

					if ( nodeDef.translation !== undefined ) {

						node.position.fromArray( nodeDef.translation );

					}

					if ( nodeDef.rotation !== undefined ) {

						node.quaternion.fromArray( nodeDef.rotation );

					}

					if ( nodeDef.scale !== undefined ) {

						node.scale.fromArray( nodeDef.scale );

					}

				}

				parser.associations.set( node, {
					type: 'nodes',
					index: nodeIndex
				} );
				return node;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
   * @param {number} sceneIndex
   * @return {Promise<Group>}
   */


		loadScene( sceneIndex ) {

			const json = this.json;
			const extensions = this.extensions;
			const sceneDef = this.json.scenes[ sceneIndex ];
			const parser = this; // THREE.Loader returns THREE.Group, not Scene.
			// See: https://github.com/mrdoob/three.js/issues/18342#issuecomment-578981172

			const scene = new THREE.Group();
			if ( sceneDef.name ) scene.name = parser.createUniqueName( sceneDef.name );
			assignExtrasToUserData( scene, sceneDef );
			if ( sceneDef.extensions ) addUnknownExtensionsToUserData( extensions, scene, sceneDef );
			const nodeIds = sceneDef.nodes || [];
			const pending = [];

			for ( let i = 0, il = nodeIds.length; i < il; i ++ ) {

				pending.push( buildNodeHierachy( nodeIds[ i ], scene, json, parser ) );

			}

			return Promise.all( pending ).then( function () {

				return scene;

			} );

		}

	}

	function buildNodeHierachy( nodeId, parentObject, json, parser ) {

		const nodeDef = json.nodes[ nodeId ];
		return parser.getDependency( 'node', nodeId ).then( function ( node ) {

			if ( nodeDef.skin === undefined ) return node; // build skeleton here as well

			let skinEntry;
			return parser.getDependency( 'skin', nodeDef.skin ).then( function ( skin ) {

				skinEntry = skin;
				const pendingJoints = [];

				for ( let i = 0, il = skinEntry.joints.length; i < il; i ++ ) {

					pendingJoints.push( parser.getDependency( 'node', skinEntry.joints[ i ] ) );

				}

				return Promise.all( pendingJoints );

			} ).then( function ( jointNodes ) {

				node.traverse( function ( mesh ) {

					if ( ! mesh.isMesh ) return;
					const bones = [];
					const boneInverses = [];

					for ( let j = 0, jl = jointNodes.length; j < jl; j ++ ) {

						const jointNode = jointNodes[ j ];

						if ( jointNode ) {

							bones.push( jointNode );
							const mat = new THREE.Matrix4();

							if ( skinEntry.inverseBindMatrices !== undefined ) {

								mat.fromArray( skinEntry.inverseBindMatrices.array, j * 16 );

							}

							boneInverses.push( mat );

						} else {

							console.warn( 'THREE.GLTFLoader: Joint "%s" could not be found.', skinEntry.joints[ j ] );

						}

					}

					mesh.bind( new THREE.Skeleton( bones, boneInverses ), mesh.matrixWorld );

				} );
				return node;

			} );

		} ).then( function ( node ) {

			// build node hierachy
			parentObject.add( node );
			const pending = [];

			if ( nodeDef.children ) {

				const children = nodeDef.children;

				for ( let i = 0, il = children.length; i < il; i ++ ) {

					const child = children[ i ];
					pending.push( buildNodeHierachy( child, node, json, parser ) );

				}

			}

			return Promise.all( pending );

		} );

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {GLTF.Primitive} primitiveDef
 * @param {GLTFParser} parser
 */


	function computeBounds( geometry, primitiveDef, parser ) {

		const attributes = primitiveDef.attributes;
		const box = new THREE.Box3();

		if ( attributes.POSITION !== undefined ) {

			const accessor = parser.json.accessors[ attributes.POSITION ];
			const min = accessor.min;
			const max = accessor.max; // glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

			if ( min !== undefined && max !== undefined ) {

				box.set( new THREE.Vector3( min[ 0 ], min[ 1 ], min[ 2 ] ), new THREE.Vector3( max[ 0 ], max[ 1 ], max[ 2 ] ) );

				if ( accessor.normalized ) {

					const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
					box.min.multiplyScalar( boxScale );
					box.max.multiplyScalar( boxScale );

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );
				return;

			}

		} else {

			return;

		}

		const targets = primitiveDef.targets;

		if ( targets !== undefined ) {

			const maxDisplacement = new THREE.Vector3();
			const vector = new THREE.Vector3();

			for ( let i = 0, il = targets.length; i < il; i ++ ) {

				const target = targets[ i ];

				if ( target.POSITION !== undefined ) {

					const accessor = parser.json.accessors[ target.POSITION ];
					const min = accessor.min;
					const max = accessor.max; // glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

					if ( min !== undefined && max !== undefined ) {

						// we need to get max of absolute components because target weight is [-1,1]
						vector.setX( Math.max( Math.abs( min[ 0 ] ), Math.abs( max[ 0 ] ) ) );
						vector.setY( Math.max( Math.abs( min[ 1 ] ), Math.abs( max[ 1 ] ) ) );
						vector.setZ( Math.max( Math.abs( min[ 2 ] ), Math.abs( max[ 2 ] ) ) );

						if ( accessor.normalized ) {

							const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
							vector.multiplyScalar( boxScale );

						} // Note: this assumes that the sum of all weights is at most 1. This isn't quite correct - it's more conservative
						// to assume that each target can have a max weight of 1. However, for some use cases - notably, when morph targets
						// are used to implement key-frame animations and as such only two are active at a time - this results in very large
						// boxes. So for now we make a box that's sometimes a touch too small but is hopefully mostly of reasonable size.


						maxDisplacement.max( vector );

					} else {

						console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

					}

				}

			} // As per comment above this box isn't conservative, but has a reasonable size for a very large number of morph targets.


			box.expandByVector( maxDisplacement );

		}

		geometry.boundingBox = box;
		const sphere = new THREE.Sphere();
		box.getCenter( sphere.center );
		sphere.radius = box.min.distanceTo( box.max ) / 2;
		geometry.boundingSphere = sphere;

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {GLTF.Primitive} primitiveDef
 * @param {GLTFParser} parser
 * @return {Promise<BufferGeometry>}
 */


	function addPrimitiveAttributes( geometry, primitiveDef, parser ) {

		const attributes = primitiveDef.attributes;
		const pending = [];

		function assignAttributeAccessor( accessorIndex, attributeName ) {

			return parser.getDependency( 'accessor', accessorIndex ).then( function ( accessor ) {

				geometry.setAttribute( attributeName, accessor );

			} );

		}

		for ( const gltfAttributeName in attributes ) {

			const threeAttributeName = ATTRIBUTES[ gltfAttributeName ] || gltfAttributeName.toLowerCase(); // Skip attributes already provided by e.g. Draco extension.

			if ( threeAttributeName in geometry.attributes ) continue;
			pending.push( assignAttributeAccessor( attributes[ gltfAttributeName ], threeAttributeName ) );

		}

		if ( primitiveDef.indices !== undefined && ! geometry.index ) {

			const accessor = parser.getDependency( 'accessor', primitiveDef.indices ).then( function ( accessor ) {

				geometry.setIndex( accessor );

			} );
			pending.push( accessor );

		}

		assignExtrasToUserData( geometry, primitiveDef );
		computeBounds( geometry, primitiveDef, parser );
		return Promise.all( pending ).then( function () {

			return primitiveDef.targets !== undefined ? addMorphTargets( geometry, primitiveDef.targets, parser ) : geometry;

		} );

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {Number} drawMode
 * @return {BufferGeometry}
 */


	function toTrianglesDrawMode( geometry, drawMode ) {

		let index = geometry.getIndex(); // generate index if not present

		if ( index === null ) {

			const indices = [];
			const position = geometry.getAttribute( 'position' );

			if ( position !== undefined ) {

				for ( let i = 0; i < position.count; i ++ ) {

					indices.push( i );

				}

				geometry.setIndex( indices );
				index = geometry.getIndex();

			} else {

				console.error( 'THREE.GLTFLoader.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.' );
				return geometry;

			}

		} //


		const numberOfTriangles = index.count - 2;
		const newIndices = [];

		if ( drawMode === THREE.TriangleFanDrawMode ) {

			// gl.TRIANGLE_FAN
			for ( let i = 1; i <= numberOfTriangles; i ++ ) {

				newIndices.push( index.getX( 0 ) );
				newIndices.push( index.getX( i ) );
				newIndices.push( index.getX( i + 1 ) );

			}

		} else {

			// gl.TRIANGLE_STRIP
			for ( let i = 0; i < numberOfTriangles; i ++ ) {

				if ( i % 2 === 0 ) {

					newIndices.push( index.getX( i ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i + 2 ) );

				} else {

					newIndices.push( index.getX( i + 2 ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i ) );

				}

			}

		}

		if ( newIndices.length / 3 !== numberOfTriangles ) {

			console.error( 'THREE.GLTFLoader.toTrianglesDrawMode(): Unable to generate correct amount of triangles.' );

		} // build final geometry


		const newGeometry = geometry.clone();
		newGeometry.setIndex( newIndices );
		return newGeometry;

	}

	THREE.GLTFLoader = GLTFLoader;

} )();

// ---- SkeletonUtils.js
( function () {

	class SkeletonUtils {

		static retarget( target, source, options = {} ) {

			const pos = new THREE.Vector3(),
				quat = new THREE.Quaternion(),
				scale = new THREE.Vector3(),
				bindBoneMatrix = new THREE.Matrix4(),
				relativeMatrix = new THREE.Matrix4(),
				globalMatrix = new THREE.Matrix4();
			options.preserveMatrix = options.preserveMatrix !== undefined ? options.preserveMatrix : true;
			options.preservePosition = options.preservePosition !== undefined ? options.preservePosition : true;
			options.preserveHipPosition = options.preserveHipPosition !== undefined ? options.preserveHipPosition : false;
			options.useTargetMatrix = options.useTargetMatrix !== undefined ? options.useTargetMatrix : false;
			options.hip = options.hip !== undefined ? options.hip : 'hip';
			options.names = options.names || {};
			const sourceBones = source.isObject3D ? source.skeleton.bones : this.getBones( source ),
				bones = target.isObject3D ? target.skeleton.bones : this.getBones( target );
			let bindBones, bone, name, boneTo, bonesPosition; // reset bones

			if ( target.isObject3D ) {

				target.skeleton.pose();

			} else {

				options.useTargetMatrix = true;
				options.preserveMatrix = false;

			}

			if ( options.preservePosition ) {

				bonesPosition = [];

				for ( let i = 0; i < bones.length; i ++ ) {

					bonesPosition.push( bones[ i ].position.clone() );

				}

			}

			if ( options.preserveMatrix ) {

				// reset matrix
				target.updateMatrixWorld();
				target.matrixWorld.identity(); // reset children matrix

				for ( let i = 0; i < target.children.length; ++ i ) {

					target.children[ i ].updateMatrixWorld( true );

				}

			}

			if ( options.offsets ) {

				bindBones = [];

				for ( let i = 0; i < bones.length; ++ i ) {

					bone = bones[ i ];
					name = options.names[ bone.name ] || bone.name;

					if ( options.offsets && options.offsets[ name ] ) {

						bone.matrix.multiply( options.offsets[ name ] );
						bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
						bone.updateMatrixWorld();

					}

					bindBones.push( bone.matrixWorld.clone() );

				}

			}

			for ( let i = 0; i < bones.length; ++ i ) {

				bone = bones[ i ];
				name = options.names[ bone.name ] || bone.name;
				boneTo = this.getBoneByName( name, sourceBones );
				globalMatrix.copy( bone.matrixWorld );

				if ( boneTo ) {

					boneTo.updateMatrixWorld();

					if ( options.useTargetMatrix ) {

						relativeMatrix.copy( boneTo.matrixWorld );

					} else {

						relativeMatrix.copy( target.matrixWorld ).invert();
						relativeMatrix.multiply( boneTo.matrixWorld );

					} // ignore scale to extract rotation


					scale.setFromMatrixScale( relativeMatrix );
					relativeMatrix.scale( scale.set( 1 / scale.x, 1 / scale.y, 1 / scale.z ) ); // apply to global matrix

					globalMatrix.makeRotationFromQuaternion( quat.setFromRotationMatrix( relativeMatrix ) );

					if ( target.isObject3D ) {

						const boneIndex = bones.indexOf( bone ),
							wBindMatrix = bindBones ? bindBones[ boneIndex ] : bindBoneMatrix.copy( target.skeleton.boneInverses[ boneIndex ] ).invert();
						globalMatrix.multiply( wBindMatrix );

					}

					globalMatrix.copyPosition( relativeMatrix );

				}

				if ( bone.parent && bone.parent.isBone ) {

					bone.matrix.copy( bone.parent.matrixWorld ).invert();
					bone.matrix.multiply( globalMatrix );

				} else {

					bone.matrix.copy( globalMatrix );

				}

				if ( options.preserveHipPosition && name === options.hip ) {

					bone.matrix.setPosition( pos.set( 0, bone.position.y, 0 ) );

				}

				bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
				bone.updateMatrixWorld();

			}

			if ( options.preservePosition ) {

				for ( let i = 0; i < bones.length; ++ i ) {

					bone = bones[ i ];
					name = options.names[ bone.name ] || bone.name;

					if ( name !== options.hip ) {

						bone.position.copy( bonesPosition[ i ] );

					}

				}

			}

			if ( options.preserveMatrix ) {

				// restore matrix
				target.updateMatrixWorld( true );

			}

		}

		static retargetClip( target, source, clip, options = {} ) {

			options.useFirstFramePosition = options.useFirstFramePosition !== undefined ? options.useFirstFramePosition : false;
			options.fps = options.fps !== undefined ? options.fps : 30;
			options.names = options.names || [];

			if ( ! source.isObject3D ) {

				source = this.getHelperFromSkeleton( source );

			}

			const numFrames = Math.round( clip.duration * ( options.fps / 1000 ) * 1000 ),
				delta = 1 / options.fps,
				convertedTracks = [],
				mixer = new THREE.AnimationMixer( source ),
				bones = this.getBones( target.skeleton ),
				boneDatas = [];
			let positionOffset, bone, boneTo, boneData, name;
			mixer.clipAction( clip ).play();
			mixer.update( 0 );
			source.updateMatrixWorld();

			for ( let i = 0; i < numFrames; ++ i ) {

				const time = i * delta;
				this.retarget( target, source, options );

				for ( let j = 0; j < bones.length; ++ j ) {

					name = options.names[ bones[ j ].name ] || bones[ j ].name;
					boneTo = this.getBoneByName( name, source.skeleton );

					if ( boneTo ) {

						bone = bones[ j ];
						boneData = boneDatas[ j ] = boneDatas[ j ] || {
							bone: bone
						};

						if ( options.hip === name ) {

							if ( ! boneData.pos ) {

								boneData.pos = {
									times: new Float32Array( numFrames ),
									values: new Float32Array( numFrames * 3 )
								};

							}

							if ( options.useFirstFramePosition ) {

								if ( i === 0 ) {

									positionOffset = bone.position.clone();

								}

								bone.position.sub( positionOffset );

							}

							boneData.pos.times[ i ] = time;
							bone.position.toArray( boneData.pos.values, i * 3 );

						}

						if ( ! boneData.quat ) {

							boneData.quat = {
								times: new Float32Array( numFrames ),
								values: new Float32Array( numFrames * 4 )
							};

						}

						boneData.quat.times[ i ] = time;
						bone.quaternion.toArray( boneData.quat.values, i * 4 );

					}

				}

				mixer.update( delta );
				source.updateMatrixWorld();

			}

			for ( let i = 0; i < boneDatas.length; ++ i ) {

				boneData = boneDatas[ i ];

				if ( boneData ) {

					if ( boneData.pos ) {

						convertedTracks.push( new THREE.VectorKeyframeTrack( '.bones[' + boneData.bone.name + '].position', boneData.pos.times, boneData.pos.values ) );

					}

					convertedTracks.push( new THREE.QuaternionKeyframeTrack( '.bones[' + boneData.bone.name + '].quaternion', boneData.quat.times, boneData.quat.values ) );

				}

			}

			mixer.uncacheAction( clip );
			return new THREE.AnimationClip( clip.name, - 1, convertedTracks );

		}

		static getHelperFromSkeleton( skeleton ) {

			const source = new THREE.SkeletonHelper( skeleton.bones[ 0 ] );
			source.skeleton = skeleton;
			return source;

		}

		static getSkeletonOffsets( target, source, options = {} ) {

			const targetParentPos = new THREE.Vector3(),
				targetPos = new THREE.Vector3(),
				sourceParentPos = new THREE.Vector3(),
				sourcePos = new THREE.Vector3(),
				targetDir = new THREE.Vector2(),
				sourceDir = new THREE.Vector2();
			options.hip = options.hip !== undefined ? options.hip : 'hip';
			options.names = options.names || {};

			if ( ! source.isObject3D ) {

				source = this.getHelperFromSkeleton( source );

			}

			const nameKeys = Object.keys( options.names ),
				nameValues = Object.values( options.names ),
				sourceBones = source.isObject3D ? source.skeleton.bones : this.getBones( source ),
				bones = target.isObject3D ? target.skeleton.bones : this.getBones( target ),
				offsets = [];
			let bone, boneTo, name, i;
			target.skeleton.pose();

			for ( i = 0; i < bones.length; ++ i ) {

				bone = bones[ i ];
				name = options.names[ bone.name ] || bone.name;
				boneTo = this.getBoneByName( name, sourceBones );

				if ( boneTo && name !== options.hip ) {

					const boneParent = this.getNearestBone( bone.parent, nameKeys ),
						boneToParent = this.getNearestBone( boneTo.parent, nameValues );
					boneParent.updateMatrixWorld();
					boneToParent.updateMatrixWorld();
					targetParentPos.setFromMatrixPosition( boneParent.matrixWorld );
					targetPos.setFromMatrixPosition( bone.matrixWorld );
					sourceParentPos.setFromMatrixPosition( boneToParent.matrixWorld );
					sourcePos.setFromMatrixPosition( boneTo.matrixWorld );
					targetDir.subVectors( new THREE.Vector2( targetPos.x, targetPos.y ), new THREE.Vector2( targetParentPos.x, targetParentPos.y ) ).normalize();
					sourceDir.subVectors( new THREE.Vector2( sourcePos.x, sourcePos.y ), new THREE.Vector2( sourceParentPos.x, sourceParentPos.y ) ).normalize();
					const laterialAngle = targetDir.angle() - sourceDir.angle();
					const offset = new THREE.Matrix4().makeRotationFromEuler( new THREE.Euler( 0, 0, laterialAngle ) );
					bone.matrix.multiply( offset );
					bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
					bone.updateMatrixWorld();
					offsets[ name ] = offset;

				}

			}

			return offsets;

		}

		static renameBones( skeleton, names ) {

			const bones = this.getBones( skeleton );

			for ( let i = 0; i < bones.length; ++ i ) {

				const bone = bones[ i ];

				if ( names[ bone.name ] ) {

					bone.name = names[ bone.name ];

				}

			}

			return this;

		}

		static getBones( skeleton ) {

			return Array.isArray( skeleton ) ? skeleton : skeleton.bones;

		}

		static getBoneByName( name, skeleton ) {

			for ( let i = 0, bones = this.getBones( skeleton ); i < bones.length; i ++ ) {

				if ( name === bones[ i ].name ) return bones[ i ];

			}

		}

		static getNearestBone( bone, names ) {

			while ( bone.isBone ) {

				if ( names.indexOf( bone.name ) !== - 1 ) {

					return bone;

				}

				bone = bone.parent;

			}

		}

		static findBoneTrackData( name, tracks ) {

			const regexp = /\[(.*)\]\.(.*)/,
				result = {
					name: name
				};

			for ( let i = 0; i < tracks.length; ++ i ) {

				// 1 is track name
				// 2 is track type
				const trackData = regexp.exec( tracks[ i ].name );

				if ( trackData && name === trackData[ 1 ] ) {

					result[ trackData[ 2 ] ] = i;

				}

			}

			return result;

		}

		static getEqualsBonesNames( skeleton, targetSkeleton ) {

			const sourceBones = this.getBones( skeleton ),
				targetBones = this.getBones( targetSkeleton ),
				bones = [];

			search: for ( let i = 0; i < sourceBones.length; i ++ ) {

				const boneName = sourceBones[ i ].name;

				for ( let j = 0; j < targetBones.length; j ++ ) {

					if ( boneName === targetBones[ j ].name ) {

						bones.push( boneName );
						continue search;

					}

				}

			}

			return bones;

		}

		static clone( source ) {

			const sourceLookup = new Map();
			const cloneLookup = new Map();
			const clone = source.clone();
			parallelTraverse( source, clone, function ( sourceNode, clonedNode ) {

				sourceLookup.set( clonedNode, sourceNode );
				cloneLookup.set( sourceNode, clonedNode );

			} );
			clone.traverse( function ( node ) {

				if ( ! node.isSkinnedMesh ) return;
				const clonedMesh = node;
				const sourceMesh = sourceLookup.get( node );
				const sourceBones = sourceMesh.skeleton.bones;
				clonedMesh.skeleton = sourceMesh.skeleton.clone();
				clonedMesh.bindMatrix.copy( sourceMesh.bindMatrix );
				clonedMesh.skeleton.bones = sourceBones.map( function ( bone ) {

					return cloneLookup.get( bone );

				} );
				clonedMesh.bind( clonedMesh.skeleton, clonedMesh.bindMatrix );

			} );
			return clone;

		}

	}

	function parallelTraverse( a, b, callback ) {

		callback( a, b );

		for ( let i = 0; i < a.children.length; i ++ ) {

			parallelTraverse( a.children[ i ], b.children[ i ], callback );

		}

	}

	THREE.SkeletonUtils = SkeletonUtils;

} )();

// ---- TransformControls.js
( function () {

	const _raycaster = new THREE.Raycaster();

	const _tempVector = new THREE.Vector3();

	const _tempVector2 = new THREE.Vector3();

	const _tempQuaternion = new THREE.Quaternion();

	const _unit = {
		X: new THREE.Vector3( 1, 0, 0 ),
		Y: new THREE.Vector3( 0, 1, 0 ),
		Z: new THREE.Vector3( 0, 0, 1 )
	};
	const _changeEvent = {
		type: 'change'
	};
	const _mouseDownEvent = {
		type: 'mouseDown'
	};
	const _mouseUpEvent = {
		type: 'mouseUp',
		mode: null
	};
	const _objectChangeEvent = {
		type: 'objectChange'
	};

	class TransformControls extends THREE.Object3D {

		constructor( camera, domElement ) {

			super();

			if ( domElement === undefined ) {

				console.warn( 'THREE.TransformControls: The second parameter "domElement" is now mandatory.' );
				domElement = document;

			}

			this.visible = false;
			this.domElement = domElement;

			const _gizmo = new TransformControlsGizmo();

			this._gizmo = _gizmo;
			this.add( _gizmo );

			const _plane = new TransformControlsPlane();

			this._plane = _plane;
			this.add( _plane );
			const scope = this; // Defined getter, setter and store for a property

			function defineProperty( propName, defaultValue ) {

				let propValue = defaultValue;
				Object.defineProperty( scope, propName, {
					get: function () {

						return propValue !== undefined ? propValue : defaultValue;

					},
					set: function ( value ) {

						if ( propValue !== value ) {

							propValue = value;
							_plane[ propName ] = value;
							_gizmo[ propName ] = value;
							scope.dispatchEvent( {
								type: propName + '-changed',
								value: value
							} );
							scope.dispatchEvent( _changeEvent );

						}

					}
				} );
				scope[ propName ] = defaultValue;
				_plane[ propName ] = defaultValue;
				_gizmo[ propName ] = defaultValue;

			} // Define properties with getters/setter
			// Setting the defined property will automatically trigger change event
			// Defined properties are passed down to gizmo and plane


			defineProperty( 'camera', camera );
			defineProperty( 'object', undefined );
			defineProperty( 'enabled', true );
			defineProperty( 'axis', null );
			defineProperty( 'mode', 'translate' );
			defineProperty( 'translationSnap', null );
			defineProperty( 'rotationSnap', null );
			defineProperty( 'scaleSnap', null );
			defineProperty( 'space', 'world' );
			defineProperty( 'size', 1 );
			defineProperty( 'dragging', false );
			defineProperty( 'showX', true );
			defineProperty( 'showY', true );
			defineProperty( 'showZ', true ); // Reusable utility variables

			const worldPosition = new THREE.Vector3();
			const worldPositionStart = new THREE.Vector3();
			const worldQuaternion = new THREE.Quaternion();
			const worldQuaternionStart = new THREE.Quaternion();
			const cameraPosition = new THREE.Vector3();
			const cameraQuaternion = new THREE.Quaternion();
			const pointStart = new THREE.Vector3();
			const pointEnd = new THREE.Vector3();
			const rotationAxis = new THREE.Vector3();
			const rotationAngle = 0;
			const eye = new THREE.Vector3(); // TODO: remove properties unused in plane and gizmo

			defineProperty( 'worldPosition', worldPosition );
			defineProperty( 'worldPositionStart', worldPositionStart );
			defineProperty( 'worldQuaternion', worldQuaternion );
			defineProperty( 'worldQuaternionStart', worldQuaternionStart );
			defineProperty( 'cameraPosition', cameraPosition );
			defineProperty( 'cameraQuaternion', cameraQuaternion );
			defineProperty( 'pointStart', pointStart );
			defineProperty( 'pointEnd', pointEnd );
			defineProperty( 'rotationAxis', rotationAxis );
			defineProperty( 'rotationAngle', rotationAngle );
			defineProperty( 'eye', eye );
			this._offset = new THREE.Vector3();
			this._startNorm = new THREE.Vector3();
			this._endNorm = new THREE.Vector3();
			this._cameraScale = new THREE.Vector3();
			this._parentPosition = new THREE.Vector3();
			this._parentQuaternion = new THREE.Quaternion();
			this._parentQuaternionInv = new THREE.Quaternion();
			this._parentScale = new THREE.Vector3();
			this._worldScaleStart = new THREE.Vector3();
			this._worldQuaternionInv = new THREE.Quaternion();
			this._worldScale = new THREE.Vector3();
			this._positionStart = new THREE.Vector3();
			this._quaternionStart = new THREE.Quaternion();
			this._scaleStart = new THREE.Vector3();
			this._getPointer = getPointer.bind( this );
			this._onPointerDown = onPointerDown.bind( this );
			this._onPointerHover = onPointerHover.bind( this );
			this._onPointerMove = onPointerMove.bind( this );
			this._onPointerUp = onPointerUp.bind( this );
			this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
			this.domElement.addEventListener( 'pointermove', this._onPointerHover );
			this.domElement.ownerDocument.addEventListener( 'pointerup', this._onPointerUp );

		} // updateMatrixWorld  updates key transformation variables


		updateMatrixWorld() {

			if ( this.object !== undefined ) {

				this.object.updateMatrixWorld();

				if ( this.object.parent === null ) {

					console.error( 'TransformControls: The attached 3D object must be a part of the scene graph.' );

				} else {

					this.object.parent.matrixWorld.decompose( this._parentPosition, this._parentQuaternion, this._parentScale );

				}

				this.object.matrixWorld.decompose( this.worldPosition, this.worldQuaternion, this._worldScale );

				this._parentQuaternionInv.copy( this._parentQuaternion ).invert();

				this._worldQuaternionInv.copy( this.worldQuaternion ).invert();

			}

			this.camera.updateMatrixWorld();
			this.camera.matrixWorld.decompose( this.cameraPosition, this.cameraQuaternion, this._cameraScale );
			this.eye.copy( this.cameraPosition ).sub( this.worldPosition ).normalize();
			super.updateMatrixWorld( this );

		}

		pointerHover( pointer ) {

			if ( this.object === undefined || this.dragging === true ) return;

			_raycaster.setFromCamera( pointer, this.camera );

			const intersect = intersectObjectWithRay( this._gizmo.picker[ this.mode ], _raycaster );

			if ( intersect ) {

				this.axis = intersect.object.name;

			} else {

				this.axis = null;

			}

		}

		pointerDown( pointer ) {

			if ( this.object === undefined || this.dragging === true || pointer.button !== 0 ) return;

			if ( this.axis !== null ) {

				_raycaster.setFromCamera( pointer, this.camera );

				const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );

				if ( planeIntersect ) {

					let space = this.space;

					if ( this.mode === 'scale' ) {

						space = 'local';

					} else if ( this.axis === 'E' || this.axis === 'XYZE' || this.axis === 'XYZ' ) {

						space = 'world';

					}

					if ( space === 'local' && this.mode === 'rotate' ) {

						const snap = this.rotationSnap;
						if ( this.axis === 'X' && snap ) this.object.rotation.x = Math.round( this.object.rotation.x / snap ) * snap;
						if ( this.axis === 'Y' && snap ) this.object.rotation.y = Math.round( this.object.rotation.y / snap ) * snap;
						if ( this.axis === 'Z' && snap ) this.object.rotation.z = Math.round( this.object.rotation.z / snap ) * snap;

					}

					this.object.updateMatrixWorld();
					this.object.parent.updateMatrixWorld();

					this._positionStart.copy( this.object.position );

					this._quaternionStart.copy( this.object.quaternion );

					this._scaleStart.copy( this.object.scale );

					this.object.matrixWorld.decompose( this.worldPositionStart, this.worldQuaternionStart, this._worldScaleStart );
					this.pointStart.copy( planeIntersect.point ).sub( this.worldPositionStart );

				}

				this.dragging = true;
				_mouseDownEvent.mode = this.mode;
				this.dispatchEvent( _mouseDownEvent );

			}

		}

		pointerMove( pointer ) {

			const axis = this.axis;
			const mode = this.mode;
			const object = this.object;
			let space = this.space;

			if ( mode === 'scale' ) {

				space = 'local';

			} else if ( axis === 'E' || axis === 'XYZE' || axis === 'XYZ' ) {

				space = 'world';

			}

			if ( object === undefined || axis === null || this.dragging === false || pointer.button !== - 1 ) return;

			_raycaster.setFromCamera( pointer, this.camera );

			const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );
			if ( ! planeIntersect ) return;
			this.pointEnd.copy( planeIntersect.point ).sub( this.worldPositionStart );

			if ( mode === 'translate' ) {

				// Apply translate
				this._offset.copy( this.pointEnd ).sub( this.pointStart );

				if ( space === 'local' && axis !== 'XYZ' ) {

					this._offset.applyQuaternion( this._worldQuaternionInv );

				}

				if ( axis.indexOf( 'X' ) === - 1 ) this._offset.x = 0;
				if ( axis.indexOf( 'Y' ) === - 1 ) this._offset.y = 0;
				if ( axis.indexOf( 'Z' ) === - 1 ) this._offset.z = 0;

				if ( space === 'local' && axis !== 'XYZ' ) {

					this._offset.applyQuaternion( this._quaternionStart ).divide( this._parentScale );

				} else {

					this._offset.applyQuaternion( this._parentQuaternionInv ).divide( this._parentScale );

				}

				object.position.copy( this._offset ).add( this._positionStart ); // Apply translation snap

				if ( this.translationSnap ) {

					if ( space === 'local' ) {

						object.position.applyQuaternion( _tempQuaternion.copy( this._quaternionStart ).invert() );

						if ( axis.search( 'X' ) !== - 1 ) {

							object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Y' ) !== - 1 ) {

							object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Z' ) !== - 1 ) {

							object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

						}

						object.position.applyQuaternion( this._quaternionStart );

					}

					if ( space === 'world' ) {

						if ( object.parent ) {

							object.position.add( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

						}

						if ( axis.search( 'X' ) !== - 1 ) {

							object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Y' ) !== - 1 ) {

							object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Z' ) !== - 1 ) {

							object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

						}

						if ( object.parent ) {

							object.position.sub( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

						}

					}

				}

			} else if ( mode === 'scale' ) {

				if ( axis.search( 'XYZ' ) !== - 1 ) {

					let d = this.pointEnd.length() / this.pointStart.length();
					if ( this.pointEnd.dot( this.pointStart ) < 0 ) d *= - 1;

					_tempVector2.set( d, d, d );

				} else {

					_tempVector.copy( this.pointStart );

					_tempVector2.copy( this.pointEnd );

					_tempVector.applyQuaternion( this._worldQuaternionInv );

					_tempVector2.applyQuaternion( this._worldQuaternionInv );

					_tempVector2.divide( _tempVector );

					if ( axis.search( 'X' ) === - 1 ) {

						_tempVector2.x = 1;

					}

					if ( axis.search( 'Y' ) === - 1 ) {

						_tempVector2.y = 1;

					}

					if ( axis.search( 'Z' ) === - 1 ) {

						_tempVector2.z = 1;

					}

				} // Apply scale


				object.scale.copy( this._scaleStart ).multiply( _tempVector2 );

				if ( this.scaleSnap ) {

					if ( axis.search( 'X' ) !== - 1 ) {

						object.scale.x = Math.round( object.scale.x / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

					}

					if ( axis.search( 'Y' ) !== - 1 ) {

						object.scale.y = Math.round( object.scale.y / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

					}

					if ( axis.search( 'Z' ) !== - 1 ) {

						object.scale.z = Math.round( object.scale.z / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

					}

				}

			} else if ( mode === 'rotate' ) {

				this._offset.copy( this.pointEnd ).sub( this.pointStart );

				const ROTATION_SPEED = 20 / this.worldPosition.distanceTo( _tempVector.setFromMatrixPosition( this.camera.matrixWorld ) );

				if ( axis === 'E' ) {

					this.rotationAxis.copy( this.eye );
					this.rotationAngle = this.pointEnd.angleTo( this.pointStart );

					this._startNorm.copy( this.pointStart ).normalize();

					this._endNorm.copy( this.pointEnd ).normalize();

					this.rotationAngle *= this._endNorm.cross( this._startNorm ).dot( this.eye ) < 0 ? 1 : - 1;

				} else if ( axis === 'XYZE' ) {

					this.rotationAxis.copy( this._offset ).cross( this.eye ).normalize();
					this.rotationAngle = this._offset.dot( _tempVector.copy( this.rotationAxis ).cross( this.eye ) ) * ROTATION_SPEED;

				} else if ( axis === 'X' || axis === 'Y' || axis === 'Z' ) {

					this.rotationAxis.copy( _unit[ axis ] );

					_tempVector.copy( _unit[ axis ] );

					if ( space === 'local' ) {

						_tempVector.applyQuaternion( this.worldQuaternion );

					}

					this.rotationAngle = this._offset.dot( _tempVector.cross( this.eye ).normalize() ) * ROTATION_SPEED;

				} // Apply rotation snap


				if ( this.rotationSnap ) this.rotationAngle = Math.round( this.rotationAngle / this.rotationSnap ) * this.rotationSnap; // Apply rotate

				if ( space === 'local' && axis !== 'E' && axis !== 'XYZE' ) {

					object.quaternion.copy( this._quaternionStart );
					object.quaternion.multiply( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) ).normalize();

				} else {

					this.rotationAxis.applyQuaternion( this._parentQuaternionInv );
					object.quaternion.copy( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) );
					object.quaternion.multiply( this._quaternionStart ).normalize();

				}

			}

			this.dispatchEvent( _changeEvent );
			this.dispatchEvent( _objectChangeEvent );

		}

		pointerUp( pointer ) {

			if ( pointer.button !== 0 ) return;

			if ( this.dragging && this.axis !== null ) {

				_mouseUpEvent.mode = this.mode;
				this.dispatchEvent( _mouseUpEvent );

			}

			this.dragging = false;
			this.axis = null;

		}

		dispose() {

			this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
			this.domElement.removeEventListener( 'pointermove', this._onPointerHover );
			this.domElement.ownerDocument.removeEventListener( 'pointermove', this._onPointerMove );
			this.domElement.ownerDocument.removeEventListener( 'pointerup', this._onPointerUp );
			this.traverse( function ( child ) {

				if ( child.geometry ) child.geometry.dispose();
				if ( child.material ) child.material.dispose();

			} );

		} // Set current object


		attach( object ) {

			this.object = object;
			this.visible = true;
			return this;

		} // Detatch from object


		detach() {

			this.object = undefined;
			this.visible = false;
			this.axis = null;
			return this;

		} // TODO: deprecate


		getMode() {

			return this.mode;

		}

		setMode( mode ) {

			this.mode = mode;

		}

		setTranslationSnap( translationSnap ) {

			this.translationSnap = translationSnap;

		}

		setRotationSnap( rotationSnap ) {

			this.rotationSnap = rotationSnap;

		}

		setScaleSnap( scaleSnap ) {

			this.scaleSnap = scaleSnap;

		}

		setSize( size ) {

			this.size = size;

		}

		setSpace( space ) {

			this.space = space;

		}

		update() {

			console.warn( 'THREE.TransformControls: update function has no more functionality and therefore has been deprecated.' );

		}

	}

	TransformControls.prototype.isTransformControls = true; // mouse / touch event handlers

	function getPointer( event ) {

		if ( this.domElement.ownerDocument.pointerLockElement ) {

			return {
				x: 0,
				y: 0,
				button: event.button
			};

		} else {

			const pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;
			const rect = this.domElement.getBoundingClientRect();
			return {
				x: ( pointer.clientX - rect.left ) / rect.width * 2 - 1,
				y: - ( pointer.clientY - rect.top ) / rect.height * 2 + 1,
				button: event.button
			};

		}

	}

	function onPointerHover( event ) {

		if ( ! this.enabled ) return;

		switch ( event.pointerType ) {

			case 'mouse':
			case 'pen':
				this.pointerHover( this._getPointer( event ) );
				break;

		}

	}

	function onPointerDown( event ) {

		if ( ! this.enabled ) return;
		this.domElement.style.touchAction = 'none'; // disable touch scroll

		this.domElement.ownerDocument.addEventListener( 'pointermove', this._onPointerMove );
		this.pointerHover( this._getPointer( event ) );
		this.pointerDown( this._getPointer( event ) );

	}

	function onPointerMove( event ) {

		if ( ! this.enabled ) return;
		this.pointerMove( this._getPointer( event ) );

	}

	function onPointerUp( event ) {

		if ( ! this.enabled ) return;
		this.domElement.style.touchAction = '';
		this.domElement.ownerDocument.removeEventListener( 'pointermove', this._onPointerMove );
		this.pointerUp( this._getPointer( event ) );

	}

	function intersectObjectWithRay( object, raycaster, includeInvisible ) {

		const allIntersections = raycaster.intersectObject( object, true );

		for ( let i = 0; i < allIntersections.length; i ++ ) {

			if ( allIntersections[ i ].object.visible || includeInvisible ) {

				return allIntersections[ i ];

			}

		}

		return false;

	} //
	// Reusable utility variables


	const _tempEuler = new THREE.Euler();

	const _alignVector = new THREE.Vector3( 0, 1, 0 );

	const _zeroVector = new THREE.Vector3( 0, 0, 0 );

	const _lookAtMatrix = new THREE.Matrix4();

	const _tempQuaternion2 = new THREE.Quaternion();

	const _identityQuaternion = new THREE.Quaternion();

	const _dirVector = new THREE.Vector3();

	const _tempMatrix = new THREE.Matrix4();

	const _unitX = new THREE.Vector3( 1, 0, 0 );

	const _unitY = new THREE.Vector3( 0, 1, 0 );

	const _unitZ = new THREE.Vector3( 0, 0, 1 );

	const _v1 = new THREE.Vector3();

	const _v2 = new THREE.Vector3();

	const _v3 = new THREE.Vector3();

	class TransformControlsGizmo extends THREE.Object3D {

		constructor() {

			super();
			this.type = 'TransformControlsGizmo'; // shared materials

			const gizmoMaterial = new THREE.MeshBasicMaterial( {
				depthTest: false,
				depthWrite: false,
				transparent: true,
				side: THREE.DoubleSide,
				fog: false,
				toneMapped: false
			} );
			const gizmoLineMaterial = new THREE.LineBasicMaterial( {
				depthTest: false,
				depthWrite: false,
				transparent: true,
				linewidth: 1,
				fog: false,
				toneMapped: false
			} ); // Make unique material for each axis/color

			const matInvisible = gizmoMaterial.clone();
			matInvisible.opacity = 0.15;
			const matHelper = gizmoMaterial.clone();
			matHelper.opacity = 0.33;
			const matRed = gizmoMaterial.clone();
			matRed.color.set( 0xff0000 );
			const matGreen = gizmoMaterial.clone();
			matGreen.color.set( 0x00ff00 );
			const matBlue = gizmoMaterial.clone();
			matBlue.color.set( 0x0000ff );
			const matWhiteTransparent = gizmoMaterial.clone();
			matWhiteTransparent.opacity = 0.25;
			const matYellowTransparent = matWhiteTransparent.clone();
			matYellowTransparent.color.set( 0xffff00 );
			const matCyanTransparent = matWhiteTransparent.clone();
			matCyanTransparent.color.set( 0x00ffff );
			const matMagentaTransparent = matWhiteTransparent.clone();
			matMagentaTransparent.color.set( 0xff00ff );
			const matYellow = gizmoMaterial.clone();
			matYellow.color.set( 0xffff00 );
			const matLineRed = gizmoLineMaterial.clone();
			matLineRed.color.set( 0xff0000 );
			const matLineGreen = gizmoLineMaterial.clone();
			matLineGreen.color.set( 0x00ff00 );
			const matLineBlue = gizmoLineMaterial.clone();
			matLineBlue.color.set( 0x0000ff );
			const matLineCyan = gizmoLineMaterial.clone();
			matLineCyan.color.set( 0x00ffff );
			const matLineMagenta = gizmoLineMaterial.clone();
			matLineMagenta.color.set( 0xff00ff );
			const matLineYellow = gizmoLineMaterial.clone();
			matLineYellow.color.set( 0xffff00 );
			const matLineGray = gizmoLineMaterial.clone();
			matLineGray.color.set( 0x787878 );
			const matLineYellowTransparent = matLineYellow.clone();
			matLineYellowTransparent.opacity = 0.25; // reusable geometry

			const arrowGeometry = new THREE.CylinderGeometry( 0, 0.05, 0.2, 12, 1, false );
			const scaleHandleGeometry = new THREE.BoxGeometry( 0.125, 0.125, 0.125 );
			const lineGeometry = new THREE.BufferGeometry();
			lineGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 1, 0, 0 ], 3 ) );

			function CircleGeometry( radius, arc ) {

				const geometry = new THREE.BufferGeometry();
				const vertices = [];

				for ( let i = 0; i <= 64 * arc; ++ i ) {

					vertices.push( 0, Math.cos( i / 32 * Math.PI ) * radius, Math.sin( i / 32 * Math.PI ) * radius );

				}

				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
				return geometry;

			} // Special geometry for transform helper. If scaled with position vector it spans from [0,0,0] to position


			function TranslateHelperGeometry() {

				const geometry = new THREE.BufferGeometry();
				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 1, 1, 1 ], 3 ) );
				return geometry;

			} // Gizmo definitions - custom hierarchy definitions for setupGizmo() function


			const gizmoTranslate = {
				X: [[ new THREE.Mesh( arrowGeometry, matRed ), [ 1, 0, 0 ], [ 0, 0, - Math.PI / 2 ], null, 'fwd' ], [ new THREE.Mesh( arrowGeometry, matRed ), [ 1, 0, 0 ], [ 0, 0, Math.PI / 2 ], null, 'bwd' ], [ new THREE.Line( lineGeometry, matLineRed ) ]],
				Y: [[ new THREE.Mesh( arrowGeometry, matGreen ), [ 0, 1, 0 ], null, null, 'fwd' ], [ new THREE.Mesh( arrowGeometry, matGreen ), [ 0, 1, 0 ], [ Math.PI, 0, 0 ], null, 'bwd' ], [ new THREE.Line( lineGeometry, matLineGreen ), null, [ 0, 0, Math.PI / 2 ]]],
				Z: [[ new THREE.Mesh( arrowGeometry, matBlue ), [ 0, 0, 1 ], [ Math.PI / 2, 0, 0 ], null, 'fwd' ], [ new THREE.Mesh( arrowGeometry, matBlue ), [ 0, 0, 1 ], [ - Math.PI / 2, 0, 0 ], null, 'bwd' ], [ new THREE.Line( lineGeometry, matLineBlue ), null, [ 0, - Math.PI / 2, 0 ]]],
				XYZ: [[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.1, 0 ), matWhiteTransparent.clone() ), [ 0, 0, 0 ], [ 0, 0, 0 ]]],
				XY: [[ new THREE.Mesh( new THREE.PlaneGeometry( 0.295, 0.295 ), matYellowTransparent.clone() ), [ 0.15, 0.15, 0 ]], [ new THREE.Line( lineGeometry, matLineYellow ), [ 0.18, 0.3, 0 ], null, [ 0.125, 1, 1 ]], [ new THREE.Line( lineGeometry, matLineYellow ), [ 0.3, 0.18, 0 ], [ 0, 0, Math.PI / 2 ], [ 0.125, 1, 1 ]]],
				YZ: [[ new THREE.Mesh( new THREE.PlaneGeometry( 0.295, 0.295 ), matCyanTransparent.clone() ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]], [ new THREE.Line( lineGeometry, matLineCyan ), [ 0, 0.18, 0.3 ], [ 0, 0, Math.PI / 2 ], [ 0.125, 1, 1 ]], [ new THREE.Line( lineGeometry, matLineCyan ), [ 0, 0.3, 0.18 ], [ 0, - Math.PI / 2, 0 ], [ 0.125, 1, 1 ]]],
				XZ: [[ new THREE.Mesh( new THREE.PlaneGeometry( 0.295, 0.295 ), matMagentaTransparent.clone() ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]], [ new THREE.Line( lineGeometry, matLineMagenta ), [ 0.18, 0, 0.3 ], null, [ 0.125, 1, 1 ]], [ new THREE.Line( lineGeometry, matLineMagenta ), [ 0.3, 0, 0.18 ], [ 0, - Math.PI / 2, 0 ], [ 0.125, 1, 1 ]]]
			};
			const pickerTranslate = {
				X: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), matInvisible ), [ 0.6, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]],
				Y: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), matInvisible ), [ 0, 0.6, 0 ]]],
				Z: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 1, 4, 1, false ), matInvisible ), [ 0, 0, 0.6 ], [ Math.PI / 2, 0, 0 ]]],
				XYZ: [[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.2, 0 ), matInvisible ) ]],
				XY: [[ new THREE.Mesh( new THREE.PlaneGeometry( 0.4, 0.4 ), matInvisible ), [ 0.2, 0.2, 0 ]]],
				YZ: [[ new THREE.Mesh( new THREE.PlaneGeometry( 0.4, 0.4 ), matInvisible ), [ 0, 0.2, 0.2 ], [ 0, Math.PI / 2, 0 ]]],
				XZ: [[ new THREE.Mesh( new THREE.PlaneGeometry( 0.4, 0.4 ), matInvisible ), [ 0.2, 0, 0.2 ], [ - Math.PI / 2, 0, 0 ]]]
			};
			const helperTranslate = {
				START: [[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]],
				END: [[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]],
				DELTA: [[ new THREE.Line( TranslateHelperGeometry(), matHelper ), null, null, null, 'helper' ]],
				X: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]],
				Y: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]],
				Z: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]]
			};
			const gizmoRotate = {
				X: [[ new THREE.Line( CircleGeometry( 1, 0.5 ), matLineRed ) ], [ new THREE.Mesh( new THREE.OctahedronGeometry( 0.04, 0 ), matRed ), [ 0, 0, 0.99 ], null, [ 1, 3, 1 ]]],
				Y: [[ new THREE.Line( CircleGeometry( 1, 0.5 ), matLineGreen ), null, [ 0, 0, - Math.PI / 2 ]], [ new THREE.Mesh( new THREE.OctahedronGeometry( 0.04, 0 ), matGreen ), [ 0, 0, 0.99 ], null, [ 3, 1, 1 ]]],
				Z: [[ new THREE.Line( CircleGeometry( 1, 0.5 ), matLineBlue ), null, [ 0, Math.PI / 2, 0 ]], [ new THREE.Mesh( new THREE.OctahedronGeometry( 0.04, 0 ), matBlue ), [ 0.99, 0, 0 ], null, [ 1, 3, 1 ]]],
				E: [[ new THREE.Line( CircleGeometry( 1.25, 1 ), matLineYellowTransparent ), null, [ 0, Math.PI / 2, 0 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.03, 0, 0.15, 4, 1, false ), matLineYellowTransparent ), [ 1.17, 0, 0 ], [ 0, 0, - Math.PI / 2 ], [ 1, 1, 0.001 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.03, 0, 0.15, 4, 1, false ), matLineYellowTransparent ), [ - 1.17, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ 1, 1, 0.001 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.03, 0, 0.15, 4, 1, false ), matLineYellowTransparent ), [ 0, - 1.17, 0 ], [ Math.PI, 0, 0 ], [ 1, 1, 0.001 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.03, 0, 0.15, 4, 1, false ), matLineYellowTransparent ), [ 0, 1.17, 0 ], [ 0, 0, 0 ], [ 1, 1, 0.001 ]]],
				XYZE: [[ new THREE.Line( CircleGeometry( 1, 1 ), matLineGray ), null, [ 0, Math.PI / 2, 0 ]]]
			};
			const helperRotate = {
				AXIS: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]]
			};
			const pickerRotate = {
				X: [[ new THREE.Mesh( new THREE.TorusGeometry( 1, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ]]],
				Y: [[ new THREE.Mesh( new THREE.TorusGeometry( 1, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]]],
				Z: [[ new THREE.Mesh( new THREE.TorusGeometry( 1, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]],
				E: [[ new THREE.Mesh( new THREE.TorusGeometry( 1.25, 0.1, 2, 24 ), matInvisible ) ]],
				XYZE: [[ new THREE.Mesh( new THREE.SphereGeometry( 0.7, 10, 8 ), matInvisible ) ]]
			};
			const gizmoScale = {
				X: [[ new THREE.Mesh( scaleHandleGeometry, matRed ), [ 0.8, 0, 0 ], [ 0, 0, - Math.PI / 2 ]], [ new THREE.Line( lineGeometry, matLineRed ), null, null, [ 0.8, 1, 1 ]]],
				Y: [[ new THREE.Mesh( scaleHandleGeometry, matGreen ), [ 0, 0.8, 0 ]], [ new THREE.Line( lineGeometry, matLineGreen ), null, [ 0, 0, Math.PI / 2 ], [ 0.8, 1, 1 ]]],
				Z: [[ new THREE.Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, 0.8 ], [ Math.PI / 2, 0, 0 ]], [ new THREE.Line( lineGeometry, matLineBlue ), null, [ 0, - Math.PI / 2, 0 ], [ 0.8, 1, 1 ]]],
				XY: [[ new THREE.Mesh( scaleHandleGeometry, matYellowTransparent ), [ 0.85, 0.85, 0 ], null, [ 2, 2, 0.2 ]], [ new THREE.Line( lineGeometry, matLineYellow ), [ 0.855, 0.98, 0 ], null, [ 0.125, 1, 1 ]], [ new THREE.Line( lineGeometry, matLineYellow ), [ 0.98, 0.855, 0 ], [ 0, 0, Math.PI / 2 ], [ 0.125, 1, 1 ]]],
				YZ: [[ new THREE.Mesh( scaleHandleGeometry, matCyanTransparent ), [ 0, 0.85, 0.85 ], null, [ 0.2, 2, 2 ]], [ new THREE.Line( lineGeometry, matLineCyan ), [ 0, 0.855, 0.98 ], [ 0, 0, Math.PI / 2 ], [ 0.125, 1, 1 ]], [ new THREE.Line( lineGeometry, matLineCyan ), [ 0, 0.98, 0.855 ], [ 0, - Math.PI / 2, 0 ], [ 0.125, 1, 1 ]]],
				XZ: [[ new THREE.Mesh( scaleHandleGeometry, matMagentaTransparent ), [ 0.85, 0, 0.85 ], null, [ 2, 0.2, 2 ]], [ new THREE.Line( lineGeometry, matLineMagenta ), [ 0.855, 0, 0.98 ], null, [ 0.125, 1, 1 ]], [ new THREE.Line( lineGeometry, matLineMagenta ), [ 0.98, 0, 0.855 ], [ 0, - Math.PI / 2, 0 ], [ 0.125, 1, 1 ]]],
				XYZX: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.125, 0.125, 0.125 ), matWhiteTransparent.clone() ), [ 1.1, 0, 0 ]]],
				XYZY: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.125, 0.125, 0.125 ), matWhiteTransparent.clone() ), [ 0, 1.1, 0 ]]],
				XYZZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.125, 0.125, 0.125 ), matWhiteTransparent.clone() ), [ 0, 0, 1.1 ]]]
			};
			const pickerScale = {
				X: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.8, 4, 1, false ), matInvisible ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]],
				Y: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.8, 4, 1, false ), matInvisible ), [ 0, 0.5, 0 ]]],
				Z: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.8, 4, 1, false ), matInvisible ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]]],
				XY: [[ new THREE.Mesh( scaleHandleGeometry, matInvisible ), [ 0.85, 0.85, 0 ], null, [ 3, 3, 0.2 ]]],
				YZ: [[ new THREE.Mesh( scaleHandleGeometry, matInvisible ), [ 0, 0.85, 0.85 ], null, [ 0.2, 3, 3 ]]],
				XZ: [[ new THREE.Mesh( scaleHandleGeometry, matInvisible ), [ 0.85, 0, 0.85 ], null, [ 3, 0.2, 3 ]]],
				XYZX: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 1.1, 0, 0 ]]],
				XYZY: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 0, 1.1, 0 ]]],
				XYZZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 0, 0, 1.1 ]]]
			};
			const helperScale = {
				X: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]],
				Y: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]],
				Z: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]]
			}; // Creates an THREE.Object3D with gizmos described in custom hierarchy definition.

			function setupGizmo( gizmoMap ) {

				const gizmo = new THREE.Object3D();

				for ( const name in gizmoMap ) {

					for ( let i = gizmoMap[ name ].length; i --; ) {

						const object = gizmoMap[ name ][ i ][ 0 ].clone();
						const position = gizmoMap[ name ][ i ][ 1 ];
						const rotation = gizmoMap[ name ][ i ][ 2 ];
						const scale = gizmoMap[ name ][ i ][ 3 ];
						const tag = gizmoMap[ name ][ i ][ 4 ]; // name and tag properties are essential for picking and updating logic.

						object.name = name;
						object.tag = tag;

						if ( position ) {

							object.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );

						}

						if ( rotation ) {

							object.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );

						}

						if ( scale ) {

							object.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );

						}

						object.updateMatrix();
						const tempGeometry = object.geometry.clone();
						tempGeometry.applyMatrix4( object.matrix );
						object.geometry = tempGeometry;
						object.renderOrder = Infinity;
						object.position.set( 0, 0, 0 );
						object.rotation.set( 0, 0, 0 );
						object.scale.set( 1, 1, 1 );
						gizmo.add( object );

					}

				}

				return gizmo;

			} // Gizmo creation


			this.gizmo = {};
			this.picker = {};
			this.helper = {};
			this.add( this.gizmo[ 'translate' ] = setupGizmo( gizmoTranslate ) );
			this.add( this.gizmo[ 'rotate' ] = setupGizmo( gizmoRotate ) );
			this.add( this.gizmo[ 'scale' ] = setupGizmo( gizmoScale ) );
			this.add( this.picker[ 'translate' ] = setupGizmo( pickerTranslate ) );
			this.add( this.picker[ 'rotate' ] = setupGizmo( pickerRotate ) );
			this.add( this.picker[ 'scale' ] = setupGizmo( pickerScale ) );
			this.add( this.helper[ 'translate' ] = setupGizmo( helperTranslate ) );
			this.add( this.helper[ 'rotate' ] = setupGizmo( helperRotate ) );
			this.add( this.helper[ 'scale' ] = setupGizmo( helperScale ) ); // Pickers should be hidden always

			this.picker[ 'translate' ].visible = false;
			this.picker[ 'rotate' ].visible = false;
			this.picker[ 'scale' ].visible = false;

		} // updateMatrixWorld will update transformations and appearance of individual handles


		updateMatrixWorld( force ) {

			const space = this.mode === 'scale' ? this.space : 'local'; // scale always oriented to local rotation

			const quaternion = space === 'local' ? this.worldQuaternion : _identityQuaternion; // Show only gizmos for current transform mode

			this.gizmo[ 'translate' ].visible = this.mode === 'translate';
			this.gizmo[ 'rotate' ].visible = this.mode === 'rotate';
			this.gizmo[ 'scale' ].visible = this.mode === 'scale';
			this.helper[ 'translate' ].visible = this.mode === 'translate';
			this.helper[ 'rotate' ].visible = this.mode === 'rotate';
			this.helper[ 'scale' ].visible = this.mode === 'scale';
			let handles = [];
			handles = handles.concat( this.picker[ this.mode ].children );
			handles = handles.concat( this.gizmo[ this.mode ].children );
			handles = handles.concat( this.helper[ this.mode ].children );

			for ( let i = 0; i < handles.length; i ++ ) {

				const handle = handles[ i ]; // hide aligned to camera

				handle.visible = true;
				handle.rotation.set( 0, 0, 0 );
				handle.position.copy( this.worldPosition );
				let factor;

				if ( this.camera.isOrthographicCamera ) {

					factor = ( this.camera.top - this.camera.bottom ) / this.camera.zoom;

				} else {

					factor = this.worldPosition.distanceTo( this.cameraPosition ) * Math.min( 1.9 * Math.tan( Math.PI * this.camera.fov / 360 ) / this.camera.zoom, 7 );

				}

				handle.scale.set( 1, 1, 1 ).multiplyScalar( factor * this.size / 7 ); // TODO: simplify helpers and consider decoupling from gizmo

				if ( handle.tag === 'helper' ) {

					handle.visible = false;

					if ( handle.name === 'AXIS' ) {

						handle.position.copy( this.worldPositionStart );
						handle.visible = !! this.axis;

						if ( this.axis === 'X' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, 0 ) );

							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'Y' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, Math.PI / 2 ) );

							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'Z' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );

							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'XYZE' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );

							_alignVector.copy( this.rotationAxis );

							handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( _zeroVector, _alignVector, _unitY ) );
							handle.quaternion.multiply( _tempQuaternion );
							handle.visible = this.dragging;

						}

						if ( this.axis === 'E' ) {

							handle.visible = false;

						}

					} else if ( handle.name === 'START' ) {

						handle.position.copy( this.worldPositionStart );
						handle.visible = this.dragging;

					} else if ( handle.name === 'END' ) {

						handle.position.copy( this.worldPosition );
						handle.visible = this.dragging;

					} else if ( handle.name === 'DELTA' ) {

						handle.position.copy( this.worldPositionStart );
						handle.quaternion.copy( this.worldQuaternionStart );

						_tempVector.set( 1e-10, 1e-10, 1e-10 ).add( this.worldPositionStart ).sub( this.worldPosition ).multiplyScalar( - 1 );

						_tempVector.applyQuaternion( this.worldQuaternionStart.clone().invert() );

						handle.scale.copy( _tempVector );
						handle.visible = this.dragging;

					} else {

						handle.quaternion.copy( quaternion );

						if ( this.dragging ) {

							handle.position.copy( this.worldPositionStart );

						} else {

							handle.position.copy( this.worldPosition );

						}

						if ( this.axis ) {

							handle.visible = this.axis.search( handle.name ) !== - 1;

						}

					} // If updating helper, skip rest of the loop


					continue;

				} // Align handles to current local or world rotation


				handle.quaternion.copy( quaternion );

				if ( this.mode === 'translate' || this.mode === 'scale' ) {

					// Hide translate and scale axis facing the camera
					const AXIS_HIDE_TRESHOLD = 0.99;
					const PLANE_HIDE_TRESHOLD = 0.2;
					const AXIS_FLIP_TRESHOLD = 0.0;

					if ( handle.name === 'X' || handle.name === 'XYZX' ) {

						if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'Y' || handle.name === 'XYZY' ) {

						if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'Z' || handle.name === 'XYZZ' ) {

						if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'XY' ) {

						if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'YZ' ) {

						if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'XZ' ) {

						if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					} // Flip translate and scale axis ocluded behind another axis


					if ( handle.name.search( 'X' ) !== - 1 ) {

						if ( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) < AXIS_FLIP_TRESHOLD ) {

							if ( handle.tag === 'fwd' ) {

								handle.visible = false;

							} else {

								handle.scale.x *= - 1;

							}

						} else if ( handle.tag === 'bwd' ) {

							handle.visible = false;

						}

					}

					if ( handle.name.search( 'Y' ) !== - 1 ) {

						if ( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) < AXIS_FLIP_TRESHOLD ) {

							if ( handle.tag === 'fwd' ) {

								handle.visible = false;

							} else {

								handle.scale.y *= - 1;

							}

						} else if ( handle.tag === 'bwd' ) {

							handle.visible = false;

						}

					}

					if ( handle.name.search( 'Z' ) !== - 1 ) {

						if ( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) < AXIS_FLIP_TRESHOLD ) {

							if ( handle.tag === 'fwd' ) {

								handle.visible = false;

							} else {

								handle.scale.z *= - 1;

							}

						} else if ( handle.tag === 'bwd' ) {

							handle.visible = false;

						}

					}

				} else if ( this.mode === 'rotate' ) {

					// Align handles to current local or world rotation
					_tempQuaternion2.copy( quaternion );

					_alignVector.copy( this.eye ).applyQuaternion( _tempQuaternion.copy( quaternion ).invert() );

					if ( handle.name.search( 'E' ) !== - 1 ) {

						handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( this.eye, _zeroVector, _unitY ) );

					}

					if ( handle.name === 'X' ) {

						_tempQuaternion.setFromAxisAngle( _unitX, Math.atan2( - _alignVector.y, _alignVector.z ) );

						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );

						handle.quaternion.copy( _tempQuaternion );

					}

					if ( handle.name === 'Y' ) {

						_tempQuaternion.setFromAxisAngle( _unitY, Math.atan2( _alignVector.x, _alignVector.z ) );

						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );

						handle.quaternion.copy( _tempQuaternion );

					}

					if ( handle.name === 'Z' ) {

						_tempQuaternion.setFromAxisAngle( _unitZ, Math.atan2( _alignVector.y, _alignVector.x ) );

						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );

						handle.quaternion.copy( _tempQuaternion );

					}

				} // Hide disabled axes


				handle.visible = handle.visible && ( handle.name.indexOf( 'X' ) === - 1 || this.showX );
				handle.visible = handle.visible && ( handle.name.indexOf( 'Y' ) === - 1 || this.showY );
				handle.visible = handle.visible && ( handle.name.indexOf( 'Z' ) === - 1 || this.showZ );
				handle.visible = handle.visible && ( handle.name.indexOf( 'E' ) === - 1 || this.showX && this.showY && this.showZ ); // highlight selected axis

				handle.material._opacity = handle.material._opacity || handle.material.opacity;
				handle.material._color = handle.material._color || handle.material.color.clone();
				handle.material.color.copy( handle.material._color );
				handle.material.opacity = handle.material._opacity;

				if ( ! this.enabled ) {

					handle.material.opacity *= 0.5;
					handle.material.color.lerp( new THREE.Color( 1, 1, 1 ), 0.5 );

				} else if ( this.axis ) {

					if ( handle.name === this.axis ) {

						handle.material.opacity = 1.0;
						handle.material.color.lerp( new THREE.Color( 1, 1, 1 ), 0.5 );

					} else if ( this.axis.split( '' ).some( function ( a ) {

						return handle.name === a;

					} ) ) {

						handle.material.opacity = 1.0;
						handle.material.color.lerp( new THREE.Color( 1, 1, 1 ), 0.5 );

					} else {

						handle.material.opacity *= 0.25;
						handle.material.color.lerp( new THREE.Color( 1, 1, 1 ), 0.5 );

					}

				}

			}

			super.updateMatrixWorld( force );

		}

	}

	TransformControlsGizmo.prototype.isTransformControlsGizmo = true; //

	class TransformControlsPlane extends THREE.Mesh {

		constructor() {

			super( new THREE.PlaneGeometry( 100000, 100000, 2, 2 ), new THREE.MeshBasicMaterial( {
				visible: false,
				wireframe: true,
				side: THREE.DoubleSide,
				transparent: true,
				opacity: 0.1,
				toneMapped: false
			} ) );
			this.type = 'TransformControlsPlane';

		}

		updateMatrixWorld( force ) {

			let space = this.space;
			this.position.copy( this.worldPosition );
			if ( this.mode === 'scale' ) space = 'local'; // scale always oriented to local rotation

			_v1.copy( _unitX ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );

			_v2.copy( _unitY ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );

			_v3.copy( _unitZ ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion ); // Align the plane for current transform mode, axis and space.


			_alignVector.copy( _v2 );

			switch ( this.mode ) {

				case 'translate':
				case 'scale':
					switch ( this.axis ) {

						case 'X':
							_alignVector.copy( this.eye ).cross( _v1 );

							_dirVector.copy( _v1 ).cross( _alignVector );

							break;

						case 'Y':
							_alignVector.copy( this.eye ).cross( _v2 );

							_dirVector.copy( _v2 ).cross( _alignVector );

							break;

						case 'Z':
							_alignVector.copy( this.eye ).cross( _v3 );

							_dirVector.copy( _v3 ).cross( _alignVector );

							break;

						case 'XY':
							_dirVector.copy( _v3 );

							break;

						case 'YZ':
							_dirVector.copy( _v1 );

							break;

						case 'XZ':
							_alignVector.copy( _v3 );

							_dirVector.copy( _v2 );

							break;

						case 'XYZ':
						case 'E':
							_dirVector.set( 0, 0, 0 );

							break;

					}

					break;

				case 'rotate':
				default:
					// special case for rotate
					_dirVector.set( 0, 0, 0 );

			}

			if ( _dirVector.length() === 0 ) {

				// If in rotate mode, make the plane parallel to camera
				this.quaternion.copy( this.cameraQuaternion );

			} else {

				_tempMatrix.lookAt( _tempVector.set( 0, 0, 0 ), _dirVector, _alignVector );

				this.quaternion.setFromRotationMatrix( _tempMatrix );

			}

			super.updateMatrixWorld( force );

		}

	}

	TransformControlsPlane.prototype.isTransformControlsPlane = true;

	THREE.TransformControls = TransformControls;
	THREE.TransformControlsGizmo = TransformControlsGizmo;
	THREE.TransformControlsPlane = TransformControlsPlane;

} )();

// ================================================================== SETS ==
// The stage (the floor, its grid and the sky, life size: 1 unit is 1 m, the floor at y = 0) and the looks of the
// items: a cube's see-through box, a sound's speaker, a model's grey box while it loads.
const SETS = {};
// The stage: what a scene stands on when it brings nothing of its own. Life size: 1 unit is 1 m, the floor at y = 0,
// the scene's origin in the middle (in a shared room its circle's spot), -z the way it faces. A dark floor with a faint
// 1 m grid fading out with distance, a small mark at the origin pointing the scene's way, and a soft sky. In
// passthrough nothing of it is drawn (stage_floor 0): the scene stands on your real floor.
SETS.stage = function (K) {
  const group = new THREE.Group(), disposable = [];
  const keep = x => (disposable.push(x), x);
  const R = 40, GRID = 24;
  // the floor (the pointer's dot lands on it, also where it is not drawn)
  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(R, 96).rotateX(-Math.PI / 2)),
    keep(new THREE.MeshStandardMaterial({ color: 0x0a111e, roughness: 0.95, metalness: 0 })));
  floor.renderOrder = -2;
  group.add(floor);
  // the grid: 1 m lines out to GRID m, each cut into 1 m pieces so it fades with distance (vertex colours, additive)
  const pos = [], col = [], c0 = new THREE.Color(0x3f6f99), fade = (x, z) => Math.max(0, 1 - Math.hypot(x, z) / GRID) ** 1.6;
  const seg = (x0, z0, x1, z1) => {
    pos.push(x0, 0.002, z0, x1, 0.002, z1);
    for (const [x, z] of [[x0, z0], [x1, z1]]) { const f = fade(x, z); col.push(c0.r * f, c0.g * f, c0.b * f); }
  };
  for (let i = -GRID; i <= GRID; i++) for (let j = -GRID; j < GRID; j++) { seg(i, j, i, j + 1); seg(j, i, j + 1, i); }
  const gg = keep(new THREE.BufferGeometry());
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const grid = new THREE.LineSegments(gg, keep(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
  group.add(grid);
  // the origin: a small ring and an arrowhead towards -z (where a scene faces)
  const mark = new THREE.Group(), markMat = keep(new THREE.MeshBasicMaterial({ color: 0x46d9ff, transparent: true, opacity: 0.45, depthWrite: false }));
  mark.add(new THREE.Mesh(keep(new THREE.RingGeometry(0.16, 0.18, 48).rotateX(-Math.PI / 2)), markMat));
  const tri = new THREE.Shape(); tri.moveTo(-0.07, 0); tri.lineTo(0.07, 0); tri.lineTo(0, 0.12); tri.closePath();
  const arrow = new THREE.Mesh(keep(new THREE.ShapeGeometry(tri).rotateX(-Math.PI / 2)), markMat);
  arrow.position.z = -0.2;
  mark.add(arrow);
  mark.position.y = 0.004;
  group.add(mark);
  // the sky: a soft gradient, dark at the horizon's foot, a little lighter above it, night blue overhead
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(300, 32, 16)), keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x0a1426) }, mid: { value: new THREE.Color(0x1d2c44) }, low: { value: new THREE.Color(0x05080f) } },
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top, mid, low; varying vec3 vP; void main() { float y = vP.y; vec3 c = y > 0.0 ? mix(mid, top, pow(clamp(y, 0.0, 1.0), 0.6)) : mix(mid, low, clamp(-y * 6.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
  })));
  sky.renderOrder = -10; sky.frustumCulled = false;
  group.add(sky);
  let alpha = 1;
  return {
    group,
    params: { stage_floor: 1 },
    anchors: { centre: [0, 1, 0], floor: [0, 0, 0] },
    labels: [],
    // [az, el, dist, tx, ty, tz]
    cam: { default: [24, 20, 7, 0, 1, 0], above: [0, 80, 14, 0, 0, 0] },
    solid: [floor],
    setAlpha(a) { alpha = a; group.visible = a > 0.01; },
    update(S) {
      const f = (S.stage_floor === undefined ? 1 : S.stage_floor) * alpha;
      floor.visible = grid.visible = sky.visible = mark.visible = f > 0.01;
    },
    dispose() { for (const x of disposable) x.dispose(); },
  };
};

// The items' looks (not a set of its own: the engine's items use them). A trigger cube: a see-through box in its
// colour with brighter edges, its name over it and, when selected, a ball at each corner to stretch it by. A sound: a
// small speaker (a ball and a cone) in its colour and a faint ring on the floor where it stops being at full volume. A
// model still loading (or one this device cannot find): a grey box with a line of text over it. Each item's colour
// comes from its id, so it is the same on every device.
const LOOKS = (function () {
  const PAL = ['#46d9ff', '#ffb43b', '#3ee08f', '#ff5ad9', '#9db4ff', '#ff7a59', '#c3e85a', '#c08cff', '#5fe0c8', '#ffe066'];
  const colOf = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
  const box = new THREE.BoxGeometry(1, 1, 1), edges = new THREE.EdgesGeometry(box), ball = new THREE.SphereGeometry(1, 16, 12);
  const cone = new THREE.ConeGeometry(0.5, 1, 20, 1, true);
  // a line of text on a canvas, as a sprite (drawn over the scene) or a plain picture; redrawn only when it changes
  function tag(px) {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
    cv.width = 512; cv.height = 64;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 12; sp.center.set(0.5, 0);
    let last = '';
    sp.userData.set = (text, col, h) => {
      const k = text + '|' + col;
      if (k !== last) {
        last = k;
        ctx.font = `700 ${px || 34}px B612, "Segoe UI", Arial, sans-serif`;
        const w = Math.min(1000, Math.ceil(ctx.measureText(text).width) + 36);
        if (cv.width !== w) cv.width = w;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = 'rgba(3,8,16,0.8)'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = col || '#e7eef8'; ctx.fillRect(0, 0, 6, cv.height);
        ctx.font = `700 ${px || 34}px B612, "Segoe UI", Arial, sans-serif`; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f2f6fc';
        ctx.fillText(text, 20, cv.height / 2 + 1);
        tex.needsUpdate = true;
      }
      sp.scale.set((h || 0.09) * cv.width / cv.height, h || 0.09, 1);
    };
    sp.userData.drop = () => { tex.dispose(); sp.material.dispose(); };
    return sp;
  }
  // a cube: its box (scaled to its size) under `body`, the name and the corners under `deco` (not scaled, so they keep
  // their size); both follow the cube's place and yaw
  function cube(id) {
    const col = new THREE.Color(colOf(id));
    const body = new THREE.Group(), deco = new THREE.Group();
    const fill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    fill.renderOrder = 5;
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.35), transparent: true, opacity: 0.85, depthWrite: false }));
    line.renderOrder = 6;
    body.add(fill, line);
    const name = tag(30);
    deco.add(name);
    const corners = [];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.5), transparent: true, opacity: 0.9, depthWrite: false }));
      c.scale.setScalar(0.045); c.renderOrder = 7; c.userData.corner = k; c.visible = false;
      deco.add(c); corners.push(c);
    }
    return {
      body, deco, fill, line, name, corners, col: '#' + col.getHexString(),
      // inside: brighter; selected: its corners shown; hot: the pointer on it
      look(o) {
        fill.material.opacity = (o.inside ? 0.3 : 0.16) + (o.hot ? 0.08 : 0);
        line.material.opacity = o.selected || o.hot ? 1 : 0.75;
        for (const c of corners) { c.visible = !!o.selected; c.scale.setScalar(o.hotCorner === c.userData.corner ? 0.065 : 0.045); }
      },
      drop() { fill.material.dispose(); line.material.dispose(); for (const c of corners) c.material.dispose(); name.userData.drop(); },
    };
  }
  // a sound: the speaker and its ring (the ring on the floor under it, sized to its full-volume distance)
  function speaker(id) {
    const col = new THREE.Color(colOf(id)), g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const b = new THREE.Mesh(ball, mat); b.scale.setScalar(0.06); g.add(b);
    const c = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    c.scale.set(0.16, 0.14, 0.16); c.rotation.x = -Math.PI / 2; c.position.z = -0.1; g.add(c);
    // what the pointer finds: an unseen ball round it
    const hit = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ visible: false })); hit.scale.setScalar(0.16); g.add(hit);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false }));
    ring.renderOrder = 4;
    const name = tag(30);
    g.add(name); name.position.y = 0.12;
    return {
      group: g, ring, hit, name, col: '#' + col.getHexString(),
      look(o) { b.scale.setScalar(o.hot || o.selected ? 0.08 : 0.06); c.material.opacity = o.on ? 0.75 : 0.35; },
      drop() { mat.dispose(); c.material.dispose(); ring.geometry.dispose(); ring.material.dispose(); name.userData.drop(); },
    };
  }
  // a model that is not here yet (loading, missing or unreadable): a grey box with a line of text over it
  function grey() {
    const g = new THREE.Group();
    const fill = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x6c7d94, roughness: 0.9, transparent: true, opacity: 0.55 }));
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xb8c4d4 }));
    const body = new THREE.Group(); body.add(fill, line); body.scale.setScalar(0.4); body.position.y = 0.2;
    g.add(body);
    const name = tag(28); name.position.y = 0.48;
    g.add(name);
    return { group: g, body, fill, name, drop() { fill.material.dispose(); line.material.dispose(); name.userData.drop(); } };
  }
  return { colOf, cube, speaker, grey, tag, dispose() { box.dispose(); edges.dispose(); ball.dispose(); cone.dispose(); } };
})();


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear (one: the stage; the scene's items hang beside it, GL.items)
const SET_ORDER = ['stage'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // (the renderer is the shell's, shared by every story: its output stays linear, as theirs; a model's textures are
  // drawn as they are, LIB's look)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 1200);
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit as a room is: a sky and ground light, a light from over your shoulder, and a cool rim light from behind
  scene.add(GL.hemi = new THREE.HemisphereLight(0xe8eeff, 0x2a2f3a, 0.9));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.9);
  scene.add(GL.sun); scene.add(GL.sun.target);
  GL.rim = new THREE.DirectionalLight(0x9fc8ff, 0.35);
  scene.add(GL.rim); scene.add(GL.rim.target);
  // stars (kept for the engine's sake; the studio has none)
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false }));
  scene.add(GL.stars); GL.stars.visible = false;
  // the scene's items (objects, cubes, sounds) and what is drawn for editing, in the scene's frame
  GL.items = new THREE.Group(); GL.world.add(GL.items);
  GL.edit = new THREE.Group(); GL.world.add(GL.edit);
  // (the stage, built on its own as a step of the load: buildSet, LOAD)
  GL.sets = {};
}
// one set, built as a step of the load (LOAD) and hidden until the story fades it in
function buildSet(k) {
  const s = SETS[k](K);
  GL.sets[k] = s;
  GL.world.add(s.group);
  s.setAlpha(0);
}
// once every set is built (a step of the load): what joins them
function sceneJoin() {
  orbit.cur = view('stage', 'default');
}
// a soft, room-like light for glTF's metal and gloss (PBR materials need something to reflect): a small room of
// gradient walls and a few bright panels, prefiltered once, the first time a model wants it
function envMap() {
  if (GL.env !== undefined) return GL.env;
  GL.env = null;
  try {
    const room = new THREE.Scene(), geo = new THREE.BoxGeometry(1, 1, 1), mats = [];
    const wall = new THREE.MeshBasicMaterial({ color: 0x5a6070, side: THREE.BackSide }); mats.push(wall);
    const box = new THREE.Mesh(geo, wall); box.scale.set(12, 6, 12); box.position.y = 2; room.add(box);
    for (const [x, y, z, sx, sy, sz, c] of [[0, 4.9, 0, 6, 0.1, 6, 0xffffff], [-5.9, 2.5, 0, 0.1, 2, 5, 0xc8d8ff], [5.9, 2, 1, 0.1, 1.5, 3, 0xffe2c0], [0, -0.9, 0, 12, 0.1, 12, 0x2a2f3a]]) {
      const m = new THREE.MeshBasicMaterial({ color: c }); mats.push(m);
      const p = new THREE.Mesh(geo, m); p.position.set(x, y, z); p.scale.set(sx, sy, sz); room.add(p);
    }
    const pm = new THREE.PMREMGenerator(GL.renderer);
    GL.env = pm.fromScene(room, 0.04).texture;
    pm.dispose(); geo.dispose(); for (const m of mats) m.dispose();
  } catch (e) { GL.env = null; /* no reflections: still lit */ }
  return GL.env;
}
// show each set as far as S fades it in, and let the visible ones update
function updateSets(S, t, dt) {
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
  }
}

// ---------------------------------------------------------------- camera --
// A view is [az, el, dist, tx, ty, tz]: look at the target (tx, ty, tz) from the
// direction az (around the vertical, degrees) and el (up, degrees), dist away.
const _vd = new THREE.Vector3(), _vt = new THREE.Vector3();
function viewDir(v, out) {
  const A = v[0] * D2R, E = clamp(v[1], -85, 85) * D2R;
  return out.set(Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A));
}
function applyCamera(v) {
  viewDir(v, _vd); _vt.set(v[3], v[4], v[5]);
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1));
  GL.camera.position.y = Math.max(GL.camera.position.y, 0.15);   // never under the floor
  GL.camera.up.set(0, 1, 0); GL.camera.lookAt(_vt);
}
function resize() {
  GL.bare = !!(HOST.focus && HOST.focus());   // focus mode (the shell's): the 3D alone on the page, no panel to clear
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide;
  if (GL.bare) camera.setViewOffset(w, h, 0, 0.05 * h, w, h);   // (its middle a little above the page's: more bar below)
  else if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62);
  // (focus mode: the page between the top bar, 48 px, and the bar and subtitles below, 126 px, about the scene's
  // middle at 0.45 h; at fit 1 a scene reaches about 0.95 of the screen's half height up and down, 1 to the sides)
  if (GL.bare) GL.fit = Math.max(1, 0.95 / Math.max(0.25, Math.min(0.45 * h - 48, 0.55 * h - 126) / (0.5 * h)), h / w);
  camera.updateProjectionMatrix();
}
// the sun comes from over the viewer's left shoulder, the rim light from behind; point sizes follow the screen
const LV = new THREE.Vector3(), _v2 = new THREE.Vector2();
function updateLight(xr) {
  const q = xr ? XR.headQ : GL.camera.quaternion;
  LV.set(-0.5, 0.8, 1.0).normalize().applyQuaternion(q);
  LV.y = Math.max(LV.y, 0.4);   // (always from above: a room's light)
  GL.sun.position.copy(LV); GL.sun.target.position.set(0, 0, 0);
  LV.set(0.3, 0.5, -1.0).normalize().applyQuaternion(q);
  GL.rim.position.copy(LV); GL.rim.target.position.set(0, 0, 0);
  if (xr) K.U.uPx.value = XR.viewH * 0.5 * XR.R;
  else K.U.uPx.value = GL.renderer.getDrawingBufferSize(_v2).y * 0.5;
}

// ================================================================== STORY ==
// The studio tells no story: its "story" is one short intro line (the scene seen from a little way off, then the walk
// up to it) for a new wearer or a Replay, and it opens straight into explore mode, the scene. The engine's clock,
// chapters and slideshow stay as every story has them, so the shell and the shared rooms treat it like the others.
const NARRATION_SYNC = [[0, 0], [5, 5]];
// recording time -> story time (no recording: the same)
function storyT(t) {
  const W = NARRATION_SYNC;
  if (t <= 0) return 0;
  for (let i = 1; i < W.length; i++) {
    if (t <= W[i][0]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return o0 + (o1 - o0) * (t - n0) / (n1 - n0); }
  }
  return W[W.length - 1][1] + (t - W[W.length - 1][0]);
}
// story time -> recording time
function narrT(o) {
  const W = NARRATION_SYNC;
  for (let i = 1; i < W.length; i++) {
    if (o <= W[i][1]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); }
  }
  return W[W.length - 1][0] + (o - W[W.length - 1][1]);
}
let T_END = NARRATION_SYNC[NARRATION_SYNC.length - 1][0];
const CH = [{ key: 'studio', name: 'Your own scenes', a: 0, b: 5 }];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); });
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest
const DEF = {};
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
}
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      return t1 <= t0 ? v1 : v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return ks[ks.length - 1][1];
}
function storyState(t) {
  const s = {};
  for (const n in DEF) s[n] = evalTrack(n, t);
  return s;
}
const fadeVal = (t, a, b, d) => (t <= a || t >= b ? 0 : Math.min(smooth((t - a) / d), smooth((b - t) / d)));

const ST = { labels: [], items: [] };
// a set's camera view by name (falls back to its default view)
const view = (k, name) => { const c = GL.sets[k].cam; return (c[name] || c.default).slice(); };
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

function buildStory() {
  const html = {
    studio: `<h1 data-at="0.3">Your own scenes</h1>
      <p class="lede" data-at="0.9">Models placed in the room, trigger cubes that show and hide them as you walk, and sounds.</p>
      <p data-at="1.6">A scene is a folder of files and its layout. Pick one, then walk through it; turn on Edit to place things.</p>
      <p data-at="2.4"><button class="btn primary" type="button" id="btnGoExplore">To the scene</button></p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });
  // the stage fades in; the camera comes up to the scene from a little way off
  ramp('stage_a', 0, 0.8, 0, 1);
  // sound effects (sfxCue: story time, a sound, where it comes from, its options); the rest is explore's (e7_explore.js)
  sfxCue(0.2, 'rise', 'stage', 'centre', { dur: 2, gain: 0.4 });   // the stage fades in
  const wp = [];
  const cam = (t, name, nudge) => { const v = view('stage', name); if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0; wp.push([t, ...v, '', 'stage']); };
  cam(0, 'default', [-30, -6, 5, 0, 0.2, 0]);
  cam(4.5, 'default');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set], turning the short way round
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  let prev = null;
  ST.wp = wp.map(w => {
    let az = w[1];
    if (prev !== null) az += 360 * Math.round((prev - az) / 360);
    prev = az;
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7]];
  });
}
function storyCam(t) {
  const wp = ST.wp;
  if (t <= wp[0][0]) return wp[0].slice(1, 7);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? smooth((t - p[0]) / (q[0] - p[0])) : 1;
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x];
    }
  }
  return wp[wp.length - 1].slice(1, 7);
}

// ---------------------------------------------------------------- labels --
// Two labels of the engine's own: the name of the item you point at, over it, and the name of the item selected. Their
// text follows (labelSet); on a screen they are HTML, in a headset sprites or signs. (A cube's and a sound's own names,
// shown while editing, are part of their looks: LOOKS.)
const LBL = { story: ST.labels, sets: [], extra: [] };
function labelEl(html, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || '');
  el.innerHTML = html;
  el.style.opacity = 0;
  $('#labels').appendChild(el);
  return el;
}
function buildSetLabels() {
  for (const at of ['hover', 'sel']) LBL.extra.push({ kind: 'extra', el: labelEl('', at === 'hover' ? 'cyn' : ''), set: 'stage', at: () => itemTop(at === 'hover' ? STU.hover : STU.sel), txt: null, o: -1, show: 0 });
}
// a label's words: [bold, rest]; the headset's picture is drawn again when they change
function labelSet(L, txt) {
  const s = txt ? txt.join('|') : '';
  if (s === (L.txt ? L.txt.join('|') : '')) return;
  L.txt = txt ? [txt[0], txt[1], L.el.classList.contains('cyn') ? 'cyn' : ''] : null;
  L.el.innerHTML = txt ? `<b>${esc(txt[0])}</b> ${esc(txt[1])}` : '';
  L.w = 0;
  dropSprite(L);
}
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  return (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
};
// where a label points, in the world's own coordinates
const _v = new THREE.Vector3();
function labelPos(L, out) {
  const p = anchorOf(L.set, L.at);
  return out.set(p[0], p[1], p[2]).applyMatrix4(GL.sets[L.set].group.matrix);
}
// labels on screen: pinned next to their point, nudged down where they would overlap, and
// kept clear of the side panel, the timeline and the edge of the screen
const _placed = [];
function placeLabels(list, alphaOf) {
  _placed.length = 0;
  const vis = [], W = window.innerWidth, H = window.innerHeight;
  const pr = $('#panel').getBoundingClientRect(), barTop = $('#bar').getBoundingClientRect().top || H;
  for (const L of list) {
    let o = Math.round(alphaOf(L) * 100) / 100, x = 0, y = 0;
    if (o > 0) {
      labelPos(L, _v).applyMatrix4(GL.world.matrixWorld).project(GL.camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) o = 0;
    }
    if (o > 0) {
      if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
      const sx = (_v.x * 0.5 + 0.5) * W;
      x = sx + 9; y = (-_v.y * 0.5 + 0.5) * H - 11;
      if (pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) {
        if (GL.wide && sx > pr.right - 40) x = pr.right + 6; else o = 0;
      }
      if (y + L.h > barTop - 4 || y < 50) o = 0;
      x = Math.min(x, W - L.w - 6);
    }
    if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
    if (o <= 0) continue;
    vis.push([L, x, y]);
  }
  vis.sort((p, q) => p[2] - q[2]);
  for (const [L, x, y0] of vis) {
    let y = y0;
    for (let pass = 0; pass < 6; pass++) {
      const hit = _placed.find(r => x < r[0] + r[2] && r[0] < x + L.w && y < r[1] + r[3] && r[1] < y + L.h);
      if (!hit) break;
      y = hit[1] + hit[3] + 2;
    }
    _placed.push([x, y, L.w, L.h]);
    L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ------------------------------------------------------------ panel update --
let curCh = null;
function updateStoryDOM(t) {
  const c = CH.find(c => t >= c.a && t < c.b) || CH[CH.length - 1];
  if (c !== curCh) {
    ST.items.forEach(it => it.sec.classList.toggle('on', it.ch === c));
    curCh = c;
    $('#panel').scrollTop = 0;
  }
  const it = ST.items.find(x => x.ch === c);
  for (const e of it.els) {
    const o = Math.round(fadeVal(t, e.at, e.out, 0.6) * 100) / 100;
    if (o !== e.o) { e.el.style.opacity = o; e.o = o; e.el.style.visibility = o > 0 ? 'visible' : 'hidden'; }
  }
}

// ------------------------------------------------------------- timeline UI --
function buildTimeline() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div><div class="knob"></div>';
  tr.setAttribute('aria-valuemax', Math.round(T_END));
  const seekAt = ev => {
    const r = tr.getBoundingClientRect();
    APP.seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * T_END);
  };
  let drag = false;
  tr.addEventListener('pointerdown', ev => { drag = true; tr.setPointerCapture(ev.pointerId); seekAt(ev); });
  tr.addEventListener('pointermove', ev => { if (drag) seekAt(ev); });
  tr.addEventListener('pointerup', () => { drag = false; });
  tr.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight') { APP.seek(APP.t + 5); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft') { APP.seek(APP.t - 5); ev.preventDefault(); }
  });
  $('#play').addEventListener('click', () => APP.togglePlay());
  // slideshow: Next and this story's switch, in the shell's row at the foot of the panel (an older shell has none)
  if ($('#slides')) { $('#btnNext').addEventListener('click', slideNext); $('#btnSlides').addEventListener('click', slideToggle); }
  if ($('#btnNextBar')) $('#btnNextBar').addEventListener('click', slideNext);   // Next beside Play (phones)
}
const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
let lastTick = -1;
function updateTimeline(t, playing) {
  const p = (100 * t / T_END).toFixed(2);
  if (p !== lastTick) {
    $('#track .done').style.width = p + '%';
    $('#track .knob').style.left = p + '%';
    $('#track').setAttribute('aria-valuenow', Math.round(t));
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    $('#clock').textContent = m(t) + ' / ' + m(T_END);
    lastTick = p;
  }
  const want = playing ? 'pause' : 'play';
  const btn = $('#play');
  if (btn.dataset.s !== want) { btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; btn.dataset.s = want; btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
  slideDOM();
}

// ================================================================ SOURCES ==
// Where scenes come from. A relay started with --scenes <folder> (the owner's way): it lists the scenes, serves their
// files, saves layouts and tells the page when a file changes (/api/scenes/watch). Else a plain folder that
// tools/studio/scan.mjs described (index.json, and files.json in each scene), read only: &scenes=<folder> in the link, or
// a folder named scenes next to the app. With the relay's password every call carries it: JSON and sounds as a header,
// the loaders' files as ?token= (their only way); a refused one goes to the shell (HOST.collab.relaySaw), which asks for
// the password where it always does (the Shared dialog, the menu's Circles tab).
const HP0 = new URLSearchParams(location.hash.slice(1));
// a link's folder of scenes: a relative path only (no //, no .., no scheme), else none
const okFolder = s => { s = String(s || '').trim().replace(/\/+$/, ''); return s && s.length < 200 && !/^\//.test(s) && !/\/\//.test(s) && !/(^|\/)\.\.(\/|$)/.test(s) && !/[:\\?#%]/.test(s) ? s : ''; };
const OPT = {
  visit: HP0.has('visit'), edit: HP0.has('edit'), scene: HP0.get('scene') || '', scenes: okFolder(HP0.get('scenes')),
  maxtex: clamp(Math.round(+HP0.get('maxtex') || 4096), 512, 8192),
};
const okScene = s => typeof s === 'string' && /^[A-Za-z0-9_][A-Za-z0-9 _.-]{0,63}$/.test(s);
const okFile = s => typeof s === 'string' && s.length > 0 && s.length <= 200 && !/(^|\/)\.\.(\/|$)/.test(s) && !/^\//.test(s) && !/[\\\0]/.test(s);
const extOf = p => (/\.([^./\\]+)$/.exec(String(p)) || ['', ''])[1].toLowerCase();
const baseName = p => String(p).split(/[\\/]/).pop();
const stem = p => baseName(p).replace(/\.[^.]*$/, '');
const KINDS_EXT = { model: ['glb', 'gltf', 'fbx'], audio: ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus', 'webm'], image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'tga', 'bmp'], data: ['bin'] };
const kindOf = p => { const e = extOf(p); for (const k in KINDS_EXT) if (KINDS_EXT[k].includes(e)) return k; return 'other'; };
// timers that die with the studio (dispose clears them: a late one must not write into the next story's panes)
const TIMERS = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { TIMERS.delete(t); if (!GL.gone) fn(); }, ms); TIMERS.add(t); return t; };
const unlater = t => { if (t) { clearTimeout(t); TIMERS.delete(t); } };
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } } };

const SRC = { kind: '', base: '', token: '', folder: '', dflt: false, state: 'looking', note: '', scenes: [], save: false, es: null, gen: 0, retry: 0, noScenes: false };
// kind: 'relay' or 'folder'; state: 'looking', 'ok', 'auth' (the relay wants its password), 'none' (no relay and no
// folder of scenes), 'error'
const srcKey = () => (SRC.kind === 'relay' ? SRC.base : SRC.kind === 'folder' ? 'folder:' + SRC.folder : '');
const encPath = p => String(p).split('/').map(encodeURIComponent).join('/');
const sceneUrl = name => (SRC.kind === 'relay' ? `${SRC.base}/scenes/${encodeURIComponent(name)}/` : `${SRC.folder}/${encodeURIComponent(name)}/`);
// a file of the open scene: its address with its version (its time: a changed file is a new address, so no cache
// keeps the old one), and for the loaders the relay's password
function fileUrl(p, loader) {
  const f = STU.fileMap.get(p), q = [];
  if (loader && SRC.kind === 'relay' && SRC.token) q.push('token=' + encodeURIComponent(SRC.token));
  if (f && f.at) q.push('v=' + f.at);
  return sceneUrl(STU.scene) + encPath(p) + (q.length ? '?' + q.join('&') : '');
}
const AUTH_NOTE = 'This relay needs its password: enter it under Shared (or in the menu\'s Circles tab).';
// tell the shell what the relay answered (a 401 brings up its password prompts; an answer with the password accepted
// keeps it): the password the call carried ('' none) and its JSON, when it had any
const saw = (status, sent, j) => { try { if (SRC.kind === 'relay' && HOST.collab && HOST.collab.relaySaw) HOST.collab.relaySaw(SRC.base, status, sent || '', j || null); } catch (e) { /* an older shell */ } };
// a call: the relay's password as a header (never in the address), the error's status kept
async function call(url, o = {}) {
  const relay = SRC.kind === 'relay' && url.startsWith(SRC.base), headers = Object.assign({}, o.headers || {});
  if (relay && SRC.token) headers.Authorization = 'Bearer ' + SRC.token;
  let r;
  try { r = await fetch(url, { method: o.method || 'GET', headers, body: o.body, cache: o.cache || 'no-store' }); } catch (e) { throw Object.assign(new Error('could not be reached'), { status: 0 }); }
  if (!r.ok) {
    let j = null;
    try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (relay) saw(r.status, SRC.token, j);
    throw Object.assign(new Error((j && j.error) || 'HTTP ' + r.status), { status: r.status });
  }
  if (relay) saw(r.status, SRC.token);
  return r;
}
const getJSON = async (url, o) => (await call(url, o)).json();
// the bytes of a file, with its progress (n bytes so far)
async function getBytes(url, onN) {
  const r = await call(url, { cache: 'no-cache' });
  if (!r.body || !r.body.getReader) return r.arrayBuffer();
  const rd = r.body.getReader(), parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    parts.push(value); n += value.length;
    if (onN) onN(n);
    if (GL.gone) { try { rd.cancel(); } catch (e) { /* gone */ } throw new Error('gone'); }
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}

// the page's own server, when it is a relay that serves scenes (a shell without HOST.collab.relayFind)
async function ownRelay() {
  if (!/^https?:$/.test(location.protocol)) return null;
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = later(() => ac && ac.abort(), 3000);
  try {
    const r = await fetch(location.origin + '/api/ping', { cache: 'no-store', signal: ac ? ac.signal : undefined });
    const j = r.ok ? await r.json() : null;
    return j && j.scenes ? { base: location.origin, token: '' } : null;
  } catch (e) { return null; } finally { unlater(t); }
}
// find where scenes come from, then list them (and again: a password given meanwhile, Look again)
async function findSource() {
  const gen = ++SRC.gen;
  unlater(SRC.retry); SRC.retry = 0;
  SRC.state = 'looking'; SRC.note = ''; SRC.noScenes = false;
  dirty();
  let r = null;
  if (!OPT.scenes) {
    try { r = HOST.collab && HOST.collab.relayFind ? await HOST.collab.relayFind() : await ownRelay(); } catch (e) { r = null; }
  }
  if (gen !== SRC.gen || GL.gone) return;
  const was = srcKey();
  if (r && r.base) Object.assign(SRC, { kind: 'relay', base: String(r.base).replace(/\/+$/, ''), token: r.token || '', folder: '', dflt: false });
  else Object.assign(SRC, { kind: 'folder', base: '', token: '', folder: OPT.scenes || 'scenes', dflt: !OPT.scenes });
  if (srcKey() !== was) watchStop();
  await listScenes(gen);
}
async function listScenes(gen) {
  try {
    const j = await getJSON(SRC.kind === 'relay' ? SRC.base + '/api/scenes' : SRC.folder + '/index.json');
    if (gen !== SRC.gen || GL.gone) return;
    SRC.scenes = (j && Array.isArray(j.scenes) ? j.scenes : []).filter(s => s && okScene(s.name))
      .map(s => ({ name: s.name, files: +s.files || 0, bytes: +s.bytes || 0, at: +s.at || 0, layout: !!s.layout }));
    SRC.save = SRC.kind === 'relay' && !!(j && j.save);
    SRC.state = 'ok'; SRC.note = '';
    if (SRC.kind === 'relay') watchStart();
  } catch (e) {
    if (gen !== SRC.gen || GL.gone) return;
    SRC.scenes = [];
    // a relay that serves no scenes: a folder next to the app may still have some
    if (SRC.kind === 'relay' && e.status === 404) { SRC.noScenes = true; Object.assign(SRC, { kind: 'folder', base: '', token: '', folder: 'scenes', dflt: true }); return listScenes(gen); }
    SRC.state = e.status === 401 ? 'auth' : SRC.kind === 'folder' && SRC.dflt && (e.status === 404 || e.status === 0) ? 'none' : 'error';
    SRC.note = SRC.state === 'auth' ? AUTH_NOTE : e.message;
    // the password given meanwhile (the shell keeps it): asked again every few seconds while it is wanted
    if (SRC.state === 'auth') SRC.retry = later(findSource, 5000);
  }
  if (STU.scene && STU.listing !== 'ok' && SRC.state === 'ok') loadScene();
  chooseScene();
  dirty();
}
// the scene opened by itself: at a shared room's station only when the listing has exactly one (else Pick a scene: the
// station's scene is for everyone there); outside a room the link's, else the last used here, else the only one
const lastKey = () => 'studioLast.' + srcKey();
function chooseScene() {
  if (STU.scene || SRC.state !== 'ok') return;
  const names = SRC.scenes.map(s => s.name), last = store.get(lastKey());
  let pick = '';
  if (atStation()) { if (names.length === 1) pick = names[0]; }
  else pick = (names.includes(OPT.scene) ? OPT.scene : '') || (names.includes(last) ? last : '') || (names.length === 1 ? names[0] : '');
  if (pick) openScene(pick, 'auto');
}
// at a shared room's station of the studio (a headset at its circle, a page following it): the scene and what is
// placed are the station's, for everyone there
function atStation() {
  try { const st = HOST.collab && HOST.collab.live && HOST.collab.live(); return !!(st && st.story === XR_HERE); } catch (e) { return false; }
}

// ------------------------------------------------------------- the scene --
// Open a scene: what was placed goes, its listing and saved layout are read. how: 'pick' (by hand) or 'auto' (by
// itself) write the saved layout as the items; 'room' (the station's scene, from the room) does not: the room's state
// carries the items, and only the device that changed the scene writes them
function openScene(name, how) {
  name = okScene(name) ? name : '';
  if (name === STU.scene && how !== 'again') return;
  draftNow();
  clearItems();
  Object.assign(STU, { scene: name, listing: name ? 'loading' : 'none', files: [], fileMap: new Map(), saved: '', savedAt: 0, savedBy: '', layoutAt: 0,
    bad: 0, note: '', saveNote: '', saving: false, draft: null, sel: '', hover: '', pick: null, write: how !== 'room', t0: performance.now(), loadAsk: 0, upNote: '' });
  STU.seen.clear(); UNDO.length = 0;
  if (name && how !== 'room' && !atStation()) store.set(lastKey(), name);
  if (name) loadScene();
  dirty(true);
}
async function loadScene() {
  const gen = ++STU.gen, name = STU.scene;
  if (!name) return;
  if (SRC.state !== 'ok') { STU.listing = 'waiting'; return; }   // (listScenes loads it once the source answers)
  STU.listing = 'loading';
  try {
    let j, layout = null;
    if (SRC.kind === 'relay') { j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}`); layout = j.layout || null; if (j.save !== undefined) SRC.save = !!j.save; }
    else {
      j = await getJSON(`${SRC.folder}/${encodeURIComponent(name)}/files.json`);
      if (Array.isArray(j && j.files) && j.files.some(f => f && f.path === 'layout.json')) { try { layout = await getJSON(`${SRC.folder}/${encodeURIComponent(name)}/layout.json`); } catch (e) { layout = null; } }
    }
    if (gen !== STU.gen || GL.gone) return;
    setFiles(j && j.files);
    STU.layoutAt = +(j && j.layoutAt) || 0;
    STU.listing = 'ok';
    const L = readLayout(layout);
    STU.saved = keyOf(L.items); STU.savedAt = L.at || STU.layoutAt; STU.savedBy = L.by; STU.bad = L.bad;
    if (STU.write) { STU.write = false; for (const x of L.items) putItem(x.id, x.kind, x.rec); }
    if (!atStation()) offerDraft();
    for (const it of STU.items.values()) itemFile(it);   // (items the room placed before the listing came)
  } catch (e) {
    if (gen !== STU.gen || GL.gone) return;
    STU.listing = e.status === 404 ? 'missing' : e.status === 401 ? 'auth' : 'error';
    STU.note = e.status === 404 ? `This device cannot find the scene ${name}: its items keep their places as grey boxes.` : e.status === 401 ? AUTH_NOTE : 'The scene could not be read: ' + e.message;
    if (e.status === 401) { SRC.state = 'auth'; SRC.note = AUTH_NOTE; unlater(SRC.retry); SRC.retry = later(findSource, 5000); }
  }
  dirty(true);
}
// the scene's listing: [{ path, bytes, at, kind }], at most 2,000, only paths a layout may name
function setFiles(list) {
  const out = [];
  for (const f of Array.isArray(list) ? list : []) {
    if (!f || !okFile(f.path) || out.length >= 2000) continue;
    out.push({ path: f.path, bytes: +f.bytes || 0, at: +f.at || 0, kind: ['model', 'audio', 'image', 'data', 'other'].includes(f.kind) ? f.kind : kindOf(f.path) });
  }
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  STU.files = out; STU.fileMap = new Map(out.map(f => [f.path, f]));
}
// the listing again (a file added, changed or gone: the watch), then what uses a changed file loaded again
async function refreshFiles(changed) {
  const gen = STU.gen, name = STU.scene;
  if (!name || SRC.state !== 'ok') return;
  try {
    const j = SRC.kind === 'relay' ? await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}`) : await getJSON(`${SRC.folder}/${encodeURIComponent(name)}/files.json`);
    if (gen !== STU.gen || GL.gone) return;
    const old = STU.fileMap;
    setFiles(j && j.files);
    if (STU.listing !== 'ok') { STU.listing = 'ok'; STU.note = ''; }
    for (const f of STU.files) { const o = old.get(f.path); if (!o || o.at !== f.at || o.bytes !== f.bytes) changed.add(f.path); }
    for (const p of old.keys()) if (!STU.fileMap.has(p)) changed.add(p);
    for (const p of changed) fileChanged(p);
    for (const it of STU.items.values()) itemFile(it);
  } catch (e) { /* the next event tries again */ }
  dirty();
}

// ------------------------------------------------------------- the layout --
// layout.json (also what Download gives and Upload takes): { studio: 1, scene, saved, objects, cubes, sounds }, each item
// with its id and its record. Read: every item checked (bad ones dropped and counted, the limits kept), a cube's lists
// naming only this scene's items
const LIMITS = { o: 300, c: 100, s: 60 };
function readLayout(j) {
  const out = { items: [], bad: 0, at: 0, by: '' };
  if (!j || typeof j !== 'object') return out;
  if (j.studio !== 1) { out.bad = 1; return out; }
  out.at = Date.parse(j.saved) || 0;
  out.by = typeof j.by === 'string' ? j.by.slice(0, 40) : '';
  const ids = new Set();
  for (const [kind, list] of [['o', j.objects], ['c', j.cubes], ['s', j.sounds]]) {
    if (list === undefined) continue;
    if (!Array.isArray(list)) { out.bad++; continue; }
    let n = 0;
    for (const x of list) {
      const id = x && okId(x.id) && !ids.has(x.id) ? x.id : '', rec = id && n < LIMITS[kind] ? norm(kind, x) : null;
      if (!rec) { out.bad++; continue; }
      ids.add(id); n++;
      out.items.push({ id, kind, rec });
    }
  }
  for (const x of out.items) if (x.kind === 'c') { x.rec.show = x.rec.show.filter(i => ids.has(i)); x.rec.hide = x.rec.hide.filter(i => ids.has(i)); }
  return out;
}
// what is placed now, as layout.json
function layoutOut() {
  const L = { studio: 1, scene: STU.scene, saved: new Date().toISOString() };
  const by = HOST.collab && HOST.collab.joined && HOST.collab.name;
  if (by) L.by = String(by).slice(0, 40);
  const list = k => [...STU.items.values()].filter(it => it.kind === k).map(it => Object.assign({ id: it.id }, it.rec));
  L.objects = list('o'); L.cubes = list('c'); L.sounds = list('s');
  return L;
}
// a list of items (or what is placed) as one string, to tell whether two are the same
function keyOf(items) {
  const L = items ? items.map(x => [x.id, x.kind, x.rec]) : [...STU.items.values()].map(it => [it.id, it.kind, it.rec]);
  L.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return JSON.stringify(L);
}
const unsaved = () => STU.listing === 'ok' && keyOf() !== STU.saved;
// the items of a layout in place of what is placed (Load saved, Upload, Restore), as one change Undo takes back
function putLayout(items) {
  change(() => {
    const keep = new Set(items.map(x => x.id));
    for (const id of [...STU.items.keys()]) if (!keep.has(id)) removeItem(id);
    for (const x of items) putItem(x.id, x.kind, x.rec);
  });
}

// ------------------------------------------------------------------ saving --
// The relay writes layout.json (the old one kept in .history/); what is placed now, for everyone at a station
const canSave = () => SRC.kind === 'relay' && SRC.save && STU.listing === 'ok' && !!STU.scene && !OPT.visit;
async function saveLayout() {
  if (!canSave() || STU.saving) return;
  const body = JSON.stringify(layoutOut()), key = keyOf(), name = STU.scene, gen = STU.gen;
  STU.saving = true; STU.saveNote = ''; dirty(true);
  try {
    const j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (gen !== STU.gen) return;
    STU.saved = key; STU.savedAt = +(j && j.at) || Date.now(); STU.savedBy = ''; STU.mine = STU.savedAt;
    draftDrop();
    sfxAct('ping', 'stage', 'centre', { gain: 0.6 });
  } catch (e) {
    if (gen !== STU.gen) return;
    STU.saveNote = e.status === 403 ? 'This relay does not save layouts (it runs with --scenes-readonly).' : e.status === 401 ? AUTH_NOTE
      : e.status === 413 ? 'Not saved: the layout is too big (2 MB at most).' : 'Not saved: ' + e.message;
  } finally { if (gen === STU.gen) STU.saving = false; dirty(true); }
}
// Load saved (two presses): the saved layout in place of what is placed
async function loadSaved() {
  const now = performance.now();
  if (now - STU.loadAsk > 4000) { STU.loadAsk = now; dirty(true); later(() => dirty(true), 4100); return; }
  STU.loadAsk = 0;
  const gen = STU.gen, name = STU.scene;
  try {
    const layout = SRC.kind === 'relay' ? (await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}`)).layout : await getJSON(`${SRC.folder}/${encodeURIComponent(name)}/layout.json`);
    if (gen !== STU.gen) return;
    const L = readLayout(layout);
    putLayout(L.items);
    STU.saved = keyOf(L.items); STU.savedAt = L.at || STU.savedAt; STU.savedBy = L.by; STU.bad = L.bad;
  } catch (e) { STU.saveNote = e.status === 404 ? 'This scene has no saved layout yet.' : 'The saved layout could not be read: ' + e.message; }
  dirty(true);
}
// Download layout.json (page only): what is placed now, as a file (also kept for the tests: STUDIO.download)
function downloadLayout() {
  const text = JSON.stringify(layoutOut(), null, 2), url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  STUDIO.download = text;
  const a = document.createElement('a');
  a.href = url; a.download = 'layout.json';
  document.body.appendChild(a); a.click(); a.remove();
  later(() => URL.revokeObjectURL(url), 4000);
}
// Upload: a layout.json from this computer in place of what is placed (Save then writes it on the relay)
function uploadLayout(text) {
  let j = null;
  try { j = JSON.parse(text); } catch (e) { j = null; }
  if (!j || j.studio !== 1) { STU.upNote = 'That file is not a studio layout (layout.json with "studio": 1).'; dirty(true); return; }
  const L = readLayout(j);
  putLayout(L.items);
  STU.upNote = `Read ${L.items.length} item${L.items.length === 1 ? '' : 's'}` + (L.bad ? `; ${L.bad} could not be read.` : '.') + (j.scene && j.scene !== STU.scene ? ` (It was saved for the scene ${String(j.scene).slice(0, 64)}.)` : '');
  dirty(true);
}

// ------------------------------------------------------------------ drafts --
// Outside a room what is placed is kept on this device too, a second after each change; opening the scene again with a
// draft newer than the saved layout and different from it offers it back
const draftKey = () => 'studioDraft.' + srcKey() + '.' + STU.scene;
let draftT = 0;
function draftSoon() { if (!draftT) draftT = later(() => { draftT = 0; draftNow(); }, 1000); }
function draftNow() {
  unlater(draftT); draftT = 0;
  if (!STU.scene || STU.listing !== 'ok' || atStation() || OPT.visit) return;
  if (!unsaved()) { draftDrop(); return; }
  store.set(draftKey(), JSON.stringify({ at: Date.now(), items: [...STU.items.values()].map(it => [it.id, it.kind, it.rec]) }));
}
function draftDrop() { if (STU.scene) store.set(draftKey(), null); }
function offerDraft() {
  let d = null;
  try { d = JSON.parse(store.get(draftKey()) || 'null'); } catch (e) { d = null; }
  if (!d || !Array.isArray(d.items) || !(d.at > STU.savedAt)) return;
  const items = d.items.filter(x => Array.isArray(x) && okId(x[0]) && LIMITS[x[1]]).map(x => ({ id: x[0], kind: x[1], rec: norm(x[1], x[2]) })).filter(x => x.rec);
  const k = keyOf(items);
  if (k === STU.saved || k === keyOf()) return;
  STU.draft = { at: d.at, items };
}
function draftRestore() { const d = STU.draft; STU.draft = null; if (d) putLayout(d.items); dirty(true); }
function draftDiscard() { STU.draft = null; draftDrop(); dirty(true); }

// ------------------------------------------------------------------- watch --
// The relay tells the page when a file of a scene is added, changed or removed, and when a layout is saved: the Add
// lists follow, a changed model or sound is fetched again and its items rebuilt in place, and another device's save
// moves what Unsaved changes compares with (it never replaces what is placed)
function watchStart() {
  if (SRC.es || SRC.kind !== 'relay' || typeof EventSource === 'undefined' || GL.gone) return;
  let es;
  try { es = new EventSource(`${SRC.base}/api/scenes/watch` + (SRC.token ? '?token=' + encodeURIComponent(SRC.token) : '')); } catch (e) { return; }
  SRC.es = es;
  const data = ev => { try { return JSON.parse(ev.data); } catch (e) { return null; } };
  es.addEventListener('scene', ev => { const d = data(ev); if (d) onFileEvent(d); });
  es.addEventListener('layout', ev => { const d = data(ev); if (d) onLayoutEvent(d); });
  es.onerror = () => { if (es.readyState === 2 && SRC.es === es) { SRC.es = null; later(watchStart, 10000); } };
}
function watchStop() { if (SRC.es) { try { SRC.es.close(); } catch (e) { /* closed */ } SRC.es = null; } }
let fileT = 0, scenesT = 0;
const fileQ = new Set();
function onFileEvent(d) {
  if (!d || !okScene(d.name)) return;
  // the list of scenes (a new scene, a count) a moment later
  if (!scenesT) scenesT = later(() => { scenesT = 0; listScenes(SRC.gen); }, 600);
  if (d.name !== STU.scene) return;
  if (okFile(d.path)) fileQ.add(d.path);
  if (!fileT) fileT = later(() => { fileT = 0; const s = new Set(fileQ); fileQ.clear(); refreshFiles(s); }, 300);
}
async function onLayoutEvent(d) {
  if (!d || d.name !== STU.scene || !STU.scene) return;
  if (STU.mine && Math.abs((+d.at || 0) - STU.mine) < 2) return;   // (our own save)
  const gen = STU.gen;
  try {
    const j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(STU.scene)}`);
    if (gen !== STU.gen) return;
    const L = readLayout(j.layout);
    STU.saved = keyOf(L.items); STU.savedAt = L.at || +d.at || Date.now(); STU.savedBy = L.by;
  } catch (e) { /* the next save says it again */ }
  dirty(true);
}

// ================================================================= MODELS ==
// One entry per model file of the scene: fetched and parsed once (GLTF/GLB with three.js's GLTFLoader, FBX with its
// FBXLoader), then cloned for every object that places it (SkeletonUtils for a rigged one), each clone with its own
// materials (so each fades on its own) and its own AnimationMixer. Textures a file names but does not hold are looked
// for in the scene's listing (the exact path, else the base name, case aside: an FBX's C:\Users\... path is ignored);
// one not there leaves the model untextured and its card says so. Textures larger than OPT.maxtex (4,096 px) on a side
// are drawn down before they reach the GPU. A file no object uses any more is dropped and its memory freed.
const LIB = new Map();   // path -> entry
const TEX_KEYS = ['map', 'emissiveMap', 'normalMap', 'bumpMap', 'specularMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'lightMap', 'displacementMap'];
// what a texture not found becomes while the model loads: a tiny white picture (3 x 1, so it is told apart), dropped after
const MISSING = (() => { const c = document.createElement('canvas'); c.width = 3; c.height = 1; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 3, 1); return c.toDataURL(); })();
function lib(path) {
  let E = LIB.get(path);
  if (!E) {
    E = { path, state: 'idle', p: 0, root: null, clips: [], info: null, guess: null, users: new Set(), gen: 0, texPaths: new Set(), missing: new Set(), err: '', drop: 0, ms: null };
    LIB.set(path, E);
  }
  if (E.drop) { unlater(E.drop); E.drop = 0; }
  if (E.state === 'idle' && STU.fileMap.has(path)) libLoad(E);
  return E;
}
// an object no longer uses its file: a file nobody uses is dropped a few seconds later (Undo may want it back)
function libRelease(E, id) {
  if (!E) return;
  E.users.delete(id);
  if (!E.users.size && !E.drop) E.drop = later(() => { E.drop = 0; if (!E.users.size) libDrop(E); }, 5000);
}
function libDrop(E) {
  E.gen++;
  if (E.root) disposeTree(E.root, true);
  E.root = null; E.state = 'idle';
  LIB.delete(E.path);
}
function disposeTree(root, textures) {
  const seen = new Set();
  root.traverse(o => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    for (const m of [].concat(o.material || [])) {
      if (seen.has(m)) continue;
      seen.add(m);
      if (textures) for (const k of TEX_KEYS) if (m[k] && m[k].isTexture && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); }
      m.dispose();
    }
  });
}
// a changed file (the relay's watch): a model fetched again (its objects rebuilt in place once it is in), the models
// that used a changed texture too, a sound decoded again
function fileChanged(p) {
  const E = LIB.get(p);
  if (E && E.users.size) { if (STU.fileMap.has(p)) libLoad(E); else { E.gen++; E.state = 'missing'; libChanged(E); } }
  for (const M of LIB.values()) if (M !== E && M.users.size && M.texPaths.has(p) && STU.fileMap.has(M.path)) libLoad(M);
  emitChanged(p);
}
const libChanged = () => { STU.libRev++; dirty(); };
async function libLoad(E) {
  const gen = ++E.gen, f = STU.fileMap.get(E.path), scene = STU.scene, t0 = performance.now();
  E.state = 'loading'; E.p = 0; E.err = '';
  libChanged(E);
  try {
    const buf = await getBytes(fileUrl(E.path), n => { if (gen === E.gen) E.p = f && f.bytes ? Math.min(0.99, n / f.bytes) : 0; });   // (the grey box shows it)
    if (gen !== E.gen || scene !== STU.scene || GL.gone) return;
    E.state = 'parsing'; libChanged(E);
    await new Promise(r => later(r, 60));   // (the grey box says "Reading" before parsing stalls the page)
    if (gen !== E.gen || scene !== STU.scene || GL.gone) return;
    const t1 = performance.now(), missing = new Set(), texPaths = new Set();
    const res = await parseModel(E, buf, missing, texPaths);
    if (gen !== E.gen || scene !== STU.scene || GL.gone) { if (res && res.root) disposeTree(res.root, true); return; }
    const old = E.root;
    E.missing = missing; E.texPaths = texPaths;
    finishModel(E, res);
    E.ms = { fetch: Math.round(t1 - t0), parse: Math.round(performance.now() - t1) };
    E.state = 'ready';
    if (old) later(() => disposeTree(old, true), 0);   // (the items rebuild from the new one this frame)
  } catch (e) {
    if (gen !== E.gen) return;
    E.state = 'failed';
    E.err = whyFailed(e);
    if (!GL.gone) console.warn('The studio could not load', E.path, e && e.message);
  }
  libChanged(E);
}
// in words, what a failed file says (the card shows it)
function whyFailed(e) {
  const m = String((e && e.message) || e || '');
  if (/DRACOLoader|draco/i.test(m)) return 'Compressed with Draco, which the studio cannot read: export it without mesh compression.';
  if (/meshopt/i.test(m)) return 'Compressed with meshopt, which the studio cannot read: export it without compression.';
  if (/basisu|KTX2/i.test(m)) return 'Its textures are KTX2/Basis, which the studio cannot read: export PNG or JPEG textures.';
  if (/FBX version not supported/i.test(m)) return 'An FBX older than version 7, which the studio cannot read: export it as FBX 2011 or newer.';
  if (/Unknown format/i.test(m)) return 'Not a model the studio can read (an FBX or a glTF file).';
  if (e && e.status === 404) return 'The file is not in the scene\'s folder any more.';
  if (e && e.status === 401) return AUTH_NOTE;
  return 'It could not be read: ' + m.slice(0, 160);
}
function parseModel(E, buf, missing, texPaths) {
  const ext = extOf(E.path), dir = E.path.includes('/') ? E.path.slice(0, E.path.lastIndexOf('/') + 1) : '', base = sceneUrl(STU.scene) + encPath(dir);
  const manager = new THREE.LoadingManager(), W = { n: 0, done: null };
  // what the model asks for (textures, a .gltf's buffers): it is ready once each has come or failed
  const s0 = manager.itemStart.bind(manager), e0 = manager.itemEnd.bind(manager);
  manager.itemStart = u => { W.n++; s0(u); };
  manager.itemEnd = u => { e0(u); if (--W.n <= 0 && W.done) W.done(); };
  manager.setURLModifier(u => resolveUrl(u, base, dir, missing, texPaths));
  manager.addHandler(/\.tga$/i, new THREE.TGALoader(manager));
  const settle = () => new Promise(res => { if (W.n <= 0) res(); else { W.done = res; later(res, 60000); } });
  if (ext === 'fbx') {
    const guess = fbxGuess(buf);
    const root = new THREE.FBXLoader(manager).parse(buf, base);
    return settle().then(() => ({ root, clips: root.animations || [], guess }));
  }
  return new Promise((res, rej) => { new THREE.GLTFLoader(manager).parse(buf, base, res, rej); })
    .then(g => settle().then(() => ({ root: g.scene || (g.scenes && g.scenes[0]), clips: g.animations || [], guess: { unit: 100, up: 1, sign: 1, gltf: true } })));
}
// what a model file names (a texture, a buffer), as a file of the scene: the path it gives (beside the model, or from the
// scene's top), else any file of the scene with its base name; never anything outside the scene
function resolveUrl(u, base, dir, missing, texPaths) {
  if (/^(blob|data):/i.test(u)) return u;
  let rel = (u.startsWith(base) ? u.slice(base.length) : u).split(/[?#]/)[0];
  try { rel = decodeURIComponent(rel); } catch (e) { /* as it is */ }
  rel = rel.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  let f = /^[a-z][a-z0-9+.-]*:/i.test(rel) || rel.startsWith('/') ? null : STU.fileMap.get(dir + rel) || STU.fileMap.get(rel);
  if (!f) { const b = baseName(rel).toLowerCase(); f = b ? STU.files.find(x => x.kind !== 'model' && baseName(x.path).toLowerCase() === b) : null; }
  if (f) { texPaths.add(f.path); return fileUrl(f.path, true); }
  missing.add(baseName(rel) || rel);
  return MISSING;
}
// An FBX's units and up axis, read from its bytes (the loader ignores them): GlobalSettings' UnitScaleFactor (cm per
// unit) and UpAxis, UpAxisSign. Binary: each is a P record of four strings and a number (the name's length before it
// tells "UnitScaleFactor" from "OriginalUnitScaleFactor"); ASCII: a line P: "UnitScaleFactor", "double", ..., 1
function fbxGuess(buf) {
  const out = { unit: 1, up: 1, sign: 1, gltf: false, read: false };
  const u8 = new Uint8Array(buf), n = Math.min(u8.length, 4 << 20);   // (GlobalSettings comes near the start)
  let s = '';
  for (let i = 0; i < n; i += 65536) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(n, i + 65536)));
  const dv = new DataView(buf);
  if (s.startsWith('Kaydara FBX Binary')) {
    const prop = name => {
      const L = name.length, pat = 'S' + String.fromCharCode(L & 255, (L >> 8) & 255, 0, 0) + name;
      let i = s.indexOf(pat);
      if (i < 0) return null;
      i += pat.length;
      for (let k = 0; k < 3; k++) { if (u8[i] !== 0x53) return null; i += 5 + dv.getUint32(i + 1, true); }
      const t = String.fromCharCode(u8[i]);
      return t === 'D' ? dv.getFloat64(i + 1, true) : t === 'F' ? dv.getFloat32(i + 1, true) : t === 'I' ? dv.getInt32(i + 1, true)
        : t === 'Y' ? dv.getInt16(i + 1, true) : t === 'L' ? Number(dv.getBigInt64(i + 1, true)) : null;
    };
    const u = prop('UnitScaleFactor'), a = prop('UpAxis'), g = prop('UpAxisSign');
    if (Number.isFinite(u) && u > 0) { out.unit = u; out.read = true; }
    if ([0, 1, 2].includes(a)) out.up = a;
    if (g === -1) out.sign = -1;
  } else {
    const num = name => { const m = new RegExp('P:\\s*"' + name + '"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*([-+0-9.eE]+)').exec(s); return m ? +m[1] : null; };
    const u = num('UnitScaleFactor'), a = num('UpAxis'), g = num('UpAxisSign');
    if (Number.isFinite(u) && u > 0) { out.unit = u; out.read = true; }
    if ([0, 1, 2].includes(a)) out.up = a;
    if (g === -1) out.sign = -1;
  }
  return out;
}
// a model loaded: textures settled (missing ones dropped, big ones drawn down, each shown as it is), what its card says
// (triangles, textures, clips, its size in its own units), and its starting scale and turn
function finishModel(E, res) {
  const root = res.root;
  if (!root) throw new Error('the file has no scene in it');
  root.updateMatrixWorld(true);
  let tris = 0, rigged = false, normals = true;
  const mats = new Set();
  root.traverse(o => {
    if (o.isSkinnedMesh) rigged = true;
    if (o.isMesh && o.geometry) {
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3;
      if (!g.attributes.normal) normals = false;
      o.frustumCulled = !o.isSkinnedMesh;   // (a skinned mesh's box does not follow its pose)
    }
    for (const m of [].concat(o.material || [])) mats.add(m);
  });
  const texs = new Map();
  for (const m of mats) {
    for (const k of TEX_KEYS) {
      const t = m[k];
      if (!t || !t.isTexture) continue;
      const img = t.image;
      if (!img || !img.width || (img.width === 3 && img.height === 1 && E.missing.size)) { m[k] = null; m.needsUpdate = true; continue; }
      t.encoding = THREE.LinearEncoding;   // (drawn as the picture is: the renderer's output is linear)
      if (!texs.has(t)) texs.set(t, capTexture(t));
    }
    if (m.isMeshStandardMaterial) m.needsUpdate = true;
  }
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const size = box.getSize(new THREE.Vector3()), tl = [...texs.values()];
  E.root = root; E.clips = res.clips || []; E.rigged = rigged;
  E.info = {
    tris: Math.round(tris), textures: tl, clips: E.clips.map(c => [c.name, c.duration]), materials: mats.size, rigged,
    box: [box.min.toArray(), box.max.toArray()], own: size.toArray(),
    // photogrammetry (one textured material, many triangles or no normals): its light is in its texture
    scan: mats.size === 1 && tl.length >= 1 && !rigged && (!normals || tris >= 50000),
  };
  E.guess = guessFor(res.guess, size);
}
// a texture larger than the cap on a side, drawn down to it (keeping its shape) before it reaches the GPU
function capTexture(t) {
  const img = t.image, w = img.width, h = img.height, cap = OPT.maxtex;
  const src = typeof img.src === 'string' && !/^(blob|data):/.test(img.src) ? baseName(img.src.split(/[?#]/)[0]) : '';
  const out = { name: t.name || src || 'inside the file', w, h, to: 0 };
  if (Math.max(w, h) <= cap) return out;
  const k = cap / Math.max(w, h), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const x = cv.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, cw, ch);
  if (typeof img.close === 'function') img.close();   // (an ImageBitmap's memory back at once)
  t.image = cv; t.needsUpdate = true;
  out.to = Math.max(cw, ch);
  return out;
}
// The scale and turn a file starts with (stored in the item from then on: a layout never changes when this guess does).
// FBX: its UnitScaleFactor (cm per unit) gives the scale factor / 100, and Z up a quarter turn about x; a scale is taken
// only when it makes the largest side 5 cm to 60 m, else 1 unit = 1 m when that does, else it is sized to 1 m. glTF is
// metres and Y up
const _ax = new THREE.Vector3(1, 0, 0), _az = new THREE.Vector3(0, 0, 1);
function guessFor(g, size) {
  const q = new THREE.Quaternion();
  if (g.up === 2) q.setFromAxisAngle(_ax, -Math.PI / 2 * g.sign);
  else if (g.up === 0) q.setFromAxisAngle(_az, Math.PI / 2 * g.sign);
  const L = Math.max(size.x, size.y, size.z) || 1;
  let s = [g.unit / 100, 1].find(c => L * c >= 0.05 && L * c <= 60);
  if (s === undefined) s = 1 / L;
  return { s: +s.toPrecision(4), q: q.toArray().map(v => Math.round(v * 1e4) / 1e4), unit: g.unit, up: g.up, read: g.read };
}
// a clone for one object: its own materials (lit as loaded; as scanned built when asked), its rest pose kept (an
// animation turned off goes back to it)
function libClone(E) {
  const o = E.rigged && THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(E.root) : E.root.clone(true);
  const meshes = [], rest = [], env = envMap();
  o.traverse(n => {
    rest.push([n, n.position.clone(), n.quaternion.clone(), n.scale.clone()]);
    if (!n.material) return;
    const one = m => {
      const c = m.clone();
      if (c.isMeshStandardMaterial && !c.envMap && env) { c.envMap = env; c.envMapIntensity = 0.8; }
      c.userData.base = { t: c.transparent, o: c.opacity, d: c.depthWrite };
      return c;
    };
    n.material = Array.isArray(n.material) ? n.material.map(one) : one(n.material);
    n.userData.lit = n.material;
    meshes.push(n);
  });
  return { o, meshes, rest };
}
// as scanned: unlit, its own colours (photogrammetry, whose light is in its texture)
function scanMat(m) {
  const c = new THREE.MeshBasicMaterial({
    map: m.map || null, color: m.map ? 0xffffff : (m.color || new THREE.Color(1, 1, 1)), vertexColors: !!m.vertexColors, side: m.side,
    transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest || 0, skinning: !!m.skinning, morphTargets: !!m.morphTargets,
  });
  c.userData.base = { t: c.transparent, o: c.opacity, d: c.depthWrite };
  return c;
}
// the card's numbers for an object as placed: its size in metres (its box turned and scaled), its triangles
const _bx = new THREE.Box3(), _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3();
function placedBox(E, q, s, out) {
  _bx.min.fromArray(E.info.box[0]); _bx.max.fromArray(E.info.box[1]);
  _bm.compose(new THREE.Vector3(), _bq.fromArray(q), _bs.set(s, s, s));
  return (out || new THREE.Box3()).copy(_bx).applyMatrix4(_bm);
}

// ================================================================= SOUNDS ==
// A sound file of the scene: fetched once (its bytes kept), decoded on the shell's one context (HOST.audio.fx(); never a
// context of its own) and again on a new one; at most 60 MB of decoded sound in a scene (the rest not loaded, said)
const SND = new Map();   // path -> { state: 'loading'|'bytes'|'decoding'|'ready'|'failed'|'over', bytes, buf, size, err, gen }
const SND_MAX = 60 << 20;
let sndTotal = 0;
function snd(path) {
  let F = SND.get(path);
  if (!F) { F = { path, state: 'idle', bytes: null, buf: null, size: 0, err: '', gen: 0, ctx: null }; SND.set(path, F); }
  if (F.state === 'idle' && STU.fileMap.has(path)) sndFetch(F);
  return F;
}
async function sndFetch(F) {
  const gen = ++F.gen, scene = STU.scene;
  F.state = 'loading'; F.err = '';
  try {
    const b = await getBytes(fileUrl(F.path));
    if (gen !== F.gen || scene !== STU.scene || GL.gone) return;
    F.bytes = b; F.state = 'bytes';
  } catch (e) { if (gen === F.gen) { F.state = 'failed'; F.err = e.status === 404 ? 'The file is not in the scene\'s folder any more.' : 'It could not be fetched: ' + e.message; } }
  dirty();
}
// decoded for this context (once; again on a new context)
function sndDecode(F, ctx) {
  if (!F.bytes || F.state === 'decoding' || F.state === 'over' || (F.state === 'ready' && F.ctx === ctx)) return;
  const gen = F.gen;
  F.state = 'decoding'; F.ctx = ctx;
  let p;
  try { p = ctx.decodeAudioData(F.bytes.slice(0)); } catch (e) { p = Promise.reject(e); }
  Promise.resolve(p).then(buf => {
    if (gen !== F.gen || F.ctx !== ctx || GL.gone) return;
    const size = buf.length * buf.numberOfChannels * 4;
    if (sndTotal + size > SND_MAX) { F.state = 'over'; F.err = 'Not loaded: the scene\'s sounds would take more than 60 MB once decoded.'; dirty(); return; }
    sndTotal += size; F.size = size; F.buf = buf; F.state = 'ready';
    dirty();
  }, e => { if (gen === F.gen) { F.state = 'failed'; F.err = 'It could not be decoded (' + ((e && e.message) || 'not a sound this browser plays') + ').'; dirty(); } });
}
// a new context (or none): every decoded sound goes, to be decoded again on the new one
function sndForget() { for (const F of SND.values()) { F.buf = null; if (F.state === 'ready' || F.state === 'decoding') F.state = F.bytes ? 'bytes' : 'idle'; F.ctx = null; F.size = 0; } sndTotal = 0; }
function emitChanged(p) {
  const F = SND.get(p);
  if (!F) return;
  for (const it of STU.items.values()) if (it.kind === 's' && it.rec.file === p) emitStop(it, true);
  if (F.size) sndTotal -= F.size;
  SND.delete(p);
}
function sndClear() { SND.clear(); sndTotal = 0; }

// ================================================================== ITEMS ==
// What is placed in the scene: objects (a model file placed once; one file may be placed many times), trigger cubes
// and sounds. Each has a record (as in layout.json, without its id), checked the same way wherever it comes from (the
// layout, the room, an edit here), so a record taken and given back is the same. Records are never changed in place:
// each change is a new record (the shared room keeps the old one to compare with).
const STU = {
  scene: '', listing: 'none', files: [], fileMap: new Map(), items: new Map(),
  saved: '', savedAt: 0, savedBy: '', layoutAt: 0, bad: 0, note: '', saveNote: '', upNote: '', saving: false, loadAsk: 0, draft: null, mine: 0,
  sel: '', hover: '', pick: null, edit: false, gen: 0, write: false, t0: performance.now(), seen: new Set(), act: 0, libRev: 0, rev: 0, head: null,
};
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 1e4) / 1e4;
const nz = v => (v === 0 ? 0 : v);   // (no -0)
const fin = v => typeof v === 'number' && isFinite(v);
const okId = s => typeof s === 'string' && /^[a-z0-9]{6}$/.test(s);
const words = (s, n) => String(s).replace(/\s+/g, ' ').trim().slice(0, n);
const vecOf = (a, n, lim) => (Array.isArray(a) && a.length === n && a.every(v => fin(v) && Math.abs(v) <= lim) ? a : null);
// A record's checks. A field given with a wrong type makes the record bad (it is ignored, or dropped from a layout); a
// field left out takes its default; numbers are clamped and rounded (p to the mm, a turn to 4 decimals, a size to 4
// significant figures), and every check gives back what it is given once checked
function norm(kind, x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const has = k => x[k] !== undefined;
  const p = vecOf(x.p, 3, 1000);
  if (!p) return null;
  const P = p.map(v => nz(r3(v)));
  const name = d => (!has('name') ? d : typeof x.name === 'string' && x.name.trim() ? words(x.name, 60) : null);
  const one = (k, list, d) => (!has(k) ? d : list.includes(x[k]) ? x[k] : null);
  if (kind === 'o') {
    if (!okFile(x.file)) return null;
    let q = [0, 0, 0, 1];
    if (has('q')) {
      const v = vecOf(x.q, 4, 2), n = v ? Math.hypot(...v) : 0;
      if (!v || n < 1e-6) return null;
      q = (Math.abs(n - 1) > 2e-3 ? v.map(c => c / n) : v).map(c => nz(r4(c)));
    }
    if (has('s') && !(fin(x.s) && x.s > 0)) return null;
    const s = has('s') ? +Math.min(1e4, Math.max(1e-4, x.s)).toPrecision(4) : 1;
    const r = { name: name(stem(x.file)), file: x.file, p: P, q, s, light: one('light', ['lit', 'scan'], 'lit'), clip: !has('clip') ? '' : typeof x.clip === 'string' ? x.clip.slice(0, 120) : null,
      anim: one('anim', ['loop', 'once', 'off'], 'loop'), start: one('start', ['always', 'shown'], 'always') };
    return Object.values(r).includes(null) ? null : r;
  }
  if (kind === 'c') {
    const sz = has('size') ? vecOf(x.size, 3, 1000) : [1.2, 2, 1.2];
    if (!sz || (has('yaw') && !fin(x.yaw))) return null;
    let yaw = has('yaw') ? x.yaw : 0;
    if (Math.abs(yaw) > 3.1416) yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const ids = k => (!has(k) ? [] : Array.isArray(x[k]) ? [...new Set(x[k].filter(okId))].slice(0, 400) : null);
    const r = { name: name('Cube'), p: P, yaw: nz(r4(yaw)), size: sz.map(v => r3(Math.min(100, Math.max(0.05, v)))), mode: one('mode', ['while', 'stay'], 'while'), show: ids('show'), hide: ids('hide') };
    return Object.values(r).includes(null) ? null : r;
  }
  if (kind === 's') {
    if (!okFile(x.file) || (has('vol') && !fin(x.vol)) || (has('r') && !fin(x.r)) || (has('loop') && typeof x.loop !== 'boolean')) return null;
    const r = { name: name(stem(x.file)), file: x.file, p: P, vol: has('vol') ? r2(Math.min(2, Math.max(0, x.vol))) : 1, r: has('r') ? r2(Math.min(20, Math.max(0.1, x.r))) : 1.5,
      loop: has('loop') ? x.loop : true, start: one('start', ['always', 'shown'], 'always') };
    return Object.values(r).includes(null) ? null : r;
  }
  return null;
}
const KIND_NAME = { o: 'object', c: 'trigger cube', s: 'sound' };

// ------------------------------------------------------------ the items --
const BOX1 = new THREE.BoxGeometry(1, 1, 1), HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
// an item placed or changed: its record taken (glide: from the room, it glides there unless carried here)
function putItem(id, kind, rec, o) {
  let it = STU.items.get(id);
  if (it && it.kind !== kind) { removeItem(id); it = null; }
  if (!it) {
    if ([...STU.items.values()].filter(x => x.kind === kind).length >= LIMITS[kind]) return null;
    it = makeItem(id, kind);
    STU.items.set(id, it);
  }
  const was = it.rec;
  it.rec = rec;
  STU.rev++;
  applyRec(it, was, !!(o && o.glide) && !!was);
  return it;
}
function makeItem(id, kind) {
  const it = { id, kind, rec: null, holder: null, a: 0, sa: 0, shown: false, first: true, shownAt: performance.now(), gl: null, carry: false, act: false, since: 0, inside: false, ended: false };
  if (kind === 'o') {
    it.holder = new THREE.Group();
    it.slot = new THREE.Group(); it.holder.add(it.slot);
    it.grey = LOOKS.grey(); GL.items.add(it.grey.group);
    it.grey.group.userData.id = id;
    it.greyHit = new THREE.Mesh(BOX1, HIDDEN); it.greyHit.scale.setScalar(0.4); it.greyHit.position.y = 0.2; it.greyHit.userData.id = id;
    it.grey.group.add(it.greyHit);
    it.proxy = new THREE.Mesh(BOX1, HIDDEN); it.proxy.userData.id = id; it.proxy.visible = false;
    it.slot.add(it.proxy);
  } else if (kind === 'c') {
    it.look = LOOKS.cube(id);
    it.holder = it.look.body;
    it.look.fill.userData.id = id;
    for (const c of it.look.corners) c.userData.id = id;
    GL.edit.add(it.look.deco);
  } else {
    it.look = LOOKS.speaker(id);
    it.holder = it.look.group;
    it.look.hit.userData.id = id;
    GL.edit.add(it.look.ring);
  }
  it.holder.userData.id = id;
  GL.items.add(it.holder);
  return it;
}
function removeItem(id) {
  const it = STU.items.get(id);
  if (!it) return;
  STU.items.delete(id); STU.rev++;
  if (it.kind === 'o') { dropModel(it); libRelease(it.E, id); it.grey.group.parent && it.grey.group.parent.remove(it.grey.group); it.grey.drop(); }
  else { it.look.drop(); if (it.look.deco) GL.edit.remove(it.look.deco); if (it.look.ring) GL.edit.remove(it.look.ring); }
  if (it.kind === 's') emitStop(it);
  if (it.tick) { GL.edit.remove(it.tick); it.tick.userData.drop(); }
  if (it.holder.parent) it.holder.parent.remove(it.holder);
  if (GL.tc && GL.tc.object === it.holder) GL.tc.detach();
  if (STU.sel === id) STU.sel = '';
  if (STU.hover === id) STU.hover = '';
  for (const c of XR.ctrls || []) if (c.grab && c.grab.id === id) c.grab = null;
}
function clearItems() { for (const id of [...STU.items.keys()]) removeItem(id); emitAll(); sndClear(); }
// where a record puts its item: its place, turn and scale (a cube's scale is its size; it stays level)
const _pp = new THREE.Vector3(), _pq = new THREE.Quaternion(), _ps = new THREE.Vector3(), _yUp = new THREE.Vector3(0, 1, 0);
function poseOf(it) {
  const r = it.rec;
  _pp.fromArray(r.p);
  if (it.kind === 'o') { _pq.fromArray(r.q); _ps.setScalar(r.s); }
  else if (it.kind === 'c') { _pq.setFromAxisAngle(_yUp, r.yaw); _ps.fromArray(r.size); }
  else { _pq.identity(); _ps.set(1, 1, 1); }
}
function applyRec(it, was, glide) {
  if (glide && !it.carry) it.gl = { p: it.holder.position.clone(), q: it.holder.quaternion.clone(), s: it.holder.scale.clone(), t0: performance.now() };
  else if (!it.carry) { it.gl = null; poseOf(it); it.holder.position.copy(_pp); it.holder.quaternion.copy(_pq); it.holder.scale.copy(_ps); }
  const r = it.rec;
  if (it.kind === 'o') {
    if (!was || was.file !== r.file) itemFile(it);
    if (!was || was.light !== r.light) applyLight(it);
    if (!was || was.clip !== r.clip || was.anim !== r.anim || was.start !== r.start) it.animKey = '';
  } else if (it.kind === 'c') it.look.name.userData.set(r.name, it.look.col, 0.085);
  else {
    it.look.name.userData.set(r.name, it.look.col, 0.07);
    if (!was || was.file !== r.file) { emitStop(it); itemFile(it); }
    if (!was || was.loop !== r.loop || was.start !== r.start) { emitStop(it); it.ended = false; }
  }
}
// the file an item uses (once the scene's listing is known)
function itemFile(it) {
  if (STU.listing !== 'ok') return;
  if (it.kind === 'o') {
    const E = lib(it.rec.file);
    if (it.E !== E) { dropModel(it); libRelease(it.E, it.id); it.E = E; }
    E.users.add(it.id);
  } else if (it.kind === 's') it.F = snd(it.rec.file);
}
function dropModel(it) {
  if (!it.model) return;
  for (const m of it.model.meshes) {
    for (const k of ['lit', 'scan']) for (const mat of [].concat(m.userData[k] || [])) mat.dispose();
    m.userData.lit = m.userData.scan = null;
  }
  it.slot.remove(it.model.o);
  it.model = null; it.mixer = null; it.action = null; it.built = -1; it.animKey = '';
}
function buildModel(it) {
  const E = it.E;
  dropModel(it);
  const c = libClone(E);
  it.slot.add(c.o);
  it.model = c; it.built = E.gen; it.aSet = -1; it.light = ''; it.animKey = '';
  it.mixer = E.clips.length ? new THREE.AnimationMixer(c.o) : null;
  // what the pointer finds: an unseen box round it (in its own units, so it turns and scales with it)
  const b = E.info.box;
  it.proxy.position.set((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2);
  it.proxy.scale.set(Math.max(1e-4, b[1][0] - b[0][0]), Math.max(1e-4, b[1][1] - b[0][1]), Math.max(1e-4, b[1][2] - b[0][2]));
  applyLight(it);
  if (it.fresh) placeFresh(it, it.fresh);
}
// a file placed for the first time here: its units and up axis as its starting scale and turn, its lowest point on the
// floor with its middle where it was put, lit or as scanned, its first clip (stored in the record from then on)
function placeFresh(it, at) {
  it.fresh = null;
  const E = it.E;
  if (!E || !E.info) return;
  const g = E.guess, box = placedBox(E, g.q, g.s);
  const rec = norm('o', Object.assign({}, it.rec, {
    s: g.s, q: g.q, light: E.info.scan ? 'scan' : 'lit', clip: E.clips[0] ? E.clips[0].name : '',
    p: [at[0] - (box.min.x + box.max.x) / 2, -box.min.y, at[1] - (box.min.z + box.max.z) / 2],
  }));
  if (rec) putItem(it.id, 'o', rec);
  changed();
}
function applyLight(it) {
  if (!it.model) return;
  const mode = it.rec.light;
  for (const m of it.model.meshes) {
    if (mode === 'scan' && !m.userData.scan) m.userData.scan = Array.isArray(m.userData.lit) ? m.userData.lit.map(scanMat) : scanMat(m.userData.lit);
    m.material = mode === 'scan' ? m.userData.scan : m.userData.lit;
  }
  it.light = mode; it.aSet = -1;
}
// an object's fade: its materials' own opacity times a (see-through and not hiding what is behind while it fades)
function setObjAlpha(it, a) {
  if (Math.abs(a - it.aSet) < 1e-3) return;
  it.aSet = a;
  for (const m of it.model.meshes) for (const mat of [].concat(m.material)) {
    const b = mat.userData.base;
    if (!b) continue;
    if (a >= 0.999) { mat.transparent = b.t; mat.opacity = b.o; mat.depthWrite = b.d; } else { mat.transparent = true; mat.opacity = b.o * a; mat.depthWrite = false; }
  }
}
// its animation: the clip named in its record, looped, once (to its end, then held) or off (its rest pose), on the
// scene's clock (the same moment for everyone at a station) or from when a cube showed it to you
function animStep(it, now, clockS) {
  const r = it.rec, E = it.E;
  if (!it.mixer || !E) return;
  const key = r.clip + '|' + r.anim;
  if (key !== it.animKey) {
    it.animKey = key;
    it.mixer.stopAllAction();
    for (const [n, p, q, s] of it.model.rest) { n.position.copy(p); n.quaternion.copy(q); n.scale.copy(s); }
    const clip = r.anim !== 'off' ? E.clips.find(c => c.name === r.clip) : null;
    it.action = clip ? it.mixer.clipAction(clip) : null;
    if (it.action) it.action.play();
    it.dur = clip ? clip.duration : 0;
  }
  if (!it.action || !(it.dur > 0)) return;
  let t = r.start === 'shown' ? (now - it.shownAt) / 1000 : clockS;
  t = r.anim === 'loop' ? ((t % it.dur) + it.dur) % it.dur : Math.min(Math.max(0, t), it.dur - 1e-4);
  it.action.time = t;
  it.mixer.update(0);
}
// the scene's clock (s): at a shared room's station the room's (the same moment everywhere), else since it opened
function sceneClock(now) {
  try { if (atStation() && HOST.collab.now) return HOST.collab.now() / 1000; } catch (e) { /* not in a room */ }
  return (now - STU.t0) / 1000;
}

// --------------------------------------------------------- trigger cubes --
// Each person's own (never shared): a cube is active for you while your head is inside it (the headset's head; on a
// page the camera in Walk view; nobody in Orbit view); a 'stay' cube, once entered, until the scene opens again or
// Reset what I have seen. For an item: the active cubes that list it in show (S) and in hide (H): shown if S has any and
// H none, hidden if H has any and S none, both: the one that became active last decides; neither: hidden if any cube
// shows it (it waits for its cube), else shown
const _hp = new THREE.Vector3();
function headPoint(out) {
  if (STU.head) return out.fromArray(STU.head);
  if (XR.on && GL.renderer.xr.isPresenting) { GL.world.updateMatrixWorld(true); return GL.world.worldToLocal(out.copy(XR.head)); }
  if (APP.mode === 'explore' && X.view === 'walk') return out.copy(WALK.pos);
  return null;
}
function inCube(r, p) {
  const dx = p.x - r.p[0], dz = p.z - r.p[2], c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  return Math.abs(c * dx - s * dz) <= r.size[0] / 2 && Math.abs(p.y - r.p[1]) <= r.size[1] / 2 && Math.abs(s * dx + c * dz) <= r.size[2] / 2;
}
const LISTS = { rev: -1, shown: new Set() };
function triggerStep(now) {
  const hp = headPoint(_hp), S = new Map(), H = new Map();
  if (LISTS.rev !== STU.rev) { LISTS.rev = STU.rev; LISTS.shown = new Set(); for (const c of STU.items.values()) if (c.kind === 'c') for (const i of c.rec.show) LISTS.shown.add(i); }
  for (const c of STU.items.values()) {
    if (c.kind !== 'c') continue;
    c.inside = !!hp && inCube(c.rec, hp);
    if (c.inside && c.rec.mode === 'stay') STU.seen.add(c.id);
    const act = c.inside || (c.rec.mode === 'stay' && STU.seen.has(c.id));
    if (act && !c.act) c.since = ++STU.act;
    c.act = act;
    if (!act) continue;
    for (const i of c.rec.show) S.set(i, Math.max(S.get(i) || 0, c.since));
    for (const i of c.rec.hide) H.set(i, Math.max(H.get(i) || 0, c.since));
  }
  for (const it of STU.items.values()) {
    if (it.kind === 'c') continue;
    const s = S.get(it.id) || 0, h = H.get(it.id) || 0, shown = s || h ? s >= h : !LISTS.shown.has(it.id);
    if (shown && (!it.shown || it.first)) { it.shownAt = now; it.ended = false; if (it.kind === 's' && it.rec.start === 'shown') emitStop(it); }
    it.shown = shown; it.first = false;
  }
}
// what is shown for you with your head at p (the tests: [x, y, z] in the scene's frame, or null for nobody)
function shownFor(p) {
  STU.head = p ? p.slice(0, 3) : null;
  triggerStep(performance.now());
  return Object.fromEntries([...STU.items.values()].filter(it => it.kind !== 'c').map(it => [it.id, it.shown]));
}
function resetSeen() { STU.seen.clear(); for (const c of STU.items.values()) if (c.kind === 'c') c.act = false; dirty(true); }

// ----------------------------------------------------------- every frame --

const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
function itemsStep(dt, now) {
  const editing = editOn(), clockS = sceneClock(now), fade = dt / 0.4;
  triggerStep(now);
  for (const it of STU.items.values()) {
    // a record from the room: it glides there (0.25 s), unless carried here
    if (it.gl && !it.carry) {
      const k = smooth((now - it.gl.t0) / 250);
      poseOf(it);
      it.holder.position.lerpVectors(it.gl.p, _pp, k);
      it.holder.quaternion.copy(it.gl.q).slerp(_pq, k);
      it.holder.scale.lerpVectors(it.gl.s, _ps, k);
      if (k >= 1) it.gl = null;
    }
    const tgt = it.kind === 'c' ? (editing ? 1 : 0) : it.shown ? 1 : editing && it.kind === 'o' ? 0.3 : 0;
    it.a = approach(it.a, tgt, fade);
    it.sa = approach(it.sa, it.shown ? 1 : 0, fade);
    if (it.kind === 'o') {
      const E = it.E;
      if (E && E.state === 'ready' && it.built !== E.gen) buildModel(it);
      if (it.model) {
        setObjAlpha(it, it.a);
        it.holder.visible = it.a > 0.002;
        if (it.holder.visible) animStep(it, now, clockS);
      } else it.holder.visible = false;
      greyStep(it);
    } else if (it.kind === 'c') {
      const L = it.look, r = it.rec;
      it.holder.visible = L.deco.visible = it.a > 0.01;
      if (L.deco.visible) {
        L.deco.position.copy(it.holder.position); L.deco.quaternion.copy(it.holder.quaternion);
        const sz = it.holder.scale;
        L.name.position.set(0, sz.y / 2 + 0.04, 0);
        L.corners.forEach((c, k) => c.position.set((k & 1 ? 0.5 : -0.5) * sz.x, (k & 2 ? 0.5 : -0.5) * sz.y, (k & 4 ? 0.5 : -0.5) * sz.z));
        L.look({ inside: it.inside, selected: STU.sel === it.id && editing, hot: STU.hover === it.id, hotCorner: STU.hotCorner && STU.hotCorner.id === it.id ? STU.hotCorner.k : -1 });
        L.fill.material.opacity *= it.a; L.line.material.opacity *= it.a;
        L.name.userData.set(r.name + (r.mode === 'stay' ? ' · stays' : ''), L.col, 0.085);
      }
    } else {
      const L = it.look;
      it.holder.visible = L.ring.visible = editing;
      if (editing) {
        L.ring.position.set(it.holder.position.x, 0.004, it.holder.position.z);
        L.ring.scale.setScalar(it.rec.r);
        L.look({ hot: STU.hover === it.id, selected: STU.sel === it.id, on: !!it.src && it.sa > 0.5 });
      }
    }
  }
  editStep(editing);
  emitStep(now);
}
// a model not here yet: its grey box where it will stand, with what is happening to it
function greyStep(it) {
  const g = it.grey, E = it.E, show = !it.model && it.a > 0.01;
  g.group.visible = show;
  if (!show) return;
  g.group.position.copy(it.holder.position);
  const st = STU.listing !== 'ok' ? (STU.listing === 'missing' ? 'not on this device' : 'waiting') : !E || E.state === 'idle' ? (STU.fileMap.has(it.rec.file) ? 'waiting' : 'not in the scene\'s folder')
    : E.state === 'loading' ? `loading ${Math.round(E.p * 100)} %` : E.state === 'parsing' ? 'reading' : E.state === 'failed' ? 'cannot be read' : E.state === 'missing' ? 'not in the scene\'s folder' : '';
  g.name.userData.set(it.rec.name + (st ? ': ' + st : ''), E && E.state === 'failed' ? '#ff5a4b' : '#95a6bd', 0.075);
  g.fill.material.opacity = 0.55 * Math.min(1, it.a);
}
// while editing: the selected object's outline, the lines from a selected cube to what it shows (green) and hides
// (red), and in Pick mode a tick over each item on the list
const _sb = new THREE.Box3(), _sv = new THREE.Vector3(), _sw = new THREE.Vector3(), _sm = new THREE.Matrix4();
function editStep(editing) {
  const sel = editing ? STU.items.get(STU.sel) : null, hov = editing && STU.hover !== STU.sel ? STU.items.get(STU.hover) : null;
  for (const [B, it] of [[GL.selBox, sel], [GL.hoverBox, hov]]) {
    const ok = it && it.kind === 'o' && (it.model ? it.proxy : it.grey.group.visible);
    B.visible = !!ok;
    if (!ok) continue;
    const t = it.model ? it.proxy : it.greyHit;
    t.updateWorldMatrix(true, false);
    B.matrix.copy(t.matrixWorld); B.matrixWorldNeedsUpdate = true;
  }
  // a selected cube's lists
  const L = GL.links, pos = L.geometry.attributes.position, col = L.geometry.attributes.color;
  let n = 0;
  if (sel && sel.kind === 'c') {
    for (const [list, c] of [[sel.rec.show, [0.24, 0.88, 0.56]], [sel.rec.hide, [1, 0.35, 0.29]]]) for (const id of list) {
      const t = STU.items.get(id);
      if (!t || n >= pos.count - 2) continue;
      itemTopInto(t, _sw, true);
      pos.setXYZ(n, sel.holder.position.x, sel.holder.position.y, sel.holder.position.z); col.setXYZ(n++, ...c);
      pos.setXYZ(n, _sw.x, _sw.y, _sw.z); col.setXYZ(n++, ...c);
    }
  }
  L.geometry.setDrawRange(0, n); pos.needsUpdate = col.needsUpdate = true; L.visible = n > 0;
  // ticks over what a cube's list holds while picking for it
  const P = editing && STU.pick ? STU.items.get(STU.pick.id) : null;
  for (const it of STU.items.values()) {
    if (it.kind === 'c') continue;
    const on = !!P && (P.rec.show.includes(it.id) || P.rec.hide.includes(it.id));
    if (on && !it.tick) { it.tick = LOOKS.tag(30); GL.edit.add(it.tick); }
    if (!it.tick) continue;
    it.tick.visible = on;
    if (!on) continue;
    const sh = P.rec.show.includes(it.id);
    it.tick.userData.set((sh ? '✓ shown by ' : '✕ hidden by ') + P.rec.name, sh ? '#3ee08f' : '#ff5a4b', 0.075);
    itemTopInto(it, it.tick.position, false); it.tick.position.y += 0.1;
  }
}
// what editing draws: the selected and the pointed-at object's outlines (over everything), a cube's lines
function editLooks() {
  const edges = new THREE.EdgesGeometry(BOX1);
  for (const [k, col, o] of [['selBox', 0x46d9ff, 0.95], ['hoverBox', 0x9fe8ff, 0.5]]) {
    const B = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: o, depthTest: false, depthWrite: false }));
    B.matrixAutoUpdate = false; B.visible = false; B.renderOrder = 8; B.frustumCulled = false;
    GL.scene.add(B); GL[k] = B;
  }
  const g = new THREE.BufferGeometry(), n = 1600;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  GL.links = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  GL.links.frustumCulled = false; GL.links.renderOrder = 8; GL.links.visible = false;
  GL.edit.add(GL.links);
}
// the top of an item (a label's place, a line's end), in the scene's frame; mid: its middle instead
function itemTopInto(it, out, mid) {
  if (it.kind === 'o') {
    const t = it.model ? it.proxy : it.greyHit;
    t.updateWorldMatrix(true, false);
    if (!BOX1.boundingBox) BOX1.computeBoundingBox();
    _sm.copy(GL.world.matrixWorld).invert().multiply(t.matrixWorld);
    _sb.copy(BOX1.boundingBox).applyMatrix4(_sm);
    out.set((_sb.min.x + _sb.max.x) / 2, mid ? (_sb.min.y + _sb.max.y) / 2 : Math.max(_sb.min.y, _sb.max.y), (_sb.min.z + _sb.max.z) / 2);
  } else if (it.kind === 'c') out.set(it.holder.position.x, it.holder.position.y + (mid ? 0 : it.holder.scale.y / 2), it.holder.position.z);
  else out.copy(it.holder.position).setY(it.holder.position.y + (mid ? 0 : 0.14));
  return out;
}
// a label's point (the engine's hover and selection labels: anchors in the stage's frame, which is the scene's)
function itemTop(id) {
  const it = STU.items.get(id);
  return it ? itemTopInto(it, new THREE.Vector3(), false).toArray() : [0, -100, 0];
}

// --------------------------------------------------------------- emitters --
// A sound placed at a point: played through the shell's one context (HOST.audio.fx()), each through an HRTF panner
// (inverse distance, full volume within r, rolloff 1, at most 50 m) and its own gain (vol) to the context's output. In
// a headset the listener is your head (the shell's HOST.sfx.listen puts it there too); on a page this camera. Silent
// while the context is not there (before a tap, hidden, the <audio> engine chosen) or this device's Sound button is off
// (they fade out, and are rebuilt on a new context); not the Sound effects or Narration switches: these are the scene's
// own sounds. 'always' loops start at the same moment for everyone at a station (the room's time modulo their length)
const EM = { ctx: null, lis: false };
const _ep = new THREE.Vector3(), _eq = new THREE.Quaternion(), _ef = new THREE.Vector3(), _eu = new THREE.Vector3();
function emitStep(now) {
  const A = HOST.audio, ctx = A && A.fx ? A.fx() : null;
  if (ctx !== EM.ctx) { emitAll(); sndForget(); EM.ctx = ctx; }
  if (!ctx) return;
  const quiet = !!(A && A.muted) || APP.mode !== 'explore' || sfxHidden() || !STU.scene;
  let any = false;
  for (const it of STU.items.values()) {
    if (it.kind !== 's') continue;
    const F = it.F;
    if (F && (F.state === 'bytes' || (F.state === 'ready' && F.ctx !== ctx))) sndDecode(F, ctx);
    const want = quiet ? 0 : it.sa * it.rec.vol;
    if (!it.src && want > 0.0005 && !it.ended && F && F.state === 'ready' && F.ctx === ctx) emitStart(it, ctx, F.buf, now);
    if (!it.src) continue;
    any = true;
    if (it.gt !== want) { try { it.gain.gain.setTargetAtTime(want, ctx.currentTime, 0.1); } catch (e) { /* closed */ } it.gt = want; }
    it.holder.getWorldPosition(_ep);
    setPos(it.pan, _ep);
    if (it.pan.refDistance !== it.rec.r) it.pan.refDistance = it.rec.r;
    if (want <= 0.0005) { if (!it.zeroAt) it.zeroAt = now; if (now - it.zeroAt > 700) emitStop(it); } else it.zeroAt = 0;
  }
  // the listener: your head in a headset, the camera on a page
  if (any) {
    if (XR.on && GL.renderer.xr.isPresenting) { _ep.copy(XR.head); _eq.copy(XR.headQ); } else { GL.camera.getWorldPosition(_ep); GL.camera.getWorldQuaternion(_eq); }
    listen(ctx, _ep, _eq);
    EM.lis = true;
  }
}
function setPos(n, p) {
  try { if (n.positionX) { n.positionX.value = p.x; n.positionY.value = p.y; n.positionZ.value = p.z; } else n.setPosition(p.x, p.y, p.z); } catch (e) { /* an old engine */ }
}
function listen(ctx, p, q) {
  const L = ctx.listener;
  if (!L) return;
  _ef.set(0, 0, -1).applyQuaternion(q); _eu.set(0, 1, 0).applyQuaternion(q);
  try {
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = _ef.x; L.forwardY.value = _ef.y; L.forwardZ.value = _ef.z; L.upX.value = _eu.x; L.upY.value = _eu.y; L.upZ.value = _eu.z;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(_ef.x, _ef.y, _ef.z, _eu.x, _eu.y, _eu.z); }
  } catch (e) { /* an old engine */ }
}
// where a sound starts: a loop of 'always' in a room at the room's time, else from when the scene opened (or, 'shown',
// from when a cube showed it), modulo its length; a sound that does not loop and is over: -1
function emitOffset(it, dur, now) {
  const r = it.rec;
  let t = r.start === 'shown' ? (now - it.shownAt) / 1000 : r.loop ? sceneClock(now) : (now - STU.t0) / 1000;
  if (r.loop) return ((t % dur) + dur) % dur;
  t = Math.max(0, t);
  return t < dur - 0.05 ? t : -1;
}
function emitStart(it, ctx, buf, now) {
  const off = emitOffset(it, buf.duration || 1, now);
  if (off < 0) { it.ended = true; return; }
  try {
    const src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createPanner();
    src.buffer = buf; src.loop = !!it.rec.loop;
    g.gain.value = 0;
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = it.rec.r; p.rolloffFactor = 1; p.maxDistance = 50;
    it.holder.getWorldPosition(_ep); setPos(p, _ep);
    src.connect(g); g.connect(p); p.connect(ctx.destination);
    src.onended = () => { if (it.src !== src) return; emitStop(it); if (!it.rec.loop) it.ended = true; };
    src.start(ctx.currentTime + 0.02, off);
    Object.assign(it, { src, gain: g, pan: p, gt: -1, zeroAt: 0 });
  } catch (e) { it.ended = true; }
}
function emitStop(it) {
  const s = it.src;
  if (!s) return;
  it.src = null;
  try { s.onended = null; s.stop(); } catch (e) { /* not started */ }
  for (const n of [s, it.gain, it.pan]) try { n.disconnect(); } catch (e) { /* gone */ }
  it.gain = it.pan = null;
}
function emitAll() { for (const it of STU.items.values()) if (it.kind === 's') emitStop(it); }

// ------------------------------------------------------------------ edits --
// Editing is this device's own (studioEdit), never in the state; refused while the station's story is locked (Lock
// this story) and never offered with &visit. Every change is recorded for Undo (this device's last 30): an undo writes
// the item's record as it was, removes what was added or puts back what was deleted
const UNDO = [];
function editLocked() {
  try {
    const st = HOST.collab && HOST.collab.live && HOST.collab.live();
    if (!st || st.story !== XR_HERE) return false;
    if (HOST.collab.stationLock && HOST.collab.stationLock(st.id)) return true;
    return !!(XR.on && HOST.room && HOST.room.placing && HOST.room.placing() && HOST.anchor.locked('globe'));
  } catch (e) { return false; }
}
const editOn = () => STU.edit && !OPT.visit && !!STU.scene && !editLocked();
function setEdit(on) {
  if (OPT.visit) return;
  STU.edit = !!on;
  store.set('studioEdit', STU.edit ? '1' : null);
  if (!STU.edit) { STU.pick = null; select(''); }
  sfxAct(STU.edit ? 'pick' : 'click', 'stage', 'centre');
  dirty(true);
}
let SNAP = null;
const snapNow = ids => new Map((ids ? ids.map(id => [id, STU.items.get(id)]) : [...STU.items]).map(([id, it]) => [id, it ? [it.kind, JSON.stringify(it.rec)] : null]));
// a change begins (a drag: only its items) and ends: what changed goes on the Undo list as one step
function beginChange(ids) { if (!SNAP) SNAP = { ids: ids || null, before: snapNow(ids) }; }
function endChange() {
  if (!SNAP) return;
  const { ids, before } = SNAP;
  SNAP = null;
  const list = [];
  for (const [id, b] of before) {
    const it = STU.items.get(id);
    if (!b) { if (it) list.push({ id, kind: it.kind, before: null }); continue; }
    if (!it || it.kind !== b[0] || JSON.stringify(it.rec) !== b[1]) list.push({ id, kind: b[0], before: JSON.parse(b[1]) });
  }
  if (!ids) for (const [id, it] of STU.items) if (!before.has(id)) list.push({ id, kind: it.kind, before: null });
  if (list.length) { UNDO.push(list); if (UNDO.length > 30) UNDO.shift(); }
  changed();
}
function change(fn, ids) { const outer = !!SNAP; if (!outer) beginChange(ids); try { fn(); } finally { if (!outer) endChange(); } }
function undo() {
  if (SNAP) return;
  const list = UNDO.pop();
  if (!list) return;
  for (const u of list.slice().reverse()) { if (u.before) putItem(u.id, u.kind, u.before); else removeItem(u.id); }
  sfxAct('rise', 'stage', 'centre', { dur: 0.5, gain: 0.5 });
  changed();
}
// what changed here: the panes (soon), the draft (a second later)
function changed() { STU.rev++; draftSoon(); dirty(); }
function setRec(id, patch) {
  const it = STU.items.get(id);
  if (!it) return null;
  const rec = norm(it.kind, Object.assign({}, it.rec, patch));
  return rec ? putItem(id, it.kind, rec) : null;
}
const newId = () => { let id; do { id = Array.from({ length: 6 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join(''); } while (STU.items.has(id)); return id; };
function nameFor(base) {
  base = words(base, 54) || 'Item';
  const names = new Set([...STU.items.values()].map(it => it.rec.name));
  if (!names.has(base)) return base;
  for (let n = 2; ; n++) if (!names.has(base + ' ' + n)) return base + ' ' + n;
}
const countOf = k => [...STU.items.values()].filter(it => it.kind === k).length;
const canAdd = k => editOn() && STU.listing === 'ok' && countOf(k) < LIMITS[k];
// 1.5 m in front of you on the floor, in the scene's frame: your head in a headset, the camera in Walk view, the
// middle of the view in Orbit view
const _fh = new THREE.Vector3(), _fd = new THREE.Vector3();
function frontAt(d) {
  d = d === undefined ? 1.5 : d;
  if (XR.on && GL.renderer.xr.isPresenting) {
    GL.world.updateMatrixWorld(true);
    GL.world.worldToLocal(_fh.copy(XR.head));
    _fd.set(0, 0, -1).applyQuaternion(XR.headQ).applyQuaternion(GL.world.getWorldQuaternion(_eq).invert());
  } else if (APP.mode === 'explore' && X.view === 'walk') { _fh.copy(WALK.pos); _fd.set(-Math.sin(WALK.yaw), 0, -Math.cos(WALK.yaw)); }
  else { const v = orbit.cur; return [v[3], v[5]]; }
  _fd.y = 0;
  if (_fd.lengthSq() < 1e-6) _fd.set(0, 0, -1);
  _fd.normalize();
  return [_fh.x + _fd.x * d, _fh.z + _fd.z * d];
}
function addModel(path) {
  if (!canAdd('o') || !STU.fileMap.has(path)) return '';
  const at = frontAt(), id = newId(), E = lib(path);
  change(() => {
    const it = putItem(id, 'o', norm('o', { name: nameFor(stem(path)), file: path, p: [at[0], 0, at[1]] }));
    if (!it) return;
    if (E.state === 'ready' && E.info) placeFresh(it, at); else it.fresh = at;
  });
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
function addSound(path) {
  if (!canAdd('s') || !STU.fileMap.has(path)) return '';
  const at = frontAt(), id = newId();
  change(() => putItem(id, 's', norm('s', { name: nameFor(stem(path)), file: path, p: [at[0], 1.2, at[1]] })));
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
function addCube() {
  if (!canAdd('c')) return '';
  const at = frontAt(), id = newId();
  change(() => putItem(id, 'c', norm('c', { name: nameFor('Cube'), p: [at[0], 1, at[1]], size: [1.2, 2, 1.2] })));
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
function deleteItem(id) {
  if (!editOn() || !STU.items.has(id)) return;
  change(() => {
    for (const c of [...STU.items.values()]) if (c.kind === 'c' && (c.rec.show.includes(id) || c.rec.hide.includes(id))) setRec(c.id, { show: c.rec.show.filter(i => i !== id), hide: c.rec.hide.filter(i => i !== id) });
    removeItem(id);
  });
  if (STU.pick && STU.pick.id === id) STU.pick = null;
  sfxAct('snap', 'stage', 'centre');
}
function duplicateItem(id) {
  const it = STU.items.get(id);
  if (!it || !canAdd(it.kind)) return '';
  const nid = newId();
  change(() => putItem(nid, it.kind, norm(it.kind, Object.assign({}, it.rec, { name: nameFor(it.rec.name.replace(/ \d+$/, '')), p: [it.rec.p[0] + 0.5, it.rec.p[1], it.rec.p[2]] }))));
  select(nid);
  sfxAct('place', 'world', null);
  return nid;
}
// an object's box as placed now (its turn and scale), in the scene's frame
function objBox(it, q, s) {
  if (!it.E || !it.E.info) return null;
  const b = placedBox(it.E, q || it.rec.q, s === undefined ? it.rec.s : s);
  return b.translate(_sv.fromArray(it.rec.p));
}
// the item pane's actions (page and headset alike)
const _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion();
const ITEM_ACT = {
  light: (it, v) => setRec(it.id, { light: v }),
  anim: (it, v) => setRec(it.id, { anim: v }),
  start: (it, v) => setRec(it.id, { start: v }),
  clip: it => { const cl = it.E && it.E.clips ? it.E.clips.map(c => c.name) : []; if (!cl.length) return; const i = cl.indexOf(it.rec.clip); setRec(it.id, { clip: cl[(i + 1) % cl.length] }); },
  // a quarter turn about the vertical, or about x (standing up a model lying on its back), about its middle
  turn: it => turnAbout(it, _tq.setFromAxisAngle(_yUp, Math.PI / 2)),
  stand: it => turnAbout(it, _tq.setFromAxisAngle(_ax, -Math.PI / 2)),
  floor: it => { const b = objBox(it); if (b) setRec(it.id, { p: [it.rec.p[0], it.rec.p[1] - b.min.y, it.rec.p[2]] }); },
  // sizes about its foot (the middle of its lowest side stays where it is)
  size: (it, k) => {
    const b0 = objBox(it), s = Math.min(1e4, Math.max(1e-4, it.rec.s * k));
    if (!b0) { setRec(it.id, { s }); return; }
    const b1 = objBox(it, null, s), dx = (b0.min.x + b0.max.x - b1.min.x - b1.max.x) / 2, dz = (b0.min.z + b0.max.z - b1.min.z - b1.max.z) / 2;
    setRec(it.id, { s, p: [it.rec.p[0] + dx, it.rec.p[1] + b0.min.y - b1.min.y, it.rec.p[2] + dz] });
  },
  dup: it => duplicateItem(it.id),
  del: it => deleteItem(it.id),
  // a cube: 10 cm more or less on one side (its foot stays on its height), while inside or once entered, its lists
  grow: (it, v) => {
    const [ax, d] = v.split(':'), i = +ax, size = it.rec.size.slice(), p = it.rec.p.slice();
    size[i] = Math.max(0.1, r3(size[i] + (+d))); if (i === 1) p[1] = r3(p[1] + (size[1] - it.rec.size[1]) / 2);
    setRec(it.id, { size, p });
  },
  mode: (it, v) => setRec(it.id, { mode: v }),
  pickFor: (it, v) => { STU.pick = STU.pick && STU.pick.id === it.id && STU.pick.list === v ? null : { id: it.id, list: v }; },
  // a sound: its volume and its full-volume distance in steps, looping or not
  vol: (it, d) => { const S = [0, 0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2], i = S.findIndex(x => x >= it.rec.vol - 1e-6); setRec(it.id, { vol: S[clamp((i < 0 ? S.length - 1 : i) + (+d), 0, S.length - 1)] }); },
  reach: (it, d) => { const S = [0.25, 0.5, 1, 1.5, 2, 3, 5, 8, 12, 20], i = S.findIndex(x => x >= it.rec.r - 1e-6); setRec(it.id, { r: S[clamp((i < 0 ? S.length - 1 : i) + (+d), 0, S.length - 1)] }); },
  loop: (it, v) => setRec(it.id, { loop: v === 'on' }),
};
function itemAct(act, v, id) {
  const it = STU.items.get(id || STU.sel);
  if (!it || !editOn() || !ITEM_ACT[act]) return;
  if (act === 'pickFor') { ITEM_ACT.pickFor(it, v); dirty(true); return; }
  change(() => ITEM_ACT[act](it, v));
  sfxAct(act === 'del' ? 'snap' : 'click', 'world', null);
}
function turnAbout(it, q) {
  if (it.kind !== 'o') { if (it.kind === 'c') setRec(it.id, { yaw: it.rec.yaw + Math.PI / 2 }); return; }
  const b = objBox(it), mid = b ? b.getCenter(new THREE.Vector3()) : new THREE.Vector3().fromArray(it.rec.p);
  const nq = _tq2.copy(q).multiply(_pq.fromArray(it.rec.q)).normalize(), p = new THREE.Vector3().fromArray(it.rec.p).sub(mid).applyQuaternion(q).add(mid);
  setRec(it.id, { q: nq.toArray(), p: p.toArray() });
}
// a cube's list (show or hide) with an item in it, or out of it (in one list of a cube at most)
function toggleLink(cubeId, list, id) {
  const c = STU.items.get(cubeId);
  if (!c || c.kind !== 'c' || !STU.items.has(id) || id === cubeId || STU.items.get(id).kind === 'c' || !editOn()) return;
  const other = list === 'show' ? 'hide' : 'show', on = c.rec[list].includes(id);
  change(() => setRec(cubeId, { [list]: on ? c.rec[list].filter(i => i !== id) : c.rec[list].concat(id), [other]: c.rec[other].filter(i => i !== id) }));
  sfxAct(on ? 'snap' : 'link', 'world', null);
}
// select an item (its card), or none
function select(id) {
  id = STU.items.has(id) ? id : '';
  if (id === STU.sel) return;
  STU.sel = id;
  if (STU.pick && !id) STU.pick = null;
  if (id && typeof X !== 'undefined') X.tab = 'item';
  tcAttach();
  dirty(true);
}

// --------------------------------------------------------- shared rooms --
// What everyone at the station sees alike: the scene's name and one top-level field per item (its record), so two
// people changing two items at once both keep theirs. Never the camera, triggers, editing, the selection or sound.
// Life size in a headset: no view to share.
function collabView() { return null; }
function collabSetView(v, now) { /* nothing to set */ }
function collabState() {
  const s = { scene: STU.scene };
  for (const it of STU.items.values()) s[it.kind + '.' + it.id] = it.rec;
  return s;
}
function collabApply(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return;
  if (typeof v.scene === 'string' && (v.scene === '' || okScene(v.scene)) && v.scene !== STU.scene) openScene(v.scene, 'room');
  const keep = new Set(), n = { o: 0, c: 0, s: 0 };
  for (const k of Object.keys(v)) {
    const m = /^([ocs])\.([a-z0-9]{6})$/.exec(k);
    if (!m || keep.has(m[2])) continue;
    const it = STU.items.get(m[2]), rec = n[m[1]] < LIMITS[m[1]] ? norm(m[1], v[k]) : null;
    if (!rec) { if (it && it.kind === m[1]) keep.add(m[2]); continue; }   // (a bad record: ignored, the item kept as it is)
    keep.add(m[2]); n[m[1]]++;
    if (it && it.kind === m[1] && JSON.stringify(it.rec) === JSON.stringify(rec)) continue;
    putItem(m[2], m[1], rec, { glide: true });
  }
  for (const id of [...STU.items.keys()]) if (!keep.has(id)) removeItem(id);
  dirty();
}
function studioEffect() { /* none */ }

// ================================================================ EXPLORE ==
// Explore mode is the studio itself: the scene, and four panes (Scene, Add, Item, Items), each described once as a
// list of blocks (paneBlocks) that the page draws as HTML (renderPanes) and the headset as its canvas twin
// (drawExplorePane), so both say the same. On a page the camera goes round the scene (Orbit) or walks in it at 1.6 m
// (Walk: where cubes trigger on a page); editing, a click selects and the arrows (TransformControls) move, turn and
// size what is selected.
const TABS = [['scene', 'Scene'], ['add', 'Add'], ['item', 'Item'], ['items', 'Items']];
const X = { tab: 'scene', view: 'orbit', tcMode: 'translate', dirty: false, drawn: 0, tcDrag: false, tcUp: 0, scroll: {} };
const XS = {};
const orbit = { cur: [24, 20, 7, 0, 1, 0], from: null, to: null, t0: 0, dur: 1.2 };
const WALK = { pos: new THREE.Vector3(0, 1.6, 3), yaw: 0, pitch: -0.08, to: null };
const KEYS = new Set();

function exploreTargets() {
  const out = {};
  for (const n in DEF) out[n] = n.endsWith('_a') ? 0 : XS[n];
  out.stage_a = 1;
  return out;
}
function exploreStep(dt) {
  const tg = exploreTargets(), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = XS[n] + (tg[n] - XS[n]) * k;
  return XS;
}
function openScene_() { /* (the engine's scene list has one entry: the stage) */ }
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now();
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / (orbit.dur * 1000)), f = orbit.from, t = orbit.to;
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) orbit.to = null;
}
// the whole scene in view (once a scene's models are in, and on View: Orbit)
function frameScene(now) {
  const b = new THREE.Box3();
  for (const it of STU.items.values()) {
    if (it.kind === 'o') { const ob = objBox(it); if (ob) b.union(ob); else b.expandByPoint(_sv.fromArray(it.rec.p)); }
    else if (it.kind === 'c') { b.expandByPoint(_sv.fromArray(it.rec.p).addScalar(-0.5)); b.expandByPoint(_sv.fromArray(it.rec.p).addScalar(0.5)); }
    else b.expandByPoint(_sv.fromArray(it.rec.p));
  }
  if (b.isEmpty()) b.set(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 2, 2));
  const c = b.getCenter(new THREE.Vector3()), r = Math.max(1, b.getSize(new THREE.Vector3()).length() / 2);
  const v = [orbit.cur[0], 24, clamp(r * 2.1, 2.5, 80), c.x, clamp(c.y, 0.5, 3), c.z];
  if (now) flyTo(v); else { orbit.cur = v; orbit.to = null; }
}
function setView(name) {
  if (name !== 'orbit' && name !== 'walk') return;
  if (name !== X.view) sfxAct('whoosh', 'stage', 'centre', { dur: 0.6 });
  X.view = name;
  KEYS.clear(); WALK.to = null;
  if (name === 'orbit') frameScene(true);
  document.querySelectorAll('[data-ctl="view"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === name));
  dirty(true);
}

// ------------------------------------------------------------ the panes --
// A pane is a list of blocks: { h, sub } a heading; { p, c } a line (c: muted, faint, amber, red, green); { code } a
// command; { kv: [[name, value]] }; { label, row: [buttons] }; { label, list: [rows] }. A button or a row: { id, label,
// sub, act, v, on, dis, primary, warn, col, page (page only), xr (headset only) }
const SOUND_NOTE = 'The scene\'s sounds follow this device\'s Sound button (not the Sound effects or Narration switches: they are the scene\'s own).';
const hhmm = ms => { const d = new Date(ms), t = d.toTimeString().slice(0, 5); return d.toDateString() === new Date().toDateString() ? t : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + t; };
const mb = n => (n >= 1 << 20 ? (n / 1048576).toFixed(n >= 10 << 20 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const metres = v => (v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3)).replace(/\.?0+$/, '') + ' m';
function srcLine() {
  if (SRC.state === 'looking') return 'Looking for scenes...';
  if (SRC.kind === 'relay') return `Scenes from the relay at ${SRC.base.replace(/^https?:\/\//, '')}` + (SRC.save ? ' (it saves layouts).' : ' (read only).');
  if (SRC.state === 'none') return SRC.noScenes ? 'The relay serves no scenes, and there is no folder of scenes next to the app.' : 'No relay and no folder of scenes found.';
  return `Scenes from the folder ${SRC.folder} (read only).`;
}
function savedLine() {
  if (STU.listing !== 'ok') return '';
  const by = STU.savedBy && !(HOST.collab && HOST.collab.name === STU.savedBy) ? ' by ' + STU.savedBy : '';
  if (unsaved()) return 'Unsaved changes' + (STU.savedAt ? ` (saved ${hhmm(STU.savedAt)}${by})` : '') + (SRC.kind !== 'relay' ? ': this folder is read only, Download layout.json and put it in the scene\'s folder.' : '.');
  return STU.savedAt ? `Saved ${hhmm(STU.savedAt)}${by}.` : 'Nothing placed or saved yet.';
}
// the Quest's budget, said (never refused): triangles in the scene and in one model, big textures
function budget() {
  let tris = 0;
  const big = new Set(), heavy = [];
  for (const it of STU.items.values()) {
    if (it.kind !== 'o' || !it.E || !it.E.info) continue;
    tris += it.E.info.tris;
    if (it.E.info.tris > 300000 && !heavy.includes(it.rec.file)) heavy.push(it.rec.file);
    for (const t of it.E.info.textures) if ((t.to || Math.max(t.w, t.h)) > 2048) big.add(it.rec.file + '|' + t.name);
  }
  const out = [];
  if (tris > 500000) out.push(`${fmt(tris)} triangles in the scene: more than a Quest draws smoothly (about 500,000).`);
  for (const f of heavy) out.push(`${baseName(f)} has more than 300,000 triangles: heavy for a Quest.`);
  if (big.size > 6) out.push(`${big.size} textures over 2,048 px: a Quest may run short of memory.`);
  return { tris, notes: out };
}
function paneBlocks(tab) {
  const B = [], ed = editOn(), lock = editLocked(), st = atStation();
  if (tab === 'scene') {
    B.push({ h: STU.scene || 'Your own scenes', sub: 'Studio' }, { p: srcLine(), c: 'muted' });
    if (SRC.state === 'auth') B.push({ p: AUTH_NOTE, c: 'amber' });
    if (SRC.state === 'error') B.push({ p: 'The scenes could not be listed: ' + SRC.note, c: 'red' });
    if (SRC.state === 'ok') {
      if (SRC.scenes.length) B.push({ label: st ? 'Scenes (the scene here is for everyone at this circle)' : 'Scenes', row: SRC.scenes.map(s => ({ id: 'scene:' + s.name, label: s.name, act: 'scene', v: s.name, on: s.name === STU.scene, dis: lock && s.name !== STU.scene })) });
      else B.push({ p: 'No scenes yet: each folder in ' + (SRC.kind === 'relay' ? 'the relay\'s scenes folder' : SRC.folder) + ' is a scene.', c: 'muted' });
      if (!STU.scene && SRC.scenes.length) B.push({ p: 'Pick a scene.' });
    }
    if (['none', 'error', 'auth'].includes(SRC.state)) B.push({ row: [{ id: 'again', label: 'Look again', act: 'again' }] });
    if (STU.listing === 'loading' || STU.listing === 'waiting') B.push({ p: 'Reading the scene...', c: 'faint' });
    if (STU.note) B.push({ p: STU.note, c: 'amber' });
    if (STU.bad) B.push({ p: `${STU.bad} item${STU.bad === 1 ? '' : 's'} in layout.json could not be read.`, c: 'amber' });
    if (STU.scene && !OPT.visit) {
      B.push({ row: [
        { id: 'edit', label: 'Edit: ' + (STU.edit && !lock ? 'on' : 'off'), act: 'edit', on: STU.edit && !lock, dis: lock },
        SRC.kind === 'relay' ? { id: 'save', label: STU.saving ? 'Saving...' : 'Save', act: 'save', primary: canSave() && unsaved(), dis: !canSave() || STU.saving || !ed } : null,
        { id: 'undo', label: 'Undo' + (UNDO.length ? ` (${UNDO.length})` : ''), act: 'undo', dis: !UNDO.length || !ed },
        { id: 'load', label: STU.loadAsk ? 'Press again to load' : 'Load saved', act: 'load', dis: STU.listing !== 'ok' || !ed, warn: !!STU.loadAsk },
      ].filter(Boolean) });
      if (lock) B.push({ p: 'This scene is locked (Lock this story): unlock it in the menu or the Shared dialog to edit.', c: 'amber' });
      const sl = savedLine();
      if (sl) B.push({ p: sl, c: unsaved() ? 'amber' : 'muted' });
      if (STU.saveNote) B.push({ p: STU.saveNote, c: 'red' });
    }
    if (STU.draft) B.push({ p: `Your unsaved changes from ${hhmm(STU.draft.at)}:`, c: 'amber' }, { row: [{ id: 'restore', label: 'Restore', act: 'restore', primary: true }, { id: 'discard', label: 'Discard', act: 'discard' }] });
    if (STU.scene) {
      B.push({ row: [
        { id: 'seen', label: 'Reset what I have seen', act: 'seen', dis: !STU.seen.size },
        { id: 'download', label: 'Download layout.json', act: 'download', page: true, dis: STU.listing !== 'ok' },
        OPT.visit ? null : { id: 'upload', label: 'Upload', act: 'upload', page: true, dis: !ed },
      ].filter(Boolean) });
      if (STU.upNote) B.push({ p: STU.upNote, c: 'muted' });
      for (const n of budget().notes) B.push({ p: n, c: 'amber' });
      if ([...STU.items.values()].some(it => it.kind === 's')) B.push({ p: SOUND_NOTE, c: 'faint' });
    }
    if (SRC.kind !== 'relay' && SRC.state !== 'looking') {
      B.push({ p: 'To serve your own scenes and save their layouts, run a relay on a computer here:', c: 'muted' }, { code: 'node relay/server.mjs --lan --scenes <folder>' },
        { p: 'Each folder in it is a scene: models (.glb, .gltf, .fbx), their textures, sounds, and layout.json.', c: 'faint' });
    }
    if (!OPT.visit) B.push({ p: ed ? (XR.on ? 'Trigger: select. Grip: carry (both grips size an object; a cube\'s corner stretches it). Left stick: walk; right stick: turn.' : 'Click: select. W, E, R: move, turn, size. D: duplicate. Delete. Ctrl+Z: undo. Walk view: W A S D to walk.') : 'Turn on Edit to place things.', c: 'faint' });
  } else if (tab === 'add') {
    B.push({ h: 'Add', sub: STU.scene || 'No scene' });
    if (!ed) { B.push({ p: OPT.visit ? 'Nothing to add here.' : !STU.scene ? 'Pick a scene first (under Scene).' : lock ? 'This scene is locked (Lock this story).' : 'Turn on Edit (under Scene) to place things.', c: 'muted' }); return B; }
    if (STU.listing !== 'ok') { B.push({ p: 'Reading the scene...', c: 'faint' }); return B; }
    B.push({ p: 'A press places it 1.5 m in front of you, on the floor, selected.', c: 'muted' });
    const models = STU.files.filter(f => f.kind === 'model'), sounds = STU.files.filter(f => f.kind === 'audio');
    const full = k => countOf(k) >= LIMITS[k];
    B.push({ label: `Models (${models.length})`, list: models.map(f => {
      const E = LIB.get(f.path), w = (E && (E.state === 'failed' || (E.info && E.info.tris > 300000) || E.missing.size)) || f.bytes > 60 << 20;
      return { id: 'add:' + f.path, label: f.path, sub: mb(f.bytes) + (E && E.info ? ` · ${fmt(E.info.tris)} triangles` : ''), act: 'add', v: f.path, warn: w, dis: full('o') };
    }) });
    if (!models.length) B.push({ p: 'No models in the scene\'s folder: put .glb, .gltf or .fbx files there.', c: 'faint' });
    B.push({ label: `Sounds (${sounds.length})`, list: sounds.map(f => ({ id: 'adds:' + f.path, label: f.path, sub: mb(f.bytes), act: 'adds', v: f.path, dis: full('s') })) });
    if (!sounds.length) B.push({ p: 'No sounds in the scene\'s folder (.mp3, .ogg, .wav, .m4a...).', c: 'faint' });
    B.push({ label: 'Trigger cube', row: [{ id: 'cube', label: 'Trigger cube', act: 'cube', dis: full('c') }] }, { p: 'A see-through cube: walking into it shows or hides the objects and sounds you pick for it.', c: 'faint' });
    for (const k of ['o', 'c', 's']) if (full(k)) B.push({ p: `The scene has ${LIMITS[k]} ${KIND_NAME[k]}s: the most it can hold.`, c: 'amber' });
  } else if (tab === 'item') {
    const it = STU.items.get(STU.sel);
    if (!it) { B.push({ h: 'Item' }, { p: ed ? (XR.on ? 'Point at something in the scene and pull the trigger, or pick it under Items.' : 'Click something in the scene, or pick it under Items.') : 'Pick something under Items to see its card.', c: 'muted' }); return B; }
    itemBlocks(it, B, ed);
  } else {
    const all = [...STU.items.values()], P = STU.pick && STU.items.get(STU.pick.id);
    B.push({ h: 'Items', sub: `${countOf('o')} objects · ${countOf('c')} cubes · ${countOf('s')} sounds` });
    if (P) B.push({ p: `Picking what ${P.rec.name} ${STU.pick.list === 'show' ? 'shows' : 'hides'}: press items to add or remove them.`, c: 'amber' }, { row: [{ id: 'pickdone', label: 'Done', act: 'pickdone', primary: true }] });
    if (!all.length) B.push({ p: STU.scene ? 'Nothing placed yet.' : 'No scene open.', c: 'muted' });
    const selCube = ed && STU.items.get(STU.sel) && STU.items.get(STU.sel).kind === 'c' ? STU.items.get(STU.sel) : null;
    for (const [k, title] of [['o', 'Objects'], ['c', 'Trigger cubes'], ['s', 'Sounds']]) {
      const L = all.filter(it => it.kind === k);
      if (!L.length) continue;
      B.push({ label: title, list: L.map(it => {
        const inP = P && it.kind !== 'c' ? (P.rec.show.includes(it.id) ? 'show' : P.rec.hide.includes(it.id) ? 'hide' : '') : '';
        const row = { id: 'sel:' + it.id, label: (inP ? '✓ ' : '') + it.rec.name, sub: itemSub(it), act: P && it.kind !== 'c' ? 'link' : 'sel', v: it.id, on: it.id === STU.sel || !!inP, col: it.kind !== 'o' ? it.look.col : '' };
        if (selCube && it.kind !== 'c') row.ticks = [['show', selCube.rec.show.includes(it.id)], ['hide', selCube.rec.hide.includes(it.id)]];
        return row;
      }) });
    }
    if (selCube) B.push({ p: `Ticks: what ${selCube.rec.name} shows and hides.`, c: 'faint', page: true });
  }
  return B;
}
function itemSub(it) {
  const r = it.rec, me = it.kind !== 'c' ? (it.shown ? '' : ' · hidden for you') : '';
  if (it.kind === 'o') return baseName(r.file) + me;
  if (it.kind === 's') return baseName(r.file) + ` · ${Math.round(r.vol * 100)} %` + me;
  return `shows ${r.show.length}, hides ${r.hide.length}` + (r.mode === 'stay' ? ' · stays' : '') + (it.act ? ' · active for you' : '');
}
function itemBlocks(it, B, ed) {
  const r = it.rec, dis = !ed;
  if (it.kind === 'o') {
    const E = it.E, info = E && E.info, f = STU.fileMap.get(r.file);
    B.push({ h: r.name, sub: 'Object' + (it.shown ? '' : ' · hidden for you now') });
    const st = !E ? 'Waiting for the scene\'s files.' : E.state === 'loading' ? `Loading: ${Math.round(E.p * 100)} %.` : E.state === 'parsing' ? 'Reading the file...' : E.state === 'failed' ? E.err : E.state === 'idle' && !f ? 'Its file is not in the scene\'s folder.' : E.state === 'missing' ? 'Its file is not in the scene\'s folder any more.' : '';
    if (st) B.push({ p: st, c: E && E.state === 'failed' ? 'red' : 'muted' });
    const kv = [['File', r.file + (f ? ' · ' + mb(f.bytes) : '')]];
    if (info) {
      const b = placedBox(E, r.q, r.s), sz = b.getSize(new THREE.Vector3());
      kv.push(['Size', `${metres(sz.x)} × ${metres(sz.y)} × ${metres(sz.z)} (x, height, z)`], ['Scale', String(r.s) + (E.guess.read || E.guess.up !== 1 ? ` (the file says ${E.guess.read ? fmt(E.guess.unit) + ' cm a unit' : ''}${E.guess.read && E.guess.up !== 1 ? ', ' : ''}${E.guess.up === 2 ? 'Z up' : E.guess.up === 0 ? 'X up' : ''})` : '')],
        ['Triangles', fmt(info.tris)], ['Textures', info.textures.length ? info.textures.map(t => `${t.name} ${t.w} × ${t.h}${t.to ? ` (drawn at ${fmt(t.to)})` : ''}`).join('; ') : 'none'],
        ['Animations', info.clips.length ? info.clips.map(c => `${c[0]} (${c[1].toFixed(1)} s)`).join('; ') : 'none']);
    }
    B.push({ kv });
    if (E) for (const m of E.missing) B.push({ p: `Missing texture ${m}: put it in the scene's folder.`, c: 'amber' });
    if (info) {
      for (const t of info.textures) if (t.to) B.push({ p: `${t.name} is ${fmt(Math.max(t.w, t.h))} px: drawn at ${fmt(t.to)} px to spare the headset's memory.`, c: 'faint' });
      if (info.tris > 300000) B.push({ p: `More than 300,000 triangles: heavy for a Quest.`, c: 'amber' });
    }
    B.push({ label: 'Light', row: [{ id: 'light:lit', label: 'Lit', act: 'i:light', v: 'lit', on: r.light === 'lit', dis }, { id: 'light:scan', label: 'As scanned', act: 'i:light', v: 'scan', on: r.light === 'scan', dis }] });
    if (info && info.clips.length) {
      B.push({ label: 'Animation', row: [{ id: 'clip', label: (r.clip || 'none') + (info.clips.length > 1 ? ' ▸' : ''), act: 'i:clip', dis: dis || info.clips.length < 2 },
        { id: 'anim:loop', label: 'Loop', act: 'i:anim', v: 'loop', on: r.anim === 'loop', dis }, { id: 'anim:once', label: 'Once', act: 'i:anim', v: 'once', on: r.anim === 'once', dis }, { id: 'anim:off', label: 'Off', act: 'i:anim', v: 'off', on: r.anim === 'off', dis }] },
      { row: [{ id: 'start:always', label: 'Always', act: 'i:start', v: 'always', on: r.start === 'always', dis }, { id: 'start:shown', label: 'When shown', act: 'i:start', v: 'shown', on: r.start === 'shown', dis }] });
    }
    B.push({ label: 'Place', row: [{ id: 'turn', label: 'Turn 90°', act: 'i:turn', dis }, { id: 'stand', label: 'Stand up', act: 'i:stand', dis: dis || !info }, { id: 'floor', label: 'On the floor', act: 'i:floor', dis: dis || !info }] },
      { label: 'Size', row: [0.5, 0.9, 1.1, 2].map(k => ({ id: 'size:' + k, label: '×' + k, act: 'i:size', v: k, dis })) });
  } else if (it.kind === 'c') {
    B.push({ h: r.name, sub: 'Trigger cube' + (it.act ? ' · active for you' : '') }, { kv: [['Size', r.size.map(metres).join(' × ') + ' (x, height, z)'], ['Shows', r.show.length ? r.show.map(nameOf).join(', ') : 'nothing'], ['Hides', r.hide.length ? r.hide.map(nameOf).join(', ') : 'nothing']] });
    B.push({ label: 'Size (10 cm a press)', row: ['x', 'height', 'z'].flatMap((n, i) => [{ id: `grow:${i}:-`, label: n + ' −', act: 'i:grow', v: i + ':-0.1', dis }, { id: `grow:${i}:+`, label: n + ' +', act: 'i:grow', v: i + ':0.1', dis }]) },
      { label: 'Active', row: [{ id: 'mode:while', label: 'While inside', act: 'i:mode', v: 'while', on: r.mode === 'while', dis }, { id: 'mode:stay', label: 'Stays once entered', act: 'i:mode', v: 'stay', on: r.mode === 'stay', dis }] },
      { label: `Shows ${r.show.length} · hides ${r.hide.length}`, row: [{ id: 'pick:show', label: STU.pick && STU.pick.id === it.id && STU.pick.list === 'show' ? 'Done' : 'Pick what it shows', act: 'i:pickFor', v: 'show', on: !!(STU.pick && STU.pick.id === it.id && STU.pick.list === 'show'), dis },
        { id: 'pick:hide', label: STU.pick && STU.pick.id === it.id && STU.pick.list === 'hide' ? 'Done' : 'Pick what it hides', act: 'i:pickFor', v: 'hide', on: !!(STU.pick && STU.pick.id === it.id && STU.pick.list === 'hide'), dis }] });
    if (STU.pick && STU.pick.id === it.id) B.push({ p: XR.on ? 'Point at objects and sounds and pull the trigger to add or remove them; Done when finished.' : 'Click objects and sounds (or their names under Items) to add or remove them; Done when finished.', c: 'amber' });
    B.push({ p: 'Lines from the cube: green to what it shows, red to what it hides.', c: 'faint' });
  } else {
    const F = it.F;
    B.push({ h: r.name, sub: 'Sound' + (it.shown ? '' : ' · hidden for you now') }, { kv: [['File', r.file + (STU.fileMap.get(r.file) ? ' · ' + mb(STU.fileMap.get(r.file).bytes) : '')], ['Volume', Math.round(r.vol * 100) + ' %'], ['Full volume within', metres(r.r)], ['Plays', (r.loop ? 'in a loop, ' : 'once, ') + (r.start === 'always' ? 'always' : 'when a cube shows it')]] });
    if (F && (F.state === 'failed' || F.state === 'over')) B.push({ p: F.err, c: 'amber' });
    else if (!(HOST.audio && HOST.audio.fx && HOST.audio.fx())) B.push({ p: 'No sound yet: tap anywhere, or turn on the Sound button.', c: 'faint' });
    else if (HOST.audio.muted) B.push({ p: 'The Sound button is off on this device: nothing plays.', c: 'faint' });
    B.push({ label: 'Volume', row: [{ id: 'vol:-', label: 'Quieter', act: 'i:vol', v: -1, dis }, { id: 'vol:+', label: 'Louder', act: 'i:vol', v: 1, dis }] },
      { label: 'Full volume within', row: [{ id: 'reach:-', label: 'Nearer', act: 'i:reach', v: -1, dis }, { id: 'reach:+', label: 'Further', act: 'i:reach', v: 1, dis }] },
      { label: 'Plays', row: [{ id: 'loop:on', label: 'Loop', act: 'i:loop', v: 'on', on: r.loop, dis }, { id: 'loop:off', label: 'Once', act: 'i:loop', v: 'off', on: !r.loop, dis },
        { id: 'start:always', label: 'Always', act: 'i:start', v: 'always', on: r.start === 'always', dis }, { id: 'start:shown', label: 'When shown', act: 'i:start', v: 'shown', on: r.start === 'shown', dis }] },
      { p: SOUND_NOTE, c: 'faint' });
  }
  if (it.kind !== 's' || true) B.push({ row: [{ id: 'dup', label: 'Duplicate', act: 'i:dup', dis }, { id: 'del', label: 'Delete', act: 'i:del', dis, col: 'red' }] });
  if (!XR.on && ed) B.push({ label: 'Arrows (W, E, R)', page: true, row: [['translate', 'Move'], ['rotate', 'Turn'], ['scale', 'Size']].map(([m, n]) => ({ id: 'tc:' + m, label: n, act: 'tc', v: m, on: X.tcMode === m, dis: it.kind === 's' && m !== 'translate' })) });
}
const nameOf = id => { const it = STU.items.get(id); return it ? it.rec.name : '?'; };
// a pane's button or row pressed (page and headset)
function act(a, v) {
  if (a.startsWith('i:')) { itemAct(a.slice(2), v); return; }
  const lock = editLocked();
  ({
    scene: () => { if (!lock && v !== STU.scene) { openScene(v, 'pick'); sfxAct('whoosh', 'stage', 'centre', { dur: 0.8 }); } },
    again: () => findSource(),
    edit: () => setEdit(!STU.edit),
    save: () => saveLayout(),
    undo: () => undo(),
    load: () => loadSaved(),
    restore: () => draftRestore(),
    discard: () => draftDiscard(),
    seen: () => resetSeen(),
    download: () => downloadLayout(),
    upload: () => { const u = $('#stuUpload'); if (u && editOn()) u.click(); },
    add: () => addModel(v),
    adds: () => addSound(v),
    cube: () => addCube(),
    sel: () => select(v === STU.sel ? '' : v),
    link: () => { if (STU.pick) toggleLink(STU.pick.id, STU.pick.list, v); },
    pickdone: () => { STU.pick = null; },
    tc: () => tcSetMode(v),
    tab: () => pickTab(v),
  }[a] || (() => {}))();
  dirty(true);
}
function pickTab(k) { if (!TABS.some(t => t[0] === k)) return; X.tab = k; dirty(true); }
// the panes on the page: drawn again (at most about 7 times a second) when something they show changed
function dirty(now) { X.dirty = true; if (now === true) renderPanes(); }
function paneSig() { return [X.tab, STU.rev, STU.libRev, STU.sel, STU.edit, STU.listing, SRC.state, SRC.scenes.length, STU.saving, STU.savedAt, STU.loadAsk, !!STU.draft, UNDO.length, STU.pick && STU.pick.id + STU.pick.list, editLocked(), X.tcMode, STU.seen.size, STU.note, STU.saveNote, STU.upNote, [...STU.items.values()].map(it => +it.shown + +it.act).join('')].join('|'); }
function buildExplore() {
  $('#explore').innerHTML = `<style>
    .stu-list { list-style: none; padding: 0; margin: 4px 0 14px; }
    .stu-list li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; padding: 6px 8px; border-radius: 4px; cursor: pointer; border-left: 3px solid transparent; }
    .stu-list li:hover { background: var(--chip); }
    .stu-list li[aria-pressed="true"] { background: var(--chip); outline: 1px solid var(--line); }
    .stu-list li[aria-disabled="true"] { opacity: 0.45; cursor: default; }
    .stu-list li small { grid-column: 1; color: var(--muted); font-size: 12.5px; }
    .stu-list li .tk { grid-row: 1 / 3; grid-column: 2; display: flex; gap: 10px; font-size: 12px; color: var(--muted); }
    .stu-list li .tk label { display: flex; gap: 4px; align-items: center; cursor: pointer; }
    .stu-warn { color: var(--amber); margin-left: 6px; }
    .stu-code { font-family: ui-monospace, Menlo, monospace; font-size: 13px; background: var(--chip); padding: 6px 8px; border-radius: 4px; display: block; margin: 0 0 10px; overflow-x: auto; white-space: nowrap; }
    #explore .actions .btn[aria-pressed="true"] { border-color: var(--cyan); color: var(--cyan); }
    #explore .actions .btn.red { color: var(--red); }
    #explore .actions .btn.warn { border-color: var(--amber); color: var(--amber); }
    .stu-k { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin: 0 0 4px; }
    .pane p.stu-l { margin: 10px 0 2px; font-size: 13px; color: var(--muted); }
    .pane p.amber { color: var(--amber); } .pane p.red { color: var(--red); } .pane p.faint { color: var(--faint); font-size: 13px; } .pane p.muted { color: var(--muted); } .pane p.green { color: var(--green); }
  </style>
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}
    <input type="file" id="stuUpload" accept=".json,application/json" hidden>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  $('#explore').addEventListener('click', ev => {
    const t = ev.target.closest('[data-act]');
    if (!t || t.getAttribute('aria-disabled') === 'true' || t.disabled) return;
    if (t.dataset.act === 'tick') return;
    act(t.dataset.act, t.dataset.n ? +t.dataset.v : t.dataset.v);
  });
  // a tick box in Items: an item in or out of the selected cube's list
  $('#explore').addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'stuUpload') { const f = t.files && t.files[0]; if (f) f.text().then(uploadLayout).catch(() => {}); t.value = ''; return; }
    if (t.dataset && t.dataset.act === 'tick') toggleLink(STU.sel, t.dataset.list, t.dataset.v);
  });
  $('#viewctl').innerHTML = `<div class="grp"><span>View</span><div class="seg" data-ctl="view" role="group" aria-label="View">${[['orbit', 'Orbit'], ['walk', 'Walk']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.view === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) setView(b.dataset.v); });
  renderPanes();
}
function showTab(k) { pickTab(k); }
function blockHTML(b) {
  if (b.xr) return '';
  const btn = x => `<button class="btn${x.primary ? ' primary' : ''}${x.col === 'red' ? ' red' : ''}${x.warn ? ' warn' : ''}" type="button" data-act="${x.act}" data-v="${esc(x.v === undefined ? '' : x.v)}"${typeof x.v === 'number' ? ' data-n="1"' : ''} aria-pressed="${!!x.on}"${x.dis ? ' disabled' : ''} data-id="${esc(x.id)}">${esc(x.label)}</button>`;
  if (b.h !== undefined) return `${b.sub ? `<p class="stu-k">${esc(b.sub)}</p>` : ''}<h3>${esc(b.h)}</h3>`;
  if (b.p !== undefined) return `<p class="${b.c || ''}">${esc(b.p)}</p>`;
  if (b.code !== undefined) return `<code class="stu-code">${esc(b.code)}</code>`;
  if (b.kv) return `<dl class="stats">${b.kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  const lab = b.label ? `<p class="stu-l">${esc(b.label)}</p>` : '';
  if (b.row) return lab + `<div class="actions">${b.row.filter(x => !x.xr).map(btn).join('')}</div>`;
  if (b.list) return lab + `<ul class="stu-list">${b.list.map(x => `<li data-act="${x.act}" data-v="${esc(x.v)}" data-id="${esc(x.id)}" aria-pressed="${!!x.on}"${x.dis ? ' aria-disabled="true"' : ''} style="${x.col ? `border-left-color:${x.col}` : ''}">
    <span>${esc(x.label)}${x.warn ? '<span class="stu-warn" title="See its card">⚠</span>' : ''}</span>${x.ticks ? `<span class="tk">${x.ticks.map(([l, on]) => `<label><input type="checkbox" data-act="tick" data-list="${l}" data-v="${esc(x.v)}"${on ? ' checked' : ''}>${l === 'show' ? 'Shows' : 'Hides'}</label>`).join('')}</span>` : ''}
    ${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</li>`).join('')}</ul>`;
  return '';
}
function renderPanes() {
  X.dirty = false; X.drawn = performance.now();
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === X.tab));
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + X.tab));
  const pane = $('#pane-' + X.tab);
  if (!pane) return;
  pane.innerHTML = paneBlocks(X.tab).map(blockHTML).join('');
  for (const [k] of TABS) if (k !== X.tab) { const p = $('#pane-' + k); if (p && p.innerHTML) p.innerHTML = ''; }
  const vb = $('#viewctl [data-ctl="view"]');
  if (vb) vb.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === X.view));
}
let paneLast = '';
function paneStep(now) {
  if (GL.tc && GL.tc.object && !editOn()) tcAttach();   // (a lock or the end of editing: the arrows go)
  if (APP.mode !== 'explore') return;
  const s = paneSig();
  if (s !== paneLast) { paneLast = s; X.dirty = true; }
  if (X.dirty && now - X.drawn > 150) renderPanes();
}
// the two labels: the name of what you point at, and of what is selected
function updateExtraLabels() {
  const [Lh, Ls] = LBL.extra;
  if (!Lh) return;
  const ed = editOn(), h = ed && STU.hover !== STU.sel ? STU.items.get(STU.hover) : null, s = ed ? STU.items.get(STU.sel) : null;
  labelSet(Lh, h ? [h.rec.name, KIND_NAME[h.kind]] : null);
  labelSet(Ls, s ? [s.rec.name, 'selected'] : null);
  Lh.show = h ? 1 : 0; Ls.show = s ? 1 : 0;
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _rp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
// what the pointer can find while editing: objects (their unseen boxes, or a grey box), sounds, cubes (behind the others:
// you often stand inside a cube) and the selected cube's corners
function pickables() {
  const L = [];
  for (const it of STU.items.values()) {
    if (it.kind === 'o') { if (it.model && it.holder.visible) L.push(it.proxy); else if (it.grey.group.visible) L.push(it.greyHit); }
    else if (it.kind === 's') { if (it.holder.visible) L.push(it.look.hit); }
    else if (it.holder.visible) { L.push(it.look.fill); if (STU.sel === it.id) for (const c of it.look.corners) L.push(c); }
  }
  return L;
}
// the nearest thing a ray finds: a corner first, then an object or a sound, a cube only when nothing else is hit
function rayPick(ray) {
  GL.world.updateMatrixWorld(true);
  const hs = ray.intersectObjects(pickables(), false);
  const c = hs.find(h => h.object.userData.corner !== undefined) || hs.find(h => { const it = STU.items.get(h.object.userData.id); return it && it.kind !== 'c'; }) || hs[0];
  if (!c) return null;
  return { id: c.object.userData.id, corner: c.object.userData.corner, point: c.point.clone(), dist: c.distance };
}
function pointerRay(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return _rc;
}
function bindCanvas() {
  const cv = GL.canvas, pts = new Map();
  let down = null, pinch = 0;
  cv.style.cursor = 'grab';
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    down = { x: ev.clientX, y: ev.clientY, moved: false, b: ev.button, shift: ev.shiftKey, tc: !!(GL.tc && (GL.tc.dragging || GL.tc.axis)) };
    if (!down.tc) cv.setPointerCapture(ev.pointerId);
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) {
      // pointing without a button (editing): what is under the mouse lights up and shows its name
      if (APP.mode === 'explore' && ev.pointerType !== 'touch' && editOn() && !(GL.tc && GL.tc.axis)) {
        const h = rayPick(pointerRay(ev.clientX, ev.clientY));
        STU.hover = h ? h.id : ''; cv.style.cursor = h ? 'pointer' : 'grab';
      }
      return;
    }
    if (APP.mode !== 'explore' || (down && down.tc) || X.tcDrag) return;
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && X.view === 'orbit') orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.5, 120);
      pinch = d; down.moved = true; return;
    }
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (!down || !down.moved) return;
    if (X.view === 'walk') { WALK.yaw += dx * 0.004; WALK.pitch = clamp(WALK.pitch + dy * 0.004, -1.3, 1.3); WALK.to = null; return; }
    orbit.to = null;
    if (down.b === 2 || down.shift) {
      // pan: the target slides along the floor (right button or Shift)
      const a = orbit.cur[0] * D2R, k = orbit.cur[2] * 0.0016;
      orbit.cur[3] -= (Math.cos(a) * dx - Math.sin(a) * dy) * k; orbit.cur[5] -= (-Math.sin(a) * dx - Math.cos(a) * dy) * k;
    } else { orbit.cur[0] -= dx * 0.3; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, -10, 86); }
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && !down.tc && ev.type === 'pointerup' && performance.now() - X.tcUp > 200) clickAt(ev.clientX, ev.clientY);
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  cv.addEventListener('pointerleave', () => { if (!pts.size) STU.hover = ''; });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    if (X.view === 'walk') { const f = -ev.deltaY * 0.004; WALK.pos.x -= Math.sin(WALK.yaw) * f; WALK.pos.z -= Math.cos(WALK.yaw) * f; return; }
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.5, 120);
  }, { passive: false });
  document.addEventListener('keydown', ev => {
    if (ev.target && ev.target.closest && ev.target.closest('input, textarea, select')) return;
    if (APP.mode !== 'explore' || XR.on || HOST.picking) return;
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === 'z') { if (editOn()) { undo(); ev.preventDefault(); } return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (X.view === 'walk' && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { KEYS.add(k); WALK.to = null; ev.preventDefault(); return; }
    if (k === 'escape' && (STU.pick || STU.sel)) { if (STU.pick) STU.pick = null; else select(''); dirty(true); return; }
    if (!editOn()) return;
    if ((k === 'delete' || k === 'backspace') && STU.sel) { deleteItem(STU.sel); ev.preventDefault(); }
    else if (k === 'd' && STU.sel) duplicateItem(STU.sel);
    else if ({ w: 1, e: 1, r: 1 }[k]) tcSetMode({ w: 'translate', e: 'rotate', r: 'scale' }[k]);
  });
  document.addEventListener('keyup', ev => KEYS.delete(ev.key.toLowerCase()));
  window.addEventListener('blur', () => KEYS.clear());
}
// a click: editing, what is under it is selected (or, picking for a cube, goes in or out of its list); in Walk view a
// click on the floor walks there
function clickAt(mx, my) {
  const ray = pointerRay(mx, my), h = editOn() ? rayPick(ray) : null;
  if (h) { pressItem(h.id); return; }
  if (X.view === 'walk') {
    const p = ray.ray.intersectPlane(_rp, new THREE.Vector3());
    if (p && p.distanceTo(WALK.pos) < 60) { WALK.to = p; sfxAct('step', 'world', p.toArray()); return; }
  }
  if (editOn() && !STU.pick) select('');
}
// the trigger (or a click) on an item: picking for a cube, in or out of its list; else selected
function pressItem(id) {
  const it = STU.items.get(id);
  if (!it || !editOn()) return;
  if (STU.pick && it.kind !== 'c' && id !== STU.pick.id) { toggleLink(STU.pick.id, STU.pick.list, id); return; }
  select(id);
  sfxAct('pick', 'world', null);
}
// Walk view: W A S D or the arrows walk (Shift faster), a click on the floor walks there; the camera at 1.6 m
function walkStep(dt) {
  const f = (KEYS.has('w') || KEYS.has('arrowup') ? 1 : 0) - (KEYS.has('s') || KEYS.has('arrowdown') ? 1 : 0);
  const sd = (KEYS.has('d') ? 1 : 0) - (KEYS.has('a') ? 1 : 0), turn = (KEYS.has('arrowright') ? 1 : 0) - (KEYS.has('arrowleft') ? 1 : 0);
  const v = 1.6 * dt;
  WALK.yaw -= turn * 1.6 * dt;
  WALK.pos.x += (-Math.sin(WALK.yaw) * f + Math.cos(WALK.yaw) * sd) * v;
  WALK.pos.z += (-Math.cos(WALK.yaw) * f - Math.sin(WALK.yaw) * sd) * v;
  if (WALK.to) {
    const dx = WALK.to.x - WALK.pos.x, dz = WALK.to.z - WALK.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, 2 * dt);
    if (d < 0.02) WALK.to = null; else { WALK.pos.x += dx / d * step; WALK.pos.z += dz / d * step; }
  }
  WALK.pos.y = 1.6;
  const c = GL.camera;
  c.position.copy(WALK.pos);
  c.rotation.set(WALK.pitch, WALK.yaw, 0, 'YXZ');
}

// -------------------------------------------------------- the page's arrows --
// TransformControls on the selected item (page, editing): move, turn and size; a cube stays level and takes its size
// per axis, a sound only moves, an object sizes as a whole. A drag is one change (Undo), and while it lasts the room's
// records do not move the item here
function tcSetup() {
  if (!THREE.TransformControls) return;
  const tc = new THREE.TransformControls(GL.camera, GL.canvas);
  tc.setSize(0.85);
  tc.addEventListener('dragging-changed', e => {
    X.tcDrag = !!e.value;
    const it = tc.object && STU.items.get(tc.object.userData.id);
    if (e.value) { if (it) { it.carry = true; it.gl = null; beginChange([it.id]); } }
    else { if (it) { it.carry = false; tcRead(it); } endChange(); X.tcUp = performance.now(); }
  });
  tc.addEventListener('objectChange', () => { const it = tc.object && STU.items.get(tc.object.userData.id); if (it) tcRead(it); });
  GL.scene.add(tc);
  GL.tc = tc;
}
function tcRead(it) {
  const h = it.holder;
  if (it.kind === 'o') {
    let s = it.rec.s;
    if (GL.tc.mode === 'scale') { const v = [h.scale.x, h.scale.y, h.scale.z], d = v.map(x => Math.abs(x - s)); s = Math.max(1e-4, v[d.indexOf(Math.max(...d))]); h.scale.setScalar(s); }
    setRec(it.id, { p: h.position.toArray(), q: h.quaternion.toArray(), s });
  } else if (it.kind === 'c') {
    const yaw = new THREE.Euler().setFromQuaternion(h.quaternion, 'YXZ').y;
    h.rotation.set(0, yaw, 0);
    setRec(it.id, { p: h.position.toArray(), yaw, size: h.scale.toArray().map(v => Math.max(0.05, Math.abs(v))) });
  } else setRec(it.id, { p: h.position.toArray() });
}
function tcSetMode(m) {
  X.tcMode = m;
  tcAttach();
  dirty(true);
}
function tcAttach() {
  const tc = GL.tc;
  if (!tc) return;
  const it = STU.items.get(STU.sel);
  if (!it || !editOn() || XR.on || APP.mode !== 'explore') { if (tc.object) tc.detach(); return; }
  const m = it.kind === 's' ? 'translate' : X.tcMode;
  tc.setMode(m);
  tc.setSpace(it.kind === 'c' && m !== 'translate' ? 'local' : 'world');
  tc.showX = tc.showZ = !(it.kind === 'c' && m === 'rotate');
  tc.showY = true;
  if (tc.object !== it.holder) tc.attach(it.holder);
}
// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The scene stands life size round you, the side
// panel is redrawn on a canvas you point at, and labels become sprites on top or signs in the scene.
// Editing: point at an item to light it, pull the trigger (or pinch) to select it, and grip it to carry it: it follows
// your hand (and turns with it, moving freely), both grips size an object, the grip on a selected cube's corner
// stretches the cube; let go, it stays. In VR the left stick walks you through the scene and the right stick turns you
// (the scene moves, not you). The grip on the panel moves the panel. A/X plays and pauses the intro.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from',
  rot: new THREE.Quaternion(), free: false, lm: 'face', signL: new THREE.Quaternion(), signH: new THREE.Vector3(),
  walk: { x: 0, z: 0, yaw: 0 }, floorSpace: null, floorY: null, atSt: false, turnArm: true,
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------ scene pose --
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
// The scene is life size round you: its origin at the rig's floor point (outside a room where you stood as the session
// or the studio began, facing your way, or the anchored place; at a station its spot, 1.6 m over the room's floor).
// The floor is the session's local-floor where it has one (its height in the renderer's local space), else a standing
// eye height under the rig. The VR stick walk moves the scene (XR.walk, in the rig's frame), never the rig; views do
// not move it
const XR_EYE = 1.6, XR_AHEAD = 0;
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  const fy = XR.atSt || XR.floorY === null ? -XR_EYE : XR.floorY - GL.rig.position.y;
  GL.world.scale.setScalar(1);
  GL.world.quaternion.setFromAxisAngle(_xY, XR.walk.yaw);
  GL.world.position.set(XR.walk.x, fy, XR.walk.z);
  XR.globeBase.set(0, fy, 0);
}
// Recenter (the panel's button and the shell's menu, through recenter in the object the story returns): you in front of
// it again (anchored: Place again); at a station in a shared room the station's scene and panel go back where the story
// puts them instead, for everyone at its circle (the shell's HOST.room.recenter, refused while its story is locked)
function xrRecenterAsk() {
  if (HOST.room && HOST.room.recenter && HOST.room.placing && HOST.room.placing()) return HOST.room.recenter();
  if (HOST.anchor.on) HOST.anchor.again();
  XR.needRecenter = true;
  return true;
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0); XR.size = 1; XR.rot.identity();
  XR.walk.x = XR.walk.z = XR.walk.yaw = 0;   // (the stick walk goes back too: you where you stand)
  if (XR.panelGroup) xrPanelPose(XR.panelHome.p, XR.panelHome.yaw);
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); XR.size = s.s || 1; xrSceneRot(s.q); if (XR.panelGroup) xrPanelPose(s.pp, s.pr, s.pq); }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ------------------------------------------------- labels and free moving --
// The shell's headset settings, the same for everyone in a shared room (HOST.xr; read every frame, and a shell
// without them means labels on top and nothing free): the scene's small labels 'face' (on top: sprites turned to you,
// over everything), 'fixed' (in 3D: upright signs in the scene, turned to you) or 'hidden'; the cards (the story panels
// here, the station cards and name tags in the shell) the same three ways, independent of the labels (a shell without
// them: as the labels); free moving holds what the grip takes like a real object.
const xrLabelMode = () => (HOST.xr && HOST.xr.labels ? HOST.xr.labels() : 'face');
const xrCardMode = () => (HOST.xr && HOST.xr.cards ? HOST.xr.cards() : xrLabelMode());
const xrFreeOn = () => !!(HOST.xr && HOST.xr.free && HOST.xr.free());
const xrSig = () => (HOST.xr && HOST.xr.sig ? HOST.xr.sig() : '') + (HOST.panels && HOST.panels.sig ? HOST.panels.sig(XR_HERE) : '') + (xrAllHere() ? 'A' : '');
// this story's panels in a headset (the shell's HOST.panels, each story its own; at a station in a shared room the
// station's, for everyone at that circle): 'shown', 'controls' (only the foot bar) or 'hidden' (neither: A or X still
// plays); a shell without it: shown
const xrPanels = () => (HOST.panels && HOST.panels.get ? HOST.panels.get(XR_HERE) : 'shown');
// a headset in a shared room (the shell's HOST.room): no Stories screen there, a story runs only at its station (reached
// by walking into its circle), and away from one it is hidden, not pointable, paused and silent. A shell without
// HOST.room.away: as before (only at a station is the story the station's)
const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());
const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());
// an All stories circle in a shared room (the shell's HOST.room: cards, its live station shows its cards; allHere, it is
// one, its cards or a story picked there): the single-player Stories screen there, a card picking for everyone at the
// circle, and the story panel's Stories button back to the cards for them. A shell without them: as before
const xrCards = () => !!(HOST.room && HOST.room.cards && HOST.room.cards());
const xrAllHere = () => !!(HOST.room && HOST.room.allHere && HOST.room.allHere());
// the line on show, for the shell's subtitles in a headset (HOST.xr.subs, drawn by shared.js): the chapter on show's cues
// (ST.items: els with at and out), the story time now, the chapter's end and narrT (to the clock's time); null in
// explore mode, on the Stories screen and away from a station
const xrCaption = () => {
  if (APP.mode !== 'story' || XR.stories || xrAway()) return null;
  const s = storyT(APP.t), c = CH.find(x => s >= x.a && s < x.b) || CH[CH.length - 1], it = ST.items.find(x => x.ch === c);
  return it ? { s, end: c.b, els: it.els, narrT } : null;
};
const _fq = new THREE.Quaternion(), _fv = new THREE.Vector3();
// the yaw of a turn: where its front (+z) points along the floor (def when it points straight up or down)
function yawOf(q, def) { _fv.set(0, 0, 1).applyQuaternion(q); return Math.hypot(_fv.x, _fv.z) < 1e-4 ? +def || 0 : Math.atan2(_fv.x, _fv.z); }
// a turn from the shell or the room ([x, y, z, w] or a quaternion) into q; false when there is none
function xrQ(v, q) {
  if (v && v.isQuaternion) { q.copy(v); return true; }
  if (!Array.isArray(v) || v.length !== 4 || !v.every(Number.isFinite) || !v.some(x => x)) return false;
  q.fromArray(v).normalize();
  return true;
}
// the scene's own turn (free moving only: otherwise it faces you)
function xrSceneRot(q) { if (!(xrFreeOn() && xrQ(q, XR.rot))) XR.rot.identity(); }
// the story panel at p in the rig, upright at yaw, or (free moving) held at the turn q
function xrPanelPose(p, yaw, q) {
  const g = XR.panelGroup;
  if (p && p.isVector3) g.position.copy(p); else if (p) g.position.fromArray(p);
  if (!(xrFreeOn() && xrQ(q, g.quaternion))) g.rotation.set(0, +yaw || 0, 0);
}
// a turn of the hand (in the room) as a turn in the rig's frame, where the scene and the panel hang
function xrRigTurn(q, out) { return out.copy(GL.rig.quaternion).invert().multiply(q).multiply(_fq.copy(GL.rig.quaternion)); }
// the scene's facing, into q: from its placement point (gx, gy, gz) towards you; moving freely, from its home place,
// then turned by XR.rot
function xrFace(q, gx, gy, gz) {
  if (XR.free) _fv.copy(XR.globeBase).negate(); else _fv.set(-gx, -gy, -gz);
  q.setFromUnitVectors(_xz, _fv.normalize());
  if (XR.free) q.premultiply(XR.rot);
  return q;
}
// once a frame: the settings as they are now; free moving turned off gives the scene back its facing and stands the
// panel up again (its yaw kept), and turned on it keeps the scene's facing as it is (no jump)
function xrSettings() {
  XR.lm = xrLabelMode(); XR.cm = xrCardMode();
  const free = xrFreeOn();
  if (free === XR.free) return;
  if (!free) { XR.rot.identity(); XR.panelGroup.rotation.set(0, yawOf(XR.panelGroup.quaternion, 0), 0); }
  else if (XR.globeOff.lengthSq() > 1e-8) {
    _fv.copy(XR.globeBase).add(XR.globeOff).negate().normalize();
    XR.rot.setFromUnitVectors(_xz, _fv).multiply(_fq.setFromUnitVectors(_xz, _fv.copy(XR.globeBase).negate().normalize()).invert());
  } else XR.rot.identity();
  XR.free = free;
}

// ---------------------------------------------------------------- labels --
const LBL_STYLE = { '': ['#f2f6fc', null], mag: ['#ffd2f4', '#ff5ad9'], amb: ['#ffe2b0', '#ffb43b'],
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tip: ['#e7eef8', '#46d9ff'] };
// a label's picture, shared by its sprite and its sign
function labelTex(L) {
  if (L.ltex) return L.ltex;
  let bold, rest, cls;
  if (L.txt) [bold, rest, cls] = L.txt;
  else {
    const b = L.el.querySelector('b');
    bold = b ? b.textContent : ''; rest = L.el.textContent.slice(bold.length).trim();
    cls = ['mag', 'amb', 'grn', 'cyn'].find(k => L.el.classList.contains(k)) || '';
  }
  const px = 34, H = 56, pad = 16, gap = bold && rest ? 10 : 0;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = vfont(px, 700); const wb = bold ? ctx.measureText(bold).width : 0;
  ctx.font = vfont(px); const wr = rest ? ctx.measureText(rest).width : 0;
  cv.width = Math.ceil(pad * 2 + wb + gap + wr); cv.height = H;
  const [col, acc] = LBL_STYLE[cls] || LBL_STYLE[''];
  ctx.save(); rr(ctx, 0, 0, cv.width, H, 8); ctx.clip();
  ctx.fillStyle = cls === 'tip' ? 'rgba(10,19,34,0.97)' : 'rgba(3,8,16,0.82)'; ctx.fillRect(0, 0, cv.width, H);
  if (acc) { ctx.fillStyle = acc; ctx.fillRect(0, 0, 5, H); }
  ctx.restore();
  ctx.textBaseline = 'middle'; ctx.fillStyle = col;
  ctx.font = vfont(px, 700); ctx.fillText(bold, pad, H / 2 + 1);
  ctx.font = vfont(px); ctx.fillText(rest, pad + wb + gap, H / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return (L.ltex = { tex, aspect: cv.width / H, tip: cls === 'tip' });
}
// labels on top: a sprite turned to you, drawn over everything, beside its point
function labelSprite(L) {
  if (L.sprite) return L.sprite;
  const t = labelTex(L);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = t.tip ? 11 : 10;
  sp.userData.aspect = t.aspect;
  sp.center.set(-0.35 / sp.userData.aspect, 0.5);
  GL.world.add(sp);
  return (L.sprite = sp);
}
// labels in 3D: a flat sign at the sprite's place and size, turned to you each frame, readable from both sides (a quad facing +z and one facing
// -z with its picture flipped, so its text never reads mirrored), in the scene's depth: what stands in front of it
// hides it, and it hides what is behind it (drawn first of the see-through things; its clear corners cut away)
function labelSign(L) {
  if (L.sign) return L.sign;
  const t = labelTex(L), a = 0.35 / t.aspect, b = a + 1;   // (in its width, as the sprite's centre)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, -0.5, 0, b, -0.5, 0, b, 0.5, 0, a, 0.5, 0, a, -0.5, 0, b, -0.5, 0, b, 0.5, 0, a, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  const sg = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, alphaTest: 0.1 }));
  sg.renderOrder = -1;
  sg.userData.aspect = t.aspect;
  GL.world.add(sg);
  return (L.sign = sg);
}
function dropSprite(L) {
  if (!L) return;
  for (const k of ['sprite', 'sign']) {
    const o = L[k];
    if (!o) continue;
    if (o.parent) o.parent.remove(o);
    if (k === 'sign') o.geometry.dispose();
    o.material.dispose();
    L[k] = null;
  }
  if (L.ltex) { L.ltex.tex.dispose(); L.ltex = null; }
}
function hideLabelXR(L) { if (L.sprite) L.sprite.visible = false; if (L.sign) L.sign.visible = false; }
function placeLabelXR(L, alpha, S) {
  // on top (a sprite), in 3D (a sign) or hidden, as the shell's setting says; the pointer's tip is always a sprite
  const m = L === XR.tip ? 'face' : XR.lm, fixed = m === 'fixed';
  if (alpha <= 0.001 || m === 'hidden') { hideLabelXR(L); return; }
  if (fixed ? L.sprite : L.sign) (fixed ? L.sprite : L.sign).visible = false;
  const sp = fixed ? labelSign(L) : labelSprite(L), o = alpha;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  labelPos(L, sp.position);
  const hm = 0.021 * Math.max(1, sp.position.distanceTo(XR.camLocal));   // the same size to the eye, near or far
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
  if (fixed) {
    // upright and turned to you, about the vertical only (the rig's frame): a sign in the scene, not a sprite on top
    _fv.copy(sp.position).applyMatrix4(GL.world.matrix);
    sp.quaternion.copy(XR.signL).multiply(_fq.setFromAxisAngle(_xY, Math.atan2(XR.signH.x - _fv.x, XR.signH.z - _fv.z)));
  }
}
function xrTip() {}

// ----------------------------------------------------------- controllers --
function xrController(i) {
  const g = GL.renderer.xr.getController(i);
  const c = { i, g, src: null, hover: null, press: null, grab: null, wantPress: false, b4: false, o: new THREE.Vector3(), d: new THREE.Vector3() };
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  c.ray = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
  c.ray.renderOrder = 60;
  g.add(c.ray);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  g.add(tip);
  c.dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  c.dot.renderOrder = 61; c.dot.visible = false;
  GL.scene.add(c.dot);
  g.visible = false;
  g.addEventListener('connected', e => { c.src = e.data; c.ray.visible = e.data.targetRayMode !== 'screen'; });
  g.addEventListener('disconnected', () => { c.src = null; c.press = null; xrLetGo(c); c.hover = null; c.wantPress = false; c.dot.visible = false; });
  // presses are handled on the next frame, once the ray has its fresh pose
  g.addEventListener('selectstart', () => { c.wantPress = true; });
  g.addEventListener('selectend', () => { if (c.wantPress) { c.wantPress = false; xrPress(c); } xrRelease(c); });
  g.addEventListener('squeezestart', () => xrGrab(c, true));
  g.addEventListener('squeezeend', () => xrGrab(c, false));
  GL.scene.add(g);
  XR.ctrls.push(c);
}
function buzz(c, s, ms) {
  try {
    const a = c.src && c.src.gamepad && c.src.gamepad.hapticActuators;
    if (a && a[0] && a[0].pulse) a[0].pulse(s || 0.3, ms || 18);
  } catch (e) { /* no haptics */ }
}
function xrPress(c) {
  const h = c.hover;
  c.press = null;
  if (!h) { if (editOn() && !XR.stories && !STU.pick && APP.mode === 'explore') select(''); return; }   // (pointing at nothing: no selection)
  if (h.kind === 'shell') { HOST.collab.press(c.i); return; }   // the shared room's panel, previews, calibration
  if (h.kind === 'panel') {
    const r = h.P.at(h.x, h.y);
    if (!r) return;
    c.press = { kind: 'panel', P: h.P, id: r.id, r };
    if (r.drag) { r.drag(h.x, h.y); buzz(c, 0.2, 12); }
  } else if (h.kind === 'item' && !XR.stories) {   // the trigger (or a pinch) on an item selects it (or, picking for a cube, puts it on the cube's list)
    c.press = { kind: 'item' };
    pressItem(h.id); buzz(c, 0.4, 30);
  } else if (h.kind === 'floor' && editOn() && !STU.pick) select('');
}
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
    }
  }
}
const _gw = new THREE.Vector3(), _gwq = new THREE.Quaternion();
function xrGrab(c, on) {
  xrLetGo(c);
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || h.menu || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind === 'item') {   // an item (editing), taken where it is: it keeps its offset from the hand; a cube's corner stretches it
    const it = STU.items.get(h.id);
    if (!it || !editOn()) return;
    GL.world.updateMatrixWorld(true);
    const q0 = new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert();
    if (h.corner !== undefined && it.kind === 'c') {
      const k = h.corner, sg = [k & 1 ? 1 : -1, k & 2 ? 1 : -1, k & 4 ? 1 : -1], r = it.rec;
      // the opposite corner stays where it is (the scene's frame); the hand keeps its offset from the corner it took
      const opp = new THREE.Vector3(-sg[0] * r.size[0] / 2, -sg[1] * r.size[1] / 2, -sg[2] * r.size[2] / 2).applyAxisAngle(_xY, r.yaw).add(_gw.fromArray(r.p));
      const cor = new THREE.Vector3(sg[0] * r.size[0] / 2, sg[1] * r.size[1] / 2, sg[2] * r.size[2] / 2).applyAxisAngle(_xY, r.yaw).add(_gw.fromArray(r.p));
      c.grab = { target: 'corner', id: it.id, sg, opp, off: cor.sub(GL.world.worldToLocal(c.o.clone())), at: 0 };
    } else {
      c.grab = { target: 'item', id: it.id, q0, o0: c.o.clone(), p0: it.holder.getWorldPosition(new THREE.Vector3()), r0: it.holder.getWorldQuaternion(new THREE.Quaternion()), reach: 1, at: 0 };
    }
    beginChange([it.id]);
    it.carry = true; it.gl = null;
    select(it.id);
    buzz(c, 0.4, 25); sfxAct('grab', 'world', c.grab.p0 || null);   // (sound effects: picked up)
    return;
  }
  if (h.kind !== 'panel') return;   // the scene stays where it is: only the panel and the items move
  const p0 = XR.panelGroup.getWorldPosition(new THREE.Vector3());
  c.grab = { target: 'panel', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1, r0: XR.panelGroup.quaternion.clone() };
  buzz(c, 0.4, 25);
}
// let go of an item (the grip up, the controller gone, or locked meanwhile): it stays where it is (its record written),
// unless the other hand still holds it
function xrLetGo(c) {
  const G = c.grab;
  c.grab = null;
  if (!G || (G.target !== 'item' && G.target !== 'corner')) return;
  const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.id === G.id);
  if (o) { if (o.grab.target === 'item') xrRegrip(o); return; }
  const it = STU.items.get(G.id);
  if (it) { carryWrite(it, true); it.carry = false; sfxAct('drop', 'world', it.holder.getWorldPosition(new THREE.Vector3()).toArray()); }
  endChange();
}
// a hand that holds an item alone again (the other let go) carries on from where it is now
function xrRegrip(c) {
  const G = c.grab, it = STU.items.get(G.id);
  if (!it) return;
  G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.reach = 1;
  it.holder.getWorldPosition(G.p0); it.holder.getWorldQuaternion(G.r0);
}
// what a carried item's holder shows, into its record (at most ten times a second while it moves, and as it is let go)
function carryWrite(it, now) {
  const t = performance.now();
  if (!now && t - (it.wrote || 0) < 100) return;
  it.wrote = t;
  const h = it.holder;
  if (it.kind === 'o') setRec(it.id, { p: h.position.toArray(), q: h.quaternion.toArray(), s: h.scale.x });
  else if (it.kind === 'c') setRec(it.id, { p: h.position.toArray(), yaw: new THREE.Euler().setFromQuaternion(h.quaternion, 'YXZ').y, size: h.scale.toArray() });
  else setRec(it.id, { p: h.position.toArray() });
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3(), _gr = new THREE.Quaternion();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it (moving freely,
// it also turns with your hand, about it: what you hold stays in your hand)
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe') || ((G.target === 'item' || G.target === 'corner') && !editOn())) { xrLetGo(c); return; }   // locked meanwhile (a shared room's story lock: Lock this story)
  if (G.target === 'item') { carryItem(c, dt); return; }
  if (G.target === 'corner') { stretchCube(c); return; }
  const o = G.target === 'globe' ? XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'globe' && k.src && k.g.visible) : null;
  if (o) { if (c.i > o.i) xrResize(o, c); return; }
  if (G.two) { G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.p0.copy(GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff))); G.reach = 1; G.r0.copy(XR.rot); }
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  const lenMax = 4;
  if (_gv.length() > lenMax) _gv.setLength(lenMax);
  _gv.applyQuaternion(_gq).add(c.o);
  GL.rig.worldToLocal(_gv);
  if (G.target === 'globe') {
    XR.globeOff.copy(_gv).sub(XR.globeBase);
    if (XR.free) XR.rot.copy(xrRigTurn(_gq, _gr)).multiply(G.r0);
  } else {
    XR.panelGroup.position.copy(_gv);
    if (XR.free) { XR.panelGroup.quaternion.copy(xrRigTurn(_gq, _gr)).multiply(G.r0); return; }   // held as it is: it may tilt
    GL.rig.worldToLocal(_gh.copy(XR.head));
    XR.panelGroup.rotation.set(0, Math.atan2(_gh.x - _gv.x, _gh.z - _gv.z), 0); // keep it upright, facing you
  }
}
// both hands on the scene: it grows and shrinks with the distance between them (a quarter to four times the
// story's own size) and moves with their middle; moving freely, the line between them turns it about their middle
function xrResize(a, b) {
  const d = a.o.distanceTo(b.o);
  _gv.copy(a.o).add(b.o).multiplyScalar(0.5);
  GL.rig.worldToLocal(_gv);
  _gh.copy(b.o).sub(a.o).applyQuaternion(_gr.copy(GL.rig.quaternion).invert()).normalize();   // (in the rig's frame)
  const T = a.grab.two || (a.grab.two = b.grab.two = { d0: Math.max(0.05, d), s0: XR.size, m0: _gv.clone(), off0: XR.globeOff.clone(), l0: _gh.clone(), r0: XR.rot.clone() });
  XR.size = clamp(T.s0 * d / T.d0, 0.25, 4);
  XR.globeOff.copy(T.off0).add(_gv).sub(T.m0);
  if (!XR.free) return;
  _gq.setFromUnitVectors(T.l0, _gh);
  XR.rot.copy(_gq).multiply(T.r0);
  XR.globeOff.copy(XR.globeBase).add(T.off0).sub(T.m0).applyQuaternion(_gq).add(_gv).sub(XR.globeBase);
}
// an item in the hand: where the hand puts it (an object, moving freely, turns with the hand as a real object would;
// else, and a cube always, it stays upright and turns only about the vertical; a sound only moves); both hands on an
// object size it (a twentieth to twenty times) and move it with their middle; the right stick pushes it away or pulls it in
const _mq = new THREE.Quaternion(), _mi = new THREE.Quaternion(), _mv = new THREE.Vector3(), _me = new THREE.Euler();
function carryItem(c, dt) {
  const G = c.grab, it = STU.items.get(G.id), gp = c.src.gamepad;
  if (!it) { c.grab = null; return; }
  const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'item' && k.grab.id === G.id && k.src && k.g.visible);
  GL.world.updateMatrixWorld(true);
  _mi.copy(GL.world.getWorldQuaternion(_mq)).invert();
  if (o && it.kind === 'o') {
    if (c.i < o.i) return;   // (once a frame, by the second hand)
    const d = c.o.distanceTo(o.o);
    _mv.copy(c.o).add(o.o).multiplyScalar(0.5);
    const W = G.two || (G.two = o.grab.two = { d0: Math.max(0.05, d), s0: it.rec.s, m0: _mv.clone(), p0: it.holder.getWorldPosition(new THREE.Vector3()) });
    it.holder.position.copy(GL.world.worldToLocal(W.p0.clone().add(_mv).sub(W.m0)));
    it.holder.scale.setScalar(clamp(W.s0 * d / W.d0, W.s0 / 20, W.s0 * 20));
    carryWrite(it);
    return;
  }
  if (o) { if (c.i < o.i) return; }
  if (G.two) xrRegrip(c);
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(-gp.axes[3] * dt * 1.5), 0.15, 8);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);   // the hand's turn since it took hold
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  if (_gv.length() > 30) _gv.setLength(30);
  _gv.applyQuaternion(_gq).add(c.o);
  it.holder.position.copy(GL.world.worldToLocal(_gv));
  if (it.kind !== 's') {
    let q;
    if (XR.free && it.kind === 'o') q = _mq.copy(_gq).multiply(G.r0);
    else { _me.setFromQuaternion(_gq, 'YXZ'); q = _mq.setFromAxisAngle(_xY, _me.y).multiply(G.r0); }
    it.holder.quaternion.copy(q.premultiply(_mi));
    if (it.kind === 'c') it.holder.rotation.set(0, new THREE.Euler().setFromQuaternion(it.holder.quaternion, 'YXZ').y, 0);
  }
  carryWrite(it);
}
// the grip on a selected cube's corner: the opposite corner stays, this one follows the hand (each side at least 10 cm)
function stretchCube(c) {
  const G = c.grab, it = STU.items.get(G.id);
  if (!it) { c.grab = null; return; }
  GL.world.updateMatrixWorld(true);
  const r = it.rec, cor = GL.world.worldToLocal(_mv.copy(c.o)).add(G.off).sub(G.opp).applyAxisAngle(_xY, -r.yaw);
  const size = [0, 1, 2].map(i => Math.max(0.1, cor.getComponent(i) * G.sg[i]));
  const mid = new THREE.Vector3(G.sg[0] * size[0] / 2, G.sg[1] * size[1] / 2, G.sg[2] * size[2] / 2).applyAxisAngle(_xY, r.yaw).add(G.opp);
  it.holder.position.copy(mid); it.holder.scale.fromArray(size);
  carryWrite(it);
}
// VR (not passthrough), nothing carried: the left stick walks you through the scene (it moves, not the rig), the right
// stick turns you 30 degrees a flick, about where you stand
function stickWalk(c, gp, dt) {
  if (!XR.clear || APP.mode !== 'explore' || XR.stories || xrAway() || XR.ctrls.some(k => k.grab) || !gp || gp.axes.length < 4) return;
  const ax = gp.axes[2], ay = gp.axes[3], hand = c.src.handedness;
  if (hand === 'left') {
    const m = Math.hypot(ax, ay);
    if (m < 0.15) return;
    GL.rig.updateMatrixWorld(true);
    _gh.set(0, 0, -1).applyQuaternion(XR.headQ).applyQuaternion(_gr.copy(GL.rig.quaternion).invert());
    _gh.y = 0;
    if (_gh.lengthSq() < 1e-6) return;
    _gh.normalize();
    const v = 1.5 * dt * Math.min(1, (m - 0.15) / 0.85) / m, fx = -ay * v, sx = ax * v;   // (forward and to the side)
    XR.walk.x -= _gh.x * fx - _gh.z * sx; XR.walk.z -= _gh.z * fx + _gh.x * sx;
  } else if (hand === 'right') {
    if (Math.abs(ax) < 0.3) { XR.turnArm = true; return; }
    if (!XR.turnArm || Math.abs(ax) < 0.7) return;
    XR.turnArm = false;
    const th = ax > 0 ? Math.PI / 6 : -Math.PI / 6, h = GL.rig.worldToLocal(_gv.copy(XR.head)), cs = Math.cos(th), sn = Math.sin(th);
    const dx = XR.walk.x - h.x, dz = XR.walk.z - h.z;
    XR.walk.x = h.x + cs * dx + sn * dz; XR.walk.z = h.z - sn * dx + cs * dz; XR.walk.yaw += th;
    buzz(c, 0.2, 12);
  }
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; xrLetGo(c); return; }   // (a controller gone lets go)
  c.o.setFromMatrixPosition(g.matrix);
  c.d.set(0, 0, -1).transformDirection(g.matrix);
  let hit = null, dist = 2.5;
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  // then the shared room's own things (its panel, the other stations, a calibration), if nearer than a panel
  const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);
  if (sh && sh.panel && XR[sh.panel]) { const P = XR[sh.panel]; hit = { kind: 'panel', P, x: sh.u * P.w, y: (1 - sh.v) * P.h, point: sh.point, menu: true }; dist = sh.dist; }   // (this panel in the shell's menu, its Story tab)
  else if (sh) { hit = sh; dist = sh.dist; }
  else if (xrAway()) hit = null;   // away from its station in a shared room: nothing of the story to point at
  else if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories && APP.mode === 'explore') {
    // an item (editing: lit, its name shown), else the floor (the dot only)
    const ih = editOn() ? rayPick(XR.raycaster) : null;
    if (ih) { hit = { kind: 'item', id: ih.id, corner: ih.corner, point: ih.point }; dist = ih.dist; }
    else {
      const ts = XR.raycaster.intersectObjects(XR.solid, false);
      if (ts.length && ts[0].distance < 30) { hit = { kind: 'floor', point: ts[0].point.clone() }; dist = ts[0].distance; }
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // A/X: play or pause the story; the sticks walk and turn (VR)
  const gp = c.src.gamepad;
  if (gp) {
    const b4 = !!(gp.buttons[4] && gp.buttons[4].pressed);
    if (b4 && !c.b4 && APP.mode === 'story') APP.togglePlay();
    c.b4 = b4;
    stickWalk(c, gp, dt);
  }
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

// ---------------------------------------------------------------- frames --
const _xUp = new THREE.Vector3(0, 1, 0);
function xrBegin(frame, dt) {
  xrSettings();
  const ref = GL.renderer.xr.getReferenceSpace();
  const pose = frame && ref ? frame.getViewerPose(ref) : null;
  if (pose) {
    const p = pose.transform.position, q = pose.transform.orientation;
    XR.head.set(p.x, p.y, p.z); XR.headQ.set(q.x, q.y, q.z, q.w);
    if (XR.needRecenter) { if (!HOST.anchor.held()) xrRecenter(); XR.needRecenter = false; } // an anchored place stays put
    // anchored: the spot in the room carries the frame that holds the panels, the Stories screen and the scene
    // (asked only once the headset has a pose, so a new anchor goes where things really are)
    const A = HOST.anchor.frame(frame, ref);
    if (A) { GL.rig.position.fromArray(A.p); GL.rig.quaternion.setFromAxisAngle(_xUp, A.yaw); }
    XR.atSt = !!(A && A.room);   // (at a station the rig is its spot, 1.6 m over the room's floor)
    // the real floor: the session's local-floor, as a height in the renderer's local space
    if (XR.floorSpace) { try { const fp = frame.getPose(XR.floorSpace, ref); if (fp) XR.floorY = fp.transform.position.y; } catch (e) { XR.floorSpace = null; } }
    // in a shared room no Stories screen: a story is reached by walking into its station's circle, and at its station it
    // is the station's (a shell without HOST.room.away: only there); leaving the room brings it back, as for a new wearer
    const roomOnly = xrRoomOnly();
    if (XR.inRoom && !roomOnly) xrFreshStart();
    XR.inRoom = roomOnly;
    // (at an All stories circle its cards are the Stories screen, opened as the panel's Stories button opens it, and they
    // close once a story is picked there or the headset walks into another circle)
    if (xrCards() && !XR.stories) { XR.stories = true; XR.inStory = false; XR.kbd.open = false; APP.playing = false; }
    if (XR.stories && !xrCards() && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();
  }
  const bl = XR.session && XR.session.renderState.baseLayer;
  if (bl) {
    if (bl.framebufferHeight) XR.viewH = bl.framebufferHeight;
    if (!XR.fov) {
      XR.fov = true;
      try { if ('fixedFoveation' in bl) bl.fixedFoveation = 0.5; } catch (e) { /* not supported */ }
    }
  }
  GL.rig.updateMatrixWorld(true);
  _xinv.copy(GL.world.matrixWorld).invert();
  for (const c of XR.ctrls) xrPoint(c, dt);
  // away from its station in a shared room the story waits, silent (hidden in xrUpdate, not pointable in xrPoint); a
  // pause made here is not the room's (the shell takes no clock or state from a headset that is not at a station)
  if (xrAway() || xrCards()) { APP.playing = false; SLIDE.tail = null; }
  for (const P of XR.panels) {
    let hv = null;
    for (const c of XR.ctrls) {
      if (c.hover && c.hover.kind === 'panel' && c.hover.P === P) { const r = P.at(c.hover.x, c.hover.y); if (r) hv = r.id; }
    }
    P.hover = hv;
  }
  // the item a controller points at (or holds) lights up and shows its name; a cube's corner too
  const ch = XR.ctrls.find(c => c.grab && c.grab.id) || XR.ctrls.find(c => c.hover && c.hover.kind === 'item');
  STU.hover = ch ? (ch.grab ? ch.grab.id : ch.hover.id) : '';
  const cc = XR.ctrls.find(c => c.grab && c.grab.target === 'corner') || XR.ctrls.find(c => c.hover && c.hover.kind === 'item' && c.hover.corner !== undefined);
  STU.hotCorner = cc ? { id: (cc.grab || cc.hover).id, k: cc.grab && cc.grab.target === 'corner' ? [0, 1, 2].reduce((k, i) => k + (cc.grab.sg[i] > 0 ? 1 << i : 0), 0) : cc.hover.corner } : null;
}
function xrUpdate(S) {
  // the Stories screen replaces the story's panels and hides the story
  const land = !!XR.stories, away = xrAway();   // (away from its station in a shared room: the story hidden, only the shell's things)
  if (XR.land) {
    if (XR.landRev !== HOST.listRev) xrLandingCards();   // a story added while the app runs: its card joins the rows
    for (const P of XR.land) P.mesh.visible = land;
    // cards hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and A or X still plays); cards in 3D: the panels stand in the scene, as the labels' signs do (the
    // labels have their own setting). And this story's panels (xrPanels): controls only keeps just the foot bar, hidden
    // neither
    const pm = xrPanels(), pv = !land && !away && XR.cm !== 'hidden';
    XR.main.mesh.visible = pv && pm === 'shown';
    XR.foot.mesh.visible = pv && pm !== 'hidden';
    panelDepth(XR.main, XR.cm === 'fixed'); panelDepth(XR.foot, XR.cm === 'fixed');
  }
  GL.world.visible = !land && !away;
  if (land !== XR.landShown) { XR.landShown = land; HOST.setUrl(land); }
  GL.rig.updateMatrixWorld(true);
  XR.camLocal.copy(XR.head);
  GL.world.worldToLocal(XR.camLocal);
  // labels in 3D: each sign turns to you (placeLabelXR) from the world's frame back to the rig's, where your head is
  XR.signL.copy(GL.world.quaternion).invert();
  GL.rig.worldToLocal(XR.signH.copy(XR.head));
  const story = APP.mode === 'story';
  for (const L of ST.labels) {
    if (story) placeLabelXR(L, fadeVal(storyT(APP.t), L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0), S);
    else hideLabelXR(L);
  }
  for (const L of LBL.sets) placeLabelXR(L, setLabelAlpha(L, S), S);
  for (const L of LBL.extra) {
    if (!story && L.txt) placeLabelXR(L, L.show, S);
    else hideLabelXR(L);
  }
  xrTip(S);
  const now = performance.now();
  for (const P of XR.panels) panelTick(P, now);
}

// --------------------------------------------------------------- session --
function xrMsg(text) {
  const el = $('#xrmsg');
  el.textContent = text; el.style.display = 'block';
  clearTimeout(xrMsg.t);
  xrMsg.t = setTimeout(() => { el.style.display = 'none'; }, 6000);
}
async function xrStart(mode) {
  if (XR.session || !navigator.xr) return;
  let session;
  try {
    session = await navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) });
  } catch (err) {
    HOST.landingVR = false;
    xrMsg(`Could not start ${mode === 'immersive-ar' ? 'AR' : 'VR'}: ${err && err.message ? err.message : err}`);
    return;
  }
  XR.session = session; XR.mode = mode;
  HOST.session = session; HOST.mode = mode;
  session.addEventListener('visibilitychange', xrVisibility);
  xrEnterScene();
  try {
    GL.renderer.xr.setReferenceSpaceType('local');
    await GL.renderer.xr.setSession(session);
    const ref = GL.renderer.xr.getReferenceSpace();
    if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
    xrFloor(session);
  } catch (err) {
    console.error(err);
    xrMsg('Could not start the headset view: ' + (err && err.message ? err.message : err));
    try { await session.end(); } catch (e) { /* already ended */ }
    if (XR.on) xrEnded();
  }
}
function xrEnterScene() {
  XR.stories = false;
  XR.on = true; XR.needRecenter = true; XR.fov = false; XR.tipI = -1;
  XR.free = xrFreeOn(); XR.lm = xrLabelMode(); XR.cm = xrCardMode();   // (as the shell has them: nothing to turn off or on at the first frame)
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  tcAttach();   // (the page's arrows are not drawn in a headset)
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.o = -1;
  // every headset session starts the story from the top; entered from the start screen, it shows the Stories menu first
  // (not in a shared room: there a story is reached by walking into its station's circle)
  XR.inRoom = xrRoomOnly();
  const fromStart = (HOST.picking || HOST.landingVR) && !XR.inRoom;
  HOST.landingVR = false;
  HOST.closePicker();
  if (fromStart) { APP.enterStory(0); APP.playing = false; XR.stories = true; XR.inStory = false; audioSync(); }
  else { XR.inStory = true; if (APP.mode === 'story') APP.playing = true; } // already in a story: carry on where you were
  $('#tip').style.opacity = 0;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.el.style.opacity = 0;
  if (document.fonts && !XR.fontOK) {
    Promise.all([document.fonts.load(vfont(30, 700)), document.fonts.load(vfont(30))]).then(() => {
      XR.fontOK = 1;
      [...ST.labels, ...LBL.sets, ...LBL.extra].forEach(dropSprite);
    }).catch(() => {});
  }
}
// Headset taken off (or put to sleep) for more than a few seconds: treat the next
// wearer as a new visitor. Restart the story and place everything in front of them
// (when anchored, everything stays at its spot in the room).
const XR_AWAY_MS = 3000;
function xrVisibility() {
  const v = XR.session && XR.session.visibilityState;
  if (v === 'hidden') { if (!XR.hiddenAt) XR.hiddenAt = performance.now(); }
  else if (v === 'visible' && XR.hiddenAt) {
    const away = performance.now() - XR.hiddenAt;
    XR.hiddenAt = 0;
    if (away > XR_AWAY_MS) xrFreshStart();
  }
  audioSync();
}
function xrFreshStart() {
  XR.kbd.open = false; XR.kbd.q = '';
  for (const c of XR.ctrls) { c.press = null; xrLetGo(c); c.wantPress = false; }
  // in a shared room the story and its place stay (at its station the room's clock and state go on applying; away from
  // one a new wearer walks up to a station: no Stories screen in a room)
  if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; // a new wearer lands in the Stories screen
  XR.needRecenter = true; // uses the new wearer's head position and direction on the next frame
  lastNow = 0;
}
// a story picked inside the headset takes over the running session
function xrAdopt() {
  XR.session = HOST.session; XR.mode = HOST.mode;
  XR.session.addEventListener('visibilitychange', xrVisibility);
  XR.ctrls.forEach((c, i) => { const s = HOST.inputs[i]; if (s) { c.src = s; c.ray.visible = s.targetRayMode !== 'screen'; } });
  xrEnterScene();
  // keep the cell and the panel where they were in the story before
  const p = HOST.xrPose;
  if (p) {
    XR.needRecenter = false;
    GL.rig.position.copy(p.rp); GL.rig.quaternion.copy(p.rq);
    XR.globeOff.copy(p.off); XR.size = p.s || 1; xrSceneRot(p.rot || p.q);
    xrPanelPose(p.pp, p.pr, p.pq);
  }
  const ref = GL.renderer.xr.getReferenceSpace();
  if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
  xrFloor(XR.session);
}
// the session's own local-floor (asked for as an optional feature): where the real floor is, for objects to stand on
function xrFloor(session) {
  XR.floorSpace = null; XR.floorY = null;
  if (!session || !session.requestReferenceSpace) return;
  session.requestReferenceSpace('local-floor').then(s => { if (XR.session === session) XR.floorSpace = s; }, () => { /* none: 1.6 m under the eyes */ });
}
function xrEnded() {
  if (!XR.on) return;
  const away = xrAway();   // (asked while the session is still the shell's)
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; xrLetGo(c); c.hover = null; c.src = null; }
  STU.hover = ''; STU.hotCorner = null; XR.floorSpace = null; XR.floorY = null; XR.atSt = false;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { hideLabelXR(L); L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.stars.visible = false;   // (the room has no stars)
  GL.world.visible = true;
  for (const P of XR.land || []) P.mesh.visible = false;
  // left the headset from the Stories screen, or away from a station in a shared room (its story hidden and paused
  // there): back to the Stories screen on the page
  if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }
  applyTheme();
  resize();
  tcAttach();
}
function xrSetup() {
  XR.raycaster = new THREE.Raycaster();
  // panel 0.62 m wide, about 40 degrees to the left and facing you
  const mw = 0.62, px = -0.56, py = 0.04, pz = -0.86, yaw = Math.atan2(-px, -pz);
  XR.main = makePanel(1024, 1200, mw, drawMain, sigMain);
  XR.foot = makePanel(1024, 176, mw, drawFoot, sigFoot);
  XR.panelGroup = new THREE.Group();
  XR.panelHome = { p: new THREE.Vector3(px, py, pz), yaw };
  XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.y = yaw;
  GL.rig.add(XR.panelGroup);
  XR.foot.mesh.position.set(0, -(mw * 1200 / 1024) / 2 - 0.012 - (mw * 176 / 1024) / 2, 0);
  for (const P of [XR.main, XR.foot]) { XR.panelGroup.add(P.mesh); XR.panels.push(P); }
  XR.panelMeshes = XR.panels.map(P => P.mesh);
  XR.solid = GL.sets.stage.solid;   // what the pointer's dot lands on when it misses an item: the floor
  xrLandingSetup();
  for (let i = 0; i < 2; i++) xrController(i);
  GL.renderer.xr.addEventListener('sessionend', xrEnded);
  $('#btnVR').addEventListener('click', () => xrStart('immersive-vr'));
  $('#btnAR').addEventListener('click', () => xrStart('immersive-ar'));
  if (!navigator.xr) {
    if (/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent)) xrMsg('Open this page over https:// to view it in VR.');
    return;
  }
  navigator.xr.isSessionSupported('immersive-vr').then(vr => {
    if (vr) $('#btnVR').hidden = false;
    // headsets support both; phones only AR, which this layout is not made for
    return navigator.xr.isSessionSupported('immersive-ar').then(ar => { if (ar && vr) $('#btnAR').hidden = false; });
  }).catch(() => {});
}

// ------------------------------------------------------------ VR panels --
// The HTML side panel can't be shown inside a headset, so it is redrawn on a
// canvas texture. Each draw records clickable regions for the controller ray.
const VC = { bg: 'rgba(8,15,28,0.95)', ink: '#e7eef8', muted: '#95a6bd', faint: '#6c7d94', line: 'rgba(149,166,189,0.22)',
  chip: 'rgba(149,166,189,0.13)', chipHi: 'rgba(149,166,189,0.30)', on: 'rgba(70,217,255,0.20)', cyan: '#46d9ff',
  magenta: '#ff5ad9', amber: '#ffb43b', red: '#ff5a4b', green: '#3ee08f' };
const vfont = (px, w) => `${w || 400} ${px}px B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
const cssColor = s => { const m = /var\(--(\w+)\)/.exec(s || ''); return m ? VC[m[1]] || VC.ink : s || VC.ink; };
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// draws wrapped text (textBaseline top), returns its height
function textBlock(ctx, text, x, y, maxW, px, lh, color, weight, maxLines) {
  ctx.font = vfont(px, weight);
  ctx.fillStyle = color || VC.ink;
  let L = wrapLines(ctx, text, maxW);
  if (maxLines && L.length > maxLines) { L = L.slice(0, maxLines); L[maxLines - 1] += '…'; }
  L.forEach((l, k) => ctx.fillText(l, x, y + k * lh));
  return L.length * lh;
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
// a title (textBaseline top): its own size when it fits, else smaller to fit, down to min, on the same baseline;
// below that, with two, on two lines split where they are most even (as large as fits); else cut short at min.
// Returns its height: lh for one line, lh plus a line for two.
function fitTitle(ctx, text, x, y, maxW, px, lh, color, weight, min, two) {
  text = String(text); ctx.fillStyle = color || VC.ink;
  const size = L => {   // the largest size from px down to min at which every line fits, else 0
    ctx.font = vfont(px, weight);
    let s = Math.min(px, Math.floor(px * maxW / Math.max(...L.map(l => ctx.measureText(l).width))));
    for (; s >= min; s--) { ctx.font = vfont(s, weight); if (L.every(l => ctx.measureText(l).width <= maxW)) return s; }
    return 0;
  };
  let s = size([text]);
  if (!s && two) {
    const wd = text.split(' ');
    let L = null, m = Infinity;
    ctx.font = vfont(px, weight);
    for (let k = 1; k < wd.length; k++) {
      const p = [wd.slice(0, k).join(' '), wd.slice(k).join(' ')], v = Math.max(...p.map(l => ctx.measureText(l).width));
      if (v < m) { m = v; L = p; }
    }
    if (L && (s = size(L))) {
      const y0 = y + Math.round((px - s) * 0.8), l2 = Math.round(lh * s / px);
      L.forEach((l, k) => ctx.fillText(l, x, y0 + k * l2));
      return lh + l2;
    }
  }
  s = s || min; ctx.font = vfont(s, weight);
  ctx.fillText(fitText(ctx, text, maxW), x, y + Math.round((px - s) * 0.8));   // (B612's baseline is 0.8 of its size down)
  return lh;
}
function vButton(ctx, P, id, x, y, w, h, label, fn, o = {}) {
  const hov = P.hover === id;
  rr(ctx, x, y, w, h, o.r !== undefined ? o.r : 10);
  ctx.fillStyle = o.primary ? (hov ? '#8ce9ff' : VC.cyan) : o.on ? VC.on : hov ? VC.chipHi : VC.chip;
  ctx.fill();
  if (o.on || (hov && !o.primary)) { ctx.lineWidth = 2; ctx.strokeStyle = o.on ? VC.cyan : 'rgba(149,166,189,0.55)'; ctx.stroke(); }
  if (label) {
    ctx.font = vfont(o.px || 25, o.bold || o.on || o.primary ? 700 : 400);
    ctx.fillStyle = o.primary ? '#04131c' : o.color || VC.ink;
    ctx.textBaseline = 'middle';
    if (o.left) ctx.fillText(fitText(ctx, label, w - 28), x + 16, y + h / 2 + 1);
    else { ctx.textAlign = 'center'; ctx.fillText(fitText(ctx, label, w - 16), x + w / 2, y + h / 2 + 1); ctx.textAlign = 'left'; }
    ctx.textBaseline = 'top';
  }
  if (fn) P.regions.push({ id, x, y, w, h, fn });
}
function swatch(ctx, x, y, s, color) { rr(ctx, x, y, s, s, 4); ctx.fillStyle = color; ctx.fill(); }
function makePanel(w, h, mw, draw, sig) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = Math.min(8, GL.renderer.capabilities.getMaxAnisotropy());
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mw * h / w),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  mesh.renderOrder = 50;
  mesh.visible = false;
  const P = { w, h, cv, ctx: cv.getContext('2d'), tex, mesh, draw, sig, regions: [], hover: null, last: '', t: 0, inScene: false };
  P.at = (x, y) => {
    for (let k = P.regions.length - 1; k >= 0; k--) {
      const r = P.regions[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  };
  return P;
}
// a story panel in the scene or on top, as the cards setting says: in 3D, it stands in the scene as the labels' signs do
// (depth-tested and writing depth, drawn first of the see-through things, its clear corners cut away), so what stands
// in front of it hides it and it hides what is behind it; otherwise it is drawn over everything. Set only when that
// changes (a new alphaTest needs the material built again)
function panelDepth(P, inScene) {
  if (P.inScene === inScene) return;
  const m = P.mesh.material;
  P.inScene = m.depthTest = m.depthWrite = inScene;
  m.alphaTest = inScene ? 0.1 : 0; m.needsUpdate = true;
  P.mesh.renderOrder = inScene ? -1 : 50;
}
// redraw only when what the panel shows has changed (texture uploads are not free)
function panelTick(P, now) {
  const s = P.sig() + '|' + P.hover + '|' + XR.fontOK;
  if (s === P.last || now - P.t < 60) return;
  P.last = s; P.t = now;
  const ctx = P.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, P.w, P.h);
  ctx.globalAlpha = 1; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  P.regions = [];
  rr(ctx, 0, 0, P.w, P.h, 26);
  ctx.fillStyle = XR.clear ? VC.bg : 'rgba(8,15,28,0.97)';
  ctx.fill();
  P.draw(ctx, P);
  P.tex.needsUpdate = true;
}

// ------------------------------------------------------------ main panel --
function sigMain() {
  if (XR.stories) return 'stories' + audioLabel();
  if (APP.mode === 'story') {
    const it = ST.items.find(x => x.ch === curCh);
    let s = 's' + audioLabel() + xrSig() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
  return ['x', audioLabel(), xrSig(), paneSig(), X.scroll[X.tab] || 0, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : '', STU.hover].join('|');
}
const XR_HERE = 'studio';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// in two rows on an arc in front of you while the story itself is hidden.
// Its heights over your eyes (the rig): the header's middle, and the middles of the cards' two rows (0.461 m tall,
// 0.05 m apart, the upper one's top 0.03 m under the header), so it reaches from 0.56 m above your eyes to 0.61 m below
const XR_LAND = { head: 0.475, rows: [0.13, -0.38] };
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  // the header: the title, a hint and Back to the story (the sound, Sound check, Anchor, Exit, Recenter and Repeat are
  // in the shell's menu, which a stick's click opens)
  const head = makePanel(1400, 236, 1.02, drawLandHead, () => 'h' + XR.inStory + xrCards() + HOST.anchor.status() + HOST.list.length);
  head.mesh.position.set(0, XR_LAND.head, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head); XR.panels.push(head);
  xrLandingCards();
}
// One card per story, 0.36 m wide, in two rows on one arc, as the All stories circle's icon has them: the first half of
// the stories (rounded up) in the upper row, in the list's order, the rest under them, a shorter row centred. In a row
// neighbours stand 0.381 m apart and the outer ones at most 62° to the side (eight: 0.306 rad apart at 1.25 m), never
// nearer than 1.25 m (a few stories stand closer together in angle). Built again when the shell's list of stories
// changes while the app runs (HOST.listRev: a story added in a release gets its card)
function xrLandingCards() {
  for (const P of XR.land.splice(1)) {
    XR.landGroup.remove(P.mesh); XR.panels.splice(XR.panels.indexOf(P), 1);
    P.tex.dispose(); P.mesh.geometry.dispose(); P.mesh.material.dispose();
  }
  const n = HOST.list.length, per = Math.ceil(n / 2), d = Math.max(1.25, per > 1 ? 0.1905 / Math.sin(1.085 / (per - 1)) : 0), step = 2 * Math.asin(0.1905 / d);
  XR.landRev = HOST.listRev;
  HOST.list.forEach((s, k) => {
    const row = k < per ? 0 : 1, m = row ? n - per : per, a = (k - row * per - (m - 1) / 2) * step;
    const P = makePanel(640, 820, 0.36, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, XR_LAND.rows[row], -Math.cos(a) * d);
    P.mesh.rotation.y = -a;
    XR.landGroup.add(P.mesh); XR.land.push(P); XR.panels.push(P);
  });
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// leave the Stories screen: back into this story (resumed, or started if it never ran)
function xrLandingClose() {
  XR.stories = false;
  // at a shared room's station the story goes on as the room has it: a restart here would restart it for everyone (in
  // a room a story runs only at its station, on the station's clock)
  if (!XR.inStory && !HOST.collab.mine() && !xrRoomOnly()) APP.enterStory(0);
  XR.inStory = true;
  if (APP.mode === 'story' && !xrRoomOnly()) APP.playing = true;
}
function drawLandHead(ctx, P) {
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
  // anchored: where the place stands, in place of the hint
  const an = HOST.anchor.status();
  textBlock(ctx, an || 'The same ideas, very different networks. Point at a story and pull the trigger (or pinch).', 48, 128, 860, 27, 38, an ? VC.ink : VC.muted, 400, 2);
  // (the sound, Sound check, Anchor, Exit, Recenter or Place again, and Repeat are the shell's menu's, for every story)
  if (XR.inStory && !xrCards()) vButton(ctx, P, 'back', P.w - 44 - 294, 128, 294, 64, 'Back to the story', xrLandingClose, { px: 26 });
}
function drawLandCard(ctx, P, s) {
  const here = s.key === XR_HERE, id = 'card', hov = P.hover === id;
  rr(ctx, 8, 8, P.w - 16, P.h - 16, 22);
  ctx.lineWidth = 4; ctx.strokeStyle = hov ? s.col : here && XR.inStory ? 'rgba(70,217,255,0.6)' : 'rgba(140,170,210,0.3)'; ctx.stroke();
  ctx.fillStyle = s.col; ctx.fillRect(8, 8, P.w - 16, 10);
  fitTitle(ctx, s.kick.toUpperCase(), 48, 64, P.w - 96, 28, 34, s.col, 700, 22);
  // a long title shrinks a little, else takes two lines and the description moves down (ending above the length)
  const dy = 112 + fitTitle(ctx, s.title, 46, 112, P.w - 94, 72, 78, VC.ink, 700, 58, true) + 32;
  textBlock(ctx, s.desc, 48, dy, P.w - 96, 31, 45, VC.muted, 400, Math.min(7, Math.floor((P.h - 243 - dy) / 45) + 1));
  ctx.font = vfont(26); ctx.fillStyle = VC.faint; ctx.fillText(fitText(ctx, s.len, P.w - 96), 48, P.h - 196);
  const label = here && XR.inStory ? 'Resume' : 'Start';
  vButton(ctx, P, 'go', 48, P.h - 140, P.w - 96, 92, label, null, { primary: true, px: 34 });
  P.regions.push({ id, x: 0, y: 0, w: P.w, h: P.h, fn: () => (here && !xrCards() ? xrLandingClose() : HOST.go(s.key)) });
}
function drawStoriesPane(ctx, P, x, y, W) {
  y += textBlock(ctx, 'Choose a story', x, y, W, 46, 54, VC.ink, 700) + 6;
  y += textBlock(ctx, 'The same ideas, very different networks. Pick one; you stay in the headset view.', x, y, W, 25, 35, VC.muted) + 22;
  // fit the cards above the Back button (the list grew to four)
  const h = Math.min(210, Math.floor((P.h - 96 - y) / XR_STORIES.length) - 18);
  for (const { key: k, kick, title, desc, col } of XR_STORIES) {
    const here = k === XR_HERE;
    vButton(ctx, P, 'story:' + k, x, y, W, h, '', () => { if (here && !xrCards()) XR.stories = false; else HOST.go(k); }, { on: here, r: 14 });
    let yw = 0;   // the kicker stops short of 'You are here' beside it
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; yw = ctx.measureText('You are here').width + 20; }
    fitTitle(ctx, kick.toUpperCase(), x + 26, y + 22, W - 52 - yw, 21, 26, col, 700, 17);
    fitTitle(ctx, title, x + 26, y + 54, W - 52, 38, 44, VC.ink, 700, 30);
    textBlock(ctx, desc, x + 26, y + 100, W - 52, 24, 33, VC.muted, 400, 2);
    y += h + 18;
  }
  if (!xrCards()) vButton(ctx, P, 'story:close', x, y + 4, 220, 60, 'Back', () => { XR.stories = false; }, { px: 25 });
}
function drawMain(ctx, P) {
  const story = APP.mode === 'story';
  let x = P.w - 36;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 26, w, 54, label, fn, o); x -= 12; };
  // (Exit is on the shell's Shared panel, at hand on the left controller)
  if (AUD && AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.on(), px: 23 });
  if (!HOST.anchor.on) hb('recenter', 'Recenter', xrRecenterAsk, 140); // anchored: nothing moves
  // in a shared room no Stories button: each station keeps its story, and another story is another station (walk into
  // its circle)
  if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  else if (xrAllHere() && !XR.stories) hb('stories', 'Stories', () => HOST.room.allBack(), 130);   // (an All stories circle: back to its cards, for everyone there)
  if (!XR.stories) hb('mode', story ? 'To the scene' : 'Intro', () => (story ? APP.enterExplore() : APP.enterStory(0)), story ? 186 : 110, { primary: story });
  // the scene's name, smaller when the buttons leave it less room
  fitTitle(ctx, story || !STU.scene ? 'Your own scenes' : STU.scene, 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again in the menu.' : 'Trigger (or pinch): use buttons. Grip: ' + (XR.free ? 'move and turn' : 'move') + ' this panel. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
  } else drawExplorePane(ctx, P, 40, 120, P.w - 80);
}

// story: draw the current chapter straight from its HTML, with the same timing
const STY = {
  H1: { px: 84, lh: 90, w: 700, mb: 22 }, H2: { px: 62, lh: 70, w: 700, mb: 24 },
  p: { px: 35, lh: 50, mb: 20, c: 'ink' }, lede: { px: 39, lh: 52, mb: 24, c: 'muted' }, note: { px: 29, lh: 41, mb: 16, c: 'muted' },
  caption: { px: 25, lh: 34, mb: 12, c: 'muted' }, credits: { px: 24, lh: 34, mb: 12, c: 'muted' }, step: { px: 25, lh: 34, mb: 8, c: 'faint' },
};
function storyOpacity(el) {
  if (!XR.elInfo) { XR.elInfo = new Map(); ST.items.forEach(it => it.els.forEach(e => XR.elInfo.set(e.el, e))); }
  const e = XR.elInfo.get(el);
  return e ? Math.round(Math.max(0, e.o) * 3) / 3 : 1;
}
function drawStoryPane(ctx, P, x, y, W) {
  const it = ST.items.find(i => i.ch === curCh) || ST.items[0];
  for (const el of it.sec.children) y = drawStoryEl(ctx, P, el, x, y, W, 1);
  ctx.globalAlpha = 1;
}
function drawStoryEl(ctx, P, el, x, y, W, pa) {
  const a = pa * storyOpacity(el), tag = el.tagName.toUpperCase(), cl = el.classList;
  ctx.globalAlpha = a;
  let h = 0;
  if (tag === 'SVG') {
    // the title's route arc, drawn as it grows
    const k = 1.5, arc = el.querySelector('#titleArc'), dot = el.querySelector('#titleDot');
    const prog = arc ? clamp(1 - parseFloat(arc.getAttribute('stroke-dashoffset') || '1'), 0, 1) : 1;
    const dA = dot ? parseFloat(dot.getAttribute('opacity') || '0') : 1;
    const p0 = [x + 8 * k, y + 36 * k], c1 = [x + 180 * k, y - 16 * k], p1 = [x + 352 * k, y + 36 * k];
    const bz = (s, j) => (1 - s) * (1 - s) * p0[j] + 2 * (1 - s) * s * c1[j] + s * s * p1[j];
    ctx.strokeStyle = VC.amber; ctx.lineWidth = 3.3; ctx.lineCap = 'round';
    if (prog > 0.002) {
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
      for (let n = 1; n <= 48; n++) { const s = prog * n / 48; ctx.lineTo(bz(s, 0), bz(s, 1)); }
      ctx.stroke();
    }
    ctx.fillStyle = VC.amber;
    ctx.beginPath(); ctx.arc(p0[0], p0[1], 4.5 * k, 0, 7); ctx.fill();
    ctx.globalAlpha = a * Math.round(dA * 4) / 4;
    ctx.beginPath(); ctx.arc(p1[0], p1[1], 4.5 * k, 0, 7); ctx.fill();
    h = 44 * k + 8;
  } else if (tag === 'H1' || tag === 'H2') {
    const s = STY[tag];
    h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, VC.ink, s.w) + s.mb;
  } else if (tag === 'P') {
    const btn = el.querySelector('button');
    if (btn) {
      if (a > 0.3) vButton(ctx, P, 'goExplore', x, y, 380, 68, btn.textContent, () => APP.enterExplore(), { primary: true, px: 27 });
      h = 68 + 22;
    } else {
      const s = cl.contains('lede') ? STY.lede : cl.contains('note') ? STY.note : cl.contains('caption') ? STY.caption
        : cl.contains('credits') ? STY.credits : cl.contains('step') ? STY.step : STY.p;
      const col = ['amber', 'magenta', 'green', 'red', 'cyan'].find(c => cl.contains(c));
      h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, col ? VC[col] : VC[s.c], s.w) + s.mb;
    }
  } else if (cl.contains('big')) {
    const col = ['magenta', 'cyan', 'green', 'amber', 'red'].find(c => cl.contains(c));
    const small = el.querySelector('small'), all = el.textContent;
    const main = (small ? all.slice(0, all.length - small.textContent.length) : all).trim();
    ctx.font = vfont(96, 700); ctx.fillStyle = col ? VC[col] : VC.ink;
    ctx.fillText(main, x, y + 2);
    if (small) { const w = ctx.measureText(main).width; ctx.font = vfont(32); ctx.fillStyle = VC.muted; ctx.fillText(small.textContent, x + w + 16, y + 52); }
    h = 112;
  } else if (cl.contains('bars')) {
    const bars = [...el.children], n = bars.length, gap = 8, bw = (W - gap * (n - 1)) / n, top = y + 28, bh = 150;
    bars.forEach((b, k) => {
      const v = b.querySelector('.v'), f = b.querySelector('.fill'), kk = b.querySelector('.k');
      const hp = parseFloat(f.style.height) || 0, m = /scaleY\(([\d.]+)\)/.exec(f.style.transform || '');
      const s = m ? Math.round(parseFloat(m[1]) * 6) / 6 : 1, full = bh * hp / 100, bx = x + k * (bw + gap);
      ctx.fillStyle = cssColor(f.style.background || f.style.backgroundColor);
      if (s > 0) ctx.fillRect(bx, top + bh - full * s, bw, full * s);
      ctx.font = vfont(21); ctx.textAlign = 'center';
      ctx.fillStyle = VC.ink;
      if (v && v.textContent) ctx.fillText(v.textContent, bx + bw / 2, top + bh - full - 24);
      ctx.fillStyle = b.classList.contains('hl') ? VC.ink : VC.muted;
      if (kk) ctx.fillText(kk.textContent, bx + bw / 2, top + bh + 8);
      ctx.textAlign = 'left';
    });
    h = 28 + bh + 44;
  } else if (tag === 'UL' && cl.contains('legend')) {
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const sw = li.querySelector('.sw');
      swatch(ctx, x, yy + 10, 24, sw ? cssColor(sw.style.background) : VC.ink);
      ctx.font = vfont(30); ctx.fillStyle = VC.ink;
      ctx.fillText(li.textContent.trim(), x + 40, yy + 5);
      yy += 46;
    }
    h = yy - y + 12;
  } else if (cl.contains('facts')) {
    // a row of big numbers, each fading in on its own
    const cells = [...el.children], cw = W / cells.length;
    cells.forEach((c, k) => {
      ctx.globalAlpha = a * storyOpacity(c);
      const b = c.querySelector('b'), sm = c.querySelector('small');
      ctx.font = vfont(50, 700); ctx.fillStyle = VC.amber; ctx.fillText(fitText(ctx, b ? b.textContent : '', cw - 16), x + k * cw, y);
      if (sm) textBlock(ctx, sm.textContent, x + k * cw, y + 68, cw - 16, 25, 32, VC.muted, 400, 2);
    });
    h = 68 + 64 + 18;
  } else if (tag === 'UL' && cl.contains('steps')) {
    // points with a bold name over a line of text, each fading in on its own
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const b = li.querySelector('b'), bold = b ? b.textContent : '', rest = li.textContent.slice(bold.length).trim();
      const hh = 36 + textBlock(ctx, rest, x + 22, yy + 40, W - 22, 28, 38, VC.ink, 400, 3);
      ctx.fillStyle = VC.amber; ctx.fillRect(x, yy + 4, 5, hh);
      ctx.font = vfont(30, 700); ctx.fillStyle = VC.amber; ctx.fillText(bold, x + 22, yy);
      yy += hh + 16;
    }
    h = yy - y + 8;
  } else if (tag === 'UL' && cl.contains('concepts')) {
    let cx = x, cy = y;
    ctx.font = vfont(27);
    for (const li of el.children) {
      const t = li.textContent, w = ctx.measureText(t).width + 28;
      if (cx + w > x + W) { cx = x; cy += 54; }
      rr(ctx, cx, cy, w, 46, 6); ctx.fillStyle = VC.chip; ctx.fill();
      ctx.fillStyle = VC.ink; ctx.fillText(t, cx + 14, cy + 9);
      cx += w + 9;
    }
    h = cy - y + 46 + 26;
  } else if (tag === 'DIV') {
    // a grid of overlapping paragraphs (one fades out as the next fades in)
    let mh = 0;
    for (const c of el.children) mh = Math.max(mh, drawStoryEl(ctx, P, c, x, y, W, a) - y);
    h = mh;
  } else if (el.textContent.trim()) {
    h = textBlock(ctx, el.textContent, x, y, W, 26, 38, VC.ink) + 14;
  }
  ctx.globalAlpha = 1;
  return y + h;
}


// explore: the Scene, Add, Item and Items panes, drawn from the same blocks as the page's (paneBlocks), without the
// page's own (Download, Upload, the arrows, tick boxes); a pane taller than the panel scrolls with Up and More
function drawExplorePane(ctx, P, x, y, W) {
  let bx = x;
  for (const [k, n] of TABS) { vButton(ctx, P, 'tab:' + k, bx, y, 220, 56, n, () => pickTab(k), { on: X.tab === k, px: 24 }); bx += 232; }
  y += 76;
  const blocks = paneBlocks(X.tab).filter(b => !b.page);
  let bottom = P.h - 26, total = 0;
  for (const b of blocks) total += drawBlock(ctx, P, b, x, 0, W, 0, 1e9, true);
  const more = total > bottom - y;
  if (more) bottom -= 72;
  const max = Math.max(0, total - (bottom - y)), off = X.scroll[X.tab] = clamp(X.scroll[X.tab] || 0, 0, max);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 10, y - 4, W + 20, bottom - y + 8); ctx.clip();
  let yy = y - off;
  for (const b of blocks) yy += drawBlock(ctx, P, b, x, yy, W, y - 4, bottom + 4, false);
  ctx.restore();
  if (more) {
    const step = Math.round((bottom - y) * 0.8), go = d => { X.scroll[X.tab] = clamp(off + d, 0, max); };
    ctx.fillStyle = VC.line; ctx.fillRect(x, bottom + 8, W, 2);
    vButton(ctx, P, 'scroll:up', x + W - 380, bottom + 18, 180, 50, '▲ Up', off > 0 ? () => go(-step) : null, { px: 22, color: off > 0 ? VC.ink : VC.faint });
    vButton(ctx, P, 'scroll:down', x + W - 188, bottom + 18, 188, 50, '▼ More', off < max ? () => go(step) : null, { px: 22, color: off < max ? VC.ink : VC.faint });
    ctx.font = vfont(20); ctx.fillStyle = VC.faint; ctx.fillText(`${Math.round(100 * (off + bottom - y) / total)} % of this pane`, x, bottom + 32);
  }
}
const BC = { muted: 'muted', faint: 'faint', amber: 'amber', red: 'red', green: 'green' };
// one block of a pane at y (dry: only its height); its buttons pressable only where they show (between top and bottom)
function drawBlock(ctx, P, b, x, y, W, top, bottom, dry) {
  const inView = (yy, h) => !dry && yy >= top && yy + h <= bottom;
  const text = (t, px, lh, col, wt, max) => {
    ctx.font = vfont(px, wt);
    const L = wrapLines(ctx, t, W);
    const n = max ? Math.min(max, L.length) : L.length;
    if (!dry) { ctx.fillStyle = col; L.slice(0, n).forEach((l, k) => { if (y + k * lh + lh > top && y + k * lh < bottom) ctx.fillText(k === n - 1 && n < L.length ? l + '…' : l, x, y + k * lh); }); }
    return n * lh;
  };
  if (b.h !== undefined) {
    let h = 0;
    if (b.sub) { ctx.font = vfont(20, 700); if (!dry) { ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, b.sub.toUpperCase(), W), x, y); } h += 30; }
    ctx.font = vfont(44, 700);
    if (!dry) { ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, b.h, W), x, y + h); }
    return h + 62;
  }
  if (b.p !== undefined) return text(b.p, b.c === 'faint' ? 21 : 24, b.c === 'faint' ? 29 : 33, VC[BC[b.c]] || VC.ink, 400) + 12;
  if (b.code !== undefined) {
    ctx.font = '400 21px ui-monospace, Menlo, monospace';
    if (!dry) { rr(ctx, x, y, W, 44, 6); ctx.fillStyle = VC.chip; ctx.fill(); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, b.code, W - 24), x + 12, y + 11); }
    return 56;
  }
  if (b.kv) {
    let h = 0;
    for (const [k, v] of b.kv) {
      ctx.font = vfont(20);
      if (!dry && y + h > top && y + h < bottom) { ctx.fillStyle = VC.faint; ctx.fillText(k, x, y + h + 3); }
      ctx.font = vfont(22);
      const L = wrapLines(ctx, String(v), W - 190).slice(0, 4);
      if (!dry) { ctx.fillStyle = VC.ink; L.forEach((l, i) => { const yy = y + h + i * 30; if (yy > top && yy + 30 < bottom) ctx.fillText(l, x + 190, yy); }); }
      h += Math.max(1, L.length) * 30 + 6;
    }
    return h + 8;
  }
  let h = 0;
  if (b.label) { ctx.font = vfont(20, 700); if (!dry && y > top && y + 28 < bottom) { ctx.fillStyle = VC.muted; ctx.fillText(b.label, x, y); } h += 32; }
  if (b.row) {
    let cx = x, cy = y + h;
    const bh = 54;
    for (const t of b.row.filter(q => !q.page)) {
      ctx.font = vfont(22, t.on || t.primary ? 700 : 400);
      const w = Math.min(W, Math.max(110, Math.ceil(ctx.measureText(t.label).width) + 40));
      if (cx + w > x + W && cx > x) { cx = x; cy += bh + 10; }
      if (!dry) {
        const live = inView(cy, bh) && !t.dis;
        vButton(ctx, P, t.id, cx, cy, w, bh, t.label, live ? () => act(t.act, t.v) : null, { on: t.on, primary: t.primary && !t.dis, px: 22, color: t.dis ? VC.faint : t.col === 'red' ? VC.red : t.warn ? VC.amber : undefined });
      }
      cx += w + 10;
    }
    return h + (cy - (y + h)) + bh + 14;
  }
  if (b.list) {
    const rh = 58;
    for (const t of b.list) {
      const ry = y + h;
      if (!dry && ry + rh > top && ry < bottom) {
        const live = inView(ry, rh) && !t.dis;
        vButton(ctx, P, t.id, x, ry, W, rh - 6, '', live ? () => act(t.act, t.v) : null, { on: t.on, r: 8 });
        if (t.col) { ctx.fillStyle = t.col; ctx.fillRect(x + 4, ry + 8, 5, rh - 22); }
        ctx.font = vfont(23, t.on ? 700 : 400); ctx.fillStyle = t.dis ? VC.faint : VC.ink;
        const sub = t.sub || '';
        ctx.fillText(fitText(ctx, t.label + (t.warn ? '  ⚠' : ''), W * 0.6 - 24), x + 20, ry + 14);
        ctx.font = vfont(19); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(fitText(ctx, sub, W * 0.4 - 16), x + W - 14, ry + 17); ctx.textAlign = 'left';
      }
      h += rh;
    }
    return h + 10;
  }
  return 0;
}
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + footHint() + XR.clear;
}
// explore: what the hands do here (in a shared room the room's word on the grip; anchored, nothing moves)
const footHint = () => (!editOn() ? (STU.scene ? 'Walk about: trigger cubes show and hide things as you go.' + (XR.clear ? ' Left stick: walk. Right stick: turn.' : '') : 'Pick a scene on the panel.')
  : HOST.room && HOST.room.inRoom() && HOST.anchor.locked('globe') ? HOST.room.gripHint
  : 'Trigger: select (pointing at nothing: none). Grip: carry' + (XR.free ? ' and turn' : '') + '; both grips size an object; a cube\'s corner stretches it.' + (XR.clear ? ' Sticks: walk, turn.' : ''));
function drawFoot(ctx, P) {
  if (APP.mode === 'story') {
    const playing = APP.playing, bx = 28, by = 40;
    vButton(ctx, P, 'play', bx, by, 96, 96, '', () => APP.togglePlay(), { r: 48 });
    ctx.fillStyle = VC.ink;
    if (playing) { ctx.fillRect(bx + 34, by + 30, 10, 36); ctx.fillRect(bx + 52, by + 30, 10, 36); }
    else { ctx.beginPath(); ctx.moveTo(bx + 38, by + 26); ctx.lineTo(bx + 38, by + 70); ctx.lineTo(bx + 72, by + 48); ctx.closePath(); ctx.fill(); }
    const t = APP.t, ci = Math.max(0, CH.findIndex(c => t >= c.na && t < c.nb));
    const tri = (cx, cy, dir) => { ctx.beginPath(); ctx.moveTo(cx - 9 * dir, cy - 13); ctx.lineTo(cx - 9 * dir, cy + 13); ctx.lineTo(cx + 9 * dir, cy); ctx.closePath(); ctx.fill(); };
    vButton(ctx, P, 'prev', 140, 52, 78, 72, '', () => APP.seek(t > CH[ci].na + 2 || ci === 0 ? CH[ci].na : CH[ci - 1].na));
    ctx.fillStyle = VC.ink; tri(171, 88, -1); ctx.fillRect(184, 75, 5, 26);
    vButton(ctx, P, 'next', 228, 52, 78, 72, '', () => APP.seek(ci < CH.length - 1 ? CH[ci + 1].na : T_END - 0.01));
    ctx.fillStyle = VC.ink; tri(262, 88, 1); ctx.fillRect(271, 75, 5, 26);
    const x0 = 344, x1 = P.w - 40, ty = 100;
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(m(t) + ' / ' + m(T_END), x1, 44); ctx.textAlign = 'left';
    // this story's Slideshow switch, left of the clock (placed for the longest clock, so it never shifts)
    const sx = x1 - ctx.measureText(m(T_END) + ' / ' + m(T_END)).width - 220;
    if (HOST.slides) vButton(ctx, P, 'slides', sx, 26, 198, 42, 'Slideshow: ' + (slidesOn() ? 'on' : 'off'), slideToggle, { on: slidesOn(), px: 20 });
    // slideshow: waiting at the end of a chapter, Next in the place of the chapter's name (the panel above has it)
    if (SLIDE.at >= 0) vButton(ctx, P, 'slideNext', x0, 16, 180, 48, 'Next', slideNext, { primary: true, px: 28 });
    else { ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, CH[ci].name, (HOST.slides ? sx : x1 - 160) - 16 - x0), x0, 40); }
    rr(ctx, x0, ty, x1 - x0, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.28)'; ctx.fill();
    rr(ctx, x0, ty, (x1 - x0) * t / T_END, 6, 3); ctx.fillStyle = VC.cyan; ctx.fill();
    ctx.fillStyle = 'rgba(160,178,202,0.6)';
    for (const c of CH.slice(1)) ctx.fillRect(x0 + (x1 - x0) * c.na / T_END - 1, ty - 8, 2, 22);
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t / T_END, ty + 3, P.hover === 'track' ? 16 : 13, 0, 7); ctx.fillStyle = VC.cyan; ctx.fill();
    P.regions.push({ id: 'track', x: x0 - 10, y: 66, w: x1 - x0 + 20, h: 80, drag: px => APP.seek(clamp((px - x0) / (x1 - x0), 0, 1) * T_END) });
    return;
  }
  textBlock(ctx, footHint(), 28, 40, P.w - 56, 23, 32, VC.muted, 400, 3);
}


// ------------------------------------------------------------- narration --
// ------------------------------------------------------------- narration --
// The studio has no narration: AUD stays null, and the lines that would play it do nothing. The sound engine is
// the shell's (HOST.audio), unlocked by the first tap or click and kept across stories and headset sessions.
let AUD = null;
function audioInit() { /* nothing to narrate */ }
function audioSync() { if (AUD) AUD.sync(...slideSound()); }
function audioFollow() { if (AUD && !SLIDE.tail) APP.t = AUD.follow(APP.t); }
function audioLabel() { return AUD ? AUD.label() : ''; }
function audioToggle() { HOST.audio.toggle(); }

// ------------------------------------------------------------- slideshow --
// Slideshow (HOST.slides: on for this story, or for all): the story waits at the end of each chapter, all its text
// shown, until Next (or Play) goes on. The stop is a pause and a seek, Next a play, so in a shared room they reach
// the station's clock like a pause and a play by hand, at the same t on every device.
const SLIDE = { at: -1, go: -1, last: 0, lt: 0, lp: false, tail: null, from: 0 };
const slidesOn = () => !!(HOST.slides && HOST.slides.on(XR_HERE));
// where chapter i waits: just before its text starts to fade out (0.65 s before its end in story time), on the
// recording's clock; the same on every device
const slideStop = i => narrT(CH[i].b - 0.7);
// a chapter's last words can run on past that point (the airports' by up to 2.4 s): a story with a recording says
// where each chapter's voice ends in it (NARRATION_ENDS, seconds by chapter key), and the voice finishes there while
// the story waits (slideSound); a story without one pauses the narration with the clock
const slideVoice = i => (typeof NARRATION_ENDS === 'object' && +NARRATION_ENDS[CH[i].key]) || 0;
// every frame, once the clock has moved on from t0: crossing a stop while playing stops there, and a story paused just
// now, while playing up to 0.25 s before a stop (a room's pause lands that close), waits at it too (SLIDE.at, which
// shows Next); a clock put near a stop while paused (a scrub) stays where it was put, unless right on it. In a shared
// room the station's clock also moves a playing story on between frames (catching up): a step since the last frame
// no longer than the time that passed (and the room's 0.25 s drift) counts as playing on too; a jump does not
function slideStep(t0) {
  const was = SLIDE.at, now = performance.now(), st = HOST.collab && HOST.collab.live && HOST.collab.live();
  const from = st && st.story === XR_HERE && SLIDE.lp && APP.t >= SLIDE.last && APP.t - SLIDE.last < (now - SLIDE.lt) / 1000 + 0.35 ? SLIDE.last : t0;
  SLIDE.from = from;   // (the sound effects' cues cross by the same rule: sfxStep)
  SLIDE.at = -1;
  if (slidesOn() && APP.mode === 'story') {
    for (let i = 0; i < CH.length; i++) {
      const s = slideStop(i);
      if (APP.playing && i !== SLIDE.go && from < s && APP.t >= s) { slideTail(i, APP.t); APP.playing = false; APP.seek(s); }
      else if (!APP.playing && SLIDE.lp && APP.t >= s - 0.25 && APP.t < s) slideTail(i, APP.t);
      else if (APP.playing || Math.abs(APP.t - s) > 0.002) continue;
      APP.t = s; SLIDE.at = i; break;
    }
    // gone on from a stop: it stays passed while the clock is near it (the narration may pull the clock back a hair)
    if (was >= 0 && APP.playing) SLIDE.go = was;
    else if (SLIDE.go >= 0 && Math.abs(APP.t - slideStop(SLIDE.go)) > 1) SLIDE.go = -1;
  } else SLIDE.go = -1;
  // a voice finishing its chapter: done once the story is back where the voice ended, or elsewhere
  const T = SLIDE.tail;
  if (T && (APP.mode !== 'story' || HOST.picking || APP.t < T.s - 0.01 || APP.t >= T.v)) SLIDE.tail = null;
  SLIDE.last = APP.t; SLIDE.lt = now; SLIDE.lp = APP.mode === 'story' && APP.playing;
}
// at the stop of chapter i the voice plays on from where the sound is (the story's clock, t, can lag it) to where the
// chapter's words end; a sound already past them stops there, and keeps quiet until the story is back there
function slideTail(i, t) {
  const p = AUD && AUD.pos ? AUD.pos() : null, e = slideVoice(i);
  // (only a sound that is with the story: right after a jump it still says where it was before)
  const near = p !== null && Math.abs(p - t) < 1.5;
  if (near) t = p;
  SLIDE.tail = e > t || near ? { s: slideStop(i), v: Math.max(e, t), t, at: performance.now() } : null;
}
// what the narration plays (audioSync): the story's clock while it plays; while a voice finishes its chapter, its own
// clock up to the chapter's voice end, then nothing until the story, gone on from the stop, is back there. So nothing
// is cut or said twice, and the story does not follow the voice meanwhile (audioFollow)
function slideSound() {
  const T = SLIDE.tail, v = T ? T.t + (performance.now() - T.at) / 1000 : 0;
  return T ? [APP.mode === 'story' && v < T.v, Math.min(v, T.v)] : [APP.mode === 'story' && APP.playing, APP.t];
}
function slideNext() { if (SLIDE.at >= 0) APP.togglePlay(); }
function slideToggle() { if (HOST.slides) HOST.slides.set(XR_HERE, !slidesOn()); }
const slideSig = () => (HOST.slides ? HOST.slides.sig() : '') + SLIDE.at;
// the page: Next while the story waits (index.html's row at the foot of the panel, brought into sight as far as the
// chapter's top allows; on a phone, beside Play in the bar instead) and the switch
function slideDOM() {
  const row = $('#slides');
  if (!row || !HOST.slides) return;
  const on = slidesOn(), s = SLIDE.at + '' + on, nb = $('#btnNext'), bar = $('#btnNextBar');
  if (row.dataset.s === s) return;
  row.dataset.s = s; row.hidden = false;
  nb.hidden = SLIDE.at < 0;
  if (bar) bar.hidden = SLIDE.at < 0;
  const b = $('#btnSlides');
  b.textContent = 'Slideshow: ' + (on ? 'on' : 'off'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (SLIDE.at < 0 || !nb.offsetParent) return;
  const p = $('#panel'), r = p.getBoundingClientRect(), cs = getComputedStyle(p), sec = $('#story .ch.on');
  const over = Math.min(row.getBoundingClientRect().bottom - (r.bottom - parseFloat(cs.paddingBottom)), sec ? sec.getBoundingClientRect().top - r.top - parseFloat(cs.paddingTop) : 0);
  if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
}

// ---------------------------------------------------------- sound effects --
// Sounds inside the story (the shell's HOST.sfx, sfx.js; phase 2). Cues are set beside the keys in buildStory, in story
// time (sfxCue), and play as the clock crosses them while the story plays, by the slideshow's crossing rule
// (SLIDE.from): the same cues at the same moment on every device at a station, none on a jump, a scrub, a slideshow
// stop's seek or a late joiner's start. A span (sfxHold) keeps a continuous sound while the clock is inside it and
// playing. Explore and headset actions call sfxAct (explore mode only) or sfxPlay where the story already handles them.
// A sound comes from a place (a set's anchor, sfxPos): in a headset through an HRTF panner, on a screen panned by where
// it shows. An older shell (no HOST.sfx, or a sound it does not know) plays nothing. Never in collab.state(): each
// device plays its own. SFXQ.log keeps what was asked for (also when nothing can play: before a tap), for the tests
const SFXQ = { cues: [], spans: [], hi: -1, t: 0, n: 0, log: [], quiet: 0 };   // quiet: a room's state being applied (silent)
const sfxCue = (t, name, set, at, o) => { SFXQ.cues.push({ t, n: Math.max(0.05, narrT(t)), name, set, at, o: o || {} }); };
const sfxHold = (t0, t1, name, set, at, o) => { SFXQ.spans.push({ id: XR_HERE + '.' + SFXQ.spans.length, t0, t1, n0: narrT(t0), n1: narrT(t1), name, set, at, o: o || {} }); };
const sfxN = () => SFXQ.n + (HOST.sfx && HOST.sfx.count ? HOST.sfx.count() : 0);
const _sfv = new THREE.Vector3();
// where a sound comes from: [x, y, z] in the scene's (the reference space's) coordinates and, on a screen, a pan
function sfxWhere(set, at) {
  if (set === 'world') { if (!at) return {}; if (Array.isArray(at)) _sfv.fromArray(at); else _sfv.copy(at); }   // a point already in the scene's coordinates (a ray's hit)
  else if (!sfxPos(set, at, _sfv)) return {};
  const o = { at: [_sfv.x, _sfv.y, _sfv.z] };
  if (!(XR.on && GL.renderer.xr.isPresenting)) { _sfv.project(GL.camera); o.pan = clamp(_sfv.x, -1, 1) * 0.6 * (_sfv.z > 1 ? -1 : 1); }
  return o;
}
function sfxPlay(name, set, at, o) {
  SFXQ.n++;
  if (name !== 'hover') { SFXQ.log.push([name, Math.round(APP.t * 100) / 100, APP.mode]); if (SFXQ.log.length > 64) SFXQ.log.shift(); }
  if (!HOST.sfx || !HOST.sfx.play) return null;
  try { return HOST.sfx.play(name, Object.assign(sfxWhere(set, at), o)); } catch (e) { return null; }
}
// nothing of the story sounds while it is hidden: behind a Stories screen (page or headset), or a headset away from its station
const sfxHidden = () => !!(HOST.picking || XR.stories || xrAway());
// an explore action's sound (a pick, a result, a knockout): only in explore mode (a room's state applied while the story
// plays is silent)
const sfxAct = (name, set, at, o) => (APP.mode === 'explore' && !SFXQ.quiet && !sfxHidden() ? sfxPlay(name, set, at, o) : null);
// every frame, right after slideStep (`was`: the story was playing as the frame began): the cues crossed since the
// slideshow's `from` (at most 1.5 s back: the narration's clock can leap ahead as it starts after a jump, and its cues
// then play a moment late, not a burst of old ones; never twice: the narration or a room's clock may pull the clock back
// a hair, SFXQ.hi, forgotten once the clock is put back further), the spans the clock is in, and the live parts
// (sfxLive, where a story has them)
function sfxStep(was, dt) {
  const t = APP.t, from = SLIDE.from, quiet = APP.mode !== 'story' || sfxHidden();
  if (from < SFXQ.t - 0.5 || t < SFXQ.hi - 0.5) SFXQ.hi = -1;   // back to earlier: Replay, Repeat, a jump back
  if (was && !quiet && t > from) {
    const hi = SFXQ.hi;
    for (const c of SFXQ.cues) if (c.n > from && c.n <= t && c.n > hi && t - c.n < 1.5) { SFXQ.hi = Math.max(SFXQ.hi, c.n); sfxPlay(c.name, c.set, c.at, c.o); }
  }
  if (APP.playing && !quiet && HOST.sfx && HOST.sfx.drone) {
    for (const s of SFXQ.spans) if (t >= s.n0 && t < s.n1) { try { HOST.sfx.drone(s.id, s.name, Object.assign(sfxWhere(s.set, s.at), s.o)); } catch (e) { /* an older shell */ } }
  }
  if (typeof sfxLive === 'function' && !sfxHidden()) sfxLive(dt);
  SFXQ.t = t;
}
// a sound's place (sound effects): a set's anchor (a name, a function, or [x, y, z] in its frame) in the scene's
// coordinates; no set: GL.world's origin. Sets may hang under a life-size holder: each group's own world matrix
function sfxPos(set, at, out) {
  const s = set && GL.sets[set];
  if (!s) out.set(0, 0, 0).applyMatrix4(GL.world.matrixWorld);
  else { const p = anchorOf(set, at); out.set(p[0], p[1], p[2]).applyMatrix4(s.group.matrixWorld); }
  return isFinite(out.x + out.y + out.z);
}

// ================================================================== APP ==
const APP = {
  mode: 'story', t: 0, playing: true,
  seek(t) { this.t = clamp(t, 0, T_END - 0.01); if (this.mode !== 'story') this.enterStory(this.t); },
  togglePlay() { if (this.mode !== 'story') return; if (this.t >= T_END - 0.05) this.t = 0; this.playing = !this.playing; },
  enterExplore() {
    if (this.mode === 'explore') return;
    this.mode = 'explore';
    document.body.classList.add('exploring');
    $('#btnMode').textContent = 'Intro';
    Object.assign(XS, DEF, { stage_a: 1 });
    // from where the intro's camera is, to the scene's view
    orbit.cur = storyCam(storyT(this.t)); orbit.to = null;
    if (STU.items.size) frameScene(true);
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    renderPanes();
    updateExtraLabels();
    tcAttach();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'To the scene';
    this.t = t || 0; this.playing = true; curCh = null;
    tcAttach();
  },
};

let lastNow = 0;
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  let S, tSet;
  const t0 = APP.t;
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  sfxStep(was, dt);   // sound effects: the cues the clock crossed, the spans it is in, the live sounds
  // the end of the intro: the scene (not Repeat: the studio is not one of the stories)
  if (APP.mode === 'story' && APP.playing && APP.t >= T_END) { APP.t = T_END; APP.enterExplore(); }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    if (xr) xrPlace(storyCam(ts)); else applyCamera(storyCam(ts));
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (xr) xrPlace(orbit.cur); else if (X.view === 'walk') walkStep(dt); else applyCamera(orbit.cur);
  }
  K.U.uTime.value = (performance.now() / 1000) % 3600;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (XR.on && !XR.clear) S = Object.assign({}, S, { stage_floor: 0 });   // passthrough: the scene stands in your room
  updateSets(S, tSet, dt);
  GL.world.updateMatrixWorld(true);
  itemsStep(dt, performance.now());
  if (!STU.framed && APP.mode === 'explore' && !xr && STU.listing === 'ok' && [...STU.items.values()].every(it => it.kind !== 'o' || it.model || (it.E && it.E.state === 'failed'))) { STU.framed = true; if (STU.items.size && X.view === 'orbit') frameScene(true); }
  updateExtraLabels();
  paneStep(performance.now());
  if (xr) xrUpdate(S);
  GL.renderer.render(GL.scene, GL.camera);
  if (!xr) {
    GL.world.updateMatrixWorld(true);
    if (APP.mode === 'story') placeLabels(LBL.storyAll, L => (L.kind === 'story' ? fadeVal(ts, L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0) : setLabelAlpha(L, S)));
    else placeLabels(LBL.exploreAll(), L => (L.kind === 'set' ? setLabelAlpha(L, S) : L.txt ? L.show : 0));
  }
  window.__frames = (window.__frames || 0) + 1;
}
function applyTheme() {
  if (!GL.renderer) return;
  if (XR.on && !XR.clear) GL.renderer.setClearColor(0x000000, 0); // passthrough AR shows the room
  else GL.renderer.setClearColor(new THREE.Color(css('--scene') || '#040912'), 1);
}
// The story builds in steps, each a task of its own (LOAD): the scene, then each set (built, then its shaders compiled
// a slice at a time: warm), what joins the sets, the story, explore mode and the panels. Between the steps the page
// shows how far it is and a headset draws the shell's loading scene (HOST.progress); the next step runs from a timer,
// not an animation frame (the window's frames stop in a headset). A step that returns true runs again. The shared-room
// hooks see the scene only once all of it is built (collab.scene). A failure while the scene is built says that WebGL
// is missing, as before.
const LOAD = { steps: [], i: 0, t: 0, gone: false, done: false, warm: null, seen: new Set(), ms: [] };
function init() {
  const S = LOAD.steps, n = SET_ORDER.length;
  S.push(['Setting up the scene', () => buildScene($('#gl')), true]);
  SET_ORDER.forEach((k, i) => { const l = `Building the scenes: ${i + 1} of ${n}`; S.push([l, () => buildSet(k), true], [l, () => warm(GL.sets[k].group)]); });
  S.push(['Putting the scenes together', sceneJoin, true], ['Putting the scenes together', () => warm(GL.scene)],
    ['Writing the story', () => {
      resize();
      window.addEventListener('resize', resize);
      buildDefaults(); Object.assign(XS, DEF);
      for (const k of SET_ORDER) GL.sets[k].setAlpha(0);
      buildStory(); buildSetLabels(); buildTimeline();
    }],
    ['Setting up explore mode', () => { buildExplore(); tcSetup(); bindCanvas(); editLooks(); }],
    ['Making the headset panels', () => { audioInit(); xrSetup(); LOAD.done = true; initEnd(); }]);
  if (HOST.progress) HOST.progress(0, S.length, S[0][0]);
  loadStep();
}
// (short steps run on in one task, as each yield costs a frame; a step left half done, or 40 ms gone, yields)
function loadStep() {
  LOAD.t = 0;
  const t0 = performance.now();
  while (!LOAD.gone && LOAD.i < LOAD.steps.length) {
    const [label, fn, scene] = LOAD.steps[LOAD.i], t1 = performance.now();
    let more = false;
    try { more = fn() === true; } catch (err) {
      if (!scene) throw err;
      console.error(err);
      $('#nogl').style.display = 'grid';
      $('#loading').classList.add('gone');
      return;
    }
    LOAD.ms.push([label, Math.round(performance.now() - t1)]);
    if (!more) LOAD.i++;
    const n = LOAD.steps.length, next = LOAD.steps[LOAD.i];
    if (HOST.progress) HOST.progress(LOAD.i + (LOAD.warm ? LOAD.warm.i / LOAD.warm.list.length : 0), n, next ? next[0] : '');
    if (more || performance.now() - t0 > 40) break;
  }
  if (!LOAD.gone && LOAD.i < LOAD.steps.length) LOAD.t = setTimeout(loadStep, 0);
}
// shaders compiled now, so a set's first appearance does not stall the story: each material once (LOAD.seen), with
// the scene's lights as when it is drawn (renderer.compile on a stand-in scene that holds the lights and one object,
// not its children), until a slice has taken 50 ms; true while some are left
function warm(root) {
  const t0 = performance.now();
  if (!LOAD.warm) {
    const list = [];
    root.traverse(o => {
      const id = o.material && [].concat(o.material).map(m => m.uuid).join() + (o.isInstancedMesh ? 'i' : '') + (o.isSkinnedMesh ? 's' : '');
      if (id && !LOAD.seen.has(id)) { LOAD.seen.add(id); list.push(o); }
    });
    LOAD.warm = { list, i: 0, sc: new THREE.Scene() };
  }
  const W = LOAD.warm, lights = GL.scene.children.filter(o => o.isLight);
  try {
    while (W.i < W.list.length && performance.now() - t0 < 50) {
      const o = W.list[W.i++];
      W.sc.children = lights.concat({ traverse: f => f(o), traverseVisible() {} });
      GL.renderer.compile(W.sc, GL.camera);
    }
  } catch (e) { W.i = W.list.length; /* compiled on first use instead */ }
  W.sc.children = [];
  if (W.i < W.list.length) return true;
  LOAD.warm = null;
  return false;
}
// the rest of the start, the load's last step: the story's listeners, a link's place, the frame loop
function initEnd() {
  LBL.storyAll = ST.labels.concat(LBL.sets);
  LBL.exploreAll = () => LBL.sets.concat(LBL.extra);
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  (GL.mo = new MutationObserver(applyTheme)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  $('#btnMode').addEventListener('click', () => (APP.mode === 'story' ? APP.enterExplore() : APP.enterStory(0)));
  document.addEventListener('click', ev => { if (ev.target.id === 'btnGoExplore') APP.enterExplore(); });
  document.addEventListener('keydown', ev => {
    if (ev.target.closest('input, textarea')) return;
    if (ev.key === ' ' && APP.mode === 'story' && !ev.target.closest('button')) { APP.togglePlay(); ev.preventDefault(); }
  });
  APP.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the start screen pauses the story; picking this story again starts it from the top
  if (HOST.picking) APP.playing = false;
  window.addEventListener('storypause', () => { APP.playing = false; });
  window.addEventListener('storyrestart', () => { APP.enterStory(0); APP.playing = true; });
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.has('t')) { APP.t = clamp(parseFloat(hp.get('t')) || 0, 0, T_END - 0.01); APP.playing = false; }
  // straight into the scene (#studio&t=2: the intro at that second, paused); &tab=scene|add|item|items, &view=walk;
  // &scene=<name>, &edit, &visit, &scenes=<folder>, &maxtex= (OPT, e4_files.js)
  if (!hp.has('t')) APP.enterExplore();
  // editing: this device's own (studioEdit), &edit turns it on, &visit offers none at all
  STU.edit = !OPT.visit && (OPT.edit || store.get('studioEdit') === '1');
  if (TABS.some(t => t[0] === hp.get('tab'))) X.tab = hp.get('tab');
  if (hp.get('view') === 'walk') X.view = 'walk';
  renderPanes();
  // where the scenes come from (a relay with --scenes, else a folder), then the scene
  findSource();
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  LOAD.t = setTimeout(() => $('#loading').classList.add('gone'), 120);   // (dispose clears it: a story picked meanwhile keeps its loading screen)
}
// for tests and the browser console (HOST.cur.peek('STUDIO.state()')): where things stand, the items, what is shown for
// a pretend head, the last download
const STUDIO = {
  download: '',
  state: () => ({
    src: SRC.kind, srcState: SRC.state, base: SRC.base, folder: SRC.folder, save: SRC.save, scenes: SRC.scenes.map(s => s.name), scene: STU.scene, listing: STU.listing,
    files: STU.files.length, items: STU.items.size, edit: editOn(), sel: STU.sel, pick: STU.pick, unsaved: unsaved(), savedAt: STU.savedAt, savedBy: STU.savedBy, bad: STU.bad, note: STU.note, saveNote: STU.saveNote, undo: UNDO.length,
    models: Object.fromEntries([...LIB.values()].map(E => [E.path, { state: E.state, err: E.err, ms: E.ms, info: E.info, guess: E.guess, missing: [...E.missing], users: E.users.size }])),
    sounds: Object.fromEntries([...SND.values()].map(F => [F.path, { state: F.state, err: F.err, size: F.size }])),
  }),
  items: () => [...STU.items.values()].map(it => ({ id: it.id, kind: it.kind, rec: it.rec, shown: it.shown, a: it.a, sa: it.sa, act: !!it.act, inside: !!it.inside, built: !!it.model, src: !!it.src, visible: it.holder.visible })),
  // every object's model in (or failed) and every sound fetched: the scene is ready
  ready: () => STU.listing === 'ok' && [...STU.items.values()].every(it => (it.kind !== 'o' || it.model || (it.E && it.E.state === 'failed')) && (it.kind !== 's' || (it.F && it.F.state !== 'loading' && it.F.state !== 'idle'))),
  shownFor, find: name => { const it = [...STU.items.values()].find(x => x.rec.name === name); return it ? it.id : ''; },
};
LOAD.t = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  recenter: xrRecenterAsk,
  panels: () => (XR.main && XR.foot ? { main: XR.main, foot: XR.foot } : null),   // (for the shell's menu, its Story tab)
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the scene's name and its items, one field each (no
  // effects)
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    effect: studioEffect,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    GL.gone = true;
    LOAD.gone = true; clearTimeout(LOAD.t); clearTimeout(xrMsg.t);
    for (const t of TIMERS) clearTimeout(t);
    TIMERS.clear();
    watchStop();
    // the scene's sounds stop, and the listener goes back to the origin (where the shell's effects expect it)
    try { emitAll(); if (EM.ctx && EM.lis) listen(EM.ctx, new THREE.Vector3(), new THREE.Quaternion()); } catch (e) { /* closed */ }
    if (GL.tc) { try { GL.tc.detach(); GL.tc.dispose(); } catch (e) { /* gone */ } }
    for (const it of STU.items.values()) if (it.kind === 'o') dropModel(it);
    for (const E of LIB.values()) if (E.root) disposeTree(E.root, true);
    LIB.clear(); SND.clear();
    if (GL.env) GL.env.dispose();
    BOX1.dispose(); HIDDEN.dispose(); LOOKS.dispose();
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});

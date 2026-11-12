// Balloon tips by the clock (pale yellow, a tail, an info icon, a close button) and Clippy's speech balloons (the
// assistant's yellow, his questions and their options), each growing out of its tail (clip Pop). Short phrases only.
(function () {
  const I = XP.icons;
  // a balloon tip: title in bold, its words, the info icon, a close button; tail: where on its foot, and its tip
  const tip = (name, file, title, words, o = {}) => XP.part(name, { file, build() {
    const w = o.w || 0.46, h = o.h || 0.16;
    return XP.balloon({ name, w, h, W: 640, r: 0.018, colour: '#ffffe1', tail: o.tail || [w * 0.3, 0.05, w * 0.36, -h / 2 - 0.07], draw(F, b) {
      const { g } = F, s = Math.round(b.h * 0.2), raised = [];
      (o.icon || I.info)(g, b.x, b.y + 2, s * 1.3);
      XP.text(g, title, b.x + s * 1.75, b.y + s * 1.05, { size: Math.round(s * 0.95), weight: 'bold', color: '#000', max: b.w - s * 3.5 });
      XP.para(g, words, b.x + s * 1.75, b.y + s * 2.35, b.w - s * 2.1, { size: Math.round(s * 0.85), color: '#000', lh: s * 1.1 });
      const cs = s * 1.05, cx = b.x + b.w - cs, cy = b.y;
      g.fillStyle = XP.grad(g, 0, cy, 0, cy + cs, [[0, '#fbfbf6'], [1, '#d8d6cc']]); XP.rr(g, cx, cy, cs, cs, 3); g.fill(); g.strokeStyle = '#999'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#555'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + cs * 0.3, cy + cs * 0.3); g.lineTo(cx + cs * 0.7, cy + cs * 0.7); g.moveTo(cx + cs * 0.7, cy + cs * 0.3); g.lineTo(cx + cs * 0.3, cy + cs * 0.7); g.stroke();
      raised.push([cx, cy, cx + cs, cy + cs, 0.004]);
      return raised;
    } });
  } });
  tip('balloon-grass', 'models/balloon-grass.glb', 'Found New Hardware', 'Grass (real, touch-sensitive)');
  tip('balloon-cursor', 'models/balloon-cursor.glb', 'Cursor is now connected', 'Speed: 54.0 Mbps\nSignal Strength: Excellent', { h: 0.18 });
  tip('balloon-sonoma', 'models/balloon-sonoma.glb', 'Bliss', 'Sonoma County, California. Photographed in January 1996.', { w: 0.5, h: 0.18, tail: [-0.12, 0.05, -0.17, -0.16] });
  tip('balloon-go', 'models/balloon-go.glb', 'Go.', 'Click the door to go outside.', { w: 0.42, h: 0.15, tail: [0.13, 0.05, 0.2, -0.15], icon: (g, x, y, s) => { g.fillStyle = '#e8432a'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? s * 0.22 : s * 0.5; g.lineTo(x + s / 2 + Math.cos(a) * r, y + s / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); } });

  // Clippy's balloons: the assistant's yellow, his question and its options (blue round bullets, raised)
  const speech = (name, file, lines, options) => XP.part(name, { file, build() {
    const w = 0.5, h = 0.13 + options.length * 0.045 + lines.length * 0.035;
    return XP.balloon({ name, w, h, W: 640, r: 0.03, colour: '#ffffcc', tail: [-w * 0.28, 0.06, -w * 0.38, -h / 2 - 0.1], draw(F, b) {
      const { g } = F, s = Math.round(b.w * 0.052), raised = [];
      let y = b.y + s * 1.2;
      for (const l of lines) y = XP.para(g, l, b.x + 6, y, b.w - 12, { size: s, color: '#000', lh: s * 1.25 }) + s * 0.15;
      y += s * 0.4;
      for (const o of options) {
        const r = s * 0.42, cx = b.x + 10 + r, cy = y - s * 0.32;
        g.fillStyle = XP.grad(g, 0, cy - r, 0, cy + r, [[0, '#8fb8ff'], [1, '#1d4fcf']]); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
        XP.text(g, o, cx + r * 2, y, { size: Math.round(s * 0.92), color: '#000', max: b.w - r * 4 - 14 });
        raised.push([cx - r, cy - r, cx + r, cy + r, 0.005]);
        y += s * 1.45;
      }
      return raised;
    } });
  } });
  speech('clippy-balloon-outside', 'models/clippy-balloon-outside.glb', ["It looks like you're trying to go outside.", 'Would you like help?'], ['Get help going outside', 'Just stay inside without help', "Don't show me this tip again"]);
  speech('clippy-balloon-happy', 'models/clippy-balloon-happy.glb', ["It looks like you're trying to be happy.", 'Would you like'], ['Open the door for me', 'Remind me later']);
})();

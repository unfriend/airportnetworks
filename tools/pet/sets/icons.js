// Organ icons for the PET story (STUB: a circle with the organ's initials; the real line icons replace it, same API).
// PET_ICONS.ids, PET_ICONS.draw(ctx, id, cx, cy, size, opts), PET_ICONS.atlas(THREE, px) -> { texture, canvas, uv(id) }
const PET_ICONS = (function () {
  const ids = PET_DATA.organs.map(o => o.id), short = Object.fromEntries(PET_DATA.organs.map(o => [o.id, o.short]));
  function draw(ctx, id, cx, cy, size, opts) {
    const o = opts || {}, r = size * 0.42;
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = o.color || '#ffffff';
    ctx.lineWidth = o.width || Math.max(1, size * 0.05);
    if (o.glow) { ctx.shadowColor = o.color || '#ffffff'; ctx.shadowBlur = size * 0.12; }
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `600 ${Math.round(size * 0.26)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((short[id] || id).slice(0, 2), cx, cy);
    ctx.restore();
  }
  let cache = null;
  function atlas(THREE, px) {
    if (cache) return cache;
    const s = px || 128, cv = document.createElement('canvas');
    cv.width = cv.height = s * 4;
    const ctx = cv.getContext('2d');
    ids.forEach((id, i) => draw(ctx, id, (i % 4 + 0.5) * s, (Math.floor(i / 4) + 0.5) * s, s * 0.9));
    const texture = new THREE.CanvasTexture(cv);
    texture.anisotropy = 4;
    const uv = id => { const i = ids.indexOf(id), x = i % 4, y = Math.floor(i / 4); return [x / 4, 1 - (y + 1) / 4, (x + 1) / 4, 1 - y / 4]; };
    return (cache = { texture, canvas: cv, uv });
  }
  return { ids, draw, atlas };
})();

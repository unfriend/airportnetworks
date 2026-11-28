// A bench probe (tools/bench/SPEC.md 10): what the story on show draws, counted by set (a built story's GL.sets; the
// hand-written stories and the studio by their scene's top-level groups): objects, visible meshes, instances, lines and
// line vertices, points and point counts, sprites, distinct materials and geometries; then the renderer's own counts.
// Read-only: it walks the scene and changes nothing. args: { hidden: true } also counts what is not visible.
HOST.bench.probe('scene', async (api, args) => {
  const all = !!(args && args.hidden);
  const GL = api.peek("typeof GL !== 'undefined' ? GL : null");
  const scene = (GL && GL.scene) || api.peek("typeof HOST !== 'undefined' && HOST.cur && HOST.cur.collab && HOST.cur.collab.scene ? HOST.cur.collab.scene() : null");
  if (!scene) return { story: api.story(), why: 'no scene to count' };
  const count = (root) => {
    const c = { objects: 0, meshes: 0, instances: 0, lines: 0, lineVerts: 0, points: 0, pointCount: 0, sprites: 0, mats: new Set(), geos: new Set() };
    const each = o => {
      c.objects++;
      const g = o.geometry, n = g ? Math.min(g.drawRange && isFinite(g.drawRange.count) ? g.drawRange.count : Infinity, g.index ? g.index.count : g.attributes && g.attributes.position ? g.attributes.position.count : 0) : 0;
      const inst = g && g.isInstancedBufferGeometry && isFinite(g.instanceCount) ? g.instanceCount : 1;
      if (o.isMesh) { c.meshes++; if (o.isInstancedMesh) c.instances += o.count; }
      else if (o.isLine) { c.lines++; c.lineVerts += n * inst; }
      else if (o.isPoints) { c.points++; c.pointCount += n * inst; }
      else if (o.isSprite) c.sprites++;
      if (o.material) for (const m of [].concat(o.material)) c.mats.add(m.uuid);
      if (g) c.geos.add(g.uuid);
    };
    if (all) root.traverse(each); else root.traverseVisible(each);
    return { objects: c.objects, meshes: c.meshes, instances: c.instances, lines: c.lines, lineVerts: c.lineVerts, points: c.points, pointCount: c.pointCount, sprites: c.sprites, materials: c.mats.size, geometries: c.geos.size };
  };
  const sets = {};
  if (GL && GL.sets) for (const k of Object.keys(GL.sets)) { const s = GL.sets[k]; if (s && s.group) sets[k] = count(s.group); }
  else for (const [i, o] of scene.children.entries()) if (o.children.length) sets[(o.name || o.type) + '#' + i] = count(o);
  const R = api.renderer();
  return { story: api.story(), mode: api.app().mode, xr: api.session(), visibleOnly: !all, total: count(scene), sets, renderer: R ? R.info : null };
});

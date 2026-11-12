// The big titles: "bliss" and "welcome back.", white italic letters extruded in 3D with a deep blue shadow behind them
(function () {
  XP.part('title-bliss', { file: 'models/title-bliss.glb', build() {
    const t = XP.title3d('bliss', { height: 0.34, depth: 0.05, tol: 1.8, name: 'bliss' });
    return { root: XP.group('title', t.mesh) };
  } });
  XP.part('title-welcome', { file: 'models/title-welcome.glb', build() {
    const t = XP.title3d('welcome back.', { height: 0.12, depth: 0.026, tol: 2.2, name: 'welcome' });
    return { root: XP.group('title', t.mesh) };
  } });
})();

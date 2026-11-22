//#use head GL
// the sets, in the order they appear in the story (each sets/<name>.js defines SETS.<name>; list the files in build.mjs)
// (the cell first: the others read its shapes and its background, and explore mode opens on it)
const SET_ORDER = ['cell', 'ball', 'crowd', 'walls', 'lens', 'sites', 'next'];
// sets drawn in the cell's frame (they turn with it): all but GRB2's close-up and the shuttle
const FRAME = { ball: 'cell', crowd: 'cell', walls: 'cell', lens: 'cell', next: 'cell' };
// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
//#use frameOf buildScene buildSet sceneJoin updateSets~2 _vd viewDir narrowK lowK applyCamera _yA keepCamera resize
//#use LV updateLight

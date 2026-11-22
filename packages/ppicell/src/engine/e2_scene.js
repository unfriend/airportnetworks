//#use head GL
// the sets, in the order they appear in the story (each sets/<name>.js defines SETS.<name>; list the files in build.mjs)
const SET_ORDER = ['cell'];
// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
//#use FRAME frameOf buildScene buildSet sceneJoin updateSets~2 _vd viewDir narrowK lowK applyCamera _yA keepCamera resize
//#use LV updateLight

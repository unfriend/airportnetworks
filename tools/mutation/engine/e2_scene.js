//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['letters', 'tree', 'rule', 'stem'];
// sets drawn in another set's frame: the stems stand on the species tree's tips and their fields in front of its root,
// so the two always turn together
const FRAME = { stem: 'tree' };
//#use frameOf buildScene buildSet sceneJoin updateSets~2 _vd viewDir narrowK lowK applyCamera~2 _yA keepCamera resize
//#use LV updateLight
//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['tower', 'motor', 'hpc'];
//#use buildScene~2 buildSet sceneJoin BUILD buildMs buildTurn PRIME primeCheck primeStep updateSets~3 _vd viewDir~2
//#use applyCamera~3
// sets on show may keep the camera out of their solid parts (the supercomputer's racks): keepOut takes the camera's
// position in the set's own frame (t: story time, for the set's turn; null in explore mode) and returns it, moved if
// need be; still(p) says explore mode should stop swaying the view (GL.still, read next frame)
const _yA = new THREE.Vector3(0, 1, 0), _kp = new THREE.Vector3();
//#use keepCamera resize~2 LV updateLight
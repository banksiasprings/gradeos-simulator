// src/sim/render/dozer-model.js
//
// SIM-SHELL VISUALISATION ASSET.
//
// Clean, stylised 3D dozer model — bodywork as simple primitives, no
// photo textures. Used to render the static sprite images shown in
// the cab screen panes (side / top / blade views).
//
// Reference: Trimble Earthworks display screenshots — yellow body and
// cab, dark tracks and blade, ROPS frame above the cab.
//
// Convention:
//   +Z = forward (matches sim's machinePos.hdg = 0 → forward = +Z)
//   +X = right
//   +Y = up
//
// The dozer is built around the origin: tracks rest at y=0, blade at +Z.

'use strict';

/**
 * Build a clean dozer mesh group at the origin, facing +Z.
 *
 * @param {Object} [opts]
 * @param {number} [opts.bodyColor=0xefb800]  Body / cab paint colour (Cat-yellow default).
 * @param {number} [opts.trackColor=0x303030] Tracks colour.
 * @param {number} [opts.bladeColor=0x404040] Blade colour.
 * @param {number} [opts.windowColor=0x6090c0] Cab window colour.
 * @param {number} [opts.ropsColor=0x303030]  ROPS frame colour.
 * @returns {THREE.Group}
 */
function buildCleanDozer(opts){
  if(typeof THREE === 'undefined'){
    throw new Error('THREE not loaded — buildCleanDozer requires three.js.');
  }
  const o = opts || {};
  const bodyColor   = o.bodyColor   != null ? o.bodyColor   : 0xefb800;
  const trackColor  = o.trackColor  != null ? o.trackColor  : 0x303030;
  const bladeColor  = o.bladeColor  != null ? o.bladeColor  : 0x404040;
  const windowColor = o.windowColor != null ? o.windowColor : 0x6090c0;
  const ropsColor   = o.ropsColor   != null ? o.ropsColor   : 0x303030;

  const yellowMat = new THREE.MeshLambertMaterial({color: bodyColor});
  const trackMat  = new THREE.MeshLambertMaterial({color: trackColor});
  const bladeMat  = new THREE.MeshLambertMaterial({color: bladeColor});
  const winMat    = new THREE.MeshLambertMaterial({color: windowColor});
  const ropsMat   = new THREE.MeshLambertMaterial({color: ropsColor});

  const grp = new THREE.Group();
  grp.name = 'CleanDozer';

  // ── Tracks ─────────────────────────────────────────────────────────────
  // Two long boxes either side of the body. Length along Z, width along X.
  const trackGeo = new THREE.BoxGeometry(0.9, 0.7, 4.3);
  const trackL = new THREE.Mesh(trackGeo, trackMat);
  trackL.position.set(-1.4, 0.35, 0);
  grp.add(trackL);
  const trackR = new THREE.Mesh(trackGeo, trackMat);
  trackR.position.set( 1.4, 0.35, 0);
  grp.add(trackR);

  // Track plate detailing — a slightly raised cap on top of each track.
  const trackTopGeo = new THREE.BoxGeometry(0.95, 0.08, 4.3);
  const trackTopL = new THREE.Mesh(trackTopGeo, new THREE.MeshLambertMaterial({color: 0x202020}));
  trackTopL.position.set(-1.4, 0.74, 0);
  grp.add(trackTopL);
  const trackTopR = new THREE.Mesh(trackTopGeo, new THREE.MeshLambertMaterial({color: 0x202020}));
  trackTopR.position.set( 1.4, 0.74, 0);
  grp.add(trackTopR);

  // ── Lower body ─────────────────────────────────────────────────────────
  const bodyGeo = new THREE.BoxGeometry(2.4, 0.9, 3.3);
  const body = new THREE.Mesh(bodyGeo, yellowMat);
  body.position.set(0, 1.15, 0);
  grp.add(body);

  // ── Engine compartment (rear, at -Z, taller bonnet) ────────────────────
  const engineGeo = new THREE.BoxGeometry(2.0, 0.9, 1.4);
  const engine = new THREE.Mesh(engineGeo, yellowMat);
  engine.position.set(0, 2.05, -0.95);
  grp.add(engine);

  // Exhaust stack (small cylinder rising from engine bonnet)
  const stackGeo = new THREE.CylinderGeometry(0.10, 0.13, 1.0, 12);
  const stack = new THREE.Mesh(stackGeo, new THREE.MeshLambertMaterial({color: 0x202020}));
  stack.position.set(-0.55, 3.0, -0.6);
  grp.add(stack);

  // ── Cab (front, with windows) ──────────────────────────────────────────
  const cabGeo = new THREE.BoxGeometry(1.7, 1.4, 1.6);
  const cab = new THREE.Mesh(cabGeo, yellowMat);
  cab.position.set(0, 2.30, 0.65);
  grp.add(cab);

  // Front windscreen
  const winFrontGeo = new THREE.BoxGeometry(1.5, 0.95, 0.06);
  const winFront = new THREE.Mesh(winFrontGeo, winMat);
  winFront.position.set(0, 2.45, 1.46);
  grp.add(winFront);
  // Side windows
  const winSideGeo = new THREE.BoxGeometry(0.06, 0.85, 1.4);
  const winSideL = new THREE.Mesh(winSideGeo, winMat);
  winSideL.position.set(-0.86, 2.40, 0.65);
  grp.add(winSideL);
  const winSideR = new THREE.Mesh(winSideGeo, winMat);
  winSideR.position.set( 0.86, 2.40, 0.65);
  grp.add(winSideR);

  // ── ROPS frame around cab roof ─────────────────────────────────────────
  // Four uprights + roof rails
  const ropsRadius = 0.05;
  const ropsHeight = 1.4; // rises above cab
  const ropsRoof = 1.6; // length along Z
  const upGeo = new THREE.CylinderGeometry(ropsRadius, ropsRadius, ropsHeight, 8);
  const ropsCorners = [
    {x:-0.85, z: 1.45},
    {x: 0.85, z: 1.45},
    {x:-0.85, z:-0.15},
    {x: 0.85, z:-0.15},
  ];
  ropsCorners.forEach(c=>{
    const m = new THREE.Mesh(upGeo, ropsMat);
    m.position.set(c.x, 3.05, c.z);
    grp.add(m);
  });
  // Roof rails along X (front and rear)
  const rrXGeo = new THREE.CylinderGeometry(ropsRadius, ropsRadius, 1.7, 8);
  const rrFront = new THREE.Mesh(rrXGeo, ropsMat);
  rrFront.rotation.z = Math.PI/2;
  rrFront.position.set(0, 3.75, 1.45);
  grp.add(rrFront);
  const rrRear = new THREE.Mesh(rrXGeo, ropsMat);
  rrRear.rotation.z = Math.PI/2;
  rrRear.position.set(0, 3.75, -0.15);
  grp.add(rrRear);
  // Roof rails along Z (sides)
  const rrZGeo = new THREE.CylinderGeometry(ropsRadius, ropsRadius, 1.6, 8);
  const rrSideL = new THREE.Mesh(rrZGeo, ropsMat);
  rrSideL.rotation.x = Math.PI/2;
  rrSideL.position.set(-0.85, 3.75, 0.65);
  grp.add(rrSideL);
  const rrSideR = new THREE.Mesh(rrZGeo, ropsMat);
  rrSideR.rotation.x = Math.PI/2;
  rrSideR.position.set( 0.85, 3.75, 0.65);
  grp.add(rrSideR);

  // ── Blade (front) ──────────────────────────────────────────────────────
  // Wide vertical plate at +Z with a slight forward tilt.
  const bladeGeo = new THREE.BoxGeometry(3.4, 1.5, 0.35);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0, 1.0, 2.45);
  blade.rotation.x = -0.10; // slight forward tilt for that earthmover lean
  grp.add(blade);
  // Cutting edge (lower lip, lighter colour to suggest a wear edge)
  const edgeGeo = new THREE.BoxGeometry(3.42, 0.18, 0.18);
  const edge = new THREE.Mesh(edgeGeo, new THREE.MeshLambertMaterial({color: 0x808080}));
  edge.position.set(0, 0.32, 2.55);
  grp.add(edge);

  // ── Push arms (two cylinders connecting blade to body sides) ───────────
  const armGeo = new THREE.CylinderGeometry(0.10, 0.10, 2.4, 10);
  const armL = new THREE.Mesh(armGeo, bladeMat);
  armL.rotation.x = Math.PI/2;     // lay along Z
  armL.position.set(-1.2, 1.0, 1.3);
  grp.add(armL);
  const armR = new THREE.Mesh(armGeo, bladeMat);
  armR.rotation.x = Math.PI/2;
  armR.position.set( 1.2, 1.0, 1.3);
  grp.add(armR);

  // ── Tilt cylinder (small piston between body and blade top) ────────────
  const tiltGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.5, 10);
  const tilt = new THREE.Mesh(tiltGeo, bladeMat);
  tilt.rotation.x = Math.PI/2;
  tilt.position.set(0, 1.85, 1.7);
  grp.add(tilt);

  return grp;
}

if(typeof window !== 'undefined'){
  window.buildCleanDozer = buildCleanDozer;
}

export { buildCleanDozer };

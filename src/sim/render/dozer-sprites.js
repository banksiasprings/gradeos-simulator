// src/sim/render/dozer-sprites.js
//
// SIM-SHELL VISUALISATION ASSET.
//
// Render the clean dozer model from fixed angles to data URLs that the
// cab screen panes use as static background images. Path B from the
// Slice 11 grilling — overlay 2D markers (cut/fill, blade-vs-design)
// in a follow-up slice. This module just produces clean, transparent-
// background PNGs.
//
// Renders done once (or on demand) and cached. Each sprite is a small
// PNG (~600×450 px); per-frame cost is just `ctx.drawImage`.
//
// See:
//   src/sim/render/dozer-model.js — the geometry being rendered.

'use strict';

/**
 * Render the clean dozer at a given view angle.
 *
 * @param {string} view  'side' | 'top' | 'blade' | 'perspective'
 * @param {number} [w=600]
 * @param {number} [h=450]
 * @param {Object} [opts]  Forwarded to buildCleanDozer for colour overrides.
 * @returns {string}  data URL of a transparent-background PNG.
 */
function renderDozerSprite(view, w, h, opts){
  if(typeof THREE === 'undefined' || typeof window.buildCleanDozer !== 'function'){
    console.warn('renderDozerSprite: THREE or buildCleanDozer not ready');
    return '';
  }
  w = w || 600; h = h || 450;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true});
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  // Lighting — soft ambient + a key light
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(5, 8, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-3, 5, -2);
  scene.add(fill);

  const dozer = window.buildCleanDozer(opts);
  scene.add(dozer);

  // Cameras per view. Frame the dozer so it fills most of the canvas
  // with a small margin. Convention: dozer faces +Z, blade at +Z end.
  let camera;
  if(view === 'side'){
    // Camera on the dozer's right side (+X), looking -X. We see the full
    // length of the dozer with the blade on the right of the panel
    // (since +Z is screen-right when looking from +X).
    const aspect = w / h;
    const halfH = 2.6; // fits dozer height + a bit
    camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
    camera.position.set(15, 1.7, 0);
    camera.lookAt(0, 1.7, 0);
  } else if(view === 'top'){
    // Bird's-eye, machine forward = up (+Z up on screen).
    const aspect = w / h;
    const halfH = 2.7;
    camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
    camera.position.set(0, 20, 0);
    // up-vector along -Z so that +Z (forward) appears as up in image.
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
  } else if(view === 'blade'){
    // Front view — looking from +Z (in front of blade) towards -Z. We
    // see the blade face-on, then the cab + ROPS rising behind.
    const aspect = w / h;
    const halfH = 2.4;
    camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
    camera.position.set(0, 1.7, 15);
    camera.lookAt(0, 1.7, 0);
  } else {
    // Perspective 3/4 angle for the catch-all 'perspective' view.
    const aspect = w / h;
    camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
    camera.position.set(8, 5, 8);
    camera.lookAt(0, 1.5, 0);
  }

  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');

  // Clean up GPU resources and the temp canvas.
  renderer.dispose();
  scene.traverse(obj => {
    if(obj.geometry) obj.geometry.dispose();
    if(obj.material){
      if(Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });

  return url;
}

/**
 * Generate the 4 standard cab-screen sprites as Image objects, ready for
 * `ctx.drawImage(...)` per frame. Cached on the first call; subsequent
 * calls return the same cached objects.
 *
 * @returns {{side: HTMLImageElement, top: HTMLImageElement, blade: HTMLImageElement, perspective: HTMLImageElement}}
 */
let _dozerSpriteCache = null;
function getDozerSprites(){
  if(_dozerSpriteCache) return _dozerSpriteCache;
  const cache = {};
  ['side','top','blade','perspective'].forEach(view => {
    const url = renderDozerSprite(view);
    if(!url) return;
    const img = new Image();
    img.src = url;
    cache[view] = img;
  });
  _dozerSpriteCache = cache;
  return cache;
}

function clearDozerSpriteCache(){ _dozerSpriteCache = null; }

if(typeof window !== 'undefined'){
  window.renderDozerSprite = renderDozerSprite;
  window.getDozerSprites = getDozerSprites;
  window.clearDozerSpriteCache = clearDozerSpriteCache;
}

export { renderDozerSprite, getDozerSprites, clearDozerSpriteCache };

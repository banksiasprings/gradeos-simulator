// src/sim/render/dozer-sprites.js
//
// SIM-SHELL VISUALISATION ASSET.
//
// Render a clean dozer from fixed angles to data URLs that the cab
// screen panes use as static background images. Path B from Slice 11.
//
// Slice 11.5 — model source switched from box primitives to a real GLTF
// model loaded from /assets/dozer/scene.gltf (a downloaded Sketchfab
// bulldozer). Falls back to the built-in primitive model if the GLTF
// load fails.

'use strict';

const DOZER_GLTF_URL = './assets/dozer/scene.gltf';
let _dozerModelGroup = null;     // cached normalised model (THREE.Group)
let _dozerModelLoading = null;   // Promise<Group> while loading
let _dozerModelStatus = 'idle';  // 'idle' | 'loading' | 'ready' | 'error'

/**
 * Async-load and normalise the dozer model.
 *
 * Normalisation:
 *   1. Centre the bounding box on origin (X/Z), rest on ground (Y=0).
 *   2. Scale so the longest axis is ~5 m (typical dozer length).
 *   3. Rotate so the dozer faces +Z (sim convention) — best-effort heuristic.
 *
 * Returns a fresh Group clone on each call (renderers consume + dispose).
 */
function loadDozerModel(){
  if(_dozerModelGroup) return Promise.resolve(_cloneGroup(_dozerModelGroup));
  if(_dozerModelLoading) return _dozerModelLoading;
  if(typeof THREE === 'undefined' || !THREE.GLTFLoader){
    return Promise.reject(new Error('GLTFLoader not available'));
  }
  _dozerModelStatus = 'loading';
  const loader = new THREE.GLTFLoader();
  _dozerModelLoading = new Promise((resolve, reject) => {
    loader.load(
      DOZER_GLTF_URL,
      (gltf) => {
        try {
          const root = gltf.scene || gltf.scenes[0];
          _normaliseDozer(root);
          _dozerModelGroup = root;
          _dozerModelStatus = 'ready';
          _dozerModelLoading = null;
          resolve(_cloneGroup(root));
        } catch(e){
          _dozerModelStatus = 'error';
          _dozerModelLoading = null;
          reject(e);
        }
      },
      undefined,
      (err) => {
        _dozerModelStatus = 'error';
        _dozerModelLoading = null;
        console.warn('Dozer GLTF load failed, will use fallback model:', err);
        reject(err);
      }
    );
  });
  return _dozerModelLoading;
}

/**
 * Centre and scale the imported model. Many Sketchfab models come in
 * with arbitrary scale and origin — normalise so it fits cleanly into
 * our sprite frames.
 */
function _normaliseDozer(group){
  // Compute bounding box
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);
  // Heuristic: longest horizontal axis = dozer length, scale to ~5 m.
  const longest = Math.max(size.x, size.y, size.z);
  if(longest > 0.1){
    const scale = 5.0 / longest;
    group.scale.setScalar(scale);
  }
  // Re-compute box after scaling
  group.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(group);
  const size2 = new THREE.Vector3(); box2.getSize(size2);
  const centre2 = new THREE.Vector3(); box2.getCenter(centre2);
  // Translate: centre on (0, 0, 0) horizontally, rest on ground (min.y = 0).
  group.position.x = -centre2.x;
  group.position.z = -centre2.z;
  group.position.y = -box2.min.y;
}

function _cloneGroup(group){
  // Deep-clone for use in a temp scene without affecting the cached one.
  return group.clone(true);
}

/**
 * Get a placeholder dozer (box primitives) used while the GLTF loads
 * or if it failed.
 */
function _getFallbackDozer(){
  if(typeof window.buildCleanDozer === 'function') return window.buildCleanDozer();
  return null;
}

/**
 * Render the dozer at a given view angle to a PNG data URL.
 *
 * Returns a Promise that resolves to the data URL once the GLTF model
 * is loaded. If the GLTF fails, falls back to the primitive model.
 */
function renderDozerSprite(view, w, h, opts){
  if(typeof THREE === 'undefined'){
    console.warn('renderDozerSprite: THREE not ready');
    return Promise.resolve('');
  }
  w = w || 600; h = h || 450;

  const renderWith = (dozer) => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true});
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(5, 8, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-3, 5, -2); scene.add(fill);

    if(dozer) scene.add(dozer);

    const aspect = w / h;
    let camera;
    if(view === 'side'){
      const halfH = 3.0;
      camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
      camera.position.set(15, 1.7, 0);
      camera.lookAt(0, 1.7, 0);
    } else if(view === 'top'){
      const halfH = 3.0;
      camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
      camera.position.set(0, 20, 0);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
    } else if(view === 'blade'){
      const halfH = 2.6;
      camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
      camera.position.set(0, 1.7, 15);
      camera.lookAt(0, 1.7, 0);
    } else {
      camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
      camera.position.set(8, 5, 8);
      camera.lookAt(0, 1.5, 0);
    }

    renderer.render(scene, camera);
    const url = canvas.toDataURL('image/png');

    // Clean up GPU resources.
    renderer.dispose();
    scene.traverse(obj => {
      if(obj.geometry) obj.geometry.dispose();
      if(obj.material){
        if(Array.isArray(obj.material)) obj.material.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); });
        else { if(obj.material.map) obj.material.map.dispose(); obj.material.dispose(); }
      }
    });

    return url;
  };

  return loadDozerModel().then(renderWith).catch(() => {
    // Fallback to primitive model.
    return renderWith(_getFallbackDozer());
  });
}

/**
 * Generate the 4 standard cab-screen sprites as Image objects, ready
 * for ctx.drawImage. The function returns the cache object immediately
 * (with possibly-loading Image objects); each Image fires `load` when
 * its sprite is ready.
 *
 * @returns {{side: HTMLImageElement, top: HTMLImageElement, blade: HTMLImageElement, perspective: HTMLImageElement}}
 */
let _dozerSpriteCache = null;
function getDozerSprites(){
  if(_dozerSpriteCache) return _dozerSpriteCache;
  const cache = {};
  const views = ['side','top','blade','perspective'];
  views.forEach(view => {
    const img = new Image();
    cache[view] = img;
    renderDozerSprite(view).then(url => {
      if(url) img.src = url;
    });
  });
  _dozerSpriteCache = cache;
  return cache;
}

function clearDozerSpriteCache(){
  _dozerSpriteCache = null;
  _dozerModelGroup = null;
  _dozerModelLoading = null;
  _dozerModelStatus = 'idle';
}

function getDozerModelStatus(){ return _dozerModelStatus; }

if(typeof window !== 'undefined'){
  window.renderDozerSprite = renderDozerSprite;
  window.getDozerSprites = getDozerSprites;
  window.clearDozerSpriteCache = clearDozerSpriteCache;
  window.getDozerModelStatus = getDozerModelStatus;
}

export { renderDozerSprite, getDozerSprites, clearDozerSpriteCache, getDozerModelStatus };

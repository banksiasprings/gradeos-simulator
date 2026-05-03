// src/sim/render/dozer-sprites.js
//
// SIM-SHELL VISUALISATION ASSET.
//
// Renders the dozer GLTF (downloaded into ./assets/dozer/) at fixed
// camera angles to PNG data URLs that the cab screen panes use as
// static background images.
//
// Slice 11.6 fix:
//   - SHARED offscreen WebGLRenderer reused across all 4 sprite renders
//     (was: 4 separate contexts → exceeds browser cap → context loss
//     cascade kills the main scene renderer).
//   - SEQUENTIAL renders (one at a time) instead of parallel.
//   - localStorage cache of rendered data URLs keyed by version, so we
//     only pay the GLTF load + render cost once per cache version.

'use strict';

const DOZER_GLTF_URL = './assets/dozer/scene.gltf';
const SPRITE_CACHE_KEY = 'gradeos-dozer-sprites-v3'; // Slice 22: cross-section is now rear view

let _dozerModelGroup = null;     // cached normalised model (THREE.Group)
let _dozerModelLoading = null;   // Promise<Group> while loading
let _dozerModelStatus = 'idle';  // 'idle' | 'loading' | 'ready' | 'error'

let _spriteRenderer = null;      // single shared offscreen renderer
let _spriteCanvas = null;        // its canvas
let _renderInFlight = null;      // serialise the queue

function _ensureSpriteRenderer(w, h){
  if(_spriteRenderer){
    if(_spriteCanvas.width !== w || _spriteCanvas.height !== h){
      _spriteCanvas.width = w; _spriteCanvas.height = h;
      _spriteRenderer.setSize(w, h, false);
    }
    return _spriteRenderer;
  }
  _spriteCanvas = document.createElement('canvas');
  _spriteCanvas.width = w; _spriteCanvas.height = h;
  _spriteRenderer = new THREE.WebGLRenderer({
    canvas: _spriteCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  _spriteRenderer.setClearColor(0x000000, 0);
  _spriteRenderer.setPixelRatio(1);
  _spriteRenderer.setSize(w, h, false);
  return _spriteRenderer;
}

/**
 * Load the dozer GLTF, normalise it (centre + scale + ground), cache
 * the THREE.Group. Subsequent calls return clones from the cache.
 */
function loadDozerModel(){
  if(_dozerModelGroup) return Promise.resolve(_cloneGroup(_dozerModelGroup));
  if(_dozerModelLoading) return _dozerModelLoading;
  if(typeof THREE === 'undefined' || !THREE.GLTFLoader){
    return Promise.reject(new Error('GLTFLoader not available'));
  }
  _dozerModelStatus = 'loading';
  console.log('[dozer-sprites] loading', DOZER_GLTF_URL);
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
          console.log('[dozer-sprites] model ready');
          resolve(_cloneGroup(root));
        } catch(e){
          _dozerModelStatus = 'error';
          _dozerModelLoading = null;
          console.warn('[dozer-sprites] normalise error', e);
          reject(e);
        }
      },
      undefined,
      (err) => {
        _dozerModelStatus = 'error';
        _dozerModelLoading = null;
        console.warn('[dozer-sprites] GLTF load failed:', err);
        reject(err);
      }
    );
  });
  return _dozerModelLoading;
}

function _normaliseDozer(group){
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3(); box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z);
  if(longest > 0.1){
    group.scale.setScalar(5.0 / longest);
  }
  group.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(group);
  const centre2 = new THREE.Vector3(); box2.getCenter(centre2);
  group.position.x = -centre2.x;
  group.position.z = -centre2.z;
  group.position.y = -box2.min.y;
  // Slice 11.7 — figure out which axis is the dozer's length, store on the
  // group so cameras can pick the right view. Most GLTF dozers come in
  // facing +X; some face +Z. Heuristic: longest horizontal axis = length.
  group.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(group);
  const size3 = new THREE.Vector3(); box3.getSize(size3);
  group.userData.lengthAxis = (size3.x >= size3.z) ? 'x' : 'z';
  group.userData.bbox = box3;
}

function _cloneGroup(group){ return group.clone(true); }

function _getFallbackDozer(){
  return (typeof window.buildCleanDozer === 'function') ? window.buildCleanDozer() : null;
}

/**
 * Render the dozer at one view to a data URL. Reuses the shared
 * offscreen renderer to avoid context flood. Single render at a time.
 */
function renderDozerSprite(view, w, h){
  if(typeof THREE === 'undefined') return Promise.resolve('');
  w = w || 600; h = h || 450;

  const doRender = (dozer) => {
    const renderer = _ensureSpriteRenderer(w, h);
    const scene = new THREE.Scene();
    // Slice 11.7 — brighter lighting (was a touch dark per Steven).
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.10);
    key.position.set(5, 8, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-3, 5, -2); scene.add(fill);
    const back = new THREE.DirectionalLight(0xffffff, 0.35);
    back.position.set(0, 4, -6); scene.add(back);
    if(dozer) scene.add(dozer);

    // Slice 11.7 — Determine model's long axis ('x' or 'z'). Cameras place
    // the side / blade views relative to that so they show what the names
    // imply: side = view of the dozer's long flank; blade = front-on with
    // the blade visible.
    const lengthAxis = (dozer && dozer.userData && dozer.userData.lengthAxis) || 'z';
    const _bbox = dozer && dozer.userData && dozer.userData.bbox;
    const front = _bbox ? (lengthAxis === 'x' ? _bbox.max.x : _bbox.max.z) : 2.5;
    const bottom = _bbox ? _bbox.min.y : 0;

    // Slice 11.7 — Add a bright reference marker at the front-bottom of
    // the blade. Operator uses this point as the cut/fill reference.
    if(_bbox){
      const markerGeo = new THREE.SphereGeometry(0.10, 16, 12);
      const markerMat = new THREE.MeshBasicMaterial({color: 0xff2233});
      const marker = new THREE.Mesh(markerGeo, markerMat);
      if(lengthAxis === 'x') marker.position.set(front, bottom, 0);
      else                  marker.position.set(0, bottom, front);
      scene.add(marker);
      // Small ring on the ground to show where the cutting edge sits.
      const ringGeo = new THREE.RingGeometry(0.18, 0.28, 24);
      const ringMat = new THREE.MeshBasicMaterial({color: 0xff2233, side: THREE.DoubleSide});
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI/2;
      ring.position.copy(marker.position);
      ring.position.y = bottom + 0.005;
      scene.add(ring);
    }

    const aspect = w / h;
    let camera;
    // Slice 11.7 — cameras place themselves based on the model's actual
    // long-axis orientation, so 'side' always shows the long flank and
    // 'blade' always shows the blade head-on regardless of how the GLTF
    // came in oriented.
    if(view === 'side'){
      // Side view = look at the dozer perpendicular to its travel direction.
      const halfH = 3.0;
      camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
      if(lengthAxis === 'x'){ camera.position.set(0, 1.7, 15); camera.lookAt(0, 1.7, 0); }
      else                  { camera.position.set(15, 1.7, 0); camera.lookAt(0, 1.7, 0); }
    } else if(view === 'top'){
      const halfH = 3.0;
      camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
      camera.position.set(0, 20, 0);
      // Forward = up in image
      if(lengthAxis === 'x') camera.up.set(-1, 0, 0);
      else                   camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
    } else if(view === 'blade'){
      // Slice 22 — cross-section pane shows the REAR view of the dozer
      // (was front-on / blade-facing-camera). The operator's natural
      // cross-section reference is looking out the back of the cab toward
      // the blade with the cab in foreground; the rear view places the
      // back of the dozer in the foreground, blade in the distance.
      // Camera moved to the -forward side of the dozer.
      const halfH = 2.6;
      camera = new THREE.OrthographicCamera(-halfH*aspect, halfH*aspect, halfH, -halfH, 0.1, 100);
      if(lengthAxis === 'x'){ camera.position.set(-15, 1.7, 0); camera.lookAt(0, 1.7, 0); }
      else                  { camera.position.set(0, 1.7, -15); camera.lookAt(0, 1.7, 0); }
    } else {
      camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
      camera.position.set(8, 5, 8); camera.lookAt(0, 1.5, 0);
    }

    renderer.render(scene, camera);
    const url = _spriteCanvas.toDataURL('image/png');

    // Dispose the temp scene contents (but NOT the shared renderer).
    scene.traverse(obj => {
      if(obj.geometry) obj.geometry.dispose();
      if(obj.material){
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); });
      }
    });
    return url;
  };

  // Serialise: queue this render after any in-flight one completes.
  const previous = _renderInFlight || Promise.resolve();
  const next = previous.then(() => loadDozerModel().then(doRender).catch(() => doRender(_getFallbackDozer())));
  _renderInFlight = next.catch(() => null); // swallow for chain
  return next;
}

let _dozerSpriteCache = null;
function getDozerSprites(){
  if(_dozerSpriteCache) return _dozerSpriteCache;
  // First, try to restore from localStorage (already-rendered URLs).
  const cache = {};
  let restored = false;
  try {
    const persisted = localStorage.getItem(SPRITE_CACHE_KEY);
    if(persisted){
      const obj = JSON.parse(persisted);
      ['side','top','blade','perspective'].forEach(view => {
        if(obj[view]){
          const img = new Image();
          img.src = obj[view];
          cache[view] = img;
        }
      });
      if(Object.keys(cache).length === 4) restored = true;
    }
  } catch(e){}

  if(!restored){
    // No cached sprites — kick off renders. Each Image is filled when
    // its render completes. Renders are sequential per renderDozerSprite's
    // queue.
    ['side','top','blade','perspective'].forEach(view => {
      const img = cache[view] || new Image();
      cache[view] = img;
      renderDozerSprite(view).then(url => {
        if(!url) return;
        img.src = url;
        // Persist the latest cache to localStorage.
        try {
          const out = {};
          ['side','top','blade','perspective'].forEach(v => {
            if(cache[v] && cache[v].src) out[v] = cache[v].src;
          });
          localStorage.setItem(SPRITE_CACHE_KEY, JSON.stringify(out));
        } catch(e){
          // Quota exceeded? Skip persistence.
        }
      });
    });
  }

  _dozerSpriteCache = cache;
  return cache;
}

function clearDozerSpriteCache(){
  _dozerSpriteCache = null;
  _dozerModelGroup = null;
  _dozerModelLoading = null;
  _dozerModelStatus = 'idle';
  try { localStorage.removeItem(SPRITE_CACHE_KEY); } catch(e){}
  if(_spriteRenderer){
    _spriteRenderer.dispose();
    _spriteRenderer = null;
    _spriteCanvas = null;
  }
}

function getDozerModelStatus(){ return _dozerModelStatus; }

if(typeof window !== 'undefined'){
  window.renderDozerSprite = renderDozerSprite;
  window.getDozerSprites = getDozerSprites;
  window.clearDozerSpriteCache = clearDozerSpriteCache;
  window.getDozerModelStatus = getDozerModelStatus;
}

export { renderDozerSprite, getDozerSprites, clearDozerSpriteCache, getDozerModelStatus };

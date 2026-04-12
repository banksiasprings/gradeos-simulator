with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'r', encoding='utf-8') as f:
    src = f.read()

# 1. Replace the _updateTrail function to accept cmm, store it, colour by grade state
old_fn = "_updateTrail(x,z,y){const now=performance.now();if(now-_trailT<300)return;_trailT=now;_TRAIL.push({x,y:y+0.3,z});if(_TRAIL.length>15)_TRAIL.shift();if(_trailMesh){scene.remove(_trailMesh);_trailMesh.geometry.dispose();_trailMesh=null;}if(_TRAIL.length<2)return;const pos=[],col=[];const n=_TRAIL.length;for(let i=0;i<n;i++){const p=_TRAIL[i];const t=(i+1)/n;pos.push(p.x,p.y,p.z);col.push(0.9*t,0.55*t,0.05*t);}"

new_fn = "_updateTrail(x,z,y,cmm){const now=performance.now();if(now-_trailT<300)return;_trailT=now;_TRAIL.push({x,y:y+0.3,z,cmm});if(_TRAIL.length>15)_TRAIL.shift();if(_trailMesh){scene.remove(_trailMesh);_trailMesh.geometry.dispose();_trailMesh=null;}if(_TRAIL.length<2)return;const pos=[],col=[];const n=_TRAIL.length;for(let i=0;i<n;i++){const p=_TRAIL[i];const t=(i+1)/n;const tol=25;let r,g,b;if(p.cmm===null||p.cmm===undefined){r=0.3;g=0.3;b=0.3;}else if(Math.abs(p.cmm)<tol){r=0;g=0.7*t;b=0.1*t;}else if(p.cmm>0){r=0.8*t;g=0.1*t;b=0.1*t;}else{r=0.1*t;g=0.3*t;b=0.9*t;}pos.push(p.x,p.y,p.z);col.push(r,g,b);}"

if old_fn in src:
    src = src.replace(old_fn, new_fn, 1)
    print('fn replaced OK')
else:
    print('fn NOT FOUND')

# 2. Update call site 1: _updateTrail(machinePos.x,machinePos.z,mel2)
old_c1 = 'recordAsBuilt(machinePos.x,machinePos.z,cDes2,mel2);_updateTrail(machinePos.x,machinePos.z,mel2);'
new_c1 = 'recordAsBuilt(machinePos.x,machinePos.z,cDes2,mel2);_updateTrail(machinePos.x,machinePos.z,mel2,cMM2);'
if old_c1 in src:
    src = src.replace(old_c1, new_c1, 1)
    print('call1 replaced OK')
else:
    print('call1 NOT FOUND')

# 3. Update call site 2: _updateTrail(machinePos.x,machinePos.z,mel)
old_c2 = 'recordAsBuilt(machinePos.x,machinePos.z,cDes,mel);_updateTrail(machinePos.x,machinePos.z,mel);'
new_c2 = 'recordAsBuilt(machinePos.x,machinePos.z,cDes,mel);_updateTrail(machinePos.x,machinePos.z,mel,cMM);'
if old_c2 in src:
    src = src.replace(old_c2, new_c2, 1)
    print('call2 replaced OK')
else:
    print('call2 NOT FOUND')

with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'w', encoding='utf-8') as f:
    f.write(src)
print('T1 DONE')

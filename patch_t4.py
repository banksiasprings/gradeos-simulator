with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'r', encoding='utf-8') as f:
    src = f.read()

# Find the blade diagram function and add tolerance band after the ground line draw
# Existing code: draws ground line then three blade positions
# We insert a tolerance band rectangle between ground line and blade positions

old = "  // Ground line across full width\n  ctx.strokeStyle='#3da030';ctx.lineWidth=2;\n  ctx.beginPath();ctx.moveTo(0,bY);ctx.lineTo(W,bY);ctx.stroke();\n  // Three blade positions"

new = "  // Ground line across full width\n  ctx.strokeStyle='#3da030';ctx.lineWidth=2;\n  ctx.beginPath();ctx.moveTo(0,bY);ctx.lineTo(W,bY);ctx.stroke();\n  // Tolerance band overlay (green zone = \u00b1guidanceTolerance mm)\n  const _tol=(typeof guidanceTolerance!=='undefined'?guidanceTolerance:50);\n  const tolPx=(_tol/MAX)*H*0.45;\n  ctx.fillStyle='rgba(39,174,96,0.12)';\n  ctx.fillRect(0,bY-tolPx,W,tolPx*2);\n  ctx.strokeStyle='rgba(39,174,96,0.35)';ctx.lineWidth=1;ctx.setLineDash([3,3]);\n  ctx.beginPath();ctx.moveTo(0,bY-tolPx);ctx.lineTo(W,bY-tolPx);ctx.stroke();\n  ctx.beginPath();ctx.moveTo(0,bY+tolPx);ctx.lineTo(W,bY+tolPx);ctx.stroke();\n  ctx.setLineDash([]);\n  ctx.fillStyle='rgba(39,174,96,0.5)';ctx.font='7px monospace';ctx.textAlign='right';\n  ctx.fillText('\u00b1'+_tol+'mm',W-2,bY-tolPx-1);\n  // Three blade positions"

if old in src:
    src = src.replace(old, new, 1)
    with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'w', encoding='utf-8') as f:
        f.write(src)
    print('T4 OK')
else:
    print('T4 NOT FOUND')
    idx = src.find('Ground line across full width')
    print(repr(src[max(0,idx-5):idx+200]))

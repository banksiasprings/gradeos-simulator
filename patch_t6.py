with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'r', encoding='utf-8') as f:
    src = f.read()

old = ("  ['dp-topo-label','dp-topo-tools-label'].forEach(id=>{\n"
       "    const el=document.getElementById(id);\n"
       "    if(el){el.textContent=s.label;el.style.color=s.color;}\n"
       "  });\n"
       "}\n"
       "function toggleContours(){")

new = ("  ['dp-topo-label','dp-topo-tools-label'].forEach(id=>{\n"
       "    const el=document.getElementById(id);\n"
       "    if(el){el.textContent=s.label;el.style.color=s.color;}\n"
       "  });\n"
       "  // Elevation range label for topo scale context\n"
       "  if(showTerrain>0&&ground&&ground.length){\n"
       "    let minE=Infinity,maxE=-Infinity;\n"
       "    for(let i=0;i<ground.length;i++){if(ground[i]<minE)minE=ground[i];if(ground[i]>maxE)maxE=ground[i];}\n"
       "    if(isFinite(minE)){\n"
       "      const rng=minE.toFixed(1)+'\\u2013'+maxE.toFixed(1)+'m';\n"
       "      ['dp-topo-label','dp-topo-tools-label'].forEach(id=>{\n"
       "        const el=document.getElementById(id);\n"
       "        if(el)el.textContent=s.label+' \\u00b7 '+rng;\n"
       "      });\n"
       "    }\n"
       "  }\n"
       "}\n"
       "function toggleContours(){")

if old in src:
    src = src.replace(old, new, 1)
    with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'w', encoding='utf-8') as f:
        f.write(src)
    print('T6 OK')
else:
    print('T6 NOT FOUND')

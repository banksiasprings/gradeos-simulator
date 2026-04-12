# T8 patch
with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'r', encoding='utf-8') as f:
    src = f.read()

em = chr(0x2014)
old_html = '        <span>Elev: <span id=' + chr(34) + 'bv-elev' + chr(34) + ' style=' + chr(34) + 'color:#7aabcc;font-family:monospace' + chr(34) + '>' + em + '</span></span>' + chr(10) + '        </div>' + chr(10) + '        <div id=' + chr(34) + 'bv-acc-note' + chr(34)
new_html = '        <span>Elev: <span id=' + chr(34) + 'bv-elev' + chr(34) + ' style=' + chr(34) + 'color:#7aabcc;font-family:monospace' + chr(34) + '>' + em + '</span></span>' + chr(10) + '        </div>' + chr(10) + '        <div id=' + chr(34) + 'bv-des-act' + chr(34) + ' style=' + chr(34) + 'font-size:9px;color:#4a7aa0;font-family:monospace;margin-top:1px;text-align:center' + chr(34) + '></div>' + chr(10) + '        <div id=' + chr(34) + 'bv-acc-note' + chr(34)
if old_html in src:
    src = src.replace(old_html, new_html, 1)
    print('HTML OK')
else:
    print('HTML NOT FOUND')

old_js = chr(39) + 'bv-elev' + chr(39) + ').textContent=elev.toFixed(3)+' + chr(39) + 'm' + chr(39) + ';'
new_js = (chr(39) + 'bv-elev' + chr(39) + ').textContent=elev.toFixed(3)+' + chr(39) + 'm' + chr(39) + ';' + chr(10) +
          '  const _daEl=document.getElementById(' + chr(39) + 'bv-des-act' + chr(39) + ');' + chr(10) +
          '  if(_daEl){if(elev!==null&&cmm!==null&&cmm!==undefined){' + chr(10) +
          '    const _de=elev+cmm/1000;' + chr(10) +
          '    _daEl.textContent=' + chr(39) + 'DES:' + chr(39) + '+_de.toFixed(3)+' + chr(39) + 'm / ACT:' + chr(39) + '+elev.toFixed(3)+' + chr(39) + 'm' + chr(39) + ';' + chr(10) +
          '    _daEl.style.color=Math.abs(cmm)<25?' + chr(39) + '#66bb6a' + chr(39) + ':' + chr(39) + '#4a7aa0' + chr(39) + ';' + chr(10) +
          '  }else{_daEl.textContent=' + chr(39) + chr(39) + ';}}')
if old_js in src:
    src = src.replace(old_js, new_js, 1)
    print('JS OK')
else:
    print('JS NOT FOUND: looking for bv-elev toFixed')
    import re
    m = re.search(r'.{0,30}bv-elev.{0,60}', src)
    if m: print(repr(m.group()))

with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'w', encoding='utf-8') as f:
    f.write(src)
print('T8 DONE')

with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'r') as f:
    src = f.read()

old = "  el.textContent=(mm>=0?'+':'')+mm+' mm';\n  el.style.color=mm===0?'#e8a020':mm>0?'#66bb6a':'#ff7043';"
new = "  el.textContent=mm===0?'ON GRADE':(mm>=0?'+':'')+mm+' mm';\n  el.style.color=mm===0?'#66bb6a':mm>0?'#66bb6a':'#ff7043';"

if old in src:
    src = src.replace(old, new, 1)
    with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'w') as f:
        f.write(src)
    print('T5 OK')
else:
    print('T5 NOT FOUND')

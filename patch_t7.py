with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'r', encoding='utf-8') as f:
    src = f.read()

old = "st.textContent='\u2b06 Import '+net.toFixed(1)+' m\u00b3';st.style.color='#ff7043';}  else{st.textContent='\u2b07 Waste '+Math.abs(net).toFixed(1)+' m\u00b3';st.style.color='#42a5f5';}"
new = "st.textContent='\u2b06 Borrow '+net.toFixed(1)+' m\u00b3';st.style.color='#ff7043';}  else{st.textContent='\u2b07 Spoil '+Math.abs(net).toFixed(1)+' m\u00b3';st.style.color='#42a5f5';}"

if old in src:
    src = src.replace(old, new, 1)
    with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'w', encoding='utf-8') as f:
        f.write(src)
    print('T7 OK')
else:
    print('T7 NOT FOUND')
    # try to find Import
    idx = src.find('Import ')
    while idx >= 0:
        print(repr(src[max(0,idx-20):idx+80]))
        print('---')
        idx = src.find('Import ', idx+1)

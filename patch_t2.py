with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'r', encoding='utf-8') as f:
    src = f.read()

# Replace the volume display lines in updateVoffBalance
# Add a helper inline function and use it for cut, fill, net
old = "  const net=cut-fill;  document.getElementById('vb-cut').textContent=cut.toFixed(1)+' m\u00b3';  document.getElementById('vb-fill').textContent=fill.toFixed(1)+' m\u00b3';  const st=document.getElementById('vb-status');  if(Math.abs(net)<0.5){st.textContent='\u2705 Balanced';st.style.color='#66bb6a';}  else if(net>0){st.textContent='\u2b06 Borrow '+net.toFixed(1)+' m\u00b3';st.style.color='#ff7043';}  else{st.textContent='\u2b07 Spoil '+Math.abs(net).toFixed(1)+' m\u00b3';st.style.color='#42a5f5';}"

new = "  const net=cut-fill;  const fmtVol=v=>v>100?Math.round(v).toString():v<10?v.toFixed(2):v.toFixed(1);  document.getElementById('vb-cut').textContent=fmtVol(cut)+' m\u00b3';  document.getElementById('vb-fill').textContent=fmtVol(fill)+' m\u00b3';  const st=document.getElementById('vb-status');  if(Math.abs(net)<0.5){st.textContent='\u2705 Balanced';st.style.color='#66bb6a';}  else if(net>0){st.textContent='\u2b06 Borrow '+fmtVol(net)+' m\u00b3';st.style.color='#ff7043';}  else{st.textContent='\u2b07 Spoil '+fmtVol(Math.abs(net))+' m\u00b3';st.style.color='#42a5f5';}"

if old in src:
    src = src.replace(old, new, 1)
    with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'w', encoding='utf-8') as f:
        f.write(src)
    print('T2 OK')
else:
    print('T2 NOT FOUND')
    idx = src.find('vb-cut')
    print(repr(src[max(0,idx-10):idx+200]))

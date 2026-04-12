with open('/Users/openclaw/Documents/gradeos-simulator/index.html', 'r', encoding='utf-8') as f:
    src = f.read()

# 1. Add bv-des-act span to the HTML blade panel (after the elev span)
old_html = "          <span>Elev: <span id=\"bv-elev\" style=\"color:#7aabcc;font-family:monospace\">--</span></span>"
new_html = "          <span>Elev: <span id=\"bv-elev\" style=\"color:#7aabcc;font-family:monospace\">--</span></span>"

# First check what the actual elev line looks like
idx = src.find('bv-elev')
print('elev line:', repr(src[max(0,idx-30):idx+80]))

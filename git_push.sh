#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "fix: enable imageSmoothingEnabled on all 3 guidance canvases (SW v76)"
git push origin main

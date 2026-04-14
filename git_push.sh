#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "feat: cut/fill LED bar on all 3 guidance canvases (v108)"
git push origin main

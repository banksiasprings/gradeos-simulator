#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "fix: side profile pitch from design grade dual-GPS simulation (SW v106)"
git push origin main

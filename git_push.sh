#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "fix: grade precision shows 2 decimals when abs(grade) < 1% (SW v70)"
git push origin main

#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "feat: shift-click vOffset +/-50mm steps (SW v71)"
git push origin main

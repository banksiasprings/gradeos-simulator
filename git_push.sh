#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "feat: 10m scale bar on side profile guidance canvas (SW v74)"
git push origin main

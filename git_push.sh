#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "feat: speed display in plan view guidance bottom-right corner (SW v73)"
git push origin main

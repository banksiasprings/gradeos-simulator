#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "fix: guidance panel compact layout for screens < 600px height (SW v77)"
git push origin main

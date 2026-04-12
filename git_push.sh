#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "fix: convert stray console.log to console.warn in NTRIP fallback (SW v75)"
git push origin main

#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "fix: dozer image upright, no terrain tilt (SW v105)"
git push origin main

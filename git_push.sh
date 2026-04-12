#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "fix: null guard for pos in drawPlanViewGuidance (SW v69)"
git push origin main

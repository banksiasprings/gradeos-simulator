#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "feat: GPS accuracy ring in plan view guidance (SW v72)"
git push origin main

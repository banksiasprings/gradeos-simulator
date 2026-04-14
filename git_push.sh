#!/bin/bash
cd /Users/openclaw/Documents/gradeos-simulator
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "feat: to-scale D11T silhouettes + zoom buttons on guidance panels (v107)"
git push origin main

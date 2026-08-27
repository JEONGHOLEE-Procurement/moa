#!/usr/bin/env bash
# MOA 정적 데모 빌드 — github.io/Static Site 용.
# public/ 을 dist/ 로 복사하며 (1) 목 백엔드 주입 (2) 절대경로 링크를 상대경로로 치환.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist
cp public/moa.css public/dashboard.js public/mock-api.js dist/

# 랜딩: <head>에 mock 주입 + /dashboard → dashboard.html
sed -e 's|<link rel="stylesheet" href="moa.css">|<script src="mock-api.js"></script>\n<link rel="stylesheet" href="moa.css">|' \
    -e 's|href="/dashboard"|href="dashboard.html"|g' \
    public/index.html > dist/index.html

# 대시보드: dashboard.js 앞에 mock 주입 + "홈" 링크(/ → index.html)
sed -e 's|<script src="dashboard.js"></script>|<script src="mock-api.js"></script>\n<script src="dashboard.js"></script>|' \
    -e 's|href="/"|href="index.html"|g' \
    public/dashboard.html > dist/dashboard.html

touch dist/.nojekyll
echo "빌드 완료 → dist/"
ls -1 dist

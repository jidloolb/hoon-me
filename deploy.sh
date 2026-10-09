#!/bin/bash
# 앱 수정 후 폰에 반영: 빌드 → gh-pages 브랜치에 올림(GitHub Pages가 1~2분 뒤 갱신).
# 폰은 앱을 다음에 열 때 새 버전을 받고, 그다음 실행부터 적용된다. 기록(데이터)은 그대로.
set -e
cd "$(dirname "$0")"
npm run build
cd dist
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name=hoon -c user.email=jidlo.olb@gmail.com commit -qm "배포 $(date '+%Y-%m-%d %H:%M')"
git push -qf https://github.com/jidloolb/hoon-me.git gh-pages
rm -rf .git
echo "✓ 배포 완료 → https://jidloolb.github.io/hoon-me/"

#!/bin/bash
# 공개 주소 켜기/끄기 — 폰에 설치(홈 화면 추가 후 한 번 열기)한 뒤엔 꺼 둔다.
# 꺼도 폰 앱은 저장된 파일로 계속 돈다. 앱을 고쳐서 폰에 받을 때만 잠깐 켠다.
#   ./site.sh on   → 배포 + 공개(1~2분 뒤 열림)
#   ./site.sh off  → 공개 중단(주소로 열면 404)
#   ./site.sh      → 상태
set -e
cd "$(dirname "$0")"
REPO=jidloolb/hoon-me
case "$1" in
  on)
    ./deploy.sh
    gh api -X POST "repos/$REPO/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 || true
    echo "✓ 켬 → https://jidloolb.github.io/hoon-me/ (1~2분 뒤)"
    ;;
  off)
    gh api -X DELETE "repos/$REPO/pages" && echo "✓ 껐어요 (주소로 열면 404)"
    ;;
  *)
    if gh api "repos/$REPO/pages" >/dev/null 2>&1; then echo "켜짐 → https://jidloolb.github.io/hoon-me/"; else echo "꺼짐"; fi
    ;;
esac

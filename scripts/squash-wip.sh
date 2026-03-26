#!/bin/bash
# WIP commit-үүдийг нэг commit болгох
# Ашиглах: bash scripts/squash-wip.sh "feat: жинхэнэ commit message"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

MSG="$1"
if [ -z "$MSG" ]; then
  echo "Ашиглах: bash scripts/squash-wip.sh \"commit message\""
  exit 1
fi

# WIP commit-ууд хэдэн ширхэг байгааг тоолох
WIP_COUNT=$(git log --oneline --grep="^wip: auto-save" | head -50 | wc -l)

if [ "$WIP_COUNT" -eq 0 ]; then
  echo "WIP commit олдсонгүй."
  exit 0
fi

# Хамгийн сүүлийн WIP-ийн биш commit-ийг олох
LAST_REAL=$(git log --oneline --invert-grep --grep="^wip: auto-save" -1 --format="%H")

if [ -z "$LAST_REAL" ]; then
  echo "Жинхэнэ commit олдсонгүй."
  exit 1
fi

echo "$WIP_COUNT WIP commit олдлоо. Нэг commit болгож байна..."

git reset --soft "$LAST_REAL"
git commit -m "$MSG"

echo "Амжилттай! $WIP_COUNT WIP -> 1 commit"

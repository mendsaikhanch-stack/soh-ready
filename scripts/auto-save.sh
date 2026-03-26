#!/bin/bash
# Auto WIP commit — 2 минут тутам өөрчлөлт байвал WIP commit хийнэ
# Ашиглах: bash scripts/auto-save.sh
# Зогсоох: Ctrl+C

INTERVAL=120  # секунд (2 мин)
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR" || exit 1

echo "Auto-save эхэллээ ($PROJECT_DIR)"
echo "  ${INTERVAL}с тутам шалгана. Ctrl+C-ээр зогсооно."
echo ""

while true; do
  sleep $INTERVAL

  # Өөрчлөлт байгаа эсэх
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    TIMESTAMP=$(date +"%H:%M")
    git add -A
    git commit -m "wip: auto-save $TIMESTAMP" --no-verify 2>/dev/null

    if [ $? -eq 0 ]; then
      echo "[$(date +"%H:%M:%S")] WIP commit хийлээ"
    fi
  fi
done

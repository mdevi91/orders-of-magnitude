#!/usr/bin/env bash
# Wraps the artifact page (no doctype/head) into a standalone document for Firebase Hosting.
set -euo pipefail
SRC=${1:?usage: build.sh <artifact.html>}
OUT="$(dirname "$0")/public/index.html"
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  sed -n '1,/<\/style>/p' "$SRC" | sed 's|^<style>$|<style>\nbody{margin:0}[hidden]{display:none!important}*,*::before,*::after{box-sizing:border-box}|'
  printf '</head>\n<body>\n'
  sed -n '/<\/style>/,$p' "$SRC" | sed '1d'
  printf '</body>\n</html>\n'
} > "$OUT"
sed -n '/<script>/,/<\/script>/p' "$OUT" | sed '1d;$d' | node --check --input-type=commonjs
echo "built $OUT"

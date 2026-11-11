#!/bin/bash
# Copies one gift site from its own project (exactly what is committed there) into this repo's folder of the same name,
# commits, and with --push publishes it: https://leishaforlinminzhi-9.github.io/<name>/
#   tools/sync.sh hunt|campus|poem|photo [--push] [-m "message"]
# hunt comes from ~/treasure-hunt/release (made by its tools/release.sh: the gated build without the answers);
# the others from the last commit of ~/campus-25d, ~/poem-collage, ~/puppy-photo (uncommitted files never leave).
set -euo pipefail
cd "$(dirname "$0")/.."
name="${1:-}"; [ $# -gt 0 ] && shift
push=0; msg=""
while [ $# -gt 0 ]; do case "$1" in --push) push=1 ;; -m) msg="$2"; shift ;; *) echo "unknown: $1"; exit 1 ;; esac; shift; done
case "$name" in
  hunt) src="$HOME/treasure-hunt/release" ;;
  campus) src="$HOME/campus-25d" ;;
  poem) src="$HOME/poem-collage" ;;
  photo) src="$HOME/puppy-photo" ;;
  *) echo "usage: tools/sync.sh hunt|campus|poem|photo [--push] [-m msg]"; exit 1 ;;
esac
[ -d "$src/.git" ] || { echo "$src is not a git repo"; exit 1; }
# unpack into .sync/<name> (git-ignored), then mirror it into <name>/ (rsync --delete drops files that are gone)
mkdir -p .sync/empty ".sync/$name" "$name"
rsync -a --delete .sync/empty/ ".sync/$name/"
git -C "$src" archive HEAD | tar -x -C ".sync/$name"
rsync -a --delete --exclude .nojekyll --exclude .gitignore ".sync/$name/" "$name/"
git add -A "$name"
if git diff --cached --quiet; then echo "$name: nothing changed"; else git commit -q -m "${msg:-Update $name from $(git -C "$src" log -1 --format=%h)}"; echo "$name: committed"; fi
if [ "$push" = 1 ]; then git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -q origin main && echo "pushed"; fi

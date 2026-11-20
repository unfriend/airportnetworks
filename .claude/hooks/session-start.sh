#!/bin/bash
# Brings this checkout up to date with GitHub as a cloud session starts, resumes or is cleared (the owner, 20 November
# 2026: "make sure we have up to date git checkouts when we start sessions"). Why: a resumed cloud container keeps its
# old local branch. On 20 November its dev was two days and nine releases behind GitHub's: the reflog shows GitHub's dev
# fetched, then the local dev checked out as it was, so work started on v164 while dev was at v173.
# What it does: fetches the branch's own on GitHub (its upstream, else origin/<branch>) and fast-forwards when the branch
# is only behind and nothing tracked is changed. Anything else (ahead, diverged, uncommitted changes, a merge under way, a
# detached HEAD, no network) changes nothing and says what to do. Its one line is what Claude reads first in a session.
# Never rebases, resets, stashes or force-pushes; always exits 0 (a session never waits on it for long or fails by it);
# does nothing outside a cloud session (CLAUDE_CODE_REMOTE).
set -u
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
say() { echo "Checkout (session-start hook): $*"; }
line() { printf '%s' "$1" | head -n 1 | cut -c1-160; }
commits() { if [ "$1" = 1 ]; then echo '1 commit'; else echo "$1 commits"; fi; }

branch=$(git symbolic-ref --quiet --short HEAD) || {
  say "a detached HEAD at $(git rev-parse --short HEAD): not updated. Check out the branch to work on, then git merge --ff-only origin/<branch>."
  exit 0
}
up=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)
if [ -n "$up" ]; then remote=${up%%/*}; rb=${up#*/}; else remote=origin; rb=$branch; fi
git remote get-url "$remote" >/dev/null 2>&1 || { say "no remote '$remote': $branch not updated."; exit 0; }

# fetch, three tries (a moment's network trouble), each at most 25 s
err=''; ok=''
for wait in 0 2 5; do
  sleep "$wait"
  if err=$(timeout 25 git fetch --quiet --no-tags "$remote" "$rb" 2>&1 >/dev/null); then ok=1; break; fi
  case "$err" in *"couldn't find remote ref"*) say "no branch $rb on $remote yet (a new branch): nothing to bring in."; exit 0 ;; esac
done
[ -n "$ok" ] || { say "could not fetch $remote/$rb ($(line "$err")): $branch may be behind GitHub. Fetch and merge before working."; exit 0; }
theirs=$(git rev-parse FETCH_HEAD)
mine=$(git rev-parse HEAD)
now() { git log -1 --format='%h %s' "$1" | cut -c1-100; }
if [ "$mine" = "$theirs" ]; then say "$branch is up to date with $remote/$rb ($(now HEAD))."; exit 0; fi

gd=$(git rev-parse --git-dir)
for f in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD REVERT_HEAD; do
  [ -e "$gd/$f" ] && { say "a merge, rebase or cherry-pick is under way: $branch not updated (GitHub's $rb is at $(now "$theirs"))."; exit 0; }
done
behind=$(git rev-list --count "HEAD..$theirs")
ahead=$(git rev-list --count "$theirs..HEAD")
if [ "$behind" -gt 0 ] && [ "$ahead" -eq 0 ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    say "$branch is $(commits "$behind") behind $remote/$rb and has uncommitted changes: not updated. Commit them, then git merge $remote/$rb (GitHub's is at $(now "$theirs"))."
    exit 0
  fi
  old=$(git rev-parse --short HEAD)
  if err=$(git merge --ff-only --quiet "$theirs" 2>&1); then
    say "$branch fast-forwarded from $old to $remote/$rb, $(commits "$behind") (now $(now HEAD))."
  else
    say "$branch is $(commits "$behind") behind $remote/$rb, but the fast-forward failed ($(line "$err")): not updated. Run git merge --ff-only $remote/$rb."
  fi
elif [ "$ahead" -gt 0 ] && [ "$behind" -eq 0 ]; then
  say "$branch is $(commits "$ahead") ahead of $remote/$rb (not pushed yet); nothing new on GitHub."
else
  say "$branch and $remote/$rb have diverged ($(commits "$ahead") here, $(commits "$behind") there): not updated. Merge with git merge $remote/$rb before working (no rebase, no force push)."
fi
exit 0

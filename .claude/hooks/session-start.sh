#!/bin/bash
# Brings this checkout up to date with GitHub as a cloud session starts, resumes or is cleared (the owner, 20 November
# 2026: "make sure we have up to date git checkouts when we start sessions"). Why: a resumed cloud container keeps its
# old local branch. On 20 November its dev was two days and nine releases behind GitHub's: the reflog shows GitHub's dev
# fetched, then the local dev checked out as it was, so work started on v164 while dev was at v173.
# What it does: fetches the branch's own on its remote (its upstream, else origin/<branch>) and fast-forwards when the
# branch is only behind, nothing tracked is changed and no file the update brings is already in the folder (an ignored
# file there, such as the owner's scenes in tools/studio/test/local/, would be overwritten without a word). Anything else
# (ahead, diverged, uncommitted changes, a file in the way, a merge under way, a detached HEAD, no network) changes
# nothing and says what to do. Its one line is what Claude reads first in a session.
# Never rebases, resets, stashes or force-pushes; always exits 0; at most about 45 s without a network; does nothing
# outside a cloud session (CLAUDE_CODE_REMOTE).
set -u
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
export LC_ALL=C GIT_TERMINAL_PROMPT=0   # (git's messages in English, matched below; never a password prompt)
say() { echo "Checkout (session-start hook): $*"; }
line() { printf '%s' "$1" | tr '\n' ' ' | cut -c1-200; }
commits() { if [ "$1" = 1 ]; then echo '1 commit'; else echo "$1 commits"; fi; }

branch=$(git symbolic-ref --quiet --short HEAD) || {
  say "a detached HEAD at $(git rev-parse --short HEAD): not updated. Check out the branch to work on, then git fetch and git merge --ff-only its remote branch."
  exit 0
}
up=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)
if [ -n "$up" ]; then remote=${up%%/*}; rb=${up#*/}; else remote=origin; rb=$branch; fi
git remote get-url "$remote" >/dev/null 2>&1 || { say "no remote '$remote': $branch not updated."; exit 0; }

# fetch, two tries (a moment's network trouble), each at most 20 s
tmo() { if command -v timeout >/dev/null 2>&1; then timeout -k 3 20 "$@"; else "$@"; fi; }
err=''; ok=''; rc=0
for wait in 0 3; do
  sleep "$wait"
  if err=$(tmo git fetch --quiet --no-tags "$remote" "$rb" 2>&1 >/dev/null); then ok=1; break; else rc=$?; fi
  case "$err" in *"couldn't find remote ref"*) say "no branch $rb on $remote yet (a new branch): nothing to bring in."; exit 0 ;; esac
done
if [ -z "$ok" ]; then
  [ "$rc" = 124 ] || [ "$rc" = 137 ] && err="timed out"
  say "could not fetch $remote/$rb (${err:+$(line "$err")}): $branch may be behind. Fetch and merge before working."
  exit 0
fi
theirs=$(git rev-parse --verify --quiet FETCH_HEAD) || true
[ -n "$theirs" ] || { say "the fetch of $remote/$rb gave no commit: $branch not updated."; exit 0; }
mine=$(git rev-parse HEAD)
now() { git log -1 --format='%h %s' "$1" | cut -c1-100; }
short=$(git rev-parse --short "$theirs")
if [ "$mine" = "$theirs" ]; then say "$branch is up to date with $remote/$rb ($(now HEAD))."; exit 0; fi

gd=$(git rev-parse --git-dir)
for f in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD REVERT_HEAD; do
  [ -e "$gd/$f" ] && { say "a merge, rebase or cherry-pick is under way: $branch not updated ($remote/$rb is at $(now "$theirs"))."; exit 0; }
done
behind=$(git rev-list --count "HEAD..$theirs" 2>/dev/null || echo '')
ahead=$(git rev-list --count "$theirs..HEAD" 2>/dev/null || echo '')
[ -n "$behind" ] && [ -n "$ahead" ] || { say "could not compare $branch with $remote/$rb: not updated."; exit 0; }
shallow=''; [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = true ] && shallow=' (a shallow clone: the counts may be off)'
if [ "$behind" -gt 0 ] && [ "$ahead" -eq 0 ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    say "$branch is $(commits "$behind") behind $remote/$rb and has uncommitted changes: not updated. Commit them, then git merge $short ($remote/$rb: $(now "$theirs"))."
    exit 0
  fi
  # files the update adds that are already in the folder (untracked or ignored): never overwritten
  inway=$(git -c core.quotePath=false diff --name-only --diff-filter=A HEAD "$theirs" | while IFS= read -r p; do if [ -e "$p" ] || [ -L "$p" ]; then printf '%s, ' "$p"; fi; done | cut -c1-200)
  if [ -n "$inway" ]; then
    say "$branch is $(commits "$behind") behind $remote/$rb, but files the update adds are already here, untracked or ignored (${inway%, }): not updated. Move them aside, then git merge --ff-only $short."
    exit 0
  fi
  old=$(git rev-parse --short HEAD)
  if err=$(git merge --ff-only --quiet "$theirs" 2>&1); then
    say "$branch fast-forwarded from $old to $remote/$rb, $(commits "$behind") (now $(now HEAD))."
  else
    say "$branch is $(commits "$behind") behind $remote/$rb, but the fast-forward failed ($(line "$err")): not updated. Then git merge --ff-only $short."
  fi
elif [ "$ahead" -gt 0 ] && [ "$behind" -eq 0 ]; then
  say "$branch is $(commits "$ahead") ahead of $remote/$rb (not pushed yet); nothing new there."
else
  say "$branch and $remote/$rb have diverged ($(commits "$ahead") here, $(commits "$behind") there)$shallow: not updated. Merge with git merge $short before working (no rebase, no force push)."
fi
exit 0

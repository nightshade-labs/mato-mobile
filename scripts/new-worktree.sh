#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/new-worktree.sh [--skip-install] <branch> [path] [base-ref]

Examples:
  bash scripts/new-worktree.sh codex/my-feature
  bash scripts/new-worktree.sh codex/my-feature /tmp/mato-mobile-my-feature
  bash scripts/new-worktree.sh --skip-install codex/my-feature /tmp/mato-mobile-my-feature main
  npm run worktree:new -- codex/my-feature

Behavior:
  - creates the worktree from [base-ref] when the branch does not exist yet
  - reuses the existing local branch when it already exists
  - installs dependencies in the new worktree using the repo lockfile
EOF
}

skip_install=0
args=()

while (($# > 0)); do
  case "$1" in
    --skip-install)
      skip_install=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      args+=("$1")
      shift
      ;;
  esac
done

if ((${#args[@]} < 1 || ${#args[@]} > 3)); then
  usage >&2
  exit 1
fi

branch="${args[0]}"
repo_root="$(git rev-parse --show-toplevel)"
repo_name="$(basename "$repo_root")"
default_path="/tmp/${repo_name}-${branch//\//-}"
worktree_path="${args[1]:-$default_path}"
base_ref="${args[2]:-main}"

if [[ -e "$worktree_path" ]]; then
  echo "Path already exists: $worktree_path" >&2
  exit 1
fi

if git -C "$repo_root" show-ref --verify --quiet "refs/heads/$branch"; then
  echo "Creating worktree at $worktree_path from existing branch $branch"
  git -C "$repo_root" worktree add "$worktree_path" "$branch"
else
  echo "Creating worktree at $worktree_path from $base_ref on new branch $branch"
  git -C "$repo_root" worktree add -b "$branch" "$worktree_path" "$base_ref"
fi

if ((skip_install)); then
  echo "Skipping dependency install"
  exit 0
fi

if [[ -f "$worktree_path/package-lock.json" ]]; then
  echo "Installing dependencies with npm ci"
  (cd "$worktree_path" && npm ci)
  exit 0
fi

if [[ -f "$worktree_path/pnpm-lock.yaml" ]]; then
  echo "Installing dependencies with pnpm install --frozen-lockfile"
  (cd "$worktree_path" && pnpm install --frozen-lockfile)
  exit 0
fi

if [[ -f "$worktree_path/yarn.lock" ]]; then
  echo "Installing dependencies with yarn install --frozen-lockfile"
  (cd "$worktree_path" && yarn install --frozen-lockfile)
  exit 0
fi

echo "No supported lockfile found in $worktree_path, skipping dependency install" >&2

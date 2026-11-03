#!/usr/bin/env bash
# Applies branch protection to main. Requires an authenticated `gh` with admin rights on the repo.
# Usage: scripts/protect-main.sh OWNER/idle-depot
set -euo pipefail
REPO="${1:?usage: protect-main.sh OWNER/REPO}"

gh api -X PUT "repos/${REPO}/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["Lint, typecheck, test, build"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
echo "Branch protection applied to ${REPO}:main"

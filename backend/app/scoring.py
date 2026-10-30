"""
FairPlay PR Scoring and Gaming Detection Engine.

Implements the 4-signal weighted rubric (0-100):
  - 40% Merge legitimacy (merged by independent maintainer vs self-merged / open)
  - 20% Review engagement (real review comments & discussion vs rubber-stamped)
  - 20% Change substance (meaningful code change vs whitespace/README-only edit)
  - 20% Repo trust (established/active repo vs throwaway self-created repo)

Separately executes an extensible rules pass to flag gaming patterns with
plain-language explanations.
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Tuple


def _parse_iso(ts_str: Optional[str]) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        # Standardize trailing Z
        clean = ts_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return None


def calculate_merge_legitimacy(pr: Dict[str, Any]) -> float:
    """
    Max 40 points:
      - 40.0: Merged by an independent maintainer (someone other than the author).
      - 0.0: Self-merged (merged by the author or merged in self-owned repo without independent check).
      - 0.0: Still open or closed without merging.
    """
    if not pr.get("merged"):
        return 0.0

    author = (pr.get("author") or "").strip().lower()
    merged_by = (pr.get("merged_by") or "").strip().lower()
    repo_owner = (pr.get("repo_owner") or "").strip().lower()

    # Explicit self-merge
    if merged_by and merged_by == author:
        return 0.0

    # If merged_by is absent but author owns the repo, treat as self-merged
    if not merged_by and repo_owner and repo_owner == author:
        return 0.0

    # Merged by independent third party
    if merged_by and merged_by != author:
        return 40.0

    # Merged into an independent external repo
    if repo_owner and repo_owner != author:
        return 40.0

    return 0.0


def calculate_review_engagement(pr: Dict[str, Any]) -> float:
    """
    Max 20 points:
      - Measures genuine peer review comments and discussion vs rubber-stamping.
    """
    comments = int(pr.get("comment_count") or 0)
    reviews = int(pr.get("review_count") or 0)
    total_comments = int(pr.get("review_comment_count") or (comments + reviews))

    if total_comments == 0 and reviews == 0:
        return 0.0

    score = 0.0
    # Formal GitHub reviews carry high weight
    if reviews >= 2:
        score += 12.0
    elif reviews == 1:
        score += 8.0

    # Discussion & comments
    if comments >= 4:
        score += 8.0
    elif comments >= 2:
        score += 5.0
    elif comments == 1:
        score += 3.0

    # Fallback to total_comments if review objects weren't individually separated
    if score == 0.0 and total_comments > 0:
        score = min(20.0, total_comments * 4.0)

    return float(min(20.0, max(0.0, round(score, 1))))


def calculate_change_substance(pr: Dict[str, Any]) -> float:
    """
    Max 20 points:
      - Meaningful code changes across files vs. single-line typo/README edits.
    """
    additions = int(pr.get("additions") or 0)
    deletions = int(pr.get("deletions") or 0)
    files_changed = int(pr.get("files_changed") or 0)
    title = (pr.get("title") or "").strip().lower()
    total_lines = additions + deletions

    if total_lines == 0:
        return 0.0

    # Check for obvious trivial typo or trivial README changes
    is_typo_hint = bool(re.search(r"\b(typo|readme|formatting|spacing)\b", title))

    if files_changed <= 1 and total_lines <= 2:
        return 2.0 if not is_typo_hint else 1.0

    if files_changed <= 1 and total_lines <= 5:
        return 5.0 if not is_typo_hint else 3.0

    if total_lines <= 20:
        return 10.0

    if total_lines <= 100:
        return 16.0

    # Large thoughtful contribution
    if total_lines <= 1000:
        return 20.0

    # Cap excessively massive blobs (e.g. 10,000+ line dump) to 14.0
    return 14.0


def calculate_repo_trust(pr: Dict[str, Any]) -> float:
    """
    Max 20 points:
      - Established/active repo with history vs throwaway repo created by author.
    """
    author = (pr.get("author") or "").strip().lower()
    repo_owner = (pr.get("repo_owner") or "").strip().lower()
    repo_created_at = _parse_iso(pr.get("repo_created_at"))
    pr_created_at = _parse_iso(pr.get("created_at")) or datetime.now(timezone.utc)
    stars = int(pr.get("repo_stars") or 0)
    forks = int(pr.get("repo_forks") or 0)

    # Self-owned repos get near-zero trust by default
    if repo_owner and repo_owner == author:
        # If the self-owned repo has notable stars (>25) and is older than 180 days, partial credit
        if repo_created_at:
            age_days = (pr_created_at - repo_created_at).days
            if age_days > 180 and stars > 25:
                return 6.0
        return 0.0

    # External / third-party repository
    score = 6.0  # Base trust for contributing to another entity's project

    # Repo age signal
    if repo_created_at:
        age_days = (pr_created_at - repo_created_at).days
        if age_days >= 365:
            score += 8.0
        elif age_days >= 90:
            score += 5.0
        elif age_days >= 30:
            score += 3.0
        elif age_days < 7:
            # Suspect external throwaway repo
            score -= 3.0

    # Community validation signal
    if stars >= 50 or forks >= 25:
        score += 6.0
    elif stars >= 10 or forks >= 5:
        score += 4.0
    elif stars >= 1 or forks >= 1:
        score += 2.0

    return float(min(20.0, max(0.0, round(score, 1))))


def score_pr(pr: Dict[str, Any]) -> Tuple[float, Dict[str, float]]:
    """
    Score a single PR using the 4-signal weighted rubric.
    Returns (total_score_0_to_100, breakdown_dict).
    """
    merge_pts = calculate_merge_legitimacy(pr)
    review_pts = calculate_review_engagement(pr)
    substance_pts = calculate_change_substance(pr)
    repo_pts = calculate_repo_trust(pr)

    total = round(merge_pts + review_pts + substance_pts + repo_pts, 1)
    breakdown = {
        "merge_legitimacy": merge_pts,
        "review_engagement": review_pts,
        "change_substance": substance_pts,
        "repo_trust": repo_pts,
    }
    return total, breakdown


# ═══════════════════════════════════════════════════════════════
# GAMING RULES ENGINE
# ═══════════════════════════════════════════════════════════════

class GamingRule:
    """Base interface for audit rules."""
    rule_id: str
    name: str

    def evaluate(self, pr: Dict[str, Any], all_user_prs: Optional[List[Dict[str, Any]]] = None) -> Tuple[bool, Optional[str]]:
        raise NotImplementedError


class FreshSelfOwnedRepoRule(GamingRule):
    """
    Flags if the PR's repo owner == the PR author AND repo was created
    within 7 days of the PR being opened.
    """
    rule_id = "SELF_OWNED_FRESH_REPO"
    name = "Fresh Self-Owned Repository"

    def evaluate(self, pr: Dict[str, Any], all_user_prs: Optional[List[Dict[str, Any]]] = None) -> Tuple[bool, Optional[str]]:
        author = (pr.get("author") or "").strip().lower()
        repo_owner = (pr.get("repo_owner") or "").strip().lower()

        if not author or not repo_owner or author != repo_owner:
            return False, None

        repo_created_at = _parse_iso(pr.get("repo_created_at"))
        pr_created_at = _parse_iso(pr.get("created_at"))

        if repo_created_at and pr_created_at:
            delta_days = (pr_created_at - repo_created_at).total_seconds() / 86400.0
            if 0 <= delta_days <= 7.0:
                return True, (
                    f"Self-owned repo '{pr.get('repo')}' was created only "
                    f"{delta_days:.1f} days before opening this PR (throwaway repo gaming pattern)."
                )

        return False, None


class SelfMergedRule(GamingRule):
    """Flags PRs merged by the author without independent maintainer signoff."""
    rule_id = "SELF_MERGED"
    name = "Self-Merged Pull Request"

    def evaluate(self, pr: Dict[str, Any], all_user_prs: Optional[List[Dict[str, Any]]] = None) -> Tuple[bool, Optional[str]]:
        if not pr.get("merged"):
            return False, None

        author = (pr.get("author") or "").strip().lower()
        merged_by = (pr.get("merged_by") or "").strip().lower()

        if merged_by and author and merged_by == author:
            return True, "PR was merged by the author themselves without independent maintainer review."

        return False, None


class WhitespaceBurstRule(GamingRule):
    """Flags minimal whitespace/typo edits in single files."""
    rule_id = "WHITESPACE_BURST"
    name = "Trivial / Whitespace Change"

    def evaluate(self, pr: Dict[str, Any], all_user_prs: Optional[List[Dict[str, Any]]] = None) -> Tuple[bool, Optional[str]]:
        additions = int(pr.get("additions") or 0)
        deletions = int(pr.get("deletions") or 0)
        files = int(pr.get("files_changed") or 0)
        total_lines = additions + deletions

        if files == 1 and total_lines <= 2:
            return True, f"Trivial diff: only {total_lines} line(s) changed in 1 file (suspected typo or whitespace padding)."

        return False, None


# Active rules pipeline
ACTIVE_GAMING_RULES: List[GamingRule] = [
    FreshSelfOwnedRepoRule(),
    SelfMergedRule(),
    WhitespaceBurstRule(),
]


def check_gaming_rules(
    pr: Dict[str, Any], all_user_prs: Optional[List[Dict[str, Any]]] = None
) -> Tuple[bool, Optional[str], List[str]]:
    """
    Run all active gaming rules against a PR.
    Returns (is_flagged, combined_reason_str, list_of_reasons).
    """
    reasons: List[str] = []
    for rule in ACTIVE_GAMING_RULES:
        triggered, reason = rule.evaluate(pr, all_user_prs)
        if triggered and reason:
            reasons.append(reason)

    is_flagged = len(reasons) > 0
    combined = " | ".join(reasons) if reasons else None
    return is_flagged, combined, reasons


def score_user_prs(
    username: str, prs: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Scores all PRs for a single user, runs gaming detection,
    and returns a summary object with total score, flagged count, and PR list.
    """
    scored_prs = []
    total_score = 0.0
    flagged_count = 0

    for pr in prs:
        score, breakdown = score_pr(pr)
        flagged, flag_reason, flag_reasons = check_gaming_rules(pr, prs)

        if flagged:
            flagged_count += 1

        total_score += score

        scored_pr = dict(pr)
        scored_pr["score"] = score
        scored_pr["breakdown"] = breakdown
        scored_pr["flagged"] = flagged
        scored_pr["flag_reason"] = flag_reason
        scored_pr["flag_reasons"] = flag_reasons
        scored_prs.append(scored_pr)

    return {
        "username": username,
        "total_score": round(total_score, 1),
        "pr_count": len(scored_prs),
        "flagged_count": flagged_count,
        "prs": scored_prs,
    }

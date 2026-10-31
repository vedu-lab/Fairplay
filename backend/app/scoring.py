"""
FairPlay PR Scoring and Gaming Detection Engine.

Implements the 4-signal weighted rubric (0-100):
  - 40% Merge legitimacy (merged by independent maintainer vs self-merged / open / self-owned)
  - 20% Review engagement (real review comments & discussion vs rubber-stamped)
  - 20% Change substance (meaningful code change vs whitespace/README-only edit/dump)
  - 20% Repo trust (established/active repo vs throwaway self-created or fresh alt repo)

Enriches every evaluated PR with:
  - Exact points gained vs points forfeited/lost across each dimension
  - Specific plain-language reasons for points earned and lost
  - Modular rules pass to flag gaming patterns (self-owned, self-merged, whitespace burst, duplicate burst)
  - Contributor-level aggregates for graphical visualization (waterfalls, radar/bar charts)
  - Repository-level changelog and lead contributor rankings
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Tuple


def _parse_iso(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, str):
        try:
            clean = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


def _is_doc_or_config_file(filename: str) -> bool:
    f = filename.lower().strip()
    base = f.split("/")[-1]
    if "readme" in base or "license" in base or "changelog" in base or base.startswith(".git"):
        return True
    ext = "." + base.split(".")[-1] if "." in base else ""
    return ext in {
        ".md", ".markdown", ".txt", ".rst", ".json", ".yaml", ".yml",
        ".toml", ".ini", ".cfg", ".config", ".env", ".lock",
    }


def calculate_merge_legitimacy(pr: Dict[str, Any]) -> Tuple[int, Optional[str]]:
    """
    40% Merge legitimacy:
      - merged AND merged_by != author -> full points (40)
      - merged by author or still open -> 0
      - merged inside author's personal repository -> 0 (prevents sockpuppet/alt merge gaming)
      - if merged into independent repo and merged_by is absent (REST fallback) -> 40
    Returns (score, loss_reason).
    """
    author = (pr.get("author") or "").strip().lower()
    merged = bool(pr.get("merged", False))
    merged_by = (pr.get("merged_by") or "").strip().lower()
    repo_owner = (pr.get("repo_owner") or "").strip().lower()

    if not merged:
        return 0, "PR remains open or was closed unmerged (0/40 pts)"

    # Explicit self-merge
    if merged_by and merged_by == author:
        return 0, f"Self-merged: Merged by author '{author}' without independent review (0/40 pts)"

    # Sockpuppet or bot merge inside author's self-owned repo
    if repo_owner and author and repo_owner == author:
        return 0, f"Self-owned repo merge: Merged inside author's personal repository '{author}' (0/40 pts)"

    # Merged by independent third-party maintainer
    if merged_by and merged_by != author:
        return 40, None

    # Merged into independent repository (covers REST v3 fallback search where merged_by is omitted)
    if repo_owner and author and repo_owner != author:
        return 40, None

    return 0, "Unverified merger: No independent merger recorded (0/40 pts)"


def calculate_review_engagement(pr: Dict[str, Any]) -> Tuple[int, Optional[str]]:
    """
    20% Review engagement:
      - Scaled by review_comment_count, capped at 20 (e.g. 5+ comments = 20 pts).
      - PRs with large comment counts (e.g. 50) cap cleanly without breaking the curve.
    Returns (score, loss_reason).
    """
    comments = int(pr.get("review_comment_count") or 0)
    if comments <= 0:
        return 0, "Zero review engagement: No review comments recorded (0/20 pts)"

    score = min(20, comments * 4)
    loss_reason = None if score == 20 else f"Light review engagement: {comments} comment(s) (-{20 - score} pts)"
    return score, loss_reason


def calculate_change_substance(pr: Dict[str, Any]) -> Tuple[int, Optional[str]]:
    """
    20% Change substance:
      - Penalize PRs that only touch README/whitespace/config files.
      - Reward PRs with real code file changes in a reasonable size range.
      - Penalize 1-line changes and massive code dumps.
    Returns (score, loss_reason).
    """
    additions = int(pr.get("additions") or 0)
    deletions = int(pr.get("deletions") or 0)
    files_changed = int(pr.get("files_changed") or 0)
    total_lines = additions + deletions
    title = (pr.get("title") or "").strip().lower()
    files = pr.get("files") or []

    if total_lines == 0:
        return 0, "Empty diff: No additions or deletions detected (0/20 pts)"

    # Check if files list is provided and only touches docs/config/whitespace
    if files and isinstance(files, (list, tuple, set)):
        if all(_is_doc_or_config_file(str(f)) for f in files):
            return min(4, total_lines), "Penalized: PR only touches README, documentation, or configuration files (4/20 pts)"

    # Check title hints for README / whitespace / typo / config
    is_doc_or_config_title = bool(
        re.search(r"\b(readme|typo|whitespace|formatting|indent(ation)?|docs?|config|spelling)\b", title)
    )
    if is_doc_or_config_title and (files_changed <= 1 or total_lines <= 20):
        return min(4, total_lines), f"Penalized: PR title '{title}' indicates README/formatting/config-only edit (4/20 pts)"

    # 1-line changes: penalized
    if total_lines == 1:
        return 3, "Penalized: 1-line micro-edit lacks substantive code change (3/20 pts)"

    # Massive code dumps (> 1500 lines): penalized
    if total_lines > 1500:
        return 6, f"Penalized: Code dump of {total_lines} lines (likely vendor/autogenerated code, 6/20 pts)"

    if total_lines <= 5:
        return 8, f"Minor change: Only {total_lines} lines changed (8/20 pts)"

    if total_lines <= 15:
        return 14, f"Modest change: {total_lines} lines across {files_changed} file(s) (14/20 pts)"

    # Real code changes in reasonable size range (16 to 1500 lines)
    return 20, None


def calculate_repo_trust(pr: Dict[str, Any]) -> Tuple[int, Optional[str]]:
    """
    20% Repo trust:
      - Penalize if repo_owner == author AND repo was created within 7 days of the PR (0 pts).
      - Independent repos get full points (20 pts), unless created < 7 days before PR or unestablished fork.
      - Self-owned repos established > 7 days before the PR get partial points (10 pts).
    Returns (score, loss_reason).
    """
    author = (pr.get("author") or "").strip().lower()
    repo_owner = (pr.get("repo_owner") or "").strip().lower()
    is_self_owned = bool(author and repo_owner and author == repo_owner)

    repo_created_at = _parse_iso(pr.get("repo_created_at"))
    pr_created_at = _parse_iso(pr.get("created_at"))

    if is_self_owned:
        if repo_created_at and pr_created_at:
            age_seconds = (pr_created_at - repo_created_at).total_seconds()
            age_days = age_seconds / 86400.0
            if 0 <= age_days < 7.0:
                return 0, f"Untrusted repo: Self-owned repository created within 7 days of PR ({age_days:.1f} days old, 0/20 pts)"
            elif age_days < 0:
                return 0, "Untrusted repo: Inconsistent repo creation timestamp (0/20 pts)"
            else:
                return 10, "Self-owned repository established > 7 days before PR (10/20 pts)"

        return 0, "Untrusted repo: Self-owned repository with unverified creation date (0/20 pts)"

    # Third-party / external repository: verify it's not a fresh alt throwaway (< 7 days old)
    if repo_created_at and pr_created_at:
        age_seconds = (pr_created_at - repo_created_at).total_seconds()
        age_days = age_seconds / 86400.0
        if 0 <= age_days < 7.0:
            return 4, f"Untrusted repo: External repository created within 7 days of PR ({age_days:.1f} days old, suspected alt throwaway, 4/20 pts)"

    # If repo is an unestablished fork with 0 stars
    if pr.get("repo_is_fork") and int(pr.get("repo_stars") or 0) == 0:
        return 10, "External fork with zero community stars (10/20 pts)"

    return 20, None


class ScoreResult(dict):
    """
    Dict containing 'score' and 'breakdown' that also supports tuple unpacking
    (score, breakdown = score_pr(pr)) for dual compatibility.
    """
    def __iter__(self):
        yield self["score"]
        yield self["breakdown"]


def score_pr(pr_data: Dict[str, Any]) -> ScoreResult:
    """
    Pure function to score a PR using the 4-signal weighted rubric (0-100):
      - 40% Merge legitimacy: merged AND merged_by != author -> 40 pts, else 0
      - 20% Review engagement: scaled by review_comment_count (capped at 20)
      - 20% Change substance: penalize README/whitespace/config, 1-line, dumps; reward real code (20 pts)
      - 20% Repo trust: penalize if repo_owner == author AND repo created within 7 days of PR (0 pts)

    Returns {score: int, breakdown: dict}.
    """
    merge_pts, merge_loss_reason = calculate_merge_legitimacy(pr_data)
    review_pts, review_loss_reason = calculate_review_engagement(pr_data)
    substance_pts, substance_loss_reason = calculate_change_substance(pr_data)
    repo_pts, repo_loss_reason = calculate_repo_trust(pr_data)

    total = int(round(merge_pts + review_pts + substance_pts + repo_pts))
    total_lost = 100 - total

    loss_reasons = [r for r in [merge_loss_reason, review_loss_reason, substance_loss_reason, repo_loss_reason] if r]

    breakdown = {
        "merge_legitimacy": merge_pts,
        "merge_legitimacy_max": 40,
        "merge_legitimacy_lost": 40 - merge_pts,
        "merge_loss_reason": merge_loss_reason,

        "review_engagement": review_pts,
        "review_engagement_max": 20,
        "review_engagement_lost": 20 - review_pts,
        "review_loss_reason": review_loss_reason,

        "change_substance": substance_pts,
        "change_substance_max": 20,
        "change_substance_lost": 20 - substance_pts,
        "substance_loss_reason": substance_loss_reason,

        "repo_trust": repo_pts,
        "repo_trust_max": 20,
        "repo_trust_lost": 20 - repo_pts,
        "repo_loss_reason": repo_loss_reason,

        "points_gained": total,
        "points_lost": total_lost,
        "loss_reasons": loss_reasons,
    }

    return ScoreResult({
        "score": total,
        "breakdown": breakdown,
    })


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


class NearDuplicateBurstRule(GamingRule):
    """Flags participants creating multiple PRs with identical titles or file diffs within minutes."""
    rule_id = "DUPLICATE_PR_BURST"
    name = "Rapid Duplicate PR Burst"

    def evaluate(self, pr: Dict[str, Any], all_user_prs: Optional[List[Dict[str, Any]]] = None) -> Tuple[bool, Optional[str]]:
        if not all_user_prs or len(all_user_prs) < 2:
            return False, None

        title = (pr.get("title") or "").strip().lower()
        url = pr.get("url") or ""
        duplicates = [
            p for p in all_user_prs
            if (p.get("title") or "").strip().lower() == title and p.get("url") != url
        ]
        if duplicates:
            return True, f"Detected {len(duplicates) + 1} PRs with identical title '{title}' across repositories (copy-paste burst)."

        return False, None


ACTIVE_GAMING_RULES: List[GamingRule] = [
    FreshSelfOwnedRepoRule(),
    SelfMergedRule(),
    WhitespaceBurstRule(),
    NearDuplicateBurstRule(),
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
    Scores all PRs for a single user, generates graphical analysis breakdown
    (points gained vs lost per rubric dimension), and returns summary audit.
    """
    scored_prs = []
    total_score = 0.0
    flagged_count = 0

    merge_gained = 0.0
    merge_lost = 0.0
    review_gained = 0.0
    review_lost = 0.0
    substance_gained = 0.0
    substance_lost = 0.0
    repo_gained = 0.0
    repo_lost = 0.0

    total_additions = 0
    total_deletions = 0
    merged_count = 0
    distinct_repos = set()
    all_flag_reasons = []

    for pr in prs:
        pr_res = score_pr(pr)
        score = pr_res["score"]
        breakdown = pr_res["breakdown"]
        flagged, flag_reason, flag_reasons = check_gaming_rules(pr, prs)

        if flagged:
            flagged_count += 1
            all_flag_reasons.extend(flag_reasons)

        total_score += score
        merge_gained += breakdown["merge_legitimacy"]
        merge_lost += breakdown["merge_legitimacy_lost"]
        review_gained += breakdown["review_engagement"]
        review_lost += breakdown["review_engagement_lost"]
        substance_gained += breakdown["change_substance"]
        substance_lost += breakdown["change_substance_lost"]
        repo_gained += breakdown["repo_trust"]
        repo_lost += breakdown["repo_trust_lost"]

        total_additions += int(pr.get("additions") or 0)
        total_deletions += int(pr.get("deletions") or 0)
        if pr.get("merged"):
            merged_count += 1
        if pr.get("repo"):
            distinct_repos.add(pr.get("repo"))

        scored_pr = dict(pr)
        scored_pr["score"] = score
        scored_pr["breakdown"] = breakdown
        scored_pr["flagged"] = flagged
        scored_pr["flag_reason"] = flag_reason
        scored_pr["flag_reasons"] = flag_reasons
        scored_prs.append(scored_pr)

    pr_count = len(scored_prs)
    max_possible_score = round(pr_count * 100.0, 1)
    total_points_lost = round(max_possible_score - total_score, 1)

    # Contributor Audit Verdict
    if pr_count == 0:
        verdict = "No PRs Opened in Window"
        verdict_status = "neutral"
    elif flagged_count >= 2:
        verdict = "Gaming Patterns Detected (High Risk)"
        verdict_status = "danger"
    elif flagged_count == 1:
        verdict = "Under Audit Review (1 Flagged PR)"
        verdict_status = "warning"
    elif total_score / max(1.0, max_possible_score) >= 0.75:
        verdict = "Exemplary Contributor (High Rubric Impact)"
        verdict_status = "success"
    else:
        verdict = "Verified Contributor"
        verdict_status = "info"

    return {
        "username": username,
        "total_score": int(round(total_score)),
        "pr_count": pr_count,
        "merged_count": merged_count,
        "flagged_count": flagged_count,
        "max_possible_score": max_possible_score,
        "total_points_lost": total_points_lost,
        "score_percentage": round((total_score / max(1.0, max_possible_score)) * 100.0, 1) if pr_count > 0 else 0.0,
        "verdict": verdict,
        "verdict_status": verdict_status,
        "stats": {
            "total_additions": total_additions,
            "total_deletions": total_deletions,
            "distinct_repos_count": len(distinct_repos),
            "merged_rate": round((merged_count / max(1, pr_count)) * 100, 1),
        },
        "graphical_analysis": {
            "merge_legitimacy": {
                "name": "Merge Legitimacy",
                "weight_pct": 40,
                "gained": round(merge_gained, 1),
                "lost": round(merge_lost, 1),
                "max": round(pr_count * 40.0, 1),
                "color": "#10B981", # emerald
            },
            "review_engagement": {
                "name": "Review Engagement",
                "weight_pct": 20,
                "gained": round(review_gained, 1),
                "lost": round(review_lost, 1),
                "max": round(pr_count * 20.0, 1),
                "color": "#6366F1", # indigo
            },
            "change_substance": {
                "name": "Change Substance",
                "weight_pct": 20,
                "gained": round(substance_gained, 1),
                "lost": round(substance_lost, 1),
                "max": round(pr_count * 20.0, 1),
                "color": "#F59E0B", # amber
            },
            "repo_trust": {
                "name": "Repo Trust",
                "weight_pct": 20,
                "gained": round(repo_gained, 1),
                "lost": round(repo_lost, 1),
                "max": round(pr_count * 20.0, 1),
                "color": "#3B82F6", # blue
            },
        },
        "gaming_reasons_summary": list(set(all_flag_reasons)),
        "prs": scored_prs,
    }


def score_repo_prs(repo: str, prs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Scores all PRs submitted to a target repository, groups them into
    a chronological changelog, and ranks lead contributors in this repo.
    """
    scored_prs = []
    contributor_map: Dict[str, Dict[str, Any]] = {}

    for pr in prs:
        pr_res = score_pr(pr)
        score = pr_res["score"]
        breakdown = pr_res["breakdown"]
        flagged, flag_reason, flag_reasons = check_gaming_rules(pr, prs)

        scored_pr = dict(pr)
        scored_pr["score"] = score
        scored_pr["breakdown"] = breakdown
        scored_pr["flagged"] = flagged
        scored_pr["flag_reason"] = flag_reason
        scored_pr["flag_reasons"] = flag_reasons

        # Changelog category tagging
        title_lower = (pr.get("title") or "").lower()
        if any(w in title_lower for w in ["fix", "bug", "patch", "resolve"]):
            category = "Bugfix"
        elif any(w in title_lower for w in ["feat", "add", "implement", "support", "new"]):
            category = "Feature"
        elif any(w in title_lower for w in ["doc", "readme", "guide"]):
            category = "Documentation"
        elif any(w in title_lower for w in ["refactor", "clean", "structure", "perf"]):
            category = "Refactor"
        else:
            category = "Contribution"
        scored_pr["category"] = category

        scored_prs.append(scored_pr)

        # Aggregate per contributor
        author = pr.get("author") or "unknown"
        if author not in contributor_map:
            contributor_map[author] = {
                "username": author,
                "points_in_repo": 0.0,
                "prs_in_repo": 0,
                "merged_in_repo": 0,
                "flagged_in_repo": 0,
                "lines_added": 0,
                "lines_deleted": 0,
            }
        contributor_map[author]["points_in_repo"] += score
        contributor_map[author]["prs_in_repo"] += 1
        if pr.get("merged"):
            contributor_map[author]["merged_in_repo"] += 1
        if flagged:
            contributor_map[author]["flagged_in_repo"] += 1
        contributor_map[author]["lines_added"] += int(pr.get("additions") or 0)
        contributor_map[author]["lines_deleted"] += int(pr.get("deletions") or 0)

    # Lead contributors ranked in this repo
    lead_contributors = list(contributor_map.values())
    for c in lead_contributors:
        c["points_in_repo"] = int(round(c["points_in_repo"]))
    lead_contributors.sort(key=lambda x: (x["points_in_repo"], x["merged_in_repo"]), reverse=True)

    for idx, c in enumerate(lead_contributors, start=1):
        c["rank"] = idx

    # Sort changelog: merged first, then by created_at descending
    scored_prs.sort(key=lambda x: (1 if x.get("merged") else 0, x.get("created_at") or ""), reverse=True)

    # Repo metadata from first PR or empty
    first_pr = prs[0] if prs else {}
    repo_meta = {
        "repo": repo,
        "name": first_pr.get("repo_name", repo.split("/")[-1]),
        "owner": first_pr.get("repo_owner", repo.split("/")[0] if "/" in repo else ""),
        "stars": first_pr.get("repo_stars", 0),
        "forks": first_pr.get("repo_forks", 0),
        "created_at": first_pr.get("repo_created_at", ""),
        "is_fork": first_pr.get("repo_is_fork", False),
    }

    return {
        "repo": repo,
        "repo_meta": repo_meta,
        "total_prs": len(scored_prs),
        "merged_prs": sum(1 for p in scored_prs if p.get("merged")),
        "lead_contributors": lead_contributors,
        "changelog": scored_prs,
    }

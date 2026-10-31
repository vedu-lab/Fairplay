"""
Unit tests for FairPlay scoring engine and anti-gaming rules.
Covers:
  - Clean merged PR (high score)
  - Self-merged PR (low score)
  - Whitespace-only PR (low score)
  - Individual gaming rules (FreshSelfOwnedRepoRule, SelfMergedRule, WhitespaceBurstRule, NearDuplicateBurstRule)
  - Aggregate gaming rules checking (check_gaming_rules)
  - ScoreResult dual interface (dict access and tuple unpacking)
"""

import pytest
from typing import Any, Dict, List
from app.scoring import (
    score_pr,
    check_gaming_rules,
    calculate_merge_legitimacy,
    calculate_review_engagement,
    calculate_change_substance,
    calculate_repo_trust,
    FreshSelfOwnedRepoRule,
    SelfMergedRule,
    WhitespaceBurstRule,
    NearDuplicateBurstRule,
    ScoreResult,
)


# ═══════════════════════════════════════════════════════════════════════
# FIXTURES
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture
def clean_merged_pr() -> Dict[str, Any]:
    """
    Crafted fixture representing an ideal, legitimate contribution:
    - Merged into an independent established repository by a maintainer
    - Substantive code changes across multiple files
    - Active review engagement
    """
    return {
        "number": 101,
        "title": "feat: optimize database connection pooling",
        "url": "https://github.com/organization/core-service/pull/101",
        "author": "alice_dev",
        "merged": True,
        "merged_at": "2026-10-15T14:30:00Z",
        "merged_by": "maintainer_bob",
        "created_at": "2026-10-14T10:00:00Z",
        "review_comment_count": 6,
        "files_changed": 4,
        "additions": 145,
        "deletions": 38,
        "files": ["src/db/pool.py", "src/db/connection.py", "tests/test_pool.py"],
        "repo": "organization/core-service",
        "repo_name": "core-service",
        "repo_owner": "organization",
        "repo_created_at": "2024-01-15T00:00:00Z",
        "repo_is_fork": False,
    }


@pytest.fixture
def self_merged_pr() -> Dict[str, Any]:
    """
    Crafted fixture representing a self-merged PR:
    - Merged by the author themselves without independent maintainer review
    """
    return {
        "number": 12,
        "title": "feat: add quick utility function",
        "url": "https://github.com/alice_dev/utility-lib/pull/12",
        "author": "alice_dev",
        "merged": True,
        "merged_at": "2026-10-16T18:00:00Z",
        "merged_by": "alice_dev",  # Self-merged!
        "created_at": "2026-10-16T17:00:00Z",
        "review_comment_count": 0,
        "files_changed": 1,
        "additions": 25,
        "deletions": 0,
        "files": ["utils.py"],
        "repo": "alice_dev/utility-lib",
        "repo_name": "utility-lib",
        "repo_owner": "alice_dev",
        "repo_created_at": "2026-05-01T00:00:00Z",
        "repo_is_fork": False,
    }


@pytest.fixture
def whitespace_only_pr() -> Dict[str, Any]:
    """
    Crafted fixture representing a trivial whitespace / typo padding PR:
    - Only touches 1 file with 1-2 lines of change
    - Title indicates formatting or typo
    """
    return {
        "number": 5,
        "title": "docs: fix typo in README",
        "url": "https://github.com/organization/docs-site/pull/5",
        "author": "alice_dev",
        "merged": True,
        "merged_at": "2026-10-18T12:00:00Z",
        "merged_by": "maintainer_bob",
        "created_at": "2026-10-18T11:00:00Z",
        "review_comment_count": 0,
        "files_changed": 1,
        "additions": 1,
        "deletions": 1,
        "files": ["README.md"],
        "repo": "organization/docs-site",
        "repo_name": "docs-site",
        "repo_owner": "organization",
        "repo_created_at": "2025-06-01T00:00:00Z",
        "repo_is_fork": False,
    }


@pytest.fixture
def fresh_self_owned_repo_pr() -> Dict[str, Any]:
    """
    Crafted fixture representing a PR in a throwaway repo:
    - Author owns the repository
    - Repository was created only 1 day before opening the PR
    """
    return {
        "number": 1,
        "title": "feat: initial commit and quick patch",
        "url": "https://github.com/throwaway_user/hackathon-farm/pull/1",
        "author": "throwaway_user",
        "merged": True,
        "merged_at": "2026-10-21T12:00:00Z",
        "merged_by": "throwaway_user",
        "created_at": "2026-10-21T10:00:00Z",  # PR opened 2026-10-21
        "review_comment_count": 0,
        "files_changed": 2,
        "additions": 50,
        "deletions": 5,
        "files": ["app.py", "README.md"],
        "repo": "throwaway_user/hackathon-farm",
        "repo_name": "hackathon-farm",
        "repo_owner": "throwaway_user",
        "repo_created_at": "2026-10-20T10:00:00Z",  # Repo created 1 day earlier!
        "repo_is_fork": False,
    }


# ═══════════════════════════════════════════════════════════════════════
# SCORE_PR() TESTS
# ═══════════════════════════════════════════════════════════════════════

def test_clean_merged_pr_high_score(clean_merged_pr):
    """
    Clean merged PR should receive full or near-perfect score:
    - 40/40 Merge Legitimacy (independent maintainer merged)
    - 20/20 Review Engagement (6 comments >= 5 cap)
    - 20/20 Change Substance (183 lines changed in real code)
    - 20/20 Repo Trust (independent organization repo)
    Total: 100/100 points
    """
    res = score_pr(clean_merged_pr)
    score = res["score"]
    breakdown = res["breakdown"]

    assert score == 100
    assert breakdown["merge_legitimacy"] == 40
    assert breakdown["merge_legitimacy_lost"] == 0
    assert breakdown["review_engagement"] == 20
    assert breakdown["change_substance"] == 20
    assert breakdown["repo_trust"] == 20
    assert breakdown["points_gained"] == 100
    assert breakdown["points_lost"] == 0
    assert len(breakdown["loss_reasons"]) == 0

    # Ensure no gaming rules trigger on a clean contribution
    flagged, flag_reason, reasons = check_gaming_rules(clean_merged_pr)
    assert not flagged
    assert flag_reason is None
    assert len(reasons) == 0


def test_self_merged_pr_low_score(self_merged_pr):
    """
    Self-merged PR must lose all 40 merge legitimacy points.
    Even with valid code changes, the score is heavily capped.
    """
    res = score_pr(self_merged_pr)
    score = res["score"]
    breakdown = res["breakdown"]

    # Merge legitimacy must be 0
    assert breakdown["merge_legitimacy"] == 0
    assert breakdown["merge_legitimacy_lost"] == 40
    assert "Self-merged" in breakdown["merge_loss_reason"]

    # Score should be significantly penalized (<= 50)
    assert score <= 50

    # Self-merged rule must flag this PR
    rule = SelfMergedRule()
    triggered, reason = rule.evaluate(self_merged_pr)
    assert triggered
    assert "merged by the author themselves" in reason


def test_whitespace_only_pr_low_score(whitespace_only_pr):
    """
    Whitespace / README trivial typo edit should lose substance points:
    - Change substance is capped at minimal points (<= 4/20)
    - Overall score is significantly lowered
    """
    res = score_pr(whitespace_only_pr)
    score = res["score"]
    breakdown = res["breakdown"]

    # Substance score heavily penalized
    assert breakdown["change_substance"] <= 4
    assert breakdown["change_substance_lost"] >= 16
    assert "Penalized" in breakdown["substance_loss_reason"]

    # Whitespace burst gaming rule must trigger on <= 2 lines in 1 file
    rule = WhitespaceBurstRule()
    triggered, reason = rule.evaluate(whitespace_only_pr)
    assert triggered
    assert "Trivial diff" in reason


def test_unmerged_or_closed_pr_scores_zero_merge_pts():
    """An open or closed unmerged PR receives 0 merge legitimacy points."""
    unmerged_pr = {
        "title": "WIP: open pull request",
        "author": "bob",
        "merged": False,
        "merged_by": None,
        "review_comment_count": 3,
        "files_changed": 2,
        "additions": 45,
        "deletions": 10,
        "repo_owner": "org",
    }
    pts, reason = calculate_merge_legitimacy(unmerged_pr)
    assert pts == 0
    assert "remains open or was closed unmerged" in reason


def test_large_code_dump_is_penalized():
    """PRs exceeding 1500 lines are penalized as vendor or auto-generated dumps."""
    dump_pr = {
        "title": "feat: import large SDK and binaries",
        "author": "developer",
        "merged": True,
        "merged_by": "maintainer",
        "review_comment_count": 2,
        "files_changed": 30,
        "additions": 4200,
        "deletions": 800,
        "repo_owner": "org",
    }
    pts, reason = calculate_change_substance(dump_pr)
    assert pts == 6
    assert "Code dump" in reason


# ═══════════════════════════════════════════════════════════════════════
# GAMING RULES TESTS
# ═══════════════════════════════════════════════════════════════════════

def test_gaming_rule_fresh_self_owned_repo(fresh_self_owned_repo_pr):
    """
    FreshSelfOwnedRepoRule should trigger when:
    - PR author == repository owner
    - Repository was created <= 7 days before opening the PR
    """
    rule = FreshSelfOwnedRepoRule()
    triggered, reason = rule.evaluate(fresh_self_owned_repo_pr)

    assert triggered
    assert "Self-owned repo" in reason
    assert "throwaway repo gaming pattern" in reason

    # Repo trust should be 0 points
    repo_pts, repo_reason = calculate_repo_trust(fresh_self_owned_repo_pr)
    assert repo_pts == 0
    assert "Untrusted repo" in repo_reason


def test_gaming_rule_established_self_owned_repo_partial_trust():
    """
    Self-owned repositories created > 7 days before the PR
    receive partial trust (10 pts) and are NOT flagged as fresh throwaways.
    """
    pr = {
        "author": "developer_alice",
        "repo_owner": "developer_alice",
        "repo_created_at": "2026-01-01T00:00:00Z",
        "created_at": "2026-06-01T00:00:00Z",  # 151 days later
    }
    rule = FreshSelfOwnedRepoRule()
    triggered, reason = rule.evaluate(pr)
    assert not triggered
    assert reason is None

    pts, reason = calculate_repo_trust(pr)
    assert pts == 10
    assert "established > 7 days" in reason


def test_gaming_rule_self_merged(self_merged_pr):
    """
    SelfMergedRule should trigger when author == merged_by.
    """
    rule = SelfMergedRule()
    triggered, reason = rule.evaluate(self_merged_pr)

    assert triggered
    assert "merged by the author themselves" in reason


def test_gaming_rule_self_merged_not_triggered_on_independent_merge(clean_merged_pr):
    """SelfMergedRule must not trigger when merged by an independent account."""
    rule = SelfMergedRule()
    triggered, reason = rule.evaluate(clean_merged_pr)

    assert not triggered
    assert reason is None


def test_gaming_rule_whitespace_burst(whitespace_only_pr):
    """
    WhitespaceBurstRule triggers on 1 file changed with <= 2 lines of diff.
    """
    rule = WhitespaceBurstRule()
    triggered, reason = rule.evaluate(whitespace_only_pr)

    assert triggered
    assert "Trivial diff" in reason
    assert "suspected typo or whitespace padding" in reason


def test_gaming_rule_whitespace_burst_not_triggered_on_multi_file():
    """Multi-file or larger PRs do not trigger whitespace burst rule."""
    pr = {
        "files_changed": 2,
        "additions": 1,
        "deletions": 1,
    }
    rule = WhitespaceBurstRule()
    triggered, reason = rule.evaluate(pr)
    assert not triggered


def test_gaming_rule_duplicate_pr_burst():
    """
    NearDuplicateBurstRule triggers when a user submits multiple PRs
    with the exact same title across different URLs.
    """
    pr1 = {
        "title": "Fix typo in readme documentation",
        "url": "https://github.com/repo1/lib/pull/1",
        "additions": 1,
        "deletions": 1,
    }
    pr2 = {
        "title": "Fix typo in readme documentation",
        "url": "https://github.com/repo2/lib/pull/4",
        "additions": 1,
        "deletions": 1,
    }
    all_user_prs = [pr1, pr2]

    rule = NearDuplicateBurstRule()
    triggered, reason = rule.evaluate(pr1, all_user_prs=all_user_prs)

    assert triggered
    assert "Detected 2 PRs with identical title" in reason
    assert "copy-paste burst" in reason


def test_gaming_rule_duplicate_pr_burst_not_triggered_on_unique_titles():
    """Distinct PR titles do not trigger duplicate burst rule."""
    pr1 = {"title": "Fix bug in login", "url": "https://github.com/repo1/lib/pull/1"}
    pr2 = {"title": "Implement signup flow", "url": "https://github.com/repo2/lib/pull/2"}
    all_user_prs = [pr1, pr2]

    rule = NearDuplicateBurstRule()
    triggered, reason = rule.evaluate(pr1, all_user_prs=all_user_prs)
    assert not triggered
    assert reason is None


def test_check_gaming_rules_aggregation(fresh_self_owned_repo_pr):
    """
    check_gaming_rules should evaluate all active rules and return
    (is_flagged, combined_reasons_str, reasons_list).
    fresh_self_owned_repo_pr triggers both FreshSelfOwnedRepoRule and SelfMergedRule.
    """
    is_flagged, combined, reasons = check_gaming_rules(fresh_self_owned_repo_pr)

    assert is_flagged
    assert len(reasons) >= 2
    assert "Self-owned repo" in combined
    assert "merged by the author themselves" in combined


# ═══════════════════════════════════════════════════════════════════════
# SCORERESULT INTERFACE TEST
# ═══════════════════════════════════════════════════════════════════════

def test_score_result_dual_compatibility(clean_merged_pr):
    """
    ScoreResult must allow both:
    1. Dict key access: res["score"] and res["breakdown"]
    2. Tuple unpacking: score, breakdown = score_pr(pr)
    """
    res = score_pr(clean_merged_pr)

    # 1. Dict key access
    assert isinstance(res, dict)
    assert "score" in res
    assert "breakdown" in res
    assert res["score"] == 100

    # 2. Tuple unpacking
    score, breakdown = score_pr(clean_merged_pr)
    assert score == 100
    assert isinstance(breakdown, dict)
    assert breakdown["merge_legitimacy"] == 40


def test_sockpuppet_merge_in_self_owned_repo_scores_zero():
    """
    If author owns the repo, even if merged by another account (alt/bot),
    it must receive 0 merge legitimacy points.
    """
    sockpuppet_pr = {
        "author": "bob",
        "repo_owner": "bob",
        "merged": True,
        "merged_by": "alice_alt",  # Alt account merges author's personal repo
    }
    pts, reason = calculate_merge_legitimacy(sockpuppet_pr)
    assert pts == 0
    assert "Self-owned repo merge" in reason


def test_rest_fallback_external_merge_scores_full_points():
    """
    If merged into an independent repository but merged_by is absent (REST fallback),
    award full 40 merge legitimacy points.
    """
    rest_pr = {
        "author": "alice",
        "repo_owner": "facebook",
        "merged": True,
        "merged_by": None,  # REST search does not provide merged_by
    }
    pts, reason = calculate_merge_legitimacy(rest_pr)
    assert pts == 40
    assert reason is None


def test_external_fresh_throwaway_repo_penalized():
    """
    External repositories created < 7 days before the PR (suspected alt throwaway)
    must receive reduced trust score.
    """
    fresh_ext_pr = {
        "author": "bob",
        "repo_owner": "bob_alt",
        "created_at": "2026-10-20T12:00:00Z",
        "repo_created_at": "2026-10-19T12:00:00Z",  # 1 day old!
    }
    pts, reason = calculate_repo_trust(fresh_ext_pr)
    assert pts == 4
    assert "suspected alt throwaway" in reason


def test_unestablished_fork_penalized():
    """
    Forks with 0 stars must receive reduced repo trust score.
    """
    fork_pr = {
        "author": "alice",
        "repo_owner": "someone_else",
        "repo_is_fork": True,
        "repo_stars": 0,
        "created_at": "2026-10-20T12:00:00Z",
        "repo_created_at": "2025-01-01T00:00:00Z",
    }
    pts, reason = calculate_repo_trust(fork_pr)
    assert pts == 10
    assert "External fork with zero community stars" in reason


"""
GitHub GraphQL client (with REST fallback) for fetching user and repository
pull requests and associated review, change, and repository metadata.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx
from .config import settings

logger = logging.getLogger(__name__)

GRAPHQL_URL = "https://api.github.com/graphql"
REST_SEARCH_URL = "https://api.github.com/search/issues"

GRAPHQL_PR_SEARCH_QUERY = """
query($queryStr: String!, $cursor: String) {
  search(query: $queryStr, type: ISSUE, first: 50, after: $cursor) {
    issueCount
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on PullRequest {
        number
        title
        url
        createdAt
        merged
        mergedAt
        mergedBy {
          login
        }
        author {
          login
        }
        comments {
          totalCount
        }
        reviews {
          totalCount
        }
        additions
        deletions
        changedFiles
        repository {
          name
          owner {
            login
          }
          createdAt
          isFork
          stargazerCount
          forkCount
        }
      }
    }
  }
}
"""


def _check_rate_limit(headers: httpx.Headers) -> None:
    """Reads X-RateLimit-Remaining from response headers and logs a warning if below 100."""
    remaining_header = headers.get("X-RateLimit-Remaining")
    if remaining_header is not None:
        try:
            remaining = int(remaining_header)
            if remaining < 100:
                logger.warning(
                    "GitHub API rate limit remaining is low: %d (X-RateLimit-Remaining < 100)",
                    remaining,
                )
        except (ValueError, TypeError):
            pass


def get_headers(custom_token: Optional[str] = None) -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "FairPlay-AntiGaming-Auditor",
    }
    clean_custom = settings.sanitize_github_token(custom_token)
    token = clean_custom if clean_custom and clean_custom != "default" else settings.GITHUB_TOKEN
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def verify_github_token(token: Optional[str] = None) -> Dict[str, Any]:
    """
    Verifies a GitHub Personal Access Token and retrieves authenticated user
    profile and current API rate limits.
    """
    clean_token = settings.sanitize_github_token(token)
    effective_token = clean_token if clean_token and clean_token != "default" else settings.GITHUB_TOKEN
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "FairPlay-AntiGaming-Auditor",
    }
    if effective_token:
        headers["Authorization"] = f"Bearer {effective_token}"


    async with httpx.AsyncClient(headers=headers, timeout=12.0) as client:
        try:
            # 1. Fetch user profile
            user_resp = await client.get("https://api.github.com/user")
            _check_rate_limit(user_resp.headers)
            # 2. Fetch rate limit status
            rate_resp = await client.get("https://api.github.com/rate_limit")
            _check_rate_limit(rate_resp.headers)

            if user_resp.status_code == 200:
                user_data = user_resp.json()
                rate_data = rate_resp.json() if rate_resp.status_code == 200 else {}
                core = rate_data.get("resources", {}).get("core", {})
                graphql = rate_data.get("resources", {}).get("graphql", {})

                return {
                    "valid": True,
                    "token_type": "custom" if token and token != "default" else "server_default",
                    "user": {
                        "login": user_data.get("login", ""),
                        "name": user_data.get("name", user_data.get("login", "")),
                        "avatar_url": user_data.get("avatar_url", ""),
                        "html_url": user_data.get("html_url", ""),
                        "public_repos": user_data.get("public_repos", 0),
                    },
                    "rate_limit": {
                        "core_limit": core.get("limit", 5000),
                        "core_remaining": core.get("remaining", 5000),
                        "graphql_limit": graphql.get("limit", 5000),
                        "graphql_remaining": graphql.get("remaining", 5000),
                    },
                }
            elif user_resp.status_code == 401:
                return {
                    "valid": False,
                    "error": "Invalid GitHub Token. Please check that your token starts with ghp_ or github_pat_ and has read permissions.",
                }
            else:
                return {
                    "valid": False,
                    "error": f"GitHub API responded with status {user_resp.status_code}: {user_resp.text}",
                }
        except Exception as exc:
            return {
                "valid": False,
                "error": f"Failed to reach GitHub API: {str(exc)}",
            }


def _build_search_query(username: str, since: Optional[str] = None, until: Optional[str] = None) -> str:
    parts = ["is:pr", f"author:{username.strip()}"]
    if since and until:
        parts.append(f"created:{since.strip()}..{until.strip()}")
    elif since:
        parts.append(f"created:>={since.strip()}")
    elif until:
        parts.append(f"created:<={until.strip()}")
    return " ".join(parts)


def _build_repo_search_query(repo: str, since: Optional[str] = None, until: Optional[str] = None) -> str:
    clean_repo = repo.strip()
    parts = ["is:pr", f"repo:{clean_repo}"]
    if since and until:
        parts.append(f"created:{since.strip()}..{until.strip()}")
    elif since:
        parts.append(f"created:>={since.strip()}")
    elif until:
        parts.append(f"created:<={until.strip()}")
    return " ".join(parts)


def _normalize_node(node: Dict[str, Any], default_author: str = "") -> Dict[str, Any]:
    author_obj = node.get("author") or {}
    author_login = author_obj.get("login") or default_author

    merged_by_obj = node.get("mergedBy") or {}
    merged_by_login = merged_by_obj.get("login")

    repo_obj = node.get("repository") or {}
    repo_owner_obj = repo_obj.get("owner") or {}
    repo_owner = repo_owner_obj.get("login", "")
    repo_name = repo_obj.get("name", "")

    comments_obj = node.get("comments") or {}
    reviews_obj = node.get("reviews") or {}
    comment_count = comments_obj.get("totalCount", 0)
    review_count = reviews_obj.get("totalCount", 0)

    return {
        "number": node.get("number", 0),
        "title": node.get("title", ""),
        "url": node.get("url", ""),
        "created_at": node.get("createdAt", ""),
        "merged": bool(node.get("merged", False)),
        "merged_at": node.get("mergedAt"),
        "merged_by": merged_by_login,
        "author": author_login,
        "review_comment_count": comment_count + review_count,
        "comment_count": comment_count,
        "review_count": review_count,
        "additions": node.get("additions", 0),
        "deletions": node.get("deletions", 0),
        "files_changed": node.get("changedFiles", 0),
        "repo": f"{repo_owner}/{repo_name}" if repo_owner and repo_name else repo_name,
        "repo_name": repo_name,
        "repo_owner": repo_owner,
        "repo_created_at": repo_obj.get("createdAt", ""),
        "repo_is_fork": bool(repo_obj.get("isFork", False)),
        "repo_stars": repo_obj.get("stargazerCount", 0),
        "repo_forks": repo_obj.get("forkCount", 0),
    }


async def _fetch_via_rest_fallback(
    client: httpx.AsyncClient, query_str: str, default_author: str = ""
) -> List[Dict[str, Any]]:
    """Fallback to GitHub REST v3 search if GraphQL fails."""
    response = await client.get(REST_SEARCH_URL, params={"q": query_str, "per_page": 50})
    _check_rate_limit(response.headers)
    response.raise_for_status()
    payload = response.json()
    items = payload.get("items", [])

    results = []
    for item in items:
        pr_url = item.get("html_url", "")
        repo_api_url = item.get("repository_url", "")
        repo_parts = repo_api_url.rstrip("/").split("/")
        repo_name = repo_parts[-1] if len(repo_parts) >= 1 else ""
        repo_owner = repo_parts[-2] if len(repo_parts) >= 2 else ""

        user_obj = item.get("user") or {}
        author = user_obj.get("login") or default_author

        is_merged = bool(item.get("pull_request", {}).get("merged_at"))

        results.append({
            "number": item.get("number", 0),
            "title": item.get("title", ""),
            "url": pr_url,
            "created_at": item.get("created_at", ""),
            "merged": is_merged,
            "merged_at": item.get("pull_request", {}).get("merged_at"),
            "merged_by": None,
            "author": author,
            "review_comment_count": item.get("comments", 0),
            "comment_count": item.get("comments", 0),
            "review_count": 0,
            "additions": 0,
            "deletions": 0,
            "files_changed": 0,
            "repo": f"{repo_owner}/{repo_name}" if repo_owner and repo_name else repo_name,
            "repo_name": repo_name,
            "repo_owner": repo_owner,
            "repo_created_at": "",
            "repo_is_fork": False,
            "repo_stars": 0,
            "repo_forks": 0,
        })
    return results


async def fetch_user_prs(
    username: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch all PRs opened by a user in the specified date range.
    Uses GitHub GraphQL v4 as primary; falls back to REST v3 if needed.
    """
    clean_user = username.strip()
    if not clean_user:
        return []

    headers = get_headers(token)
    search_query = _build_search_query(clean_user, since, until)
    all_prs: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(headers=headers, timeout=25.0) as client:
        try:
            cursor: Optional[str] = None
            has_next = True

            while has_next and len(all_prs) < 100:
                variables: Dict[str, Any] = {"queryStr": search_query, "cursor": cursor}
                resp = await client.post(
                    GRAPHQL_URL,
                    json={"query": GRAPHQL_PR_SEARCH_QUERY, "variables": variables},
                )
                _check_rate_limit(resp.headers)

                if resp.status_code != 200:
                    logger.warning(
                        "GraphQL returned %d for %s. Falling back to REST.",
                        resp.status_code,
                        clean_user,
                    )
                    return await _fetch_via_rest_fallback(client, search_query, clean_user)

                data = resp.json()
                if "errors" in data and not data.get("data"):
                    logger.warning("GraphQL returned errors: %s. Falling back to REST.", data["errors"])
                    return await _fetch_via_rest_fallback(client, search_query, clean_user)

                search_data = data.get("data", {}).get("search", {})
                nodes = search_data.get("nodes", [])

                for node in nodes:
                    if node:
                        all_prs.append(_normalize_node(node, clean_user))

                page_info = search_data.get("pageInfo", {})
                has_next = page_info.get("hasNextPage", False)
                cursor = page_info.get("endCursor")

                if not cursor:
                    break

            return all_prs

        except Exception as exc:
            logger.error("Error in GraphQL fetch for %s: %s. Attempting REST fallback.", clean_user, exc)
            try:
                return await _fetch_via_rest_fallback(client, search_query, clean_user)
            except Exception as rest_exc:
                logger.error("REST fallback also failed for %s: %s", clean_user, rest_exc)
                return []


async def fetch_repo_prs(
    repo: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch all PRs submitted to a target repository in the specified date range.
    """
    clean_repo = repo.strip()
    if not clean_repo:
        return []

    headers = get_headers(token)
    search_query = _build_repo_search_query(clean_repo, since, until)
    all_prs: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(headers=headers, timeout=25.0) as client:
        try:
            cursor: Optional[str] = None
            has_next = True

            while has_next and len(all_prs) < 100:
                variables: Dict[str, Any] = {"queryStr": search_query, "cursor": cursor}
                resp = await client.post(
                    GRAPHQL_URL,
                    json={"query": GRAPHQL_PR_SEARCH_QUERY, "variables": variables},
                )
                _check_rate_limit(resp.headers)

                if resp.status_code != 200:
                    logger.warning(
                        "GraphQL returned %d for repo %s. Falling back to REST.",
                        resp.status_code,
                        clean_repo,
                    )
                    return await _fetch_via_rest_fallback(client, search_query)

                data = resp.json()
                if "errors" in data and not data.get("data"):
                    logger.warning("GraphQL returned errors: %s. Falling back to REST.", data["errors"])
                    return await _fetch_via_rest_fallback(client, search_query)

                search_data = data.get("data", {}).get("search", {})
                nodes = search_data.get("nodes", [])

                for node in nodes:
                    if node:
                        all_prs.append(_normalize_node(node))

                page_info = search_data.get("pageInfo", {})
                has_next = page_info.get("hasNextPage", False)
                cursor = page_info.get("endCursor")

                if not cursor:
                    break

            return all_prs

        except Exception as exc:
            logger.error("Error in GraphQL fetch for repo %s: %s. Attempting REST fallback.", clean_repo, exc)
            try:
                return await _fetch_via_rest_fallback(client, search_query)
            except Exception as rest_exc:
                logger.error("REST fallback also failed for repo %s: %s", clean_repo, rest_exc)
                return []

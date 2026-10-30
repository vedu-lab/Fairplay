"""
GitHub GraphQL client (with REST fallback) for fetching user pull requests
and associated review, change, and repository metadata.
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


def _build_search_query(username: str, since: Optional[str] = None, until: Optional[str] = None) -> str:
    parts = ["is:pr", f"author:{username.strip()}"]
    if since and until:
        parts.append(f"created:{since.strip()}..{until.strip()}")
    elif since:
        parts.append(f"created:>={since.strip()}")
    elif until:
        parts.append(f"created:<={until.strip()}")
    return " ".join(parts)


def _normalize_node(node: Dict[str, Any], default_author: str) -> Dict[str, Any]:
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
    client: httpx.AsyncClient, username: str, since: Optional[str] = None, until: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Fallback to GitHub REST v3 search if GraphQL fails."""
    q = _build_search_query(username, since, until)
    response = await client.get(REST_SEARCH_URL, params={"q": q, "per_page": 50})
    response.raise_for_status()
    payload = response.json()
    items = payload.get("items", [])

    results = []
    for item in items:
        # Pull Request details from REST search
        pr_url = item.get("html_url", "")
        # Format repo owner and name from repository_url
        repo_api_url = item.get("repository_url", "")
        repo_parts = repo_api_url.rstrip("/").split("/")
        repo_name = repo_parts[-1] if len(repo_parts) >= 1 else ""
        repo_owner = repo_parts[-2] if len(repo_parts) >= 2 else ""

        user_obj = item.get("user") or {}
        author = user_obj.get("login") or username

        # Pull request object indicated by presence of 'pull_request' key
        is_merged = bool(item.get("pull_request", {}).get("merged_at"))

        results.append({
            "number": item.get("number", 0),
            "title": item.get("title", ""),
            "url": pr_url,
            "created_at": item.get("created_at", ""),
            "merged": is_merged,
            "merged_at": item.get("pull_request", {}).get("merged_at"),
            "merged_by": None,  # Not directly in issue search
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
    username: str, since: Optional[str] = None, until: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Fetch all PRs opened by a user in the specified date range.
    Uses GitHub GraphQL v4 as primary; falls back to REST v3 if needed.
    """
    clean_user = username.strip()
    if not clean_user:
        return []

    headers = {
        "Accept": "application/vnd.github.v4+json",
        "User-Agent": "FairPlay-AntiGaming-Auditor",
    }
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"bearer {settings.GITHUB_TOKEN}"

    search_query = _build_search_query(clean_user, since, until)
    all_prs: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(headers=headers, timeout=25.0) as client:
        try:
            cursor: Optional[str] = None
            has_next = True

            while has_next and len(all_prs) < 100:  # Bound to reasonable hackathon PR count
                variables: Dict[str, Any] = {"queryStr": search_query, "cursor": cursor}
                resp = await client.post(
                    GRAPHQL_URL,
                    json={"query": GRAPHQL_PR_SEARCH_QUERY, "variables": variables},
                )

                if resp.status_code != 200:
                    logger.warning(
                        "GraphQL request returned %d: %s. Falling back to REST.",
                        resp.status_code,
                        resp.text,
                    )
                    return await _fetch_via_rest_fallback(client, clean_user, since, until)

                data = resp.json()
                if "errors" in data and not data.get("data"):
                    logger.warning("GraphQL returned errors: %s. Falling back to REST.", data["errors"])
                    return await _fetch_via_rest_fallback(client, clean_user, since, until)

                search_data = data.get("data", {}).get("search", {})
                nodes = search_data.get("nodes", [])

                for node in nodes:
                    if node:  # Nodes could be empty or non-PR
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
                return await _fetch_via_rest_fallback(client, clean_user, since, until)
            except Exception as rest_exc:
                logger.error("REST fallback also failed for %s: %s", clean_user, rest_exc)
                return []

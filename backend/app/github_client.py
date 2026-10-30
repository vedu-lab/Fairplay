"""
Stub GitHub client – will be expanded to use GraphQL v4 and REST v3.
"""

class GitHubClient:
    def __init__(self, token: str):
        self.token = token
        # TODO: initialize HTTP client, set auth headers

    # Placeholder methods for future implementation
    def get_repo(self, owner: str, repo: str):
        pass

    def list_pull_requests(self, owner: str, repo: str):
        pass

    def get_reviews(self, owner: str, repo: str, pr_number: int):
        pass


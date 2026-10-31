from pathlib import Path
from typing import Any, Optional
from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for backend
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    """
    Application configuration with secure GitHub token handling.
    - Sanitizes whitespace and surrounding quote artifacts.
    - Supports GITHUB_TOKEN, GH_TOKEN, and GITHUB_PAT aliases.
    - Masks token in __repr__ and __str__ to prevent accidental credential leakage in logs.
    """
    GITHUB_TOKEN: str = Field(
        default="",
        validation_alias=AliasChoices("GITHUB_TOKEN", "GH_TOKEN", "GITHUB_PAT"),
        description="GitHub Personal Access Token for querying GraphQL & REST APIs without rate limits.",
    )
    CACHE_DB_PATH: str = str(BASE_DIR / "cache.db")

    @field_validator("GITHUB_TOKEN", mode="before")
    @classmethod
    def sanitize_github_token(cls, v: Any) -> str:
        """Strip whitespace, trailing newlines, surrounding quotes, and common null strings."""
        if v is None:
            return ""
        val = str(v).strip().strip("'\"").strip()
        if val.lower() in {"none", "null", "undefined", '""', "''"}:
            return ""
        return val

    @property
    def has_token(self) -> bool:
        """Returns True if a non-empty GitHub token is configured."""
        return bool(self.GITHUB_TOKEN)

    @property
    def masked_token(self) -> str:
        """Safe masked representation for logging and diagnostics, never exposing credentials."""
        if not self.GITHUB_TOKEN:
            return "<unset>"
        if len(self.GITHUB_TOKEN) <= 8:
            return "****"
        return f"{self.GITHUB_TOKEN[:4]}...{self.GITHUB_TOKEN[-4:]}"

    def is_token_format_valid(self, token: Optional[str] = None) -> bool:
        """Checks if token matches standard GitHub PAT format prefixes."""
        t = (token or self.GITHUB_TOKEN).strip()
        if not t:
            return False
        valid_prefixes = ("ghp_", "github_pat_", "gho_", "ghu_", "ghs_", "ghr_")
        return any(t.startswith(prefix) for prefix in valid_prefixes) or len(t) == 40

    def __repr__(self) -> str:
        return f"Settings(GITHUB_TOKEN={self.masked_token!r}, CACHE_DB_PATH={self.CACHE_DB_PATH!r})"

    def __str__(self) -> str:
        return self.__repr__()

    model_config = SettingsConfigDict(
        env_file=[
            str(BASE_DIR / ".env"),
            str(BASE_DIR.parent / ".env"),
            ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()


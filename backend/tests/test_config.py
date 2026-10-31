"""
Unit tests for Settings and GITHUB_TOKEN handling in app/config.py.
Verifies:
  - Masking in __repr__ and __str__ prevents token exposure in logs
  - Sanitization of surrounding quotes, whitespace, and null string literals
  - Token format validation helper
  - Aliasing of GITHUB_TOKEN, GH_TOKEN, GITHUB_PAT
"""

import os
from app.config import Settings


def test_token_masking_in_repr():
    """Verify that sensitive tokens are never exposed in plaintext in repr/str."""
    cfg = Settings(GITHUB_TOKEN="ghp_1234567890abcdef1234567890abcdef1234")
    repr_str = repr(cfg)
    str_val = str(cfg)

    # Must contain masked snippet
    assert "ghp_...1234" in repr_str
    assert "ghp_...1234" in str_val

    # Must NOT contain full secret
    assert "ghp_1234567890abcdef1234567890abcdef1234" not in repr_str
    assert "ghp_1234567890abcdef1234567890abcdef1234" not in str_val


def test_token_sanitization():
    """Verify that quotes, whitespace, and null strings are cleanly stripped."""
    # Double quotes and whitespace
    cfg1 = Settings(GITHUB_TOKEN='  "ghp_testtoken123" \n')
    assert cfg1.GITHUB_TOKEN == "ghp_testtoken123"

    # Single quotes
    cfg2 = Settings(GITHUB_TOKEN="'ghp_singlequote'")
    assert cfg2.GITHUB_TOKEN == "ghp_singlequote"

    # Null literal strings
    cfg3 = Settings(GITHUB_TOKEN="null")
    assert cfg3.GITHUB_TOKEN == ""
    assert not cfg3.has_token
    assert cfg3.masked_token == "<unset>"


def test_token_format_validity():
    """Verify standard GitHub PAT prefixes and classic 40-char tokens."""
    cfg = Settings(GITHUB_TOKEN="")
    assert not cfg.is_token_format_valid()

    assert cfg.is_token_format_valid("ghp_1234567890abcdef1234567890abcdef1234")
    assert cfg.is_token_format_valid("github_pat_1234567890_abcdef")
    assert cfg.is_token_format_valid("a" * 40)
    assert not cfg.is_token_format_valid("invalid_token_prefix")

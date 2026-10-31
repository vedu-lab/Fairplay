/**
 * FairPlay API Client
 * Connects to FastAPI backend to retrieve verified PAT status, scored leaderboards,
 * detailed graphical analysis, and repository audit changelogs.
 */

export interface RubricBreakdown {
  merge_legitimacy: number; // 0 - 40
  merge_legitimacy_max?: number;
  merge_legitimacy_lost?: number;
  merge_loss_reason?: string | null;

  review_engagement: number; // 0 - 20
  review_engagement_max?: number;
  review_engagement_lost?: number;
  review_loss_reason?: string | null;

  change_substance: number; // 0 - 20
  change_substance_max?: number;
  change_substance_lost?: number;
  substance_loss_reason?: string | null;

  repo_trust: number; // 0 - 20
  repo_trust_max?: number;
  repo_trust_lost?: number;
  repo_loss_reason?: string | null;

  points_gained?: number;
  points_lost?: number;
  loss_reasons?: string[];
}

export interface PRItem {
  number: number;
  title: string;
  url: string;
  created_at: string;
  merged: boolean;
  merged_at?: string | null;
  merged_by?: string | null;
  author: string;
  review_comment_count: number;
  comment_count: number;
  review_count: number;
  additions: number;
  deletions: number;
  files_changed: number;
  repo: string;
  repo_name: string;
  repo_owner: string;
  repo_created_at: string;
  repo_is_fork: boolean;
  repo_stars: number;
  repo_forks: number;
  score: number;
  breakdown: RubricBreakdown;
  flagged: boolean;
  flag_reason?: string | null;
  flag_reasons: string[];
  category?: 'Feature' | 'Bugfix' | 'Documentation' | 'Refactor' | 'Contribution';
}

export interface RubricDimensionData {
  name: string;
  weight_pct: number;
  gained: number;
  lost: number;
  max: number;
  color: string;
}

export interface ContributorStats {
  total_additions: number;
  total_deletions: number;
  distinct_repos_count: number;
  merged_rate: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  total_score: number;
  pr_count: number;
  merged_count?: number;
  flagged_count: number;
  max_possible_score?: number;
  total_points_lost?: number;
  score_percentage?: number;
  verdict?: string;
  verdict_status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  stats?: ContributorStats;
  graphical_analysis?: {
    merge_legitimacy: RubricDimensionData;
    review_engagement: RubricDimensionData;
    change_substance: RubricDimensionData;
    repo_trust: RubricDimensionData;
  };
  gaming_reasons_summary?: string[];
  cached: boolean;
  prs: PRItem[];
}

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  public_repos: number;
}

export interface RateLimitQuota {
  core_limit: number;
  core_remaining: number;
  graphql_limit: number;
  graphql_remaining: number;
}

export interface VerifyTokenResponse {
  valid: boolean;
  token_type?: 'custom' | 'server_default';
  user?: GitHubUser;
  rate_limit?: RateLimitQuota;
  error?: string;
}

export interface LeadContributor {
  rank: number;
  username: string;
  points_in_repo: number;
  prs_in_repo: number;
  merged_in_repo: number;
  flagged_in_repo: number;
  lines_added: number;
  lines_deleted: number;
}

export interface RepoMeta {
  repo: string;
  name: string;
  owner: string;
  stars: number;
  forks: number;
  created_at: string;
  is_fork: boolean;
}

export interface RepoAuditResponse {
  repo: string;
  repo_meta: RepoMeta;
  total_prs: number;
  merged_prs: number;
  lead_contributors: LeadContributor[];
  changelog: PRItem[];
  cached: boolean;
}

const TOKEN_STORAGE_KEY = 'fairplay_github_pat';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore local storage errors
  }
}

function getAuthHeaders(customToken?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const token = customToken || getStoredToken();
  if (token && token.trim()) {
    headers['X-GitHub-Token'] = token.trim();
  }
  return headers;
}

export async function verifyToken(token?: string): Promise<VerifyTokenResponse> {
  const payload = { token: token ? token.trim() : 'default' };
  const res = await fetch('/api/verify-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Token validation server returned HTTP ${res.status}`);
  }
  return res.json();
}

export interface FetchLeaderboardParams {
  usernames: string[];
  since?: string;
  until?: string;
  forceRefresh?: boolean;
  customToken?: string;
}

export async function fetchLeaderboard({
  usernames,
  since,
  until,
  forceRefresh = false,
  customToken,
}: FetchLeaderboardParams): Promise<LeaderboardEntry[]> {
  const cleanUsers = usernames.map((u) => u.trim()).filter(Boolean);
  if (cleanUsers.length === 0) {
    throw new Error('Please enter at least one GitHub username.');
  }

  const params = new URLSearchParams();
  params.set('usernames', cleanUsers.join(','));
  if (since) params.set('since', since.trim());
  if (until) params.set('until', until.trim());
  if (forceRefresh) params.set('force_refresh', 'true');

  const headers = getAuthHeaders(customToken);
  const response = await fetch(`/api/leaderboard?${params.toString()}`, { headers });

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore json decode failure
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export interface FetchRepoAuditParams {
  repo: string;
  since?: string;
  until?: string;
  forceRefresh?: boolean;
  customToken?: string;
}

export async function fetchRepoAudit({
  repo,
  since,
  until,
  forceRefresh = false,
  customToken,
}: FetchRepoAuditParams): Promise<RepoAuditResponse> {
  const cleanRepo = repo.trim();
  if (!cleanRepo || !cleanRepo.includes('/')) {
    throw new Error("Repository must be in 'owner/repo' format (e.g. 'facebook/react').");
  }

  const params = new URLSearchParams();
  params.set('repo', cleanRepo);
  if (since) params.set('since', since.trim());
  if (until) params.set('until', until.trim());
  if (forceRefresh) params.set('force_refresh', 'true');

  const headers = getAuthHeaders(customToken);
  const response = await fetch(`/api/repo/audit?${params.toString()}`, { headers });

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

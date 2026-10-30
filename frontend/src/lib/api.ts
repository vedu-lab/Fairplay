/**
 * FairPlay API Client
 * Connects to FastAPI backend to retrieve scored leaderboard and audit data.
 */

export interface RubricBreakdown {
  merge_legitimacy: number; // 0 - 40
  review_engagement: number; // 0 - 20
  change_substance: number; // 0 - 20
  repo_trust: number; // 0 - 20
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
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  total_score: number;
  pr_count: number;
  flagged_count: number;
  cached: boolean;
  prs: PRItem[];
}

export interface FetchLeaderboardParams {
  usernames: string[];
  since?: string;
  until?: string;
  forceRefresh?: boolean;
}

export async function fetchLeaderboard({
  usernames,
  since,
  until,
  forceRefresh = false,
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

  const response = await fetch(`/api/leaderboard?${params.toString()}`);

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

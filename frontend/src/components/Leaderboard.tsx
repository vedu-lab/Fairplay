import React, { useState, useEffect } from 'react';
import {
  fetchLeaderboard,
  LeaderboardEntry,
  PRItem,
} from '../lib/api';
import {
  ShieldAlert,
  ShieldCheck,
  GitPullRequest,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Sparkles,
  Award,
  AlertTriangle,
  Info,
  Calendar,
  CheckCircle2,
  XCircle,
  GitMerge,
  MessageSquare,
  FileCode2,
  Database,
  ArrowUpDown,
} from 'lucide-react';

type SortField = 'rank' | 'score' | 'prs' | 'flags' | 'username';
type SortOrder = 'asc' | 'desc';

export default function Leaderboard() {
  const [usernamesInput, setUsernamesInput] = useState<string>('vedu-lab, torvalds, octocat');
  const [sinceDate, setSinceDate] = useState<string>('2026-08-01');
  const [untilDate, setUntilDate] = useState<string>('2026-10-31');
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Initial load
  useEffect(() => {
    handleFetch();
  }, []);

  const handleFetch = async (overrideUsers?: string, overrideSince?: string, overrideUntil?: string) => {
    const rawUsers = overrideUsers !== undefined ? overrideUsers : usernamesInput;
    const since = overrideSince !== undefined ? overrideSince : sinceDate;
    const until = overrideUntil !== undefined ? overrideUntil : untilDate;

    const userList = rawUsers.split(',').map((u) => u.trim()).filter(Boolean);
    if (userList.length === 0) {
      setError('Please provide at least one GitHub username.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchLeaderboard({
        usernames: userList,
        since,
        until,
        forceRefresh,
      });
      setLeaderboard(data);
      if (data.length > 0 && !expandedUser) {
        setExpandedUser(data[0].username);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leaderboard data.');
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (users: string, since: string, until: string) => {
    setUsernamesInput(users);
    setSinceDate(since);
    setUntilDate(until);
    handleFetch(users, since, until);
  };

  const toggleExpand = (username: string) => {
    setExpandedUser((prev) => (prev === username ? null : username));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'rank' ? 'asc' : 'desc');
    }
  };

  // Filter and sort entries
  const filteredEntries = leaderboard
    .filter((entry) =>
      entry.username.toLowerCase().includes(searchFilter.trim().toLowerCase())
    )
    .sort((a, b) => {
      let comp = 0;
      if (sortField === 'rank') comp = a.rank - b.rank;
      else if (sortField === 'score') comp = a.total_score - b.total_score;
      else if (sortField === 'prs') comp = a.pr_count - b.pr_count;
      else if (sortField === 'flags') comp = a.flagged_count - b.flagged_count;
      else if (sortField === 'username') comp = a.username.localeCompare(b.username);

      return sortOrder === 'asc' ? comp : -comp;
    });

  const totalPrs = leaderboard.reduce((acc, curr) => acc + curr.pr_count, 0);
  const totalFlags = leaderboard.reduce((acc, curr) => acc + curr.flagged_count, 0);
  const highestScore = leaderboard.length > 0 ? Math.max(...leaderboard.map((u) => u.total_score)) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Search & Audit Controls */}
      <section className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-slate-700/60 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Event Audit Configuration
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Specify GitHub participants and event dates to score PRs on transparent weighted rubrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => handlePreset('vedu-lab, torvalds, octocat', '2026-08-01', '2026-10-31')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 transition"
            >
              Demo Hackathon Trio
            </button>
            <button
              type="button"
              onClick={() => handlePreset('vedu-lab', '2026-08-01', '2026-10-31')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-slate-300 border border-slate-600 transition"
            >
              Local Test (vedu-lab)
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFetch();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                GitHub Usernames (comma-separated)
              </label>
              <input
                type="text"
                value={usernamesInput}
                onChange={(e) => setUsernamesInput(e.target.value)}
                placeholder="e.g. vedu-lab, octocat, torvalds"
                className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Since Date
              </label>
              <input
                type="date"
                value={sinceDate}
                onChange={(e) => setSinceDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Until Date
              </label>
              <input
                type="date"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 h-4 w-4"
              />
              Bypass local SQLite cache (force re-fetch from GitHub)
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition shadow-lg shadow-indigo-600/25 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Auditing PRs...' : 'Run Audit & Generate Leaderboard'}
            </button>
          </div>
        </form>
      </section>

      {/* Metrics Header Cards */}
      {leaderboard.length > 0 && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Audited Users</p>
              <p className="text-2xl font-bold text-white">{leaderboard.length}</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">PRs Evaluated</p>
              <p className="text-2xl font-bold text-white">{totalPrs}</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Gaming Flags</p>
              <p className="text-2xl font-bold text-rose-400">{totalFlags}</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Top Score</p>
              <p className="text-2xl font-bold text-emerald-400">{highestScore.toFixed(1)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-700/60 rounded-2xl p-5 flex items-start gap-3 text-rose-200">
          <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-rose-300">Audit Request Failed</h4>
            <p className="text-sm mt-1 text-rose-200/90">{error}</p>
            <p className="text-xs mt-2 text-rose-300/70">
              Tip: Verify that GITHUB_TOKEN is properly configured in <code className="bg-rose-900/60 px-1 py-0.5 rounded">backend/.env</code> and that the usernames exist on GitHub.
            </p>
          </div>
          <button
            onClick={() => handleFetch()}
            className="text-xs bg-rose-900/60 hover:bg-rose-800 text-rose-200 px-3 py-1.5 rounded-lg border border-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Leaderboard Section */}
      <section className="bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <div className="p-5 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">Audited Leaderboard</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'participant' : 'participants'}
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by username..."
              className="pl-9 pr-4 py-1.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-56"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center space-y-4">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 animate-pulse">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Analyzing GitHub Pull Requests...</p>
              <p className="text-xs text-slate-400 mt-1">
                Evaluating merge legitimacy, review engagement, diff substance, and repo trust metrics.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredEntries.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex p-3 rounded-2xl bg-slate-700/40 text-slate-400">
              <Info className="w-8 h-8" />
            </div>
            <p className="text-base font-semibold text-slate-300">No PR records found</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Either the specified users opened zero pull requests in this date range, or the usernames were not found. Try expanding the date window or using the presets above.
            </p>
          </div>
        )}

        {/* Table Content */}
        {!loading && filteredEntries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th
                    onClick={() => handleSort('rank')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition select-none w-20 text-center"
                  >
                    <span className="inline-flex items-center gap-1">
                      Rank <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('username')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      Participant <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('score')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition select-none text-right"
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Total Score <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('prs')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition select-none text-center"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      PRs <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('flags')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition select-none text-center"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Gaming Audit <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-3 px-4 text-center w-24">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-sm">
                {filteredEntries.map((user) => {
                  const isExpanded = expandedUser === user.username;
                  const rankBadge =
                    user.rank === 1 ? (
                      <span className="text-xl" title="1st Place">🥇</span>
                    ) : user.rank === 2 ? (
                      <span className="text-xl" title="2nd Place">🥈</span>
                    ) : user.rank === 3 ? (
                      <span className="text-xl" title="3rd Place">🥉</span>
                    ) : (
                      <span className="font-mono text-xs font-semibold text-slate-400">#{user.rank}</span>
                    );

                  return (
                    <React.Fragment key={user.username}>
                      <tr
                        onClick={() => toggleExpand(user.username)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-indigo-950/20' : 'hover:bg-slate-700/30'
                        }`}
                      >
                        <td className="py-4 px-4 text-center">{rankBadge}</td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={`https://github.com/${user.username}.png?size=40`}
                              alt={user.username}
                              className="w-8 h-8 rounded-full border border-slate-600 bg-slate-800"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <span>{user.username}</span>
                                <a
                                  href={`https://github.com/${user.username}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-slate-500 hover:text-indigo-400"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2">
                                {user.cached && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <Database className="w-2.5 h-2.5" /> cached
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex flex-col items-end">
                            <span className="text-lg font-bold text-white font-mono">
                              {user.total_score.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                              FairPlay Pts
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-700 text-slate-200 font-mono">
                            {user.pr_count}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-center">
                          {user.flagged_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                              {user.flagged_count} Flagged
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              Clean
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            aria-label="Toggle details"
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-indigo-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Rubric & PR Audit View */}
                      {isExpanded && (
                        <tr className="bg-slate-900/60">
                          <td colSpan={6} className="p-5 border-y border-slate-700/70">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                  <GitPullRequest className="w-4 h-4 text-indigo-400" />
                                  Audited PR Contributions for @{user.username}
                                </h4>
                                <span className="text-xs text-slate-400">
                                  {user.prs.length} pull request{user.prs.length !== 1 ? 's' : ''} reviewed
                                </span>
                              </div>

                              {user.prs.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">
                                  No pull requests recorded in the configured event date window.
                                </p>
                              ) : (
                                <div className="space-y-4">
                                  {user.prs.map((pr: PRItem) => (
                                    <PRCard key={`${pr.repo}-${pr.number}`} pr={pr} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL PR AUDIT CARD WITH 4-SIGNAL RUBRIC
// ═══════════════════════════════════════════════════════════════
function PRCard({ pr }: { pr: PRItem }) {
  const isSelfMerged = pr.merged && pr.merged_by && pr.merged_by === pr.author;
  const isLegitMerged = pr.merged && !isSelfMerged;

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        pr.flagged
          ? 'bg-rose-950/20 border-rose-700/50'
          : 'bg-slate-800/80 border-slate-700/70'
      }`}
    >
      {/* PR Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-semibold text-white hover:text-indigo-400 transition flex items-center gap-1.5"
            >
              <span>{pr.title || `PR #${pr.number}`}</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>

            <span className="text-xs font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 rounded">
              #{pr.number}
            </span>

            <span className="text-xs font-mono text-slate-400">
              {pr.repo}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {/* Merge Status Tag */}
            {isLegitMerged ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Merged by {pr.merged_by ? `@${pr.merged_by}` : 'maintainer'}
              </span>
            ) : isSelfMerged ? (
              <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                <XCircle className="w-3.5 h-3.5" />
                Self-Merged by author
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <GitPullRequest className="w-3.5 h-3.5" />
                Open / Unmerged
              </span>
            )}

            <span>•</span>
            <span>Opened {pr.created_at ? new Date(pr.created_at).toLocaleDateString() : 'N/A'}</span>

            <span>•</span>
            <span className="font-mono text-emerald-400">+{pr.additions}</span>
            <span className="font-mono text-rose-400">-{pr.deletions}</span>
            <span>({pr.files_changed} file{pr.files_changed !== 1 ? 's' : ''})</span>
          </div>
        </div>

        {/* PR Total Score */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">{pr.score.toFixed(1)}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Rubric Score</span>
        </div>
      </div>

      {/* Gaming Detection Alert Banner */}
      {pr.flagged && (
        <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-600/60 text-rose-200 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-rose-300 uppercase tracking-wider text-[10px]">
              Gaming Pattern Flagged
            </span>
            <p className="text-rose-100/90 leading-relaxed font-sans">{pr.flag_reason}</p>
          </div>
        </div>
      )}

      {/* Transparent 4-Signal Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-700/50 text-xs">
        {/* 1. Merge Legitimacy (40%) */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <GitMerge className="w-3.5 h-3.5 text-indigo-400" /> Merge Legitimacy
            </span>
            <span className="font-mono font-bold text-white">
              {pr.breakdown.merge_legitimacy.toFixed(0)} <span className="text-slate-500">/ 40</span>
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full ${
                pr.breakdown.merge_legitimacy >= 40
                  ? 'bg-emerald-500'
                  : pr.breakdown.merge_legitimacy > 0
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${(pr.breakdown.merge_legitimacy / 40) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {pr.breakdown.merge_legitimacy >= 40
              ? 'Independent maintainer approved'
              : isSelfMerged
              ? 'Zero pts: self-merged PR'
              : 'Zero pts: unmerged or open'}
          </p>
        </div>

        {/* 2. Review Engagement (20%) */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Review Engagement
            </span>
            <span className="font-mono font-bold text-white">
              {pr.breakdown.review_engagement.toFixed(0)} <span className="text-slate-500">/ 20</span>
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${(pr.breakdown.review_engagement / 20) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {pr.review_count} formal review(s), {pr.comment_count} discussion comment(s)
          </p>
        </div>

        {/* 3. Change Substance (20%) */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <FileCode2 className="w-3.5 h-3.5 text-amber-400" /> Change Substance
            </span>
            <span className="font-mono font-bold text-white">
              {pr.breakdown.change_substance.toFixed(0)} <span className="text-slate-500">/ 20</span>
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${(pr.breakdown.change_substance / 20) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {pr.additions + pr.deletions} lines touched across {pr.files_changed} file(s)
          </p>
        </div>

        {/* 4. Repo Trust (20%) */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Repo Trust
            </span>
            <span className="font-mono font-bold text-white">
              {pr.breakdown.repo_trust.toFixed(0)} <span className="text-slate-500">/ 20</span>
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(pr.breakdown.repo_trust / 20) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {pr.repo_owner === pr.author
              ? 'Self-owned repository'
              : `${pr.repo_stars}★ community repo`}
          </p>
        </div>
      </div>
    </div>
  );
}

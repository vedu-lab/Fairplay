import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  GitPullRequest,
  GitMerge,
  Star,
  GitFork,
  ExternalLink,
  Users,
  Award,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
  Filter,
  CheckCircle2,
  Trash2,
  Calendar,
} from 'lucide-react';
import {
  RepoAuditResponse,
  fetchRepoAudit,
  getStoredToken,
} from '../lib/api';

const DEFAULT_REPOS = [
  'vedu-lab/Fairplay',
  'facebook/react',
  'tailwindlabs/tailwindcss',
];

interface TrackedReposProps {
  sinceDate?: string;
  untilDate?: string;
  onSelectContributor?: (username: string) => void;
}

export default function TrackedRepos({
  sinceDate = '2026-08-01',
  untilDate = '2026-10-31',
  onSelectContributor,
}: TrackedReposProps) {
  const [trackedRepos, setTrackedRepos] = useState<string[]>(DEFAULT_REPOS);
  const [activeRepo, setActiveRepo] = useState<string>(DEFAULT_REPOS[0]);
  const [newRepoInput, setNewRepoInput] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);

  const [repoData, setRepoData] = useState<RepoAuditResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Load audit data whenever activeRepo changes
  useEffect(() => {
    if (activeRepo) {
      loadRepoAudit(activeRepo);
    }
  }, [activeRepo]);

  const loadRepoAudit = async (repo: string, forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchRepoAudit({
        repo,
        since: sinceDate,
        until: untilDate,
        forceRefresh,
      });
      setRepoData(data);
    } catch (err: any) {
      setError(err.message || `Failed to fetch audit for repository ${repo}`);
      setRepoData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRepoInput.trim();
    if (!clean || !clean.includes('/')) {
      setAddError("Please enter repository in 'owner/repo' format (e.g. 'vercel/next.js')");
      return;
    }
    if (trackedRepos.includes(clean)) {
      setActiveRepo(clean);
      setNewRepoInput('');
      setAddError(null);
      return;
    }

    setTrackedRepos([...trackedRepos, clean]);
    setActiveRepo(clean);
    setNewRepoInput('');
    setAddError(null);
  };

  const handleRemoveRepo = (repoToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (trackedRepos.length <= 1) return;
    const filtered = trackedRepos.filter((r) => r !== repoToRemove);
    setTrackedRepos(filtered);
    if (activeRepo === repoToRemove) {
      setActiveRepo(filtered[0]);
    }
  };

  const changelog = repoData?.changelog || [];
  const filteredChangelog = changelog.filter((item) => {
    if (categoryFilter === 'All') return true;
    return item.category === categoryFilter;
  });

  const leadContributors = repoData?.lead_contributors || [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header & Add Repo Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <FolderGit2 className="w-5 h-5 text-indigo-400" />
              Repository Hub & Project Changelogs
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Switch between tracked open-source repositories to inspect real-time project changelogs and lead contributor rankings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadRepoAudit(activeRepo, true)}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh Repo</span>
          </button>
        </div>

        {/* Add Repository Input */}
        <form onSubmit={handleAddRepo} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={newRepoInput}
              onChange={(e) => setNewRepoInput(e.target.value)}
              placeholder="Track another repo: owner/repo (e.g. vercel/next.js, shadcn-ui/ui)..."
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition font-mono"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Track Repo</span>
          </button>
        </form>

        {addError && (
          <p className="text-xs text-rose-400 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {addError}
          </p>
        )}

        {/* Repository Tabs Bar */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2 scrollbar-thin">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
            Tracked Repos:
          </span>
          {trackedRepos.map((repo) => {
            const isActive = repo === activeRepo;
            return (
              <div
                key={repo}
                onClick={() => setActiveRepo(repo)}
                className={`group px-3.5 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer transition shrink-0 select-none ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/70'
                }`}
              >
                <FolderGit2 className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                <span>{repo}</span>
                {trackedRepos.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRepo(repo, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 transition ml-1"
                    title="Remove tracked repository"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading or Error State */}
      {loading && (
        <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-white">Auditing {activeRepo}...</p>
          <p className="text-xs text-slate-400">Fetching pull requests, maintainer reviews, and changelogs via GraphQL v4</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <p className="font-bold">Repository Audit Error</p>
            <p className="text-xs text-rose-200/90 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Repository Main Content */}
      {repoData && !loading && (
        <div className="space-y-6">
          {/* Repo Overview Metadata Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-black text-white font-mono">{repoData.repo}</h3>
                <a
                  href={`https://github.com/${repoData.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs text-slate-400">
                Created: {repoData.repo_meta?.created_at ? new Date(repoData.repo_meta.created_at).toLocaleDateString() : 'Active'} • Hackathon Audit Window: {sinceDate} to {untilDate}
              </p>
            </div>

            {/* Metrics Chips */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">{repoData.repo_meta?.stars.toLocaleString() || 0}</span>
                <span className="text-slate-400 text-[11px]">stars</span>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                <GitFork className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-white">{repoData.repo_meta?.forks.toLocaleString() || 0}</span>
                <span className="text-slate-400 text-[11px]">forks</span>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-emerald-400">{repoData.merged_prs}</span>
                <span className="text-slate-400 text-[11px]">/ {repoData.total_prs} merged</span>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-white">{leadContributors.length}</span>
                <span className="text-slate-400 text-[11px]">contributors</span>
              </div>
            </div>
          </div>

          {/* Two-Column Grid: Lead Contributors on Left, Repository Changelog on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Lead Contributors (Takes 1 of 3 columns) */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    Lead Contributors in this Repo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ranked by FairPlay rubric points earned on contributions to this specific repository.
                  </p>
                </div>

                {leadContributors.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/50 rounded-2xl border border-slate-800/80">
                    No evaluated pull requests for this repository in the active date window.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {leadContributors.map((c) => (
                      <div
                        key={c.username}
                        onClick={() => onSelectContributor && onSelectContributor(c.username)}
                        className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/40 transition cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-300 font-mono shrink-0">
                            #{c.rank}
                          </div>
                          <img
                            src={`https://github.com/${c.username}.png?size=64`}
                            alt={c.username}
                            className="w-8 h-8 rounded-full border border-slate-700 shrink-0 bg-slate-800"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-white group-hover:text-indigo-300 transition truncate">
                              @{c.username}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {c.merged_in_repo} merged PRs • +{c.lines_added}/-{c.lines_deleted}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-sm text-emerald-400">
                            {c.points_in_repo} pts
                          </span>
                          {c.flagged_in_repo > 0 && (
                            <p className="text-[10px] font-semibold text-rose-400">
                              {c.flagged_in_repo} flagged
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Repository Changelog (Takes 2 of 3 columns) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      Repository Changelog & Activity Feed
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chronological log of pull requests landed in this project during the hackathon.
                    </p>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                    {['All', 'Feature', 'Bugfix', 'Documentation', 'Refactor'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded-lg font-medium transition ${
                          categoryFilter === cat
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredChangelog.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                    No contributions found under category "{categoryFilter}".
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredChangelog.map((item) => (
                      <div
                        key={item.number}
                        className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {item.merged ? (
                              <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                <GitMerge className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                <GitPullRequest className="w-3.5 h-3.5" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold font-mono">
                                  {item.category || 'Contribution'}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">#{item.number}</span>
                                {item.flagged && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                    Flagged
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-sm text-white hover:text-indigo-300 transition">
                                <a href={item.url} target="_blank" rel="noopener noreferrer">
                                  {item.title}
                                </a>
                              </h4>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-black text-sm text-white">
                              {item.score}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">pts</span>
                            </span>
                          </div>
                        </div>

                        {/* Changelog Meta Row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/70 text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <img
                              src={`https://github.com/${item.author}.png?size=32`}
                              alt={item.author}
                              className="w-4 h-4 rounded-full border border-slate-700 bg-slate-800"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
                              }}
                            />
                            <span className="font-semibold text-slate-300">@{item.author}</span>
                            {item.merged_by && (
                              <span className="text-[11px] text-slate-500">
                                • merged by @{item.merged_by}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="text-emerald-400">+{item.additions || 0}</span>
                            <span className="text-rose-400">-{item.deletions || 0}</span>
                            <span className="text-slate-500">{item.files_changed || 0} files</span>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 transition ml-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

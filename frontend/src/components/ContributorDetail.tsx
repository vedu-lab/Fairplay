import React, { useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  GitPullRequest,
  GitMerge,
  ShieldAlert,
  ShieldCheck,
  Award,
  AlertTriangle,
  FileCode2,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { LeaderboardEntry, PRItem } from '../lib/api';

interface ContributorDetailProps {
  contributor: LeaderboardEntry;
  onBack: () => void;
}

export default function ContributorDetail({
  contributor,
  onBack,
}: ContributorDetailProps) {
  const [filterType, setFilterType] = useState<'all' | 'flagged' | 'clean'>('all');
  const [expandedPrs, setExpandedPrs] = useState<Record<number, boolean>>({});

  const toggleExpand = (num: number) => {
    setExpandedPrs((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    contributor.prs.forEach((p) => {
      all[p.number] = true;
    });
    setExpandedPrs(all);
  };

  const collapseAll = () => {
    setExpandedPrs({});
  };

  const prs = contributor.prs || [];
  const filteredPrs = prs.filter((p) => {
    if (filterType === 'flagged') return p.flagged;
    if (filterType === 'clean') return !p.flagged;
    return true;
  });

  const maxPossible = contributor.max_possible_score || (prs.length * 100);
  const totalScore = contributor.total_score || 0;
  const pointsLost = contributor.total_points_lost !== undefined ? contributor.total_points_lost : Math.max(0, maxPossible - totalScore);
  const scorePercent = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;

  const ga = contributor.graphical_analysis || {
    merge_legitimacy: { name: 'Merge Legitimacy', weight_pct: 40, gained: 0, lost: 0, max: prs.length * 40, color: '#10B981' },
    review_engagement: { name: 'Review Engagement', weight_pct: 20, gained: 0, lost: 0, max: prs.length * 20, color: '#6366F1' },
    change_substance: { name: 'Change Substance', weight_pct: 20, gained: 0, lost: 0, max: prs.length * 20, color: '#F59E0B' },
    repo_trust: { name: 'Repo Trust', weight_pct: 20, gained: 0, lost: 0, max: prs.length * 20, color: '#3B82F6' },
  };

  // Compile all deduction / loss reasons
  const allLossReasons: { reason: string; prNum: number; repo: string }[] = [];
  prs.forEach((pr) => {
    if (pr.breakdown?.loss_reasons && pr.breakdown.loss_reasons.length > 0) {
      pr.breakdown.loss_reasons.forEach((r) => {
        allLossReasons.push({ reason: r, prNum: pr.number, repo: pr.repo });
      });
    }
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 font-semibold text-sm transition shadow-md group"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Leaderboard</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>FairPlay</span>
          <span>/</span>
          <span>Contributors</span>
          <span>/</span>
          <span className="text-white font-semibold font-mono">@{contributor.username}</span>
        </div>
      </div>

      {/* Contributor Profile Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          {/* Identity & Rank */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative">
              <img
                src={`https://github.com/${contributor.username}.png?size=160`}
                alt={contributor.username}
                className="w-20 h-20 rounded-2xl border-2 border-indigo-500/40 shadow-xl object-cover bg-slate-800"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
                }}
              />
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-slate-950 border-2 border-indigo-500 flex items-center justify-center font-bold text-xs text-indigo-300">
                #{contributor.rank}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {contributor.username}
                </h1>
                <a
                  href={`https://github.com/${contributor.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white transition p-1"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                {contributor.rank === 1 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Tournament Leader
                  </span>
                )}
              </div>

              {/* Verdict Tag */}
              <div className="flex items-center gap-2 pt-1">
                {contributor.flagged_count > 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>{contributor.verdict || `${contributor.flagged_count} Gaming Pattern(s) Flagged`}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{contributor.verdict || 'Exemplary Contributor — 100% Clean Audit'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Aggregate Score Box */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
            <div className="text-center px-4 border-r border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Score</p>
              <p className="text-3xl font-black text-white mt-0.5">{totalScore}</p>
              <p className="text-[10px] text-slate-500 font-mono">of {maxPossible} max</p>
            </div>

            <div className="text-center px-4 border-r border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Pts Gained
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">+{totalScore}</p>
              <p className="text-[10px] text-slate-500 font-mono">{scorePercent}% efficiency</p>
            </div>

            <div className="text-center px-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 flex items-center justify-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Pts Lost
              </p>
              <p className="text-2xl font-bold text-rose-400 mt-0.5">-{pointsLost}</p>
              <p className="text-[10px] text-slate-500 font-mono">deductions</p>
            </div>
          </div>
        </div>

        {/* Secondary Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
            <p className="text-slate-400">Total PRs Opened</p>
            <p className="text-lg font-bold text-white mt-0.5">{prs.length}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
            <p className="text-slate-400">Independent Merges</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">
              {contributor.merged_count || prs.filter((p) => p.merged).length}{' '}
              <span className="text-xs font-normal text-slate-400">
                ({prs.length > 0 ? Math.round(((contributor.merged_count || prs.filter((p) => p.merged).length) / prs.length) * 100) : 0}%)
              </span>
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
            <p className="text-slate-400">Lines Modified</p>
            <p className="text-lg font-bold text-indigo-300 mt-0.5">
              +{contributor.stats?.total_additions || prs.reduce((a, c) => a + (c.additions || 0), 0)}{' '}
              <span className="text-slate-400">/</span>{' '}
              -{contributor.stats?.total_deletions || prs.reduce((a, c) => a + (c.deletions || 0), 0)}
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
            <p className="text-slate-400">Target Repositories</p>
            <p className="text-lg font-bold text-white mt-0.5">
              {contributor.stats?.distinct_repos_count || new Set(prs.map((p) => p.repo)).size} repos
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION: DETAILED GRAPHICAL ANALYSIS (GAINED VS LOST)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Graphical Rubric Analysis: Points Gained vs. Points Lost
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Visualizing where @{contributor.username} scored points across the 4-signal rubric and where points were deducted/forfeited.
              </p>
            </div>
            <span className="hidden sm:inline-flex text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Rubric Max: 100 pts / PR
            </span>
          </div>

          {/* Overall Waterfall Progression Bar */}
          <div className="mt-5 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Score Attainment: {totalScore} pts earned ({scorePercent}%)
              </span>
              <span className="text-rose-400 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                Forfeited / Deducted: {pointsLost} pts ({100 - scorePercent}%)
              </span>
            </div>
            <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${scorePercent}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-700"
              />
              <div
                style={{ width: `${100 - scorePercent}%` }}
                className="h-full bg-rose-500/40 border-l border-rose-500/60 transition-all duration-700"
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>0 pts</span>
              <span>Potential Max: {maxPossible} pts</span>
            </div>
          </div>
        </div>

        {/* 4 Dimension Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Merge Legitimacy */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <GitMerge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{ga.merge_legitimacy.name}</h3>
                  <p className="text-[11px] text-slate-400">Weight: 40% (Max {ga.merge_legitimacy.max} pts)</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-emerald-400">+{ga.merge_legitimacy.gained}</span>
                <span className="text-xs text-rose-400 ml-1.5 font-semibold">(-{ga.merge_legitimacy.lost})</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${ga.merge_legitimacy.max > 0 ? (ga.merge_legitimacy.gained / ga.merge_legitimacy.max) * 100 : 0}%`,
                  }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rewards PRs merged by an independent repository maintainer. PRs that are self-merged by the author or unmerged receive 0 pts.
              </p>
            </div>
          </div>

          {/* 2. Review Engagement */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{ga.review_engagement.name}</h3>
                  <p className="text-[11px] text-slate-400">Weight: 20% (Max {ga.review_engagement.max} pts)</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-indigo-400">+{ga.review_engagement.gained}</span>
                <span className="text-xs text-rose-400 ml-1.5 font-semibold">(-{ga.review_engagement.lost})</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${ga.review_engagement.max > 0 ? (ga.review_engagement.gained / ga.review_engagement.max) * 100 : 0}%`,
                  }}
                  className="h-full bg-indigo-500 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rewards multi-round peer code review discussion and formal approvals vs unreviewed rubber-stamping.
              </p>
            </div>
          </div>

          {/* 3. Change Substance */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileCode2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{ga.change_substance.name}</h3>
                  <p className="text-[11px] text-slate-400">Weight: 20% (Max {ga.change_substance.max} pts)</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-amber-400">+{ga.change_substance.gained}</span>
                <span className="text-xs text-rose-400 ml-1.5 font-semibold">(-{ga.change_substance.lost})</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${ga.change_substance.max > 0 ? (ga.change_substance.gained / ga.change_substance.max) * 100 : 0}%`,
                  }}
                  className="h-full bg-amber-500 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Evaluates lines added, deleted, and files changed to separate meaningful features from trivial 1-line whitespace/typo edits.
              </p>
            </div>
          </div>

          {/* 4. Repo Trust */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{ga.repo_trust.name}</h3>
                  <p className="text-[11px] text-slate-400">Weight: 20% (Max {ga.repo_trust.max} pts)</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-blue-400">+{ga.repo_trust.gained}</span>
                <span className="text-xs text-rose-400 ml-1.5 font-semibold">(-{ga.repo_trust.lost})</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${ga.repo_trust.max > 0 ? (ga.repo_trust.gained / ga.repo_trust.max) * 100 : 0}%`,
                  }}
                  className="h-full bg-blue-500 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rewards contributions to mature community projects with history and stars; assigns 0 trust to fresh personal repos.
              </p>
            </div>
          </div>
        </div>

        {/* Side-by-side Highlights & Deductions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Points Gained Box */}
          <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Where Points Were Gained (+{totalScore} pts)</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>+{ga.merge_legitimacy.gained} pts</strong> from independent maintainer merges across {prs.filter((p) => p.merged && p.breakdown?.merge_legitimacy > 0).length} PRs.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>+{ga.change_substance.gained} pts</strong> for substantive code changes across {prs.length} pull requests.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>+{ga.repo_trust.gained} pts</strong> for targeting established open source community repositories.
                </span>
              </li>
            </ul>
          </div>

          {/* Points Lost Box */}
          <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/25 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <TrendingDown className="w-4 h-4" />
              <span>Where Points Were Lost / Deductions (-{pointsLost} pts)</span>
            </div>
            {allLossReasons.length > 0 ? (
              <ul className="space-y-2 text-xs text-slate-300 max-h-40 overflow-y-auto pr-1">
                {allLossReasons.slice(0, 5).map((loss, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">PR #{loss.prNum} ({loss.repo}):</strong> {loss.reason}
                    </span>
                  </li>
                ))}
                {allLossReasons.length > 5 && (
                  <p className="text-[11px] text-slate-400 italic">
                    +{allLossReasons.length - 5} more specific deduction items below in PR audit trail.
                  </p>
                )}
              </ul>
            ) : (
              <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Zero points forfeited! Contributor achieved full score across all opened PRs.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION: ITEMIZED PR AUDIT TRAIL UNDER IT
          ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-indigo-400" />
              Itemized PR Audit Trail ({filteredPrs.length} PRs)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review mathematically calculated rubric signals and any triggered anti-gaming rules per contribution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 flex items-center text-xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  filterType === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({prs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('flagged')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  filterType === 'flagged' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Flagged ({prs.filter((p) => p.flagged).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('clean')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  filterType === 'clean' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Clean ({prs.filter((p) => !p.flagged).length})
              </button>
            </div>

            <button
              type="button"
              onClick={Object.keys(expandedPrs).length > 0 ? collapseAll : expandAll}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
            >
              {Object.keys(expandedPrs).length > 0 ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>

        {/* PR List */}
        {filteredPrs.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-sm">
            No pull requests match the current filter.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPrs.map((pr) => {
              const isExpanded = !!expandedPrs[pr.number];
              const prLoss = Math.round(100.0 - (pr.score || 0));

              return (
                <div
                  key={pr.number + pr.repo}
                  className={`rounded-2xl border transition shadow-lg overflow-hidden ${
                    pr.flagged
                      ? 'bg-rose-950/15 border-rose-500/40 hover:border-rose-500/70'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* PR Header Bar */}
                  <div
                    onClick={() => toggleExpand(pr.number)}
                    className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-1">
                        {pr.merged ? (
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <GitMerge className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                            <GitPullRequest className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-indigo-300">
                            {pr.repo}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">#{pr.number}</span>

                          {pr.merged ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                              Merged {pr.merged_by ? `by @${pr.merged_by}` : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                              Open / Unmerged
                            </span>
                          )}

                          {pr.flagged && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              Gaming Flag Triggered
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-white text-base truncate hover:text-indigo-300 transition">
                          {pr.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {pr.created_at ? new Date(pr.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                          <span className="font-mono text-emerald-400">+{pr.additions || 0}</span>
                          <span className="font-mono text-rose-400">-{pr.deletions || 0}</span>
                          <span>{pr.files_changed || 0} files</span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            {pr.review_comment_count || 0} reviews & comments
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PR Score Pill & Expand Toggle */}
                    <div className="flex items-center gap-4 sm:self-center shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-white">{pr.score}</span>
                          <span className="text-xs text-slate-400 font-mono">/ 100</span>
                        </div>
                        {prLoss > 0 ? (
                          <span className="text-[11px] font-semibold text-rose-400">-{prLoss} pts lost</span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-400">Full 100 pts!</span>
                        )}
                      </div>

                      <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Audit Breakdown */}
                  {isExpanded && (
                    <div className="p-5 border-t border-slate-800/80 bg-slate-950/60 space-y-4">
                      {/* Flag Warning Box */}
                      {pr.flagged && (
                        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                            <ShieldAlert className="w-4 h-4" />
                            <span>Anti-Gaming Rules Engine Triggered:</span>
                          </div>
                          <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
                            {pr.flag_reason || (pr.flag_reasons && pr.flag_reasons.join(' | ')) || 'Suspicious contribution pattern'}
                          </p>
                        </div>
                      )}

                      {/* 4 Rubric Chips */}
                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Signal Points Breakdown
                        </h5>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <p className="text-slate-400">Merge Legitimacy (40%)</p>
                            <p className="text-base font-bold text-emerald-400 mt-0.5">
                              {pr.breakdown?.merge_legitimacy ?? 0}{' '}
                              <span className="text-xs font-normal text-slate-500">/ 40 pts</span>
                            </p>
                            {pr.breakdown?.merge_loss_reason && (
                              <p className="text-[10px] text-rose-400 mt-1 leading-tight">
                                {pr.breakdown.merge_loss_reason}
                              </p>
                            )}
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <p className="text-slate-400">Review Engagement (20%)</p>
                            <p className="text-base font-bold text-indigo-400 mt-0.5">
                              {pr.breakdown?.review_engagement ?? 0}{' '}
                              <span className="text-xs font-normal text-slate-500">/ 20 pts</span>
                            </p>
                            {pr.breakdown?.review_loss_reason && (
                              <p className="text-[10px] text-rose-400 mt-1 leading-tight">
                                {pr.breakdown.review_loss_reason}
                              </p>
                            )}
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <p className="text-slate-400">Change Substance (20%)</p>
                            <p className="text-base font-bold text-amber-400 mt-0.5">
                              {pr.breakdown?.change_substance ?? 0}{' '}
                              <span className="text-xs font-normal text-slate-500">/ 20 pts</span>
                            </p>
                            {pr.breakdown?.substance_loss_reason && (
                              <p className="text-[10px] text-rose-400 mt-1 leading-tight">
                                {pr.breakdown.substance_loss_reason}
                              </p>
                            )}
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <p className="text-slate-400">Repo Trust (20%)</p>
                            <p className="text-base font-bold text-blue-400 mt-0.5">
                              {pr.breakdown?.repo_trust ?? 0}{' '}
                              <span className="text-xs font-normal text-slate-500">/ 20 pts</span>
                            </p>
                            {pr.breakdown?.repo_loss_reason && (
                              <p className="text-[10px] text-rose-400 mt-1 leading-tight">
                                {pr.breakdown.repo_loss_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* External PR Link */}
                      <div className="flex items-center justify-between pt-2 text-xs">
                        <span className="text-slate-400">
                          Repository age: {pr.repo_created_at ? new Date(pr.repo_created_at).toLocaleDateString() : 'N/A'} • Stars: {pr.repo_stars || 0}
                        </span>
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
                        >
                          <span>Inspect on GitHub</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

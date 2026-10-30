import React from 'react';
import Leaderboard from './components/Leaderboard';
import { Scale, ShieldCheck, Zap, Terminal } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">FairPlay</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                  v1.0 • Devf8rge Hack Day
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Transparent Anti-Gaming PR Leaderboard for Hackathons
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>4-Signal Weighted Rubric Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Intro Mission Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl">
          <div className="max-w-3xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Solving the Hackathon PR Gaming Problem
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Rewarding genuine open-source impact, not throwaway typo PRs.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Traditional hackathons count raw pull requests, incentivizing participants to spam typo fixes and self-merged throwaway repos. FairPlay scores every contribution on an auditable <span className="text-white font-semibold">0–100 rubric</span> (Merge Legitimacy 40%, Review Engagement 20%, Change Substance 20%, Repo Trust 20%) and auto-flags gaming patterns with plain-language reasons.
            </p>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        </div>

        {/* Live Leaderboard Engine */}
        <Leaderboard />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>FastAPI • GitHub GraphQL v4 • SQLite Response Cache • React 18 & Tailwind</span>
          </div>
          <div>MIT License • FairPlay Open Source</div>
        </div>
      </footer>
    </div>
  );
}

export default App;

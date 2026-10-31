import React, { useState, useEffect } from 'react';
import Leaderboard from './components/Leaderboard';
import ContributorDetail from './components/ContributorDetail';
import TrackedRepos from './components/TrackedRepos';
import TokenGate from './components/TokenGate';
import {
  Scale,
  ShieldCheck,
  Zap,
  Terminal,
  KeyRound,
  Users,
  FolderGit2,
  Lock,
  CheckCircle2,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  LeaderboardEntry,
  VerifyTokenResponse,
  fetchLeaderboard,
  getStoredToken,
  setStoredToken,
  verifyToken,
} from './lib/api';

type ActiveTab = 'leaderboard' | 'repositories';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authData, setAuthData] = useState<VerifyTokenResponse | null>(null);
  const [currentToken, setCurrentToken] = useState<string>('');
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('leaderboard');
  const [selectedContributor, setSelectedContributor] = useState<LeaderboardEntry | null>(null);

  // Auto-check stored token on mount
  useEffect(() => {
    const checkInitialAuth = async () => {
      const stored = getStoredToken();
      if (stored) {
        try {
          const res = await verifyToken(stored);
          if (res.valid) {
            setAuthData(res);
            setCurrentToken(stored);
            setIsAuthenticated(true);
            return;
          }
        } catch {
          // fallback to unauthenticated gate
        }
      }
    };
    checkInitialAuth();
  }, []);

  const handleAuthSuccess = (res: VerifyTokenResponse, tokenStr: string) => {
    setAuthData(res);
    setCurrentToken(tokenStr);
    setIsAuthenticated(true);
    setShowTokenModal(false);
  };

  const handleDisconnectToken = () => {
    setStoredToken(null);
    setCurrentToken('');
    setAuthData(null);
    setIsAuthenticated(false);
  };

  const handleContributorSelected = (contributor: LeaderboardEntry) => {
    setSelectedContributor(contributor);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectUserByName = async (username: string) => {
    try {
      const data = await fetchLeaderboard({
        usernames: [username],
        customToken: currentToken,
      });
      if (data && data.length > 0) {
        setSelectedContributor(data[0]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setActiveTab('leaderboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Hackathon Identity */}
          <div
            onClick={() => setSelectedContributor(null)}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">FairPlay</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                  PS-04 • Devf8rge Hack Day
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Transparent Anti-Gaming PR Leaderboard for Hackathons
              </p>
            </div>
          </div>

          {/* Center Tabs Navigation (Visible when authenticated) */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('leaderboard');
                  setSelectedContributor(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition ${
                  activeTab === 'leaderboard' && !selectedContributor
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Leaderboard</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('repositories');
                  setSelectedContributor(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition ${
                  activeTab === 'repositories'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Tracked Repos</span>
              </button>
            </div>
          )}

          {/* Right Header Status / PAT Controls */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {/* Verified Identity Badge */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/70 text-xs">
                  {authData?.user?.avatar_url ? (
                    <img
                      src={authData.user.avatar_url}
                      alt={authData.user.login}
                      className="w-4 h-4 rounded-full border border-emerald-500"
                    />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span className="font-semibold text-white">
                    @{authData?.user?.login || 'Connected'}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400">
                    ({authData?.rate_limit?.graphql_remaining.toLocaleString() || '5,000'} req/hr)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTokenModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
                  title="Change GitHub PAT"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full font-medium">
                <Lock className="w-3.5 h-3.5" />
                <span>PAT Required</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Tabs */}
        {isAuthenticated && (
          <div className="md:hidden flex border-t border-slate-800/80 px-4 py-2 bg-slate-950/50 justify-around text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('leaderboard');
                setSelectedContributor(null);
              }}
              className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 ${
                activeTab === 'leaderboard' && !selectedContributor ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Leaderboard</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('repositories');
                setSelectedContributor(null);
              }}
              className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 ${
                activeTab === 'repositories' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Tracked Repos</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* STEP 1: If Not Authenticated -> Show Initial API Key / PAT Access Screen */}
        {!isAuthenticated ? (
          <div className="space-y-8">
            <TokenGate onSuccess={handleAuthSuccess} />
          </div>
        ) : (
          /* STEP 2, 3, 4: Authenticated Views */
          <div className="space-y-8">
            {/* Show Banner if on Leaderboard and not viewing deep-dive */}
            {activeTab === 'leaderboard' && !selectedContributor && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl">
                <div className="max-w-3xl space-y-3 relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                    <Zap className="w-3.5 h-3.5 text-indigo-400" />
                    Devf8rge Hack Day • Track 2: Contributing to Open Source Software
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
            )}

            {/* View 1: Deep Dive Graphical Analysis View for Contributor */}
            {selectedContributor ? (
              <ContributorDetail
                contributor={selectedContributor}
                onBack={() => setSelectedContributor(null)}
              />
            ) : activeTab === 'leaderboard' ? (
              /* View 2: Live Leaderboard View */
              <Leaderboard
                onSelectContributor={handleContributorSelected}
                customToken={currentToken}
              />
            ) : (
              /* View 3: Tracked Repositories View with Changelogs */
              <TrackedRepos
                onSelectContributor={handleSelectUserByName}
              />
            )}
          </div>
        )}
      </main>

      {/* Modal for Token Switch */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl">
            <TokenGate
              onSuccess={handleAuthSuccess}
              onCancel={() => setShowTokenModal(false)}
              isModal={true}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-6 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>FastAPI • GitHub GraphQL v4 • SQLite Response Cache • React 18 & Tailwind</span>
          </div>
          <div>MIT License • FairPlay Open Source • Devf8rge Hack Day</div>
        </div>
      </footer>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Database,
  Activity,
} from 'lucide-react';
import {
  VerifyTokenResponse,
  getStoredToken,
  setStoredToken,
  verifyToken,
} from '../lib/api';

interface TokenGateProps {
  onSuccess: (verifiedData: VerifyTokenResponse, tokenStr: string) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function TokenGate({
  onSuccess,
  onCancel,
  isModal = false,
}: TokenGateProps) {
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<VerifyTokenResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check if token was previously saved
  useEffect(() => {
    const existing = getStoredToken();
    if (existing) {
      setTokenInput(existing);
      handleVerify(existing, false);
    }
  }, []);

  const handleVerify = async (tokenToTest: string, shouldNotifyParent = true) => {
    const clean = tokenToTest.trim();
    setVerifying(true);
    setErrorMsg(null);

    try {
      const res = await verifyToken(clean);
      if (res.valid) {
        setVerificationResult(res);
        setStoredToken(clean === 'default' ? '' : clean);
        if (shouldNotifyParent) {
          onSuccess(res, clean);
        }
      } else {
        setErrorMsg(res.error || 'Failed to authenticate token with GitHub API.');
        setVerificationResult(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error verifying token.');
      setVerificationResult(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleQuickDemoAccess = () => {
    handleVerify('default', true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMsg('Please enter a GitHub Personal Access Token or use the Quick Demo access.');
      return;
    }
    handleVerify(tokenInput, true);
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${isModal ? 'p-0' : 'py-8'}`}>
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            Step 1: GitHub API Access Gateway
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Connect GitHub Access Token
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            FairPlay audits participants by fetching PRs, maintainer reviews, and repo metadata via the GitHub GraphQL v4 API. Connecting a Personal Access Token (PAT) unlocks <strong>5,000 requests/hour</strong> for instant, unthrottled scoring.
          </p>
        </div>

        {/* Token Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              GitHub Personal Access Token (classic or fine-grained)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                className="w-full pl-10 pr-12 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
              <span>Token only requires</span>
              <code className="text-indigo-400 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-800/40 text-[11px]">public_repo</code>
              <span>read permissions. Tokens are never stored on external servers.</span>
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-semibold">Authentication Notice</p>
                <p className="text-rose-200/90 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Verified Preview Card */}
          {verificationResult && verificationResult.valid && (
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {verificationResult.user?.avatar_url ? (
                  <img
                    src={verificationResult.user.avatar_url}
                    alt={verificationResult.user.login}
                    className="w-10 h-10 rounded-full border border-emerald-500/40"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      @{verificationResult.user?.login || 'Authenticated User'}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    GraphQL Quota:{' '}
                    <span className="text-emerald-400 font-semibold font-mono">
                      {verificationResult.rate_limit?.graphql_remaining.toLocaleString()} /{' '}
                      {verificationResult.rate_limit?.graphql_limit.toLocaleString()}
                    </span>{' '}
                    remaining
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSuccess(verificationResult, tokenInput || 'default')}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={verifying}
              className="w-full sm:w-auto flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Verifying Token...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Verify & Enter Console</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleQuickDemoAccess}
              disabled={verifying}
              className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Use Pre-configured Server Token</span>
            </button>

            {isModal && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 font-medium text-sm transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Informational Footer */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Anti-Gaming Rubric Engine Ready</span>
          </div>
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition"
          >
            <span>Generate token on GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

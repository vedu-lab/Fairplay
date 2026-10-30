# FairPlay — Transparent Anti-Gaming PR Leaderboard for Hackathons

## 1. Overview & Problem Solved
Traditional open-source hackathons and coding events reward raw pull request counts, incentivizing participants to game leaderboards through typo fixes, self-merged PRs to throwaway personal repositories, and automated whitespace changes. Genuine contributors making substantial architectural improvements get drowned out, and organizers typically only discover gaming patterns after prizes have already been awarded. FairPlay replaces blind PR counting with an auditable, point-by-point scoring engine that evaluates every contribution against an objective rubric and automatically flags gaming patterns with plain-language explanations.

## 2. How It Works
FairPlay provides organizers with an automated, transparent evaluation workflow:

1. **Submission**: The event organizer submits a list of GitHub usernames and an event date window (no OAuth permissions required from participants).
2. **Batched Ingestion**: FairPlay queries the GitHub GraphQL v4 API to fetch all pull requests opened by each participant within the specified event window.
3. **Rubric Scoring**: Each PR is evaluated on a 0–100 weighted rubric measuring merge legitimacy, review engagement, change substance, and repository trust.
4. **Gaming Detection Pass**: A modular rules engine independently inspects each contribution for gaming patterns (e.g., self-owned fresh throwaway repos, self-merged PRs, micro-diff typo bursts).
5. **Auditable Leaderboard**: Organizers view a ranked leaderboard; clicking any participant expands into an itemized, per-PR rubric breakdown showing the exact mathematical signals and any triggered anti-gaming flags.

## 3. How Scoring Works

### The 4-Signal Weighted Rubric (0–100 Points)
Each pull request is evaluated on four core signals summing to a maximum of 100 points:

- **40% Merge Legitimacy (0–40 pts)**: Rewards PRs merged by an independent repository maintainer. PRs that are self-merged by the author or remain open/unmerged receive 0 points.
- **20% Review Engagement (0–20 pts)**: Rewards genuine peer review discussions and multi-round code reviews over unreviewed or rubber-stamped approvals.
- **20% Change Substance (0–20 pts)**: Evaluates lines added, lines deleted, and files modified to distinguish meaningful features and bug fixes from single-character whitespace or typo modifications.
- **20% Repo Trust (0–20 pts)**: Rewards contributions made to established, active community repositories based on repository age, stars, and fork counts, while assigning baseline zero trust to throwaway repos owned by the contributor.

### Gaming Detection Rules
In addition to the continuous rubric score, FairPlay runs an independent audit pass:
- **Fresh Self-Owned Repositories**: Flags PRs opened in repositories owned by the contributor that were created within 7 days of the PR itself (throwaway repo gaming pattern).
- **Self-Merged Pull Requests**: Flags PRs merged directly by the PR author without independent maintainer sign-off.
- **Trivial / Whitespace Bursts**: Flags single-file changes with $\le 2$ modified lines attempting to pad PR volume.

## 4. Architecture
FairPlay is architected as an asynchronous, single-process full-stack application designed for fast, resilient hackathon operations:

- **FastAPI (Async Python 3.12 Backend)**: Handles concurrent multi-participant audits using `asyncio` without blocking the event loop.
- **GitHub GraphQL v4 Batching**: Pulls pull requests, reviews, comments, and repository metadata in single consolidated GraphQL queries, drastically cutting down GitHub API round-trips compared to REST v3 (with an automated REST v3 fallback if GraphQL is unavailable).
- **SQLite Response Cache**: Persists raw GitHub API responses keyed by `(username, since, until)` so subsequent leaderboard reloads or sorting changes execute instantly without hitting GitHub rate limits.
- **React 18 + Vite + Tailwind CSS Frontend**: Provides an interactive, responsive dashboard with expandable audit cards and real-time rubric visualization.
- **Single-Process Deployment**: In production, FastAPI directly serves both the `/api/*` endpoints and the compiled static React SPA bundle from `frontend/dist` via a single `uvicorn` instance, eliminating the need for separate frontend servers or reverse proxies.

## 5. Setup Instructions

### Prerequisites
- Python 3.12+
- Node.js 18+ and npm
- A GitHub Personal Access Token (classic or fine-grained with read access to public repositories)

### 1. Clone the Repository
```bash
git clone https://github.com/vedu-lab/Fairplay.git
cd Fairplay
```

### 2. Configure Environment Variables
Create a `.env` file in the project root or inside `backend/`:
```bash
cp .env.example backend/.env
```
Edit `backend/.env` and insert your GitHub token:
```env
GITHUB_TOKEN=ghp_your_github_personal_access_token
```

### 3. Install Backend Dependencies
```bash
python3 -m pip install -r backend/requirements.txt
```

### 4. Install Frontend Dependencies & Build Bundle
```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. Run the Application (Single-Process)
Run the application using Uvicorn:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Open your browser and navigate to:
```
http://127.0.0.1:8000
```

*(Optional) Frontend Development Mode with Vite HMR:*
```bash
# Terminal 1: Backend
uvicorn backend.app.main:app --port 8000 --reload

# Terminal 2: Vite Dev Server
cd frontend
npm run dev
```

## 6. Tech Stack
- **Backend**: Python 3.12, FastAPI, Uvicorn, HTTPX (async client), Pydantic v2 / Pydantic-Settings, SQLite3
- **External API**: GitHub GraphQL API v4 (primary), GitHub REST API v3 (fallback)
- **Frontend**: TypeScript, React 18, Vite 5, Tailwind CSS 3, Lucide React
- **Tooling**: Node.js, npm, Git

## 7. License
This project is licensed under the [MIT License](LICENSE).

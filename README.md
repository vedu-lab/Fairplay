# FairPlay

FairPlay is a developer-productivity tool that turns PR-count leaderboards into an auditable quality signal — catching gaming before it ships to the prize table. In open-source hackathons and contribution sprints, raw PR counts are easily gamed through throwaway self-owned repositories and trivial typo modifications, causing genuine contributors doing substantial work to lose rank. FairPlay restores integrity to event standings by evaluating each pull request on a transparent, multi-signal rubric backed by auditable gaming detection.

## How It Works

FairPlay automates contributor auditing in five clear steps:

1. **Submit Participants**: The event organiser submits a list of GitHub usernames and specifies the event date window.
2. **Fetch Contributions**: FairPlay queries GitHub to retrieve every pull request opened by each participant within that window.
3. **Rubric Scoring**: Each pull request is scored on a 0–100 scale across a weighted four-signal rubric.
4. **Gaming Detection Pass**: A dedicated rules pass inspects contributions for adversarial patterns, such as self-owned fresh repos, unreviewed self-merges, and near-duplicate changes.
5. **Live Auditable Leaderboard**: The organiser sees a real-time leaderboard where every score and flag expands into its exact, point-by-point reasoning.

## Scoring Rubric

Every pull request is scored on a 0–100 scale using four weighted signals:

- **40% Merge legitimacy**: Merged by someone other than the author (verifies independent maintainer acceptance; unmerged, open, or self-merged PRs receive 0 points).
- **20% Review engagement**: Measures meaningful review comments and peer discussion versus rubber-stamped or unreviewed merges.
- **20% Change substance**: Evaluates lines added, lines deleted, and files modified to reward real code contributions over trivial whitespace or single-line README edits.
- **20% Repo trust**: Distinguishes contributions to established, active community repositories from self-owned or freshly-created personal repos based on repository age, stars, and activity.

### Gaming-Pattern Detection: Two-Tier Architecture

To catch bad-faith submissions while maintaining low latency and zero unnecessary overhead, FairPlay employs an intentional two-tier detection architecture:

- **Tier 1 (Deterministic Diff-Fingerprint Matching)**: A high-throughput, rule-based engine that evaluates metadata heuristics and computes deterministic normalized diff hashes across submissions. It instantly catches exact and near-duplicate PRs across multiple repositories, micro-diff typo bursts, self-merged PRs, and repos created within 7 days of the PR without requiring external AI dependencies or GPU resources.
- **Tier 2 (Semantic Embedding Analysis — Optional)**: An optional lightweight layer powered by an open MiniLM (`all-MiniLM-L6-v2`) embedding model. Tier 2 analyzes PR titles, descriptions, and diff semantic representations to catch semantically paraphrased duplicates and prompt-templated code variations that evade Tier 1 syntactic fingerprinting.

This layered design ensures the primary evaluation loop runs in milliseconds on standard CPU hardware while providing deep semantic audit capabilities when advanced adversarial gaming is suspected.

## Architecture

FairPlay is built with a clean separation of concerns, optimized for speed, rate-limit safety, and straightforward hosting:

- **Async FastAPI Backend (Python)**: Handles concurrent multi-participant audits asynchronously, ensuring non-blocking execution across large batches of usernames.
- **GitHub GraphQL v4 with REST Fallback**: Employs GraphQL v4 to batch PR, review, comment, and repository queries into consolidated requests to minimize network roundtrips, with an automatic REST v3 fallback.
- **SQLite Response Caching**: Caches raw GitHub API responses keyed by `(username, since, until)`, preventing redundant external API calls, safeguarding GitHub rate limits, and making repeated leaderboard reloads instantaneous.
- **React / Vite Frontend**: Provides a responsive, sortable leaderboard interface with interactive expandable cards displaying granular rubric scores and rule violation alerts.
- **Single-Process Deployment**: FastAPI serves both the JSON REST API (`/api/*`) and the compiled static React production bundle (`frontend/dist`) under a single `uvicorn` process, eliminating the need for separate proxy layers or frontend containers.

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/vedu-lab/Fairplay.git
cd Fairplay
```

### 2. Configure GitHub Token
Create a `.env` file in `backend/` (or the project root) and add your GitHub Personal Access Token:
```bash
cp backend/.env.example backend/.env
```
```env
GITHUB_TOKEN=ghp_your_personal_access_token_here
```

### 3. Install Backend Dependencies
```bash
pip install -r backend/requirements.txt
```

### 4. Install Frontend Dependencies & Build Bundle
```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. Run the Application

**Option A: Single-Process Mode (FastAPI serves both API and built UI)**
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Navigate to `http://localhost:8000` in your browser.

**Option B: Development Mode (with Vite HMR)**
```bash
# Terminal 1: Backend
uvicorn backend.app.main:app --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

## Tech Stack

- **Backend**: Python 3.12, FastAPI, Uvicorn, HTTPX, Pydantic, SQLite3
- **External API**: GitHub GraphQL v4, GitHub REST v3
- **Frontend**: TypeScript, React 18, Vite, Tailwind CSS, Lucide React
- **Audit Engine**: Deterministic diff-fingerprinting (Tier 1), Sentence-Transformers MiniLM (Tier 2 optional)

## Roadmap

Run as a GitHub Action against an event's repos directly, instead of only through the web dashboard.

## License

[MIT](LICENSE)

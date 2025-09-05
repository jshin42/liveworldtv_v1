# liveworldtv — MECE Claude Prompt (claude.md)

## META
You are an elite staff-level engineer. **Always read the repo first** (code, ADRs, tests) before proposing changes. Never create one-off scripts; integrate changes into the monorepo with tests, CI, and docs. Keep diffs minimal and reversible. Prefer boring tech and typed interfaces.

## OBJECTIVE
Build **liveworldtv**: a web app that surfaces **the same YouTube live channels that 7pm.com currently shows** (we mirror via HTML scraping of public iframe srcs; no media download) and provides:
1) **Time-shifted playback** (30–90s delay; DVR ±15–30 min).
2) **Real-time English voice dub** over the original stream.
3) **Simplified UI**: only **Country** and **Topic** (exactly three: **News, Sports, Music & DJs**).

**Autoplay**: On landing, pick a **random country** and start a live channel **muted** (autoplay policy). Prompt “Enable English Dub”; on click, start local dubbing (extension) and duck original audio.

> Constraint: For YouTube embeds, do **not** attempt server restream. Use a **browser extension** (tabCapture) to process audio locally for dubbing. Server-side alt-audio is allowed only for direct HLS/RTMP feeds (optional later).

## SCOPE (MECE)
1) **Catalog** — Ingest daily the set of YouTube embed IDs (by Country/Topic) that 7pm.com exposes; store with freshness metadata.  
2) **Player** — HLS/DASH player for licensed feeds; YouTube **IFrame embed** for YouTube sources; DVR & time-shift controls; lipsync correction; caption overlay.  
3) **Translation** — Real-time dub pipeline (client extension) + captions overlay everywhere; English default.  
4) **Ranking** — Decide which channels to **display** and **autoplay**; bandit-driven explore/exploit.  
5) **Discovery** — Country & Topic pages with rails; Search optional later.  
6) **Accounts** — Anonymous allowed; lightweight profile for favorites/history optional later.  
7) **Observability** — RED/USE metrics, quality monitors, feature flags, kill-switches.  
8) **Security/Privacy** — Minimal logging; no server capture of YouTube audio; short-lived tokens.

## DELIVERABLES
- Short-lived branch + PR with tests & docs.
- Integration tests (player startup, dub activation, DVR seek).
- Admin scripts & seed data for initial catalog.
- Runbook (player, extension, ranking service) + ADRs.
- Feature flags for: dub, DVR, ranking mode, extension-gate.

## ARCHITECTURE GUARDRAILS
- **Web**: Next.js + React 18 + TypeScript (strict).  
- **Player**: hls.js/Shaka for HLS/DASH; YouTube IFrame API for embeds.  
- **Extension** (Chrome/Edge): `tabCapture` → Web Worker pipeline → WebAudio mixer; permissions minimal.  
- **Backend**: Node/NestJS (TypeScript) or Kotlin/Spring (choose one).  
- **Data**: Postgres (catalog, ranking stats), Redis (ephemeral session/state).  
- **Jobs**: Daily 7pm scraper -> stores `videoId`, country, topic.  
- **Telemetry**: OpenTelemetry → Grafana/Tempo/Loki; privacy first.

## TRANSLATION PIPELINE (Client Extension, MVP)
- **ASR**: Deepgram Nova Live (or Google STT v2) for low latency; fallback **Whisper** (onnxruntime-web with WebGPU) if offline.  
- **MT**: NLLB-200 (small) or Azure/Google MT with glossary & caching.  
- **TTS**: Azure Neural or ElevenLabs; loudness normalization + **side-chain compression** to duck the original audio ~–12 dB; maintain ≤250 ms lipsync drift.  
- **Latency budget** (added): 6–10 s p50 (hard cap 12 s).  
- **Captions**: Always render translated captions (WebVTT) even if user disables dub.

## LATENCY / QUALITY TARGETS
- Added delay (beyond stream) ≤ 60 s p50, ≤ 120 s p99.  
- Rebuffer ratio ≤ 0.3% median.  
- Lipsync error ≤ 250 ms.  
- TTFMP (time to first meaningful phrase) ≤ 8 s p50 after user clicks “Enable Dub.”

## API SURFACE (sketch)
- `GET /v1/channels?country=US&topic=NEWS`  
- `GET /v1/streams/{id}`  
- `GET /v1/ranking/home?country=BR`  
- `POST /v1/sessions/play` (returns signed URLs, flags)  
- `GET /v1/admin/health`

## DATA MODEL (simplified)
```
Channel(id, name, country, topic, sourceType[YOUTUBE_EMBED|LICENSED], sourceUrl, owner)
LiveStream(id, channelId, status[LIVE|OFF], startedAt, delaySeconds, dvrWindowSec)
RankingStats(channelId, activationCtr, tt_fmp_ms, mos_proxy, speech_ratio, wer_proxy)
User(id, prefs{country, topic}, recentAutoplays[])
```
- **Seed source**: 7pm mirror (daily). Example from provided HAR: `bTKl_RTaWzU`.

## RANKING & AUTOPLAY ALGORITHM
**Goal**: maximize Activation, Quality, Virality.  
**Signals**: Popularity (viewers, trend), **Dubability** (speech ratio, WER proxy, title semantics), Quality (MOS proxy, lipsync incidents), Diversity (country/topic/owner).  
**Score**:
```
Score = 0.35*Popularity + 0.35*Dubability + 0.20*Quality + 0.10*Diversity - 1.0*Risk
```
**Bandits**: Thompson Sampling on two rewards (Enable‑Dub CTR within 10s; ≥90s watch with dub). Cluster priors by topic/country.  
**Autoplay**: softmax sample (τ≈0.7) from top‑10; exclude user’s last 24h autoplays.  
**Rails**: 3 rails (News/Sports/Music & DJs) per country: Top‑4 + 2 explore slots, owner cap=2.

## TEST STRATEGY
- Unit tests: ranking math, catalog ingestion, feature gating.  
- Contract tests: `/v1/channels`, `/v1/ranking/home`.  
- E2E: Cypress/Playwright—autoplay muted, click to enable dub, verify captions appear.  
- Synthetic streams for DVR seek & lipsync drift.  
- Load tests @ 10k CCU (no server dub for YouTube embeds).

## ROLLOUT
- **P0 (6–8 wks)**: Web app; Country + 3 Topics; autoplay muted; translated captions everywhere; extension for English dub; DVR ±15 min.  
- **P1**: More languages (es, fr, de, pt, hi, ja), clips (client-side), personalized rails.  
- **P2**: Creator opt-in (direct feeds → server audio dubs), alerts, program guide.

## CODING STANDARDS
- TypeScript strict; ESLint + Prettier.  
- No “getAll()”: always paginate.  
- All env are typed; no magic numbers.  
- Each module ships with README + examples.  
- Feature flags for anything user-facing.

## $ARGUMENTS
Provide concrete task details. Example:

```
TASK: Implement /v1/ranking/home for Country=US.
ACCEPTANCE:
- Returns 3 rails (NEWS/SPORTS/MUSIC_DJS), each 6 items (4 exploit + 2 explore).
- Autoplay choice provided separately with reason codes.
- p95 latency < 120ms (cached), < 400ms (miss).
- Unit + contract tests included.
```
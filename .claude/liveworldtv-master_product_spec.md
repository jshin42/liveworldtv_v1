# liveworldtv — Master Product Spec (master_product_spec.md)

## 1) Summary
**liveworldtv** shows the **same YouTube live channels surfaced by 7pm.com** (we mirror their public embed IDs) and adds two delighters: **time-shift** and **real‑time English dub**. The UI is intentionally minimal: pick a **Country** and one of **three Topics** (News, Sports, Music & DJs). On first visit, we **autoplay a random country** (muted) and prompt to enable English dub.

> Practical constraint: For YouTube embeds we do **client‑side** dubbing via a **browser extension** (tabAudio capture → streaming ASR → MT → TTS → WebAudio mix). Server-side alternate audio is reserved for direct HLS/RTMP feeds (optional later).

## 2) Goals / Non-goals
**Goals**
- First‑minute “wow”: hear any country’s live TV in English within ~10 s after click.
- Low-friction discovery (Country + Topic) with autoplay.
- High MOS for TTS dub; low drift; low rebuffer.

**Non-goals**
- Server-side restream of YouTube audio/video.
- Heavy account system; we allow anonymous usage.

## 3) Personas
- **News Polyglot** — wants global news in English now.
- **Expat** — jumps between home channels across regions.
- **Curious Scroller** — explores “what the world is saying.”

## 4) User Journeys
1. Land on home → **autoplay** a random country’s channel (muted) → click “Enable English Dub” → hear dubbed audio.  
2. Switch **Country** or **Topic**; rails update via ranking algorithm → select channel → dub continues.  
3. Share a **timestamp deep-link** to the current moment (caption + dub on open).

## 5) Requirements (MECE)

### 5.1 Content & Sources
- **Seed catalog** daily by scraping 7pm’s public HTML and capturing iframe `src` **YouTube embed IDs** and metadata (country, topic). No media download.  
- Store freshness (first seen / last seen) and attach owner/channel if detectable via YouTube APIs.  
- Example ID found in provided HAR: `bTKl_RTaWzU`.

### 5.2 Player & Time‑Shift
- YouTube sources play via IFrame API; licensed feeds via hls.js/Shaka.  
- **Delay**: default 30–60 s; **DVR**: ±15–30 min.  
- **Controls**: Play/pause, seek within DVR window, captions toggle, language (English only at MVP).  
- **Autoplay**: start muted; show “Enable English Dub.”

### 5.3 Translation (Real‑time Dub + Captions)
- **Embeds (YouTube)**: UNIVERSAL **translated captions**; **English audio dub** provided via **extension** only.  
- **Licensed feeds (optional)**: server generates alternate audio tracks (HLS audio groups).  
- **ASR**: Deepgram Nova Live / Google STT v2; fallback Whisper (onnxruntime-web, WebGPU).  
- **MT**: NLLB‑200 (small) or Azure/Google MT + glossary + cache.  
- **TTS**: Azure Neural / ElevenLabs (broadcast tone), loudness normalization, **side‑chain compression** to duck original ~–12 dB; lipsync ≤ 250 ms.  
- **Latency budget**: 6–10 s added p50; 12 s hard cap.

### 5.4 Discovery & Personalization
- **UI**: Country selector + Topic tabs (**News, Sports, Music & DJs**).  
- **Rails**: 3 rails per selected Country, each 6 items (Top‑4 + 2 explore slots).  
- **Search** (P1). **Favorites/History** (P1).

### 5.5 Ranking & Autoplay (Key)
**Signals**  
- **Popularity**: concurrent viewers, trend velocity, chat velocity (if available).  
- **Dubability**: speech ratio prior, WER proxy, title semantics (talk/news vs music).  
- **Quality**: MOS proxy (watch-time with dub / baseline), lip‑sync incidents, rebuffer.  
- **Diversity**: country/topic/owner coverage; owner cap per rail.  
- **Risk**: brand-safety on title/desc.

**Score**
```
Score = 0.35*Popularity + 0.35*Dubability + 0.20*Quality + 0.10*Diversity - 1.0*Risk
```
**Bandits**: Thompson Sampling on two rewards — Enable‑Dub CTR (<10s) and ≥90s watch with dub. Cluster priors by topic/country.  
**Autoplay**: softmax (τ≈0.7) over top‑10, excluding user’s recent autoplays (24h).  
**Diversity**: facility‑location objective ensures ≥3 distinct owners per rail; owner cap=2.

### 5.6 Admin & Ops
- Admin UI: view/add/remove channels (embed IDs), edit metadata, disable items.  
- Health: ingestion freshness, player starts, dub activation, TTFMP, rebuffering, drift.  
- Feature flags: dub, DVR, ranking mode, autoplay.

### 5.7 Analytics
- **Activation**: enable‑dub CTR, **TTFMP**.  
- **Quality**: MOS proxy, drift %, rebuffer %, caption usage.  
- **Virality**: deep-link share rate, K‑factor.  
- **Engagement**: dwell time per rail, CTR by topic.

## 6) Competitive Notes
- 7pm.com: curation layer. Our edge: **English dub**, **time‑shift**, **ranking for dubability**, minimalist UI.

## 7) System Design

### 7.1 Catalog seeding (7pm mirror)
- Scheduled job fetches 7pm pages per Country/Topic; parse iframe `src` → YouTube `videoId`; persist with timestamps.  
- If 7pm rotates away, fallback to YouTube Search API (`eventType=live`) filtered by Country/Topic heuristics.

### 7.2 High-level components
- **catalog-api** (Postgres) — channels, streams, metadata.  
- **ranking-svc** — feature extraction, score calc, bandits, diversity.  
- **player-web** — Next.js UI + IFrame player + captions overlay + dub toggle.  
- **extension** — tab audio capture → ASR → MT → TTS → local mix; captions generation; settings & diagnostics.
- **metrics** — OTel collector → Grafana (dashboards for Activation/Quality/Virality).

### 7.3 Latency budget (illustrative)
- Buffer 2 s → ASR window 2–3 s → MT < 500 ms → TTS 300–700 ms → alignment & mix < 800 ms → present next segment; **added** 6–10 s p50.

### 7.4 Data
```
tables:
  countries, topics, channels(id, country, topic, sourceType, sourceUrl, owner, firstSeen, lastSeen, active)
  streams(id, channelId, status, startedAt, delaySeconds, dvrWindowSec)
  ranking_stats(channelId, activationCtr, ttfmp_ms, mos_proxy, speech_ratio, wer_proxy, lastUpdated)
  play_events(userAnonId, channelId, ts, eventType, value)
```
Indexes for (country, topic, lastSeen desc), and daily rollups for ranking.

### 7.5 APIs
- `GET /v1/channels?country=XX&topic=NEWS`  
- `GET /v1/ranking/home?country=XX` → rails + autoplay pick + reason codes  
- `POST /v1/sessions/play` → flags (requires extension?), captions URL, etc.

### 7.6 Player specifics
- IFrame API for YouTube; captions overlay via WebVTT from our pipeline.  
- Alternate audio is **local** via extension; provide a “sync nudge” every segment to correct drift.  
- DVR/time‑shift implemented via MSE (licensed feeds) or IFrame’s limited seek for live where permitted.

## 8) Security, Privacy, Accessibility
- No server capture of YouTube audio; extension processes tab audio locally.  
- Anonymous by default; cookies store prefs.  
- Captions on by default; keyboard nav & contrast compliant.  
- Minimal PII; telemetry aggregated and anonymized.

## 9) Reliability Targets (MVP)
- Playback success ≥ 98.5% p50.  
- Rebuffer ratio ≤ 0.3% median.  
- Dub added latency ≤ 10 s p50; lipsync ≤ 250 ms.  
- Incident MTTR ≤ 30 min (player/extension issues).

## 10) Rollout
- **P0 (6–8 weeks)**: Web app (Country + 3 Topics), autoplay muted, captions, **extension** for English dub, DVR ±15 min, ranking v1.  
- **P1**: Languages es/fr/de/pt/hi/ja; clip deep-links; search; favorites.  
- **P2**: Creator opt-in (direct feeds → server dubs), alerts, program guide.

## 11) Monetization
- Free tier (ads); Premium removes ads + expands DVR + transcript export.  
- Later: rev-share with creators who opt in to direct feeds.

## 12) Risks & Mitigations
- **Autoplay with sound** blocked → start muted + one-click enable.  
- **Cross-origin audio** → extension for YouTube embeds; captions fallback.  
- **Latency drift** → small windows, frequent sync beacons.  
- **ASR/MT domain errors** → news-tuned vocab, name glossaries, user corrections.  
- **Cost** → dynamic model tiering; MT cache; TTS phrase reuse.

## 13) Growth & Virality
- **Moment share**: timestamp deep-links (dub + captions) with OG preview.  
- **Daily 3-country spotlight**: curiosity driver; one-tap share.  
- **Creator loop**: “Watch my live with English dub” link; we return transcripts.  
- **Flywheel**: traffic → better dub models (feedback) → higher MOS → more shares → creator opt-ins → direct feeds → better quality → more traffic.

**Key metrics**: Activation (enable‑dub CTR, TTFMP), K‑factor (≥0.25 wk1), MOS proxy, D1/D7 retention, share rate, creator opt-ins.

## 14) Acceptance Criteria (MVP)
- Landing page autoplays a random country’s channel (muted) in < 2 s TTFP on broadband.  
- On click, English dub starts; **TTFMP ≤ 8 s p50**; captions present.  
- Rails show 3×6 items per selected Country; autoplay pick has reason codes.  
- Admin can add/remove channels; ingestion freshness visible.  
- SLO dashboard live for Activation/Quality/Virality.

## 15) Open Questions
- Launch extension at day 1 or week 2?  
- Heuristic for “random country” (pure random vs trending weighted)?  
- WebGPU Whisper feasibility for mid‑range laptops without the extension?  
- Minimal creator incentives for early direct feeds?
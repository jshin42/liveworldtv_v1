# liveworldtv — Proposal Design Doc

## Problem & Context

Global live television content is siloed by language barriers. Existing solutions like 7pm.com provide discovery but lack accessibility features for non-native speakers. Users interested in international news, sports, and entertainment must either:
- Miss content due to language barriers
- Rely on poor quality auto-translated captions
- Navigate complex interfaces with overwhelming choice

**Core insight**: The combination of real-time dubbing + time-shift + minimal UI can create a delightful experience for consuming global live content.

## Goals / Non-Goals (MECE)

### Goals
- **Primary**: Enable English speakers to consume any country's live TV within 10 seconds
- **Secondary**: Provide time-shifted buffering (2-3h window, limited by YouTube)
- **Tertiary**: Minimal discovery interface (Country + 3 Topics only)

### Non-Goals
- Server-side restreaming of YouTube content (legal/technical constraints)
- Heavy personalization or recommendation engine
- Multi-language support beyond English dubbing (P1 feature)
- Full DVR recording capabilities (limited to YouTube's buffer windows)
- Live chat or social features
- Content creation or upload capabilities

## Users & UX Outline

### Primary Personas
1. **News Polyglot**: Wants breaking news from multiple countries in English
2. **Expat**: Misses home country content, needs familiar channels
3. **Curious Explorer**: Discovers what's happening globally across cultures

### Core User Flow
1. **Landing**: Auto-select random country → autoplay muted live channel → show "Enable English Dub" prompt
2. **Discovery**: Switch Country/Topic → see 3 rails × 6 items each → click to switch channel
3. **Consumption**: Watch with real-time dubbing + captions + DVR controls
4. **Sharing**: Generate timestamp deep-links with dubbed audio + captions

## Data & APIs Touched

### Data Sources
- **7pm.com scraping**: Daily ingestion of YouTube embed IDs by country/topic
- **YouTube API**: Channel metadata, viewer counts, live status
- **Ranking data**: User interaction events, quality metrics, activation rates

### Data Ownership
- **Read-only**: YouTube public data, 7pm.com public HTML
- **Write**: Internal catalog, user sessions, ranking statistics
- **Generated**: Real-time captions, dubbed audio (client-side only)

### API Boundaries
- **External**: YouTube IFrame API, 7pm.com scraping, Translation services
- **Internal**: Catalog API, Ranking service, Session management
- **Client-side**: Browser extension for audio processing

## Key Risks

### Technical Risks
1. **YouTube embed limitations**: Cannot access raw audio server-side
   - **Mitigation**: Browser extension with tabCapture API
2. **Real-time translation latency**: 6-10s added delay target
   - **Mitigation**: Optimized pipeline, local processing, progressive enhancement
3. **Browser extension adoption**: Required for core dubbing feature
   - **Mitigation**: Progressive enhancement, captions-first approach

### Business/Legal Risks
1. **7pm.com changes**: Source of embed IDs could change
   - **Mitigation**: Fallback to YouTube Search API, multiple source ingestion
2. **YouTube policy changes**: Embed access restrictions
   - **Mitigation**: Licensed feed partnerships, HLS/RTMP alternatives
3. **Translation accuracy**: Poor dubbing quality hurts retention
   - **Mitigation**: Quality monitoring, user feedback loops, model tuning

### Compliance Risks
1. **Privacy**: Client audio processing concerns
   - **Mitigation**: Local-only processing, clear privacy policy, minimal data collection
2. **Accessibility**: Captions and keyboard navigation required
   - **Mitigation**: Captions-first design, WCAG 2.1 compliance

## Options Considered

### Architecture Options (Full Analysis Required)

| Option | Pros | Cons | Cost ($K/mo at 10K CCU) | Tech Risk | Time to MVP |
|--------|------|------|-------------------------|-----------|-------------|
| **1. Extension + Static Site** | Simple deployment, lowest cost, YouTube ToS compliant | Extension adoption barrier, limited backend features | $2-5K | Medium (extension compatibility) | 6-8 weeks |
| **2. Extension + Full Backend** | Feature-rich, better observability, database-driven ranking | Higher complexity, more infrastructure | $8-15K | Medium-High (distributed system) | 10-12 weeks |
| **3. Captions-Only SPA** | No extension friction, fast to market | Missing key differentiator (dubbing) | $1-3K | Low | 4-6 weeks |
| **4. Licensed Feeds Only** | Server-side dubbing, no extension needed | Limited content catalog, high licensing costs | $50-100K+ | High (content acquisition) | 16-20 weeks |

**Critical Unknowns Requiring Validation:**
- Extension adoption rate (estimated 10-30% for audio features)
- Real-time translation latency achievability (6-10s target)
- YouTube embed policy stability over time
- 7pm.com scraping reliability and legal compliance

### Backend Framework Deep Analysis

| Framework | Development Velocity | Performance | Team Expertise | Ecosystem | Decision |
|-----------|---------------------|-------------|----------------|-----------|----------|
| **NestJS (TypeScript)** | High (shared types) | Good (Node.js) | Medium | Rich (npm) | **Chosen** |
| **Kotlin/Spring** | Medium | Excellent | Low | Mature | Alternative |
| **Python/FastAPI** | High | Good | Medium | Rich | Not considered - why? |

**Missing Analysis**: Why exclude Python/FastAPI? Team expertise assumption unvalidated.

## Success Metrics

### Leading Indicators
- **Activation**: Enable-dub CTR within 10s of landing
- **Discovery**: Rails click-through rate by topic
- **Quality**: Time to First Meaningful Phrase (TTFMP) < 8s p50

### Lagging Indicators  
- **Engagement**: ≥90s watch time with dub enabled
- **Retention**: D7 return rate for activated users
- **Virality**: Share rate for timestamp deep-links

### Technical SLIs
- **Performance**: Rebuffer ratio ≤ 0.3%, lipsync error ≤ 250ms
- **Availability**: Playback success ≥ 98.5%
- **Latency**: Added dubbing delay ≤ 10s p50

## Milestones

### MVP (6-8 weeks)
- Web app with Country + Topic discovery
- YouTube embed player with captions overlay
- Browser extension for English dubbing
- Time-shift buffering (within YouTube's 2-3h window)
- Basic ranking algorithm v1
- Admin interface for catalog management

### P1 (P0 + 4-6 weeks)
- Multi-language support (es, fr, de, pt, hi, ja)
- Timestamp deep-linking and sharing
- Search functionality
- Personalized favorites and history

### P2 (P1 + 8-12 weeks)
- Creator opt-in program for direct feeds
- Server-side dubbing for licensed content
- Advanced program guide
- Mobile app (React Native)

## Technical Feasibility Validation Required

### Critical Experiments Needed Before Phase 2

1. **Browser Extension Prototype** (2-3 days)
   - Validate tabCapture API works with YouTube embeds
   - Test Web Audio pipeline latency in real browser environment
   - Measure CPU/memory impact on user system

2. **Translation Pipeline Benchmark** (2-3 days)
   - Test Deepgram Nova Live latency with live YouTube streams
   - Validate NLLB-200 or Azure MT speed for news/sports content
   - Prototype TTS side-chain compression with sample audio

3. **7pm.com Scraping Analysis** (1 day)
   - Legal review of public HTML scraping approach
   - Technical analysis of anti-scraping measures
   - Backup content source identification

4. **YouTube Embed Policy Research** (1 day)
   - Review current YouTube IFrame API ToS
   - Test autoplay policies across browsers
   - Validate DVR functionality limitations

### Questions Requiring Answers
- **Team capacity**: How many engineers? What's actual expertise level?
- **Budget constraints**: Real infrastructure spending limits?
- **Legal clearance**: Content usage approach pre-approved?
- **Timeline pressure**: Is 6-8 week MVP realistic or artificial?

## Stakeholder Approval Process

### Required Sign-offs for Phase 2 Entry
1. **PM**: Problem-solution fit validated, metrics baseline agreed
2. **Tech Lead**: Architecture option approved, technical feasibility confirmed  
3. **Legal**: Content scraping and usage approach cleared
4. **Engineering Manager**: Resource allocation and timeline realistic

### Decision Points
- [ ] Proceed with Extension + Full Backend (Option 2)
- [ ] Fallback to Captions-Only if extension validation fails
- [ ] Technical feasibility experiments completed with go/no-go results
- [ ] Risk register populated with quantified impact/probability

## Open Questions Blocking Phase 2

1. **Extension adoption**: What's minimum viable adoption rate for business model?
2. **Content catalog**: How many channels needed for compelling experience?
3. **Quality thresholds**: What's acceptable dubbing quality for MVP?
4. **Competitive response**: How will 7pm.com react to scraping?
5. **Regulatory risk**: Any broadcast licensing concerns?

## Next Steps (Gated)

**Phase 1 Exit Criteria:**
- [ ] Technical feasibility validation experiments completed
- [ ] All critical unknowns resolved or risk-accepted
- [ ] Stakeholder sign-offs obtained
- [ ] Risk register with mitigation plans finalized

**Only proceed to Phase 2 after:**
1. Tech Lead approval with specific architectural direction
2. Legal clearance on content approach
3. PM validation of success metrics and timeline
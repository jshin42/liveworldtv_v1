# Translation Pipeline Latency Analysis

## Current State Research (September 2024)

### ASR (Deepgram Nova Live)
- **Advertised**: <300ms latency
- **Reality check**: Recent issues reported (March 2024) with latency spikes to 1.7s median
- **Risk**: Service degradation could break our 6-10s budget entirely

### Machine Translation (Azure Translator)
- **Performance**: 150-300ms for text <100 characters
- **Max latency**: 15s (standard models), 120s (custom models)
- **Real-time capable**: Yes, with REST API

### TTS (Azure Neural TTS)
- **2024 improvements**: Text streaming + on-device Neural TTS
- **Streaming mode**: Latency independent of input length
- **Network dependency**: Cloud-based has network latency, on-device eliminates it

## Latency Budget Analysis

### Optimistic Scenario (All services performing well)
```
Audio buffer:        2000ms
ASR (Deepgram):       300ms  
MT (Azure):           200ms
TTS (Azure streaming): 400ms
Audio processing:     300ms
Browser overhead:     200ms
---------------------------------
Total added latency:  3400ms (3.4s)
```
**Result**: ✅ Well under 6s target, ✅ Under 10s p50 goal

### Realistic Scenario (Current reported performance)
```
Audio buffer:        2000ms
ASR (Deepgram):      1700ms  (degraded performance)
MT (Azure):           300ms
TTS (Azure):          600ms
Audio processing:     500ms
Browser overhead:     400ms
Network variability:  800ms
---------------------------------
Total added latency:  6300ms (6.3s)
```
**Result**: ✅ At target boundary, ⚠️ Risk of exceeding 10s p50

### Pessimistic Scenario (Multiple service issues)
```
Audio buffer:        2000ms
ASR (Deepgram):      3000ms  (service issues)
MT (Azure):           500ms  (larger text chunks)
TTS (Azure):         1000ms  (network latency)
Audio processing:     800ms  (CPU constraints)
Browser overhead:     600ms
Network variability: 1500ms
---------------------------------
Total added latency:  9400ms (9.4s)
```
**Result**: ⚠️ Approaching 10s limit, ❌ Risk of violating 12s hard cap

## Critical Technical Risks Identified

### Risk 1: Deepgram Service Degradation
- **Evidence**: Documented latency spikes in 2024
- **Impact**: Could make entire dubbing feature unusable
- **Mitigation Options**: 
  - Local Whisper fallback (onnxruntime-web)
  - Multi-provider ASR with automatic failover
  - Quality degradation alerts

### Risk 2: Browser Audio Processing Overhead
- **Unknown**: Real CPU/memory impact on user devices
- **Concern**: Audio processing + TTS playback + video decode simultaneously
- **Required validation**: Test on mid-range devices (not just development machines)

### Risk 3: Network Variability in Pipeline
- **Issue**: Multiple API calls in sequence multiply network latency
- **Impact**: 99th percentile could easily exceed 12s hard cap
- **Mitigation**: Local caching, request pipelining, progressive audio

## Feasibility Conclusion

### ✅ **Technically Feasible** with caveats:
- 6-10s latency target is achievable under normal service conditions
- Azure 2024 improvements (text streaming, on-device TTS) help significantly  
- Progressive enhancement approach provides graceful degradation

### ❌ **High Risk Areas**:
- Dependency on external service SLAs (Deepgram stability)
- Browser extension adoption and performance impact
- Network latency variability in real-world conditions

### 🔄 **Validation Required**:
- Build end-to-end prototype measuring actual latency
- Test on representative user hardware configurations
- Establish service monitoring and failover procedures

## Recommendation

**Proceed with Extension + Full Backend approach** but implement robust fallback strategy:

1. **Primary**: Extension with cloud translation services
2. **Fallback 1**: Extension with local Whisper + on-device TTS
3. **Fallback 2**: Captions-only experience (no dubbing)

The technical feasibility is **CONDITIONAL** on building proper monitoring and graceful degradation from day 1.
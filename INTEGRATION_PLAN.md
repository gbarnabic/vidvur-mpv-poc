# VidVuR mpv Integration Plan

## Executive Summary

Based on the successful POC, this document outlines the plan to integrate node-mpv into VidVuR to eliminate codec conversion overhead and provide true frame-accurate video playback.

**POC Results:**
- ✅ 40x-241x faster than current conversion approach (124ms avg load vs 5-30s conversion)
- ✅ True frame-accurate playback (responsive frame stepping)
- ✅ Legacy codec support (H.263, WMV, MPEG-4 part 2) without conversion
- ✅ Container format support (.avi, .mov, .wmv) without conversion
- ✅ Eliminates 6 out of 8 conversions (75% of test videos)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Why node-mpv](#why-node-mpv)
3. [Rendering Strategy](#rendering-strategy)
4. [Feature Migration](#feature-migration)
5. [Implementation Phases](#implementation-phases)
6. [Technical Challenges](#technical-challenges)
7. [Success Criteria](#success-criteria)
8. [Rollout Strategy](#rollout-strategy)

---

## Architecture Overview

### Current Architecture (HTML5 Video)

```
┌─────────────────────────────────────────────────────┐
│ Player.jsx (React Component)                        │
│  ├─ <video> element                                 │
│  ├─ HTMLVideoElement API                           │
│  └─ Limitations:                                     │
│      • Keyframe-only seeking                        │
│      • Hardcoded 30 FPS assumptions                 │
│      • ±100ms loop accuracy issues                  │
│      • Requires FFmpeg conversion for many codecs   │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ main.js (Electron Main Process)                     │
│  ├─ FFmpeg codec detection                         │
│  ├─ Video conversion (5-30 seconds)                │
│  ├─ Conversion caching                             │
│  └─ Video streaming (base64 or chunks)             │
└─────────────────────────────────────────────────────┘
```

### Target Architecture (node-mpv)

```
┌─────────────────────────────────────────────────────┐
│ Player.jsx (React Component)                        │
│  ├─ mpv video window (external or embedded)        │
│  ├─ IPC communication with mpv                     │
│  └─ Benefits:                                        │
│      • Frame-accurate seeking                       │
│      • True frame stepping (any FPS)                │
│      • Sample-accurate A/B loops                    │
│      • No codec conversion needed                   │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ main.js (Electron Main Process)                     │
│  ├─ node-mpv instance management                   │
│  ├─ IPC bridge (renderer ↔ mpv)                    │
│  ├─ Direct file loading (no conversion)            │
│  └─ Property queries (time, frame, codec, etc.)    │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ mpv (Native Process)                                │
│  ├─ FFmpeg-based decoding (100+ codecs)            │
│  ├─ Frame-accurate playback                        │
│  ├─ JSON IPC protocol                              │
│  └─ Hardware acceleration support                   │
└─────────────────────────────────────────────────────┘
```

---

## Why node-mpv

### Comparison of Integration Options

| Feature | node-mpv | electron-mpv | mpv.js |
|---------|----------|--------------|--------|
| **Setup Complexity** | Simple npm package | Complex native build | Browser WebAssembly |
| **IPC Architecture** | JSON over sockets | Native bindings | JS API |
| **Frame Accuracy** | ✅ Excellent | ✅ Excellent | ⚠️ Limited |
| **Codec Support** | ✅ Full mpv (100+) | ✅ Full mpv | ⚠️ Subset |
| **Performance** | ✅ Native | ✅ Native | ⚠️ WASM overhead |
| **Window Embedding** | ⚠️ External/WID | ✅ Native embed | ✅ Canvas |
| **Maintenance** | ✅ Active | ⚠️ Less active | ⚠️ Outdated |
| **macOS Support** | ✅ Excellent | ✅ Good | ✅ Good |
| **POC Validated** | ✅ Yes | ❌ No | ❌ No |

**Decision: node-mpv**

**Reasons:**
1. ✅ POC already validated with node-mpv
2. ✅ Simple installation and setup
3. ✅ JSON IPC is easy to debug and extend
4. ✅ Active maintenance (v2.0.0-beta.2 supports latest mpv)
5. ✅ Works on macOS (VidVuR's primary platform)
6. ⚠️ Trade-off: External window (solvable with WID embedding)

---

## Rendering Strategy

### Option 1: External Window (Simplest - Phase 1)

**How it works:**
- mpv opens its own native window
- User interacts with both VidVuR window and mpv window
- VidVuR controls playback via IPC

**Pros:**
- ✅ Simplest to implement (POC already does this)
- ✅ Full mpv features available immediately
- ✅ Native performance (no additional overhead)
- ✅ Fast initial integration

**Cons:**
- ❌ Two-window UX (not ideal)
- ❌ Window management complexity
- ❌ Can't overlay UI controls on video

**Use case:** Phase 1 / MVP with feature flag

### Option 2: Window ID Embedding (Recommended - Phase 2)

**How it works:**
- Create a div in VidVuR UI
- Get native window handle (WID) for that div
- Tell mpv to render into that WID using `--wid=<handle>`
- mpv video appears embedded in VidVuR window

**Pros:**
- ✅ Single-window UX
- ✅ Video embedded in React component
- ✅ Still native performance
- ✅ Can overlay UI controls

**Cons:**
- ⚠️ Requires Electron `getNativeWindowHandle()` or similar
- ⚠️ Platform-specific code (macOS NSView, Windows HWND, Linux XID)
- ⚠️ More complex initialization

**Implementation:**
```javascript
// In Player.jsx
const videoContainerRef = useRef(null);

useEffect(() => {
  // Get native window handle from Electron
  const wid = await window.electron.getWindowHandle(videoContainerRef.current);

  // Initialize mpv with WID
  await window.electron.initMpv({ wid });
}, []);
```

**Use case:** Phase 2 / Production polish

### Option 3: Canvas Rendering (Future - Phase 3)

**How it works:**
- mpv renders to shared memory or pipe
- Node reads frames and sends to renderer
- Draw frames to HTML5 Canvas

**Pros:**
- ✅ Full control over rendering
- ✅ Can apply CSS effects
- ✅ Pixel-level manipulation possible

**Cons:**
- ❌ Performance overhead (frame copying)
- ❌ Complex implementation
- ❌ May lose hardware acceleration benefits
- ❌ Significant engineering effort

**Use case:** Only if WID embedding doesn't work or special effects needed

---

## Feature Migration

### Core Playback Features

| Feature | HTML5 Video | mpv Equivalent | Migration Notes |
|---------|-------------|----------------|-----------------|
| **Play/Pause** | `video.play()` / `video.pause()` | `mpv.togglePause()` | ✅ Direct mapping |
| **Seek** | `video.currentTime = x` | `mpv.seek(x)` | ✅ More accurate in mpv |
| **Volume** | `video.volume = x` | `mpv.volume(x)` | ✅ Direct mapping |
| **Playback Speed** | `video.playbackRate = x` | `mpv.speed(x)` | ✅ Direct mapping |
| **Duration** | `video.duration` | `mpv.getProperty('duration')` | ✅ Async in mpv |
| **Current Time** | `video.currentTime` | `mpv.getProperty('time-pos')` | ✅ Async in mpv |

### VidVuR-Specific Features

#### 1. Frame-by-Frame Stepping

**Current (HTML5):**
```javascript
// Player.jsx:702-709
const stepFrame = (direction) => {
  if (!videoRef.current) return;
  const fps = 30; // Hardcoded!
  const frameTime = 1 / fps;
  const newTime = videoRef.current.currentTime + (direction * frameTime);
  videoRef.current.currentTime = Math.max(0, Math.min(newTime, videoRef.current.duration));
};
```

**Issues:**
- Hardcoded 30 FPS
- Seeks to keyframe (not frame-accurate)
- ±100ms accuracy

**Target (mpv):**
```javascript
// New implementation
const stepFrame = async (direction) => {
  if (direction === 1) {
    await window.electron.mpvCommand('frame-step');
  } else {
    await window.electron.mpvCommand('frame-back-step');
  }

  // Update UI with exact frame number
  const frameNum = await window.electron.mpvGetProperty('estimated-frame-number');
  setCurrentFrame(frameNum);
};
```

**Benefits:**
- ✅ True frame accuracy (POC validated: very responsive)
- ✅ Works with any FPS
- ✅ No keyframe limitations

#### 2. A/B Loop Functionality

**Current (HTML5):**
```javascript
// Player.jsx:888-904
const playLoopSection = useCallback((loop) => {
  if (!videoRef.current) return;

  videoRef.current.currentTime = loop.start;
  videoRef.current.play();

  const checkLoop = () => {
    if (videoRef.current.currentTime >= loop.end) {
      videoRef.current.currentTime = loop.start;
    }
    loopInterval = setTimeout(checkLoop, 50); // Poll every 50ms
  };
  checkLoop();
}, []);
```

**Issues:**
- Polling-based (50ms checks)
- ±50-100ms loop accuracy
- Manual loop management

**Target (mpv):**
```javascript
// New implementation using mpv's native A/B loop
const playLoopSection = async (loop) => {
  await window.electron.mpvSetProperty('ab-loop-a', loop.start);
  await window.electron.mpvSetProperty('ab-loop-b', loop.end);
  await window.electron.mpvSeek(loop.start);
  await window.electron.mpvPlay();
};

const clearLoop = async () => {
  await window.electron.mpvSetProperty('ab-loop-a', 'no');
  await window.electron.mpvSetProperty('ab-loop-b', 'no');
};
```

**Benefits:**
- ✅ Sample-accurate loops (mpv handles it internally)
- ✅ No polling overhead
- ✅ Smoother playback

#### 3. Video Metadata & Loop Storage

**Current:**
```javascript
// Stored in video file 'comment' tag via FFmpeg
const metadata = {
  comment: JSON.stringify({
    loops: [
      { start: 10.5, end: 25.3, name: "Intro Loop" }
    ]
  })
};
```

**Target:**
- ✅ **No changes needed!** Continue using FFmpeg for metadata
- mpv can read metadata: `mpv.getProperty('metadata')`
- For writing, keep using FFmpeg (mpv is read-only for metadata)

#### 4. Video Thumbnails

**Current:**
```javascript
// main.js:1087-1120
// Uses FFmpeg to extract thumbnail at 10% position
ffmpeg -ss 10.5 -i video.mp4 -vframes 1 -vf scale=320:320 -q:v 2 thumbnail.jpg
```

**Target:**
- ✅ **No changes needed!** Keep using FFmpeg for thumbnails
- mpv can capture frames but FFmpeg is simpler for this use case

#### 5. Zoom & Pan

**Current (HTML5):**
```javascript
// Player.jsx:398-423
// Uses CSS transform: scale() and translate()
videoRef.current.style.transform =
  `scale(${zoomLevel}) translate(${panX}px, ${panY}px)`;
```

**Target (mpv):**
- **Option A:** Keep CSS transforms (if using WID embedding or canvas)
- **Option B:** Use mpv video filters:
  ```javascript
  // Zoom in mpv
  await mpv.command(['vf', 'set', `scale=${zoomLevel}`]);
  ```

**Recommendation:** Start with Option A (CSS) for consistency

#### 6. Playback Speed Options

**Current:**
```javascript
// Player.jsx:237-248
const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
videoRef.current.playbackRate = speed;
```

**Target:**
```javascript
await window.electron.mpvSpeed(speed);
// or
await window.electron.mpvSetProperty('speed', speed);
```

**Benefits:**
- ✅ Same speeds supported
- ✅ Better audio pitch preservation in mpv

#### 7. Keyboard Shortcuts

**Current:**
```javascript
// Player.jsx:566-633
// React handles keyboard events
// Calls HTML5 video methods
```

**Target:**
- **Option A:** Keep React keyboard handling, call mpv via IPC
- **Option B:** Use mpv's built-in key bindings via input.conf

**Recommendation:** Option A for consistency with VidVuR UI

---

## Implementation Phases

### Phase 1: MVP with Feature Flag (2-3 weeks)

**Goal:** Get mpv working alongside HTML5 video with external window

**Tasks:**

1. **Add node-mpv to VidVuR** (1 day)
   - [ ] Install node-mpv: `npm install node-mpv@^2.0.0-beta.2`
   - [ ] Add mpv binary to Electron package (electron-forge)
   - [ ] Test mpv installation on macOS

2. **Create mpv Integration Layer** (3 days)
   - [ ] Add mpv IPC handlers to `main.js`
     - `init-mpv`: Initialize mpv instance
     - `mpv-load`: Load video file
     - `mpv-play`, `mpv-pause`, `mpv-seek`: Playback controls
     - `mpv-command`: Generic command interface
     - `mpv-get-property`, `mpv-set-property`: Property access
   - [ ] Add Electron preload exports
   - [ ] Handle mpv process lifecycle (start, stop, cleanup)
   - [ ] Add error handling and logging

3. **Create PlayerMpv.jsx Component** (4 days)
   - [ ] Copy Player.jsx → PlayerMpv.jsx
   - [ ] Replace HTML5 video methods with mpv IPC calls
   - [ ] Implement external window workflow
   - [ ] Update keyboard shortcuts to use mpv
   - [ ] Implement time position updates (polling or events)
   - [ ] Add mpv status indicators to UI

4. **Feature Flag System** (1 day)
   - [ ] Add "Use mpv Player" toggle in Settings.jsx
   - [ ] Store preference in Electron store
   - [ ] App.jsx switches between Player.jsx and PlayerMpv.jsx
   - [ ] Add beta warning banner when mpv enabled

5. **Basic Feature Parity** (3 days)
   - [ ] Play/pause/seek
   - [ ] Frame stepping (forward/backward)
   - [ ] A/B loops (basic version)
   - [ ] Playback speed controls
   - [ ] Volume control
   - [ ] Timeline scrubbing

6. **Testing & Bug Fixes** (2 days)
   - [ ] Test with POC video files (H.263, WMV, .avi, .mov)
   - [ ] Test all keyboard shortcuts
   - [ ] Test loop creation and playback
   - [ ] Memory leak testing (mpv cleanup)
   - [ ] Window management edge cases

**Deliverable:** VidVuR with mpv option (external window) behind feature flag

---

### Phase 2: Window Embedding & Polish (2-3 weeks)

**Goal:** Embed mpv video in VidVuR window, improve UX

**Tasks:**

1. **Window ID (WID) Embedding** (5 days)
   - [ ] Research Electron native window handle access
   - [ ] Implement `getNativeWindowHandle()` in main.js
   - [ ] Create video container div in PlayerMpv.jsx
   - [ ] Pass WID to mpv via `--wid` flag
   - [ ] Test on macOS (NSView)
   - [ ] Handle window resize events
   - [ ] Fix focus/input handling

2. **UI Overlay Improvements** (2 days)
   - [ ] Overlay controls on video (now possible with WID)
   - [ ] Improve timeline positioning
   - [ ] Add video info display (codec, resolution, FPS)

3. **Advanced Features** (4 days)
   - [ ] Loop export with mpv
   - [ ] Combined video generation with mpv
   - [ ] Precise frame selection for loops
   - [ ] Real-time FPS detection (no hardcoding)

4. **Performance Optimization** (2 days)
   - [ ] Optimize IPC call frequency
   - [ ] Implement event-based time updates (vs polling)
   - [ ] Add debouncing for rapid commands
   - [ ] Hardware acceleration verification

5. **Testing & Refinement** (2 days)
   - [ ] Cross-platform testing (if applicable)
   - [ ] Large file testing (>1GB videos)
   - [ ] Long session testing (memory leaks)
   - [ ] Various codec/format testing

**Deliverable:** mpv embedded in VidVuR window with improved UX

---

### Phase 3: Production Release (1-2 weeks)

**Goal:** Make mpv the default player, deprecate HTML5

**Tasks:**

1. **Migration Strategy** (2 days)
   - [ ] Document migration for users
   - [ ] Add migration banner for feature flag users
   - [ ] Update help documentation
   - [ ] Create comparison documentation (HTML5 vs mpv)

2. **Remove Conversion Code** (3 days)
   - [ ] Deprecate codec detection for conversion
   - [ ] Remove FFmpeg conversion logic (keep for thumbnails)
   - [ ] Remove conversion cache directory
   - [ ] Update file loading to always use direct paths

3. **Default to mpv** (1 day)
   - [ ] Change default player setting to mpv
   - [ ] Keep HTML5 as fallback option (for 1-2 versions)
   - [ ] Add deprecation notice to HTML5 player

4. **Final Testing** (2 days)
   - [ ] Beta testing with users
   - [ ] Collect feedback
   - [ ] Fix critical bugs

5. **Release** (1 day)
   - [ ] Update CHANGELOG.md
   - [ ] Create GitHub release
   - [ ] Update README with mpv requirements

**Deliverable:** VidVuR with mpv as default player

---

### Phase 4: Future Enhancements (Ongoing)

**Optional improvements:**

1. **Enhanced Features**
   - [ ] Subtitle support (mpv has excellent subtitle rendering)
   - [ ] Audio track selection (multi-audio videos)
   - [ ] Chapter support
   - [ ] Video filters (brightness, contrast, saturation)
   - [ ] Screenshot capture (frame-perfect)

2. **Advanced Analysis**
   - [ ] Real-time video statistics (dropped frames, bitrate)
   - [ ] Codec information display
   - [ ] Color space information
   - [ ] Audio waveform visualization

3. **Performance**
   - [ ] Canvas rendering (if WID has issues)
   - [ ] GPU acceleration controls
   - [ ] Caching strategies for frame stepping

---

## Technical Challenges

### Challenge 1: Window Management (External Window)

**Problem:** Two separate windows (VidVuR + mpv)

**Solutions:**
- **Phase 1:** Accept two windows, focus on functionality
- **Phase 2:** WID embedding (single window)
- **Mitigation:** Clear user documentation, window positioning hints

**Risk Level:** Medium (solvable in Phase 2)

---

### Challenge 2: IPC Latency

**Problem:** Async IPC calls may feel sluggish

**Solutions:**
- Batch related commands
- Cache frequently-accessed properties
- Use mpv events (observe properties) instead of polling
- Debounce rapid UI interactions

**Example:**
```javascript
// Bad: Poll every 100ms
setInterval(async () => {
  const time = await mpv.getProperty('time-pos');
  setCurrentTime(time);
}, 100);

// Good: Use mpv property observation
await mpv.command(['observe_property', 1, 'time-pos']);
mpv.on('property-change', (data) => {
  if (data.name === 'time-pos') {
    setCurrentTime(data.data);
  }
});
```

**Risk Level:** Low (POC showed responsive frame stepping)

---

### Challenge 3: Platform Differences

**Problem:** mpv/WID behavior differs on macOS/Windows/Linux

**Solutions:**
- Focus on macOS first (VidVuR's primary platform)
- Abstract platform-specific code into separate modules
- Test on each platform early

**Risk Level:** Medium (but low priority if macOS-only)

---

### Challenge 4: mpv Binary Distribution

**Problem:** Need to bundle mpv with VidVuR

**Solutions:**
- Use `electron-forge` extra resources
- Download mpv binary during install (like FFmpeg)
- Use statically-linked mpv binary
- Test on user machines without Homebrew

**Example electron-forge config:**
```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    extraResource: [
      './resources/mpv',  // mpv binary
      './resources/mpv-libs'  // required libraries
    ]
  }
};
```

**Risk Level:** Low (standard Electron practice)

---

### Challenge 5: Backwards Compatibility

**Problem:** Users have existing loop metadata

**Solutions:**
- ✅ Keep using FFmpeg for metadata (no changes needed)
- ✅ Loop data format unchanged
- Test metadata reading with mpv

**Risk Level:** Low (metadata handling is separate)

---

## Success Criteria

### Phase 1 MVP

- [ ] mpv player loads videos without conversion
- [ ] Frame stepping works accurately
- [ ] A/B loops work with native mpv loop
- [ ] Keyboard shortcuts functional
- [ ] No crashes or memory leaks in 30-minute session
- [ ] At least 50% faster than HTML5 conversion workflow

### Phase 2 Embedded

- [ ] Single-window UX (video embedded)
- [ ] UI controls overlay on video
- [ ] No visual glitches or tearing
- [ ] Window resizing works smoothly
- [ ] All Phase 1 features still work

### Phase 3 Production

- [ ] mpv is default for 90%+ of users
- [ ] Zero conversion overhead for most files
- [ ] User-reported bugs < 5 critical issues
- [ ] Performance improvements validated by users
- [ ] Documentation complete

---

## Rollout Strategy

### Beta Testing (Phase 1-2)

1. **Internal Testing** (1 week)
   - Test with development team
   - Validate all core features
   - Collect performance metrics

2. **Limited Beta** (2 weeks)
   - Enable feature flag for 10-20 users
   - Collect detailed feedback
   - Monitor crash reports
   - Iterate on bugs

3. **Open Beta** (2 weeks)
   - Announce mpv player option
   - Encourage all users to try it
   - Compare mpv vs HTML5 usage
   - Document common issues

### Production Release (Phase 3)

1. **Soft Launch** (1 week)
   - Make mpv default for new users
   - Keep HTML5 as option for existing users
   - Monitor adoption rate

2. **Full Migration** (2 weeks)
   - Migrate 50% of users to mpv default
   - Monitor error rates
   - Provide easy rollback option

3. **Deprecation** (1-2 months after)
   - Announce HTML5 player deprecation
   - Plan removal for future version
   - Ensure mpv handles all edge cases

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WID embedding doesn't work | Low | High | Start with external window (Phase 1), explore canvas fallback |
| Performance worse than HTML5 | Very Low | High | POC validated excellent performance |
| mpv crashes on edge cases | Medium | Medium | Comprehensive testing, graceful error handling, fallback to HTML5 |
| Users dislike external window | High | Low | Phase 2 WID embedding solves this |
| Platform-specific issues | Medium | Medium | Focus on macOS first, platform abstraction |
| mpv binary distribution issues | Low | Medium | Test packaging early, provide clear install docs |

---

## Open Questions

1. **WID Embedding Implementation:**
   - How to get native window handle in Electron?
   - Does electron-acrylic-window or similar help?
   - Fallback if WID doesn't work?

2. **UI/UX:**
   - Should we keep external window as an option (for multi-monitor)?
   - How to handle mpv's native OSD (on-screen display)?
   - Disable mpv OSD entirely and use React UI?

3. **Performance:**
   - What's the IPC latency in production?
   - Need to cache properties or is live querying fast enough?

4. **Distribution:**
   - Bundle mpv statically or dynamically link?
   - Size of mpv binary (~10MB)?
   - Licensing implications (mpv is GPLv2+)?

---

## Next Steps

1. **Research WID Embedding** (before Phase 1)
   - Test electron-acrylic-window or native-window-handle packages
   - Prototype WID on macOS
   - Determine if external window is acceptable MVP

2. **Start Phase 1 Implementation**
   - Add node-mpv to VidVuR
   - Create mpv IPC handlers
   - Build PlayerMpv.jsx component

3. **Document as We Go**
   - Update this plan with findings
   - Create developer documentation
   - Write user-facing migration guide

---

## Appendix A: Code References

### Current VidVuR Files to Modify

| File | Changes | Complexity |
|------|---------|------------|
| `src/main.js` | Add mpv IPC handlers, remove conversion code | High |
| `src/preload.js` | Add mpv API exports | Low |
| `src/App.jsx` | Add player selection logic | Low |
| `src/components/Player.jsx` | Duplicate to PlayerMpv.jsx | High |
| `src/components/Settings.jsx` | Add mpv toggle | Low |
| `package.json` | Add node-mpv dependency | Low |
| `forge.config.js` | Add mpv binary to resources | Medium |

### New Files to Create

- `src/components/PlayerMpv.jsx` - mpv-based player component
- `src/utils/mpvWrapper.js` - mpv abstraction layer (optional)
- `docs/MPV_INTEGRATION.md` - Developer documentation
- `docs/MPV_USER_GUIDE.md` - User documentation

---

## Appendix B: mpv IPC Commands Reference

### Essential Commands for VidVuR

```javascript
// Playback control
mpv.command('pause');
mpv.command('seek', [10, 'relative']);
mpv.command('frame-step');
mpv.command('frame-back-step');

// Property access
mpv.getProperty('time-pos');
mpv.getProperty('duration');
mpv.getProperty('video-codec');
mpv.getProperty('video-params/w');
mpv.getProperty('video-params/h');
mpv.getProperty('video-params/fps');
mpv.getProperty('estimated-frame-number');

// A/B loop
mpv.setProperty('ab-loop-a', 10.5);
mpv.setProperty('ab-loop-b', 25.3);

// Speed
mpv.setProperty('speed', 0.5);

// Volume
mpv.setProperty('volume', 50);

// Property observation (events)
mpv.command(['observe_property', 1, 'time-pos']);
mpv.on('property-change', (data) => {
  // Handle time updates
});
```

---

## Appendix C: POC Results Summary

**Test Configuration:**
- 8 videos tested
- Formats: .mp4, .avi, .mov, .webm, .wmv
- Codecs: H.264, H.263, WMV8, MPEG-4 Part 2, VP8

**Results:**
- 100% success rate (8/8 videos played)
- 75% required conversion in VidVuR (6/8)
- Average load time: 124ms
- VidVuR conversion time: 5,000-30,000ms
- **Speed improvement: 40x-241x faster**

**Validated Features:**
- ✅ Frame-accurate stepping (user confirmed: "very responsive")
- ✅ Legacy codec support (H.263 from 1990s)
- ✅ Container format support (.avi, .mov, .wmv)
- ✅ No conversion overhead

**Repository:** https://github.com/gbarnabic/vidvur-mpv-poc

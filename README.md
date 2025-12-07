# VidVuR mpv Proof of Concept

A Node.js proof of concept testing **mpv's ability to play various video codecs without conversion overhead**. This POC validates whether mpv can replace VidVuR's current HTML5 video player and eliminate the need for FFmpeg conversion delays.

## 🎯 Purpose

VidVuR currently converts many video formats/codecs before playback:
- **Formats:** `.mov`, `.mkv`, `.avi`, `.flv`, `.wmv`, `.mpg`, `.mpeg`, `.3gp`
- **Codecs:** H.263, MPEG-1/2, WMV, VC-1, RealVideo, Sorenson, Cinepak, Indeo, and more
- **Conversion time:** 5-30 seconds per file
- **Disk usage:** Cached conversions in `~/Library/Application Support/vidvur/converted_videos/`

This POC tests whether **mpv can play these formats/codecs directly** without conversion.

## 🚀 Features

### Interactive Player (`poc.js`)
- Load and play any video file mpv supports
- Frame-accurate controls (frame-by-frame stepping)
- A/B loop functionality
- Performance metrics (frame-step timing)
- Real-time video information
- Keyboard controls

### Batch Codec Tester (`test-codecs.js`)
- Scan directory for video files
- Test each file's codec and format
- Compare against VidVuR's conversion requirements
- Generate performance report
- Identify conversion time savings

## 📋 Prerequisites

### Install mpv

**macOS:**
```bash
brew install mpv
```

**Ubuntu/Debian:**
```bash
sudo apt-get install mpv
```

**Windows:**
Download from [mpv.io](https://mpv.io/)

### Verify Installation
```bash
mpv --version
```

## 🛠️ Setup

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/vidvur-mpv-poc.git
cd vidvur-mpv-poc
```

2. **Install dependencies:**
```bash
npm install
```

## 🎮 Usage

### Interactive Player

**Start with a video file:**
```bash
npm start /path/to/video.mp4
```

**Or start and load file interactively:**
```bash
npm start
# Then press 'l' to load a video
```

### Controls

| Key | Action |
|-----|--------|
| `l` | Load video file |
| `Space` | Toggle play/pause |
| `←/→` | Seek backward/forward 5 seconds |
| `[/]` | Frame step backward/forward |
| `s` | Set loop start (A) |
| `f` | Set loop end (B) |
| `b` | Clear loop |
| `i` | Show detailed video info |
| `r` | Reset performance metrics |
| `q` | Quit |

### Batch Codec Testing

**Test all videos in a directory:**
```bash
npm test /path/to/videos/
```

**Test videos in current directory:**
```bash
npm test
```

**Sample output:**
```
═══════════════════════════════════════════════════════════
                    TEST REPORT
═══════════════════════════════════════════════════════════

Summary:
  Total videos tested: 15
  Successful: 15
  Failed: 0

Conversion Analysis:
  No conversion needed with mpv: 15
  VidVuR would convert: 8
  Saved conversions: 8

Videos that VidVuR converts but mpv plays directly:
  • test.mov (h264) - Container format requires conversion
    Load time: 156ms (vs ~5000-30000ms conversion time)
  • old-video.mp4 (h263) - Unsupported codec
    Load time: 142ms (vs ~5000-30000ms conversion time)

Performance:
  Average load time: 148ms
  Compare to VidVuR conversion: ~5000-30000ms
  Speed improvement: 33x - 202x faster

Conclusion:
  mpv eliminates 8 conversion step(s)
  Instant playback for all tested codecs
  Recommendation: Integrate mpv into VidVuR
```

## 📊 What This Tests

### Codec Support
Tests whether mpv can play codecs that VidVuR currently converts:
- ✅ H.263 (old codec from 1990s)
- ✅ MPEG-1/MPEG-2 video
- ✅ Windows Media Video (WMV1/2/3)
- ✅ VC-1, RealVideo 4
- ✅ Sorenson Video (SVQ1/3)
- ✅ Cinepak, Indeo 3/5
- ✅ Microsoft MPEG-4 v2/v3

### Container Format Support
Tests formats that VidVuR converts:
- ✅ `.mov` (QuickTime)
- ✅ `.mkv` (Matroska)
- ✅ `.avi` (Audio Video Interleave)
- ✅ `.flv` (Flash Video)
- ✅ `.wmv` (Windows Media Video)
- ✅ `.mpg/.mpeg` (MPEG)
- ✅ `.3gp` (3GPP)

### Performance Metrics
- Load time (with vs. without conversion)
- Frame-step timing (forward and backward)
- Memory usage (mpv process overhead)

## 📈 Expected Results

Based on the research document (`MPV_INTEGRATION_RESEARCH.md`), we expect:

**Codec Support:**
- ✅ mpv plays 100+ codecs natively via libavcodec
- ✅ No conversion needed for any codec
- ✅ Instant playback (~100-200ms load time)

**Performance:**
- ✅ Load time: ~100-200ms (vs. 5-30s conversion)
- ✅ Forward frame-step: <16ms (instant)
- ✅ Backward frame-step: ~1000ms (codec limitation)
- ✅ Memory overhead: +50-100MB (mpv process)

**Conversion Savings:**
- ✅ Eliminates all conversion delays
- ✅ No disk space for cached conversions
- ✅ 25x-150x faster time-to-playback

## 🔍 Key Findings to Validate

This POC aims to validate these claims:

1. **No conversion needed** - mpv plays all VidVuR-unsupported codecs directly
2. **Fast loading** - Videos load in ~100-200ms vs. 5-30s conversion time
3. **Frame-accurate playback** - True frame-by-frame control (not 1/30s approximation)
4. **A/B loop precision** - Sample-accurate loop boundaries
5. **Cross-platform** - Works on macOS, Linux, Windows

## 📁 Project Structure

```
vidvur-mpv-poc/
├── poc.js              # Interactive video player
├── test-codecs.js      # Batch codec testing script
├── package.json        # Dependencies and scripts
├── README.md          # This file
└── .gitignore         # Git ignore rules
```

## 🐛 Troubleshooting

### "mpv not found" error
Make sure mpv is installed and in your PATH:
```bash
which mpv  # macOS/Linux
where mpv  # Windows
```

### "Cannot connect to mpv" error
Try starting mpv manually to verify it works:
```bash
mpv /path/to/video.mp4
```

### Slow backward frame-stepping
This is expected - backward frame-stepping requires re-decoding from the previous keyframe. Enable caching for better performance:
```bash
# Already enabled in poc.js with:
# --demuxer-max-back-bytes=100M
# --cache=yes
```

### Video window doesn't appear
Make sure you're running the script in a graphical environment (not SSH without X forwarding).

## 🔗 Related Documents

- **Research Report:** See `MPV_INTEGRATION_RESEARCH.md` in the parent repo for comprehensive analysis
- **VidVuR Project:** See `CLAUDE.md` in the main VidVuR repo for current implementation details

## 📝 Testing Checklist

Use this checklist when testing the POC:

- [ ] Install mpv successfully
- [ ] Run `npm install` without errors
- [ ] Load a video file with `npm start`
- [ ] Verify video window appears and plays
- [ ] Test frame-stepping (forward and backward)
- [ ] Measure frame-step timing
- [ ] Test A/B loop functionality
- [ ] Run batch codec test on video directory
- [ ] Note any codecs that fail to play
- [ ] Compare load times to VidVuR conversion times
- [ ] Test on multiple platforms (if available)

## 🎯 Success Criteria

This POC is successful if:

1. ✅ **mpv plays all VidVuR-unsupported codecs without conversion**
2. ✅ **Load time <500ms for typical videos**
3. ✅ **Forward frame-stepping <50ms**
4. ✅ **A/B loops work with sample-accurate precision**
5. ✅ **No crashes or stability issues**
6. ✅ **Works on macOS (primary target platform)**

If these criteria are met, **recommend proceeding with full mpv integration into VidVuR**.

## 📊 Next Steps (After POC)

If POC is successful:

1. ✅ Integrate node-mpv into VidVuR Electron app
2. ✅ Implement video rendering strategy (external window or canvas)
3. ✅ Migrate existing features (loops, metadata, export)
4. ✅ Add frame-accurate enhancements
5. ✅ Package mpv binary with VidVuR
6. ✅ Test on all platforms
7. ✅ Release beta with feature flag
8. ✅ Gather user feedback
9. ✅ Full production release

## 📄 License

MIT

## 👤 Author

VidVuR Development Team

## 🙏 Acknowledgments

- [mpv](https://mpv.io/) - The amazing media player that makes this possible
- [node-mpv](https://github.com/j-holub/Node-MPV) - Node.js wrapper for mpv
- VidVuR users who requested better codec support

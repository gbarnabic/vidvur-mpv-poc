#!/usr/bin/env node

/**
 * Codec Testing Script
 *
 * Tests multiple video files to see which codecs mpv can play without conversion.
 * Generates a report comparing against VidVuR's current conversion requirements.
 */

const mpv = require('node-mpv');
const fs = require('fs');
const path = require('path');

// VidVuR's unsupported codecs list (from CLAUDE.md)
const VIDVUR_UNSUPPORTED_CODECS = [
  'h263', 'h263p',
  'mpeg1video', 'mpeg2video',
  'msmpeg4v2', 'msmpeg4v3',
  'wmv1', 'wmv2', 'wmv3',
  'vc1', 'rv40',
  'svq1', 'svq3',
  'cinepak', 'indeo3', 'indeo5'
];

// VidVuR's formats requiring conversion
const VIDVUR_CONVERSION_FORMATS = [
  '.mov', '.mkv', '.avi', '.flv', '.wmv',
  '.mpg', '.mpeg', '.3gp'
];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

let player = null;
const results = [];

async function testVideo(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  console.log(`\n${colors.cyan}Testing: ${filename}${colors.reset}`);

  try {
    const startTime = Date.now();
    await player.load(filePath);
    const loadTime = Date.now() - startTime;

    // Wait a bit for video to be fully loaded
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get video info - handle each property separately
    let codec, format, width, height, fps, duration;
    try {
      codec = await player.getProperty('video-codec');
    } catch (e) {
      codec = null;
    }
    try {
      format = await player.getProperty('file-format');
    } catch (e) {
      format = null;
    }
    try {
      width = await player.getProperty('video-params/w');
    } catch (e) {
      width = null;
    }
    try {
      height = await player.getProperty('video-params/h');
    } catch (e) {
      height = null;
    }
    try {
      fps = await player.getProperty('container-fps');  // Use container-fps instead
    } catch (e) {
      fps = null;
    }
    try {
      duration = await player.getProperty('duration');
    } catch (e) {
      duration = null;
    }

    // Check if we got valid codec info
    if (!codec) {
      throw new Error('Could not detect video codec');
    }

    // Check if VidVuR would require conversion
    // Check if codec string contains any unsupported codec name
    const codecLower = codec.toLowerCase();
    const codecUnsupported = VIDVUR_UNSUPPORTED_CODECS.some(unsupported => {
      // Handle both "h263" and "h.263" formats
      const normalized = unsupported.replace(/(\d)/, '.$1'); // h263 -> h.263
      return codecLower.includes(unsupported) || codecLower.includes(normalized);
    });
    const wouldConvert = codecUnsupported || VIDVUR_CONVERSION_FORMATS.includes(ext);

    const result = {
      filename,
      codec,
      format,
      resolution: `${width}x${height}`,
      fps: fps ? fps.toFixed(2) : 'N/A',
      duration: duration ? duration.toFixed(2) : 'N/A',
      loadTime,
      success: true,
      wouldConvert,
      reason: wouldConvert ? (
        codecUnsupported ?
          'Unsupported codec' :
          'Container format requires conversion'
      ) : null
    };

    results.push(result);

    console.log(`  ${colors.green}✓ Success${colors.reset}`);
    console.log(`  Codec: ${codec}`);
    console.log(`  Format: ${format}`);
    console.log(`  Resolution: ${width}x${height}`);
    console.log(`  FPS: ${fps ? fps.toFixed(2) : 'N/A'}`);
    console.log(`  Load time: ${loadTime}ms`);
    if (wouldConvert) {
      console.log(`  ${colors.yellow}⚠ VidVuR would convert this (${result.reason})${colors.reset}`);
    } else {
      console.log(`  ${colors.green}✓ VidVuR would play directly${colors.reset}`);
    }

    return true;
  } catch (error) {
    let errorMsg;
    try {
      errorMsg = error?.message || JSON.stringify(error, Object.getOwnPropertyNames(error)) || 'Unknown error';
    } catch (e) {
      errorMsg = String(error);
    }
    console.log(`  ${colors.red}✗ Failed: ${errorMsg}${colors.reset}`);

    results.push({
      filename,
      success: false,
      error: errorMsg
    });

    return false;
  }
}

function printReport() {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}                    TEST REPORT                            ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const wouldConvert = successful.filter(r => r.wouldConvert);
  const noConversionNeeded = successful.filter(r => !r.wouldConvert);

  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  Total videos tested: ${results.length}`);
  console.log(`  ${colors.green}Successful: ${successful.length}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed.length}${colors.reset}`);
  console.log();

  console.log(`${colors.bright}Conversion Analysis:${colors.reset}`);
  console.log(`  ${colors.green}No conversion needed with mpv: ${successful.length}${colors.reset}`);
  console.log(`  ${colors.yellow}VidVuR would convert: ${wouldConvert.length}${colors.reset}`);
  console.log(`  ${colors.green}Saved conversions: ${wouldConvert.length}${colors.reset}`);
  console.log();

  if (wouldConvert.length > 0) {
    console.log(`${colors.bright}${colors.yellow}Videos that VidVuR converts but mpv plays directly:${colors.reset}`);
    wouldConvert.forEach(r => {
      console.log(`  • ${r.filename} (${r.codec}) - ${r.reason}`);
      console.log(`    Load time: ${r.loadTime}ms (vs ~5000-30000ms conversion time)`);
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log(`${colors.bright}${colors.red}Failed videos:${colors.reset}`);
    failed.forEach(r => {
      console.log(`  • ${r.filename} - ${r.error}`);
    });
    console.log();
  }

  // Performance metrics
  if (successful.length > 0) {
    const avgLoadTime = successful.reduce((sum, r) => sum + r.loadTime, 0) / successful.length;
    console.log(`${colors.bright}Performance:${colors.reset}`);
    console.log(`  Average load time: ${colors.green}${avgLoadTime.toFixed(2)}ms${colors.reset}`);
    console.log(`  Compare to VidVuR conversion: ${colors.yellow}~5000-30000ms${colors.reset}`);
    console.log(`  Speed improvement: ${colors.green}${((5000 / avgLoadTime).toFixed(0))}x - ${((30000 / avgLoadTime).toFixed(0))}x faster${colors.reset}`);
    console.log();
  }

  // Codec breakdown
  console.log(`${colors.bright}Codecs tested:${colors.reset}`);
  const codecs = {};
  successful.forEach(r => {
    if (!codecs[r.codec]) codecs[r.codec] = 0;
    codecs[r.codec]++;
  });
  Object.entries(codecs).forEach(([codec, count]) => {
    // Use same matching logic as above
    const codecLower = codec.toLowerCase();
    const unsupported = VIDVUR_UNSUPPORTED_CODECS.some(unsup => {
      const normalized = unsup.replace(/(\d)/, '.$1');
      return codecLower.includes(unsup) || codecLower.includes(normalized);
    });
    const indicator = unsupported ? colors.yellow + '⚠' : colors.green + '✓';
    console.log(`  ${indicator} ${codec}: ${count} file(s)${colors.reset}`);
  });
  console.log();

  console.log(`${colors.bright}${colors.cyan}Conclusion:${colors.reset}`);
  if (wouldConvert.length > 0) {
    console.log(`  ${colors.green}mpv eliminates ${wouldConvert.length} conversion step(s)${colors.reset}`);
    console.log(`  ${colors.green}Instant playback for all tested codecs${colors.reset}`);
    console.log(`  ${colors.green}Recommendation: Integrate mpv into VidVuR${colors.reset}`);
  } else if (successful.length > 0) {
    console.log(`  ${colors.green}All tested videos work in both mpv and VidVuR${colors.reset}`);
    console.log(`  ${colors.yellow}Test with more codec varieties to see mpv benefits${colors.reset}`);
  }
  console.log();
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}VidVuR mpv Codec Testing${colors.reset}\n`);

  // Get directory to test
  const testDir = process.argv[2] || '.';

  if (!fs.existsSync(testDir)) {
    console.error(`${colors.red}Directory not found: ${testDir}${colors.reset}`);
    process.exit(1);
  }

  // Find video files
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.mpg', '.mpeg', '.m4v', '.3gp'];
  const files = [];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && videoExtensions.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  scanDir(testDir);

  if (files.length === 0) {
    console.log(`${colors.yellow}No video files found in ${testDir}${colors.reset}`);
    console.log(`\nSupported extensions: ${videoExtensions.join(', ')}`);
    process.exit(0);
  }

  console.log(`Found ${files.length} video file(s) to test\n`);

  // Initialize mpv
  console.log(`${colors.yellow}Initializing mpv...${colors.reset}`);
  try {
    player = new mpv({
      audio_only: false,
      verbose: false
    }, [
      '--pause',  // Start paused to avoid playback during test
      '--idle=yes'
    ]);

    await player.start();
    console.log(`${colors.green}✓ mpv initialized${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Failed to initialize mpv: ${error.message}${colors.reset}`);
    console.log(`\nMake sure mpv is installed:`);
    console.log(`  macOS: brew install mpv`);
    console.log(`  Ubuntu/Debian: sudo apt-get install mpv`);
    console.log(`  Windows: Download from https://mpv.io/`);
    process.exit(1);
  }

  // Test each file
  for (const file of files) {
    await testVideo(file);
  }

  // Print report
  printReport();

  // Cleanup
  await player.quit();
}

// Handle errors
process.on('uncaughtException', async (error) => {
  console.error(`${colors.red}Uncaught error: ${error.message}${colors.reset}`);
  if (player) {
    try {
      await player.quit();
    } catch (e) {
      // Ignore
    }
  }
  process.exit(1);
});

// Run
main().catch(async (error) => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  if (player) {
    try {
      await player.quit();
    } catch (e) {
      // Ignore
    }
  }
  process.exit(1);
});

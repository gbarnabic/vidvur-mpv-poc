#!/usr/bin/env node

/**
 * VidVuR mpv Proof of Concept
 *
 * Tests mpv's ability to play various video codecs without conversion overhead.
 * Focus: Codec support, frame-accurate playback, performance metrics.
 */

const mpv = require('node-mpv');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// State
let player = null;
let currentVideo = null;
let loopStart = null;
let loopEnd = null;
let forwardStepTimes = [];
let backwardStepTimes = [];

// Format time as MM:SS.mmm
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// Calculate average
function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Print header
function printHeader() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║          VidVuR mpv Proof of Concept - Codec Testing             ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();
}

// Print status
function printStatus(videoInfo) {
  console.log(`${colors.bright}${colors.blue}Current Video:${colors.reset}`);
  if (videoInfo) {
    console.log(`  File: ${videoInfo.filename}`);
    console.log(`  Codec: ${colors.green}${videoInfo.codec}${colors.reset}`);
    console.log(`  Resolution: ${videoInfo.width}x${videoInfo.height}`);
    console.log(`  FPS: ${videoInfo.fps ? videoInfo.fps.toFixed(2) : 'Unknown'}`);
    console.log(`  Duration: ${formatTime(videoInfo.duration)}`);
    console.log(`  Format: ${videoInfo.format || 'Unknown'}`);
  } else {
    console.log(`  ${colors.yellow}No video loaded${colors.reset}`);
  }
  console.log();

  // Loop info
  if (loopStart !== null || loopEnd !== null) {
    console.log(`${colors.bright}${colors.blue}A/B Loop:${colors.reset}`);
    if (loopStart !== null) console.log(`  Start (A): ${colors.green}${formatTime(loopStart)}${colors.reset}`);
    if (loopEnd !== null) console.log(`  End (B): ${colors.green}${formatTime(loopEnd)}${colors.reset}`);
    if (loopStart !== null && loopEnd !== null) {
      const duration = loopEnd - loopStart;
      console.log(`  Duration: ${colors.cyan}${formatTime(duration)}${colors.reset}`);
    }
    console.log();
  }

  // Performance metrics
  if (forwardStepTimes.length > 0 || backwardStepTimes.length > 0) {
    console.log(`${colors.bright}${colors.blue}Performance Metrics:${colors.reset}`);
    if (forwardStepTimes.length > 0) {
      console.log(`  Forward frame-step avg: ${colors.green}${avg(forwardStepTimes).toFixed(2)}ms${colors.reset} (${forwardStepTimes.length} samples)`);
    }
    if (backwardStepTimes.length > 0) {
      console.log(`  Backward frame-step avg: ${colors.yellow}${avg(backwardStepTimes).toFixed(2)}ms${colors.reset} (${backwardStepTimes.length} samples)`);
    }
    console.log();
  }
}

// Print controls
function printControls() {
  console.log(`${colors.bright}${colors.cyan}Controls:${colors.reset}`);
  console.log(`  ${colors.bright}l${colors.reset} - Load video file`);
  console.log(`  ${colors.bright}Space${colors.reset} - Toggle play/pause`);
  console.log(`  ${colors.bright}←/→${colors.reset} - Seek backward/forward 5s`);
  console.log(`  ${colors.bright}[/]${colors.reset} - Frame step backward/forward`);
  console.log(`  ${colors.bright}s${colors.reset} - Set loop start (A)`);
  console.log(`  ${colors.bright}f${colors.reset} - Set loop end (B)`);
  console.log(`  ${colors.bright}b${colors.reset} - Clear loop`);
  console.log(`  ${colors.bright}i${colors.reset} - Show video info`);
  console.log(`  ${colors.bright}r${colors.reset} - Reset performance metrics`);
  console.log(`  ${colors.bright}q${colors.reset} - Quit`);
  console.log();
}

// Get video info
async function getVideoInfo(filePath) {
  try {
    const codec = await player.getProperty('video-codec');
    const width = await player.getProperty('video-params/w');
    const height = await player.getProperty('video-params/h');
    const fps = await player.getProperty('video-params/fps');
    const duration = await player.getProperty('duration');
    const format = await player.getProperty('file-format');

    return {
      filename: path.basename(filePath),
      fullPath: filePath,
      codec: codec || 'Unknown',
      width: width || 0,
      height: height || 0,
      fps: fps || 0,
      duration: duration || 0,
      format: format || 'Unknown'
    };
  } catch (error) {
    console.error(`${colors.red}Error getting video info:${colors.reset}`, error.message);
    return null;
  }
}

// Load video
async function loadVideo(filePath) {
  try {
    console.log(`${colors.yellow}Loading: ${filePath}${colors.reset}`);
    const startTime = Date.now();

    await player.load(filePath);

    const loadTime = Date.now() - startTime;
    console.log(`${colors.green}✓ Loaded in ${loadTime}ms (no conversion needed!)${colors.reset}`);

    currentVideo = await getVideoInfo(filePath);

    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Failed to load video:${colors.reset}`, error.message);
    return false;
  }
}

// Frame step with timing
async function frameStep(direction) {
  const startTime = Date.now();

  try {
    if (direction === 'forward') {
      await player.command('frame-step');
    } else {
      await player.command('frame-back-step');
    }

    const elapsed = Date.now() - startTime;

    if (direction === 'forward') {
      forwardStepTimes.push(elapsed);
    } else {
      backwardStepTimes.push(elapsed);
    }

    console.log(`${colors.cyan}Frame step ${direction}: ${elapsed}ms${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Frame step failed:${colors.reset}`, error.message);
  }
}

// Initialize mpv
async function initialize() {
  printHeader();
  console.log(`${colors.yellow}Initializing mpv player...${colors.reset}`);

  try {
    player = new mpv({
      audio_only: false,
      time_update: 100,
      verbose: false
    }, [
      '--hr-seek=yes',
      '--hr-seek-framedrop=no',
      '--demuxer-max-back-bytes=100M',
      '--cache=yes',
      '--no-osd-bar',
      '--idle=yes'
    ]);

    await player.start();
    console.log(`${colors.green}✓ mpv initialized successfully${colors.reset}`);
    console.log();

    // Set up event listeners
    player.on('timeposition', (position) => {
      // Optionally display time updates
    });

    player.on('statuschange', (status) => {
      // console.log('Status:', status);
    });

    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Failed to initialize mpv:${colors.reset}`, error.message);
    console.log();
    console.log(`${colors.yellow}Make sure mpv is installed:${colors.reset}`);
    console.log(`  macOS: brew install mpv`);
    console.log(`  Ubuntu/Debian: sudo apt-get install mpv`);
    console.log(`  Windows: Download from https://mpv.io/`);
    return false;
  }
}

// Prompt for file
function promptForFile() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${colors.bright}Enter video file path: ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Show detailed info
async function showDetailedInfo() {
  if (!currentVideo) {
    console.log(`${colors.yellow}No video loaded${colors.reset}`);
    return;
  }

  printHeader();
  console.log(`${colors.bright}${colors.cyan}═══ Detailed Video Information ═══${colors.reset}`);
  console.log();

  try {
    const props = {
      'File': currentVideo.fullPath,
      'Codec': await player.getProperty('video-codec'),
      'Format': await player.getProperty('file-format'),
      'Resolution': `${await player.getProperty('video-params/w')}x${await player.getProperty('video-params/h')}`,
      'FPS': (await player.getProperty('video-params/fps')).toFixed(2),
      'Pixel Format': await player.getProperty('video-params/pixelformat'),
      'Duration': formatTime(await player.getProperty('duration')),
      'Bitrate': `${((await player.getProperty('video-bitrate')) / 1000000).toFixed(2)} Mbps`,
      'Current Time': formatTime(await player.getProperty('time-pos')),
      'Current Frame': await player.getProperty('estimated-frame-number')
    };

    for (const [key, value] of Object.entries(props)) {
      console.log(`  ${colors.bright}${key}:${colors.reset} ${colors.green}${value}${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}Error getting properties:${colors.reset}`, error.message);
  }

  console.log();
  console.log(`${colors.cyan}Press Enter to continue...${colors.reset}`);
  await new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

// Main loop
async function main() {
  const initialized = await initialize();
  if (!initialized) {
    process.exit(1);
  }

  // Setup stdin for keyboard input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Display UI
  printHeader();
  printStatus(currentVideo);
  printControls();

  // Keyboard handler
  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') {
      console.log(`\n${colors.yellow}Exiting...${colors.reset}`);
      if (player) await player.quit();
      process.exit();
    }

    // l - Load video
    if (key.name === 'l') {
      const filePath = await promptForFile();
      if (filePath && fs.existsSync(filePath)) {
        await loadVideo(filePath);
        printHeader();
        printStatus(currentVideo);
        printControls();
      } else {
        console.log(`${colors.red}File not found: ${filePath}${colors.reset}`);
      }
    }

    if (!currentVideo) return;

    // Space - Toggle pause
    if (key.name === 'space') {
      await player.togglePause();
      console.log(`${colors.cyan}Toggled pause${colors.reset}`);
    }

    // Left arrow - Seek back
    if (key.name === 'left') {
      await player.seek(-5, 'relative');
      console.log(`${colors.cyan}Seeked -5s${colors.reset}`);
    }

    // Right arrow - Seek forward
    if (key.name === 'right') {
      await player.seek(5, 'relative');
      console.log(`${colors.cyan}Seeked +5s${colors.reset}`);
    }

    // [ - Frame back
    if (str === '[') {
      await frameStep('backward');
    }

    // ] - Frame forward
    if (str === ']') {
      await frameStep('forward');
    }

    // s - Set loop start
    if (str === 's') {
      loopStart = await player.getProperty('time-pos');
      console.log(`${colors.green}Loop start set: ${formatTime(loopStart)}${colors.reset}`);
      if (loopEnd !== null) {
        await player.setProperty('ab-loop-a', loopStart);
        await player.setProperty('ab-loop-b', loopEnd);
        console.log(`${colors.green}✓ Loop activated${colors.reset}`);
      }
    }

    // f - Set loop end
    if (str === 'f') {
      loopEnd = await player.getProperty('time-pos');
      console.log(`${colors.green}Loop end set: ${formatTime(loopEnd)}${colors.reset}`);
      if (loopStart !== null) {
        await player.setProperty('ab-loop-a', loopStart);
        await player.setProperty('ab-loop-b', loopEnd);
        console.log(`${colors.green}✓ Loop activated${colors.reset}`);
      }
    }

    // b - Clear loop
    if (str === 'b') {
      loopStart = null;
      loopEnd = null;
      await player.setProperty('ab-loop-a', 'no');
      await player.setProperty('ab-loop-b', 'no');
      console.log(`${colors.yellow}Loop cleared${colors.reset}`);
    }

    // i - Show info
    if (str === 'i') {
      await showDetailedInfo();
      printHeader();
      printStatus(currentVideo);
      printControls();
    }

    // r - Reset metrics
    if (str === 'r') {
      forwardStepTimes = [];
      backwardStepTimes = [];
      console.log(`${colors.yellow}Performance metrics reset${colors.reset}`);
      printHeader();
      printStatus(currentVideo);
      printControls();
    }

    // q - Quit
    if (str === 'q') {
      console.log(`\n${colors.yellow}Quitting...${colors.reset}`);
      if (player) await player.quit();
      process.exit();
    }
  });

  // Check for command line argument (video file)
  if (process.argv[2]) {
    const filePath = process.argv[2];
    if (fs.existsSync(filePath)) {
      await loadVideo(filePath);
      printHeader();
      printStatus(currentVideo);
      printControls();
    } else {
      console.log(`${colors.red}File not found: ${filePath}${colors.reset}`);
    }
  }
}

// Handle errors
process.on('uncaughtException', async (error) => {
  console.error(`${colors.red}Uncaught error:${colors.reset}`, error);
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
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  if (player) {
    try {
      await player.quit();
    } catch (e) {
      // Ignore
    }
  }
  process.exit(1);
});

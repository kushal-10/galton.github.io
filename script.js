// ============================================
// 1) GLOBAL STATE & DOM REFERENCES
// ============================================
const canvas = document.getElementById('galtonCanvas');
const ctx = canvas.getContext('2d');

const leftPanel   = document.getElementById('leftPanel');
const centerPanel = document.getElementById('centerPanel');
const rightPanel  = document.getElementById('rightPanel');

const rowSlider    = document.getElementById('rowSlider');
const rowCountLbl  = document.getElementById('rowCount');
const startBtn     = document.getElementById('startBtn');
const stopBtn      = document.getElementById('stopBtn');
const resetBtn     = document.getElementById('resetBtn');
const biasControls = document.getElementById('biasControls');

// Canvas dimensions (will be set dynamically)
let W = 0,
  H = 0;

// Layout constants (relative to canvas)
const MARGIN_X      = 20;  // horizontal margin inside canvas
const MARGIN_TOP    = 20;  // vertical offset for top row of pegs
const MARGIN_BOTTOM = 360; // margin between last peg row and top of bins
const BIN_HEIGHT    = 360; // vertical size of bins area

// Colors
const COLOR_BOARD_BORDER = '#777';
const COLOR_BOARD_BG     = '#222';
const COLOR_PEG          = '#555';
const COLOR_BEAD         = '#0f0'; // green beads
const COLOR_BIN_DIVIDER  = '#777';

// Simulation state
let numRows = parseInt(rowSlider.value, 10);
let biases = []; // length = numRows, each ∈ [0,1]
let nailPositions = []; // array of length numRows; each is array of {x,y}
let binCenters = []; // length = numRows+1

// We'll also store these so we know how wide each bin is and where it begins:
let binWidthGlobal = 0;
let binLeftGlobal = 0;

// Beads in flight vs. beads already settled:
let activeBeads = [];   // { path:[{x,y},…], segment, t, finalBin }
let stationaryBeads = []; // { x, y }
let binCounts = []; // how many beads have settled in each bin

// Controls for dropping & animating
let beadDropInterval = null;
let animationRequestId = null;
let isRunning = false;

// Bead animation parameters
const BEAD_RADIUS = 3;
const BEAD_SPEED = 0.04; // animation speed; larger = faster
const DROP_RATE = 30;    // ms between spawning each new bead

// ============================================
// 2) INITIAL SETUP
// ============================================
window.addEventListener('load', () => {
  buildBiasControls();
  resizeCanvas(); // also triggers initial board draw

  // When “Rows” slider changes:
  rowSlider.addEventListener('input', () => {
    numRows = parseInt(rowSlider.value, 10);
    rowCountLbl.textContent = numRows;
    buildBiasControls();
    rebuildBoard();
  });

  // START
  startBtn.addEventListener('click', () => {
    if (!isRunning) {
      isRunning = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      beadDropInterval = setInterval(dropOneBead, DROP_RATE);
      animate();
    }
  });

  // STOP
  stopBtn.addEventListener('click', () => {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    if (beadDropInterval !== null) {
      clearInterval(beadDropInterval);
      beadDropInterval = null;
    }
  });

  // RESET
  resetBtn.addEventListener('click', () => {
    isRunning = false;
    if (beadDropInterval !== null) {
      clearInterval(beadDropInterval);
      beadDropInterval = null;
    }
    if (animationRequestId !== null) {
      cancelAnimationFrame(animationRequestId);
      animationRequestId = null;
    }
    activeBeads = [];
    stationaryBeads = [];
    binCounts = new Array(numRows + 1).fill(0);
    rebuildBoard();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });

  // If the window resizes, redraw the board
  window.addEventListener('resize', resizeCanvas);
});

// ============================================
// 3) BUILD PER‐ROW BIAS SLIDERS (RIGHT PANEL)
// ============================================
function buildBiasControls() {
  biases = [];
  biasControls.innerHTML = ''; // clear old sliders
  for (let r = 0; r < numRows; r++) {
    biases.push(0.5);
    const wrapper = document.createElement('div');
    wrapper.className = 'biasRow';

    const lbl = document.createElement('label');
    lbl.textContent = `Row ${r + 1} bias: 0.50`;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    input.value = '0.50';
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      biases[r] = v;
      lbl.textContent = `Row ${r + 1} bias: ${v.toFixed(2)}`;
    });

    wrapper.appendChild(lbl);
    wrapper.appendChild(input);
    biasControls.appendChild(wrapper);
  }
}

// ============================================
// 4) RESIZE CANVAS & REBUILD BOARD
// ============================================
function resizeCanvas() {
  // Make the canvas exactly fill the center panel
  W = centerPanel.clientWidth;
  H = centerPanel.clientHeight;
  canvas.width = W-5;
  canvas.height = H;
  rebuildBoard();
}

function rebuildBoard() {
  // Clear any existing beads / counts
  binCounts = new Array(numRows + 1).fill(0);
  activeBeads = [];
  stationaryBeads = [];

  computeNailPositions();
  computeBinCenters();
  drawBoard();
}

function computeNailPositions() {
    nailPositions = [];
  
    // ── User-tweakable constants ──────────────────────────────
    const H_PADDING        = 30;    // px padding on left & right
    const Y_SPACING_FACTOR = 3.5;   // 1 = default spacing, >1 = more spread
    const TOP_SHIFT        = 20;    // px to shift the entire pyramid down
    // ───────────────────────────────────────────────────────────
  
    // 1) Horizontal bounds for pegs, with extra padding
    const leftX      = MARGIN_X + H_PADDING;
    const rightX     = W - MARGIN_X - H_PADDING;
    const boardWidth = rightX - leftX;
  
    // 2) Uniform horizontal step so bottom row spans leftX→rightX
    const dx = (numRows > 1)
      ? boardWidth / (numRows - 1)
      : 0;
  
    // 3) Base vertical space for pegs
    const availableV = H - MARGIN_TOP - MARGIN_BOTTOM - BIN_HEIGHT;
    const baseDy = (numRows > 1)
      ? availableV / (numRows - 1)
      : 0;
    //    then stretch it by our factor
    const dy = baseDy * Y_SPACING_FACTOR;
  
    // 4) Build each row r = 0..numRows-1
    for (let r = 0; r < numRows; r++) {
      const count = r + 1;
      // Y = margin + extra shift + r * (stretched spacing)
      const y = MARGIN_TOP + TOP_SHIFT + r * dy;
  
      // this row’s width = (count-1)*dx
      const rowWidth = dx * (count - 1);
      // center it under [leftX, rightX]:
      const x0 = leftX + (boardWidth - rowWidth) / 2;
  
      const rowArr = [];
      for (let j = 0; j < count; j++) {
        rowArr.push({
          x: x0 + j * dx,
          y: y
        });
      }
      nailPositions.push(rowArr);
    }
  }
  

function computeBinCenters() {
  binCenters = [];
  const left = MARGIN_X;
  const right = W - MARGIN_X;
  const width = right - left;
  const binCount = numRows + 1;

  // Let bins occupy 90% of width (same as pegs):
  const usableWidth = width * 0.9;
  const xOffset = left + (width - usableWidth) / 2;
  const binWidth = usableWidth / binCount;

  // Store these globally so we can place beads in a grid inside each bin:
  binWidthGlobal = binWidth;
  binLeftGlobal = xOffset;

  for (let b = 0; b < binCount; b++) {
    const centerX = xOffset + binWidth * b + binWidth / 2;
    binCenters.push(centerX);
  }
}

// ============================================
// 6) DRAW EVERYTHING (BOARD, PEGS, BINS, BEADS)
// ============================================
function drawBoard() {
  // 1) Clear canvas
  ctx.clearRect(0, 0, W, H);

  // 2) Draw board background (dark gray rectangle)
  const boardLeft = MARGIN_X;
  const boardRight = W - MARGIN_X;
  const boardTop = MARGIN_TOP - 2;
  const boardBottom = H - MARGIN_BOTTOM + BIN_HEIGHT;
  ctx.fillStyle = COLOR_BOARD_BG;
  ctx.fillRect(
    boardLeft,
    boardTop,
    boardRight - boardLeft,
    boardBottom - boardTop
  );

  // 3) Draw board border
  ctx.strokeStyle = COLOR_BOARD_BORDER;
  ctx.lineWidth = 8;
  ctx.strokeRect(
    boardLeft,
    boardTop,
    boardRight - boardLeft,
    boardBottom - boardTop
  );

  // 4) Draw pegs
  ctx.fillStyle = COLOR_PEG;
  for (let r = 0; r < nailPositions.length; r++) {
    for (let peg of nailPositions[r]) {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5) Draw bin dividers
  const binTopY = H - MARGIN_BOTTOM;
  const binBottomY = binTopY + BIN_HEIGHT;
  ctx.strokeStyle = COLOR_BIN_DIVIDER;
  ctx.lineWidth = 3;

  // We need (numRows+1) bins ⇒ (numRows+2) divider lines
  // Leftmost line at x = binLeftGlobal
  // Then at x = binLeftGlobal + binWidthGlobal, … up to binCount+1 lines.
  const binCount = numRows + 1;
  for (let i = 0; i <= binCount; i++) {
    const xLine = binLeftGlobal + i * binWidthGlobal;
    ctx.beginPath();
    ctx.moveTo(xLine, binTopY);
    ctx.lineTo(xLine, binBottomY);
    ctx.stroke();
  }

  // 6) Draw stationary (settled) beads
  ctx.fillStyle = COLOR_BEAD;
  for (let bead of stationaryBeads) {
    ctx.beginPath();
    ctx.arc(bead.x, bead.y, BEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7) Draw active (falling) beads
  ctx.fillStyle = COLOR_BEAD;
  for (let bead of activeBeads) {
    ctx.beginPath();
    ctx.arc(bead.currentX, bead.currentY, BEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================
// 7) SPAWN A NEW BEAD (NO PHYSICS, JUST RANDOM PATH)
// ============================================
function dropOneBead() {
  // Build a list of waypoints (x,y) that the bead will follow:
  const waypoints = [];
  // 1) Starting point: above the top peg, horizontally centered
  const startX = W / 2;
  const startY = MARGIN_TOP - 20;
  waypoints.push({ x: startX, y: startY });

  // 2) “Fall” through each row, deciding left/right by bias[r]
  let idx = 0; // how many “rights” so far
  for (let r = 0; r < numRows; r++) {
    // a) Visit the peg at [r][idx]:
    const peg = nailPositions[r][idx];
    waypoints.push({ x: peg.x, y: peg.y });

    // b) Random draw vs. biases[r]:
    const p = Math.random();
    if (p < biases[r]) {
      idx = Math.min(idx + 1, r + 1);
    } else {
      idx = Math.max(idx, 0);
    }
  }

  // 3) Final bin index is idx ∈ [0 … numRows]
  const finalBin = idx;

  // 4) Add one more waypoint: drop into the top of that bin
  // We put it at (bin center, slightly inside the bin region).
  const binTopY = H - MARGIN_BOTTOM;
  const wpX = binCenters[finalBin];
  const wpY = binTopY + BEAD_RADIUS;
  waypoints.push({ x: wpX, y: wpY });

  // 5) Create bead object and push into activeBeads
  const beadObj = {
    path: waypoints, // array of {x,y}
    segment: 0, // which segment of path we’re on
    t: 0, // interpolation [0..1] along current segment
    currentX: startX,
    currentY: startY,
    finalBin,
  };
  activeBeads.push(beadObj);
}

// ============================================
// 8) ANIMATION LOOP (MOVE BEADS ALONG THEIR PATHS)
// ============================================
function animate() {
  // 1) Advance each active bead
  for (let i = activeBeads.length - 1; i >= 0; i--) {
    const bead = activeBeads[i];
    const segIdx = bead.segment;
    const path = bead.path;

    // If we’ve already reached the last waypoint, we “settle” the bead:
    if (segIdx >= path.length - 1) {
      const b = bead.finalBin;
      // Increment bin count first:
      binCounts[b]++;
      const count = binCounts[b];

      // Now compute that bead’s final (x,y) inside the bin in a grid.
      //  • Each bin is binWidthGlobal wide, starting at binLeftGlobal + b*binWidthGlobal.
      //  • Fit as many columns as possible: maxCols = floor(binWidth / (2*BEAD_RADIUS)).
      const maxCols = Math.floor(binWidthGlobal / (2 * BEAD_RADIUS));
      const index = count - 1; // zero‐based index in this bin
      const col = index % maxCols; // which column (0..maxCols−1)
      const rowNum = Math.floor(index / maxCols); // which row above bottom

      // Compute x: left edge + (col * diameter) + radius
      const binLeft = binLeftGlobal + b * binWidthGlobal;
      const xFinal = binLeft + col * (2 * BEAD_RADIUS) + BEAD_RADIUS;

      // Compute y: bottom of bin = binTopY + BIN_HEIGHT;
      // stack upward row by row:
      const binTopY = H - MARGIN_BOTTOM;
      const binBottomY = binTopY + BIN_HEIGHT;
      const yFinal = binBottomY - BEAD_RADIUS - rowNum * (2 * BEAD_RADIUS);

      stationaryBeads.push({ x: xFinal, y: yFinal });

      // Remove from activeBeads
      activeBeads.splice(i, 1);
      continue;
    }

    // Otherwise, interpolate along path[segIdx] → path[segIdx+1]:
    const p0 = path[segIdx];
    const p1 = path[segIdx + 1];
    bead.t += BEAD_SPEED;
    if (bead.t >= 1) {
      // Snap exactly to the next waypoint, then advance segment index
      bead.segment++;
      bead.t = 0;
      bead.currentX = p1.x;
      bead.currentY = p1.y;
    } else {
      // linear interpolation
      bead.currentX = p0.x + (p1.x - p0.x) * bead.t;
      bead.currentY = p0.y + (p1.y - p0.y) * bead.t;
    }
  }

  // 2) Redraw the board (pegs, bins, all beads)
  drawBoard();

  // 3) Continue animating if we are still “running” or there are beads mid‐flight
  if (isRunning || activeBeads.length > 0) {
    animationRequestId = requestAnimationFrame(animate);
  } else {
    animationRequestId = null;
  }
}

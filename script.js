// ============================================
// GLOBAL STATE & DOM REFERENCES
// ============================================
const canvas        = document.getElementById('galtonCanvas');
const ctx           = canvas.getContext('2d');
const leftPanel     = document.getElementById('leftPanel');
const centerPanel   = document.getElementById('centerPanel');
const rightPanel    = document.getElementById('rightPanel');
const ballSlider    = document.getElementById('ballSlider');
const ballCountLabel= document.getElementById('ballCount');
const rowSlider     = document.getElementById('rowSlider');
const rowCountLbl   = document.getElementById('rowCount');
const startBtn      = document.getElementById('startBtn');
const stopBtn       = document.getElementById('stopBtn');
const resetBtn      = document.getElementById('resetBtn');
const biasControls  = document.getElementById('biasControls');

// Simulation parameters
let totalBalls       = parseInt(ballSlider.value, 10);
let ballsLeft        = totalBalls;
let numRows          = parseInt(rowSlider.value, 10);
let biases           = [];
let nailPositions    = [];
let binCenters       = [];
let binWidthGlobal   = 0;
let binLeftGlobal    = 0;
let binTopY          = 0;
let binHeight        = 0;

let activeBeads      = [];
let stationaryBeads  = [];
let binCounts        = [];

let beadDropInterval = null;
let animationRequestId= null;
let isRunning         = false;

// Visual/physics constants
const BEAD_RADIUS       = 3;
const BEAD_SPEED        = 0.04;
const DROP_RATE         = 30;

// Layout constants
const MARGIN_X          = 20;
const MARGIN_TOP        = 20;
const COLOR_BOARD_BORDER= '#777';
const COLOR_BOARD_BG    = '#222';
const COLOR_PEG         = '#555';
const COLOR_BEAD        = '#0f0';
const COLOR_BIN_DIVIDER = '#777';

// Peg vs bin allocation fraction
const PEG_FRACTION      = 0.75;
const PEG_BOTTOM_PAD    = BEAD_RADIUS * 2 + 5;

// ============================================
// INITIAL SETUP
// ============================================
window.addEventListener('load', () => {
  buildBiasControls();
  resizeCanvas();

  rowSlider.addEventListener('input', () => {
    numRows = parseInt(rowSlider.value, 10);
    rowCountLbl.textContent = numRows;
    buildBiasControls();
    rebuildBoard();
  });

  ballSlider.addEventListener('input', () => {
    totalBalls = parseInt(ballSlider.value, 10);
    ballCountLabel.textContent = totalBalls;
  });

  startBtn.addEventListener('click', () => {
    if (!isRunning) {
      ballsLeft = totalBalls;
      isRunning = true;
      startBtn.disabled = true;
      stopBtn.disabled  = false;
      beadDropInterval = setInterval(() => {
        if (ballsLeft > 0) {
          dropOneBead(); ballsLeft--; }
        else { clearInterval(beadDropInterval); beadDropInterval = null; }
      }, DROP_RATE);
      animate();
    }
  });

  stopBtn.addEventListener('click', () => {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    if (beadDropInterval) { clearInterval(beadDropInterval); beadDropInterval = null; }
  });

  resetBtn.addEventListener('click', () => {
    isRunning = false;
    if (beadDropInterval) { clearInterval(beadDropInterval); beadDropInterval = null; }
    if (animationRequestId) { cancelAnimationFrame(animationRequestId); animationRequestId = null; }
    activeBeads = [];
    stationaryBeads = [];
    binCounts = new Array(numRows + 1).fill(0);
    rebuildBoard();
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    ballsLeft = totalBalls;
  });

  window.addEventListener('resize', resizeCanvas);
});

// ============================================
// BUILD PER‐ROW BIAS SLIDERS
// ============================================
function buildBiasControls() {
  biases = [];
  biasControls.innerHTML = '';
  for (let r = 0; r < numRows; r++) {
    biases.push(0.5);
    const wrapper = document.createElement('div');
    wrapper.className = 'biasRow';

    const lbl = document.createElement('label');
    lbl.textContent = `Row ${r+1} bias: 0.50`;

    const input = document.createElement('input');
    input.type = 'range'; input.min = 0; input.max = 1; input.step = 0.01; input.value = 0.5;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      biases[r] = v;
      lbl.textContent = `Row ${r+1} bias: ${v.toFixed(2)}`;
    });

    wrapper.append(lbl, input);
    biasControls.appendChild(wrapper);
  }
}

// ============================================
// RESIZE CANVAS & REBUILD BOARD
// ============================================
function resizeCanvas() {
  const cssW = centerPanel.clientWidth;
  const cssH = centerPanel.clientHeight;
  const dpr  = window.devicePixelRatio || 1;

  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width  = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  W = cssW; H = cssH;
  rebuildBoard();
}

function rebuildBoard() {
  binCounts = new Array(numRows + 1).fill(0);
  activeBeads = [];
  stationaryBeads = [];

  computeNailPositions();
  computeBinRegion();
  computeBinCenters();
  drawBoard();
}

// ============================================
// COMPUTE PEG POSITIONS (ALLOCATE PEG_FRACTION OF VERTICAL SPACE)
// ============================================
function computeNailPositions() {
  nailPositions = [];
  const leftX = MARGIN_X;
  const rightX= W - MARGIN_X;
  const totalWidth = rightX - leftX;

  // Vertical space under top margin, minus pad before bins
  const totalV = H - MARGIN_TOP - PEG_BOTTOM_PAD;
  const pegRegionH = totalV * PEG_FRACTION;

  const dx = numRows > 1 ? totalWidth / (numRows - 1) : 0;
  const baseDy = numRows > 1 ? pegRegionH / (numRows - 1) : 0;
  const dy = baseDy;

  for (let r = 0; r < numRows; r++) {
    const count = r + 1;
    const y = MARGIN_TOP + r * dy;
    const rowWidth = dx * (count - 1);
    const x0 = leftX + (totalWidth - rowWidth) / 2;
    const rowArr = [];
    for (let j = 0; j < count; j++) {
      rowArr.push({ x: x0 + j * dx, y: y });
    }
    nailPositions.push(rowArr);
  }
}

// ============================================
// COMPUTE BIN REGION (JUST BELOW PEGS)
// ============================================
function computeBinRegion() {
  const lastRow = nailPositions[nailPositions.length - 1];
  const maxPegY = Math.max(...lastRow.map(p => p.y));
  binTopY = maxPegY + PEG_BOTTOM_PAD;
  binHeight = H - binTopY;
}

// ============================================
// COMPUTE BIN CENTERS & SIZES
// ============================================
function computeBinCenters() {
  binCenters = [];
  const left = MARGIN_X;
  const right= W - MARGIN_X;
  const totalWidth = right - left;
  const binCount = numRows + 1;
  const usableWidth = totalWidth * 0.9;
  const xOffset = left + (totalWidth - usableWidth) / 2;
  const binW = usableWidth / binCount;

  binLeftGlobal = xOffset;
  binWidthGlobal= binW;

  for (let b = 0; b < binCount; b++) {
    binCenters.push(xOffset + b * binW + binW/2);
  }
}

// ============================================
// DRAW EVERYTHING
// ============================================
function drawBoard() {
  ctx.clearRect(0, 0, W, H);

  // Board background & border
  const boardLeft   = MARGIN_X;
  const boardRight  = W - MARGIN_X;
  const boardTop    = MARGIN_TOP - 2;
  const boardBottom = H;
  ctx.fillStyle   = COLOR_BOARD_BG;
  ctx.fillRect(boardLeft, boardTop, boardRight - boardLeft, boardBottom - boardTop);
  ctx.strokeStyle = COLOR_BOARD_BORDER;
  ctx.lineWidth   = 8;
  ctx.strokeRect(boardLeft, boardTop, boardRight - boardLeft, boardBottom - boardTop);

  // Pegs
  ctx.fillStyle = COLOR_PEG;
  for (let row of nailPositions) {
    for (let peg of row) {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, 5, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Bins
  ctx.strokeStyle = COLOR_BIN_DIVIDER;
  ctx.lineWidth   = 3;
  const binBottomY = H;
  for (let i = 0; i <= numRows+1; i++) {
    const xLine = binLeftGlobal + i * binWidthGlobal;
    ctx.beginPath();
    ctx.moveTo(xLine, binTopY);
    ctx.lineTo(xLine, binBottomY);
    ctx.stroke();
  }

  // Stationary beads
  ctx.fillStyle = COLOR_BEAD;
  for (let b of stationaryBeads) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BEAD_RADIUS, 0, Math.PI*2);
    ctx.fill();
  }

  // Active beads
  ctx.fillStyle = COLOR_BEAD;
  for (let bead of activeBeads) {
    ctx.beginPath();
    ctx.arc(bead.currentX, bead.currentY, BEAD_RADIUS, 0, Math.PI*2);
    ctx.fill();
  }
}

// ============================================
// SPAWN A NEW BEAD & COMPUTE ITS PATH
// ============================================
function dropOneBead() {
  const waypoints = [];
  const startX = W/2;
  const startY = MARGIN_TOP - 20;
  waypoints.push({ x: startX, y: startY });

  let idx = 0;
  for (let r = 0; r < numRows; r++) {
    const peg = nailPositions[r][idx];
    waypoints.push({ x: peg.x, y: peg.y });
    if (Math.random() < biases[r]) idx = Math.min(idx+1, r+1);
    else                              idx = Math.max(idx, 0);
  }

  const finalBin = idx;
  const wpX = binCenters[finalBin];
  const wpY = binTopY + BEAD_RADIUS;
  waypoints.push({ x: wpX, y: wpY });

  activeBeads.push({ path: waypoints, segment: 0, t: 0, currentX: startX, currentY: startY, finalBin });
}

// ============================================
// ANIMATION LOOP
// ============================================
function animate() {
  for (let i = activeBeads.length - 1; i >= 0; i--) {
    const bead = activeBeads[i];
    const path = bead.path;
    const seg  = bead.segment;

    if (seg >= path.length - 1) {
      const b = bead.finalBin;
      binCounts[b]++;
      const count = binCounts[b] - 1;
      const maxCols= Math.floor(binWidthGlobal/(2*BEAD_RADIUS));
      const col   = count % maxCols;
      const rowNum= Math.floor(count/maxCols);

      const binLeft = binLeftGlobal + b*binWidthGlobal;
      const xFinal  = binLeft + col*(2*BEAD_RADIUS) + BEAD_RADIUS;
      const yFinal  = H - rowNum*(2*BEAD_RADIUS) - BEAD_RADIUS;
      stationaryBeads.push({ x: xFinal, y: yFinal });
      activeBeads.splice(i, 1);
      continue;
    }

    const p0 = path[seg];
    const p1 = path[seg+1];
    bead.t += BEAD_SPEED;
    if (bead.t >= 1) {
      bead.segment++;
      bead.t = 0;
      bead.currentX = p1.x;
      bead.currentY = p1.y;
    } else {
      bead.currentX = p0.x + (p1.x-p0.x)*bead.t;
      bead.currentY = p0.y + (p1.y-p0.y)*bead.t;
    }
  }

  drawBoard();
  if (isRunning || activeBeads.length) {
    animationRequestId = requestAnimationFrame(animate);
  } else {
    animationRequestId = null;
  }
}

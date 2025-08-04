// ============================================
// GLOBAL STATE & DOM REFERENCES
// ============================================
const canvas           = document.getElementById('galtonCanvas');
const ctx              = canvas.getContext('2d');
const leftPanel        = document.getElementById('leftPanel');
const centerPanel      = document.getElementById('centerPanel');
const rightPanel       = document.getElementById('rightPanel');
const ballSlider       = document.getElementById('ballSlider');
const ballCountLabel   = document.getElementById('ballCount');
const rowSlider        = document.getElementById('rowSlider');
const rowCountLbl      = document.getElementById('rowCount');
const startBtn         = document.getElementById('startBtn');
const stopBtn          = document.getElementById('stopBtn');
const resetBtn         = document.getElementById('resetBtn');
const biasControls     = document.getElementById('biasControls');

// Simulation state
let totalBalls         = parseInt(ballSlider.value, 10);
let ballsLeft          = totalBalls;
let numRows            = parseInt(rowSlider.value, 10);
let biases             = [];
let nailPositions      = [];
let binCenters         = [];
let binLeft            = 0;
let binWidth           = 0;
let binTopY            = 0;
let binHeight          = 0;

let activeBeads        = [];
let settledBeads       = [];
let binCounts          = [];

let dropInterval       = null;
let animRequest        = null;
let isRunning          = false;

// Visual & physics constants
const BEAD_RADIUS       = 3;
const BEAD_SPEED        = 0.04;
const DROP_RATE         = 30;

// Layout constants
const MARGIN_X          = 20;
const MARGIN_TOP        = 20;
const COLOR_BG          = '#222';
const COLOR_BORDER      = '#777';
const COLOR_PEG         = '#555';
const COLOR_BEAD        = '#0f0';
const COLOR_DIVIDER     = '#777';

// Peg region
const PEG_HOR_FRAC      = 0.7;
const PEG_VERT_FRAC     = 0.75;
const PEG_BOTTOM_PAD    = BEAD_RADIUS * 2 + 5;
const MAX_ROWS          = parseInt(rowSlider.max, 10);

// Basket & funnel
const BASKET_HEIGHT     = 400;
const FUNNEL_WIDTH      = 200;
const FUNNEL_GAP        = 200;
const MAX_BASKET_BEADS  = 50;

// --------------------------------------------
// INITIAL SETUP
// --------------------------------------------
window.addEventListener('load', () => {
  setupControls();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
});

function setupControls() {
  rowCountLbl.textContent = numRows;
  ballCountLabel.textContent = totalBalls;

  rowSlider.addEventListener('input', () => {
    numRows = parseInt(rowSlider.value, 10);
    rowCountLbl.textContent = numRows;
    initBiases();
    resetSimulation();
  });

  ballSlider.addEventListener('input', () => {
    totalBalls = parseInt(ballSlider.value, 10);
    ballsLeft = totalBalls;
    ballCountLabel.textContent = totalBalls;
    resetSimulation();
  });

  startBtn.addEventListener('click', () => {
    if (!isRunning) startSimulation();
  });

  stopBtn.addEventListener('click', () => {
    stopSimulation();
  });

  resetBtn.addEventListener('click', () => {
    resetSimulation();
  });

  initBiases();
}

function initBiases() {
  biases = Array(numRows).fill(0.5);
  biasControls.innerHTML = '';
  biases.forEach((b, i) => {
    const div = document.createElement('div'); div.className = 'biasRow';
    const lbl = document.createElement('label');
    lbl.textContent = `Row ${i+1} bias: ${b.toFixed(2)}`;
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.01; inp.value = b;
    inp.addEventListener('input', () => {
      biases[i] = parseFloat(inp.value);
      lbl.textContent = `Row ${i+1} bias: ${biases[i].toFixed(2)}`;
    });
    div.append(lbl, inp);
    biasControls.appendChild(div);
  });
}

// --------------------------------------------
// CANVAS RESIZE & BOARD REBUILD
// --------------------------------------------
function resizeCanvas() {
  const w = centerPanel.clientWidth;
  const h = centerPanel.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  W = w; H = h;
  resetSimulation();
}

function resetSimulation() {
  ballsLeft = totalBalls;
  settledBeads = [];
  binCounts = Array(numRows+1).fill(0);
  computeLayout();
  drawBoard();
  isRunning = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (dropInterval) clearInterval(dropInterval);
  if (animRequest) cancelAnimationFrame(animRequest);
}

function startSimulation() {
  isRunning = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  dropInterval = setInterval(() => {
    if (ballsLeft > 0) {
      launchBead();
      ballsLeft--;
    } else {
      clearInterval(dropInterval);
    }
  }, DROP_RATE);
  animate();
}

function stopSimulation() {
  isRunning = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (dropInterval) clearInterval(dropInterval);
  if (animRequest) cancelAnimationFrame(animRequest);
}

// --------------------------------------------
// LAYOUT COMPUTATION
// --------------------------------------------
function computeLayout() {
  // pegs
  nailPositions = [];
  const left = MARGIN_X;
  const right = W - MARGIN_X;
  const spanW = right - left;
  const pegRegionW = spanW * PEG_HOR_FRAC;
  const pegOffsetX = left + (spanW - pegRegionW)/2;
  const pegRegionH = (H - MARGIN_TOP - PEG_BOTTOM_PAD) * PEG_VERT_FRAC;
  const dx = pegRegionW / (MAX_ROWS - 1);
  const dy = pegRegionH / (MAX_ROWS - 1);
  const rowOff = MAX_ROWS - numRows;
  const topY = MARGIN_TOP;
  for (let r = 0; r < numRows; r++) {
    const count = r+1;
    const y = topY + (rowOff + r)*dy;
    const rowW = dx*(count-1);
    const x0 = pegOffsetX + (pegRegionW-rowW)/2;
    const row = [];
    for (let j=0; j<count; j++) row.push({ x: x0 + j*dx, y });
    nailPositions.push(row);
  }
  // bins
  const lastRow = nailPositions[nailPositions.length-1];
  binTopY = Math.max(...lastRow.map(p=>p.y)) + PEG_BOTTOM_PAD;
  binHeight = H - binTopY;
  binLeft = lastRow[0].x - dx;
  binWidth = dx;
  binCenters = [];
  for (let i=0; i<= numRows; i++) binCenters.push(binLeft + (i+0.5)*binWidth);
}

// --------------------------------------------
// DRAWING
// --------------------------------------------
function drawBoard() {
  ctx.clearRect(0,0,W,H);

  // compute funnel above top peg
const topRow = nailPositions[0];
const leftPeg = topRow[0];
const rightPeg= topRow[topRow.length-1];
const topPegY = leftPeg.y;
const funnelTopY    = topPegY - FUNNEL_GAP;
const funnelLeftX   = W/2 - FUNNEL_WIDTH/2;
const funnelRightX  = W/2 + FUNNEL_WIDTH/2;

// draw funnel walls
ctx.strokeStyle = COLOR_DIVIDER;
ctx.lineWidth   = 2;
ctx.beginPath();
ctx.moveTo(funnelLeftX,  funnelTopY);
ctx.lineTo(leftPeg.x,    topPegY-50);
ctx.lineTo(rightPeg.x,   topPegY-50);
ctx.lineTo(funnelRightX, funnelTopY);
ctx.closePath();
ctx.stroke();

// draw beads inside funnel region as a fixed grid, removing from top-left to bottom-right
ctx.fillStyle = COLOR_BEAD;
const funnelHeight = topPegY - 50 - funnelTopY;
const bottomWidth = rightPeg.x - leftPeg.x;
const cols = Math.floor(FUNNEL_WIDTH / (2 * BEAD_RADIUS));
const totalRows = Math.ceil(totalBalls / cols) || 1;
let beadsDrawn = 0;

for (let r = 0; r < totalRows; r++) {
  for (let c = 0; c < cols; c++) {
    let beadIdx = r * cols + c; // top-left to bottom-right
    if (beadIdx >= totalBalls) continue;
    if (beadIdx >= ballsLeft) continue; // skip dropped beads

    // drawRow = r (top to bottom), drawCol = c (left to right)
    const y = funnelTopY + (r + 0.5) * (funnelHeight / totalRows);
    const t = (y - funnelTopY) / funnelHeight;
    const widthAtY = FUNNEL_WIDTH + t * (bottomWidth - FUNNEL_WIDTH);
    const xLeft = W / 2 - widthAtY / 2;
    const x = xLeft + (c + 0.5) * (widthAtY / cols);

    ctx.beginPath();
    ctx.arc(x, y, BEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    beadsDrawn++;
    if (beadsDrawn >= ballsLeft) break;
  }
  if (beadsDrawn >= ballsLeft) break;
}



// no basket or beads above—beads originate at topPegY

// board(MARGIN_X, MARGIN_TOP-2, W-2*MARGIN_X, H-(MARGIN_TOP-2));
  ctx.strokeStyle = COLOR_BORDER;
  ctx.lineWidth   = 8;
  ctx.strokeRect(MARGIN_X, MARGIN_TOP-2, W-2*MARGIN_X, H-(MARGIN_TOP-2));

  // pegs
  ctx.fillStyle = COLOR_PEG;
  nailPositions.forEach(row => row.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill();
  }));

  // bins
  ctx.strokeStyle = COLOR_DIVIDER;
  ctx.lineWidth   = 3;
  for (let i=0; i<=numRows+1; i++) {
    const x = binLeft + i*binWidth;
    ctx.beginPath(); ctx.moveTo(x, binTopY); ctx.lineTo(x, H); ctx.stroke();
  }

  // settled beads
  ctx.fillStyle = COLOR_BEAD;
  settledBeads.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x,b.y,BEAD_RADIUS,0,Math.PI*2); ctx.fill();
  });

  // active beads
  ctx.fillStyle = COLOR_BEAD;
  activeBeads.forEach(bead => {
    ctx.beginPath(); ctx.arc(bead.currentX,bead.currentY,BEAD_RADIUS,0,Math.PI*2); ctx.fill();
  });
}

// --------------------------------------------
// BEAD SPAWN & ANIMATION
// --------------------------------------------
function launchBead() {
  const path = [];
  const startX = W/2;
  const startY = nailPositions[0][0].y;
  path.push({ x: startX, y: startY });
  let idx = 0;
  for (let r=0; r<numRows; r++) {
    const peg = nailPositions[r][idx];
    path.push({ x: peg.x, y: peg.y });
    idx = Math.random() < biases[r] ? Math.min(idx+1, r+1) : Math.max(idx, 0);
  }
  const final = idx;
  path.push({ x: binCenters[final], y: binTopY + BEAD_RADIUS });
  activeBeads.push({ path, segment:0, t:0, final });
}

function animate() {
  for (let i = activeBeads.length-1; i>=0; i--) {
    const b = activeBeads[i];
    const { path, segment, t } = b;
    if (segment >= path.length-1) {
      const bin = b.final;
      const count = binCounts[bin]++;
      const cols = Math.floor(binWidth/(2*BEAD_RADIUS));
      const col = count % cols;
      const row = Math.floor(count/cols);
      const x = binLeft + bin*binWidth + col*2*BEAD_RADIUS + BEAD_RADIUS;
      const y = H - row*2*BEAD_RADIUS - BEAD_RADIUS;
      settledBeads.push({ x, y });
      activeBeads.splice(i,1);
      continue;
    }
    b.t += BEAD_SPEED;
    if (b.t >= 1) {
      b.segment++;
      b.t = 0;
      b.currentX = path[b.segment].x;
      b.currentY = path[b.segment].y;
    } else {
      const p0 = path[b.segment];
      const p1 = path[b.segment+1];
      b.currentX = p0.x + (p1.x-p0.x)*b.t;
      b.currentY = p0.y + (p1.y-p0.y)*b.t;
    }
  }
  drawBoard();
  if (isRunning || activeBeads.length) animRequest = requestAnimationFrame(animate);
}

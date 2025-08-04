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
const BEAD_RADIUS       = 4;
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
const FUNNEL_TUNNEL_WIDTH = 40;
const MAX_BASKET_BEADS  = 50;

// Hex peg constants
const HEX_RADIUS        = 7;

// For funnel drawing
let funnelTopY = 0, funnelLeftX = 0, funnelRightX = 0;
let tunnelY = 0, tunnelLeftX = 0, tunnelRightX = 0;

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
  // ---- BINS ----
  if (numRows == 1) pegOffset = 400, binOffset = 570;
  else if (numRows == 2) pegOffset = 300, binOffset = 545 ;
  else if (numRows == 3) pegOffset = 250, binOffset = 525;
  else if (numRows == 4) pegOffset = 220, binOffset = 505;
  else if (numRows == 5) pegOffset = 200, binOffset = 480;
  else if (numRows == 6) pegOffset = 180, binOffset = 460;
  else if (numRows == 7) pegOffset = 170, binOffset = 440;
  else if (numRows == 8) pegOffset = 160, binOffset = 415;
  else if (numRows == 9) pegOffset = 150, binOffset = 395;
  else if (numRows == 10) pegOffset = 140, binOffset = 370;
  else if (numRows == 11) pegOffset = 130, binOffset = 350;
  else if (numRows == 12) pegOffset = 120, binOffset = 330;
  else if (numRows == 13) pegOffset = 110, binOffset = 305;
  else if (numRows == 14) pegOffset = 110, binOffset = 280;
  else if (numRows == 15) pegOffset = 110, binOffset = 260;
  else pegOffset = 10;

  const left = MARGIN_X + pegOffset;
  const right = W - MARGIN_X - pegOffset;
  const binRegionW = right - left;
  const binCount = numRows + 1;
  binWidth = binRegionW / binCount;
  binLeft = left;
  binCenters = [];
  for (let i = 0; i < binCount; i++)
    binCenters.push(binLeft + (i + 0.5) * binWidth);

  // Bins always at the same place
  
  binTopY = H - binOffset; // leave room for balls to pile up

  // ---- PEGS ----
  // Funnel opening (tunnel) always at fixed place
  const funnelBaseY = MARGIN_TOP + 210;
  const PEG_DY = 22; // fixed vertical gap between rows (adjust as you like)
  const pegRegionTop = funnelBaseY + 32; // gap below funnel

  nailPositions = [];
  for (let r = 0; r < numRows; r++) {
    const count = r + 1;
    // Each row is PEG_DY lower than the previous
    const y = pegRegionTop + r * PEG_DY;
    // Bottom row of pegs aligns just above bins if nrows==15 (or whatever your max is)
    // Compute horizontal spread so that bottom row aligns with bins
    const rowW = binWidth * (count - 1);
    const x0 = binLeft + (binRegionW - rowW) / 2;
    const row = [];
    for (let j = 0; j < count; j++) row.push({ x: x0 + j * binWidth, y });
    nailPositions.push(row);
  }

  // ---- FUNNEL ----
  // Tunnel opening (horizontal base) always at fixed place
  tunnelY = funnelBaseY;
  tunnelLeftX = W / 2 - FUNNEL_TUNNEL_WIDTH / 2;
  tunnelRightX = W / 2 + FUNNEL_TUNNEL_WIDTH / 2;
  funnelTopY = MARGIN_TOP + 12;
  funnelLeftX = W / 2 - FUNNEL_WIDTH / 2;
  funnelRightX = W / 2 + FUNNEL_WIDTH / 2;
}


// --------------------------------------------
// DRAWING
// --------------------------------------------
function drawHexagon(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI/3 * i - Math.PI/6; // flat side up
    const xi = x + radius * Math.cos(angle);
    const yi = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(xi, yi);
    else ctx.lineTo(xi, yi);
  }
  ctx.closePath();
  ctx.fill();
}

function drawBoard() {
  ctx.clearRect(0,0,W,H);

  // ---- Funnel walls ----
  ctx.strokeStyle = COLOR_DIVIDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(funnelLeftX, funnelTopY);
  ctx.lineTo(tunnelLeftX, tunnelY);
  ctx.lineTo(tunnelRightX, tunnelY);
  ctx.lineTo(funnelRightX, funnelTopY);
  ctx.closePath();
  ctx.stroke();

  // Draw the small circular opening at the bottom center of the tunnel
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc((tunnelLeftX + tunnelRightX) / 2, tunnelY + BEAD_RADIUS, BEAD_RADIUS + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  // ---- Funnel beads ----
  ctx.fillStyle = COLOR_BEAD;
  const funnelHeight = tunnelY - funnelTopY;
  const bottomWidth = tunnelRightX - tunnelLeftX;
  const cols = Math.floor(FUNNEL_WIDTH / (2 * BEAD_RADIUS));
  const totalRows = Math.ceil(ballsLeft / cols);
  let beadsDrawn = 0;
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < cols; c++) {
      let beadIdx = r * cols + c;
      if (beadIdx >= ballsLeft) continue;
      let y, x;
      if (r === totalRows - 1) {
        // Last row: beads distributed along tunnel opening
        y = tunnelY;
        const nLast = ballsLeft - r * cols;
        x = tunnelLeftX + ((c + 0.5) * (bottomWidth / nLast));
      } else {
        y = funnelTopY + (r + 0.5) * (funnelHeight / totalRows);
        const t = (y - funnelTopY) / funnelHeight;
        const widthAtY = FUNNEL_WIDTH + t * (bottomWidth - FUNNEL_WIDTH);
        const xLeft = W / 2 - widthAtY / 2;
        x = xLeft + (c + 0.5) * (widthAtY / cols);
      }
      ctx.beginPath();
      ctx.arc(x, y, BEAD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      beadsDrawn++;
      if (beadsDrawn >= ballsLeft) break;
    }
    if (beadsDrawn >= ballsLeft) break;
  }

  // ---- Board outline ----
  ctx.strokeStyle = COLOR_BORDER;
  ctx.lineWidth   = 8;
  ctx.strokeRect(MARGIN_X, MARGIN_TOP-2, W-2*MARGIN_X, H-(MARGIN_TOP-2));

  // ---- Pegs (hexagons) ----
  ctx.fillStyle = COLOR_PEG;
  nailPositions.forEach(row => row.forEach(p => {
    drawHexagon(ctx, p.x, p.y, HEX_RADIUS);
  }));

  // ---- Bins ----
  ctx.strokeStyle = COLOR_DIVIDER;
  ctx.lineWidth   = 3;
  for (let i=0; i<=numRows+1; i++) {
    const x = binLeft + i*binWidth;
    ctx.beginPath(); ctx.moveTo(x, binTopY); ctx.lineTo(x, H); ctx.stroke();
  }

  // ---- Settled beads in bins ----
  ctx.fillStyle = COLOR_BEAD;
  settledBeads.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x,b.y,BEAD_RADIUS,0,Math.PI*2); ctx.fill();
  });

  // ---- Active beads ----
  ctx.fillStyle = COLOR_BEAD;
  activeBeads.forEach(bead => {
    ctx.beginPath(); ctx.arc(bead.currentX,bead.currentY,BEAD_RADIUS,0,Math.PI*2); ctx.fill();
  });
}

// --------------------------------------------
// BEAD SPAWN & ANIMATION
// --------------------------------------------

function launchBead() {
  // Always drop from center of tunnel
  const startX = (tunnelLeftX + tunnelRightX) / 2;
  const startY = tunnelY + BEAD_RADIUS; // at the base of the funnel, just below the opening

  const path = [];
  // Animate bead falling vertically from the opening to the y-level of the first peg
  const topPegYActual = nailPositions[0][0].y;
  path.push({ x: startX, y: startY });

  // For the first peg, determine left or right bounce
  let idx = 0;
  let r = 0;
  let peg = nailPositions[r][idx];
  let leftOrRight = Math.random() < biases[r] ? 1 : -1;
  const angle = leftOrRight === 1 ? -Math.PI/6 : -5*Math.PI/6;
  const cornerX = peg.x + HEX_RADIUS * Math.cos(angle);
  const cornerY = peg.y + HEX_RADIUS * Math.sin(angle);

  // Go straight from the funnel to the selected corner of the top peg
  path.push({ x: cornerX, y: cornerY });
  idx = leftOrRight === 1 ? Math.min(idx+1, r+1) : Math.max(idx, 0);

  // Now handle subsequent rows (starting from row 1)
  for (r = 1; r < numRows; r++) {
    peg = nailPositions[r][idx];
    leftOrRight = Math.random() < biases[r] ? 1 : -1;
    const ang = leftOrRight === 1 ? -Math.PI/6 : -5*Math.PI/6;
    const cornerX2 = peg.x + HEX_RADIUS * Math.cos(ang);
    const cornerY2 = peg.y + HEX_RADIUS * Math.sin(ang);
    path.push({ x: cornerX2, y: cornerY2 });
    idx = leftOrRight === 1 ? Math.min(idx+1, r+1) : Math.max(idx, 0);
  }
  const final = idx;
  path.push({ x: binCenters[final], y: binTopY + BEAD_RADIUS });
  activeBeads.push({ path, segment: 0, t: 0, final });
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

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
const speedSlider = document.getElementById('speedSlider');
const speedLabel = document.getElementById('speedLabel');


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
// Default speed multiplier mapped from slider: value 3 means 0.03 speed
let beadSpeed = 0.03; 
let dropRate = 120;    // default drop interval in milliseconds

let histChart;

let activeBeads        = [];
let settledBeads       = [];
let binCounts          = [];

let dropInterval       = null;
let animRequest        = null;
let isRunning          = false;

let funnelRows = [];


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
const FUNNEL_TUNNEL_WIDTH = 40;
const MAX_BASKET_BEADS  = 50;

// Hex peg constants
const HEX_RADIUS        = 12;

// For funnel drawing
let funnelTopY = 0, funnelLeftX = 0, funnelRightX = 0;
let tunnelY = 0, tunnelLeftX = 0, tunnelRightX = 0;

// --------------------------------------------
// INITIAL SETUP
// --------------------------------------------
window.addEventListener('load', () => {
  setupControls();
  initHistogram();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
});

function setupFunnelRows() {
  funnelRows = [];
  let remaining = ballsLeft;
  const cols = Math.floor(FUNNEL_WIDTH / (2 * BEAD_RADIUS));
  const totalRows = Math.ceil(remaining / cols);
  for (let r = 0; r < totalRows; r++) {
    let nInRow = (r < totalRows - 1) ? cols : remaining;
    funnelRows.push(new Array(nInRow).fill(true));
    remaining -= nInRow;
  }
}

function initHistogram() {
  const ctxH = document.getElementById('histCanvas').getContext('2d');
  histChart = new Chart(ctxH, {
    type: 'bar',
    data: {
      labels: [],          // will be set in resetStats()
      datasets: [{
        label: 'Beads per bin',
        data: [],
        backgroundColor: '#0275FF'
      }]
    },
    options: {
      animation: false,
      scales: {
        x: { beginAtZero: true },
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}


function updateSpeedFromSlider() {
  const val = parseInt(speedSlider.value, 10);
  speedLabel.textContent = val;

  beadSpeed = 0.01 + (val - 1) * (0.2 - 0.01) / (10 - 1);
  dropRate = 400 - (val - 1) * (400 - 40) / (10 - 1);
}

function setupControls() {
  rowCountLbl.textContent = numRows;
  ballCountLabel.textContent = totalBalls;
  speedLabel.textContent = speedSlider.value;

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

  speedSlider.addEventListener('input', () => {
    updateSpeedFromSlider();

    if (isRunning) {
      clearInterval(dropInterval);
      dropInterval = setInterval(() => {
        if (ballsLeft > 0) {
          launchBead();
          ballsLeft--;
        } else {
          clearInterval(dropInterval);
        }
      }, dropRate);
    }
  });

  updateSpeedFromSlider();


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

  // ——— NEW: randomize button ———
  const randomizeBtn = document.getElementById('randomizeBtn');
  randomizeBtn.addEventListener('click', () => {
    // 1) generate new random biases
    biases = biases.map(() => Math.random());

    // 2) update each slider & its label
    const sliders = biasControls.querySelectorAll('input[type="range"]');
    const labels  = biasControls.querySelectorAll('label');
    
    sliders.forEach((slider, i) => {
      slider.value = biases[i].toFixed(2);
      labels[i].textContent = `Row ${i+1} bias: ${biases[i].toFixed(2)}`;
    });
  });
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

function resetStats() {
  // 1) reset counts
  binCounts = Array(numRows + 1).fill(0);
  // 2) rebuild chart labels & data
  histChart.data.labels = binCounts.map((_, i) => `Bin ${i}`);
  histChart.data.datasets[0].data = [...binCounts];
  histChart.update();
  // 3) rebuild HTML table
  updateTable();
}

function updateTable() {
  const tbody = document.querySelector('#binTable tbody');
  tbody.innerHTML = '';
  binCounts.forEach((count, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i}</td><td>${count}</td>`;
    tbody.appendChild(tr);
  });
}


function resetSimulation() {
  // 1) Reset counters
  ballsLeft    = totalBalls;
  binCounts    = Array(numRows + 1).fill(0);

  // 2) Clear all bead arrays
  activeBeads   = [];   // ← remove any beads still falling
  settledBeads  = [];

  // 3) Stop any in-flight timers/animations
  if (dropInterval)   clearInterval(dropInterval);
  if (animRequest)    cancelAnimationFrame(animRequest);

  isRunning      = false;
  startBtn.disabled = false;
  stopBtn.disabled  = true;

  // 4) Recompute layout & funnel
  computeLayout();
  setupFunnelRows();

  // 5) Reset your histogram/table
  resetStats();

  // 6) Redraw an empty board
  drawBoard();
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
  }, dropRate);

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
  if (numRows == 1) pegOffset = 400;
  else if (numRows == 2) pegOffset = 300;
  else if (numRows == 3) pegOffset = 250;
  else if (numRows == 4) pegOffset = 220;
  else if (numRows == 5) pegOffset = 200;
  else if (numRows == 6) pegOffset = 180;
  else if (numRows == 7) pegOffset = 170;
  else if (numRows == 8) pegOffset = 160;
  else if (numRows == 9) pegOffset = 150;
  else if (numRows == 10) pegOffset = 140;
  else if (numRows == 11) pegOffset = 130;
  else if (numRows == 12) pegOffset = 120;
  else if (numRows == 13) pegOffset = 110;
  else if (numRows == 14) pegOffset = 110;
  else if (numRows == 15) pegOffset = 110;
  else pegOffset = 10;

  const left = MARGIN_X + pegOffset;
  const right = W - MARGIN_X - pegOffset;
  const binRegionW = right - left;
  const binCount = numRows + 1;
  binWidth = binRegionW / binCount;
  binLeft = left;
  binCenters = [];
  for (let i = 0; i < binCount; i++)
    binCenters.push(binLeft + (i ) * binWidth);

  // Bins always at the same place
  
   // leave room for balls to pile up

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
    binTopY = y;
  }

  

  // ---- FUNNEL ----
  // Tunnel opening (horizontal base) always at fixed place
  tunnelY = funnelBaseY;
  tunnelLeftX = W / 2 - FUNNEL_TUNNEL_WIDTH / 2;
  tunnelRightX = W / 2 + FUNNEL_TUNNEL_WIDTH / 2;
  funnelTopY = MARGIN_TOP + 42;
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
const nRows = funnelRows.length;
for (let r = 0; r < nRows; r++) {
    const nInRow = funnelRows[r].length;
    const y = funnelTopY + (r + 0.5) * (funnelHeight / nRows);
    const t = (y - funnelTopY) / funnelHeight;
    const widthAtY = FUNNEL_WIDTH + t * (bottomWidth - FUNNEL_WIDTH);
    const xLeft = W / 2 - widthAtY / 2;
    for (let c = 0; c < nInRow; c++) {
        if (funnelRows[r][c]) {
            const x = xLeft + (nInRow === 1
                ? widthAtY/2
                : (c + 0.5) * (widthAtY / nInRow)
            );
            ctx.beginPath();
            ctx.arc(x, y, BEAD_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

  // Draw left wall: from leftmost bin line up to funnel's left base corner
ctx.strokeStyle = COLOR_DIVIDER;
ctx.lineWidth = 4;

// Left wall: from bottom to funnel
ctx.beginPath();
ctx.moveTo(binLeft, binTopY); // bottom left (start of leftmost bin line)
if (numRows != 1) {
  ctx.lineTo(tunnelLeftX, tunnelY); // up to funnel's left corner
}
else {
  ctx.lineTo(tunnelRightX, tunnelY);
}

ctx.stroke();

// Right wall: from bottom to funnel
ctx.beginPath();
ctx.moveTo(binLeft + (numRows + 1) * binWidth, binTopY); // bottom right (start of rightmost bin line)
if (numRows != 1) {
  ctx.lineTo(tunnelRightX, tunnelY);// up to funnel's left corner
}
else {
  ctx.lineTo(tunnelLeftX, tunnelY); 
}

ctx.stroke();



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
  // Remove bead from funnelRows
  outer: for (let r = 0; r < funnelRows.length; r++) {
    for (let c = funnelRows[r].length - 1; c >= 0; c--) {
      if (funnelRows[r][c]) {
        funnelRows[r][c] = false;
        break outer;
      }
    }
  }

  const startX = (tunnelLeftX + tunnelRightX) / 2;
  const startY = tunnelY + BEAD_RADIUS;
  const path = [{ x: startX, y: startY }];

  if (numRows === 1) {
    // single‐peg case
    const peg = nailPositions[0][0];
    path.push({ x: peg.x, y: peg.y - HEX_RADIUS });
    const goRight = Math.random() < biases[0];
    const edgeAngle = goRight ? -Math.PI/6 : -5*Math.PI/6;
    const edgeX = peg.x + HEX_RADIUS * Math.cos(edgeAngle);
    const edgeY = peg.y + HEX_RADIUS * Math.sin(edgeAngle);
    path.push({ x: edgeX, y: edgeY });

    // only vertical drop, no horizontal slide
    const dropY = binTopY + BEAD_RADIUS;
    path.push({ x: edgeX, y: dropY });

    // final bin index
    const finalBin = goRight ? 1 : 0;
    activeBeads.push({ path, segment: 0, t: 0, final: finalBin });
    return;
  }

  // multi‐row case
  let idx = 0;
  for (let r = 0; r < numRows; r++) {
    const peg = nailPositions[r][idx];
    // hit top of hex
    path.push({ x: peg.x, y: peg.y - HEX_RADIUS });
    // decide left/right
    const goRight = Math.random() < biases[r];
    const edgeAngle = goRight ? -Math.PI/6 : -5*Math.PI/6;
    const edgeX = peg.x + HEX_RADIUS * Math.cos(edgeAngle);
    const edgeY = peg.y + HEX_RADIUS * Math.sin(edgeAngle);
    path.push({ x: edgeX, y: edgeY });
    // update index
    idx = goRight ? Math.min(idx + 1, r + 1) : idx;
  }

  // vertical drop only
  const last = path[path.length - 1];
  const dropY = binTopY + BEAD_RADIUS;
  path.push({ x: last.x, y: dropY });

  // final bin index
  activeBeads.push({ path, segment: 0, t: 0, final: idx });
}




function animate() {
  for (let i = activeBeads.length - 1; i >= 0; i--) {
    const b = activeBeads[i];
    const { path, segment, t } = b;

    // If bead has reached the end of its path, settle it into a bin
    if (segment >= path.length - 1) {
      let bin = b.final;
      // 1) increment the count for that bin
      binCounts[bin]++;
      // 2) live‐update histogram & table
      histChart.data.datasets[0].data[bin] = binCounts[bin];
      histChart.update();
      updateTable();

      // 3) compute the “index” of this bead in its bin (0-based)
      let cols;
      const countIndex = binCounts[bin] - 1;
      const minCols = 5;
      if (numRows==1){
        cols = Math.max(
          minCols,
          Math.floor(Math.abs(binWidth) / (2 * BEAD_RADIUS))
        );
      }
      else {
        cols = Math.max(
          minCols,
          Math.floor(binWidth / (2 * BEAD_RADIUS))
        );
      }
      
      console.log('Num cols: ', cols);
      console.log('bin width: ', binWidth);
      const row = Math.floor(countIndex / cols);
      const posInRow = countIndex % cols;

      // center-out ordering
      const center = Math.floor(cols / 2);
      let col;
      if (posInRow === 0) {
        col = center;
      } else if (posInRow % 2 === 1) {
        col = center + Math.ceil(posInRow / 2);
      } else {
        col = center - Math.ceil(posInRow / 2);
      }

      // position within the bin
      const gridWidth = cols * 2 * BEAD_RADIUS;

      if(numRows == 1){
        bin = Math.abs(bin-1);
      }

      const binCenterX = binLeft + bin * binWidth + binWidth / 2;
      
      console.log('binCenterX: ', binCenterX);
      console.log('bin: ', bin);
      console.log('binLeft: ', binLeft);
      const gridLeft = binCenterX - gridWidth / 2;
      const x = gridLeft + col * 2 * BEAD_RADIUS - BEAD_RADIUS;
      const y = H - row * 2 * BEAD_RADIUS - BEAD_RADIUS;

      settledBeads.push({ x, y });
      activeBeads.splice(i, 1);
      continue;
    }

    // Otherwise, advance this bead along its current segment
    b.t += beadSpeed;
    if (b.t >= 1) {
      b.segment++;
      b.t = 0;
      b.currentX = path[b.segment].x;
      b.currentY = path[b.segment].y;
    } else {
      const p0 = path[b.segment];
      const p1 = path[b.segment + 1];
      b.currentX = p0.x + (p1.x - p0.x) * b.t;
      b.currentY = p0.y + (p1.y - p0.y) * b.t;
    }
  }

  // redraw everything
  drawBoard();

  // schedule next frame if we're still running or beads are still moving
  if (isRunning || activeBeads.length > 0) {
    animRequest = requestAnimationFrame(animate);
  }
}

// Matter.js module aliases
const { Engine, Render, Runner, World, Bodies, Composite, Vector, Events, Body } = Matter;

let engine, world, render, runner;
let currentRows, currentBeads;

// —— configuration constants ——
const width           = 1200;
const borderWidth     = 100;
const hexYOffset      = 450;
const hexXOffset      = 350;
const hexYSpacing     = 38;
const hexXSpacing     = 44;
const hexSize         = 20;
const boundaryHexSize = 30;
const hexChamfer      = 3;
const ballSize        = 3.5;
const ballFriction    = 0.0001;
const ballRestitution = 0.25;
const tubeWidth       = 35;
const tubeHeight      = 315;
const funnelHeight    = 1000;
const tubeOffset      = 22;
const beadXOffset     = 187;
const beadYOffset     = 175;

// —— render styles ——
const style = {
  boundary:    { fillStyle: '#F0F0F0', strokeStyle: 'transparent' },
  transparent: { fillStyle: '#222',    strokeStyle: 'transparent' },
  ball:        { fillStyle: '#3050c2', strokeStyle: '#222' }
};

// global biases array (0.0 → always left, 1.0 → always right)
const biases = [];

// build one slider per peg-row
function buildBiasControls(rawRows) {
  const $biasContainer = $('#bias-controls').empty();
  const actualRows = rawRows - 2;
  for (let i = 1; i <= actualRows; i++) {
    const pegRow = i + 1;
    if (biases[pegRow] === undefined) biases[pegRow] = 0.5;
    const id = `bias-${pegRow}`;
    const $wrapper = $(`<div class="bias-row"></div>`);
    $wrapper.append(
      `<label for="${id}">Row ${i} bias: <span id="${id}-val">${biases[pegRow].toFixed(2)}</span></label>`
    );
    const $slider = $(`<input type="range" id="${id}" min="0" max="1" step="0.01" value="${biases[pegRow]}">`);
    $slider.on('input', () => {
      biases[pegRow] = parseFloat($slider.val());
      $(`#${id}-val`).text(biases[pegRow].toFixed(2));
    });
    $wrapper.append($slider);
    $biasContainer.append($wrapper);
  }
}

// Set up the static board and particles but don't start simulation
function setup(pegRows, numBeads) {
  currentRows = pegRows;
  currentBeads = numBeads;

  if (render) {
    Render.stop(render);
    render.canvas.remove();
    render.textures = {};
  }
  if (runner) {
    Runner.stop(runner);
    runner = null;
  }

  engine = Engine.create();
  world  = engine.world;
  runner = Runner.create();

  buildScene(pegRows, numBeads);

  const rows = pegRows;
  const canvasHeight = hexYOffset + rows * hexYSpacing + funnelHeight + (tubeHeight / 2) + borderWidth;
  render = Render.create({
    element: document.getElementById('player'),
    engine: engine,
    options: { width, height: canvasHeight, background: 'transparent', wireframes: false }
  });
  Render.run(render);
}

// Start the physics simulation
function startSim() {
  Events.on(engine, 'collisionStart', handleCollision);
  Runner.run(runner, engine);
  $('#start-btn').prop('disabled', true);
}

// Common scene builder (balls, pegs, walls, floor)
function buildScene(pegRows, numBeads) {
  const balls = Composite.create();
  const fullRows = Math.floor((Math.sqrt(8 * numBeads + 1) - 1) / 2);
  const usedInFull = fullRows * (fullRows + 1) / 2;
  const leftover   = numBeads - usedInFull;
  const gap = ballSize * 2 + 1;

  function addRow(r, count) {
    const y = r * gap;
    const totalWidth = (count - 1) * gap;
    for (let i = 0; i < count; i++) {
      const x = i * gap - totalWidth / 2;
      Composite.add(balls, Bodies.circle(x, y, ballSize, {
        label:       'ball',
        render:      style.ball,
        friction:    ballFriction,
        restitution: 0,
        frictionAir: 0.05,
        frictionStatic: 0.1
      }));
    }
  }
  for (let row = 0; row < fullRows; row++) addRow(row, row + 1);
  if (leftover > 0) addRow(fullRows, leftover);
  Composite.rotate(balls, Math.PI, Vector.create(beadXOffset, beadYOffset));

  const hexes = [];
  for (let row = 2; row <= pegRows; row++) {
    for (let col = 1; col <= row; col++) {
      const y = hexYOffset + row * hexYSpacing;
      const baseX = hexXOffset + col * hexXSpacing - (row * hexXSpacing / 2);
      let x = baseX, size, renderOpt, yOffset = 0;
      if (col === 1 || col === row) {
        const dir = col === 1 ? -1 : 1;
        x += dir * (boundaryHexSize / 4);
        yOffset = -4;
        size = boundaryHexSize;
        renderOpt = style.transparent;
      } else {
        size = hexSize;
        renderOpt = style.boundary;
      }
      const peg = Bodies.polygon(x, y + yOffset, 6, size, {
        isStatic: true,
        render: renderOpt,
        chamfer: { radius: hexChamfer },
        label: 'peg'
      });
      peg.row = row;
      hexes.push(peg);
    }
  }

  const bins = pegRows;
  const tubeStartX = hexXOffset - (bins * hexXSpacing) / 2 + (hexXSpacing / 2) + tubeOffset;
  const tubes = [];
  const baseY = hexYOffset + bins * hexYSpacing + (tubeHeight / 2);
  for (let i = 0; i < bins; i++) {
    const x = tubeStartX + i * hexXSpacing;
    tubes.push(Bodies.rectangle(x, baseY, tubeWidth, tubeHeight, { isStatic: true, render: style.transparent }));
  }
  tubes.push(
    Bodies.rectangle(150, 60, 30, funnelHeight, { isStatic: true, angle: -0.13 * Math.PI, render: style.transparent }),
    Bodies.rectangle(600, 60, 30, funnelHeight, { isStatic: true, angle:  0.13 * Math.PI, render: style.transparent })
  );

  const wallOpts = { isStatic: true, render: style.transparent };
  const leftWall  = Bodies.rectangle(-borderWidth / 2, (baseY + tubeHeight / 2) / 2, borderWidth, baseY + tubeHeight / 2, wallOpts);
  const rightWall = Bodies.rectangle(width + borderWidth / 2, (baseY + tubeHeight / 2) / 2, borderWidth, baseY + tubeHeight / 2, wallOpts);

  // floor
  const floorY = baseY + tubeHeight / 2 + borderWidth / 2;
  const floor  = Bodies.rectangle(width/3.3 , floorY, width/1.5, borderWidth*1.5, { isStatic: true, render: style.transparent });

  World.add(world, [ balls, ...hexes, ...tubes, leftWall, rightWall, floor ]);
}

// collision handler separate for clean start
function handleCollision(event) {
  event.pairs.forEach(pair => {
    let ball, peg;
    if (pair.bodyA.label === 'ball' && pair.bodyB.label === 'peg') {
      ball = pair.bodyA;
      peg  = pair.bodyB;
    } else if (pair.bodyB.label === 'ball' && pair.bodyA.label === 'peg') {
      ball = pair.bodyB;
      peg  = pair.bodyA;
    } else {
      return;
    }
    const bias = biases[peg.row] ?? 0.5;
    const dir  = Math.random() < bias ? 1 : -1;
    const speed = 0.4;
    Body.setVelocity(ball, { x: dir * speed, y: ball.velocity.y });
  });
}

// document ready
$(document).ready(() => {
  const $rowSlider   = $('#row-slider');
  const $beadSlider  = $('#bead-slider');
  const $rowDisplay  = $('#row-count');
  const $beadDisplay = $('#bead-count');

  function updateRowDisplay() {
    $rowDisplay.text(Math.max(0, parseInt($rowSlider.val(), 10) - 2));
  }
  function updateBeadDisplay() {
    $beadDisplay.text(parseInt($beadSlider.val(), 10));
  }

  // initial display and controls
  updateRowDisplay();
  updateBeadDisplay();
  buildBiasControls(parseInt($rowSlider.val(), 10));

  // live update sliders and preview
  $rowSlider.on('input', () => {
    updateRowDisplay();
    buildBiasControls(parseInt($rowSlider.val(), 10));
    setup(parseInt($rowSlider.val(), 10), parseInt($beadSlider.val(), 10));
  });

  $beadSlider.on('input', () => {
    updateBeadDisplay();
    setup(parseInt($rowSlider.val(), 10), parseInt($beadSlider.val(), 10));
  });

  // start simulation
  $('#start-btn').on('click', () => {
    setup(parseInt($rowSlider.val(), 10), parseInt($beadSlider.val(), 10));
    startSim();
  });

  // reset beads only
  $('#reset-btn').on('click', () => {
    setup(currentRows, currentBeads);
    $('#start-btn').prop('disabled', false);
  });

  // initial paused setup
  setup(parseInt($rowSlider.val(), 10), parseInt($beadSlider.val(), 10));
});

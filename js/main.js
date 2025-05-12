// Matter.js module aliases
const { Engine, Render, Runner, World, Bodies, Composite, Vector, Events, Body } = Matter;

let engine, world, render, runner;

// —— configuration constants ——
const width           = 1200;
const borderWidth     = 100;
const hexYOffset      = 450;
const hexXOffset      = 350;
const hexYSpacing     = 38;
const hexXSpacing     = 44;
const hexSize         = 20;
const boundaryHexSize = 33;
const hexChamfer      = 3;
const ballSize        = 3.25;
const ballFriction    = 0;
const ballRestitution = 0.25;
const tubeWidth       = 32;
const tubeHeight      = 315;
const funnelHeight    = 1000;
const tubeOffset      = 22;
const beadXOffset     = 187;
const beadYOffset     = 175;

// —— render styles ——
const style = {
  boundary:    { fillStyle: '#F0F0F0', strokeStyle: 'transparent' },
  transparent: { fillStyle: '#222',    strokeStyle: 'transparent' },
  ball:        { fillStyle: '#3050c2', strokeStyle: '#222' },
  temp:         {fillStyle: '#111', strokeStyle: 'transparent'}
};

// global biases array (0.0 → always left, 1.0 → always right)
const biases = [];

// build one slider per peg-row
function buildBiasControls(maxRows) {
  const $biasContainer = $('#bias-controls').empty();
  for (let row = 2; row <= maxRows; row++) {
    if (biases[row] === undefined) biases[row] = 0.5;
    const displayRow = row - 1;
    const id = `bias-${row}`;
    const $wrapper = $(`<div class="bias-row"></div>`);
    $wrapper.append(
      `<label for="${id}">Row ${displayRow} bias: <span id="${id}-val">${biases[row].toFixed(2)}</span></label>`
    );
    const $slider = $(`<input type="range" id="${id}" min="0" max="1" step="0.01" value="${biases[row]}">`);
    $slider.on('input', () => {
      biases[row] = parseFloat($slider.val());
      $(`#${id}-val`).text(biases[row].toFixed(2));
    });
    $wrapper.append($slider);
    $biasContainer.append($wrapper);
  }
}

function init(pegRows, numBeads) {
  // tear down existing simulation
  if (runner) Runner.stop(runner);
  if (render) {
    Render.stop(render);
    render.canvas.remove();
    render.textures = {};
  }

  // dynamic sizes
  const rows = pegRows;
  const canvasHeight = hexYOffset + rows * hexYSpacing + funnelHeight + (tubeHeight / 2) + borderWidth;

  // engine + world
  engine = Engine.create();
  world  = engine.world;

  // biased collision handler
  Events.on(engine, 'collisionStart', event => {
    event.pairs.forEach(pair => {
      let ball, peg;
      if (pair.bodyA.label === 'ball' && pair.bodyB.label === 'peg') {
        ball = pair.bodyA; peg = pair.bodyB;
      } else if (pair.bodyB.label === 'ball' && pair.bodyA.label === 'peg') {
        ball = pair.bodyB; peg = pair.bodyA;
      } else {
        return;
      }
      const bias = biases[peg.row] ?? 0.5;
      const dir = Math.random() < bias ? 1 : -1;
      const forceMagnitude = 0.0015;
      Body.applyForce(ball, ball.position, { x: forceMagnitude * dir, y: 0 });

      const speed = 0.9;
      Body.setVelocity(ball, { x: dir * speed, y: ball.velocity.y });
    });
  });

  // renderer
  render = Render.create({
    element: document.getElementById('player'),
    engine: engine,
    options: {
      width:      width,
      height:     canvasHeight,
      background: 'transparent',
      wireframes: false
    }
  });

  // build beads
  const balls = Composite.create();
  const fullRows = Math.floor((Math.sqrt(8*numBeads + 1) - 1) / 2);
  const usedInFull = fullRows * (fullRows + 1) / 2;
  const leftover   = numBeads - usedInFull;
  const gap = ballSize * 2 + 1;

  function addRow(r, count) {
    const y = r * gap;
    const totalWidth = (count - 1) * gap;
    for (let i = 0; i < count; i++) {
      const x = i * gap - totalWidth / 2;
      Composite.add(balls,
        Bodies.circle(x, y, ballSize, {
          label:       'ball',
          render:      style.ball,
          friction:    ballFriction,
          restitution: ballRestitution,
          frictionAir: 0.02   // ◀ small drag
        })
      );
    }
  }

  for (let row = 0; row < fullRows; row++) {
    addRow(row, row + 1);
  }
  if (leftover > 0) {
    addRow(fullRows, leftover);
  }
  Composite.rotate(
    balls,
    Math.PI,
    Vector.create(beadXOffset, beadYOffset)
  );

  // hex peg grid
  const hexes = [];
  for (let row = 2; row <= rows; row++) {
    for (let col = 1; col <= row; col++) {
      const y     = hexYOffset + row * hexYSpacing;
      const baseX = hexXOffset + col * hexXSpacing - (row * hexXSpacing / 2);
      let   x     = baseX;
      let   size, renderOpt, yOffset = 0;

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

      const peg = Bodies.polygon(
        x, y + yOffset,
        6, size,
        { isStatic: true, render: renderOpt, chamfer: { radius: hexChamfer }, label: 'peg' }
      );
      peg.row = row;
      hexes.push(peg);
    }
  }

  // tubes + funnel + walls
  const bins = pegRows;
  const tubeStartX = hexXOffset - (pegRows * hexXSpacing) / 2 + (hexXSpacing / 2) + tubeOffset;
  const tubes = [];
  const baseY = hexYOffset + pegRows * hexYSpacing + (tubeHeight / 2);
  for (let i = 0; i < bins; i++) {
    const x = tubeStartX + i * hexXSpacing;
    tubes.push(
      Bodies.rectangle(x, baseY, tubeWidth, tubeHeight, { isStatic: true, render: style.transparent })
    );
  }
  tubes.push(
    Bodies.rectangle(150, 60,  30, funnelHeight, { isStatic: true, angle: -0.13 * Math.PI, render: style.transparent }),
    Bodies.rectangle(600, 60,  30, funnelHeight, { isStatic: true, angle:  0.13 * Math.PI, render: style.transparent })
  );

  const walls = [
    Bodies.rectangle(380,   0,          500, borderWidth, { isStatic: true, render: style.transparent }),
    Bodies.rectangle(373,   baseY + tubeHeight / 2, tubeWidth * 1.4 * bins, borderWidth, { isStatic: true, render: style.transparent })
  ];

  tubes.push(
      Bodies.rectangle(373, baseY+150,  90, 450, { isStatic: true, angle: 0.5* Math.PI, render: style.temp })
  )

  World.add(world, [ balls, ...hexes, ...tubes, ...walls ]);

  runner = Runner.create();
  Runner.run(runner, engine);
  Render.run(render);
}

// on document ready
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

  // initial labels & bias controls
  updateRowDisplay();
  updateBeadDisplay();
  buildBiasControls(parseInt($rowSlider.val(), 10));

  // live‐update labels & bias sliders on input
  $rowSlider.on('input', () => {
    updateRowDisplay();
    buildBiasControls(parseInt($rowSlider.val(), 10));
  });
  $beadSlider.on('input', updateBeadDisplay);

  // rebuild simulation on change
  $rowSlider.on('change', () => init(parseInt($rowSlider.val(), 10), parseInt($beadSlider.val(), 10)));
  $beadSlider.on('change', () => init(parseInt($rowSlider.val(), 10), parseInt($beadSlider.val(), 10)));

  // Reset button
  $('#reset-btn').on('click', () => window.location.reload());

  // kick things off
  init(parseInt($rowSlider.val(), 10), parseInt($beadSlider.val(), 10));
});

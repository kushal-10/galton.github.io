// js/main.js
// Matter.js module aliases
const { Engine, Render, Runner, World, Bodies, Composite, Composites, Vector } = Matter;

let engine, world, render, runner;

// —— configuration constants ——
const width            = 1200;
const borderWidth      = 20;
const hexYOffset       = 50;
const hexXOffset       = 350;
const hexYSpacing      = 38;
const hexXSpacing      = 44;
const hexSize          = 20;
const boundaryHexSize  = 27;
const hexChamfer       = 3;
const ballRows         = 16;
const ballCols         = 24;
const ballSize         = 3.25;
const ballFriction     = 0;
const ballRestitution  = 0.25;
const tubeWidth        = 32;
const tubeHeight       = 150;
const funnelHeight     = 150;
const tubeOffset       = 22;


// —— render styles ——
const style = {
  boundary:    { fillStyle: '#F0F0F0', strokeStyle: 'transparent' },
  transparent: { fillStyle: '#222',    strokeStyle: 'transparent' },
  ball:        { fillStyle: '#85c226', strokeStyle: '#222' }
};

function init(pegRows) {
  // 1) tear down any existing simulation
  if (runner)       Runner.stop(runner);
  if (render) {
    Render.stop(render);
    render.canvas.remove();
    render.textures = {};
  }

  // 2) recalc dynamic sizes
  const rows         = pegRows;
  // const bins         = rows + 1;
  const canvasHeight = hexYOffset + rows * hexYSpacing + funnelHeight + (tubeHeight / 2) + borderWidth;

  // 3) create engine + world
  engine = Engine.create();
  world  = engine.world;

  // 4) set up renderer
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

  // 5) build the ball pyramid
  const balls = Composites.pyramid(
    0, 0,
    ballCols, ballRows,
    0, 0,
    (x, y) => Bodies.circle(x, y, ballSize, {
      render:      style.ball,
      friction:    ballFriction,
      restitution: ballRestitution
    })
  );
  Composite.rotate(balls, Math.PI, Vector.create(225, hexYOffset));

  // 6) build the hex‐peg grid
  const hexes = [];
  for (let row = 2; row <= rows; row++) {
    for (let col = 1; col <= row; col++) {
      const y     = hexYOffset + row * hexYSpacing;
      const baseX = hexXOffset + col * hexXSpacing - (row * hexXSpacing / 2);
      let   x     = baseX;
      let   size, renderOpt, yOffset = 0;

      if (col === 1 || col === row) {
        // edge pegs transparent
        const dir = col === 1 ? -1 : 1;
        x += dir * (boundaryHexSize / 4);
        yOffset = -4;
        size = boundaryHexSize;
        renderOpt = style.transparent;
      } else {
        size = hexSize;
        renderOpt = style.boundary;
      }

      hexes.push(
        Bodies.polygon(
          x, y + yOffset,
          6, size,
          { isStatic: true, render: renderOpt, chamfer: { radius: hexChamfer } }
        )
      );
    }
  }


  // how many bins?
const bins = pegRows;
// figure out where the *first* bin should sit:
// start from the center‐offset you already have (hexXOffset),
// then back up half the span of your peg‐row
const tubeStartX = hexXOffset - (pegRows * hexXSpacing) / 2 + (hexXSpacing / 2) + tubeOffset;

const tubes = [];
const baseY = hexYOffset + pegRows * hexYSpacing + (tubeHeight / 2);

for (let i = 0; i < bins; i++) {
  const x = tubeStartX + i * hexXSpacing;
  tubes.push(
    Bodies.rectangle(
      x,
      baseY,
      tubeWidth, tubeHeight,
      { isStatic: true, render: style.transparent }
    )
  );
}


  // funnel sides
  tubes.push(
    Bodies.rectangle(310, 60,  30, funnelHeight, { isStatic: true, angle: -0.2 * Math.PI, render: style.transparent }),
    Bodies.rectangle(434, 60,  30, funnelHeight, { isStatic: true, angle:  0.2 * Math.PI, render: style.transparent })
  );

  // 8) outer walls
  const walls = [
    Bodies.rectangle(380,   0,          500, borderWidth, { isStatic: true, render: style.transparent }),
    Bodies.rectangle(373,   baseY+tubeHeight/2,tubeWidth*1.4*bins, borderWidth, { isStatic: true, render: style.transparent }),
    // Bodies.rectangle(  -50,       canvasHeight/2, borderWidth, canvasHeight, { isStatic: true, render: style.transparent }),
    // Bodies.rectangle(width,     canvasHeight/2, borderWidth, canvasHeight, { isStatic: true, render: style.transparent })
  ];

  // 9) add all bodies
  World.add(world, [ balls, ...hexes, ...tubes, ...walls ]);

  // 10) start physics + render loops
  runner = Runner.create();
  Runner.run(runner, engine);
  Render.run(render);
}

$(document).ready(() => {
  const $slider  = $('#row-slider');
  const $display = $('#row-count');

  // helper to compute what actually shows in the sim
  function displayRows(raw) {
    // clamp at 0 so you don’t get negative numbers
    return Math.max(0, raw - 2);
  }

  // initial label
  $display.text(displayRows(parseInt($slider.val(), 10)));

  // live‐update label (raw−2)
  $slider.on('input', () => {
    const raw = parseInt($slider.val(), 10);
    $display.text(displayRows(raw));
  });

  // rebuild on slider change using the raw value
  $slider.on('change', () => {
    init(parseInt($slider.val(), 10));
  });

  // kick everything off
  init(parseInt($slider.val(), 10));

  // Reset button
  $('#reset-btn').on('click', () => window.location.reload());
});

// js/main.js
// Matter.js module aliases
const { Engine, Render, Runner, World, Bodies, Composite, Composites, Vector } = Matter;

let engine, world, render, runner;

// —— configuration constants ——
const width            = 1200;
const borderWidth      = 60;
const hexYOffset       = 450;
const hexXOffset       = 350;
const hexYSpacing      = 38;
const hexXSpacing      = 44;
const hexSize          = 20;
const boundaryHexSize  = 27;
const hexChamfer       = 3;
const ballSize         = 3.25;
const ballFriction     = 0;
const ballRestitution  = 0.25;
const tubeWidth        = 32;
const tubeHeight       = 315;
const funnelHeight     = 1000;
const tubeOffset       = 22;
const beadXOffset      = 187;
const beadYOffset      = 175;


// —— render styles ——
const style = {
  boundary:    { fillStyle: '#F0F0F0', strokeStyle: 'transparent' },
  transparent: { fillStyle: '#222',    strokeStyle: 'transparent' },
  ball:        { fillStyle: '#3050c2', strokeStyle: '#222' }
};

function init(pegRows, numBeads) {
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

  // 5) build balls from a single numBeads value
// const numBeads = 1000/* e.g. from your slider */;
const balls = Composite.create();

// figure out how many full rows: n(n+1)/2 ≤ numBeads < (n+1)(n+2)/2
const fullRows = Math.floor((Math.sqrt(8*numBeads + 1) - 1) / 2);
const usedInFull = fullRows * (fullRows + 1) / 2;
const leftover   = numBeads - usedInFull;

// spacing between centres
const gap = ballSize * 2 + 1;

// helper to add one row of count beads at row index `r`
function addRow(r, count) {
  const y = r * gap;
  const totalWidth = (count - 1) * gap;
  for (let i = 0; i < count; i++) {
    const x = i * gap - totalWidth / 2;
    Composite.add(balls,
      Bodies.circle(x, y, ballSize, {
        render:      style.ball,
        friction:    ballFriction,
        restitution: ballRestitution
      })
    );
  }
}

// full rows 0 → fullRows–1, each with row+1 beads
for (let row = 0; row < fullRows; row++) {
  addRow(row, row + 1);
}

// one extra row if there are leftovers
if (leftover > 0) {
  addRow(fullRows, leftover);
}

// flip & position exactly like the old pyramid
Composite.rotate(
  balls,
  Math.PI,
  Vector.create(beadXOffset, beadYOffset)
);


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
    Bodies.rectangle(150, 60,  30, funnelHeight, { isStatic: true, angle: -0.13 * Math.PI, render: style.transparent }),
    Bodies.rectangle(600, 60,  30, funnelHeight, { isStatic: true, angle:  0.13 * Math.PI, render: style.transparent })
  );

// Funnel behind hex walls
  tubes.push(
    Bodies.rectangle(500, 700,  10, 450, { isStatic: true, angle: -0.17 * Math.PI, render: style.transparent }),
    Bodies.rectangle(230, 700,  10, 450, { isStatic: true, angle:  0.17 * Math.PI, render: style.transparent })
  );

  // 8) outer walls
  const walls = [
    Bodies.rectangle(380,   0,          500, borderWidth, { isStatic: true, render: style.transparent }),
    Bodies.rectangle(373,   baseY+tubeHeight/2, tubeWidth*1.4*bins, borderWidth, { isStatic: true, render: style.transparent }),
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
  const $sliderr = $('#bead-slider');
  const $displayy = $('#bead-count')

  // helper to compute what actually shows in the sim
  function displayRows(raw) {
    // clamp at 0 so you don’t get negative numbers
    return Math.max(0, raw - 2);
  }

  // initial label
  $display.text(displayRows(parseInt($slider.val(), 10)));
  $displayy.text(parseInt($sliderr.val(), 10));

  // live‐update label (raw−2)
  $slider.on('input', () => {
    const raw = parseInt($slider.val(), 10);
    $display.text(displayRows(raw));
  });

  // live‐update label (raw−2)
  $sliderr.on('input', () => {
    const beads = parseInt($sliderr.val(), 10);
    $displayy.text(beads);
  });

  // rebuild on slider change using the raw value
  $slider.on('change', () => {
   const rows  = parseInt($slider.val(),  10);
    const beads = parseInt($sliderr.val(), 10);
     init(rows, beads);
   });

  // rebuild on slider change using the raw value
  $sliderr.on('change', () => {
   const rows  = parseInt($slider.val(),  10);
    const beads = parseInt($sliderr.val(), 10);
     init(rows, beads);
   });

  // kick everything off
  init(parseInt($slider.val(), 10), parseInt($sliderr.val(), 10));


  // Reset button
  $('#reset-btn').on('click', () => window.location.reload());
});
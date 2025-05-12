// js/main.js
// Matter.js module aliases
const {
  Engine,
  Render,
  Runner,
  World,
  Bodies,
  Composite,
  Events,
  Vector,
  Body
} = Matter;

let engine, world, render, runner;
let beadsComposite;

// —— configuration constants ——
const width            = 1200;
const borderWidth      = 20;
const hexYOffset       = 450;
const hexXOffset       = 350;
const hexYSpacing      = 38;
const hexXSpacing      = 44;
const hexSize          = 20;
const boundaryHexSize  = 27;
const hexChamfer       = 3;
const ballSize         = 3.25;
const ballFriction     = 0;
const ballRestitution  = 0;
const tubeWidth        = 32;
const tubeHeight       = 315;
const funnelHeight     = 1000;
const tubeOffset       = 22;
const beadXOffset      = 187;
const beadYOffset      = 175;

// —— render styles ——
const style = {
  boundary:    { fillStyle: '#505050', strokeStyle: 'transparent' },
  transparent: { fillStyle: '#222',    strokeStyle: 'transparent' },
  ball:        { fillStyle: '#8866ff', strokeStyle: '#222' }
};

/** Compute canvas height based on peg rows */
function computeCanvasHeight(rows) {
  return hexYOffset
       + rows * hexYSpacing
       + funnelHeight
       + (tubeHeight / 2)
       + borderWidth;
}

/**
 * Build or rebuild the *static* parts of the board:
 *   • creates a fresh Engine + World
 *   • attaches your collision handler for bias
 *   • renders the canvas
 *   • adds pegs, tubes, walls
 */
function setupBoard(pegRows, bias) {
  // tear down previous sim
  if (runner) Runner.stop(runner);
  if (render) {
    Render.stop(render);
    render.canvas.remove();
    render.textures = {};
  }

  // create engine + world
  engine = Engine.create();
  world  = engine.world;

  // collision handler: one biased flip per peg
  Events.on(engine, 'collisionStart', event => {
    event.pairs.forEach(pair => {
      let ball, peg;
      if (pair.bodyA.label === 'bead' && pair.bodyB.label === 'peg') {
        ball = pair.bodyA;
      } else if (pair.bodyB.label === 'bead' && pair.bodyA.label === 'peg') {
        ball = pair.bodyB;
      } else return;

      // biased coin‐flip
      const dir = (Math.random() < bias) ? 1 : -1;
      // override horizontal velocity
      const vy = ball.velocity.y;
      const vx = dir * (Math.abs(vy) + 2);
      Body.setVelocity(ball, { x: vx, y: vy });
    });
  });

  // set up renderer
  render = Render.create({
    element: document.getElementById('player'),
    engine,
    options: {
      width:      width,
      height:     computeCanvasHeight(pegRows),
      background: 'transparent',
      wireframes: false
    }
  });
  Render.run(render);

  // build hex‐peg grid
  const hexes = [];
  for (let r = 2; r <= pegRows; r++) {
    for (let c = 1; c <= r; c++) {
      const y     = hexYOffset + r * hexYSpacing;
      const baseX = hexXOffset + c * hexXSpacing - (r * hexXSpacing / 2);
      let   x     = baseX;
      let   size, renderOpt, yOff = 0;

      if (c === 1 || c === r) {
        const dir = c === 1 ? -1 : 1;
        x += dir * (boundaryHexSize / 4);
        yOff = -4;
        size = boundaryHexSize;
        renderOpt = style.transparent;
      } else {
        size = hexSize;
        renderOpt = style.boundary;
      }

      const peg = Bodies.polygon(
        x, y + yOff,
        6, size,
        { isStatic: true, render: renderOpt, chamfer: { radius: hexChamfer } }
      );
      peg.label = 'peg';
      hexes.push(peg);
    }
  }

  // build tubes & funnel
  const tubes = [];
  const bins   = pegRows;
  const startX = hexXOffset - (bins * hexXSpacing) / 2 + (hexXSpacing / 2) + tubeOffset;
  const baseY  = hexYOffset + bins * hexYSpacing + tubeHeight / 2;

  for (let i = 0; i < bins; i++) {
    const x = startX + i * hexXSpacing;
    tubes.push(
      Bodies.rectangle(x, baseY, tubeWidth, tubeHeight, { isStatic: true, render: style.transparent })
    );
  }
  // funnel walls
  tubes.push(
    Bodies.rectangle(150, 60,  30, funnelHeight, { isStatic: true, angle: -0.13*Math.PI, render: style.transparent }),
    Bodies.rectangle(600, 60,  30, funnelHeight, { isStatic: true, angle:  0.13*Math.PI, render: style.transparent })
  );

  // outer walls
  const walls = [
    Bodies.rectangle(380,                   0, 500, borderWidth, { isStatic: true, render: style.transparent }),
    Bodies.rectangle(373, baseY + tubeHeight/2, tubeWidth * 1.4 * bins, borderWidth, { isStatic: true, render: style.transparent })
  ];

  World.add(world, [...hexes, ...tubes, ...walls]);

  // start runner
  runner = Runner.create();
  Runner.run(runner, engine);
}

/**
 * (Re)creates the beads composite and drops them in.
 * Removes the old beads but leaves all statics and sliders intact.
 */
function createBeads(numBeads) {
  // clear old beads
  if (beadsComposite) {
    World.remove(world, beadsComposite);
  }

  const balls    = Composite.create();
  const fullRows = Math.floor((Math.sqrt(8 * numBeads + 1) - 1) / 2);
  const used     = fullRows * (fullRows + 1) / 2;
  const leftover = numBeads - used;
  const gap      = ballSize * 2 + 1;

  function addRow(r, count) {
    const y = r * gap;
    const totalWidth = (count - 1) * gap;
    for (let i = 0; i < count; i++) {
      const x = i * gap - totalWidth / 2;
      const b = Bodies.circle(x, y, ballSize, {
        friction:    ballFriction,
        restitution: ballRestitution,
        render:      style.ball
      });
      b.label = 'bead';
      Composite.add(balls, b);
    }
  }

  for (let r = 0; r < fullRows; r++) addRow(r, r + 1);
  if (leftover > 0)          addRow(fullRows, leftover);

  Composite.rotate(
    balls,
    Math.PI,
    Vector.create(beadXOffset, beadYOffset)
  );

  beadsComposite = balls;
  World.add(world, balls);
}

$(document).ready(() => {
  const $rowS   = $('#row-slider'),
        $rowD   = $('#row-count'),
        $beadS  = $('#bead-slider'),
        $beadD  = $('#bead-count'),
        $probS  = $('#prob-slider'),
        $probD  = $('#prob-count'),
        $reset  = $('#reset-btn');

  // init labels
  $rowD.text(Math.max(0, parseInt($rowS.val(), 10) - 2));
  $beadD.text(parseInt($beadS.val(), 10));
  $probD.text($probS.val());

  // live-update text on input
  $rowS.on('input',  () => $rowD.text(Math.max(0, parseInt($rowS.val(), 10) - 2)));
  $beadS.on('input', () => $beadD.text(parseInt($beadS.val(), 10)));
  $probS.on('input', () => $probD.text($probS.val()));

  // full rebuild when rows or bias change
  function fullInit() {
    const rows  = parseInt($rowS.val(),  10);
    const beads = parseInt($beadS.val(), 10);
    const bias  = parseInt($probS.val(), 10) / 100;
    setupBoard(rows, bias);
    createBeads(beads);
  }

  // only re-drop beads (used for bead-slider + reset)
  function beadOnlyInit() {
    const beads = parseInt($beadS.val(), 10);
    createBeads(beads);
  }

  // slider change handlers
  $rowS.on('change',  fullInit);
  $probS.on('change', fullInit);
  $beadS.on('change', beadOnlyInit);

  // reset button: bounce + clear & re-drop beads only
  $reset.on('click', () => {
    $reset.addClass('bounce');
    $reset.one('animationend', () => $reset.removeClass('bounce'));
    beadOnlyInit();
  });

  // initial draw
  fullInit();
});

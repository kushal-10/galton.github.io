// Matter.js module aliases
const {
  Engine,
  Render,
  Runner,
  World,
  Bodies,
  Composite,
  Composites,
  Vector
} = Matter;

// —— configuration constants ——
const width            = 750;
const height           = 530;
const borderWidth      = 20;
const hexYOffset        = 50;
const hexXOffset        = 350;
const hexYSpacing       = 38;
const hexXSpacing       = 44;
const hexSize           = 20;
const boundaryHexSize   = 27;
const hexChamfer        = 3;
const ballRows          = 16;
const ballCols          = 24;
const ballSize          = 3.25;
const ballFriction      = 0;
const ballRestitution   = 0.25;

// —— render styles ——
const style = {
  boundary:    { fillStyle: '#F0F0F0', strokeStyle: 'transparent' },
  transparent: { fillStyle: '#222',    strokeStyle: 'transparent' },
  ball:        { fillStyle: '#85c226', strokeStyle: '#222' }
};

// 1) create engine + world
const engine = Engine.create();
const world  = engine.world;

// 2) set up the renderer
const render = Render.create({
  element: document.getElementById('player'),
  engine: engine,
  options: {
    width:      width,
    height:     height,
    background: 'transparent',
    wireframes: false
  }
});

// 3) build the ball pyramid
const balls = Composites.pyramid(
  0, 0,
  ballCols, ballRows,
  0, 0,
  (x, y) => Bodies.circle(x, y, ballSize, {
    render:       style.ball,
    friction:     ballFriction,
    restitution:  ballRestitution
  })
);
// flip the stack so it sits at the top
Composite.rotate(balls, Math.PI, Vector.create(225, hexYOffset));

// 4) build the hex-peg grid + boundaries
const hexes = [];
for (let row = 2; row < 11; row++) {
  for (let col = row; col > 0; col--) {
    const y    = hexYOffset + row * hexYSpacing;
    const baseX = hexXOffset + (col * hexXSpacing) - (row * hexXSpacing / 2);
    let   x    = baseX;
    let   size, renderOpt, yOffset = 0;

    // edge pegs are “transparent”
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

    hexes.push(
      Bodies.polygon(
        x, y + yOffset,
        6, size,
        { isStatic: true, render: renderOpt, chamfer: { radius: hexChamfer } }
      )
    );
  }
}

// 5) build the bins (tubes) and funnel
const tubes = [];
for (let i = 0; i < 10; i++) {
  tubes.push(
    Bodies.rectangle(
      174 + i * hexXSpacing,
      470,
      32, 100,
      { isStatic: true, render: style.transparent }
    )
  );
}
tubes.push(
  Bodies.rectangle(310, 60,  30, 150, { isStatic: true, angle: -0.2 * Math.PI, render: style.transparent }),
  Bodies.rectangle(434, 60,  30, 150, { isStatic: true, angle:  0.2 * Math.PI, render: style.transparent })
);

// 6) add everything to the world
World.add(world, [ balls, ...hexes, ...tubes ]);

// 7) add the outer walls
World.add(world, [
  Bodies.rectangle(372,   0,      237, borderWidth, { isStatic: true, render: style.transparent }),
  Bodies.rectangle(372,   height, 430, borderWidth, { isStatic: true, render: style.transparent }),
  Bodies.rectangle(  0,   300,     borderWidth, 600,  { isStatic: true, render: style.transparent }),
  Bodies.rectangle(width, 300,     borderWidth, 600,  { isStatic: true, render: style.transparent })
]);

// 8) kick off the physics + rendering loops
Runner.run(Runner.create(), engine);
Render.run(render);

// 9) wire up the Flip button
$('#flip-btn').on('click', () => {
  $('canvas').toggleClass('flip');
  engine.world.gravity.y *= -1;
});

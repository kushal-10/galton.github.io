<template>
  <div>
    <!-- Controls: Start / Stop / Reset / Slider -->
    <div style="margin-bottom: 10px; text-align: center;">
      <button @click="startSimulation" :disabled="simulationParams.isRunning">
        Start
      </button>
      <button @click="stopSimulation" :disabled="!simulationParams.isRunning">
        Stop
      </button>
      <button @click="resetSimulation">
        Reset
      </button>

      <!-- NEW: Slider for selecting number of nail‐rows (1–15) -->
      <div style="display: inline-block; margin-left: 20px; vertical-align: middle;">
        <label for="rowsSlider">Rows:</label>
        <input
          id="rowsSlider"
          type="range"
          min="1"
          max="15"
          v-model.number="selectedRows"
        />
        <span>{{ selectedRows }}</span>
      </div>
    </div>

    <!-- Matter.js will render into this container -->
    <div id="galtonCanvasContainer"></div>
  </div>
</template>

<script lang="ts">
import { defineComponent, watch } from "vue";
import Matter from "matter-js";

export default defineComponent({
  name: "GaltonBoard",
  setup() {
    const Engine = Matter.Engine;
    const Render = Matter.Render;
    const World = Matter.World;
    const Bodies = Matter.Bodies;
    const Runner = Matter.Runner;
    return { Engine, Render, World, Bodies, Runner };
  },

  data() {
    return {
      // Canvas Configuration
      canvasConfig: {
        width: 400,
        height: 700,
        backgroundColor: "#222",
        borderWidth: 15,
        borderColor: "gray",
      },

      // Ramp Configuration
      rampConfig: {
        height: 30,
        channelWidth: 30,
        angle: 22,
        percentageY: 0.06,
      },

      // Nails Configuration: fixed “template” of 15 possible rows
      nailsConfig: {
        color: "#444",
        yMarginInit: 45,
        yMargin: 2.2,
        radius: 6,
        xMargin: 24,
        structure: [
          { id: 1, nails: 9 },
          { id: 2, nails: 12 },
          { id: 3, nails: 15 },
          { id: 4, nails: 14 },
          { id: 5, nails: 15 },
          { id: 6, nails: 14 },
          { id: 7, nails: 15 },
          { id: 8, nails: 14 },
          { id: 9, nails: 15 },
          { id: 10, nails: 14 },
          { id: 11, nails: 15 },
          { id: 12, nails: 14 },
          { id: 13, nails: 15 },
          { id: 14, nails: 14 },
          { id: 15, nails: 15 },
        ],
      },

      // Walls Configuration
      wallsConfig: {
        width: 8,
        color: "gray",
      },

      // Balls Configuration
      ballsConfig: {
        number: 1200,
        radius: 3,
        colors: ["green"],
        friction: 0.00001,
        restitution: 0.7,
        density: 0.001,
        frictionAir: 0.042,
        sleepThreshold: 120,
        spawnInterval: 50,
      },

      // Simulation Parameters
      simulationParams: {
        isRunning: false, // start stopped
        ballCounter: 0,
        ballColorIndex: 0,
        gravity: 1.5,
      },

      // Engine / Runner / Render / Interval ID references
      engine: null as Matter.Engine | null,
      runner: null as Matter.Runner | null,
      render: null as Matter.Render | null,
      spawnIntervalId: null as number | null,

      // We will build & swap this whenever “selectedRows” changes:
      staticBodies: [] as Matter.Body[],

      // NEW: How many rows of nails to render (1..15). Default = 15.
      selectedRows: 15,
    };
  },

  computed: {
    //
    // 1) “activeStructure” is just the first `selectedRows` items from nailsConfig.structure
    //
    activeStructure(): { id: number; nails: number }[] {
      return this.nailsConfig.structure.slice(0, this.selectedRows);
    },

    //
    // 2) Borders (unchanged)
    //
    borderTop(): Matter.Body {
      return this.createBorderRectangle(
        this.canvasConfig.width / 2,
        this.canvasConfig.borderWidth / 2,
        this.canvasConfig.width,
        this.canvasConfig.borderWidth
      );
    },
    borderBottom(): Matter.Body {
      return this.createBorderRectangle(
        this.canvasConfig.width / 2,
        this.canvasConfig.height - this.canvasConfig.borderWidth / 2,
        this.canvasConfig.width,
        this.canvasConfig.borderWidth
      );
    },
    borderLeft(): Matter.Body {
      return this.createBorderRectangle(
        this.canvasConfig.borderWidth / 2,
        this.canvasConfig.height / 2,
        this.canvasConfig.borderWidth,
        this.canvasConfig.height
      );
    },
    borderRight(): Matter.Body {
      return this.createBorderRectangle(
        this.canvasConfig.width - this.canvasConfig.borderWidth / 2,
        this.canvasConfig.height / 2,
        this.canvasConfig.borderWidth,
        this.canvasConfig.height
      );
    },

    //
    // 3) Ramp (unchanged)
    //
    rampWidth(): number {
      return (this.canvasConfig.width - this.rampConfig.channelWidth) / 2;
    },
    rampLeftTopCoordinates() {
      const x1 = 0;
      const y1 = this.rampConfig.percentageY * this.canvasConfig.height;
      const x2 = x1 + this.rampWidth;
      const y2 = y1 + this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180));
      const x3 = x1 + this.rampWidth;
      const y3 = y2 + this.rampConfig.height;
      const x4 = 0;
      const y4 = y1 + this.rampConfig.height;
      const centerX = this.rampWidth / 2;
      const centerY =
        y1 +
        (this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180))) / 2 +
        this.rampConfig.height / 2;
      return { x1, y1, x2, y2, x3, y3, x4, y4, centerX, centerY };
    },
    rampLeftTop(): Matter.Body {
      return this.createParallelogram(
        { x: this.rampLeftTopCoordinates.centerX, y: this.rampLeftTopCoordinates.centerY },
        [
          { x: this.rampLeftTopCoordinates.x1, y: this.rampLeftTopCoordinates.y1 },
          { x: this.rampLeftTopCoordinates.x2, y: this.rampLeftTopCoordinates.y2 },
          { x: this.rampLeftTopCoordinates.x3, y: this.rampLeftTopCoordinates.y3 },
          { x: this.rampLeftTopCoordinates.x4, y: this.rampLeftTopCoordinates.y4 },
        ]
      );
    },
    rampLeftBottomCoordinates() {
      const x1 = this.rampLeftTopCoordinates.x2;
      const y1 = this.rampLeftTopCoordinates.y2;
      const x2 = this.rampLeftTopCoordinates.x3;
      const y2 = this.rampLeftTopCoordinates.y3;
      const x3 = 0;
      const y3 = y2 + this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180));
      const x4 = 0;
      const y4 = y3 - this.rampConfig.height;
      const centerX = this.rampWidth / 2;
      const centerY =
        y1 +
        (this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180))) / 2 +
        this.rampConfig.height / 2;
      return { x1, y1, x2, y2, x3, y3, x4, y4, centerX, centerY };
    },
    rampLeftBottom(): Matter.Body {
      return this.createParallelogram(
        { x: this.rampLeftBottomCoordinates.centerX, y: this.rampLeftBottomCoordinates.centerY },
        [
          { x: this.rampLeftBottomCoordinates.x1, y: this.rampLeftBottomCoordinates.y1 },
          { x: this.rampLeftBottomCoordinates.x2, y: this.rampLeftBottomCoordinates.y2 },
          { x: this.rampLeftBottomCoordinates.x3, y: this.rampLeftBottomCoordinates.y3 },
          { x: this.rampLeftBottomCoordinates.x4, y: this.rampLeftBottomCoordinates.y4 },
        ]
      );
    },
    rampRightTopCoordinates() {
      const x1 = this.canvasConfig.width;
      const y1 = this.rampConfig.percentageY * this.canvasConfig.height;
      const x2 = x1 - this.rampWidth;
      const y2 = y1 + this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180));
      const x3 = x1 - this.rampWidth;
      const y3 = y2 + this.rampConfig.height;
      const x4 = this.canvasConfig.width;
      const y4 = y1 + this.rampConfig.height;
      const centerX = this.canvasConfig.width - this.rampWidth / 2;
      const centerY =
        y1 +
        (this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180))) / 2 +
        this.rampConfig.height / 2;
      return { x1, y1, x2, y2, x3, y3, x4, y4, centerX, centerY };
    },
    rampRightTop(): Matter.Body {
      return this.createParallelogram(
        { x: this.rampRightTopCoordinates.centerX, y: this.rampRightTopCoordinates.centerY },
        [
          { x: this.rampRightTopCoordinates.x1, y: this.rampRightTopCoordinates.y1 },
          { x: this.rampRightTopCoordinates.x2, y: this.rampRightTopCoordinates.y2 },
          { x: this.rampRightTopCoordinates.x3, y: this.rampRightTopCoordinates.y3 },
          { x: this.rampRightTopCoordinates.x4, y: this.rampRightTopCoordinates.y4 },
        ]
      );
    },
    rampRightBottomCoordinates() {
      const x1 = this.rampRightTopCoordinates.x2;
      const y1 = this.rampRightTopCoordinates.y2;
      const x2 = this.rampRightTopCoordinates.x3;
      const y2 = this.rampRightTopCoordinates.y3;
      const x3 = x2 + this.rampWidth;
      const y3 = y2 + this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180));
      const x4 = x3;
      const y4 = y3 - this.rampConfig.height;
      const centerX = this.canvasConfig.width - this.rampWidth / 2;
      const centerY =
        y1 +
        (this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180))) / 2 +
        this.rampConfig.height / 2;
      return { x1, y1, x2, y2, x3, y3, x4, y4, centerX, centerY };
    },
    rampRightBottom(): Matter.Body {
      return this.createParallelogram(
        { x: this.rampRightBottomCoordinates.centerX, y: this.rampRightBottomCoordinates.centerY },
        [
          { x: this.rampRightBottomCoordinates.x1, y: this.rampRightBottomCoordinates.y1 },
          { x: this.rampRightBottomCoordinates.x2, y: this.rampRightBottomCoordinates.y2 },
          { x: this.rampRightBottomCoordinates.x3, y: this.rampRightBottomCoordinates.y3 },
          { x: this.rampRightBottomCoordinates.x4, y: this.rampRightBottomCoordinates.y4 },
        ]
      );
    },

    //
    // 4) “nailsYInit” depends on how many rows we have (activeStructure.length)
    //
    nailsYInit(): number {
      return (
        this.rampConfig.percentageY * this.canvasConfig.height +
        this.rampWidth * Math.tan(this.rampConfig.angle * (Math.PI / 180)) +
        this.rampConfig.height +
        this.nailsConfig.yMarginInit
      );
    },

    //
    // 5) Build “nails” out of only those rows in activeStructure
    //
    nails(): Matter.Body[] {
      const bodies: Matter.Body[] = [];
      for (const row of this.activeStructure) {
        bodies.push(...this.createRowNails(row));
      }
      return bodies;
    },

    //
    // 6) Recompute wall‐related values based on activeStructure
    //
    wallsN(): number {
      // number of nails in the *last* active row
      return this.activeStructure[this.activeStructure.length - 1].nails;
    },
    wallsY0(): number {
      // start Y = top of the first bin row:
      return (
        this.nailsYInit +
        2 * this.nailsConfig.radius * this.activeStructure.length +
        this.nailsConfig.yMargin * (this.activeStructure.length - 1)
      );
    },
    wallsYF(): number {
      return this.canvasConfig.height - this.canvasConfig.borderWidth;
    },
    wallsCenterY(): number {
      return (this.wallsYF + this.wallsY0) / 2;
    },
    wallsDelta(): number {
      return (this.wallsN - 1) / 2;
    },
    wallsXMargin(): number {
      return this.nailsConfig.xMargin;
    },
    wallsCenterX0(): number {
      return this.canvasConfig.width / 2 - this.wallsXMargin * this.wallsDelta;
    },
    walls(): Matter.Body[] {
      return [...Array(this.wallsN).keys()].map((i) => {
        return this.Bodies.rectangle(
          this.wallsCenterX0 + i * this.wallsXMargin,
          this.wallsCenterY,
          this.wallsConfig.width,
          this.wallsYF - this.wallsY0,
          {
            isStatic: true,
            sleepThreshold: Infinity,
            render: {
              fillStyle: this.wallsConfig.color,
              visible: true,
            },
          }
        );
      });
    },

    //
    // 7) Height at which balls should come to rest (unchanged except uses wallsY0)
    //
    ballsHeightStop(): number {
      return this.wallsY0 + 40;
    },
  },

  watch: {
    //
    // Whenever “selectedRows” changes, rebuild the board:
    //
    selectedRows() {
      this.resetSimulation();
    },
  },

  methods: {
    //
    // Create a static rectangle (borders)
    //
    createBorderRectangle(
      x: number,
      y: number,
      W: number,
      H: number
    ): Matter.Body {
      return this.Bodies.rectangle(x, y, W, H, {
        isStatic: true,
        sleepThreshold: Infinity,
        render: {
          fillStyle: this.canvasConfig.borderColor,
          visible: true,
        },
      });
    },

    //
    // Create a static parallelogram (ramps)
    //
    createParallelogram(
      center: { x: number; y: number },
      vertices: { x: number; y: number }[]
    ): Matter.Body {
      return Matter.Body.create({
        position: center,
        vertices: vertices,
        sleepThreshold: Infinity,
        isStatic: true,
        render: {
          fillStyle: this.canvasConfig.borderColor,
          visible: true,
        },
      });
    },

    //
    // Build one row of nails (static circles) for a given row descriptor
    //
    createRowNails(row: { id: number; nails: number }): Matter.Body[] {
      let delta: number;
      let centerX0: number;
      let centerY: number;

      // stagger odd/even rows so they form a “triangular” pattern
      if (row.id % 2 !== 0) {
        delta = (row.nails - 1) / 2;
        centerX0 = this.canvasConfig.width / 2 - this.nailsConfig.xMargin * delta;
        centerY =
          this.nailsYInit +
          this.nailsConfig.radius +
          (this.nailsConfig.yMargin + 2 * this.nailsConfig.radius) * (row.id - 1);
      } else {
        delta = row.nails / 2;
        centerX0 =
          this.canvasConfig.width / 2 -
          this.nailsConfig.xMargin * delta +
          this.nailsConfig.xMargin / 2;
        centerY =
          this.nailsYInit +
          this.nailsConfig.radius +
          (this.nailsConfig.yMargin + 2 * this.nailsConfig.radius) * (row.id - 1);
      }

      const circles: Matter.Body[] = [];
      for (let i = 0; i < row.nails; i++) {
        circles.push(
          this.Bodies.circle(
            centerX0 + i * this.nailsConfig.xMargin,
            centerY,
            this.nailsConfig.radius,
            {
              frictionStatic: 0.00001,
              isStatic: true,
              sleepThreshold: Infinity,
              render: {
                fillStyle: this.nailsConfig.color,
              },
            }
          )
        );
      }
      return circles;
    },

    //
    // Random X between left/right borders
    //
    randomInteger(a: number, b: number): number {
      return a + Math.random() * (b - a);
    },

    //
    // Create one ball. When it “sleeps,” we set it static so it stacks neatly.
    //
    createBall(): Matter.Body {
      const ballX = this.randomInteger(
        this.canvasConfig.borderWidth,
        this.canvasConfig.width - this.canvasConfig.borderWidth
      );
      const color = this.ballsConfig.colors[this.simulationParams.ballColorIndex];
      this.simulationParams.ballColorIndex =
        (this.simulationParams.ballColorIndex + 1) % this.ballsConfig.colors.length;

      const ball = this.Bodies.circle(ballX, this.canvasConfig.borderWidth, this.ballsConfig.radius, {
        friction: this.ballsConfig.friction,
        restitution: this.ballsConfig.restitution,
        density: this.ballsConfig.density,
        frictionAir: this.ballsConfig.frictionAir,
        sleepThreshold: this.ballsConfig.sleepThreshold,
        render: {
          fillStyle: color,
        },
      });

      // Once the ball “sleeps,” freeze it in place
      Matter.Events.on(ball, "sleepStart", () => {
        Matter.Body.setStatic(ball, true);
      });

      return ball;
    },

    //
    // Spawn loop: every spawnInterval ms, drop one new ball until we reach the configured number.
    // We keep the setInterval ID in spawnIntervalId so we can clear it later.
    //
    simulate() {
      if (this.spawnIntervalId !== null) {
        // Already running
        return;
      }

      this.simulationParams.isRunning = true;
      this.spawnIntervalId = window.setInterval(() => {
        if (this.simulationParams.isRunning && this.engine) {
          const ball = this.createBall();
          this.World.add(this.engine.world, ball);
          this.simulationParams.ballCounter++;

          if (this.simulationParams.ballCounter >= this.ballsConfig.number) {
            this.simulationParams.isRunning = false;
            this.stopSimulation();
          }
        }
      }, this.ballsConfig.spawnInterval);
    },

    //
    // Start button handler
    //
    startSimulation() {
      if (this.simulationParams.isRunning) return;
      this.simulationParams.isRunning = true;
      this.simulate();
    },

    //
    // Stop button handler
    //
    stopSimulation() {
      this.simulationParams.isRunning = false;
      if (this.spawnIntervalId !== null) {
        clearInterval(this.spawnIntervalId);
        this.spawnIntervalId = null;
      }
    },

    //
    // Reset button handler – rebuild everything from scratch
    //
    resetSimulation() {
      this.stopSimulation();

      if (this.engine) {
        // 1) Clear all bodies (both static + dynamic) from world
        this.World.clear(this.engine.world, false);

        // 2) Re‐create the static bodies (borders, ramps, nails, walls),
        //    reflecting the current `selectedRows`
        const newStatics: Matter.Body[] = [
          this.borderTop,
          this.borderBottom,
          this.borderLeft,
          this.borderRight,
          this.rampLeftTop,
          this.rampLeftBottom,
          this.rampRightTop,
          this.rampRightBottom,
          ...this.nails,
          ...this.walls,
        ];
        this.staticBodies = newStatics;

        // 3) Add them into the world
        this.World.add(this.engine.world, newStatics);
      }

      // 4) Reset counters so “Start” is fresh
      this.simulationParams.ballCounter = 0;
      this.simulationParams.ballColorIndex = 0;
      this.simulationParams.isRunning = false;
    },
  },

  mounted() {
    // 1) Create the engine, runner, and renderer
    const engine = this.Engine.create({ enableSleeping: true });
    engine.gravity.y = this.simulationParams.gravity;
    this.engine = engine;

    const runner = this.Runner.create();
    this.runner = runner;

    const render = this.Render.create({
      element: document.getElementById("galtonCanvasContainer") as HTMLElement,
      engine: engine,
      options: {
        width: this.canvasConfig.width,
        height: this.canvasConfig.height,
        wireframes: false,
        background: this.canvasConfig.backgroundColor,
      },
    });
    this.render = render;

    // 2) Build the static bodies (once, with default 15 rows)
    const initialStatics: Matter.Body[] = [
      this.borderTop,
      this.borderBottom,
      this.borderLeft,
      this.borderRight,
      this.rampLeftTop,
      this.rampLeftBottom,
      this.rampRightTop,
      this.rampRightBottom,
      ...this.nails,
      ...this.walls,
    ];
    this.staticBodies = initialStatics;

    // 3) Add static bodies to the world
    this.World.add(engine.world, initialStatics);

    // 4) Start the runner + renderer
    this.Runner.run(runner, engine);
    this.Render.run(render);

    // 5) Do NOT auto‐spawn; user must click “Start.” If you want auto‐start, uncomment:
    // this.simulationParams.isRunning = true;
    // this.simulate();
  },
});
</script>

<style scoped>
button {
  margin: 0 5px;
  padding: 5px 12px;
  font-size: 14px;
}
input[type="range"] {
  vertical-align: middle;
}
</style>

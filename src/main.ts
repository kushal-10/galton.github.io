import * as THREE from 'three';
import { World, Body, Sphere, Cylinder, Vec3 } from 'cannon-es';

// 1. Scene & renderer setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.getElementById('app')!.appendChild(renderer.domElement);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 2. Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(5, 10, 7.5);
dir.castShadow = true;
scene.add(dir);

// 3. Floor/backboard
const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.2, roughness: 0.8 });
const floorGeo = new THREE.BoxGeometry(20, 1, 20);
const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.position.y = -0.5;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// 4. Peg instanced mesh
type PegMatrix = { matrix: THREE.Matrix4 };
const pegCountX = 11, pegCountY = 11;
const pegGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12);
const pegMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.6 });
const totalPegs = pegCountX * pegCountY;
const pegs = new THREE.InstancedMesh(pegGeo, pegMat, totalPegs);
pegs.castShadow = true;
scene.add(pegs);
let pegIndex = 0;
for (let row = 0; row < pegCountY; row++) {
  for (let col = 0; col < pegCountX; col++) {
    const x = (col - (pegCountX - 1) / 2) * 1.5 + ((row % 2) ? 0.75 : 0);
    const y = row * 1.0 + 1.5;
    const m = new THREE.Matrix4().makeTranslation(x, y, 0);
    pegs.setMatrixAt(pegIndex++, m);
  }
}

// 5. Physics world
const world = new World({ gravity: new Vec3(0, -9.82, 0) });

// 5a. Floor body
const floorBody = new Body({ mass: 0 });
floorBody.addShape(new Cylinder(10, 10, 1, 8));
floorBody.position.set(0, -0.5, 0);
world.addBody(floorBody);

// 5b. Peg bodies
pegIndex = 0;
for (let row = 0; row < pegCountY; row++) {
  for (let col = 0; col < pegCountX; col++) {
    const x = (col - (pegCountX - 1) / 2) * 1.5 + ((row % 2) ? 0.75 : 0);
    const y = row * 1.0 + 1.5;
    const pegBody = new Body({ mass: 0 });
    pegBody.addShape(new Sphere(0.15));
    pegBody.position.set(x, y, 0);
    world.addBody(pegBody);
  }
}

// 6. Balls instanced mesh & physics
const BALL_RADIUS = 0.2;
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.2 });
const maxBalls = 200;
const balls = new THREE.InstancedMesh(ballGeo, ballMat, maxBalls);
balls.castShadow = true;
scene.add(balls);
const ballBodies: Body[] = [];

// 6a. Spawn parameters
const spawnY = pegCountY + 1.5 + BALL_RADIUS + 0.5; // ensure above top pegs

// 6b. Spawn function
enum Orientation { Vertical, Horizontal }
function spawnBall() {
  if (ballBodies.length >= maxBalls) return;
  const idx = ballBodies.length;
  const xOffset = (Math.random() - 0.5) * 1.2;

  // Physics body
  const body = new Body({ mass: 0.1 });
  body.addShape(new Sphere(BALL_RADIUS));
  body.position.set(xOffset, spawnY, 0);
  world.addBody(body);
  ballBodies.push(body);

  // Visual instance
  const m = new THREE.Matrix4().makeTranslation(xOffset, spawnY, 0);
  balls.setMatrixAt(idx, m);
  balls.instanceMatrix.needsUpdate = true;
}

// initial spawn + throttled interval
spawnBall();
setInterval(spawnBall, 250);

// 7. Animation loop
const fixedTimeStep = 1 / 60;
let lastTime: number | undefined;
function animate(time: number = 0) {
  requestAnimationFrame(animate);
  if (lastTime !== undefined) {
    const delta = (time - lastTime) / 1000;
    world.step(fixedTimeStep, delta, 3);
  }
  lastTime = time;

  // update instances
  ballBodies.forEach((body, idx) => {
    const m = new THREE.Matrix4().makeTranslation(
      body.position.x,
      body.position.y,
      body.position.z
    );
    balls.setMatrixAt(idx, m);
  });
  balls.instanceMatrix.needsUpdate = true;
  renderer.render(scene, camera);
}
animate();

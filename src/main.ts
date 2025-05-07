import * as THREE from 'three';
import { World, Body, Sphere, Box, Vec3, Material, ContactMaterial } from 'cannon-es';

// 1. Scene & renderer setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 60);
camera.lookAt(0, 10, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('app')!.appendChild(renderer.domElement);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 2. Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
const dir = new THREE.DirectionalLight(0xffffff, 1);
hemi.position.set(0, 50, 0);
dir.position.set(10, 20, 10);
dir.castShadow = true;
scene.add(hemi, dir);

// 3. Floor
const floorWidth = 20;
const floorDepth = 4;
const floorMesh = new THREE.Mesh(
  new THREE.BoxGeometry(floorWidth, 1, floorDepth),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
floorMesh.position.y = -0.5;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// 4. Peg grid as spheres
const pegCountX = 13, pegCountY = 11;
const pegSpacing = 1.5;
const pegYOffset = 5;
const pegGeo = new THREE.SphereGeometry(0.15, 16, 16);
const pegMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
const pegs = new THREE.InstancedMesh(pegGeo, pegMat, pegCountX * pegCountY);
scene.add(pegs);
let pegIndex = 0;
const pegPositions: Vec3[] = [];
for (let row = 0; row < pegCountY; row++) {
  for (let col = 0; col < pegCountX; col++) {
    const x = (col - (pegCountX - 1) / 2) * pegSpacing + (row % 2 ? pegSpacing / 2 : 0);
    const y = row * pegSpacing + pegYOffset;
    pegs.setMatrixAt(pegIndex, new THREE.Matrix4().makeTranslation(x, y, 0));
    pegPositions.push(new Vec3(x, y, 0));
    pegIndex++;
  }
}

// 5. Physics world
const world = new World({ gravity: new Vec3(0, -9.82, 0) });
// contact material for low bounce
const defaultMat = new Material('default');
const contactMat = new ContactMaterial(defaultMat, defaultMat, { restitution: 0.1, friction: 0.3 });
world.defaultContactMaterial = contactMat;

// 5a. Floor body
const floorBody = new Body({ mass: 0, material: defaultMat });
floorBody.addShape(new Box(new Vec3(floorWidth / 2, 0.5, floorDepth / 2)));
floorBody.position.set(0, -0.5, 0);
world.addBody(floorBody);

// 5b. Peg bodies with small random impulses
const IMPULSE = 0.02;
pegPositions.forEach((pos) => {
  const pegBody = new Body({ mass: 0, material: defaultMat });
  pegBody.addShape(new Sphere(0.15));
  pegBody.position.copy(pos);
  pegBody.addEventListener('collide', (e: { body: Body }) => {
    const ball = e.body;
    if (ball.mass > 0) {
      // small unbiased left/right impulse
      const dirSign = Math.random() < 0.5 ? -1 : 1;
      ball.applyImpulse(new Vec3(dirSign * IMPULSE, 0, 0), ball.position);
    }
  });
  world.addBody(pegBody);
});

// 6. Bins and side walls
const binHeight = 4;
const binThickness = 0.1;
const leftEdge = -((pegCountX - 1) / 2) * pegSpacing - pegSpacing / 2;
const binGeo = new THREE.BoxGeometry(binThickness, binHeight, floorDepth);
const binMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
for (let w = 0; w <= pegCountX; w++) {
  const x = leftEdge + w * pegSpacing;
  const wall = new THREE.Mesh(binGeo, binMat);
  wall.position.set(x, binHeight / 2 - 0.5, 0);
  scene.add(wall);
  const wallBody = new Body({ mass: 0, material: defaultMat });
  wallBody.addShape(new Box(new Vec3(binThickness / 2, binHeight / 2, floorDepth / 2)));
  wallBody.position.set(x, binHeight / 2 - 0.5, 0);
  world.addBody(wallBody);
}
const boundThickness = 0.5;
const boundHeight = pegYOffset + pegCountY * pegSpacing + 1;
const boundDepth = floorDepth + 2;
const halfFloor = floorWidth / 2;
const boundGeo = new THREE.BoxGeometry(boundThickness, boundHeight, boundDepth);
const boundMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
[-halfFloor, halfFloor].forEach((xPos) => {
  const wall = new THREE.Mesh(boundGeo, boundMat);
  wall.position.set(xPos, boundHeight / 2 - 0.5, 0);
  scene.add(wall);
  const wallBody = new Body({ mass: 0, material: defaultMat });
  wallBody.addShape(new Box(new Vec3(boundThickness / 2, boundHeight / 2, boundDepth / 2)));
  wallBody.position.set(xPos, boundHeight / 2 - 0.5, 0);
  world.addBody(wallBody);
});

// 7. Balls preload & release
const BALL_RADIUS = 0.1;
const MAX_BALLS = 1000;
const balls = new THREE.InstancedMesh(
  new THREE.SphereGeometry(BALL_RADIUS, 12, 12),
  new THREE.MeshStandardMaterial({ color: 0xffffff }),
  MAX_BALLS
);
scene.add(balls);
const ballBodies: Body[] = [];
const spawnY = pegYOffset + pegCountY * pegSpacing + BALL_RADIUS + 1;
for (let i = 0; i < MAX_BALLS; i++) {
  balls.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, spawnY + i * 0.002, 0));
}
balls.instanceMatrix.needsUpdate = true;
let releaseIndex = 0;
let releaseInterval: number;
const startBtn = document.createElement('button');
startBtn.textContent = 'Start';
startBtn.style.position = 'absolute';
startBtn.style.top = '10px';
startBtn.style.left = '10px';
startBtn.style.padding = '8px 12px';
startBtn.style.fontSize = '16px';
document.body.appendChild(startBtn);
startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  releaseInterval = window.setInterval(() => {
    if (releaseIndex >= MAX_BALLS) { clearInterval(releaseInterval); return; }
    const xOff = (Math.random() - 0.5) * pegSpacing;
    const body = new Body({ mass: 0.1, material: defaultMat });
    body.addShape(new Sphere(BALL_RADIUS));
    body.position.set(xOff, spawnY, 0);
    world.addBody(body);
    ballBodies.push(body);
    releaseIndex++;
  }, 100);
});

// 8. Animate
const fixedTimeStep = 1 / 120;
let lastTime: number | undefined;
function animate(time = 0) {
  requestAnimationFrame(animate);
  const delta = lastTime !== undefined ? (time - lastTime) / 1000 : 0;
  world.step(fixedTimeStep, delta * 2, 5);
  lastTime = time;
  ballBodies.forEach((b, i) => {
    balls.setMatrixAt(i, new THREE.Matrix4().makeTranslation(
      b.position.x, b.position.y, b.position.z
    ));
  });
  balls.instanceMatrix.needsUpdate = true;
  renderer.render(scene, camera);
}
animate();
import * as THREE from 'three';
import { World, Body, Sphere, Box, Vec3 } from 'cannon-es';

// 1. Scene & renderer setup
const scene = new THREE.Scene();

// Camera: PerspectiveCamera(fov, aspect, near, far)
const camera = new THREE.PerspectiveCamera(
  30,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
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
const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(floorWidth, 1, 20), floorMat);
floorMesh.position.y = -0.5;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// 4. Peg grid
const pegCountX = 11, pegCountY = 11;
const pegSpacing = 1.5;
const pegYOffset = 5;
const pegs = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12),
  new THREE.MeshStandardMaterial({ color: 0x888888 }),
  pegCountX * pegCountY
);
scene.add(pegs);
let idx = 0;
for (let row = 0; row < pegCountY; row++) {
  for (let col = 0; col < pegCountX; col++) {
    const x = (col - (pegCountX - 1) / 2) * pegSpacing + (row % 2 ? pegSpacing/2 : 0);
    const y = row * pegSpacing + pegYOffset;
    pegs.setMatrixAt(idx++, new THREE.Matrix4().makeTranslation(x, y, 0));
  }
}

// 5. Physics world
const world = new World({ gravity: new Vec3(0, -9.82, 0) });

// 5a. Floor body
const floorBody = new Body({ mass: 0 });
floorBody.addShape(new Box(new Vec3(floorWidth/2, 0.5, 10)));
floorBody.position.set(0, -0.5, 0);
world.addBody(floorBody);

// 5b. Peg bodies
idx = 0;
for (let row = 0; row < pegCountY; row++) {
  for (let col = 0; col < pegCountX; col++) {
    const x = (col - (pegCountX - 1) / 2) * pegSpacing + (row % 2 ? pegSpacing/2 : 0);
    const y = row * pegSpacing + pegYOffset;
    const pegBody = new Body({ mass: 0 });
    pegBody.addShape(new Sphere(0.15));
    pegBody.position.set(x, y, 0);
    world.addBody(pegBody);
  }
}

// 6. Bins at bottom
const binCount = pegCountX + 1;
const binHeight = 4;
const binThickness = 0.1;
const binDepth = 20;
const leftEdge = -((pegCountX - 1)/2) * pegSpacing - pegSpacing/2;
const binGeo = new THREE.BoxGeometry(binThickness, binHeight, binDepth);
const binMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
for (let w = 0; w <= pegCountX; w++) {
  const x = leftEdge + w * pegSpacing;
  const wall = new THREE.Mesh(binGeo, binMat);
  wall.position.set(x, binHeight/2 - 0.5, 0);
  scene.add(wall);
  const wallBody = new Body({ mass: 0 });
  wallBody.addShape(new Box(new Vec3(binThickness/2, binHeight/2, binDepth/2)));
  wallBody.position.set(x, binHeight/2 - 0.5, 0);
  world.addBody(wallBody);
}

// 6b. Side walls covering pegs
const boundThickness = 0.5;
const boundHeight = pegYOffset + pegCountY * pegSpacing + 1; // tall enough to cover highest peg
const boundDepth = binDepth + 2;
const halfFloor = floorWidth / 2;
const boundGeo = new THREE.BoxGeometry(boundThickness, boundHeight, boundDepth);
const boundMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
for (const x of [-halfFloor, halfFloor]) {
  const wall = new THREE.Mesh(boundGeo, boundMat);
  wall.position.set(x, boundHeight/2 - 0.5, 0);
  scene.add(wall);
  const wallBody = new Body({ mass: 0 });
  wallBody.addShape(new Box(new Vec3(boundThickness/2, boundHeight/2, boundDepth/2)));
  wallBody.position.set(x, boundHeight/2 - 0.5, 0);
  world.addBody(wallBody);
}

// 7. Balls & spawn
const BALL_RADIUS = 0.1;
const balls = new THREE.InstancedMesh(
  new THREE.SphereGeometry(BALL_RADIUS, 12, 12),
  new THREE.MeshStandardMaterial({ color: 0xffffff }),
  1000
);
scene.add(balls);
const ballBodies: Body[] = [];
const spawnY = pegYOffset + pegCountY * pegSpacing + BALL_RADIUS + 1;
function spawnBall() {
  if (ballBodies.length >= 1000) return;
  const i = ballBodies.length;
  const xOff = (Math.random() - 0.5) * pegSpacing;
  const body = new Body({ mass: 0.1 });
  body.addShape(new Sphere(BALL_RADIUS));
  body.position.set(xOff, spawnY, 0);
  world.addBody(body);
  ballBodies.push(body);
  balls.setMatrixAt(i, new THREE.Matrix4().makeTranslation(xOff, spawnY, 0));
  balls.instanceMatrix.needsUpdate = true;
}
spawnBall();
setInterval(spawnBall, 100);

// 8. Animate
const fixedTimeStep = 1/60;
let lastTime: number | undefined;
function animate(time = 0) {
  requestAnimationFrame(animate);
  const delta = lastTime !== undefined ? (time - lastTime)/1000 : 0;
  world.step(fixedTimeStep, delta, 3);
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
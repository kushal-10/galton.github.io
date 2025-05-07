import * as THREE from 'three';
import { World, Body, Sphere, Box, Vec3 } from 'cannon-es';

// 1. Scene & renderer setup
const scene = new THREE.Scene();

// Camera: PerspectiveCamera(fov, aspect, near, far)
//  fov    - vertical field of view in degrees (how wide the camera sees)
//  aspect - aspect ratio of viewport (width/height)
//  near   - closest distance at which objects are visible
//  far    - farthest distance at which objects are visible
const camera = new THREE.PerspectiveCamera(
  25,                               // fov: narrow angle to reduce perspective distortion
  window.innerWidth / window.innerHeight,  // aspect ratio
  0.1,                              // near clipping plane
  1000                              // far clipping plane
);

// Position the camera in 3D space: (x, y, z)
//  x - horizontal offset (left/right)
//  y - vertical offset (up/down)
//  z - distance from the scene (depth)
// Raising 'y' moves the camera up (floor drops toward bottom of view)
// Increasing 'z' pulls the camera back (more zoomed-out view)
camera.position.set(0, 15, 60);      // lifted up and pulled back to frame floor at bottom and include entire peg + bin area

// Always direct the camera toward the center of the scene
camera.lookAt(0, 10, 0);

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
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(10, 20, 10);
dir.castShadow = true;
scene.add(dir);

// 3. Floor
const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.2, roughness: 0.8 });
const floorGeo = new THREE.BoxGeometry(20, 1, 20);
const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.position.y = -0.5;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// 4. Peg grid (shifted up)
const pegCountX = 11, pegCountY = 11;
const pegSpacing = 1.5;
const pegYOffset = 5;
const pegGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12);
const pegMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.6 });
const totalPegs = pegCountX * pegCountY;
const pegs = new THREE.InstancedMesh(pegGeo, pegMat, totalPegs);
pegs.castShadow = true;
scene.add(pegs);
let i = 0;
for (let row = 0; row < pegCountY; row++) {
  for (let col = 0; col < pegCountX; col++) {
    const x = (col - (pegCountX - 1) / 2) * pegSpacing + (row % 2 ? pegSpacing/2 : 0);
    const y = row * pegSpacing + pegYOffset;
    const m = new THREE.Matrix4().makeTranslation(x, y, 0);
    pegs.setMatrixAt(i++, m);
  }
}

// 5. Physics world
const world = new World({ gravity: new Vec3(0, -9.82, 0) });

// 5a. Floor body
const floorBody = new Body({ mass: 0 });
floorBody.addShape(new Box(new Vec3(10, 0.5, 10)));
floorBody.position.set(0, -0.5, 0);
world.addBody(floorBody);

// 5b. Peg bodies
i = 0;
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

// 6. Bins at bottom to collect beads
const binCount = pegCountX + 1;
const binHeight = 4;
const binThickness = 0.1;
const binDepth = 20;
const halfSpacing = pegSpacing / 2;
const leftEdge = -((pegCountX - 1) / 2) * pegSpacing - halfSpacing;

const binGeo = new THREE.BoxGeometry(binThickness, binHeight, binDepth);
const binMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.2, roughness: 0.8 });
for (let w = 0; w <= pegCountX; w++) {
  const x = leftEdge + w * pegSpacing;
  // Three.js wall
  const wall = new THREE.Mesh(binGeo, binMat);
  wall.position.set(x, binHeight / 2 - 0.5, 0);
  wall.receiveShadow = true;
  scene.add(wall);
  // Physics wall
  const wallBody = new Body({ mass: 0 });
  wallBody.addShape(new Box(new Vec3(binThickness/2, binHeight/2, binDepth/2)));
  wallBody.position.set(x, binHeight / 2 - 0.5, 0);
  world.addBody(wallBody);
}

// 7. Balls instanced mesh & physics
const BALL_RADIUS = 0.1;
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 12, 12);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.2 });
const maxBalls = 1000;
const balls = new THREE.InstancedMesh(ballGeo, ballMat, maxBalls);
balls.castShadow = true;
scene.add(balls);
const ballBodies: Body[] = [];

// spawn height above top of pegs
const spawnY = pegYOffset + pegCountY * pegSpacing + BALL_RADIUS + 1;

function spawnBall() {
  if (ballBodies.length >= maxBalls) return;
  const idx = ballBodies.length;
  const xOff = (Math.random() - 0.5) * pegSpacing;
  // physics body
  const body = new Body({ mass: 0.1 });
  body.addShape(new Sphere(BALL_RADIUS));
  body.position.set(xOff, spawnY, 0);
  world.addBody(body);
  ballBodies.push(body);
  // visual
  const m = new THREE.Matrix4().makeTranslation(xOff, spawnY, 0);
  balls.setMatrixAt(idx, m);
  balls.instanceMatrix.needsUpdate = true;
}
spawnBall();
setInterval(spawnBall, 100);

// 8. Animate & sync
const fixedTimeStep = 1/60;
let lastTime: number | undefined;
function animate(time: number = 0) {
  requestAnimationFrame(animate);
  if (lastTime !== undefined) {
    const delta = (time - lastTime) / 1000;
    world.step(fixedTimeStep, delta, 3);
  }
  lastTime = time;
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
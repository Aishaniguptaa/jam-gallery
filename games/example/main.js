// Starter scene: a cube you can move with WASD or the arrow keys.
// Ask Claude to change anything here; this is just a working starting point.
import * as THREE from 'three';

// The scene holds everything; the camera is the player's eye; the renderer draws it.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#87b5e0');

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 6, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Light: soft sky light plus a sun.
scene.add(new THREE.HemisphereLight('#ffffff', '#445566', 1.5));
const sun = new THREE.DirectionalLight('#ffffff', 2);
sun.position.set(5, 10, 5);
scene.add(sun);

// Ground.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: '#6a8f4e' })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// The player: one cube.
const player = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: '#e0663a' })
);
player.position.y = 0.5;
scene.add(player);

// Keyboard: remember which keys are held down.
const held = new Set();
addEventListener('keydown', (e) => held.add(e.key.toLowerCase()));
addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Game loop: runs every frame. dt is seconds since the last frame.
const speed = 5;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (held.has('w') || held.has('arrowup')) player.position.z -= speed * dt;
  if (held.has('s') || held.has('arrowdown')) player.position.z += speed * dt;
  if (held.has('a') || held.has('arrowleft')) player.position.x -= speed * dt;
  if (held.has('d') || held.has('arrowright')) player.position.x += speed * dt;
  renderer.render(scene, camera);
});

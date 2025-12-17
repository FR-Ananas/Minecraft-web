// ==============================
// SCÈNE, CAMÉRA, RENDU
// ==============================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ==============================
// PLAYER (FPS)
// ==============================

const PLAYER_HEIGHT = 1.8;

const player = new THREE.Object3D();
player.position.set(0, PLAYER_HEIGHT, 5);
scene.add(player);

player.add(camera);

// ==============================
// LUMIÈRES
// ==============================

scene.add(new THREE.DirectionalLight(0xffffff, 1).position.set(10, 20, 10));
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// ==============================
// TEXTURE DES BLOCS
// ==============================

const textureLoader = new THREE.TextureLoader();
const blockTexture = textureLoader.load('texture.png');

blockTexture.magFilter = THREE.NearestFilter;
blockTexture.minFilter = THREE.NearestFilter;

// ==============================
// BLOC
// ==============================

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const blockMaterial = new THREE.MeshStandardMaterial({ map: blockTexture });

// ==============================
// MONDE (PLUS GRAND + PROFONDEUR)
// ==============================

const WORLD_SIZE = 40;     // largeur / longueur
const WORLD_DEPTH = 4;     // épaisseur du sol

for (let y = 0; y < WORLD_DEPTH; y++) {
  for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x++) {
    for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z++) {
      const block = new THREE.Mesh(blockGeometry, blockMaterial);
      block.position.set(x, -y, z);
      scene.add(block);
    }
  }
}

// ==============================
// CONTRÔLES FPS
// ==============================

let isLocked = false;
let pitch = 0;
let yaw = 0;

const direction = new THREE.Vector3();
const move = { forward: false, backward: false, left: false, right: false };

const speed = 5;

// --- Souris ---
document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === document.body;
});

document.addEventListener('mousemove', (event) => {
  if (!isLocked) return;

  const sensitivity = 0.002;
  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;

  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

  player.rotation.y = yaw;
  camera.rotation.x = pitch;
});

// --- Clavier ---
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') move.forward = true;
  if (e.code === 'KeyS') move.backward = true;
  if (e.code === 'KeyA') move.left = true;
  if (e.code === 'KeyD') move.right = true;

  // SAUT
  if (e.code === 'Space' && onGround) {
    velocityY = jumpStrength;
    onGround = false;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') move.forward = false;
  if (e.code === 'KeyS') move.backward = false;
  if (e.code === 'KeyA') move.left = false;
  if (e.code === 'KeyD') move.right = false;
});

// ==============================
// PHYSIQUE (GRAVITÉ + SAUT)
// ==============================

let velocityY = 0;
const gravity = -20;
const jumpStrength = 8;
let onGround = false;

// ==============================
// BOUCLE D’ANIMATION
// ==============================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // Déplacement horizontal
  direction.set(0, 0, 0);
  if (move.forward) direction.z -= 1;
  if (move.backward) direction.z += 1;
  if (move.left) direction.x -= 1;
  if (move.right) direction.x += 1;
  direction.normalize();

  if (isLocked) {
    player.translateX(direction.x * speed * delta);
    player.translateZ(direction.z * speed * delta);
  }

  // Gravité
  velocityY += gravity * delta;
  player.position.y += velocityY * delta;

  // Sol (Y = 0)
  if (player.position.y <= PLAYER_HEIGHT) {
    player.position.y = PLAYER_HEIGHT;
    velocityY = 0;
    onGround = true;
  }

  renderer.render(scene, camera);
}

animate();

// ==============================
// RESIZE
// ==============================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

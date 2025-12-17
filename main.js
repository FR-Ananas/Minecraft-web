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
player.position.set(0, PLAYER_HEIGHT + 2, 5);
scene.add(player);
player.add(camera);

// ==============================
// LUMIÈRES
// ==============================

scene.add(new THREE.DirectionalLight(0xffffff, 1).position.set(10, 20, 10));
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// ==============================
// TEXTURE
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
// MONDE (BLOCS STOCKÉS)
// ==============================

const blocks = [];

const WORLD_SIZE = 40;
const WORLD_DEPTH = 4;

for (let y = 0; y < WORLD_DEPTH; y++) {
  for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x++) {
    for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z++) {
      const block = new THREE.Mesh(blockGeometry, blockMaterial);
      block.position.set(x, -y, z);
      scene.add(block);
      blocks.push(block);
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

// --- Pointer lock ---
document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === document.body;
});

// --- Souris ---
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

// Raycaster vertical pour collision sol
const down = new THREE.Vector3(0, -1, 0);
const raycaster = new THREE.Raycaster();

// Raycaster central pour poser / casser blocs
const raycasterBlock = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
let selectedBlock = null;

// ==============================
// COLLISION HORIZONTALE
// ==============================

const horizontalRayLength = 0.5;

function checkHorizontalCollisions(deltaX, deltaZ) {
  const directions = [
    new THREE.Vector3(deltaX, 0, 0),
    new THREE.Vector3(0, 0, deltaZ)
  ];

  for (let dir of directions) {
    const origin = player.position.clone();
    raycaster.set(origin, dir.clone().normalize());
    const intersects = raycaster.intersectObjects(blocks);

    if (intersects.length > 0 && intersects[0].distance < horizontalRayLength) {
      if (dir.x !== 0) deltaX = 0;
      if (dir.z !== 0) deltaZ = 0;
    }
  }

  return { deltaX, deltaZ };
}

// ==============================
// RAYCAST BLOCS
// ==============================

function updateSelectedBlock() {
  raycasterBlock.setFromCamera(pointer, camera);
  const intersects = raycasterBlock.intersectObjects(blocks);

  if (intersects.length > 0) {
    selectedBlock = intersects[0].object;
  } else {
    selectedBlock = null;
  }
}

// Clic souris : casser / poser
document.addEventListener('mousedown', (e) => {
  if (!isLocked) return;
  updateSelectedBlock();

  if (e.button === 0 && selectedBlock) { // gauche = casser
    scene.remove(selectedBlock);
    blocks.splice(blocks.indexOf(selectedBlock), 1);
    selectedBlock = null;
  }

  if (e.button === 2 && selectedBlock) { // droit = poser
    const normal = raycasterBlock.ray.direction.clone().round();
    const newPos = selectedBlock.position.clone().add(normal);

    const newBlock = new THREE.Mesh(blockGeometry, blockMaterial);
    newBlock.position.copy(newPos);
    scene.add(newBlock);
    blocks.push(newBlock);
  }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// ==============================
// BOUCLE D’ANIMATION
// ==============================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Déplacement horizontal avec collisions
  direction.set(0, 0, 0);
  if (move.forward) direction.z -= 1;
  if (move.backward) direction.z += 1;
  if (move.left) direction.x -= 1;
  if (move.right) direction.x += 1;
  direction.normalize();

  if (isLocked) {
    let moveX = direction.x * speed * delta;
    let moveZ = direction.z * speed * delta;

    const blocked = checkHorizontalCollisions(moveX, moveZ);
    moveX = blocked.deltaX;
    moveZ = blocked.deltaZ;

    player.translateX(moveX);
    player.translateZ(moveZ);
  }

  // Gravité
  velocityY += gravity * delta;
  player.position.y += velocityY * delta;

  // Collision sol
  raycaster.set(player.position, down);
  const intersects = raycaster.intersectObjects(blocks);

  if (intersects.length > 0) {
    const distance = intersects[0].distance;
    if (distance < PLAYER_HEIGHT) {
      player.position.y += PLAYER_HEIGHT - distance;
      velocityY = 0;
      onGround = true;
    } else {
      onGround = false;
    }
  } else {
    onGround = false;
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

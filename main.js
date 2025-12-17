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
// TEXTURES SELON LA PROFONDEUR
// ==============================

const textureLoader = new THREE.TextureLoader();

const textures = {
  0: textureLoader.load('texture_un.png'),
  1: textureLoader.load('texture_deux.png'),
  2: textureLoader.load('texture_trois.png'),
  3: textureLoader.load('texture_quatre.png')
};

for (let key in textures) {
  textures[key].magFilter = THREE.NearestFilter;
  textures[key].minFilter = THREE.NearestFilter;
}

const materials = {
  0: new THREE.MeshStandardMaterial({ map: textures[0] }),
  1: new THREE.MeshStandardMaterial({ map: textures[1] }),
  2: new THREE.MeshStandardMaterial({ map: textures[2] }),
  3: new THREE.MeshStandardMaterial({ map: textures[3] })
};

// ==============================
// BLOC
// ==============================

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

// ==============================
// MONDE (BLOCS STOCKÉS)
// ==============================

const blocks = [];

const WORLD_SIZE = 40;
const MAX_DEPTH = -25;

for (let y = 0; y >= MAX_DEPTH; y--) {
  for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x++) {
    for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z++) {
      // Choisir le matériau selon la profondeur
      let mat;
      if (y === 0) mat = materials[0];
      else if (y >= -4) mat = materials[1];
      else if (y >= -15) mat = materials[2];
      else mat = materials[3];

      const block = new THREE.Mesh(blockGeometry, mat);
      block.position.set(x, y, z);
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
// COLLISION HORIZONTALE SOLIDE
// ==============================

function checkHorizontalCollisions(deltaX, deltaZ) {
  const newPos = player.position.clone();
  newPos.x += deltaX;
  newPos.z += deltaZ;

  for (let block of blocks) {
    if (
      Math.abs(block.position.x - newPos.x) < 0.5 &&
      Math.abs(block.position.z - newPos.z) < 0.5 &&
      Math.abs(block.position.y - player.position.y) < PLAYER_HEIGHT
    ) {
      return { deltaX: 0, deltaZ: 0 };
    }
  }
  return { deltaX, deltaZ };
}

// ==============================
// POSER / CASSER BLOCS
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

function canPlaceBlock(position) {
  for (let block of blocks) {
    if (block.position.equals(position)) return false;
  }
  return true;
}

// Clic souris : casser / poser
document.addEventListener('mousedown', (e) => {
  if (!isLocked) return;
  updateSelectedBlock();

  if (!selectedBlock) return;

  const intersects = raycasterBlock.intersectObject(selectedBlock);
  if (!intersects.length) return;

  const faceNormal = intersects[0].face.normal;

  if (e.button === 0) { // gauche = casser
    scene.remove(selectedBlock);
    blocks.splice(blocks.indexOf(selectedBlock), 1);
    selectedBlock = null;
  }

  if (e.button === 2) { // droit = poser
    const newPos = selectedBlock.position.clone().add(faceNormal);

    if (canPlaceBlock(newPos)) {
      const depth = newPos.y;
      let mat;
      if (depth === 0) mat = materials[0];
      else if (depth >= -4) mat = materials[1];
      else if (depth >= -15) mat = materials[2];
      else mat = materials[3];

      const newBlock = new THREE.Mesh(blockGeometry, mat);
      newBlock.position.copy(newPos);
      scene.add(newBlock);
      blocks.push(newBlock);
    }
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

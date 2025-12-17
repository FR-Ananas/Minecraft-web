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
// MONDE (CHUNKS AVEC INSTANCEDMESH)
// ==============================

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 26;
const RENDER_DISTANCE = 1; // chunks autour du joueur
const chunks = {}; // key = "chunkX,chunkZ", value = {mesh: InstancedMesh, blocks: []}

// Pour collisions et pose/casse
const blocks = [];

function generateChunk(chunkX, chunkZ) {
  const key = `${chunkX},${chunkZ}`;
  if (chunks[key]) return;

  // Pour simplifier, on crée un InstancedMesh par matériau
  const materialMeshes = [];
  for (let i = 0; i < 4; i++) {
    materialMeshes[i] = new THREE.InstancedMesh(blockGeometry, materials[i], CHUNK_SIZE*CHUNK_SIZE*CHUNK_HEIGHT);
    materialMeshes[i].count = 0;
    scene.add(materialMeshes[i]);
  }

  const chunkBlocks = [];

  let instanceIndices = [0, 0, 0, 0]; // compteur par matériau

  for (let y = 0; y > -CHUNK_HEIGHT; y--) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const globalX = chunkX * CHUNK_SIZE + x;
        const globalZ = chunkZ * CHUNK_SIZE + z;

        // Choisir matériau
        let matIndex;
        if (y === 0) matIndex = 0;
        else if (y >= -4) matIndex = 1;
        else if (y >= -15) matIndex = 2;
        else matIndex = 3;

        const dummy = new THREE.Object3D();
        dummy.position.set(globalX, y, globalZ);
        dummy.updateMatrix();

        materialMeshes[matIndex].setMatrixAt(instanceIndices[matIndex], dummy.matrix);
        instanceIndices[matIndex]++;

        // Stocker info pour collisions
        chunkBlocks.push({position: new THREE.Vector3(globalX, y, globalZ), matIndex});
        blocks.push({position: new THREE.Vector3(globalX, y, globalZ), matIndex});
      }
    }
  }

  // Mettre à jour le count réel
  for (let i = 0; i < 4; i++) {
    materialMeshes[i].count = instanceIndices[i];
    materialMeshes[i].instanceMatrix.needsUpdate = true;
  }

  chunks[key] = {meshes: materialMeshes, blocks: chunkBlocks};
}

function cleanupChunks() {
  const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
  const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

  for (let key in chunks) {
    const [chunkX, chunkZ] = key.split(',').map(Number);
    if (
      Math.abs(chunkX - playerChunkX) > RENDER_DISTANCE ||
      Math.abs(chunkZ - playerChunkZ) > RENDER_DISTANCE
    ) {
      // retirer les blocks du tableau global pour collisions
      for (let b of chunks[key].blocks) {
        const index = blocks.findIndex(bl => bl.position.equals(b.position));
        if (index !== -1) blocks.splice(index, 1);
      }
      // retirer les meshes de la scène
      for (let mesh of chunks[key].meshes) scene.remove(mesh);
      delete chunks[key];
    }
  }
}

function updateChunks() {
  cleanupChunks();
  const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
  const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      generateChunk(playerChunkX + dx, playerChunkZ + dz);
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

document.body.addEventListener('click', () => document.body.requestPointerLock());
document.addEventListener('pointerlockchange', () => isLocked = document.pointerLockElement === document.body);

document.addEventListener('mousemove', (event) => {
  if (!isLocked) return;
  const sensitivity = 0.002;
  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;
  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
  player.rotation.y = yaw;
  camera.rotation.x = pitch;
});

document.addEventListener('keydown', e => {
  if (e.code === 'KeyW') move.forward = true;
  if (e.code === 'KeyS') move.backward = true;
  if (e.code === 'KeyA') move.left = true;
  if (e.code === 'KeyD') move.right = true;
  if (e.code === 'Space' && onGround) { velocityY = jumpStrength; onGround = false; }
});
document.addEventListener('keyup', e => {
  if (e.code === 'KeyW') move.forward = false;
  if (e.code === 'KeyS') move.backward = false;
  if (e.code === 'KeyA') move.left = false;
  if (e.code === 'KeyD') move.right = false;
});

// ==============================
// PHYSIQUE
// ==============================

let velocityY = 0;
const gravity = -20;
const jumpStrength = 8;
let onGround = false;

const down = new THREE.Vector3(0, -1, 0);
const raycaster = new THREE.Raycaster();
const raycasterBlock = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
let selectedBlock = null;

function checkHorizontalCollisions(deltaX, deltaZ) {
  const newPos = player.position.clone();
  newPos.x += deltaX;
  newPos.z += deltaZ;
  for (let block of blocks) {
    if (
      Math.abs(block.position.x - newPos.x) < 0.5 &&
      Math.abs(block.position.z - newPos.z) < 0.5 &&
      Math.abs(block.position.y - player.position.y) < PLAYER_HEIGHT
    ) return {deltaX:0, deltaZ:0};
  }
  return {deltaX, deltaZ};
}

// ==============================
// BOUCLE D’ANIMATION
// ==============================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Chunks
  updateChunks();

  // Déplacement
  direction.set(0,0,0);
  if (move.forward) direction.z -=1;
  if (move.backward) direction.z +=1;
  if (move.left) direction.x -=1;
  if (move.right) direction.x +=1;
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
  const intersects = raycaster.intersectObjects(blocks.map(b => { 
    const dummy = new THREE.Mesh(blockGeometry); 
    dummy.position.copy(b.position); 
    return dummy; 
  }));
  if (intersects.length>0){
    const distance = intersects[0].distance;
    if(distance < PLAYER_HEIGHT){
      player.position.y += PLAYER_HEIGHT - distance;
      velocityY = 0;
      onGround = true;
    } else onGround=false;
  } else onGround=false;

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

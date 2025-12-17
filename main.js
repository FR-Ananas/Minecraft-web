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
player.position.set(0, PLAYER_HEIGHT + 15, 5); // départ haut
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

const blockGeometry = new THREE.BoxGeometry(1,1,1);

// ==============================
// MONDE (CHUNKS + INSTANCEDMESH)
// ==============================

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 26;
const RENDER_DISTANCE = 2;

const chunks = {};   // key="chunkX,chunkZ" => {meshes, blocks}
const blocks = [];   // pour collisions
const chunkQueue = [];

// ==============================
// GENERATION CHUNK
// ==============================

function generateChunk(chunkX, chunkZ){
  const key = `${chunkX},${chunkZ}`;
  if(chunks[key]) return;

  const materialMeshes = [];
  for(let i=0;i<4;i++){
    materialMeshes[i] = new THREE.InstancedMesh(blockGeometry, materials[i], CHUNK_SIZE*CHUNK_SIZE*CHUNK_HEIGHT);
    materialMeshes[i].count = 0;
    scene.add(materialMeshes[i]);
  }

  const chunkBlocks = [];
  let instanceIndices = [0,0,0,0];

  for(let y=0;y>-CHUNK_HEIGHT;y--){
    for(let x=0;x<CHUNK_SIZE;x++){
      for(let z=0;z<CHUNK_SIZE;z++){
        const globalX = chunkX*CHUNK_SIZE + x;
        const globalZ = chunkZ*CHUNK_SIZE + z;

        let matIndex;
        if(y===0) matIndex=0;
        else if(y>=-4) matIndex=1;
        else if(y>=-15) matIndex=2;
        else matIndex=3;

        const dummy = new THREE.Object3D();
        dummy.position.set(globalX,y,globalZ);
        dummy.updateMatrix();
        materialMeshes[matIndex].setMatrixAt(instanceIndices[matIndex], dummy.matrix);
        instanceIndices[matIndex]++;

        const blockData = {position:new THREE.Vector3(globalX,y,globalZ), matIndex};
        chunkBlocks.push(blockData);
        blocks.push(blockData);
      }
    }
  }

  for(let i=0;i<4;i++){
    materialMeshes[i].count = instanceIndices[i];
    materialMeshes[i].instanceMatrix.needsUpdate = true;
  }

  chunks[key] = {meshes:materialMeshes, blocks:chunkBlocks};
}

// ==============================
// QUEUE LAZY
// ==============================

function enqueueChunks(){
  const playerChunkX = Math.floor(player.position.x/CHUNK_SIZE);
  const playerChunkZ = Math.floor(player.position.z/CHUNK_SIZE);

  for(let dx=-RENDER_DISTANCE;dx<=RENDER_DISTANCE;dx++){
    for(let dz=-RENDER_DISTANCE;dz<=RENDER_DISTANCE;dz++){
      const key = `${playerChunkX+dx},${playerChunkZ+dz}`;
      if(!chunks[key] && !chunkQueue.includes(key)) chunkQueue.push(key);
    }
  }
}

function generateNextChunk(){
  if(chunkQueue.length===0) return;
  const key = chunkQueue.shift();
  const [cx,cz] = key.split(',').map(Number);
  generateChunk(cx,cz);
}

// ==============================
// SUPPRESSION CHUNKS LOIN
// ==============================

function cleanupChunks(){
  const playerChunkX = Math.floor(player.position.x/CHUNK_SIZE);
  const playerChunkZ = Math.floor(player.position.z/CHUNK_SIZE);

  for(let key in chunks){
    const [chunkX,chunkZ] = key.split(',').map(Number);
    if(Math.abs(chunkX-playerChunkX)>RENDER_DISTANCE || Math.abs(chunkZ-playerChunkZ)>RENDER_DISTANCE){
      for(let b of chunks[key].blocks){
        const index = blocks.findIndex(bl=>bl.position.equals(b.position));
        if(index!==-1) blocks.splice(index,1);
      }
      for(let m of chunks[key].meshes) scene.remove(m);
      delete chunks[key];
    }
  }
}

// ==============================
// POSE / CASSE BLOCS
// ==============================

function modifyChunkBlock(globalX, globalY, globalZ, action){
  const chunkX = Math.floor(globalX/CHUNK_SIZE);
  const chunkZ = Math.floor(globalZ/CHUNK_SIZE);
  const key = `${chunkX},${chunkZ}`;
  if(!chunks[key]) return;

  const chunk = chunks[key];

  if(action==='remove'){
    const index = chunk.blocks.findIndex(b=>b.position.x===globalX && b.position.y===globalY && b.position.z===globalZ);
    if(index!==-1){
      const b = chunk.blocks[index];
      chunk.blocks.splice(index,1);
      const gIndex = blocks.findIndex(bl=>bl.position.equals(b.position));
      if(gIndex!==-1) blocks.splice(gIndex,1);
      // regénère l'InstancedMesh
      updateChunkMesh(chunk);
    }
  } else if(action==='add'){
    // Déterminer matériau selon profondeur
    let matIndex;
    if(globalY===0) matIndex=0;
    else if(globalY>=-4) matIndex=1;
    else if(globalY>=-15) matIndex=2;
    else matIndex=3;

    const newBlock = {position:new THREE.Vector3(globalX,globalY,globalZ), matIndex};
    chunk.blocks.push(newBlock);
    blocks.push(newBlock);
    updateChunkMesh(chunk);
  }
}

function updateChunkMesh(chunk){
  // Reset instance counts
  let counts = [0,0,0,0];
  for(let i=0;i<4;i++) chunk.meshes[i].count=0;

  for(let b of chunk.blocks){
    const dummy = new THREE.Object3D();
    dummy.position.copy(b.position);
    dummy.updateMatrix();
    const idx = counts[b.matIndex];
    chunk.meshes[b.matIndex].setMatrixAt(idx,dummy.matrix);
    counts[b.matIndex]++;
  }

  for(let i=0;i<4;i++){
    chunk.meshes[i].count = counts[i];
    chunk.meshes[i].instanceMatrix.needsUpdate=true;
  }
}

// ==============================
// CONTROLES FPS
// ==============================

let isLocked=false, pitch=0,yaw=0;
const direction = new THREE.Vector3();
const move={forward:false,backward:false,left:false,right:false};
const speed=5;

document.body.addEventListener('click',()=>document.body.requestPointerLock());
document.addEventListener('pointerlockchange',()=>isLocked=document.pointerLockElement===document.body);

document.addEventListener('mousemove',e=>{
  if(!isLocked) return;
  const sens=0.002;
  yaw-=e.movementX*sens;
  pitch-=e.movementY*sens;
  pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch));
  player.rotation.y=yaw;
  camera.rotation.x=pitch;
});

document.addEventListener('keydown',e=>{
  if(e.code==='KeyW') move.forward=true;
  if(e.code==='KeyS') move.backward=true;
  if(e.code==='KeyA') move.left=true;
  if(e.code==='KeyD') move.right=true;
  if(e.code==='Space' && onGround){velocityY=jumpStrength; onGround=false;}
});
document.addEventListener('keyup',e=>{
  if(e.code==='KeyW') move.forward=false;
  if(e.code==='KeyS') move.backward=false;
  if(e.code==='KeyA') move.left=false;
  if(e.code==='KeyD') move.right=false;
});

// ==============================
// PHYSIQUE
// ==============================

let velocityY=0;
const gravity=-20;
const jumpStrength=8;
let onGround=false;

// ==============================
// BOUCLE D’ANIMATION
// ==============================

const clock = new THREE.Clock();

// Génération initiale
enqueueChunks();

function animate(){
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // --- Chunks ---
  enqueueChunks();
  generateNextChunk();
  cleanupChunks();

  // --- Déplacement ---
  direction.set(0,0,0);
  if(move.forward) direction.z -=1;
  if(move.backward) direction.z +=1;
  if(move.left) direction.x -=1;
  if(move.right) direction.x +=1;
  direction.normalize();

  if(isLocked){
    let moveX = direction.x*speed*delta;
    let moveZ = direction.z*speed*delta;
    const blocked = checkHorizontalCollisions(moveX, moveZ);
    moveX = blocked.deltaX;
    moveZ = blocked.deltaZ;
    player.translateX(moveX);
    player.translateZ(moveZ);
  }

  // --- Gravité ---
  velocityY+=gravity*delta;
  player.position.y+=velocityY*delta;

  // --- Collision sol ---
  onGround=false;
  const px = Math.floor(player.position.x/CHUNK_SIZE);
  const pz = Math.floor(player.position.z/CHUNK_SIZE);
  const nearbyBlocks=[];
  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      const key = `${px+dx},${pz+dz}`;
      if(chunks[key]) nearbyBlocks.push(...chunks[key].blocks);
    }
  }

  for(let b of nearbyBlocks){
    if(player.position.x>b.position.x-0.5 && player.position.x<b.position.x+0.5 &&
       player.position.z>b.position.z-0.5 && player.position.z<b.position.z+0.5){
      const dy = player.position.y - b.position.y;
      if(dy<=PLAYER_HEIGHT && dy>=0){
        player.position.y = b.position.y + PLAYER_HEIGHT;
        velocityY=0;
        onGround=true;
      }
    }
  }

  renderer.render(scene,camera);
}

animate();

// ==============================
// RESIZE
// ==============================

window.addEventListener('resize',()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==============================
// COLLISION HORIZONTALE
// ==============================

function checkHorizontalCollisions(deltaX,deltaZ){
  const newPos = player.position.clone();
  newPos.x+=deltaX; newPos.z+=deltaZ;
  const px = Math.floor(newPos.x/CHUNK_SIZE);
  const pz = Math.floor(newPos.z/CHUNK_SIZE);
  const nearbyBlocks=[];
  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      const key = `${px+dx},${pz+dz}`;
      if(chunks[key]) nearbyBlocks.push(...chunks[key].blocks);
    }
  }

  for(let block of nearbyBlocks){
    if(Math.abs(block.position.x-newPos.x)<0.5 &&
       Math.abs(block.position.z-newPos.z)<0.5 &&
       Math.abs(block.position.y-player.position.y)<PLAYER_HEIGHT) return {deltaX:0, deltaZ:0};
  }
  return {deltaX, deltaZ};
}

// ==============================
// GESTION DE LA SOURIS POUR POSER/CASSER BLOCS
// ==============================

document.addEventListener('mousedown', e=>{
  if(!isLocked) return;
  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), dir);

  // Vérifier collision avec blocs proches
  const px = Math.floor(player.position.x/CHUNK_SIZE);
  const pz = Math.floor(player.position.z/CHUNK_SIZE);
  const nearbyBlocks=[];
  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      const key = `${px+dx},${pz+dz}`;
      if(chunks[key]) nearbyBlocks.push(...chunks[key].blocks);
    }
  }

  let closest = null;
  let minDist = Infinity;
  for(let b of nearbyBlocks){
    const distance = raycaster.ray.origin.distanceTo(b.position);
    if(distance<minDist && distance<5){
      minDist = distance;
      closest = b;
    }
  }

  if(!closest) return;
  if(e.button===0) modifyChunkBlock(closest.position.x,closest.position.y,closest.position.z,'remove'); // gauche = casse
  if(e.button===2){
    const pos = closest.position.clone();
    pos.y+=1; // poser dessus
    modifyChunkBlock(pos.x,pos.y,pos.z,'add');
  }
});

document.addEventListener('contextmenu',e=>e.preventDefault());

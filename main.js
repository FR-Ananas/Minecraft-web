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
player.position.set(8, PLAYER_HEIGHT + 10, 8); // départ au-dessus du monde
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
// MONDE FIXE
// ==============================

const WORLD_WIDTH = 16;
const WORLD_DEPTH = 16;
const WORLD_HEIGHT = 26;

const instancedMeshes = [];
for(let i=0;i<4;i++){
  instancedMeshes[i] = new THREE.InstancedMesh(blockGeometry, materials[i], WORLD_WIDTH*WORLD_DEPTH*WORLD_HEIGHT);
  instancedMeshes[i].count = 0;
  scene.add(instancedMeshes[i]);
}

const blocks = [];

function generateWorld(){
  let counts = [0,0,0,0];
  for(let y=0;y>-WORLD_HEIGHT;y--){
    for(let x=0;x<WORLD_WIDTH;x++){
      for(let z=0;z<WORLD_DEPTH;z++){
        let matIndex;
        if(y===0) matIndex=0;
        else if(y>=-4) matIndex=1;
        else if(y>=-15) matIndex=2;
        else matIndex=3;

        const dummy = new THREE.Object3D();
        dummy.position.set(x,y,z);
        dummy.updateMatrix();
        const idx = counts[matIndex];
        instancedMeshes[matIndex].setMatrixAt(idx,dummy.matrix);
        counts[matIndex]++;

        blocks.push({position:new THREE.Vector3(x,y,z), matIndex});
      }
    }
  }

  for(let i=0;i<4;i++){
    instancedMeshes[i].count = counts[i];
    instancedMeshes[i].instanceMatrix.needsUpdate = true;
  }
}

generateWorld();

// ==============================
// HIGHLIGHT DU BLOC
// ==============================

const highlightMaterial = new THREE.MeshBasicMaterial({color:0xffff00, wireframe:true});
const highlightMesh = new THREE.Mesh(blockGeometry, highlightMaterial);
highlightMesh.visible = false;
scene.add(highlightMesh);

// ==============================
// POSE / CASSE BLOCS
// ==============================

function modifyBlock(globalX, globalY, globalZ, action){
  if(action==='remove'){
    const index = blocks.findIndex(b=>b.position.x===globalX && b.position.y===globalY && b.position.z===globalZ);
    if(index!==-1){
      blocks.splice(index,1);
      updateInstancedMeshes();
    }
  } else if(action==='add'){
    const matIndex = globalY===0 ? 0 : globalY>=-4 ? 1 : globalY>=-15 ? 2 : 3;
    blocks.push({position:new THREE.Vector3(globalX,globalY,globalZ), matIndex});
    updateInstancedMeshes();
  }
}

function updateInstancedMeshes(){
  let counts = [0,0,0,0];
  for(let i=0;i<4;i++) instancedMeshes[i].count = 0;

  for(let b of blocks){
    const dummy = new THREE.Object3D();
    dummy.position.copy(b.position);
    dummy.updateMatrix();
    const idx = counts[b.matIndex];
    instancedMeshes[b.matIndex].setMatrixAt(idx,dummy.matrix);
    counts[b.matIndex]++;
  }

  for(let i=0;i<4;i++){
    instancedMeshes[i].count = counts[i];
    instancedMeshes[i].instanceMatrix.needsUpdate = true;
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

function animate(){
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

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
  for(let b of blocks){
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

  // --- Highlight bloc ciblé ---
  if(isLocked){
    const raycaster = new THREE.Raycaster();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    raycaster.set(camera.getWorldPosition(new THREE.Vector3()), dir);

    let closest=null;
    let minDist=Infinity;
    let intersectionPoint = null;

    for(let b of blocks){
      const box = new THREE.Box3().setFromCenterAndSize(b.position.clone(), new THREE.Vector3(1,1,1));
      const intersect = raycaster.ray.intersectBox(box, new THREE.Vector3());
      if(intersect){
        const dist = raycaster.ray.origin.distanceTo(intersect);
        if(dist<minDist){
          minDist = dist;
          closest = b;
          intersectionPoint = intersect;
        }
      }
    }

    if(closest && minDist<5){
      highlightMesh.position.copy(closest.position);
      highlightMesh.visible = true;
    } else {
      highlightMesh.visible = false;
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

  for(let b of blocks){
    if(Math.abs(b.position.x-newPos.x)<0.5 &&
       Math.abs(b.position.z-newPos.z)<0.5 &&
       Math.abs(b.position.y-player.position.y)<PLAYER_HEIGHT) return {deltaX:0, deltaZ:0};
  }
  return {deltaX, deltaZ};
}

// ==============================
// POSE / CASSE BLOCS PRECIS
// ==============================

document.addEventListener('mousedown', e=>{
  if(!isLocked) return;

  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), dir);

  let closest = null;
  let minDist = Infinity;
  let hitFace = null;

  for(let b of blocks){
    const box = new THREE.Box3().setFromCenterAndSize(b.position.clone(), new THREE.Vector3(1,1,1));
    const intersection = raycaster.ray.intersectBox(box, new THREE.Vector3());
    if(intersection){
      const dist = raycaster.ray.origin.distanceTo(intersection);
      if(dist<minDist){
        minDist = dist;
        closest = b;
        const localPoint = intersection.clone().sub(b.position);
        if(Math.abs(localPoint.x-0.5)<0.01) hitFace='right';
        else if(Math.abs(localPoint.x+0.5)<0.01) hitFace='left';
        else if(Math.abs(localPoint.y-0.5)<0.01) hitFace='top';
        else if(Math.abs(localPoint.y+0.5)<0.01) hitFace='bottom';
        else if(Math.abs(localPoint.z-0.5)<0.01) hitFace='front';
        else if(Math.abs(localPoint.z+0.5)<0.01) hitFace='back';
      }
    }
  }

  if(!closest) return;

  if(e.button===0) modifyBlock(closest.position.x, closest.position.y, closest.position.z, 'remove'); // gauche = casse
  else if(e.button===2){ // droite = pose
    const pos = closest.position.clone();
    switch(hitFace){
      case 'top': pos.y+=1; break;
      case 'bottom': pos.y-=1; break;
      case 'left': pos.x-=1; break;
      case 'right': pos.x+=1; break;
      case 'front': pos.z+=1; break;
      case 'back': pos.z-=1; break;
    }
    if(!blocks.some(b=>b.position.equals(pos))){
      modifyBlock(pos.x,pos.y,pos.z,'add');
    }
  }
});

document.addEventListener('contextmenu', e=>e.preventDefault());

// ... (initialisation scène, camera, renderer, player, lumières, textures, blocks, instancedMeshes comme avant)

// ==============================
// RAYCASTING PRÉCIS
// ==============================

document.addEventListener('mousedown', e=>{
  if(!isLocked) return;

  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), dir);

  // On crée des objets THREE.Box3 pour chaque bloc pour le raycast
  const candidates = blocks.map(b=>{
    const box = new THREE.Box3().setFromCenterAndSize(b.position.clone(), new THREE.Vector3(1,1,1));
    return {block:b, box};
  });

  let closest = null;
  let minDist = Infinity;
  let hitFace = null;

  for(let c of candidates){
    const intersection = raycaster.ray.intersectBox(c.box, new THREE.Vector3());
    if(intersection){
      const dist = raycaster.ray.origin.distanceTo(intersection);
      if(dist<minDist){
        minDist = dist;
        closest = c.block;

        // déterminer la face touchée
        const localPoint = intersection.clone().sub(c.block.position);
        // x-axis
        if(Math.abs(localPoint.x-0.5)<0.01) hitFace='right';
        else if(Math.abs(localPoint.x+0.5)<0.01) hitFace='left';
        // y-axis
        else if(Math.abs(localPoint.y-0.5)<0.01) hitFace='top';
        else if(Math.abs(localPoint.y+0.5)<0.01) hitFace='bottom';
        // z-axis
        else if(Math.abs(localPoint.z-0.5)<0.01) hitFace='front';
        else if(Math.abs(localPoint.z+0.5)<0.01) hitFace='back';
      }
    }
  }

  if(!closest) return;

  if(e.button===0){ // gauche = casse
    modifyBlock(closest.position.x, closest.position.y, closest.position.z, 'remove');
  } else if(e.button===2){ // droite = pose
    const pos = closest.position.clone();
    // ajuster selon la face touchée
    switch(hitFace){
      case 'top': pos.y += 1; break;
      case 'bottom': pos.y -= 1; break;
      case 'left': pos.x -= 1; break;
      case 'right': pos.x += 1; break;
      case 'front': pos.z += 1; break;
      case 'back': pos.z -= 1; break;
    }
    // vérifier qu'il n'y a pas déjà un bloc ici
    if(!blocks.some(b=>b.position.equals(pos))){
      modifyBlock(pos.x,pos.y,pos.z,'add');
    }
  }
});

document.addEventListener('contextmenu', e=>e.preventDefault());

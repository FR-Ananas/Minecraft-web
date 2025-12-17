const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // ciel bleu

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const textureLoader = new THREE.TextureLoader();
const blockTexture = textureLoader.load('texture.png');

blockTexture.magFilter = THREE.NearestFilter;
blockTexture.minFilter = THREE.NearestFilter;

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

const blockMaterial = new THREE.MeshStandardMaterial({
  map: blockTexture
});

const WORLD_SIZE = 20;

for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x++) {
  for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z++) {
    const block = new THREE.Mesh(blockGeometry, blockMaterial);
    block.position.set(x, 0, z);
    scene.add(block);
  }
}

camera.position.set(0, 2, 5);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();

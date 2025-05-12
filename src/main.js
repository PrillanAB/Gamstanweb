import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { Color } from "three";

// Create scene
const scene = new THREE.Scene();

// Default camera (will be replaced by GLB camera)
let camera = new THREE.PerspectiveCamera(
  115,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 2, 5);

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Enable shadows in the renderer
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Add lighting
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(7, 2, 5);
light.castShadow = true;
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 2.5)); // Ambient lighting

// Load EXR environment map with reflections and background
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const exrLoader = new EXRLoader();
exrLoader.load("textures/exr/clearsky.exr", (texture) => {
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap; // Set environment for reflections
  scene.background = envMap; // Set EXR as background
  texture.dispose(); // Clean up memory
  pmremGenerator.dispose();
});

// Load main model ------------------------------------------------------------------Axel bara mesh
const loader = new GLTFLoader();
loader.load(
  "models/gamstan12.glb",
  (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
    scene.add(model);
  },
  (xhr) =>
    console.log(`Loading: ${Math.round((xhr.loaded / xhr.total) * 100)}%`),
  (error) => console.error("Error loading model", error),
);

// Setup Post-Processing
const composer = new EffectComposer(renderer);
let renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.85,
);
bloomPass.threshold = 1.2;
bloomPass.strength = 0.5;
bloomPass.radius = 0.8;

composer.addPass(renderScene);
composer.addPass(bloomPass);

// Animation handling
let mixer = null;
let action = null;
let animationDuration = 0;
let scrollProgress = 0; // Scroll position mapped to animation progress

// Expose animation progress globally for UI
window.animationProgress = 0;

// Function to update animation progress
window.updateAnimationProgress = function(newProgress) {
    scrollProgress = Math.max(0, Math.min(newProgress, 1));
    
    if (mixer && action) {
        action.time = scrollProgress * animationDuration;
        mixer.update(0);
        window.animationProgress = scrollProgress;
    }
};

// Handle mouse scroll to control animation progress
document.addEventListener("wheel", (event) => {
    const direction = Math.sign(event.deltaY);
    const newProgress = scrollProgress + direction * 0.001; // Adjust scroll sensitivity
    window.updateAnimationProgress(newProgress);
});

// Load GLB camera model with animation ------------------------ BARA CAMERA Animation INGET ANNAT!!!!!
loader.load("models/gamcamera6.glb", (gltf) => {
  if (gltf.cameras.length > 0) {
    camera = gltf.cameras[0]; // Assign the loaded camera
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    composer.setSize(window.innerWidth, window.innerHeight);
    console.log("Using GLB camera");

    // Update RenderPass with the new camera
    renderScene = new RenderPass(scene, camera);
    composer.passes[0] = renderScene;
  } else {
    console.warn("No camera found in gamcamera3.glb");
  }

  // Check if there are animations in the model
  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(gltf.scene);
    action = mixer.clipAction(gltf.animations[0]);
    animationDuration = gltf.animations[0].duration; // Get total animation duration
    action.play();
    action.paused = true; // Pause the animation, it will be controlled manually
    console.log(`Animation loaded. Duration: ${animationDuration} seconds`);
  }

  scene.add(gltf.scene);
});

// Handle window resizing
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  composer.render();
}
animate();

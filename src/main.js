import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass";
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

// Create renderer with enhanced antialiasing
const renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  powerPreference: "high-performance",
  stencil: false,
  depth: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
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
exrLoader.load("./textures/exr/clearsky.exr", (texture) => {
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap; // Set environment for reflections
  scene.background = envMap; // Set EXR as background
  texture.dispose(); // Clean up memory
  pmremGenerator.dispose();
});

// Load main model ------------------------------------------------------------------Axel bara mesh
const loader = new GLTFLoader();
loader.load(
  "./models/gamstan19.glb",
  (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
    scene.add(model);
    console.log("Model loaded successfully");
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
  },
  (error) => {
    console.error('An error happened while loading the model:', error);
  }
);

// Setup Post-Processing with enhanced antialiasing
const composer = new EffectComposer(renderer);
let renderScene = new RenderPass(scene, camera);

// Add SMAA antialiasing
const smaaPass = new SMAAPass(
  window.innerWidth * renderer.getPixelRatio(),
  window.innerHeight * renderer.getPixelRatio()
);

// Add bloom effect
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.85,
);
bloomPass.threshold = 1.2;
bloomPass.strength = 0.5;
bloomPass.radius = 0.8;

// Add passes to composer
composer.addPass(renderScene);
composer.addPass(smaaPass); // Add SMAA before bloom
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
loader.load("./models/gamcamera6.glb", (gltf) => {
  if (gltf.cameras.length > 0) {
    camera = gltf.cameras[0]; // Assign the loaded camera
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    composer.setSize(window.innerWidth, window.innerHeight);
    console.log("Using GLB camera");

    // Store the base position and rotation
    const basePosition = new THREE.Vector3();
    const baseRotation = new THREE.Euler();

    // Movement restrictions
    const maxPanAmount = 0.02;
    const maxRotationAmount = 0.01;
    const smoothFactor = 0.08;
    const returnFactor = 0.015;
    const maxPanDistance = 0.03;
    const maxRotationDistance = 0.015;
    let targetPanX = 0;
    let targetPanY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let lastMoveTime = Date.now();
    const inactiveThreshold = 100;

    // Gyroscope variables
    let isGyroAvailable = false;
    let initialGamma = null;
    let initialBeta = null;
    const gyroSensitivity = 0.02; // Adjust this value to control gyro sensitivity

    // Function to handle gyroscope data
    function handleGyro(event) {
      if (!isGyroAvailable) return;

      // Get the current orientation
      const gamma = event.gamma; // Left to right tilt
      const beta = event.beta;   // Front to back tilt

      // Initialize reference values if not set
      if (initialGamma === null || initialBeta === null) {
        initialGamma = gamma;
        initialBeta = beta;
        return;
      }

      // Calculate the difference from initial position
      const deltaGamma = (gamma - initialGamma) * gyroSensitivity;
      const deltaBeta = (beta - initialBeta) * gyroSensitivity;

      // Update target positions
      targetPanX = -deltaGamma * maxPanAmount;
      targetPanY = -deltaBeta * maxPanAmount;
      targetRotX = -deltaBeta * maxRotationAmount;
      targetRotY = -deltaGamma * maxRotationAmount;

      // Clamp the values
      targetPanX = Math.max(-maxPanDistance, Math.min(maxPanDistance, targetPanX));
      targetPanY = Math.max(-maxPanDistance, Math.min(maxPanDistance, targetPanY));
      targetRotX = Math.max(-maxRotationDistance, Math.min(maxRotationDistance, targetRotX));
      targetRotY = Math.max(-maxRotationDistance, Math.min(maxRotationDistance, targetRotY));

      lastMoveTime = Date.now();
    }

    // Request gyroscope permission and setup
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires permission
      document.addEventListener('click', function requestGyro() {
        DeviceOrientationEvent.requestPermission()
          .then(response => {
            if (response === 'granted') {
              isGyroAvailable = true;
              window.addEventListener('deviceorientation', handleGyro);
            }
          })
          .catch(console.error);
        document.removeEventListener('click', requestGyro);
      });
    } else {
      // Android and other devices
      window.addEventListener('deviceorientation', (event) => {
        if (event.gamma !== null && event.beta !== null) {
          isGyroAvailable = true;
          handleGyro(event);
        }
      });
    }

    // Add mouse move event listener for camera panning (desktop only)
    if (!isMobileDevice()) {
      document.addEventListener('mousemove', (event) => {
        // Calculate mouse position relative to center of screen (-1 to 1)
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -((event.clientY / window.innerHeight) * 2 - 1);

        // Apply non-linear scaling for more precise control near center
        const scaledMouseX = Math.sign(mouseX) * Math.pow(Math.abs(mouseX), 1.5);
        const scaledMouseY = Math.sign(mouseY) * Math.pow(Math.abs(mouseY), 1.5);

        // Calculate target positions with reduced sensitivity
        targetPanX = scaledMouseX * maxPanAmount;
        targetPanY = scaledMouseY * maxPanAmount;
        targetRotX = scaledMouseY * maxRotationAmount;
        targetRotY = scaledMouseX * maxRotationAmount;

        // Clamp the values to maximum distances
        targetPanX = Math.max(-maxPanDistance, Math.min(maxPanDistance, targetPanX));
        targetPanY = Math.max(-maxPanDistance, Math.min(maxPanDistance, targetPanY));
        targetRotX = Math.max(-maxRotationDistance, Math.min(maxRotationDistance, targetRotX));
        targetRotY = Math.max(-maxRotationDistance, Math.min(maxRotationDistance, targetRotY));

        lastMoveTime = Date.now();
      });
    }

    // Helper function to detect mobile devices
    function isMobileDevice() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Add animation frame update for smooth movement
    function updateCameraPosition() {
      // Get the current animated position
      basePosition.copy(camera.position);
      baseRotation.copy(camera.rotation);

      // Check if device has been inactive
      const now = Date.now();
      if (now - lastMoveTime > inactiveThreshold) {
        // Gradually return to center
        targetPanX *= (1 - returnFactor);
        targetPanY *= (1 - returnFactor);
        targetRotX *= (1 - returnFactor);
        targetRotY *= (1 - returnFactor);
      }

      // Smoothly interpolate to target positions
      const currentPanX = camera.position.x - basePosition.x;
      const currentPanY = camera.position.y - basePosition.y;
      const currentRotX = camera.rotation.x - baseRotation.x;
      const currentRotY = camera.rotation.y - baseRotation.y;

      // Apply smooth interpolation
      camera.position.x = basePosition.x + currentPanX + (targetPanX - currentPanX) * smoothFactor;
      camera.position.y = basePosition.y + currentPanY + (targetPanY - currentPanY) * smoothFactor;
      camera.rotation.x = baseRotation.x + currentRotX + (targetRotX - currentRotX) * smoothFactor;
      camera.rotation.y = baseRotation.y + currentRotY + (targetRotY - currentRotY) * smoothFactor;

      // Update the camera
      camera.updateProjectionMatrix();

      // Continue the animation loop
      requestAnimationFrame(updateCameraPosition);
    }

    // Start the smooth movement update
    updateCameraPosition();

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

// Handle window resizing with proper antialiasing
window.addEventListener("resize", () => {
  // Update camera
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Update composer
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.passes.forEach(pass => {
    if (pass.setSize) {
      pass.setSize(window.innerWidth, window.innerHeight);
    }
  });
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  composer.render(); // Use composer instead of renderer
}
animate();

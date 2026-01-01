import * as THREE from 'three';
import { CAMERA, COLORS, DEBUG } from '../config/constants';

/**
 * Renderer manager with WebGPU support and WebGL fallback
 */
export class Renderer {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  private container: HTMLElement;
  private statsElement: HTMLElement | null = null;
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.BACKGROUND);
    this.scene.fog = new THREE.Fog(COLORS.BACKGROUND, 50, 150);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      CAMERA.NEAR,
      CAMERA.FAR
    );
    this.camera.position.set(
      CAMERA.OFFSET.x,
      CAMERA.OFFSET.y,
      CAMERA.OFFSET.z
    );

    // Create renderer - try WebGPU first, fallback to WebGL
    this.renderer = this.createRenderer();

    // Setup lighting
    this.setupLighting();

    // Handle resize
    window.addEventListener('resize', this.onResize);

    // Setup FPS counter if debug enabled
    if (DEBUG.SHOW_FPS) {
      this.setupFpsCounter();
    }
  }

  private createRenderer(): THREE.WebGLRenderer {
    // For now, use WebGLRenderer as WebGPURenderer requires additional setup
    // WebGPU support can be added when Three.js r182 WebGPURenderer is more stable
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    this.container.appendChild(renderer.domElement);

    // Check WebGPU availability and log status
    if ('gpu' in navigator) {
      console.log('WebGPU is available. Using WebGL for stability.');
    } else {
      console.log('WebGPU not available. Using WebGL renderer.');
    }

    return renderer;
  }

  private setupLighting(): void {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(
      COLORS.AMBIENT_LIGHT,
      0.6
    );
    this.scene.add(ambientLight);

    // Main directional light (sun)
    const directionalLight = new THREE.DirectionalLight(
      COLORS.DIRECTIONAL_LIGHT,
      1.0
    );
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;

    // Shadow settings
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.bias = -0.0001;

    this.scene.add(directionalLight);

    // Hemisphere light for natural ambient
    const hemisphereLight = new THREE.HemisphereLight(
      0x88aaff, // sky color
      0x444422, // ground color
      0.3
    );
    this.scene.add(hemisphereLight);
  }

  private setupFpsCounter(): void {
    this.statsElement = document.createElement('div');
    this.statsElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #0f0;
      padding: 5px 10px;
      font-family: monospace;
      font-size: 14px;
      z-index: 1000;
      border-radius: 4px;
    `;
    this.statsElement.textContent = 'FPS: --';
    document.body.appendChild(this.statsElement);
  }

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  public render(): void {
    this.renderer.render(this.scene, this.camera);

    // Update FPS counter
    if (this.statsElement) {
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsUpdate >= 1000) {
        this.currentFps = Math.round(
          (this.frameCount * 1000) / (now - this.lastFpsUpdate)
        );
        this.statsElement.textContent = `FPS: ${this.currentFps}`;
        this.frameCount = 0;
        this.lastFpsUpdate = now;
      }
    }
  }

  public add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  public remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  public getFps(): number {
    return this.currentFps;
  }

  public toggleFps(show: boolean): void {
    if (this.statsElement) {
      this.statsElement.style.display = show ? 'block' : 'none';
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize);

    if (this.statsElement) {
      this.statsElement.remove();
    }

    this.renderer.dispose();

    // Dispose all scene objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}

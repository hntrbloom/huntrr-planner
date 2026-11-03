import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Model3DDimensions } from '../../types';

export type CameraPreset = 'reset' | 'fit' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export type CameraProjection = 'perspective' | 'orthographic';

export interface STL3DCanvasProps {
  stlData: ArrayBuffer | null;
  modelColor: string;
  backgroundColor: string;
  wireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
  projection: CameraProjection;
  onModelLoaded?: (info: {
    dimensions: Model3DDimensions;
    triangleCount: number;
    volume: number; // approximate cubic mm
  }) => void;
  onError?: (errMessage: string) => void;
}

export interface STL3DCanvasHandle {
  setCameraPreset: (preset: CameraPreset) => void;
  captureSnapshot: () => string | null;
  resetControls: () => void;
}

export const STL3DCanvas = forwardRef<STL3DCanvasHandle, STL3DCanvasProps>(({
  stlData,
  modelColor,
  backgroundColor,
  wireframe,
  showGrid,
  showAxes,
  projection,
  onModelLoaded,
  onError,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const modelBoundsRef = useRef<{
    center: THREE.Vector3;
    size: THREE.Vector3;
    maxDim: number;
  }>({
    center: new THREE.Vector3(0, 0, 0),
    size: new THREE.Vector3(50, 50, 50),
    maxDim: 50,
  });

  const [isLoadingSTL, setIsLoadingSTL] = useState(false);

  // Expose camera presets and snapshot capturing to parent
  useImperativeHandle(ref, () => ({
    setCameraPreset: (preset: CameraPreset) => {
      applyCameraPreset(preset);
    },
    captureSnapshot: () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return null;

      // Render one high quality frame
      renderer.render(scene, camera);
      try {
        return renderer.domElement.toDataURL('image/png', 0.85);
      } catch (err) {
        console.warn('Failed to capture 3D snapshot:', err);
        return null;
      }
    },
    resetControls: () => {
      applyCameraPreset('reset');
    }
  }));

  const applyCameraPreset = (preset: CameraPreset) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const { center, maxDim } = modelBoundsRef.current;
    const distance = maxDim * 2.2;
    const targetY = center.y;

    controls.target.set(center.x, targetY, center.z);

    switch (preset) {
      case 'front':
        camera.position.set(center.x, targetY, center.z + distance);
        camera.up.set(0, 1, 0);
        break;
      case 'back':
        camera.position.set(center.x, targetY, center.z - distance);
        camera.up.set(0, 1, 0);
        break;
      case 'left':
        camera.position.set(center.x - distance, targetY, center.z);
        camera.up.set(0, 1, 0);
        break;
      case 'right':
        camera.position.set(center.x + distance, targetY, center.z);
        camera.up.set(0, 1, 0);
        break;
      case 'top':
        camera.position.set(center.x, targetY + distance, center.z + 0.0001);
        camera.up.set(0, 0, -1);
        break;
      case 'bottom':
        camera.position.set(center.x, targetY - distance, center.z + 0.0001);
        camera.up.set(0, 0, 1);
        break;
      case 'fit':
        camera.position.set(center.x + distance * 0.7, targetY + distance * 0.6, center.z + distance * 0.7);
        camera.up.set(0, 1, 0);
        break;
      case 'reset':
      default:
        camera.position.set(center.x + distance * 0.8, targetY + distance * 0.7, center.z + distance * 0.8);
        camera.up.set(0, 1, 0);
        break;
    }

    camera.lookAt(controls.target);
    controls.update();

    if (rendererRef.current && sceneRef.current) {
      rendererRef.current.render(sceneRef.current, camera);
    }
  };

  // Initialize Three.js Scene, Camera, Renderer, Controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor || '#FFF0F6');
    sceneRef.current = scene;

    // 2. Camera setup
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const aspect = width / height;

    if (projection === 'orthographic') {
      const frustumSize = 120;
      camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        2000
      );
    } else {
      camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 2000);
    }
    camera.position.set(80, 70, 80);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(new THREE.Color(backgroundColor || '#FFF0F6'), 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 2;
    controls.maxDistance = 1500;
    controls.maxPolarAngle = Math.PI; // Full rotational freedom
    controlsRef.current = controls;

    // 5. Lighting
    const lightsGroup = new THREE.Group();
    
    // Key light
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.6);
    mainLight.position.set(100, 150, 100);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    lightsGroup.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.9);
    fillLight.position.set(-100, 80, -80);
    lightsGroup.add(fillLight);

    // Rim/Back light
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
    rimLight.position.set(0, 120, -120);
    lightsGroup.add(rimLight);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    lightsGroup.add(ambientLight);

    // Hemisphere light for natural gradients
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 0.45);
    lightsGroup.add(hemiLight);

    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;

    // 6. Build plate grid helper (subtle 3D printer bed with dark gray lines #555555 and #777777)
    const gridSize = 250;
    const gridDivisions = 50; // 5mm squares
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x555555, 0x777777);
    gridHelper.position.y = 0;
    gridHelper.visible = showGrid;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // 7. Axes helper
    const axesHelper = new THREE.AxesHelper(30);
    axesHelper.position.set(0, 0.1, 0);
    axesHelper.visible = showAxes;
    scene.add(axesHelper);
    axesHelperRef.current = axesHelper;

    // 8. Animation loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. ResizeObserver for responsive fluid canvas
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0 && rendererRef.current && cameraRef.current) {
          rendererRef.current.setSize(newWidth, newHeight);
          const newAspect = newWidth / newHeight;
          if ('aspect' in cameraRef.current) {
            cameraRef.current.aspect = newAspect;
            cameraRef.current.updateProjectionMatrix();
          } else {
            const frustumSize = 120;
            cameraRef.current.left = (frustumSize * newAspect) / -2;
            cameraRef.current.right = (frustumSize * newAspect) / 2;
            cameraRef.current.top = frustumSize / 2;
            cameraRef.current.bottom = frustumSize / -2;
            cameraRef.current.updateProjectionMatrix();
          }
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [projection]);

  // Update background color
  useEffect(() => {
    const color = new THREE.Color(backgroundColor || '#FFF0F6');
    if (sceneRef.current) {
      sceneRef.current.background = color;
    }
    if (rendererRef.current) {
      rendererRef.current.setClearColor(color, 1);
    }
  }, [backgroundColor]);

  // Update Grid visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Update Axes visibility
  useEffect(() => {
    if (axesHelperRef.current) {
      axesHelperRef.current.visible = showAxes;
    }
  }, [showAxes]);

  // Update material color and wireframe
  useEffect(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.color = new THREE.Color(modelColor);
        mat.wireframe = wireframe;
        mat.needsUpdate = true;
      }
    }
  }, [modelColor, wireframe]);

  // Load and Parse STL Data
  useEffect(() => {
    if (!stlData || stlData.byteLength === 0) {
      // Clear previous mesh if any
      if (meshRef.current && sceneRef.current) {
        sceneRef.current.remove(meshRef.current);
        if (meshRef.current.geometry) meshRef.current.geometry.dispose();
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach((m) => m.dispose());
        } else if (meshRef.current.material) {
          meshRef.current.material.dispose();
        }
        meshRef.current = null;
      }
      return;
    }

    setIsLoadingSTL(true);

    try {
      const loader = new STLLoader();
      const geometry = loader.parse(stlData);

      // Clean up previous mesh
      if (meshRef.current && sceneRef.current) {
        sceneRef.current.remove(meshRef.current);
        if (meshRef.current.geometry) meshRef.current.geometry.dispose();
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach((m) => m.dispose());
        } else if (meshRef.current.material) {
          meshRef.current.material.dispose();
        }
        meshRef.current = null;
      }

      // Automatically correct the model's orientation from STL (Z-up) to Three.js (Y-up)
      // by rotating -90° around the X axis immediately after the STL geometry is parsed
      geometry.rotateX(-Math.PI / 2);

      // Ensure vertex normals exist for smooth lighting
      geometry.computeVertexNormals();

      // Compute bounding box after orientation conversion
      geometry.computeBoundingBox();
      const box = geometry.boundingBox || new THREE.Box3();
      
      const width = Math.max(0.01, box.max.x - box.min.x);
      const height = Math.max(0.01, box.max.y - box.min.y);
      const depth = Math.max(0.01, box.max.z - box.min.z);

      // Recenter horizontally (X, Z) and position vertically so lowest point rests exactly on grid floor (Y = 0)
      const centerX = (box.min.x + box.max.x) / 2;
      const minElevation = box.min.y;
      const centerZ = (box.min.z + box.max.z) / 2;

      geometry.translate(-centerX, -minElevation, -centerZ);

      // Recompute bounding box after centering and resting on floor
      geometry.computeBoundingBox();

      // Triangle count
      const count = geometry.attributes.position ? geometry.attributes.position.count : 0;
      const triangleCount = Math.floor(count / 3);

      // Material
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(modelColor),
        roughness: 0.35,
        metalness: 0.1,
        wireframe: wireframe,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (sceneRef.current) {
        sceneRef.current.add(mesh);
      }

      meshRef.current = mesh;
      geometryRef.current = geometry;

      // Calculate bounds for camera framing
      const maxDim = Math.max(width, height, depth, 10);
      modelBoundsRef.current = {
        center: new THREE.Vector3(0, height / 2, 0),
        size: new THREE.Vector3(width, height, depth),
        maxDim,
      };

      // Auto-fit camera to model
      applyCameraPreset('reset');

      setIsLoadingSTL(false);

      if (onModelLoaded) {
        onModelLoaded({
          dimensions: {
            x: Math.round(width * 10) / 10,
            y: Math.round(height * 10) / 10,
            z: Math.round(depth * 10) / 10,
          },
          triangleCount,
          volume: Math.round(width * height * depth),
        });
      }
    } catch (err: any) {
      console.error('STLLoader parse error:', err);
      setIsLoadingSTL(false);
      if (onError) {
        onError(err?.message || 'Failed to parse STL file. Please verify it is a valid binary or ASCII STL.');
      }
    }
  }, [stlData]);

  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden select-none touch-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {isLoadingSTL && (
        <div className="absolute inset-0 bg-[#FFF0F6]/85 backdrop-blur-xs flex flex-col items-center justify-center text-[#222222] z-20">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-[14px] font-semibold tracking-wide text-[#333333]">Processing 3D Geometry...</p>
        </div>
      )}
    </div>
  );
});

STL3DCanvas.displayName = 'STL3DCanvas';

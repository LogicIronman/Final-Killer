import { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  varying vec3 vColor;

  void main() {
    vec3 animatedPosition = position;
    animatedPosition.x += sin(uTime * 0.22 + aPhase) * 0.075;
    animatedPosition.y += cos(uTime * 0.18 + aPhase * 1.37) * 0.075;

    vec4 viewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * uPixelRatio * (220.0 / -viewPosition.z);
    vColor = color;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float softCircle = 1.0 - smoothstep(0.18, 0.5, distanceToCenter);
    float brightCore = 1.0 - smoothstep(0.0, 0.16, distanceToCenter);
    float alpha = (softCircle * 0.76 + brightCore * 0.24) * uOpacity;

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

function createSeededRandom(seed = 20260618) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export default function ParticlesBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 30);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power"
    });
    renderer.setClearColor(0x1a1a1a, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const isCompact = container.clientWidth < 768;
    const particleCount = isCompact ? 760 : 1450;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const random = createSeededRandom();
    const palette = [
      new THREE.Color("#ffffff"),
      new THREE.Color("#c9e0fc"),
      new THREE.Color("#6ea8ff"),
      new THREE.Color("#024ad8")
    ];

    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * 3;
      const depth = random();
      const spread = 3.8 + depth * 2.8;
      positions[offset] = (random() - 0.5) * spread * 2;
      positions[offset + 1] = (random() - 0.5) * spread * 1.45;
      positions[offset + 2] = 1.2 - depth * 6.5;

      const colorPick = random();
      const color = colorPick > 0.86 ? palette[0] : colorPick > 0.56 ? palette[1] : colorPick > 0.2 ? palette[2] : palette[3];
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;

      const rareLargeParticle = random() > 0.94;
      sizes[index] = rareLargeParticle ? 0.105 + random() * 0.07 : 0.027 + random() * 0.045;
      phases[index] = random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uOpacity: { value: 0.92 }
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(geometry, material);
    particles.rotation.x = -0.05;
    scene.add(particles);

    const pointer = new THREE.Vector2();
    const target = new THREE.Vector2();
    const interactionSurface = container.parentElement ?? container;
    const onPointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      target.x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2;
      target.y = -(((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2);
    };
    const onPointerLeave = () => target.set(0, 0);
    interactionSurface.addEventListener("pointermove", onPointerMove, { passive: true });
    interactionSurface.addEventListener("pointerleave", onPointerLeave);

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(width, height, false);
      if (reducedMotion) renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const clock = new THREE.Clock();
    let animationFrame = 0;
    let isVisible = true;
    let isDocumentVisible = document.visibilityState === "visible";

    const scheduleRender = () => {
      if (!reducedMotion && isVisible && isDocumentVisible && animationFrame === 0) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    const render = () => {
      const elapsed = clock.getElapsedTime();
      uniforms.uTime.value = elapsed;

      if (!reducedMotion) {
        pointer.lerp(target, 0.035);
        particles.rotation.y = elapsed * 0.012 + pointer.x * 0.045;
        particles.rotation.x = -0.05 + pointer.y * 0.028;
        particles.position.x += (pointer.x * 0.13 - particles.position.x) * 0.035;
        particles.position.y += (pointer.y * 0.09 - particles.position.y) * 0.035;
      }

      renderer.render(scene, camera);
      animationFrame = 0;
      scheduleRender();
    };
    render();

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (!isVisible) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else {
        scheduleRender();
      }
    });
    intersectionObserver.observe(container);

    const onVisibilityChange = () => {
      isDocumentVisible = document.visibilityState === "visible";
      if (!isDocumentVisible) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else {
        scheduleRender();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      interactionSurface.removeEventListener("pointermove", onPointerMove);
      interactionSurface.removeEventListener("pointerleave", onPointerLeave);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
}

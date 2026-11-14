import React, { useEffect, useRef } from "react";

// 9x9 pseudo-QR: three solid corner squares plus a fixed scatter, so it renders the same every time.
const CELLS = (() => {
  const cells = [];
  let s = 7;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      s = (s * 37 + 11) % 101;
      const finder = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
      cells.push(finder || s % 3 !== 0);
    }
  }
  return cells;
})();

export default function AuthStage() {
  const sceneRef = useRef(null);

  useEffect(() => {
    const THREE = window.THREE;
    const host = sceneRef.current;
    if (!THREE || !host) return undefined;

    let renderer;
    let frameId;
    let observer;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    const geometries = [];
    const materials = [];

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0.2, 8.5);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = "auth-three-canvas";
      host.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xb9adff, 1.6));
      const violetLight = new THREE.PointLight(0x8b70ff, 42, 18);
      violetLight.position.set(-3, 3, 4);
      scene.add(violetLight);
      const goldLight = new THREE.PointLight(0xffcf73, 32, 16);
      goldLight.position.set(4, -1, 2);
      scene.add(goldLight);

      const addMesh = (geometry, material) => {
        geometries.push(geometry);
        materials.push(material);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        return mesh;
      };

      const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0xc5b5ff, metalness: 0.92, roughness: 0.2,
        emissive: 0x5c3dc4, emissiveIntensity: 0.7,
      });
      const ring = addMesh(new THREE.TorusGeometry(1.45, 0.035, 16, 100), ringMaterial);
      ring.position.set(2.15, 0.05, -0.8);
      ring.rotation.set(0.9, 0.2, -0.35);

      const secondRing = addMesh(
        new THREE.TorusGeometry(1.02, 0.018, 12, 90),
        new THREE.MeshStandardMaterial({ color: 0xffd58a, metalness: 0.9, roughness: 0.22, emissive: 0x7a5420, emissiveIntensity: 0.55 })
      );
      secondRing.position.set(2.15, 0.05, -0.7);
      secondRing.rotation.set(1.2, -0.35, 0.2);

      const orb = addMesh(
        new THREE.IcosahedronGeometry(0.56, 2),
        new THREE.MeshStandardMaterial({ color: 0x8870dd, metalness: 0.82, roughness: 0.19, emissive: 0x30205f, emissiveIntensity: 0.8 })
      );
      orb.position.set(2.12, 0.05, 0.05);

      const particles = [];
      const particleGeometry = new THREE.SphereGeometry(0.035, 10, 10);
      for (let i = 0; i < 34; i++) {
        const material = new THREE.MeshBasicMaterial({ color: i % 5 === 0 ? 0xffd58a : 0xc4b5ff, transparent: true, opacity: 0.35 + (i % 4) * 0.12 });
        materials.push(material);
        const particle = new THREE.Mesh(particleGeometry, material);
        particle.position.set((Math.sin(i * 12.3) * 2.5) + 1.5, Math.cos(i * 7.1) * 1.55, -1.5 + Math.sin(i) * 0.8);
        particle.userData = { phase: i * 0.7, radius: 0.08 + (i % 5) * 0.025 };
        scene.add(particle);
        particles.push(particle);
      }
      geometries.push(particleGeometry);

      const resize = () => {
        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(host);

      const onPointerMove = (event) => {
        const rect = host.getBoundingClientRect();
        targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.45;
        targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.3;
      };
      const onPointerLeave = () => { targetX = 0; targetY = 0; };
      host.addEventListener("pointermove", onPointerMove, { passive: true });
      host.addEventListener("pointerleave", onPointerLeave);

      const clock = new THREE.Clock();
      const render = () => {
        const time = clock.getElapsedTime();
        pointerX += (targetX - pointerX) * 0.035;
        pointerY += (targetY - pointerY) * 0.035;
        camera.position.x = pointerX;
        camera.position.y = 0.2 - pointerY;
        camera.lookAt(0, 0, 0);
        ring.rotation.y = 0.2 + time * 0.16;
        ring.rotation.x = 0.9 + Math.sin(time * 0.35) * 0.08;
        secondRing.rotation.z = 0.2 + time * 0.22;
        orb.rotation.x = time * 0.22;
        orb.rotation.y = time * 0.32;
        orb.position.y = 0.05 + Math.sin(time * 1.15) * 0.12;
        particles.forEach((particle) => {
          particle.position.y += Math.sin(time * 0.75 + particle.userData.phase) * 0.0009;
          particle.position.x += Math.cos(time * 0.55 + particle.userData.phase) * 0.0007;
        });
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(render);
      };
      render();

      return () => {
        cancelAnimationFrame(frameId);
        observer?.disconnect();
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer?.dispose();
        renderer?.domElement?.remove();
      };
    } catch (error) {
      console.warn("3D registration artwork could not be initialized:", error);
      renderer?.dispose();
      renderer?.domElement?.remove();
      return undefined;
    }
  }, []);

  return (
    <aside className="auth-stage" aria-hidden="true">
      <div className="auth-three-wrap" ref={sceneRef} />
      <div className="auth-marquee">
        {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--n": i }} />)}
      </div>

      <div className="auth-copy">
        <p className="auth-brand"><span className="auth-mark">G</span>gather.</p>
        <h2>Plan it. Sell it. Scan them in.</h2>
        <p>Create events, take bookings and check guests in at the gate with a QR code.</p>
      </div>

      <div className="auth-ticket-slot">
        <div className="auth-ticket">
          <div className="auth-ticket-main">
            <small>Admit one</small>
            <strong>Product Summit 2026</strong>
            <span>Sat, 14 Dec at 6:30 PM</span>
            <span>Main hall</span>
          </div>
          <div className="auth-ticket-stub">
            <div className="auth-qr">
              {CELLS.map((on, i) => <b key={i} className={on ? "on" : ""} />)}
              <span className="auth-scan" />
            </div>
            <em className="auth-ok">Checked in</em>
          </div>
        </div>
      </div>
    </aside>
  );
}

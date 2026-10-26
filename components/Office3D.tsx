"use client";
import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export interface Agent3D { id: string; name: string; emoji: string; role: string; color: string; state: string; current: string; }

// ---------- layout ----------
const DESKS: Record<string, [number, number]> = {
  yuki: [-6, -4], luna: [-3, -4], mochi: [0, -4], neko: [3, -4], miso: [6, -4],
};
const SPOTS = {
  coffee: new THREE.Vector3(6.6, 0, 3.4),
  sofa: new THREE.Vector3(-6.2, 0, 3.6),
  bed: new THREE.Vector3(5.6, 0, 0.6),
  rug: new THREE.Vector3(0, 0, 1.2),
  plant: new THREE.Vector3(-6.8, 0, -0.6),
  board: new THREE.Vector3(7.2, 0, -2.2),
};
const BUSY = new Set(["THINKING", "PLANNING", "WORKING", "WAITING_FOR_TOOL", "REVIEWING"]);

type Mode = "sit" | "work" | "walk" | "sleep" | "coffee" | "alarm" | "happy" | "stuck";

function activityFor(state: string): Mode | null {
  if (BUSY.has(state)) return state === "THINKING" || state === "PLANNING" ? "sit" : "work";
  if (state === "WAITING_FOR_USER") return "alarm";
  if (state === "ERROR") return "stuck";
  if (state === "COMPLETED") return "happy";
  return null; // IDLE → ambient brain decides
}

// ---------- cute low-poly cat ----------
function Cat({ def, desk }: { def: Agent3D; desk: [number, number] }) {
  const g = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Mesh>(null);
  const [bubble, setBubble] = useState("🐾");
  const brain = useRef({
    pos: new THREE.Vector3(desk[0], 0, desk[1] + 1.2),
    target: new THREE.Vector3(desk[0], 0, desk[1] + 1.2),
    mode: "sit" as Mode, timer: 3 + Math.random() * 5, t: Math.random() * 10,
    lastBubble: "",
  });

  const fur = useMemo(() => new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 }), [def.color]);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4A3F35", roughness: 0.6 }), []);

  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const b = brain.current;
    b.t += rawDt;
    const forced = activityFor(def.state);

    if (forced) {
      if (forced !== b.mode || (forced === "sit" || forced === "work")) {
        b.mode = forced;
        b.target.set(desk[0], 0, desk[1] + 1.2);
      }
      b.timer = 3;
    } else {
      // IDLE ambient brain: wander, coffee, nap, back to desk
      b.timer -= dt;
      if (b.mode === "walk" && b.pos.distanceTo(b.target) < 0.25) {
        b.timer = b.timer <= 0 ? 4 + Math.random() * 6 : b.timer;
        if (b.mode === "walk") b.mode = b.target.distanceTo(SPOTS.bed) < 0.3 ? "sleep" : b.target.distanceTo(SPOTS.coffee) < 0.3 ? "coffee" : "sit";
        b.timer = 4 + Math.random() * 6;
      }
      if (b.timer <= 0 && b.mode !== "walk") {
        const roll = Math.random();
        if (roll < 0.3) { b.target.copy(SPOTS.bed); b.mode = "walk"; }
        else if (roll < 0.5) { b.target.copy(SPOTS.coffee); b.mode = "walk"; }
        else if (roll < 0.75) {
          b.target.set(-5 + Math.random() * 10, 0, -1 + Math.random() * 4); b.mode = "walk";
        } else { b.target.set(desk[0], 0, desk[1] + 1.2); b.mode = b.target.distanceTo(b.pos) > 0.4 ? "walk" : "sit"; }
        b.timer = 20;
      }
      if (b.mode === "happy") { b.timer -= dt; if (b.timer <= -2) { b.mode = "sit"; b.target.set(desk[0], 0, desk[1] + 1.2); } }
    }

    // locomotion
    const walking = b.mode === "walk" && b.pos.distanceTo(b.target) > 0.15;
    if (walking) {
      const dir = b.target.clone().sub(b.pos).setY(0).normalize();
      b.pos.addScaledVector(dir, 1.6 * dt);
      if (g.current) g.current.rotation.y = Math.atan2(dir.x, dir.z);
    } else if (b.mode === "sit" || b.mode === "work" || b.mode === "alarm" || b.mode === "happy" || b.mode === "stuck") {
      // face desk (north) when working
      const wantDesk = b.mode === "work" || b.mode === "sit";
      if (wantDesk && g.current) {
        const cur = g.current.rotation.y; let want = Math.PI;
        g.current.rotation.y = cur + (((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 5);
      }
    }

    // pose + animation
    const grp = g.current;
    if (grp) {
      grp.position.copy(b.pos);
      const t = b.t;
      if (walking) grp.position.y = Math.abs(Math.sin(t * 9)) * 0.09;
      else if (b.mode === "work") grp.position.y = Math.abs(Math.sin(t * 7)) * 0.035;
      else if (b.mode === "alarm" || b.mode === "happy") grp.position.y = Math.abs(Math.sin(t * 6)) * 0.22;
      else if (b.mode === "sleep") grp.position.y = 0;
      else grp.position.y = Math.sin(t * 1.6) * 0.015;
      if (b.mode === "stuck" && head.current) head.current.rotation.z = Math.sin(t * 10) * 0.12;
      else if (head.current) head.current.rotation.z = def.state === "THINKING" ? 0.18 : Math.sin(t * 0.8) * 0.05;
    }
    if (tail.current) {
      tail.current.rotation.x = 0.7 + Math.sin(b.t * (walking ? 8 : 2.2)) * 0.35;
      tail.current.rotation.z = Math.sin(b.t * 1.7) * 0.25;
    }
    const sleeping = b.mode === "sleep";
    if (body.current) { body.current.scale.y = sleeping ? 0.62 : walking ? 1 : 1.12; body.current.position.y = sleeping ? 0.3 : 0.42; }
    const eyeScale = sleeping ? 0.12 : 1;
    if (eyeL.current) eyeL.current.scale.y = eyeScale;
    if (eyeR.current) eyeR.current.scale.y = eyeScale;

    const nb = sleeping ? "💤 Zzz" : b.mode === "walk"
      ? (b.target.distanceTo(SPOTS.bed) < 0.3 ? "🚶 → kasur" : b.target.distanceTo(SPOTS.coffee) < 0.3 ? "🚶 → kopi ☕" : "🚶 jalan-jalan")
      : b.mode === "coffee" ? "☕ sruput kopi…" : b.mode === "alarm" ? "❗ butuh kamu!" : b.mode === "happy" ? "🎉 beres!" : b.mode === "stuck" ? "❓ stuck…" : b.mode === "work" ? `💻 ${def.current.slice(2, 30)}` : `☕ ${def.current.slice(0, 26)}`;
    if (nb !== b.lastBubble) { b.lastBubble = nb; setBubble(nb); }
  });

  return (
    <group ref={g}>
      {/* body */}
      <mesh ref={body} material={fur} position={[0, 0.42, 0]} castShadow>
        <sphereGeometry args={[0.34, 24, 24]} />
      </mesh>
      {/* head */}
      <group ref={head} position={[0, 0.86, 0.08]}>
        <mesh material={fur} castShadow><sphereGeometry args={[0.27, 24, 24]} /></mesh>
        {/* ears */}
        <mesh material={fur} position={[-0.15, 0.24, 0]} rotation={[0, 0, 0.25]}><coneGeometry args={[0.1, 0.18, 8]} /></mesh>
        <mesh material={fur} position={[0.15, 0.24, 0]} rotation={[0, 0, -0.25]}><coneGeometry args={[0.1, 0.18, 8]} /></mesh>
        {/* eyes */}
        <mesh ref={eyeL} material={dark} position={[-0.1, 0.04, 0.23]}><sphereGeometry args={[0.045, 12, 12]} /></mesh>
        <mesh ref={eyeR} material={dark} position={[0.1, 0.04, 0.23]}><sphereGeometry args={[0.045, 12, 12]} /></mesh>
        {/* nose + blush */}
        <mesh position={[0, -0.05, 0.26]}><sphereGeometry args={[0.028, 8, 8]} /><meshStandardMaterial color="#FF8A7A" /></mesh>
      </group>
      {/* paws */}
      {[[-0.16, 0.1], [0.16, 0.1]].map(([x, z], i) => (
        <mesh key={i} material={fur} position={[x, 0.1, z]} castShadow><sphereGeometry args={[0.1, 12, 12]} /></mesh>
      ))}
      {/* tail */}
      <mesh ref={tail} material={fur} position={[0, 0.45, -0.34]} rotation={[0.7, 0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.085, 0.55, 10]} />
      </mesh>
      {/* name + status bubble */}
      <Html position={[0, 1.45, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 12, padding: "3px 9px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(74,63,53,.15)", color: "#4A3F35" }}>
          {def.name} · {def.role}
          <div style={{ fontWeight: 700, color: "#8A7A6B", fontSize: 10 }}>{bubble}</div>
        </div>
      </Html>
    </group>
  );
}

// ---------- furniture ----------
const wood = "#E8C39E";
const woodDark = "#C99B6D";
function Desk({ x, z, color, active }: { x: number; z: number; color: string; active: boolean }) {
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((st) => {
    if (screen.current) screen.current.emissiveIntensity = active ? 1.4 + Math.sin(st.clock.elapsedTime * 4) * 0.5 : 0.55;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow><boxGeometry args={[1.9, 0.1, 0.9]} /><meshStandardMaterial color={wood} roughness={0.8} /></mesh>
      {[[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.2, lz]}><boxGeometry args={[0.08, 0.4, 0.08]} /><meshStandardMaterial color={woodDark} /></mesh>
      ))}
      {/* monitor */}
      <mesh position={[0, 1.0, -0.15]}><boxGeometry args={[0.85, 0.55, 0.07]} /><meshStandardMaterial color="#4A3F35" /></mesh>
      <mesh position={[0, 1.0, -0.11]}>
        <planeGeometry args={[0.75, 0.45]} />
        <meshStandardMaterial ref={screen} color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.68, -0.15]}><boxGeometry args={[0.12, 0.15, 0.12]} /><meshStandardMaterial color="#4A3F35" /></mesh>
      {/* coffee cup */}
      <mesh position={[0.65, 0.56, 0.15]}><cylinderGeometry args={[0.06, 0.05, 0.12, 12]} /><meshStandardMaterial color="#fff" /></mesh>
      <mesh position={[0.65, 0.63, 0.15]}><cylinderGeometry args={[0.05, 0.05, 0.02, 12]} /><meshStandardMaterial color="#8A5A3B" /></mesh>
      {/* chair */}
      <group position={[0, 0, 1.15]}>
        <mesh position={[0, 0.32, 0]} castShadow><cylinderGeometry args={[0.3, 0.3, 0.09, 16]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
        <mesh position={[0, 0.62, -0.28]}><boxGeometry args={[0.5, 0.5, 0.08]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
        <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.04, 0.04, 0.3, 8]} /><meshStandardMaterial color={woodDark} /></mesh>
      </group>
    </group>
  );
}

function Sofa({ x, z }: { x: number; z: number }) {
  const c = "#FFD9C7";
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[2.0, 0.35, 0.85]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
      <mesh position={[0, 0.62, -0.4]}><boxGeometry args={[2.0, 0.65, 0.2]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
      {[[-0.95], [0.95]].map(([ax], i) => (
        <mesh key={i} position={[ax, 0.55, 0]}><boxGeometry args={[0.18, 0.5, 0.85]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
      ))}
    </group>
  );
}

function Plant({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.22, 0.17, 0.44, 12]} /><meshStandardMaterial color="#D98E73" /></mesh>
      <mesh position={[0, 0.75, 0]} castShadow><sphereGeometry args={[0.34, 14, 14]} /><meshStandardMaterial color="#7FB69E" roughness={0.9} /></mesh>
      <mesh position={[0.18, 0.55, 0.1]}><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color="#93C7AD" roughness={0.9} /></mesh>
    </group>
  );
}

function Bed() {
  return (
    <group position={[SPOTS.bed.x, 0, SPOTS.bed.z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow><cylinderGeometry args={[0.75, 0.8, 0.2, 20]} /><meshStandardMaterial color="#E8DEF8" roughness={0.95} /></mesh>
      <mesh position={[0, 0.2, 0]}><torusGeometry args={[0.62, 0.14, 10, 24]} /><meshStandardMaterial color="#D5C6F5" roughness={0.95} /></mesh>
      <Html position={[0, 0.7, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div style={{ fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,.85)", borderRadius: 10, padding: "2px 8px" }}>😴 sudut tidur</div>
      </Html>
    </group>
  );
}

function CoffeeBar() {
  return (
    <group position={[6.6, 0, 4.4]}>
      <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[1.6, 1.0, 0.7]} /><meshStandardMaterial color="#FFF3E8" roughness={0.85} /></mesh>
      <mesh position={[-0.3, 1.12, 0]} castShadow><boxGeometry args={[0.4, 0.35, 0.4]} /><meshStandardMaterial color="#4A3F35" /></mesh>
      <Html position={[0, 1.7, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div style={{ fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,.85)", borderRadius: 10, padding: "2px 8px" }}>☕ kopi</div>
      </Html>
    </group>
  );
}

const THEMES: Record<string, { floor: string; wall: string; rug: string }> = {
  "Cozy Cafe": { floor: "#F3E4D4", wall: "#FFF6EC", rug: "#FFE9E3" },
  "Night Office": { floor: "#3B3A63", wall: "#2B2A4A", rug: "#4A4980" },
  "Garden Office": { floor: "#DCEFE2", wall: "#EDF7EE", rug: "#D9F2E6" },
  "Cyber Office": { floor: "#DCE7FA", wall: "#EAF2FF", rug: "#E8DEF8" },
};

export function Office3D({ agents, theme }: { agents: Agent3D[]; theme: string }) {
  const t = THEMES[theme] ?? THEMES["Cozy Cafe"];
  const order = ["yuki", "luna", "mochi", "neko", "miso"];
  const sorted = [...agents].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return (
    <div className="rounded-3xl overflow-hidden shadow-soft border border-white/60 relative" style={{ height: 560 }}>
      <Canvas shadows camera={{ position: [9, 9, 11], fov: 42 }} dpr={[1, 1.75]}>
        <ambientLight intensity={0.75} />
        <hemisphereLight args={["#fff5e8", "#d9c7b4", 0.5]} />
        <directionalLight position={[7, 12, 6]} intensity={1.15} castShadow shadow-mapSize={[2048, 2048]} />
        {/* floor + walls */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[17, 13]} /><meshStandardMaterial color={t.floor} roughness={0.95} /></mesh>
        <mesh position={[0, 2, -6.5]} receiveShadow><planeGeometry args={[17, 4]} /><meshStandardMaterial color={t.wall} roughness={1} /></mesh>
        <mesh position={[-8.5, 2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[13, 4]} /><meshStandardMaterial color={t.wall} roughness={1} /></mesh>
        {/* rug */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.2]} receiveShadow>
          <circleGeometry args={[2.6, 40]} /><meshStandardMaterial color={t.rug} roughness={1} />
        </mesh>
        {/* whiteboard */}
        <group position={[7.6, 1.8, -2.2]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh><planeGeometry args={[2.6, 1.5]} /><meshStandardMaterial color="#ffffff" roughness={0.4} /></mesh>
          <Html position={[0, 1.1, 0.05]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#4A3F35", whiteSpace: "nowrap" }}>📋 “Don’t just chat — give work.”</div>
          </Html>
        </group>
        {/* desks */}
        {sorted.map((a) => {
          const d = DESKS[a.id] ?? [0, -4];
          return <Desk key={a.id} x={d[0]} z={d[1]} color={a.color} active={BUSY.has(a.state) || a.state === "THINKING"} />;
        })}
        <Sofa x={SPOTS.sofa.x} z={SPOTS.sofa.z} />
        <CoffeeBar />
        <Bed />
        <Plant x={-7.6} z={-5.6} /><Plant x={7.6} z={5.6} s={1.2} /><Plant x={SPOTS.plant.x} z={SPOTS.plant.z} s={0.9} />
        {/* bookshelf */}
        <group position={[-7.9, 0, 1.5]}>
          <mesh position={[0, 1, 0]} castShadow><boxGeometry args={[0.5, 2, 1.8]} /><meshStandardMaterial color={woodDark} roughness={0.85} /></mesh>
          {[0.6, 1.1, 1.6].map((y, i) => (
            <mesh key={i} position={[0, y, 0]}><boxGeometry args={[0.44, 0.28, 1.6]} /><meshStandardMaterial color={["#FFD1DC", "#DDEBFF", "#FFF3C4"][i]} roughness={0.9} /></mesh>
          ))}
        </group>
        {/* cats */}
        {sorted.map((a) => <Cat key={a.id} def={a} desk={DESKS[a.id] ?? [0, -4]} />)}
        <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={26} maxPolarAngle={Math.PI / 2.4} target={[0, 0.5, 0]} />
      </Canvas>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold bg-white/85 rounded-full px-3 py-1.5 shadow-card">
        🖱️ drag untuk putar · scroll untuk zoom · kucingnya hidup sendiri 🐾
      </div>
    </div>
  );
}

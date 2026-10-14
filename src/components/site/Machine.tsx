"use client";

/* ------------------------------------------------------------------
   THE MACHINE — a real-time handheld console you can actually operate.

   Built entirely from Three.js primitives (no model download):
   rounded shell, bezel, d-pad, four face buttons, start/select, LED.
   The screen is a live <canvas> pushed through a CRT shader
   (pixel grid, scanlines, RGB shift, barrel warp, phosphor tint).
   The screen is the main light source: its average colour drives a
   point light, so a bright frame really does throw light on the shell.

   WORKING PROTOTYPE — every control is live, on the shell itself:
   d-pad ◄ ► / shoulders  flip through the channels
   A (or ✕ key)           open the current channel's link
   B                      pause / resume the screen
   X                      jump to the SOCIALS channel
   Y                      shuffle a random channel
   START · SELECT         open · flip the page invert
   drag                   rotates the device
   ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { WORKS, type Work } from "@/lib/works";
import { SK } from "@/lib/sk";

const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Machine() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !WORKS.length) return;

    const canvas = root.querySelector<HTMLCanvasElement>("#machineCanvas");
    const loadingEl = root.querySelector<HTMLElement>("#machineLoading");
    const railEl = root.querySelector<HTMLElement>("#rail");
    const railIdx = root.querySelector<HTMLElement>("#railIdx");
    const railTot = root.querySelector<HTMLElement>("#railTot");
    const railOpen = root.querySelector<HTMLAnchorElement>("#railOpen");
    const section = root.querySelector<HTMLElement>("section.machine");
    if (!canvas) return;
    if (railTot) railTot.textContent = "/" + String(WORKS.length).padStart(2, "0");

    /* ---------------------------------------------------------- */
    /* renderer / scene                                            */
    /* ---------------------------------------------------------- */
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(0, 0.12, 4.4);
    camera.lookAt(0, 0, 0);

    const device = new THREE.Group();
    scene.add(device);

    /* ---------------------------------------------------------- */
    /* build the console                                           */
    /* ---------------------------------------------------------- */
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.52, metalness: 0.18 });
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4, metalness: 0.1 });
    const keyMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.62, metalness: 0.05 });
    const keyMatHi = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.55, metalness: 0.08 });

    const disposables: Array<{ dispose(): void }> = [shellMat, bezelMat, keyMat, keyMatHi];

    const shellGeo = new RoundedBoxGeometry(2.62, 1.22, 0.22, 5, 0.09);
    const shell = new THREE.Mesh(shellGeo, shellMat);
    device.add(shell);
    disposables.push(shellGeo);

    const bezelGeo = new RoundedBoxGeometry(1.52, 0.92, 0.05, 4, 0.03);
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.set(-0.34, 0, 0.115);
    device.add(bezel);
    disposables.push(bezelGeo);

    /* d-pad, right wing (the widescreen bezel owns the left two-thirds) */
    const dpad = new THREE.Group();
    const dhGeo = new RoundedBoxGeometry(0.30, 0.10, 0.05, 3, 0.02);
    const dvGeo = new RoundedBoxGeometry(0.10, 0.30, 0.05, 3, 0.02);
    const dh = new THREE.Mesh(dhGeo, keyMat);
    const dv = new THREE.Mesh(dvGeo, keyMat);
    dpad.add(dh, dv);
    dpad.position.set(0.68, 0.06, 0.12);
    device.add(dpad);
    disposables.push(dhGeo, dvGeo);

    /* four face buttons, right wing (diamond, xbox layout: Y X B A)
       each carries a letter and is a real, clickable control */
    const face = new THREE.Group();
    const bGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 24);
    disposables.push(bGeo);
    const FACE_DEFS: Array<[number, number, string]> = [
      [0, 0.10, "Y"], [-0.10, 0, "X"], [0.10, 0, "B"], [0, -0.10, "A"],
    ];
    const faceBtns = new Map<string, THREE.Mesh>();
    FACE_DEFS.forEach(([x, y, label]) => {
      const b = new THREE.Mesh(bGeo, label === "Y" ? keyMatHi : keyMat);
      b.rotation.x = Math.PI / 2;
      b.position.set(x, y, 0);
      b.userData.name = label;
      face.add(b);
      faceBtns.set(label, b);

      /* letter cap, drawn on a canvas so the type matches the HUD */
      const lc = document.createElement("canvas");
      lc.width = lc.height = 64;
      const lctx = lc.getContext("2d")!;
      const ltex = new THREE.CanvasTexture(lc);
      ltex.colorSpace = THREE.SRGBColorSpace;
      const drawLbl = () => {
        lctx.clearRect(0, 0, 64, 64);
        lctx.fillStyle = "rgba(255,255,255,0.95)";
        lctx.font = "46px VT323, monospace";
        lctx.textAlign = "center";
        lctx.textBaseline = "middle";
        lctx.fillText(label, 32, 36);
        ltex.needsUpdate = true;
      };
      drawLbl();
      document.fonts?.ready?.then(drawLbl).catch(() => {});
      disposables.push(ltex);
      const lblGeo = new THREE.PlaneGeometry(0.052, 0.052);
      disposables.push(lblGeo);
      const lblMat = new THREE.MeshBasicMaterial({
        map: ltex, transparent: true, opacity: 0.9, depthWrite: false,
      });
      disposables.push(lblMat);
      const lbl = new THREE.Mesh(lblGeo, lblMat);
      lbl.rotation.x = -Math.PI / 2;   /* undo the cylinder flip, face the viewer */
      lbl.position.set(0, 0.028, 0);   /* sits just proud of the button top */
      b.add(lbl);
    });
    face.position.set(1.06, 0.02, 0.12);
    device.add(face);

    /* start / select pills under the screen — also live controls */
    const pillGeo = new THREE.CapsuleGeometry(0.022, 0.06, 4, 10);
    disposables.push(pillGeo);
    const pillA = new THREE.Mesh(pillGeo, keyMat);
    const pillB = new THREE.Mesh(pillGeo, keyMat);
    pillA.rotation.z = Math.PI / 2;
    pillB.rotation.z = Math.PI / 2;
    pillA.position.set(-0.30, -0.42, 0.12);
    pillB.position.set(-0.05, -0.42, 0.12);
    pillA.userData.name = "start";
    pillB.userData.name = "select";
    device.add(pillA, pillB);

    /* power LED — goes green while a reel is actually playing */
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
    disposables.push(ledMat);
    const ledGeo = new THREE.SphereGeometry(0.022, 12, 12);
    disposables.push(ledGeo);
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0.62, -0.42, 0.12);
    device.add(led);

    /* shoulder triggers */
    const shGeo = new RoundedBoxGeometry(0.5, 0.1, 0.14, 3, 0.04);
    disposables.push(shGeo);
    const shL = new THREE.Mesh(shGeo, keyMat);
    const shR = new THREE.Mesh(shGeo, keyMat);
    shL.position.set(-0.85, 0.62, 0);
    shR.position.set(0.85, 0.62, 0);
    device.add(shL, shR);

    /* soft additive glow card behind the device, fed by screen brightness */
    const glowCv = document.createElement("canvas");
    glowCv.width = glowCv.height = 128;
    const glowCtx = glowCv.getContext("2d")!;
    const grad = glowCtx.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,.9)");
    grad.addColorStop(0.45, "rgba(255,255,255,.22)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    glowCtx.fillStyle = grad;
    glowCtx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCv);
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glowGeo = new THREE.PlaneGeometry(6.2, 3.4);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.z = -0.9;
    scene.add(glow);
    disposables.push(glowTex, glowMat, glowGeo);

    /* ---------------------------------------------------------- */
    /* THE SCREEN — live canvas through a CRT shader               */
    /* ---------------------------------------------------------- */
    const SCR_W = 512, SCR_H = 288;
    const scrCv = document.createElement("canvas");
    scrCv.width = SCR_W; scrCv.height = SCR_H;
    const scrCtx = scrCv.getContext("2d")!;
    const scrTex = new THREE.CanvasTexture(scrCv);
    scrTex.colorSpace = THREE.SRGBColorSpace;
    scrTex.minFilter = THREE.LinearFilter;
    disposables.push(scrTex);

    /* tiny canvas for the average-colour read */
    const avgCv = document.createElement("canvas");
    avgCv.width = avgCv.height = 8;
    const avgCtx = avgCv.getContext("2d", { willReadFrequently: true })!;

    const uniforms = {
      uTex: { value: scrTex },
      uTime: { value: 0 },
      uCells: { value: new THREE.Vector2(96, 54) },
      uGlow: { value: 0.22 },
    };
    const screenMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uTime;
        uniform vec2 uCells;
        uniform float uGlow;
        varying vec2 vUv;

        vec2 barrel(vec2 uv) {
          vec2 cc = uv - 0.5;
          float r2 = dot(cc, cc);
          return 0.5 + cc * (1.0 + 0.10 * r2 + 0.06 * r2 * r2);
        }

        void main() {
          vec2 uv = barrel(vUv);
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }
          /* RGB split, wider toward the edges */
          float ab = 0.0011 + 0.0022 * distance(vUv, vec2(0.5));
          float r = texture2D(uTex, vec2(uv.x + ab, uv.y)).r;
          float g = texture2D(uTex, uv).g;
          float b = texture2D(uTex, vec2(uv.x - ab, uv.y)).b;
          vec3 col = vec3(r, g, b);

          /* scanlines + phosphor grid */
          float scan = 0.88 + 0.12 * sin(uv.y * uCells.y * 6.28318);
          vec2 gp = fract(uv * uCells) - 0.5;
          float grid = 1.0 - 0.16 * smoothstep(0.30, 0.50, max(abs(gp.x), abs(gp.y)));
          col *= scan * grid;

          /* rolling band + fine noise */
          float band = 0.03 * sin(uv.y * 4.0 - uTime * 1.4);
          float n = fract(sin(dot(uv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
          col += band + (n - 0.5) * 0.045;

          /* glass vignette + emissive lift */
          float vig = smoothstep(1.15, 0.35, distance(vUv, vec2(0.5)));
          col = col * vig * (0.80 + 0.95 * uGlow);

          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    disposables.push(screenMat);

    const screenGeo = new THREE.PlaneGeometry(1.36, 0.76);
    disposables.push(screenGeo);
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(-0.34, 0, 0.146);
    device.add(screen);

    /* ---------------------------------------------------------- */
    /* lights                                                      */
    /* ---------------------------------------------------------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.38));
    const screenLight = new THREE.PointLight(0xffffff, 6, 9, 1.8);
    screenLight.position.set(-0.34, 0.1, 1.1);
    scene.add(screenLight);
    const rim = new THREE.DirectionalLight(0xffffff, 1.5);
    rim.position.set(-2.5, 1.8, -2.0);
    scene.add(rim);
    const fillL = new THREE.PointLight(0xffffff, 1.2, 12, 2.0);
    fillL.position.set(2.4, -1.2, 2.6);
    scene.add(fillL);

    /* ---------------------------------------------------------- */
    /* archive sources                                             */
    /* ---------------------------------------------------------- */
    const posters = new Map<string, HTMLImageElement>();
    const reels = new Map<string, HTMLVideoElement>();
    let idx = 0;
    let avgClock = 0;
    let ledClock = 0;

    function posterOf(w: Work) {
      let img = posters.get(w.img);
      if (!img) {
        img = new Image();
        img.src = w.img;
        posters.set(w.img, img);
      }
      return img;
    }

    function reelOf(w: Work) {
      if (!w.vid) return null;
      let v = reels.get(w.vid);
      if (!v) {
        v = document.createElement("video");
        v.src = w.vid;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = "auto";
        reels.set(w.vid, v);
      }
      return v;
    }

    /* draw the current source onto the screen canvas, cover-fit */
    function paintScreen(t: number) {
      const w = WORKS[idx];
      const img = posterOf(w);
      const v = reelOf(w);
      let src: HTMLImageElement | HTMLVideoElement | null = null;
      if (v && v.readyState >= 2 && v.videoWidth) src = v;
      else if (img && img.complete && img.naturalWidth) src = img;
      if (!src) {
        scrCtx.fillStyle = "#0a0a0a";
        scrCtx.fillRect(0, 0, SCR_W, SCR_H);
        return;
      }
      const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth;
      const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
      if (!sw || !sh) return;
      /* a gentle breathing zoom so stills never feel frozen.
         portrait sources sit contain (pillarboxed) on the landscape glass —
         cover would crop them down to a sliver of nothing */
      const portrait = sh > sw;
      const z = reduceMotion ? 1 : 1.05 + 0.02 * Math.sin(t * 0.0006);
      const scale = (portrait ? Math.min(SCR_W / sw, SCR_H / sh) * 0.94 : Math.max(SCR_W / sw, SCR_H / sh) * z);
      const dw = sw * scale, dh = sh * scale;
      scrCtx.save();
      /* lift the source a touch — the CRT pass multiplies it down */
      try { scrCtx.filter = "brightness(1.22) contrast(1.05)"; } catch { /* older browsers */ }
      scrCtx.fillStyle = "#000";
      scrCtx.fillRect(0, 0, SCR_W, SCR_H);
      scrCtx.drawImage(src, (SCR_W - dw) / 2, (SCR_H - dh) / 2, dw, dh);
      scrCtx.restore();
      scrCtx.filter = "none";
      /* timecode chip, bottom-left */
      scrCtx.font = "14px monospace";
      scrCtx.fillStyle = "rgba(255,255,255,.85)";
      scrCtx.fillText(
        w.id.toUpperCase() + " · " + String(idx + 1).padStart(2, "0") + "/" + String(WORKS.length).padStart(2, "0"),
        10, SCR_H - 10,
      );
    }

    function measureAvg() {
      try {
        avgCtx.drawImage(scrCv, 0, 0, 8, 8);
        const d = avgCtx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4;
        r /= n * 255; g /= n * 255; b /= n * 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        uniforms.uGlow.value = 0.38 + 0.85 * lum;
        screenLight.color.setRGB(0.35 + 0.65 * r, 0.35 + 0.65 * g, 0.35 + 0.65 * b);
        screenLight.intensity = 5.0 + 6.5 * lum;
        glowMat.opacity = 0.12 + 0.26 * lum;
      } catch { /* readback can fail; never fatal */ }
    }

    /* ---------------------------------------------------------- */
    /* rail                                                        */
    /* ---------------------------------------------------------- */
    function updateLed() {
      const v = reelOf(WORKS[idx]);
      const playing = !!(v && !v.paused && v.readyState >= 2);
      ledMat.color.setRGB(
        playing ? 0.15 : 0.34,
        playing ? 0.85 : 0.34,
        playing ? 0.30 : 0.34,
      );
    }

    function reflectRail() {
      if (!railIdx || !railEl || !railOpen) return;
      railIdx.textContent = String(idx + 1).padStart(2, "0");
      railEl.classList.remove("is-swap");
      void railEl.offsetWidth;
      railEl.classList.add("is-swap");
      const w = WORKS[idx];
      if (w.link && w.link !== "#") railOpen.setAttribute("href", w.link);
      else railOpen.removeAttribute("href");
      railOpen.setAttribute("aria-label", "Open " + w.title);
      updateLed();
    }

    function goTo(i: number) {
      if (i === idx) return;
      const cur = reels.get(WORKS[idx].vid || "");
      if (cur) cur.pause();
      idx = ((i % WORKS.length) + WORKS.length) % WORKS.length;
      const w = WORKS[idx];
      posterOf(w);
      const v = reelOf(w);
      if (v) v.play().catch(() => {});
      reflectRail();
    }

    function navigate(dir: 1 | -1) {
      goTo(idx + dir);
      pressNudge = dir > 0 ? -1 : 1;
    }

    function shuffle() {
      if (WORKS.length < 2) return;
      let i = idx;
      while (i === idx) i = Math.floor(Math.random() * WORKS.length);
      goTo(i);
      pressNudge = Math.random() > 0.5 ? 1 : -1;
    }

    function togglePlay() {
      const v = reelOf(WORKS[idx]);
      if (!v || v.readyState < 2) return;
      if (v.paused) v.play().catch(() => {});
      else v.pause();
      updateLed();
    }

    function openCurrent() {
      const w = WORKS[idx];
      if (w.link && w.link !== "#") window.open(w.link, "_blank", "noopener");
    }

    /* ---------------------------------------------------------- */
    /* WORKING PROTOTYPE — raycast hit zones over every control.   */
    /* the zones are invisible planes parented to their groups, so */
    /* they ride along when the device rotates under your drag.    */
    /* ---------------------------------------------------------- */
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    disposables.push(hitMat);
    const hits: THREE.Mesh[] = [];
    function addHit(
      parent: THREE.Object3D, w: number, h: number,
      x: number, y: number, z: number, name: string,
    ) {
      const g = new THREE.PlaneGeometry(w, h);
      disposables.push(g);
      const m = new THREE.Mesh(g, hitMat);
      m.position.set(x, y, z);
      m.userData.name = name;
      parent.add(m);
      hits.push(m);
    }
    addHit(dpad, 0.20, 0.36, -0.10, 0, 0.06, "dleft");
    addHit(dpad, 0.20, 0.36, 0.10, 0, 0.06, "dright");
    faceBtns.forEach((b, label) =>
      addHit(face, 0.17, 0.17, b.position.x, b.position.y, 0.05, label));
    addHit(device, 0.56, 0.24, shL.position.x, 0.60, 0.16, "shL");
    addHit(device, 0.56, 0.24, shR.position.x, 0.60, 0.16, "shR");
    addHit(device, 0.16, 0.12, pillA.position.x, pillA.position.y, 0.17, "start");
    addHit(device, 0.16, 0.12, pillB.position.x, pillB.position.y, 0.17, "select");

    /* what each control does */
    function fire(name: string) {
      lastInteract = perfNow();
      switch (name) {
        case "dleft": case "shL": navigate(-1); break;
        case "dright": case "shR": navigate(1); break;
        case "A": case "start": openCurrent(); break;
        case "B": togglePlay(); break;
        case "X": goTo(0); break;               /* the socials channel */
        case "Y": shuffle(); break;
        case "select": SK.toggleInvert?.(); break;
      }
      /* physical feedback: dip the control you pressed */
      const fb = faceBtns.get(name);
      if (fb) pressAnim = { obj: fb, base: 0, t: 0 };
      else if (name === "dleft" || name === "dright") pressAnim = { obj: dpad, base: 0.12, t: 0 };
      else if (name === "shL") pressAnim = { obj: shL, base: 0, t: 0 };
      else if (name === "shR") pressAnim = { obj: shR, base: 0, t: 0 };
      else if (name === "start") pressAnim = { obj: pillA, base: 0.12, t: 0 };
      else if (name === "select") pressAnim = { obj: pillB, base: 0.12, t: 0 };
    }

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pick(cx: number, cy: number): string | null {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      ndc.x = ((cx - r.left) / r.width) * 2 - 1;
      ndc.y = -((cy - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(hits, false)[0];
      return hit ? ((hit.object.userData.name as string) ?? null) : null;
    }

    let rotX = 0, rotY = 0, tRotX = 0, tRotY = 0;
    let dragging = false, lastX = 0, lastY = 0, lastInteract = -1e4;
    let pressNudge = 0;
    let sectionVisible = true;
    let pressAnim: { obj: THREE.Object3D; base: number; t: number } | null = null;
    let hoverX = -1, hoverY = -1, hoverClock = 0;

    const perfNow = () => performance.now();

    const onDown = (e: PointerEvent) => {
      lastInteract = perfNow();
      const name = pick(e.clientX, e.clientY);
      if (name) { fire(name); return; }   /* a live control ate the click */
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      hoverX = e.clientX; hoverY = e.clientY;
      if (!dragging) return;
      lastInteract = perfNow();
      tRotY += (e.clientX - lastX) * 0.006;
      tRotX += (e.clientY - lastY) * 0.004;
      tRotX = Math.max(-0.5, Math.min(0.5, tRotX));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = () => { dragging = false; };

    function press(which: "left" | "right" | "x") {
      if (which === "left") { tRotY -= 0.22; pressNudge = 1; }
      else if (which === "right") { tRotY += 0.22; pressNudge = -1; }
      else { tRotX = Math.min(0.5, tRotX + 0.16); }
      lastInteract = perfNow();
    }

    const onKey = (e: KeyboardEvent) => {
      /* only operate the console while its section is on screen */
      if (!sectionVisible) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") { press("left"); navigate(-1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { press("right"); navigate(1); e.preventDefault(); }
      else if (e.key === "x" || e.key === "X") { press("x"); openCurrent(); }
    };

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("keydown", onKey);

    /* ---------------------------------------------------------- */
    /* shell invert (wired to the page toggle through the bus)     */
    /* ---------------------------------------------------------- */
    SK.setShellInvert = (on) => {
      shellMat.color.set(on ? 0xe4e4e4 : 0x161616);
      shellMat.roughness = on ? 0.38 : 0.52;
      bezelMat.color.set(on ? 0x101010 : 0x050505);
    };

    /* ---------------------------------------------------------- */
    /* visibility + resize                                         */
    /* ---------------------------------------------------------- */
    let vio: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window && section) {
      vio = new IntersectionObserver(
        (es) => es.forEach((en) => { sectionVisible = en.isIntersecting; }),
        { rootMargin: "80px 0px" },
      );
      vio.observe(section);
    }

    function resize() {
      const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
      const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
      const pr = renderer.getPixelRatio();
      const needW = Math.round(w * pr), needH = Math.round(h * pr);
      if (canvas.width !== needW || canvas.height !== needH) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        /* pull back on narrow screens so the whole console stays in frame */
        camera.position.z = Math.max(4.4, 5.1 / camera.aspect);
        camera.updateProjectionMatrix();
      }
    }
    window.addEventListener("resize", resize, { passive: true });

    /* ---------------------------------------------------------- */
    /* loop                                                        */
    /* ---------------------------------------------------------- */
    let raf = 0;
    let firstFrame = false;
    const t0 = performance.now();

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const t = now - t0;
      resize();
      if (!sectionVisible) return;

      /* idle sway when untouched, gentle float always */
      const idle = now - lastInteract > 2600;
      if (idle && !dragging && !reduceMotion) {
        tRotY += (Math.sin(t * 0.00035) * 0.42 - tRotY) * 0.006;
        tRotX += (Math.sin(t * 0.00027) * 0.10 - tRotX) * 0.006;
      }
      rotY += (tRotY - rotY) * 0.085;
      rotX += (tRotX - rotX) * 0.085;
      pressNudge *= 0.90;
      device.rotation.y = rotY + pressNudge * 0.05;
      device.rotation.x = rotX;
      device.rotation.z = pressNudge * 0.02;
      if (!reduceMotion) device.position.y = Math.sin(t * 0.0011) * 0.035;

      /* button press animation: dip, then release */
      if (pressAnim) {
        pressAnim.t += 1 / 60;
        const ph = pressAnim.t / 0.16;
        if (ph >= 1) {
          pressAnim.obj.position.z = pressAnim.base;
          pressAnim = null;
        } else {
          pressAnim.obj.position.z = pressAnim.base - 0.022 * Math.sin(Math.PI * ph);
        }
      }

      /* hover cursor over live controls, LED truth every half second */
      hoverClock += 16;
      ledClock += 16;
      if (hoverClock > 90) {
        hoverClock = 0;
        if (!dragging && hoverX >= 0) {
          canvas.style.cursor = pick(hoverX, hoverY) ? "pointer" : "grab";
        }
      }
      if (ledClock > 500) { ledClock = 0; updateLed(); }

      paintScreen(t);
      scrTex.needsUpdate = true;
      uniforms.uTime.value = t / 1000;
      avgClock += 16;
      if (avgClock > 420) { avgClock = 0; measureAvg(); }

      renderer.render(scene, camera);

      if (!firstFrame) {
        firstFrame = true;
        loadingEl?.classList.add("is-off");
        reflectRail();
        const v = reelOf(WORKS[idx]);
        if (v) v.play().catch(() => {});
        SK.fireReady();
      }
    }

    /* warm the first sources so the screen has something immediately */
    posterOf(WORKS[0]);
    reelOf(WORKS[0]);
    raf = requestAnimationFrame(frame);

    /* dev-only: lets tests reach the controls programmatically */
    if (process.env.NODE_ENV !== "production") {
      type MachineDebug = {
        fire: (name: string) => void;
        pos: (name: string) => { x: number; y: number } | null;
        state: () => { idx: number; id: string; paused: boolean | null; src: string | null };
      };
      (window as unknown as { __machine?: MachineDebug }).__machine = {
        fire,
        pos(name: string) {
          const m = hits.find((h) => h.userData.name === name);
          if (!m) return null;
          const v = new THREE.Vector3();
          m.getWorldPosition(v);
          v.project(camera);
          const r = canvas.getBoundingClientRect();
          return {
            x: r.left + (v.x * 0.5 + 0.5) * r.width,
            y: r.top + (-v.y * 0.5 + 0.5) * r.height,
          };
        },
        state() {
          const v = reelOf(WORKS[idx]);
          return {
            idx,
            id: WORKS[idx].id,
            paused: v ? v.paused : null,
            src: v ? v.src.split("/").pop() ?? null : null,
          };
        },
      };
    }

    /* ---------------------------------------------------------- */
    return () => {
      cancelAnimationFrame(raf);
      vio?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onDown);
      reels.forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); });
      posters.forEach((i) => { i.src = ""; });
      disposables.forEach((d) => d.dispose());
      delete (window as unknown as { __machine?: unknown }).__machine;
      SK.setShellInvert = null;
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={rootRef}>
      <section className="sec sec--dark machine" id="work">
        <div className="stage" aria-hidden="true">
          <img src="/assets/el/flower.png" alt="" className="el el--flower" data-shape="flower" />
        </div>
        <div className="machine__stage">
          <canvas id="machineCanvas" />
          <div className="machine__loading" id="machineLoading">
            <i className="spin" aria-hidden="true" />
          </div>
        </div>
        <div className="rail" id="rail" aria-live="polite">
          <b id="railIdx">01</b>
          <i id="railTot">/09</i>
          <a className="rail__open" id="railOpen" href="#" target="_blank" rel="noopener" aria-label="Open this work">
            ↗
          </a>
        </div>
        <div className="keys" aria-hidden="true">
          <kbd>←</kbd>
          <kbd>→</kbd>
          <kbd>✕</kbd>
        </div>
      </section>
    </div>
  );
}

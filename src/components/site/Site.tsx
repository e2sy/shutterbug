"use client";

/* ============================================================
   SHUTTERBUG OS — page shell.

   Owns: the boot sequence, the fixed controls (invert / music),
   the audio autoplay dance, the scroll engine (backdrop tone,
   per-element drift, reveals) and the composed sections.

   The machine scene lives in Machine.tsx and talks to us through
   the shared bus (lib/sk.ts).
   ============================================================ */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import "./site.css";
import { SK } from "@/lib/sk";
import { initTrackers } from "@/lib/tracker";

const Machine = dynamic(() => import("./Machine"), { ssr: false });

const reduce =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* the deck — two tapes, newest drop first. volumes are per-track:
   a mastered song sits lower than the home-made synth loop */
const TRACKS = [
  { name: "reflections - the neighbourhood", src: "/assets/audio/reflections.mp3", vol: 0.3 },
  { name: "sb theme - ambient loop", src: "/assets/audio/theme.mp3", vol: 0.42 },
];

export default function Site() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    /* ---------------------------------------------------------- */
    /* BOOT SEQUENCE                                              */
    /* ---------------------------------------------------------- */
    const boot = document.getElementById("boot");
    const fillEl = document.getElementById("bootFill");
    const pctEl = document.getElementById("bootPct");

    let pct = 0, targetPct = 0, bootDone = false;

    function setPct(v: number) {
      pct = v;
      if (fillEl) fillEl.style.right = 100 - v + "%";
      if (pctEl) pctEl.textContent = String(Math.round(v)).padStart(3, "0");
    }

    /* creep toward 96 while the scene warms up; the release waits on it */
    function crawl() {
      targetPct = Math.min(96, targetPct + 6);
      if (targetPct < 96) window.setTimeout(crawl, reduce ? 30 : 90);
      else finishBoot();
    }

    function tickPct() {
      if (bootDone) return;
      setPct(pct + (targetPct - pct) * 0.14);
      requestAnimationFrame(tickPct);
    }

    function finishBoot() {
      /* wait for the 3D scene (or bail after 9s so a slow day never
         traps anyone on the loader) */
      let released = false;
      function release() {
        if (released) return;
        released = true;
        targetPct = 100;
        setPct(100);
        window.setTimeout(() => {
          bootDone = true;
          boot?.classList.add("is-done");
          document.body.classList.remove("is-booting");
          document.body.classList.add("is-lit");
        }, reduce ? 60 : 420);
      }
      SK.onReady(release);
      window.setTimeout(release, 9000);
    }

    requestAnimationFrame(tickPct);
    window.setTimeout(crawl, reduce ? 0 : 200);

    /* ---------------------------------------------------------- */
    /* AUDIO — on by default, remembered per session              */
    /*                                                            */
    /* Browsers will not let a page make noise before the visitor  */
    /* has interacted with it. Two rules keep the music reliable:  */
    /*                                                            */
    /*  1. wheel and scroll are NOT user-activation gestures, but  */
    /*     this is a scroll-driven site — so never disarm on a     */
    /*     failed attempt; only a confirmed success may disarm.    */
    /*                                                            */
    /*  2. MUTED playback is always allowed. The track rolls       */
    /*     silently from the first frame and is fully buffered by  */
    /*     the time a real gesture arrives — the gesture only has  */
    /*     to unmute, which cannot fail the way a cold play() can. */
    /* ---------------------------------------------------------- */
    const audio = document.getElementById("bgAudio") as HTMLAudioElement | null;
    const btn = document.getElementById("soundToggle");
    let wanted = false, audible = false, armed = false, fadeTimer: number | null = null;
    let inFlight: Promise<boolean> | null = null;

    /* which tape is in the deck — remembered per session */
    let trackIdx = 0;
    try {
      const saved = parseInt(sessionStorage.getItem("sb_track") ?? "", 10);
      if (!Number.isNaN(saved) && saved >= 0 && saved < TRACKS.length) trackIdx = saved;
    } catch { /* private mode */ }
    const volOf = () => TRACKS[trackIdx].vol;

    function fadeTo(target: number, done?: () => void) {
      if (!audio) return;
      if (fadeTimer) clearInterval(fadeTimer);
      const step = (target - audio.volume) / 22;
      fadeTimer = window.setInterval(() => {
        const v = audio.volume + step;
        if ((step > 0 && v >= target) || (step < 0 && v <= target) || step === 0) {
          audio.volume = Math.max(0, Math.min(1, target));
          if (fadeTimer) clearInterval(fadeTimer);
          done?.();
        } else {
          audio.volume = Math.max(0, Math.min(1, v));
        }
      }, 40);
    }

    function reflect() {
      btn?.setAttribute("aria-pressed", wanted ? "true" : "false");
    }

    /* start it rolling with no sound — always permitted, warms the buffer */
    function rollSilently() {
      if (!audio) return;
      audio.muted = true;
      audio.volume = 0;
      audio.play()?.catch(() => {});
    }

    /* try to actually make sound; resolves true only if it worked.
       single-flight: overlapping attempts would restore the wrong mute state */
    function goAudible(): Promise<boolean> {
      if (!audio) return Promise.resolve(false);
      if (audible) return Promise.resolve(true);
      if (inFlight) return inFlight;

      const wasMuted = audio.muted;
      audio.muted = false;
      /* if it has been rolling silently the visitor has heard none of it —
         give them the top of the track, not the middle of a phrase */
      if (wasMuted) {
        try { audio.currentTime = 0; } catch { /* not seekable yet */ }
      }
      audio.volume = 0;

      let p: Promise<void> | undefined;
      try { p = audio.play(); } catch { p = undefined; }
      const win = () => {
        audible = true;
        inFlight = null;
        fadeTo(volOf());
        return true;
      };
      const lose = () => {
        /* unmuting without activation makes the browser pause it — put it back */
        audio.muted = wasMuted;
        if (wasMuted && audio.paused) rollSilently();
        inFlight = null;
        return false;
      };
      if (!p) return Promise.resolve(audio.paused ? lose() : win());
      inFlight = p.then(win, lose);
      return inFlight;
    }

    const ARM: Array<keyof WindowEventMap> = [
      "pointerdown", "pointerup", "click", "keydown", "touchstart", "touchend", "wheel", "scroll",
    ];
    function kick() {
      if (!wanted || audible) { disarm(); return; }
      goAudible().then((ok) => { if (ok) disarm(); });
    }
    function arm() {
      if (armed || !audio) return;
      armed = true;
      /* capture, passive, and NOT once — a wheel event that cannot grant
         activation must not cost us the next real click */
      ARM.forEach((t) => window.addEventListener(t, kick, { capture: true, passive: true }));
    }
    function disarm() {
      if (!armed) return;
      armed = false;
      ARM.forEach((t) => window.removeEventListener(t, kick, true));
    }

    function setSound(on: boolean) {
      if (!audio) return;
      wanted = on;
      reflect();
      try { sessionStorage.setItem("sb_sound", on ? "1" : "0"); } catch { /* private mode */ }
      if (on) {
        goAudible().then((ok) => {
          if (!ok) { rollSilently(); arm(); }
        });
      } else {
        audible = false;
        disarm();
        fadeTo(0, () => audio.pause());
      }
    }

    btn?.addEventListener("click", () => setSound(!wanted));

    /* ---------------------------------------------------------- */
    /* THE DECK — two tapes, a skip button, a now-playing readout  */
    /* ---------------------------------------------------------- */
    const trackBtn = document.getElementById("trackToggle");
    const npEl = document.getElementById("nowPlaying");

    function reflectTrack() {
      const t = TRACKS[trackIdx];
      if (npEl) npEl.textContent = `np - ${t.name}`;
      trackBtn?.setAttribute("aria-label", `Next track (now playing: ${t.name})`);
      try { sessionStorage.setItem("sb_track", String(trackIdx)); } catch { /* private mode */ }
    }

    function cycleTrack() {
      if (!audio) return;
      trackIdx = (trackIdx + 1) % TRACKS.length;
      reflectTrack();

      /* a src change pauses the element, so note who was rolling first */
      const wasRolling = !audio.paused;
      audio.src = TRACKS[trackIdx].src;
      audio.load();
      if (!wasRolling) return;
      if (audible) {
        /* loud: start the new tape from silence and fade it up — a skip,
           not a crossfade, so there is no seam race with the toggles */
        audio.volume = 0;
        audio.play()?.then(() => fadeTo(volOf()), () => {});
      } else {
        rollSilently();
      }
    }

    trackBtn?.addEventListener("click", cycleTrack);

    /* if the loaded tape is missing (the repo ships without a personal
       song), skip to the next one instead of leaving a dead deck */
    const onAudioError = () => {
      if (!wanted || !audio.currentSrc) return;
      if (audio.currentSrc.includes(TRACKS[trackIdx].src)) cycleTrack();
    };
    audio?.addEventListener("error", onAudioError);
    cleanups.push(() => audio?.removeEventListener("error", onAudioError));

    /* align the element with the remembered tape before anything plays */
    if (trackIdx !== 0) {
      audio.src = TRACKS[trackIdx].src;
      audio.load();
    }
    reflectTrack();

    const onVis = () => {
      if (!audio) return;
      if (document.hidden) audio.pause();
      else if (wanted) audio.play()?.catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    cleanups.push(() => document.removeEventListener("visibilitychange", onVis));

    let soundOnByDefault = true;
    try {
      if (sessionStorage.getItem("sb_sound") === "0") soundOnByDefault = false;
    } catch { /* private mode */ }

    if (audio && soundOnByDefault) {
      wanted = true;
      reflect();
      goAudible().then((ok) => {
        if (ok) return;      // high media engagement — it just plays
        rollSilently();      // otherwise roll it muted and wait for a gesture
        arm();
      });
    }

    /* ---------------------------------------------------------- */
    /* INVERT — swaps the ink and the paper                        */
    /* ---------------------------------------------------------- */
    const invBtn = document.getElementById("invertToggle");
    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    function setInvert(on: boolean) {
      document.body.classList.toggle("is-invert", on);
      invBtn?.setAttribute("aria-pressed", on ? "true" : "false");
      metaTheme?.setAttribute("content", on ? "#000000" : "#ffffff");
      SK.setShellInvert?.(on);          // the console casing goes white
      onScroll();                       // repaint the backdrop tone
      try { localStorage.setItem("sb_invert", on ? "1" : "0"); } catch { /* private mode */ }
    }
    invBtn?.addEventListener("click", () =>
      setInvert(!document.body.classList.contains("is-invert")),
    );
    /* the machine's SELECT pill flips the page through the bus */
    SK.toggleInvert = () => setInvert(!document.body.classList.contains("is-invert"));
    try {
      if (localStorage.getItem("sb_invert") === "1") setInvert(true);
    } catch { /* private mode */ }

    /* ---------------------------------------------------------- */
    /* SCROLL ENGINE — one rAF loop, three jobs:                   */
    /* bleed the backdrop tone across seams, drift each element at */
    /* its own rate, and (below) reveal type as it enters.         */
    /* ---------------------------------------------------------- */
    const backdrop = document.querySelector<HTMLElement>(".backdrop");
    const secs = Array.from(document.querySelectorAll<HTMLElement>(".sec"));
    const movers = Array.from(document.querySelectorAll<HTMLElement>(".el, .lay"));

    /* how far each piece drifts, as a fraction of the viewport */
    const DEPTH: Record<string, number> = {
      "el--star-a": 0.16, "el--star-b": -0.13, "el--dice": 0.07,
      "el--flower": 0.05, "el--cd-a": 0.15, "el--cd-b": -0.12, "el--cards": 0.08,
      "lay--shutter": -0.05, "lay--bug": 0.05,
      "lay--abouth": -0.04, "lay--bio": 0.035,
      "lay--contact": -0.05, "lay--me": 0.05, "lay--icons": 0.03,
    };
    movers.forEach((m) => {
      let d = 0;
      for (const k in DEPTH) if (m.classList.contains(k)) d = DEPTH[k];
      (m as HTMLElement & { __d?: number }).__d = d;
    });

    const toneOf = (sec: HTMLElement) => (sec.classList.contains("sec--dark") ? 1 : 0);

    let ticking = false;
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(frame);
      }
    }

    function frame() {
      ticking = false;
      const vh = window.innerHeight;
      const mid = window.scrollY + vh * 0.5;

      /* backdrop tone, blended across a band at each seam */
      if (backdrop && secs.length) {
        const band = vh * 0.6;
        let tone = toneOf(secs[secs.length - 1]);
        for (let i = 0; i < secs.length; i++) {
          const top = secs[i].offsetTop, bot = top + secs[i].offsetHeight;
          if (mid >= top && mid < bot) {
            tone = toneOf(secs[i]);
            if (i < secs.length - 1 && mid > bot - band) {
              tone += (toneOf(secs[i + 1]) - tone) * ((mid - (bot - band)) / band);
            } else if (i > 0 && mid < top + band) {
              tone += (toneOf(secs[i - 1]) - tone) * (1 - (mid - top) / band);
            }
            break;
          }
        }
        const inv = document.body.classList.contains("is-invert");
        const v = Math.round((inv ? tone : 1 - tone) * 255);
        backdrop.style.backgroundColor = `rgb(${v},${v},${v})`;
      }

      /* per-element drift */
      for (const m of movers) {
        const d = (m as HTMLElement & { __d?: number }).__d;
        if (!d) continue;
        const r = m.parentElement?.getBoundingClientRect();
        if (!r) continue;
        if (r.bottom < -vh || r.top > vh * 2) continue;   // far off-screen, skip
        const p = (r.top + r.height / 2 - vh / 2) / vh;   // -1 .. 1 through the viewport
        m.style.setProperty("--ty", (p * d * vh).toFixed(1) + "px");
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    frame();

    /* reveal the type and the cut-outs as each section arrives */
    let guard: number | null = null;
    if ("IntersectionObserver" in window && !reduce) {
      const lays = Array.from(document.querySelectorAll<HTMLElement>(".lay, .el"));
      lays.forEach((n) => n.classList.add("rev"));
      const ro = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-shown");
              ro.unobserve(e.target);
            }
          });
        },
        { threshold: 0, rootMargin: "0px 0px -6% 0px" },
      );
      lays.forEach((n) => ro.observe(n));

      /* failsafe — nothing may be left hidden because an observer misfired.
         per element, not blanket: it only shows what is actually on screen,
         so a section further down still gets its animation when you reach it */
      const showIfNear = () => {
        const vh = window.innerHeight;
        let live = 0;
        for (const el of lays) {
          if (el.classList.contains("is-shown")) continue;
          live++;
          const r = el.getBoundingClientRect();
          if (r.top < vh && r.bottom > 0) {
            el.classList.add("is-shown");
            ro.unobserve(el);
          }
        }
        if (!live && guard) {
          clearInterval(guard);
          guard = null;
        }
      };
      guard = window.setInterval(showIfNear, 900);
      showIfNear();
      window.addEventListener("scroll", showIfNear, { passive: true });
      window.addEventListener("resize", showIfNear, { passive: true });
      cleanups.push(() => {
        if (guard) clearInterval(guard);
        ro.disconnect();
      });
    }

    /* ---------------------------------------------------------- */
    /* smooth in-page nav (the scroll cue)                         */
    /* ---------------------------------------------------------- */
    document.querySelectorAll<HTMLAnchorElement>("[data-nav]").forEach((a) => {
      const handler = (e: Event) => {
        const id = a.getAttribute("href");
        if (!id || id.charAt(0) !== "#") return;
        const t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      };
      a.addEventListener("click", handler);
    });

    /* ---------------------------------------------------------- */
    /* tracking overlays                                           */
    /* ---------------------------------------------------------- */
    cleanups.push(initTrackers(reduce));

    /* ---------------------------------------------------------- */
    return () => {
      cleanups.forEach((fn) => fn());
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      btn?.removeEventListener("click", () => {});
      invBtn?.removeEventListener("click", () => {});
      SK.toggleInvert = null;
    };
  }, []);

  return (
    <>
      <div className="backdrop" aria-hidden="true" />

      <div id="boot" className="boot" role="status" aria-label="Loading">
        <img src="/assets/el/swag.png" alt="" className="boot__img" />
        <div className="boot__bar"><span id="bootFill" /></div>
        <div className="boot__pct" id="bootPct">000</div>
      </div>

      <div className="ctl">
        <button className="ctl__b" id="invertToggle" aria-pressed="false">invert</button>
        <button className="ctl__b" id="soundToggle" aria-pressed="false">music on/off</button>
        <button className="ctl__b" id="trackToggle" aria-label="Next track">{"track >>"}</button>
        <span className="ctl__np" id="nowPlaying" />
      </div>

      <main id="top">
        {/* ============ 01 · FRONT ============ */}
        <section className="sec sec--dark hero" id="hero">
          <div className="stage" data-rise>
            <img src="/assets/el/star-a.png" alt="" className="el el--star-a" data-shape="star-a" aria-hidden="true" />
            <img src="/assets/el/star-b.png" alt="" className="el el--star-b" data-shape="star-b" aria-hidden="true" />
            <img src="/assets/el/dice.png" alt="" className="el el--dice" data-shape="dice" aria-hidden="true" />
            <h1 className="lay lay--shutter">shutter</h1>
            <p className="lay lay--bug" aria-hidden="true">bug.</p>
          </div>
          <a className="cue" href="#work" data-nav aria-label="Scroll to work"><i /></a>
        </section>

        {/* ============ 02 · WORK ============ */}
        <Machine />

        {/* ============ 03 · ABOUT ============ */}
        <section className="sec sec--dark about" id="about">
          <div className="stage">
            <img src="/assets/el/cd-a.png" alt="" className="el el--cd-a" data-shape="cd-a" aria-hidden="true" />
            <img src="/assets/el/cd-b.png" alt="" className="el el--cd-b" data-shape="cd-b" aria-hidden="true" />
            <h2 className="lay lay--abouth">About me</h2>
            <div className="lay lay--bio">
              <p>
                I&apos;m a student from Purnea, Bihar, building things with AI
                and code. I like taking an idea from a rough sketch to something
                people can actually use, whether that&apos;s an open-source tool
                on GitHub, a free app I build and document on YouTube, or an AI
                gateway I&apos;m planning from scratch. I&apos;m in Class 11
                studying PCM, and most of my time goes to school and building.
              </p>
              <p>
                What I&apos;m chasing is AI product engineering: full-stack
                projects where models do the heavy lifting and the interface
                stays simple. My code is on GitHub, my build videos are on
                YouTube as Mayank Ship, and I share what I&apos;m learning on X.
                Keep it simple, ship often, and learn in the open.
              </p>
            </div>
          </div>
        </section>

        {/* ============ 04 · CONTACT ============ */}
        <section className="sec sec--dark contact" id="contact">
          <div className="stage">
            <img src="/assets/el/cards.png" alt="" className="el el--cards" data-shape="cards" aria-hidden="true" />
            <h2 className="lay lay--contact">contact</h2>
            <p className="lay lay--me" aria-hidden="true">me.</p>
            <div className="lay lay--icons">
              <a href="mailto:hello@example.com" aria-label="Email hello@example.com">
                <img src="/assets/el/ic-mail.png" alt="" />
              </a>
              <a href="https://www.youtube.com/@mayankforge" target="_blank" rel="noopener" aria-label="YouTube — mayankforge">
                <img src="/assets/el/b-yt.png" alt="" />
              </a>
              <a href="https://github.com/e2sy" target="_blank" rel="noopener" aria-label="GitHub — e2sy">
                <img src="/assets/el/b-gh.png" alt="" />
              </a>
              <a href="https://t.me/ExploitArc" target="_blank" rel="noopener" aria-label="Telegram — ExploitArc">
                <img src="/assets/el/b-tg.png" alt="" />
              </a>
              <a href="https://discord.gg/g4Qk9WRZB" target="_blank" rel="noopener" aria-label="Discord community invite">
                <img src="/assets/el/b-dc.png" alt="" />
              </a>
              <a href="https://x.com/mayankbhaskarr" target="_blank" rel="noopener" aria-label="X — mayankbhaskarr">
                <img src="/assets/el/b-x.png" alt="" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* preload=auto, not none: the tape rolls muted from the first frame,
          so it is buffered and ready to be unmuted the instant the visitor
          interacts with the page. the deck (Site useEffect) swaps src. */}
      <audio id="bgAudio" src="/assets/audio/reflections.mp3" loop preload="auto" playsInline />
    </>
  );
}

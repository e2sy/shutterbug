#!/usr/bin/env python3
"""Synthesize an ORIGINAL ambient lo-fi theme loop (13.3s, seamless).
Slow pad chords in A minor, sparse music-box melody, tape hiss, soft pulse.
Pure numpy - no samples, no external music."""
import numpy as np, wave, os

SR = 44100
BPM = 90
BAR = 4 * 60 / BPM          # 2.667 s
BARS = 5                     # 4 bars content + 1 tail bar folded into the loop
DUR = BAR * BARS
N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)

def note_hz(semi):           # semitones from A2 (110 Hz)
    return 110 * 2 ** (semi / 12)

# chord progression: Am9 -> Fmaj7 -> Cmaj7 -> G6  (semitones from A2)
CHORDS = [
    [0, 7, 12, 16, 19],
    [-4, 3, 8, 12, 16],
    [3, 10, 15, 19, 22],
    [-2, 5, 10, 14, 17],
]
seg = BAR * 2 / len(CHORDS) * 2   # each chord holds ~1.33s.. actually 2 bars/4

def add(buf, sig, pan=0.0, gain=1.0):
    n = min(N, len(sig))
    gl = gain * (1 - max(0, pan)) ** 0.5
    gr = gain * (1 - max(0, -pan)) ** 0.5
    buf_l, buf_r = buf
    buf_l[:n] += sig[:n] * gl
    buf_r[:n] += sig[:n] * gr

def pad(freq, start, dur, amp=0.05, detune=0.15):
    i0 = int(start * SR); n = int(dur * SR)
    if i0 >= N: return np.zeros(1)
    n = min(n, N - i0)
    tt = np.arange(n) / SR
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.5        # slow swell in/out
    vib = 1 + 0.0015 * np.sin(2 * np.pi * 0.19 * tt + freq)
    s = np.zeros(n)
    for dt, g in [(0, 1.0), (detune, 0.6), (-detune, 0.6)]:
        s += g * np.sin(2 * np.pi * (freq + dt) * tt * vib)
    s += 0.35 * np.sin(2 * np.pi * freq * 2 * tt)         # octave shimmer
    out = np.zeros(N)
    out[i0:i0+n] = s * env * amp
    return out

def pluck(freq, start, dur=1.2, amp=0.11):
    """music-box note: sine + partials, exponential decay"""
    i0 = int(start * SR); n = int(dur * SR)
    if i0 >= N: return np.zeros(1)
    n = min(n, N - i0)
    tt = np.arange(n) / SR
    env = np.exp(-tt * 3.2)
    s = (np.sin(2*np.pi*freq*tt) + 0.4*np.sin(2*np.pi*freq*2*tt)
         + 0.15*np.sin(2*np.pi*freq*4.01*tt))
    out = np.zeros(N)
    out[i0:i0+n] = s * env * amp
    return out

def pulse(start, amp=0.20):
    """muffled heartbeat kick: fast pitch drop 70->45 Hz"""
    i0 = int(start * SR); n = int(0.30 * SR)
    if i0 >= N: return np.zeros(1)
    n = min(n, N - i0)
    tt = np.arange(n) / SR
    f = 45 + 30 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros(N)
    out[i0:i0+n] = np.sin(ph) * np.exp(-tt * 11) * amp
    return out

rng = np.random.default_rng(42)
# ---- pads: one chord per 2 bars, crossfaded
chord_times = [0, BAR, 2*BAR, 3*BAR]
for ci, st in enumerate(chord_times):
    ch = CHORDS[ci % len(CHORDS)]
    for ki, semi in enumerate(ch):
        pan = (ki / (len(ch)-1)) * 1.4 - 0.7
        add((L, R), pad(note_hz(semi), st, BAR*1.15, amp=0.045), pan=pan)
# ---- melody: sparse pentatonic droplets, deterministic
PENTA = [12, 15, 19, 22, 24, 27]
times = np.cumsum(rng.uniform(0.9, 2.1, 9)) * 0.55
for i, st in enumerate(times):
    if st > DUR - 1.4: break
    semi = PENTA[int(rng.integers(0, len(PENTA)))]
    add((L, R), pluck(note_hz(semi), st, dur=1.5, amp=0.085), pan=float(rng.uniform(-0.5, 0.5)))
# ---- pulse on each bar head
for b in range(4):
    add((L, R), pulse(b * BAR, amp=0.16), pan=0.0)
# ---- tape hiss (low-passed noise, quiet)
hiss = rng.normal(0, 1, N)
hiss = np.convolve(hiss, np.ones(24)/24, mode="same")
L += hiss * 0.012; R += hiss * 0.012
# ---- gentle vinyl crackle
crk = (rng.uniform(0, 1, N) > 0.9992).astype(float)
crk = np.convolve(crk, rng.uniform(0.2, 1.0, 8), mode="same")
L += crk * rng.uniform(0.02, 0.05, N); R += crk * rng.uniform(0.02, 0.05, N)

# ---- master: soft clip, fade edges, fold tail into loop point for seamlessness
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 1.6) * 0.62
fade = int(0.02 * SR)
ramp = np.linspace(0, 1, fade)[:, None]
mix[:fade] *= ramp
mix[-fade:] *= ramp[::-1]
# crossfold: last bar blends into first bar so the loop point is inaudible
fold = int(BAR * SR)
head = mix[:fold].copy()
tail = mix[-fold:].copy()
w = np.linspace(0, 1, fold)[:, None]
mix = mix[:-fold]
mix[:fold] = head * w + tail * (1 - w)

# normalize to -14 dB-ish peak
mix *= 0.88 / max(1e-9, np.abs(mix).max())

wav_path = "/home/z/my-project/public/assets/audio/theme.wav"
with wave.open(wav_path, "w") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wav written:", wav_path, mix.shape[0]/SR, "s")

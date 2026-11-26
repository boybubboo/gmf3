import type { MusicMood, SoundEffect } from '../types/maker';
import { getVoiceBlobRecord } from './voiceVault';

export interface PlayVoiceOptions {
  ownerKey?: string;
  volume?: number;
  playbackRate?: number;
  interrupt?: boolean;
  onEnded?: () => void;
}

interface ActiveVoicePlayback {
  ownerKey?: string;
  token: number;
  stop: () => void;
}

class MakerAudioEngine {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private currentMood: MusicMood = 'none';
  private muted = false;
  private step = 0;

  private decodedVoiceCache = new Map<string, AudioBuffer>();
  private rawVoiceCache = new Map<string, { buffer: ArrayBuffer; mimeType: string }>();
  private activeVoice: ActiveVoicePlayback | null = null;
  private voiceTokenCounter = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopMusic();
      this.stopVoice();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public clearVoiceCache(clipId?: string) {
    if (clipId) {
      this.decodedVoiceCache.delete(clipId);
      this.rawVoiceCache.delete(clipId);
    } else {
      this.decodedVoiceCache.clear();
      this.rawVoiceCache.clear();
    }
  }

  public async preloadVoiceClips(clipIds: Iterable<string>): Promise<void> {
    const ids = Array.from(new Set(clipIds)).filter(Boolean);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map(async (id) => {
        if (this.decodedVoiceCache.has(id) || this.rawVoiceCache.has(id)) return;
        const rec = await getVoiceBlobRecord(id);
        if (!rec) return;
        this.rawVoiceCache.set(id, rec);
        const ctx = this.ensureContext();
        if (ctx) {
          try {
            const decoded = await ctx.decodeAudioData(rec.buffer.slice(0));
            this.decodedVoiceCache.set(id, decoded);
          } catch {
            // Keep raw blob fallback if browser decoder needs HTMLAudioElement
          }
        }
      })
    );
  }

  public isVoicePlaying(ownerKey?: string): boolean {
    if (!this.activeVoice) return false;
    if (!ownerKey) return true;
    return this.activeVoice.ownerKey === ownerKey;
  }

  public stopVoice(ownerKey?: string): void {
    const active = this.activeVoice;
    if (!active) return;
    if (ownerKey && active.ownerKey !== ownerKey) return;
    this.activeVoice = null;
    active.stop();
  }

  public async playVoiceClip(clipId: string, opts: PlayVoiceOptions = {}): Promise<boolean> {
    if (!clipId || this.muted) return false;

    const myToken = ++this.voiceTokenCounter;
    if (opts.interrupt !== false) {
      this.stopVoice();
    }

    let decoded = this.decodedVoiceCache.get(clipId) ?? null;
    let raw = this.rawVoiceCache.get(clipId) ?? null;
    if (!decoded && !raw) {
      raw = await getVoiceBlobRecord(clipId);
      if (!raw) return false;
      this.rawVoiceCache.set(clipId, raw);
    }

    // Abort if muted or superseded while loading from IndexedDB
    if (this.muted || myToken !== this.voiceTokenCounter) return false;

    const ctx = this.ensureContext();
    if (!decoded && raw && ctx) {
      try {
        decoded = await ctx.decodeAudioData(raw.buffer.slice(0));
        this.decodedVoiceCache.set(clipId, decoded);
      } catch {
        decoded = null;
      }
    }

    if (this.muted || myToken !== this.voiceTokenCounter) return false;

    const volume = Math.max(0.05, Math.min(1.5, opts.volume ?? 1.0));
    const playbackRate = Math.max(0.65, Math.min(1.5, opts.playbackRate ?? 1.0));

    if (decoded && ctx) {
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.playbackRate.value = playbackRate;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);

      let stoppedManually = false;
      const playback: ActiveVoicePlayback = {
        ownerKey: opts.ownerKey,
        token: myToken,
        stop: () => {
          stoppedManually = true;
          try {
            source.onended = null;
            source.stop();
          } catch {
            // already stopped
          }
          source.disconnect();
          gain.disconnect();
        },
      };

      this.activeVoice = playback;
      source.onended = () => {
        if (this.activeVoice?.token === myToken) {
          this.activeVoice = null;
        }
        source.disconnect();
        gain.disconnect();
        if (!stoppedManually) {
          opts.onEnded?.();
        }
      };
      source.start(0);
      return true;
    }

    if (raw && typeof Audio !== 'undefined') {
      const blob = new Blob([raw.buffer], { type: raw.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = Math.min(1, volume);
      audio.playbackRate = playbackRate;

      let stoppedManually = false;
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
      };

      const playback: ActiveVoicePlayback = {
        ownerKey: opts.ownerKey,
        token: myToken,
        stop: () => {
          stoppedManually = true;
          audio.pause();
          cleanup();
        },
      };

      this.activeVoice = playback;
      audio.onended = () => {
        if (this.activeVoice?.token === myToken) {
          this.activeVoice = null;
        }
        cleanup();
        if (!stoppedManually) {
          opts.onEnded?.();
        }
      };
      audio.onerror = () => {
        if (this.activeVoice?.token === myToken) {
          this.activeVoice = null;
        }
        cleanup();
      };

      try {
        await audio.play();
        return true;
      } catch {
        if (this.activeVoice?.token === myToken) {
          this.activeVoice = null;
        }
        cleanup();
        return false;
      }
    }

    return false;
  }

  public playSound(effect: SoundEffect) {
    if (this.muted || effect === 'none') return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const tone = (
      freq: number,
      endFreq: number,
      dur: number,
      type: OscillatorType = 'sine',
      vol = 0.14,
      delay = 0
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + delay);
      if (endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + delay + dur);
      }
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(vol, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };

    switch (effect) {
      case 'coin':
        tone(987.77, 987.77, 0.08, 'sine', 0.14, 0);
        tone(1318.51, 1318.51, 0.2, 'sine', 0.14, 0.07);
        break;
      case 'chime':
        tone(880, 880, 0.35, 'triangle', 0.14, 0);
        tone(1320, 1320, 0.4, 'sine', 0.09, 0.04);
        break;
      case 'hit':
        tone(170, 52, 0.14, 'sawtooth', 0.18, 0);
        break;
      case 'hurt':
        tone(310, 110, 0.2, 'square', 0.14, 0);
        break;
      case 'jump':
        tone(240, 540, 0.14, 'sine', 0.12, 0);
        break;
      case 'step':
        tone(130, 75, 0.05, 'triangle', 0.05, 0);
        break;
      case 'creak':
        tone(220, 290, 0.25, 'sawtooth', 0.08, 0);
        tone(280, 195, 0.22, 'triangle', 0.08, 0.15);
        break;
      case 'whoosh':
        tone(420, 160, 0.28, 'sine', 0.11, 0);
        tone(680, 260, 0.25, 'triangle', 0.07, 0.03);
        break;
      case 'sparkle':
        tone(1046, 1568, 0.12, 'sine', 0.1, 0);
        tone(1318, 1975, 0.14, 'sine', 0.1, 0.07);
        tone(1568, 2093, 0.18, 'sine', 0.09, 0.14);
        break;
      case 'fanfare':
        tone(523.25, 523.25, 0.12, 'triangle', 0.14, 0);
        tone(659.25, 659.25, 0.12, 'triangle', 0.14, 0.12);
        tone(783.99, 783.99, 0.14, 'triangle', 0.14, 0.24);
        tone(1046.5, 1046.5, 0.42, 'triangle', 0.16, 0.38);
        break;
      case 'splash': {
        // Soft filtered water burst + bubbly droplet blips
        const bufLen = Math.floor(ctx.sampleRate * 0.22);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.36));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(920, now);
        filter.frequency.exponentialRampToValueAtTime(340, now + 0.2);
        filter.Q.value = 1.4;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        tone(320, 560, 0.09, 'sine', 0.06, 0.02);
        tone(440, 720, 0.08, 'sine', 0.045, 0.07);
        break;
      }
      case 'chop': {
        // Crisp woody axe thwack + short fibrous crack
        const bufLen = Math.floor(ctx.sampleRate * 0.11);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.22));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(640, now);
        filter.frequency.exponentialRampToValueAtTime(220, now + 0.1);
        filter.Q.value = 1.8;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        tone(195, 72, 0.09, 'triangle', 0.2, 0);
        tone(340, 140, 0.06, 'sawtooth', 0.08, 0.015);
        break;
      }
      case 'bite': {
        // Lively bobber tug + bright attention chime
        tone(380, 210, 0.09, 'sine', 0.15, 0);
        tone(760, 1180, 0.11, 'triangle', 0.13, 0.05);
        tone(1040, 1420, 0.14, 'sine', 0.11, 0.12);
        break;
      }
      case 'reel': {
        // Quick fishing reel ratchet clicks ascending
        for (let i = 0; i < 6; i++) {
          tone(520 + i * 75, 480 + i * 75, 0.035, 'triangle', 0.08, i * 0.045);
        }
        break;
      }
    }
  }

  public startMusic(mood: MusicMood) {
    if (this.muted || mood === 'none') {
      this.stopMusic();
      return;
    }
    if (this.currentMood === mood && this.musicTimer !== null) return;
    this.stopMusic();
    this.currentMood = mood;
    this.step = 0;

    const scales: Record<Exclude<MusicMood, 'none'>, { notes: number[]; tempoMs: number; wave: OscillatorType; vol: number }> = {
      calm: { notes: [261.63, 329.63, 392.0, 493.88, 392.0, 329.63], tempoMs: 620, wave: 'sine', vol: 0.045 },
      adventure: { notes: [293.66, 369.99, 440.0, 587.33, 440.0, 392.0, 329.63, 440.0], tempoMs: 360, wave: 'triangle', vol: 0.05 },
      tense: { notes: [196.0, 207.65, 196.0, 233.08, 185.0, 196.0], tempoMs: 420, wave: 'sawtooth', vol: 0.025 },
      battle: { notes: [220.0, 261.63, 329.63, 293.66, 220.0, 349.23, 329.63, 246.94], tempoMs: 240, wave: 'square', vol: 0.03 },
      mystery: { notes: [246.94, 293.66, 369.99, 466.16, 369.99, 293.66], tempoMs: 560, wave: 'sine', vol: 0.04 },
      triumph: { notes: [261.63, 329.63, 392.0, 523.25, 659.25, 523.25, 392.0, 523.25], tempoMs: 320, wave: 'triangle', vol: 0.055 },
    };

    const config = scales[mood];
    this.musicTimer = window.setInterval(() => {
      if (this.muted) return;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;
      const freq = config.notes[this.step % config.notes.length];
      this.step++;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = config.wave;
      osc.frequency.setValueAtTime(freq, now);
      const dur = (config.tempoMs / 1000) * 0.85;
      // Softly duck background music while a character voice-over is speaking
      const duckMult = this.activeVoice ? 0.32 : 1.0;
      const noteVol = Math.max(0.002, config.vol * duckMult);
      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(noteVol, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }, config.tempoMs);
  }

  public unlock() {
    this.ensureContext();
  }

  public stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentMood = 'none';
  }
}

export const AudioEngine = new MakerAudioEngine();

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  Plus,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  MessageSquare,
} from 'lucide-react';
import { resolveEffectiveDialogueMode } from '../../data/chatBubblePresets';
import type {
  ChatDisplaySettings,
  DialogueOutputMode,
  DialogueVoiceConfig,
  VoiceClipMeta,
} from '../../types/maker';
import { AudioEngine } from '../../utils/audio';
import {
  deleteVoiceRecord,
  formatVoiceDuration,
  getVoiceMeta,
  measureAudioDuration,
  saveVoiceRecord,
} from '../../utils/voiceVault';

export interface DialogueVoiceEditorProps {
  dialogueText: string;
  voiceConfig?: DialogueVoiceConfig;
  projectChatSettings?: Partial<ChatDisplaySettings>;
  onChange: (next: DialogueVoiceConfig | undefined) => void;
  singleLineOnly?: boolean;
  compact?: boolean;
  labelPrefix?: string;
}

function generateVoiceId(): string {
  return `vo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getClipIdAtLine(cfg: DialogueVoiceConfig | undefined, idx: number): string | undefined {
  if (!cfg) return undefined;
  return cfg.lineClipIds?.[idx] ?? (idx === 0 ? cfg.clipId : undefined);
}

export const DialogueVoiceEditor: React.FC<DialogueVoiceEditorProps> = ({
  dialogueText,
  voiceConfig,
  projectChatSettings,
  onChange,
  singleLineOnly = false,
  compact = false,
  labelPrefix = 'Line',
}) => {
  const [metas, setMetas] = useState<Record<string, VoiceClipMeta>>({});
  const [recordingIdx, setRecordingIdx] = useState<number | null>(null);
  const [recordingSec, setRecordingSec] = useState(0);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [extraAudioSlots, setExtraAudioSlots] = useState(0);
  const [statusError, setStatusError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const effectiveMode = resolveEffectiveDialogueMode(projectChatSettings, voiceConfig);
  const selectedMode: 'inherit' | DialogueOutputMode = voiceConfig?.mode ?? 'inherit';
  const projectDefaultMode: DialogueOutputMode = projectChatSettings?.dialogueMode ?? 'both';

  const parsedLines = useMemo(() => {
    if (singleLineOnly) {
      const single = dialogueText.trim();
      return single ? [single] : [''];
    }
    return dialogueText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [dialogueText, singleLineOnly]);

  const maxClipIdx = useMemo(() => {
    let max = -1;
    if (voiceConfig?.clipId) max = 0;
    if (voiceConfig?.lineClipIds) {
      for (const [k, v] of Object.entries(voiceConfig.lineClipIds)) {
        if (v) max = Math.max(max, Number(k));
      }
    }
    return max;
  }, [voiceConfig]);

  const slotCount = singleLineOnly
    ? 1
    : Math.max(1, parsedLines.length, maxClipIdx + 1, 1 + extraAudioSlots);

  const referencedIds = useMemo(() => {
    const ids = new Set<string>();
    if (voiceConfig?.clipId) ids.add(voiceConfig.clipId);
    if (voiceConfig?.lineClipIds) {
      for (const id of Object.values(voiceConfig.lineClipIds)) {
        if (id) ids.add(id);
      }
    }
    return Array.from(ids);
  }, [voiceConfig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = referencedIds.filter((id) => !metas[id]);
      if (missing.length === 0) return;
      const entries = await Promise.all(
        missing.map(async (id) => [id, await getVoiceMeta(id)] as const)
      );
      if (cancelled) return;
      setMetas((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [id, meta] of entries) {
          if (meta) {
            next[id] = meta;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [referencedIds, metas]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const updateConfig = (updater: (prev: DialogueVoiceConfig) => DialogueVoiceConfig) => {
    const base: DialogueVoiceConfig = {
      mode: 'inherit',
      volume: 1.0,
      playbackRate: 1.0,
      autoAdvance: false,
      ...voiceConfig,
      lineClipIds: voiceConfig?.lineClipIds ? { ...voiceConfig.lineClipIds } : undefined,
    };
    const next = updater(base);
    const hasClips =
      Boolean(next.clipId) ||
      Boolean(next.lineClipIds && Object.values(next.lineClipIds).some(Boolean));
    if (
      !hasClips &&
      (!next.mode || next.mode === 'inherit') &&
      (next.volume ?? 1) === 1 &&
      (next.playbackRate ?? 1) === 1 &&
      !next.autoAdvance
    ) {
      onChange(undefined);
      return;
    }
    onChange(next);
  };

  const assignClipToLine = async (
    lineIdx: number,
    name: string,
    mimeType: string,
    buffer: ArrayBuffer
  ) => {
    setStatusError(null);
    const id = generateVoiceId();
    const durationSec = await measureAudioDuration(buffer, mimeType);
    const meta: VoiceClipMeta = {
      id,
      name,
      mimeType: mimeType || 'audio/webm',
      byteSize: buffer.byteLength,
      durationSec,
      createdAt: new Date().toISOString(),
    };
    await saveVoiceRecord(meta, buffer);
    AudioEngine.clearVoiceCache(id);
    setMetas((prev) => ({ ...prev, [id]: meta }));

    const oldId = getClipIdAtLine(voiceConfig, lineIdx);
    updateConfig((prev) => {
      const nextLineMap = { ...(prev.lineClipIds ?? {}), [lineIdx]: id };
      return {
        ...prev,
        clipId: lineIdx === 0 ? id : prev.clipId,
        lineClipIds: nextLineMap,
      };
    });
    if (oldId && oldId !== id) {
      deleteVoiceRecord(oldId);
      AudioEngine.clearVoiceCache(oldId);
    }
  };

  const handleRemoveClip = (lineIdx: number) => {
    const oldId = getClipIdAtLine(voiceConfig, lineIdx);
    if (playingIdx === lineIdx) {
      AudioEngine.stopVoice(`editor-${lineIdx}`);
      setPlayingIdx(null);
    }
    updateConfig((prev) => {
      const nextMap = { ...(prev.lineClipIds ?? {}) };
      delete nextMap[lineIdx];
      return {
        ...prev,
        clipId: lineIdx === 0 ? undefined : prev.clipId,
        lineClipIds: Object.keys(nextMap).length > 0 ? nextMap : undefined,
      };
    });
    if (oldId) {
      deleteVoiceRecord(oldId);
      AudioEngine.clearVoiceCache(oldId);
    }
  };

  const handleUploadFile = async (lineIdx: number, file: File | undefined) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await assignClipToLine(lineIdx, file.name, file.type || 'audio/mpeg', buffer);
    } catch {
      setStatusError('Could not read that audio file. Try MP3, WAV, OGG, or WebM.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecordingIdx(null);
  };

  const startRecording = async (lineIdx: number) => {
    setStatusError(null);
    if (recordingIdx !== null) {
      stopRecording();
      return;
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setStatusError('Microphone recording is unavailable in this browser. Upload an audio file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size > 0) {
          const buf = await blob.arrayBuffer();
          await assignClipToLine(lineIdx, `${labelPrefix} ${lineIdx + 1} voice`, mimeType, buf);
        }
      };

      mediaRecorderRef.current = recorder;
      setRecordingIdx(lineIdx);
      setRecordingSec(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSec((s) => s + 1);
      }, 1000);
      recorder.start();
    } catch {
      setStatusError('Microphone permission denied or no mic detected.');
      setRecordingIdx(null);
    }
  };

  const handleTogglePreview = async (lineIdx: number) => {
    const clipId = getClipIdAtLine(voiceConfig, lineIdx);
    if (!clipId) return;
    if (playingIdx === lineIdx) {
      AudioEngine.stopVoice(`editor-${lineIdx}`);
      setPlayingIdx(null);
      return;
    }
    AudioEngine.unlock();
    setPlayingIdx(lineIdx);
    const started = await AudioEngine.playVoiceClip(clipId, {
      ownerKey: `editor-${lineIdx}`,
      volume: voiceConfig?.volume ?? 1.0,
      playbackRate: voiceConfig?.playbackRate ?? 1.0,
      onEnded: () => {
        setPlayingIdx((cur) => (cur === lineIdx ? null : cur));
      },
    });
    if (!started) {
      setPlayingIdx(null);
      setStatusError('Audio playback could not start for this clip.');
    }
  };

  const hasAnyClip = referencedIds.length > 0;
  const modeOptions: { id: 'inherit' | DialogueOutputMode; label: string }[] = [
    { id: 'inherit', label: 'Default' },
    { id: 'text', label: 'Text' },
    { id: 'audio', label: 'Audio' },
    { id: 'both', label: 'Both' },
  ];

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {/* Dialogue Presentation Mode: Text / Audio / Both */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">
          <span>Dialogue Format</span>
          <span className="truncate">
            {selectedMode === 'inherit'
              ? `Using game default (${projectDefaultMode === 'both' ? 'Text + Audio' : projectDefaultMode === 'audio' ? 'Audio only' : 'Text only'})`
              : effectiveMode === 'both'
              ? 'Text + Voice audio'
              : effectiveMode === 'audio'
              ? 'Audio only (hides text box)'
              : 'Text only (mutes voice)'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/70 dark:border-white/[0.06]">
          {modeOptions.map((opt) => {
            const active = selectedMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateConfig((prev) => ({ ...prev, mode: opt.id }))}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#7C5CFF] text-white'
                    : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Voice-Over Clips (shown whenever mode allows audio or clips are attached) */}
      {(effectiveMode !== 'text' || hasAnyClip) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0] inline-flex items-center gap-1.5">
              <Volume2 size={12} />
              <span>Voice-Over Clips</span>
            </span>
            {!singleLineOnly && (
              <button
                type="button"
                onClick={() => setExtraAudioSlots((c) => Math.max(c + 1, slotCount - 1 + 1))}
                className="text-[11px] font-bold text-[#7C5CFF] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Plus size={11} />
                <span>Add voice line</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {Array.from({ length: slotCount }, (_, idx) => {
              const clipId = getClipIdAtLine(voiceConfig, idx);
              const meta = clipId ? metas[clipId] : undefined;
              const linePreview = parsedLines[idx];
              const isRecordingThis = recordingIdx === idx;
              const isPlayingThis = playingIdx === idx;

              return (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/70 dark:border-white/[0.06] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
                        {slotCount > 1 ? `${labelPrefix} ${idx + 1}` : 'Voice-Over'}
                        {linePreview ? ` · "${linePreview}"` : ''}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-[#949BB0] truncate tabular-nums">
                        {isRecordingThis
                          ? `Recording audio... 0:${recordingSec < 10 ? '0' : ''}${recordingSec}`
                          : meta
                          ? `${meta.name} · ${formatVoiceDuration(meta.durationSec)}`
                          : clipId
                          ? 'Voice clip ready'
                          : 'No voice clip attached'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {clipId && (
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(idx)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                            isPlayingThis
                              ? 'bg-[#20B46A] text-white'
                              : 'bg-slate-100 dark:bg-[#1F2430] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#272D3C]'
                          }`}
                          title={isPlayingThis ? 'Stop preview' : 'Play preview'}
                        >
                          {isPlayingThis ? <Square size={10} fill="currentColor" /> : <Volume2 size={11} />}
                          <span>{isPlayingThis ? 'Stop' : 'Play'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => (isRecordingThis ? stopRecording() : startRecording(idx))}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                          isRecordingThis
                            ? 'bg-[#F2545B] text-white'
                            : 'bg-slate-100 dark:bg-[#1F2430] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#272D3C]'
                        }`}
                        title={isRecordingThis ? 'Stop recording' : 'Record from microphone'}
                      >
                        {isRecordingThis ? <Square size={10} fill="currentColor" /> : <Mic size={11} />}
                        <span>{isRecordingThis ? 'Stop' : 'Rec'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[idx]?.click()}
                        className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] hover:bg-slate-200 dark:hover:bg-[#272D3C] text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                        title="Upload audio file (.mp3, .wav, .ogg, .m4a, .webm)"
                      >
                        <Upload size={11} />
                        <span>Upload</span>
                      </button>

                      {clipId && (
                        <button
                          type="button"
                          onClick={() => handleRemoveClip(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#F2545B] transition-colors"
                          title="Remove voice clip"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}

                      <input
                        ref={(el) => {
                          fileInputRefs.current[idx] = el;
                        }}
                        type="file"
                        accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm,.aac"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          handleUploadFile(idx, file);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Voice tuning controls */}
          {hasAnyClip && (
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200/70 dark:border-white/[0.06] space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold text-slate-600 dark:text-[#949BB0]">
                    <span>Voice Volume</span>
                    <span className="tabular-nums">{Math.round((voiceConfig?.volume ?? 1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={1.5}
                    step={0.05}
                    value={voiceConfig?.volume ?? 1}
                    onChange={(e) =>
                      updateConfig((prev) => ({ ...prev, volume: Number(e.target.value) }))
                    }
                    className="w-full accent-[#7C5CFF]"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold text-slate-600 dark:text-[#949BB0]">
                    <span>Speed / Pitch</span>
                    <span className="tabular-nums">{(voiceConfig?.playbackRate ?? 1).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.75}
                    max={1.35}
                    step={0.05}
                    value={voiceConfig?.playbackRate ?? 1}
                    onChange={(e) =>
                      updateConfig((prev) => ({ ...prev, playbackRate: Number(e.target.value) }))
                    }
                    className="w-full accent-[#7C5CFF]"
                  />
                </label>
              </div>

              {!singleLineOnly && slotCount > 1 && (
                <label className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-[#949BB0] cursor-pointer pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
                  <span>Auto-advance when voice finishes</span>
                  <input
                    type="checkbox"
                    checked={Boolean(voiceConfig?.autoAdvance)}
                    onChange={(e) =>
                      updateConfig((prev) => ({ ...prev, autoAdvance: e.target.checked }))
                    }
                    className="accent-[#7C5CFF] w-3.5 h-3.5"
                  />
                </label>
              )}
            </div>
          )}

          {effectiveMode === 'audio' && !hasAnyClip && (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-700 dark:text-amber-300">
              <VolumeX size={13} className="shrink-0" />
              <span>Record or upload at least one audio clip for Audio Only dialogue.</span>
            </div>
          )}
        </div>
      )}

      {effectiveMode === 'text' && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/70 dark:bg-[#171A23]/70 text-[11px] text-slate-500 dark:text-[#949BB0]">
          <MessageSquare size={12} className="shrink-0" />
          <span>Text only active — voice-over playback is muted for this dialogue.</span>
        </div>
      )}

      {statusError && (
        <div className="px-2.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-600 dark:text-rose-300">
          {statusError}
        </div>
      )}
    </div>
  );
};

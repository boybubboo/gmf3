import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, History, MessageCircle, X } from 'lucide-react';
import {
  getChatFontOption,
  hexToRgba,
  resolveChatBubbleStyle,
  resolveChatDisplaySettings,
} from '../../data/chatBubblePresets';
import type { ChatBubbleStyle, ChatDisplaySettings, EntityKind, HudWidgetShape } from '../../types/maker';
import { buildSurfaceVisualStyles } from '../../utils/hudMaterials';

export interface ChatHistoryEntry {
  id: string;
  speaker: string;
  speakerColor: string;
  text: string;
}

export function useTypewriterText(
  text: string,
  enabled: boolean,
  speedCps: number,
  replayNonce = 0
): { visibleText: string; isTyping: boolean; revealAll: () => void } {
  const [shownCount, setShownCount] = useState<number>(() => (enabled ? 0 : text.length));

  useEffect(() => {
    if (!enabled || !text) {
      setShownCount(text.length);
      return;
    }
    setShownCount(0);
    const intervalMs = Math.max(10, Math.round(1000 / Math.max(12, speedCps)));
    const timer = window.setInterval(() => {
      setShownCount((prev) => {
        if (prev >= text.length) {
          window.clearInterval(timer);
          return text.length;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [text, enabled, speedCps, replayNonce]);

  const isTyping = enabled && shownCount < text.length;
  const visibleText = enabled ? text.slice(0, shownCount) : text;
  const revealAll = () => setShownCount(text.length);

  return { visibleText, isTyping, revealAll };
}

function computeShadow(style: ChatBubbleStyle): string {
  const d3 = style.depth3d ?? 0;
  const glow = style.glowColor ?? style.borderColor;
  if (style.shape === 'glass3d' || d3 >= 0.45) {
    const ext = Math.round(3 + d3 * 6);
    return `0 ${ext}px 0 ${hexToRgba(style.borderColor, 0.72)}, 0 ${ext + 10}px 24px rgba(0,0,0,0.42), inset 0 2px 3px rgba(255,255,255,0.48), inset 0 -4px 8px rgba(0,0,0,0.28)`;
  }
  switch (style.shadowStyle) {
    case 'none':
      return 'none';
    case 'hard':
      return `4px 4px 0px ${style.borderColor}`;
    case 'glow':
      return `0 0 18px ${hexToRgba(glow, 0.5)}, 0 4px 14px rgba(0,0,0,0.4)`;
    case 'soft':
    default:
      return '0 10px 24px -6px rgba(0, 0, 0, 0.32), 0 3px 8px -2px rgba(0, 0, 0, 0.18)';
  }
}

function computeBorderRadius(style: ChatBubbleStyle): string {
  switch (style.shape) {
    case 'pill':
      return '999px';
    case 'sharp':
    case 'sciFiHolo':
      return `${Math.min(4, style.borderRadius)}px`;
    case 'graphicNovel':
      return '4px';
    case 'parchmentTorn':
      return '5px';
    case 'woodenPlaque':
      return '10px';
    case 'glass3d':
      return `${Math.max(16, style.borderRadius)}px`;
    case 'thought':
      return `${Math.max(22, style.borderRadius)}px`;
    case 'shout':
      return '4px';
    case 'scroll':
      return '6px';
    case 'comic':
      return `${Math.max(10, Math.min(20, style.borderRadius))}px`;
    case 'rounded':
    default:
      return `${style.borderRadius}px`;
  }
}

function mapBubbleShapeToHudShape(shape: ChatBubbleStyle['shape']): HudWidgetShape {
  switch (shape) {
    case 'graphicNovel':
      return 'slant';
    case 'parchmentTorn':
      return 'tornOrganic';
    case 'sciFiHolo':
      return 'chamfer';
    case 'sharp':
      return 'sharp';
    case 'pill':
      return 'circle';
    default:
      return 'rounded';
  }
}

function getEntranceClass(anim: ChatBubbleStyle['entranceAnim']): string {
  switch (anim) {
    case 'pop':
      return 'maker-bubble-pop';
    case 'float':
      return 'maker-bubble-float';
    case 'fade':
      return 'maker-bubble-fade';
    case 'none':
    default:
      return '';
  }
}

export interface ChatBubbleViewProps {
  speaker: string;
  text: string;
  style?: Partial<ChatBubbleStyle>;
  kind?: EntityKind | 'hero';
  replayNonce?: number;
  compact?: boolean;
  lineCounter?: string;
  actionHint?: string;
  onClick?: () => void;
  onDismiss?: () => void;
}

export const ChatBubbleView: React.FC<ChatBubbleViewProps> = ({
  speaker,
  text,
  style: rawStyle,
  kind,
  replayNonce = 0,
  compact = false,
  lineCounter,
  actionHint,
  onClick,
  onDismiss,
}) => {
  const style = useMemo(() => resolveChatBubbleStyle(rawStyle, kind), [rawStyle, kind]);
  const font = useMemo(() => getChatFontOption(style.fontFamily), [style.fontFamily]);
  const { visibleText, isTyping, revealAll } = useTypewriterText(
    text,
    !compact && style.typewriterEffect,
    style.typewriterSpeed,
    replayNonce
  );

  const clampedOpacity = Math.max(0.1, Math.min(1, style.opacity));
  const bgRgba = hexToRgba(style.bgColor, clampedOpacity);
  const borderRadius = computeBorderRadius(style);
  const boxShadow = computeShadow(style);
  const animClass = compact ? '' : getEntranceClass(style.entranceAnim);

  const fontWeightVal =
    style.fontWeight === 'bold' ? 700 : style.fontWeight === 'semibold' ? 600 : 400;

  const isScroll = style.shape === 'scroll';
  const isSharp = style.shape === 'sharp';
  const isThought = style.shape === 'thought';
  const isShout = style.shape === 'shout';
  const isGraphicNovel = style.shape === 'graphicNovel';
  const isGlass3d = style.shape === 'glass3d';
  const isParchmentTorn = style.shape === 'parchmentTorn';
  const isSciFiHolo = style.shape === 'sciFiHolo';
  const isWoodPlaque = style.shape === 'woodenPlaque';

  const resolvedTexture =
    style.surfaceTexture ??
    (isParchmentTorn
      ? 'parchment'
      : isWoodPlaque
      ? 'wood'
      : isSciFiHolo
      ? 'holoGlass'
      : isGraphicNovel
      ? 'comicHalftone'
      : isGlass3d
      ? 'arcadePlastic'
      : 'smooth');

  const resolvedTears = style.paperTears ?? (isParchmentTorn ? 0.55 : 0);
  const resolvedBurns = style.burnedEdges ?? (isParchmentTorn ? 0.72 : 0);
  const resolvedWear = style.edgeWear ?? (isParchmentTorn ? 0.45 : isWoodPlaque ? 0.25 : 0);

  const surface = useMemo(
    () =>
      buildSurfaceVisualStyles({
        surfaceTexture: resolvedTexture,
        shape: mapBubbleShapeToHudShape(style.shape),
        bgHex: style.bgColor,
        borderHex: style.borderColor,
        borderStyle: isSciFiHolo ? 'glowing' : isWoodPlaque ? 'ornate' : 'solid',
        borderWidth: style.borderWidth,
        cornerRadius: style.borderRadius,
        edgeWear: resolvedWear,
        burnedEdges: resolvedBurns,
        paperTears: resolvedTears,
        glowIntensity: style.shadowStyle === 'glow' || isSciFiHolo ? 0.65 : 0,
        glowHex: style.glowColor ?? style.borderColor,
        shadowDepth: style.depth3d ?? 0.35,
        rotationDeg: style.rotationDeg ?? (isGraphicNovel ? -1.2 : 0),
        opacity: clampedOpacity,
        seed: speaker.length * 7 + 3,
      }),
    [
      resolvedTexture,
      style.shape,
      style.bgColor,
      style.borderColor,
      style.borderWidth,
      style.borderRadius,
      style.shadowStyle,
      style.glowColor,
      style.depth3d,
      style.rotationDeg,
      resolvedWear,
      resolvedBurns,
      resolvedTears,
      isSciFiHolo,
      isWoodPlaque,
      isGraphicNovel,
      clampedOpacity,
      speaker.length,
    ]
  );

  const effectiveTail = style.tailStyle;

  const handleInteract = (e: React.MouseEvent) => {
    if (!onClick && !isTyping) return;
    e.stopPropagation();
    if (isTyping) {
      revealAll();
      return;
    }
    onClick?.();
  };

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${animClass}`}
      style={{
        maxWidth: compact ? '100%' : `${style.maxWidth}px`,
        opacity: clampedOpacity,
        transform: surface.outerStyle.transform,
        filter: surface.usesClipPath ? surface.outerStyle.filter : undefined,
      }}
      onClick={handleInteract}
    >
      {/* Shout spiky top accent badge */}
      {isShout && !compact && (
        <svg
          width="54"
          height="11"
          viewBox="0 0 54 11"
          className="pointer-events-none -mb-[2px] z-10"
          aria-hidden="true"
        >
          <polygon
            points="4,11 11,2 19,11 27,0 35,11 43,3 50,11"
            fill={bgRgba}
            stroke={style.borderColor}
            strokeWidth={Math.max(1.5, Math.min(3, style.borderWidth))}
            strokeLinejoin="miter"
          />
          <rect x="2" y="9" width="50" height="3" fill={bgRgba} />
        </svg>
      )}

      {/* Main bubble body */}
      <div
        className={`relative transition-transform overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
        style={{
          ...surface.surfaceStyle,
          backgroundColor: style.bgColor,
          color: style.textColor,
          borderStyle: isWoodPlaque ? 'double' : 'solid',
          borderWidth: `${style.borderWidth}px`,
          borderColor: style.borderColor,
          borderRadius: surface.usesClipPath ? surface.surfaceStyle.borderRadius : borderRadius,
          boxShadow: surface.usesClipPath
            ? surface.surfaceStyle.boxShadow
            : [boxShadow, surface.surfaceStyle.boxShadow].filter(Boolean).join(', '),
          filter: surface.wearFilterUrl,
          padding: compact
            ? '8px 12px'
            : style.shape === 'pill'
            ? '10px 18px'
            : isGraphicNovel || isParchmentTorn
            ? '11px 18px'
            : '10px 14px',
          minWidth: compact ? '140px' : '118px',
          outline:
            isSharp && style.borderWidth > 0
              ? `2px solid ${hexToRgba(style.bgColor, Math.min(1, clampedOpacity))}`
              : undefined,
          outlineOffset: isSharp ? '-5px' : undefined,
        }}
      >
        {/* Burned / scorched parchment vignette overlay */}
        {surface.burnOverlayStyle && (
          <span
            className="pointer-events-none absolute inset-0 z-[1]"
            style={surface.burnOverlayStyle}
          />
        )}

        {/* 3D Gloss top highlight arc */}
        {isGlass3d && (
          <span
            className="pointer-events-none absolute inset-x-2 top-1 h-[38%] rounded-full opacity-45 z-[1]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, transparent 100%)',
            }}
          />
        )}

        {/* Fantasy scroll / Wood plaque / Sci-Fi Holo corner trims */}
        {(isScroll || isWoodPlaque || isSciFiHolo) && (
          <>
            <span
              className="pointer-events-none absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 opacity-75 z-[2]"
              style={{ borderColor: style.borderColor }}
            />
            <span
              className="pointer-events-none absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 opacity-75 z-[2]"
              style={{ borderColor: style.borderColor }}
            />
            <span
              className="pointer-events-none absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 opacity-75 z-[2]"
              style={{ borderColor: style.borderColor }}
            />
            <span
              className="pointer-events-none absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 opacity-75 z-[2]"
              style={{ borderColor: style.borderColor }}
            />
          </>
        )}

        {/* Thought cloud subtle outer bumps */}
        {isThought && (
          <>
            <span
              className="pointer-events-none absolute -top-2 left-5 w-5 h-3 rounded-full"
              style={{
                backgroundColor: style.bgColor,
                borderTop: `${Math.max(1, style.borderWidth)}px solid ${style.borderColor}`,
              }}
            />
            <span
              className="pointer-events-none absolute -top-1.5 right-6 w-4 h-2.5 rounded-full"
              style={{
                backgroundColor: style.bgColor,
                borderTop: `${Math.max(1, style.borderWidth)}px solid ${style.borderColor}`,
              }}
            />
          </>
        )}

        {/* Speaker header row */}
        {style.showSpeakerName && (
          <div
            className={`relative z-10 flex items-center gap-2 mb-1 ${
              style.textAlign === 'center' ? 'justify-center' : 'justify-between'
            }`}
          >
            <span
              className="truncate leading-tight"
              style={{
                color: style.speakerColor,
                fontFamily: font.cssFamily,
                letterSpacing: font.letterSpacing ?? '0.01em',
                fontSize: `${Math.max(10, Math.round(style.fontSize * 0.84))}px`,
                fontWeight: 700,
              }}
            >
              {speaker}
            </span>
            {onDismiss && !compact && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: style.textColor }}
                title="Close"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Message body */}
        <p
          className="relative z-10 m-0 break-words leading-snug"
          style={{
            fontFamily: font.cssFamily,
            fontSize: `${compact ? Math.min(13, style.fontSize) : style.fontSize}px`,
            fontWeight: fontWeightVal,
            fontStyle: style.italic ? 'italic' : 'normal',
            letterSpacing: font.letterSpacing,
            textAlign: style.textAlign,
            color: style.textColor,
          }}
        >
          {visibleText}
          {isTyping && (
            <span
              className="inline-block w-[2px] h-[0.95em] align-middle ml-0.5 opacity-80"
              style={{ backgroundColor: style.speakerColor }}
            />
          )}
        </p>

        {/* Optional footer hint / multi-line counter */}
        {(lineCounter || actionHint) && !compact && (
          <div
            className="relative z-10 mt-1.5 flex items-center justify-between gap-3 text-[10px] opacity-65"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: style.textColor,
            }}
          >
            <span className="tabular-nums">{lineCounter ?? ''}</span>
            {actionHint && (
              <span className="inline-flex items-center gap-0.5 font-semibold">
                <span>{isTyping ? 'Skip' : actionHint}</span>
                <ChevronRight size={11} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tail */}
      {effectiveTail === 'pointer' && (
        <svg
          width="18"
          height="11"
          viewBox="0 0 18 11"
          className="pointer-events-none -mt-[2px] shrink-0"
          aria-hidden="true"
        >
          <path
            d="M2,0 L9,9.5 L16,0"
            fill={style.bgColor}
            stroke={style.borderColor}
            strokeWidth={Math.max(1, style.borderWidth)}
            strokeLinejoin="round"
          />
          <rect x="2" y="0" width="14" height="2.4" fill={style.bgColor} />
        </svg>
      )}

      {effectiveTail === 'curved' && (
        <svg
          width="24"
          height="14"
          viewBox="0 0 24 14"
          className="pointer-events-none -mt-[2px] shrink-0"
          aria-hidden="true"
        >
          <path
            d="M4,0 C6,6 9,11 17,12.5 C12.5,8.5 13,4 16,0"
            fill={style.bgColor}
            stroke={style.borderColor}
            strokeWidth={Math.max(1, style.borderWidth)}
            strokeLinejoin="round"
          />
          <rect x="4" y="0" width="12" height="2.4" fill={style.bgColor} />
        </svg>
      )}

      {effectiveTail === 'dots' && (
        <div className="pointer-events-none flex flex-col items-center gap-1 mt-1" aria-hidden="true">
          <span
            className="w-2.5 h-2.5 rounded-full block"
            style={{
              backgroundColor: style.bgColor,
              border: `${Math.max(1, Math.min(2, style.borderWidth))}px solid ${style.borderColor}`,
            }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full block -translate-x-1"
            style={{
              backgroundColor: style.bgColor,
              border: `${Math.max(1, Math.min(2, style.borderWidth))}px solid ${style.borderColor}`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export interface BottomChatPanelViewProps {
  speaker: string;
  roleLabel?: string;
  text: string;
  characterStyle?: Partial<ChatBubbleStyle>;
  kind?: EntityKind | 'hero';
  settings?: Partial<ChatDisplaySettings>;
  history?: ChatHistoryEntry[];
  lineIndex?: number;
  totalLines?: number;
  replayNonce?: number;
  previewMode?: boolean;
  onAdvance?: () => void;
  onClose?: () => void;
}

export const BottomChatPanelView: React.FC<BottomChatPanelViewProps> = ({
  speaker,
  roleLabel,
  text,
  characterStyle,
  kind,
  settings: rawSettings,
  history = [],
  lineIndex = 0,
  totalLines = 1,
  replayNonce = 0,
  previewMode = false,
  onAdvance,
  onClose,
}) => {
  const settings = useMemo(() => resolveChatDisplaySettings(rawSettings), [rawSettings]);
  const charStyle = useMemo(
    () => resolveChatBubbleStyle(characterStyle, kind),
    [characterStyle, kind]
  );
  const [historyOpen, setHistoryOpen] = useState(false);

  const useChar = settings.panelUseCharacterStyle;
  const resolvedFontId = useChar
    ? charStyle.fontFamily
    : settings.panelFontFamily ??
      (settings.panelTheme === 'parchment'
        ? 'garamond'
        : settings.panelTheme === 'retro'
        ? 'pixel'
        : settings.panelTheme === 'sciFi'
        ? 'tactical'
        : settings.panelTheme === 'comic'
        ? 'comic'
        : settings.panelTheme === 'wood'
        ? 'cinzel'
        : 'sans');

  const font = useMemo(() => getChatFontOption(resolvedFontId), [resolvedFontId]);

  const { visibleText, isTyping, revealAll } = useTypewriterText(
    text,
    charStyle.typewriterEffect,
    charStyle.typewriterSpeed,
    replayNonce
  );

  const bgColor = useChar ? charStyle.bgColor : settings.panelBgColor;
  const borderColor = useChar ? charStyle.borderColor : settings.panelBorderColor;
  const textColor = useChar ? charStyle.textColor : settings.panelTextColor;
  const speakerColor = charStyle.speakerColor;
  const opacity = Math.max(0.15, Math.min(1, settings.panelOpacity));
  const isRetro = settings.panelTheme === 'retro' || (useChar && charStyle.shape === 'sharp');
  const isComic =
    settings.panelTheme === 'comic' ||
    (useChar &&
      (charStyle.shape === 'comic' ||
        charStyle.shape === 'shout' ||
        charStyle.shape === 'graphicNovel'));

  const panelTexture =
    (useChar ? charStyle.surfaceTexture : undefined) ??
    settings.panelTexture ??
    (settings.panelTheme === 'parchment'
      ? 'parchment'
      : settings.panelTheme === 'sciFi'
      ? 'circuitTech'
      : settings.panelTheme === 'comic'
      ? 'comicHalftone'
      : settings.panelTheme === 'wood'
      ? 'wood'
      : 'smooth');

  const panelShape: HudWidgetShape =
    settings.panelShape ??
    (isRetro
      ? 'sharp'
      : settings.panelTheme === 'sciFi'
      ? 'chamfer'
      : settings.panelTheme === 'comic'
      ? 'slant'
      : 'rounded');

  const panelSurface = useMemo(
    () =>
      buildSurfaceVisualStyles({
        surfaceTexture: panelTexture,
        shape: panelShape,
        bgHex: bgColor,
        borderHex: borderColor,
        borderStyle: settings.panelTheme === 'sciFi' ? 'glowing' : settings.panelTheme === 'wood' ? 'ornate' : 'solid',
        borderWidth: isRetro || isComic ? 2.5 : 1.5,
        cornerRadius: isRetro ? 4 : 16,
        edgeWear: (useChar ? charStyle.edgeWear : undefined) ?? settings.panelEdgeWear ?? 0,
        burnedEdges: (useChar ? charStyle.burnedEdges : undefined) ?? settings.panelBurnedEdges ?? 0,
        paperTears: (useChar ? charStyle.paperTears : undefined) ?? settings.panelPaperTears ?? 0,
        glowIntensity: settings.panelTheme === 'sciFi' ? 0.55 : 0,
        glowHex: borderColor,
        shadowDepth: 0.6,
        opacity,
        seed: 23,
      }),
    [
      panelTexture,
      panelShape,
      bgColor,
      borderColor,
      settings.panelTheme,
      settings.panelEdgeWear,
      settings.panelBurnedEdges,
      settings.panelPaperTears,
      isRetro,
      isComic,
      useChar,
      charStyle.edgeWear,
      charStyle.burnedEdges,
      charStyle.paperTears,
      opacity,
    ]
  );

  const panelRadius = isRetro ? '4px' : '16px';
  const panelShadow = isComic
    ? `4px 4px 0px ${borderColor}`
    : '0 14px 36px -8px rgba(0, 0, 0, 0.52)';

  const hasMoreLines = lineIndex + 1 < totalLines;
  const initials =
    speaker
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';

  const handlePanelClick = () => {
    if (isTyping) {
      revealAll();
      return;
    }
    if (hasMoreLines) {
      onAdvance?.();
    } else {
      onClose?.();
    }
  };

  return (
    <div
      className={`w-full ${previewMode ? '' : 'max-w-2xl mx-auto maker-panel-rise'}`}
      style={{
        opacity,
        filter: panelSurface.usesClipPath ? panelSurface.outerStyle.filter : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Optional collapsible recent dialogue history */}
      {settings.panelShowHistory && historyOpen && history.length > 0 && (
        <div
          className="mb-2 max-h-40 overflow-y-auto maker-scroll p-3 space-y-1.5"
          style={{
            backgroundColor: hexToRgba(bgColor, Math.min(1, opacity)),
            border: `1.5px solid ${borderColor}`,
            borderRadius: panelRadius,
            color: textColor,
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold opacity-70 pb-1 border-b border-current/10">
            <span>Recent dialogue</span>
            <span className="tabular-nums">{history.length} lines</span>
          </div>
          {history.slice(-8).map((entry) => (
            <div key={entry.id} className="text-xs leading-snug">
              <span className="font-bold mr-1.5" style={{ color: entry.speakerColor }}>
                {entry.speaker}:
              </span>
              <span className="opacity-90">{entry.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Chat Panel Body */}
      <div
        onClick={previewMode ? undefined : handlePanelClick}
        className={`relative w-full overflow-hidden ${previewMode ? '' : 'cursor-pointer'}`}
        style={{
          ...panelSurface.surfaceStyle,
          color: textColor,
          boxShadow: panelSurface.usesClipPath
            ? panelSurface.surfaceStyle.boxShadow
            : [panelShadow, panelSurface.surfaceStyle.boxShadow].filter(Boolean).join(', '),
          filter: panelSurface.wearFilterUrl,
          padding: settings.panelCompact ? '12px 16px' : '16px 20px',
          outline: isRetro ? `2px solid ${hexToRgba(bgColor, opacity)}` : undefined,
          outlineOffset: isRetro ? '-5px' : undefined,
        }}
      >
        {panelSurface.burnOverlayStyle && (
          <span
            className="pointer-events-none absolute inset-0 z-[1]"
            style={panelSurface.burnOverlayStyle}
          />
        )}
        <div className="relative z-10 flex items-start gap-3.5">
          {/* Speaker portrait / emblem */}
          {settings.panelShowPortrait && (
            <div
              className="shrink-0 flex items-center justify-center font-extrabold select-none"
              style={{
                width: settings.panelCompact ? '38px' : '46px',
                height: settings.panelCompact ? '38px' : '46px',
                borderRadius: isRetro ? '4px' : '12px',
                backgroundColor: hexToRgba(speakerColor, 0.16),
                border: `1.5px solid ${hexToRgba(speakerColor, 0.55)}`,
                color: speakerColor,
                fontFamily: font.cssFamily,
                fontSize: settings.panelCompact ? '13px' : '15px',
              }}
              aria-hidden="true"
            >
              {initials}
            </div>
          )}

          {/* Speaker & Text */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="truncate leading-tight"
                  style={{
                    color: speakerColor,
                    fontFamily: font.cssFamily,
                    letterSpacing: font.letterSpacing ?? '0.01em',
                    fontSize: settings.panelCompact ? '13px' : '14px',
                    fontWeight: 700,
                  }}
                >
                  {speaker}
                </span>
                {roleLabel && (
                  <>
                    <span className="opacity-35 text-xs" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[11px] opacity-65 truncate">{roleLabel}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {settings.panelShowHistory && history.length > 0 && !previewMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryOpen((v) => !v);
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 opacity-75 hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor: hexToRgba(textColor, 0.08),
                      color: textColor,
                    }}
                    title="Toggle chat history"
                  >
                    <History size={12} />
                    <span>Log</span>
                  </button>
                )}

                {onClose && !previewMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor: hexToRgba(textColor, 0.08),
                      color: textColor,
                    }}
                    title="Close dialogue"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <p
              className="m-0 leading-relaxed break-words"
              style={{
                fontFamily: font.cssFamily,
                fontSize: `${Math.max(12, Math.min(20, useChar ? charStyle.fontSize + 1 : 14))}px`,
                fontWeight:
                  useChar && charStyle.fontWeight === 'bold'
                    ? 700
                    : useChar && charStyle.fontWeight === 'semibold'
                    ? 600
                    : 500,
                fontStyle: useChar && charStyle.italic ? 'italic' : 'normal',
                letterSpacing: font.letterSpacing,
                color: textColor,
              }}
            >
              {visibleText}
              {isTyping && (
                <span
                  className="inline-block w-[2px] h-[0.95em] align-middle ml-0.5 opacity-80"
                  style={{ backgroundColor: speakerColor }}
                />
              )}
            </p>

            {/* Footer line counter + Continue action */}
            {!previewMode && (
              <div className="pt-1 flex items-center justify-between gap-2 text-[11px] opacity-70">
                <span className="tabular-nums inline-flex items-center gap-1.5">
                  <MessageCircle size={11} />
                  {totalLines > 1 ? `Line ${lineIndex + 1} of ${totalLines}` : 'Press E or click to continue'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePanelClick();
                  }}
                  className="inline-flex items-center gap-1 font-bold hover:opacity-100"
                  style={{ color: speakerColor }}
                >
                  <span>{isTyping ? 'Reveal' : hasMoreLines ? 'Next' : 'Done'}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

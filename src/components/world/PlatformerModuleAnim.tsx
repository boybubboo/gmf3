import React from 'react';
import type { PlatformerModuleId } from '../../types/maker';

interface PlatformerModuleAnimProps {
  moduleId: PlatformerModuleId;
  accent: string;
  className?: string;
}

export const PlatformerModuleAnim: React.FC<PlatformerModuleAnimProps> = ({
  moduleId,
  accent,
  className = 'w-full h-full',
}) => {
  const heroColor = '#6D4AFF';
  const heroHi = '#A5B4FC';

  const renderScene = (): React.ReactNode => {
    switch (moduleId) {
      // 1. Dynamic Platforms & Terrain Surfaces
      case 'shuttlePlatform':
        return (
          <>
            <line x1="16" y1="30" x2="80" y2="30" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="16" cy="30" r="2.2" fill="currentColor" fillOpacity="0.35" />
            <circle cx="80" cy="30" r="2.2" fill="currentColor" fillOpacity="0.35" />
            <g className="pm-tbox pm-shuttle">
              <rect x="33" y="25" width="30" height="8" rx="3" fill={accent} />
              <rect x="36" y="26.5" width="24" height="2" rx="1" fill="#fff" fillOpacity="0.4" />
              <circle cx="48" cy="19" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'elevatorPlatform':
        return (
          <>
            <line x1="48" y1="8" x2="48" y2="44" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M22 16 L22 36 M19 19 L22 15 L25 19 M19 33 L22 37 L25 33" stroke={accent} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <g className="pm-tbox pm-elevator">
              <rect x="33" y="23" width="30" height="7" rx="3" fill={accent} />
              <circle cx="48" cy="17.5" r="4.5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'orbitPlatform':
        return (
          <>
            <ellipse cx="48" cy="26" rx="18" ry="11" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.8" strokeDasharray="3 3" />
            <circle cx="48" cy="26" r="3" fill={accent} fillOpacity="0.5" />
            <g className="pm-tbox pm-orbit">
              <rect x="37" y="23" width="22" height="6.5" rx="3" fill={accent} />
              <circle cx="48" cy="18.5" r="4" fill={heroColor} stroke="#fff" strokeWidth="1.1" />
            </g>
          </>
        );

      case 'splinePlatform':
        return (
          <>
            <path d="M16 34 Q36 10 54 24 T80 28" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="16" cy="34" r="2.3" fill={accent} />
            <circle cx="48" cy="19" r="2.3" fill={accent} />
            <circle cx="80" cy="28" r="2.3" fill={accent} />
            <g className="pm-tbox pm-spline">
              <rect x="37" y="23" width="22" height="6.5" rx="3" fill={accent} />
              <circle cx="48" cy="18" r="4" fill={heroColor} stroke="#fff" strokeWidth="1.1" />
            </g>
          </>
        );

      case 'crumblingPlatform':
        return (
          <>
            <g className="pm-tbox pm-crumble">
              <rect x="28" y="22" width="40" height="11" rx="3" fill={accent} />
              <path d="M40 22 L44 27 L41 33 M56 22 L53 28 L57 33" stroke="#1E1B18" strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
              <circle cx="48" cy="16" r="4.5" fill={heroColor} stroke="#fff" strokeWidth="1.1" />
            </g>
            <line x1="20" y1="45" x2="76" y2="45" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" strokeDasharray="2 3" />
          </>
        );

      case 'oneWayPlatform':
        return (
          <>
            <rect x="20" y="25" width="56" height="5" rx="2.5" fill={accent} />
            <path d="M31 41 L31 19 M27 23 L31 18 L35 23" stroke={accent} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
            <g className="pm-tbox pm-oneway-hero">
              <circle cx="52" cy="22" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'seesawPlatform':
        return (
          <>
            <polygon points="48,30 41,44 55,44" fill="currentColor" fillOpacity="0.4" />
            <g className="pm-tbox pm-seesaw">
              <rect x="18" y="26" width="60" height="6" rx="3" fill={accent} />
            </g>
            <g className="pm-tbox pm-seesaw-hero">
              <circle cx="48" cy="18" r="4.8" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'rhythmPlatform':
        return (
          <>
            <rect x="30" y="19" width="36" height="14" rx="4" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="4 3" opacity="0.5" />
            <g className="pm-tbox pm-rhythm">
              <rect x="30" y="19" width="36" height="14" rx="4" fill={accent} />
              <circle cx="48" cy="26" r="3" fill="#fff" fillOpacity="0.85" />
            </g>
            <circle cx="20" cy="13" r="3" fill={accent} className="pm-tbox pm-pulse-glow" />
          </>
        );

      case 'iceSurface':
        return (
          <>
            <rect x="14" y="31" width="68" height="9" rx="4" fill="#38BDF8" fillOpacity="0.3" stroke="#7DD3FC" strokeWidth="1.5" />
            <path d="M24 33 L32 39 M48 33 L56 39 M66 33 L72 37" stroke="#fff" strokeOpacity="0.65" strokeWidth="1.4" strokeLinecap="round" />
            <g className="pm-tbox pm-ice-slide">
              <line x1="30" y1="26" x2="41" y2="26" stroke="#7DD3FC" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="48" cy="24" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'stickySurface':
        return (
          <>
            <rect x="16" y="34" width="64" height="8" rx="4" fill="#57534E" />
            <path d="M24 34 Q32 30 40 34 T56 34 T72 34" fill="#292524" />
            <g className="pm-tbox pm-sticky-bob">
              <circle cx="48" cy="27" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'conveyorBelt':
        return (
          <>
            <rect x="14" y="29" width="68" height="11" rx="5.5" fill="#475569" stroke={accent} strokeWidth="1.5" />
            <g className="pm-tbox pm-conveyor-track" opacity="0.85">
              <path d="M26 32 L30 34.5 L26 37 M40 32 L44 34.5 L40 37 M54 32 L58 34.5 L54 37 M68 32 L72 34.5 L68 37" stroke="#FBBF24" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g className="pm-tbox pm-conveyor-box">
              <rect x="42" y="18" width="11" height="10" rx="2.5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'speedBoostPad':
        return (
          <>
            <rect x="16" y="33" width="64" height="7" rx="3.5" fill={accent} fillOpacity="0.28" stroke={accent} strokeWidth="1.5" />
            <path d="M30 34.5 L34 36.5 L30 38.5 M44 34.5 L48 36.5 L44 38.5 M58 34.5 L62 36.5 L58 38.5" stroke={accent} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <g className="pm-tbox pm-boost-dash">
              <line x1="25" y1="24" x2="42" y2="24" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="48" cy="24" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'breakableBlock':
        return (
          <>
            <g className="pm-tbox pm-break-tl">
              <rect x="36" y="14" width="11" height="11" rx="2" fill={accent} stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
            </g>
            <g className="pm-tbox pm-break-tr">
              <rect x="49" y="14" width="11" height="11" rx="2" fill={accent} stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
            </g>
            <g className="pm-tbox pm-break-bl">
              <rect x="36" y="27" width="11" height="11" rx="2" fill={accent} stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
            </g>
            <g className="pm-tbox pm-break-br">
              <rect x="49" y="27" width="11" height="11" rx="2" fill={accent} stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
            </g>
          </>
        );

      // 2. Traversal, Momentum & Launchers
      case 'barrelCannon':
        return (
          <>
            <path d="M30 34 Q52 6 76 28" fill="none" stroke={accent} strokeOpacity="0.4" strokeWidth="1.8" strokeDasharray="3 3" />
            <g className="pm-tbox pm-cannon-kick">
              <rect x="18" y="26" width="22" height="14" rx="4" fill={accent} stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" />
              <rect x="35" y="28" width="5" height="10" rx="1.5" fill="#1E293B" />
            </g>
            <g className="pm-tbox pm-cannon-shot">
              <circle cx="48" cy="26" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.3" />
            </g>
          </>
        );

      case 'swingVine':
        return (
          <>
            <circle cx="48" cy="6" r="3" fill="currentColor" fillOpacity="0.45" />
            <g className="pm-swing">
              <line x1="48" y1="6" x2="48" y2="36" stroke={accent} strokeWidth="3" strokeLinecap="round" />
              <circle cx="48" cy="37" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'grappleAnchor':
        return (
          <>
            <circle cx="48" cy="11" r="9" fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="1.4" strokeDasharray="3 2" />
            <circle cx="48" cy="11" r="4" fill={accent} stroke="#fff" strokeWidth="1.1" />
            <line x1="48" y1="15" x2="48" y2="26" stroke={accent} strokeWidth="1.5" strokeDasharray="2 2" opacity="0.65" />
            <g className="pm-tbox pm-grapple-zip">
              <circle cx="48" cy="26" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'bounceSpring':
        return (
          <>
            <rect x="30" y="42" width="36" height="4" rx="2" fill="currentColor" fillOpacity="0.3" />
            <g className="pm-spring-pad">
              <path d="M40 42 L56 37 L40 32 L56 28" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="33" y="25" width="30" height="6" rx="3" fill={accent} />
            </g>
            <g className="pm-tbox pm-spring-hero">
              <circle cx="48" cy="24" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'wallSpring':
        return (
          <>
            <rect x="13" y="8" width="7" height="36" rx="2.5" fill="currentColor" fillOpacity="0.35" />
            <g className="pm-wall-pad">
              <rect x="20" y="15" width="6" height="22" rx="3" fill={accent} />
            </g>
            <g className="pm-tbox pm-wall-hero">
              <circle cx="46" cy="26" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'grindRail':
        return (
          <>
            <path d="M12 36 Q48 18 84 36" fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
            <g className="pm-tbox pm-grind-hero">
              <circle cx="48" cy="21" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
              <circle cx="41" cy="27" r="2" fill="#FACC15" />
              <circle cx="37" cy="29" r="1.4" fill="#FDE047" />
            </g>
          </>
        );

      case 'climbLadder':
        return (
          <>
            <line x1="39" y1="7" x2="39" y2="45" stroke={accent} strokeWidth="2.8" strokeLinecap="round" />
            <line x1="57" y1="7" x2="57" y2="45" stroke={accent} strokeWidth="2.8" strokeLinecap="round" />
            {[13, 21, 29, 37].map((y) => (
              <line key={y} x1="39" y1={y} x2="57" y2={y} stroke={accent} strokeWidth="2.4" />
            ))}
            <g className="pm-tbox pm-climb-hero">
              <circle cx="48" cy="26" r="4.8" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'monkeyBars':
        return (
          <>
            <line x1="16" y1="14" x2="80" y2="14" stroke={accent} strokeWidth="3" strokeLinecap="round" />
            {[24, 36, 48, 60, 72].map((x) => (
              <circle key={x} cx={x} cy="14" r="2.2" fill="#fff" stroke={accent} strokeWidth="1.4" />
            ))}
            <g className="pm-tbox pm-monkey-hero">
              <line x1="48" y1="16" x2="48" y2="23" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
              <circle cx="48" cy="28" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'boostRing':
        return (
          <>
            <ellipse cx="48" cy="26" rx="6" ry="15" fill="none" stroke={accent} strokeWidth="3.2" />
            <g className="pm-tbox pm-ring-hero">
              <line x1="33" y1="26" x2="43" y2="26" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="48" cy="26" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
            </g>
          </>
        );

      case 'windTunnel':
        return (
          <>
            <rect x="33" y="8" width="30" height="36" rx="6" fill={accent} fillOpacity="0.16" stroke={accent} strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="3 3" />
            <path d="M40 36 Q37 29 40 22 T40 12" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" className="pm-tbox pm-wind-up" />
            <path d="M56 38 Q59 31 56 24 T56 14" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" className="pm-tbox pm-wind-up-delay" />
            <circle cx="48" cy="26" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-lowg-hero" />
          </>
        );

      // 3. Environmental Physics & World Modifiers
      case 'waterZone':
        return (
          <>
            <rect x="14" y="18" width="68" height="26" rx="5" fill={accent} fillOpacity="0.28" stroke={accent} strokeOpacity="0.55" strokeWidth="1.4" />
            <path d="M14 21 Q25 17 36 21 T58 21 T82 21" fill="none" stroke="#7DD3FC" strokeWidth="2" />
            <g className="pm-tbox pm-swim-hero">
              <circle cx="48" cy="29" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
              <circle cx="56" cy="23" r="1.6" fill="#E0F2FE" />
            </g>
          </>
        );

      case 'lowGravityZone':
        return (
          <>
            <circle cx="48" cy="26" r="19" fill={accent} fillOpacity="0.18" stroke={accent} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx="35" cy="18" r="1.6" fill="#DDD6FE" />
            <circle cx="61" cy="33" r="1.6" fill="#DDD6FE" />
            <circle cx="48" cy="26" r="5.2" fill={heroColor} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-lowg-hero" />
          </>
        );

      case 'gravityFlipPad':
        return (
          <>
            <line x1="20" y1="8" x2="76" y2="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="33" y="40" width="30" height="5" rx="2.5" fill={accent} />
            <path d="M25 32 L25 19 M22 22 L25 18 L28 22" stroke={accent} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <g className="pm-tbox pm-flip-hero">
              <circle cx="48" cy="24" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" />
              <circle cx="48" cy="21" r="1.6" fill="#fff" />
            </g>
          </>
        );

      case 'warpPortal':
        return (
          <>
            <ellipse cx="26" cy="26" rx="7" ry="14" fill={accent} fillOpacity="0.24" stroke={accent} strokeWidth="2.4" className="pm-tbox pm-pulse-glow" />
            <ellipse cx="70" cy="26" rx="7" ry="14" fill={accent} fillOpacity="0.24" stroke={accent} strokeWidth="2.4" className="pm-tbox pm-pulse-glow" />
            <circle cx="48" cy="26" r="4.8" fill={heroColor} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-warp-in" />
            <circle cx="48" cy="26" r="4.8" fill={heroColor} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-warp-out" />
          </>
        );

      case 'shadowZone':
        return (
          <>
            <rect x="24" y="29" width="48" height="9" rx="3" fill="none" stroke="#818CF8" strokeWidth="1.6" strokeDasharray="3 2" />
            <rect x="24" y="29" width="48" height="9" rx="3" fill="#6366F1" className="pm-tbox pm-shadow-solid" />
            <g className="pm-tbox pm-lantern-sweep">
              <circle cx="48" cy="17" r="12" fill="#FBBF24" fillOpacity="0.25" />
              <circle cx="48" cy="17" r="4" fill="#FBBF24" stroke="#fff" strokeWidth="1.1" />
            </g>
          </>
        );

      case 'lanternPickup':
        return (
          <>
            <circle cx="48" cy="26" r="16" fill={accent} fillOpacity="0.25" className="pm-tbox pm-pulse-glow" />
            <g className="pm-tbox pm-lowg-hero">
              <path d="M44 18 Q48 13 52 18" fill="none" stroke={accent} strokeWidth="2" />
              <rect x="41" y="18" width="14" height="16" rx="4" fill={accent} stroke="#fff" strokeWidth="1.3" />
              <circle cx="48" cy="26" r="3" fill="#FFFBEB" />
            </g>
          </>
        );

      // 4. Interactive Puzzles, Triggers & Gates
      case 'triggerSwitch':
        return (
          <>
            <rect x="16" y="38" width="24" height="4" rx="2" fill="currentColor" fillOpacity="0.3" />
            <rect x="20" y="33" width="16" height="5" rx="2" fill={accent} className="pm-tbox pm-plate-press" />
            <line x1="36" y1="36" x2="62" y2="36" stroke={accent} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="2 2" />
            <rect x="64" y="15" width="9" height="25" rx="2.5" fill="#F59E0B" className="pm-tbox pm-gate-open" />
          </>
        );

      case 'shootTarget':
        return (
          <>
            <g className="pm-tbox pm-pulse-glow">
              <circle cx="64" cy="26" r="11" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="2" />
              <circle cx="64" cy="26" r="6" fill="#fff" />
              <circle cx="64" cy="26" r="3" fill={accent} />
            </g>
            <g className="pm-tbox pm-boost-dash">
              <circle cx="34" cy="26" r="3.5" fill={heroHi} stroke={heroColor} strokeWidth="1.5" />
            </g>
          </>
        );

      case 'lockedDoor':
        return (
          <>
            <rect x="33" y="10" width="30" height="34" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
            <g className="pm-tbox pm-gate-open">
              <rect x="36" y="13" width="24" height="30" rx="3" fill={accent} />
              <circle cx="48" cy="26" r="3.5" fill="#1E1B18" />
              <rect x="46.5" y="27" width="3" height="5" rx="1" fill="#1E1B18" />
            </g>
          </>
        );

      case 'followerKey':
        return (
          <>
            <circle cx="58" cy="24" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-shuttle" />
            <g className="pm-tbox pm-key-trail">
              <circle cx="34" cy="27" r="4.5" fill="none" stroke={accent} strokeWidth="2.5" />
              <line x1="38.5" y1="27" x2="46" y2="27" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="43" y1="27" x2="43" y2="30.5" stroke={accent} strokeWidth="2" strokeLinecap="round" />
            </g>
          </>
        );

      case 'pushCrate':
        return (
          <>
            <line x1="14" y1="39" x2="82" y2="39" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
            <g className="pm-tbox pm-shuttle">
              <rect x="41" y="22" width="16" height="16" rx="2.5" fill={accent} stroke="#fff" strokeOpacity="0.4" strokeWidth="1.2" />
              <line x1="43" y1="24" x2="55" y2="36" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.5" />
              <circle cx="32" cy="32" r="4.5" fill={heroColor} stroke="#fff" strokeWidth="1.1" />
            </g>
          </>
        );

      case 'starGateway':
        return (
          <>
            <rect x="30" y="10" width="36" height="34" rx="12" fill="none" stroke={accent} strokeWidth="2.5" />
            <g className="pm-tbox pm-gate-open">
              <rect x="34" y="14" width="28" height="29" rx="9" fill={accent} fillOpacity="0.88" />
              <polygon points="48,19 50.5,24.5 56.5,25 52,29 53.5,35 48,32 42.5,35 44,29 39.5,25 45.5,24.5" fill="#fff" />
            </g>
          </>
        );

      // 5. Hazards, Traps & Enemy Archetypes
      case 'retractSpikes':
        return (
          <>
            <g className="pm-tbox pm-spikes-pop">
              <polygon points="27,36 33,19 39,36" fill={accent} />
              <polygon points="42,36 48,19 54,36" fill={accent} />
              <polygon points="57,36 63,19 69,36" fill={accent} />
            </g>
            <rect x="22" y="35" width="52" height="7" rx="2.5" fill="#475569" />
          </>
        );

      case 'spikePendulum':
        return (
          <>
            <circle cx="48" cy="6" r="3" fill="currentColor" fillOpacity="0.45" />
            <g className="pm-swing">
              <line x1="48" y1="6" x2="48" y2="32" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="3 2" />
              <circle cx="48" cy="35" r="7" fill={accent} stroke="#fff" strokeWidth="1.2" />
              <polygon points="48,25 45.5,29 50.5,29" fill={accent} />
              <polygon points="48,45 45.5,41 50.5,41" fill={accent} />
              <polygon points="38,35 42,32.5 42,37.5" fill={accent} />
              <polygon points="58,35 54,32.5 54,37.5" fill={accent} />
            </g>
          </>
        );

      case 'firebar':
        return (
          <>
            <g className="pm-tbox pm-spin-360">
              <circle cx="48" cy="26" r="3.5" fill="#475569" stroke="#fff" strokeWidth="1" />
              <circle cx="56" cy="26" r="3.2" fill={accent} />
              <circle cx="64" cy="26" r="3.2" fill="#FBBF24" />
              <circle cx="72" cy="26" r="3.2" fill={accent} />
            </g>
          </>
        );

      case 'thwompBlock':
        return (
          <>
            <line x1="26" y1="43" x2="70" y2="43" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2.5" strokeLinecap="round" />
            <g className="pm-tbox pm-thwomp-slam">
              <rect x="35" y="14" width="26" height="22" rx="4" fill={accent} stroke="#94A3B8" strokeWidth="1.4" />
              <path d="M40 22 L45 24 M56 22 L51 24" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <rect x="41" y="29" width="14" height="3" rx="1" fill="#F87171" />
            </g>
          </>
        );

      case 'enemyPatroller':
        return (
          <>
            <rect x="16" y="36" width="64" height="6" rx="3" fill="currentColor" fillOpacity="0.22" />
            <g className="pm-tbox pm-shuttle">
              <rect x="40" y="22" width="16" height="14" rx="5" fill={accent} />
              <circle cx="45" cy="28" r="1.8" fill="#fff" />
              <circle cx="51" cy="28" r="1.8" fill="#fff" />
            </g>
          </>
        );

      case 'enemyFlyer':
        return (
          <>
            <path d="M18 26 Q33 14 48 26 T78 26" fill="none" stroke={accent} strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="3 3" />
            <g className="pm-tbox pm-spline">
              <path d="M35 23 L42 26 L38 29 Z M61 23 L54 26 L58 29 Z" fill="#FDA4AF" />
              <circle cx="48" cy="26" r="6" fill={accent} stroke="#fff" strokeWidth="1.1" />
              <circle cx="46" cy="25" r="1.3" fill="#fff" />
              <circle cx="50" cy="25" r="1.3" fill="#fff" />
            </g>
          </>
        );

      case 'enemyCharger':
        return (
          <>
            <line x1="14" y1="38" x2="82" y2="38" stroke="currentColor" strokeOpacity="0.24" strokeWidth="2" />
            <g className="pm-tbox pm-charger">
              <rect x="37" y="22" width="20" height="15" rx="4" fill={accent} />
              <polygon points="56,24 63,20 57,29" fill="#FDE047" />
              <circle cx="52" cy="28" r="1.8" fill="#fff" />
            </g>
          </>
        );

      case 'enemyTurret':
        return (
          <>
            <rect x="20" y="21" width="14" height="18" rx="4" fill={accent} />
            <rect x="32" y="24" width="7" height="6" rx="2" fill={accent} />
            <g className="pm-tbox pm-turret-shot">
              <circle cx="46" cy="27" r="3.8" fill="#E879F9" stroke="#fff" strokeWidth="1" />
            </g>
          </>
        );

      case 'enemySpiked':
        return (
          <>
            <line x1="16" y1="38" x2="80" y2="38" stroke="currentColor" strokeOpacity="0.24" strokeWidth="2" />
            <g className="pm-tbox pm-shuttle">
              <polygon points="41,22 44,15 47,22" fill="#EF4444" />
              <polygon points="49,22 52,15 55,22" fill="#EF4444" />
              <rect x="39" y="22" width="18" height="15" rx="5" fill={accent} />
              <circle cx="45" cy="29" r="1.7" fill="#fff" />
              <circle cx="51" cy="29" r="1.7" fill="#fff" />
            </g>
          </>
        );

      // 7. Next-Gen Platformer Mechanics
      case 'dashCrystal':
        return (
          <>
            <circle cx="48" cy="26" r="15" fill={accent} fillOpacity="0.22" className="pm-tbox pm-pulse-glow" />
            <g className="pm-tbox pm-lowg-hero">
              <polygon points="48,13 58,26 48,39 38,26" fill={accent} stroke="#fff" strokeWidth="1.4" />
              <polygon points="48,18 53,26 48,34 43,26" fill="#A7F3D0" />
            </g>
          </>
        );

      case 'bashLantern':
        return (
          <>
            <circle cx="48" cy="26" r="13" fill="none" stroke={accent} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 2" className="pm-tbox pm-pulse-glow" />
            <g className="pm-tbox pm-bash-arrow">
              <line x1="48" y1="26" x2="66" y2="14" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
              <polygon points="68,12 61,13 65,19" fill={accent} />
            </g>
            <circle cx="48" cy="26" r="6" fill={accent} stroke="#fff" strokeWidth="1.4" />
          </>
        );

      case 'ghostEchoPad':
        return (
          <>
            <rect x="26" y="37" width="44" height="5" rx="2.5" fill={accent} fillOpacity="0.5" />
            <circle cx="48" cy="26" r="5" fill={accent} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-echo-lag" />
            <circle cx="48" cy="26" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-shuttle" />
          </>
        );

      case 'slingshotWeb':
        return (
          <>
            <rect x="20" y="23" width="5" height="19" rx="2" fill="#475569" />
            <rect x="71" y="23" width="5" height="19" rx="2" fill="#475569" />
            <line x1="25" y1="28" x2="71" y2="28" stroke={accent} strokeWidth="2.8" strokeLinecap="round" className="pm-tbox pm-spring-pad" />
            <circle cx="48" cy="24" r="5" fill={heroColor} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-spring-hero" />
          </>
        );

      case 'sizeShiftGate':
        return (
          <>
            <rect x="45" y="9" width="6" height="34" rx="3" fill={accent} fillOpacity="0.75" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
            <circle cx="48" cy="26" r="5.5" fill={heroColor} stroke="#fff" strokeWidth="1.2" className="pm-tbox pm-size-hero" />
          </>
        );

      // 8. Flow, Rewards & Level Progression Nodes
      case 'checkpointFlag':
        return (
          <>
            <ellipse cx="42" cy="41" rx="14" ry="4" fill={accent} fillOpacity="0.25" className="pm-tbox pm-pulse-glow" />
            <line x1="42" y1="11" x2="42" y2="41" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M42 12 L63 18 L42 25 Z" fill={accent} className="pm-tbox pm-seesaw" />
          </>
        );

      case 'coinTrail':
        return (
          <>
            {[
              { x: 20, y: 34, d: '0s' },
              { x: 34, y: 21, d: '0.18s' },
              { x: 48, y: 15, d: '0.36s' },
              { x: 62, y: 21, d: '0.54s' },
              { x: 76, y: 34, d: '0.72s' },
            ].map((c, idx) => (
              <circle
                key={idx}
                cx={c.x}
                cy={c.y}
                r="4.2"
                fill={accent}
                stroke="#fff"
                strokeWidth="1.1"
                className="pm-tbox pm-pulse-glow"
                style={{ animationDelay: c.d }}
              />
            ))}
          </>
        );

      case 'starCoin':
        return (
          <>
            <circle cx="48" cy="26" r="15" fill={accent} fillOpacity="0.2" className="pm-tbox pm-pulse-glow" />
            <g className="pm-tbox pm-lowg-hero">
              <circle cx="48" cy="26" r="11" fill={accent} stroke="#FEF08A" strokeWidth="1.6" />
              <polygon points="48,18 50.2,23.2 55.6,23.6 51.4,27.2 52.8,32.5 48,29.6 43.2,32.5 44.6,27.2 40.4,23.6 45.8,23.2" fill="#FFFBEB" />
            </g>
          </>
        );

      case 'secretWall':
        return (
          <>
            <polygon points="48,17 50.5,23 57,23.5 52,27.5 53.5,34 48,30.5 42.5,34 44,27.5 39,23.5 45.5,23" fill="#FACC15" />
            <g className="pm-tbox pm-secret-fade">
              <rect x="28" y="13" width="40" height="26" rx="3" fill="#64748B" stroke="#94A3B8" strokeWidth="1.2" />
              <line x1="28" y1="22" x2="68" y2="22" stroke="#334155" strokeWidth="1.5" />
              <line x1="28" y1="31" x2="68" y2="31" stroke="#334155" strokeWidth="1.5" />
              <line x1="48" y1="13" x2="48" y2="22" stroke="#334155" strokeWidth="1.5" />
              <line x1="39" y1="22" x2="39" y2="31" stroke="#334155" strokeWidth="1.5" />
              <line x1="57" y1="22" x2="57" y2="31" stroke="#334155" strokeWidth="1.5" />
            </g>
          </>
        );

      case 'finishGoal':
        return (
          <>
            <rect x="34" y="38" width="28" height="5" rx="2" fill="currentColor" fillOpacity="0.3" />
            <line x1="42" y1="9" x2="42" y2="39" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
            <circle cx="42" cy="9" r="3.5" fill="#FACC15" />
            <g className="pm-tbox pm-elevator">
              <path d="M42 18 L63 23 L42 29 Z" fill={accent} stroke="#fff" strokeWidth="1" />
            </g>
          </>
        );

      default:
        return <circle cx="48" cy="26" r="9" fill={accent} />;
    }
  };

  return (
    <svg
      viewBox="0 0 96 52"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      {renderScene()}
    </svg>
  );
};

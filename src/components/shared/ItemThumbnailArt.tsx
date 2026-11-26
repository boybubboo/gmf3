import React, { useId } from 'react';
import type { PickupMeshKind } from '../../types/maker';

interface ItemThumbnailArtProps {
  meshKind: PickupMeshKind;
  colorHex?: string;
  size?: number;
  className?: string;
}

export const ItemThumbnailArt: React.FC<ItemThumbnailArtProps> = ({
  meshKind,
  colorHex = '#7C5CFF',
  size = 44,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const gradBg = `bg_${uid}`;
  const gradTint = `tint_${uid}`;
  const gradBlade = `blade_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id={gradBg} cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor={colorHex} stopOpacity="0.32" />
          <stop offset="100%" stopColor={colorHex} stopOpacity="0.04" />
        </radialGradient>
        <linearGradient id={gradTint} x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={colorHex} stopOpacity="1" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={gradBlade} x1="16" y1="10" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="55%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="56" height="56" rx="14" fill={`url(#${gradBg})`} />

      {meshKind === 'sword' && (
        <g>
          <path d="M47 11L53 17L27 43L21 37L47 11Z" fill={`url(#${gradBlade})`} stroke="#E2E8F0" strokeWidth="1.2" />
          <path d="M47 11L51 15L25 41" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="1.4" />
          <rect x="16" y="34" width="14" height="4.5" rx="2" transform="rotate(45 16 34)" fill="#FACC15" />
          <rect x="14" y="43" width="5" height="10" rx="2" transform="rotate(45 14 43)" fill="#78350F" />
          <circle cx="13" cy="51" r="3" fill="#FACC15" />
        </g>
      )}

      {meshKind === 'axe' && (
        <g>
          <rect x="16" y="45" width="38" height="5" rx="2.5" transform="rotate(-45 16 45)" fill="#92400E" />
          <path
            d="M35 12C43 13 49 20 49 29L36 27L31 20L35 12Z"
            fill={`url(#${gradBlade})`}
            stroke="#F8FAFC"
            strokeWidth="1.2"
          />
          <path d="M47 18C49 21 49.5 25 49 29" stroke={colorHex} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}

      {meshKind === 'fishingPole' && (
        <g>
          <path d="M14 50L44 14" stroke="#D97706" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M44 14C48 16 49 24 47 36" stroke="#CBD5E1" strokeWidth="1.3" strokeDasharray="2 1" />
          <circle cx="24" cy="39" r="4.5" fill="#FACC15" stroke="#78350F" strokeWidth="1.2" />
          <circle cx="47" cy="40" r="4.5" fill="#EF4444" />
          <path d="M42.5 40A4.5 4.5 0 0 0 51.5 40Z" fill="#F8FAFC" />
        </g>
      )}

      {meshKind === 'woodLog' && (
        <g>
          <rect x="11" y="25" width="38" height="16" rx="6" transform="rotate(-14 11 25)" fill="#78350F" />
          <rect x="14" y="27" width="32" height="5" rx="2.5" transform="rotate(-14 14 27)" fill="#92400E" />
          <ellipse cx="48" cy="25.5" rx="5.5" ry="7.8" transform="rotate(-14 48 25.5)" fill="#FDE68A" stroke="#78350F" strokeWidth="2" />
          <circle cx="48" cy="25.5" r="2.2" fill="#B45309" />
        </g>
      )}

      {meshKind === 'fish' && (
        <g>
          <path d="M46 32L55 23V41L46 32Z" fill={colorHex} fillOpacity="0.85" />
          <ellipse cx="30" cy="32" rx="17" ry="10.5" fill={colorHex} />
          <ellipse cx="30" cy="35" rx="13" ry="5.5" fill="#E0F2FE" fillOpacity="0.5" />
          <path d="M27 22L34 15L37 23Z" fill={colorHex} />
          <circle cx="20" cy="30" r="2.3" fill="#0F172A" />
          <circle cx="19.4" cy="29.4" r="0.8" fill="#FFFFFF" />
        </g>
      )}

      {meshKind === 'berries' && (
        <g>
          <path d="M24 23C20 15 27 12 32 17C37 12 44 15 40 23Z" fill="#22C55E" />
          <circle cx="24" cy="33" r="8" fill={colorHex} />
          <circle cx="39" cy="33" r="8" fill={colorHex} />
          <circle cx="32" cy="42" r="8.5" fill={colorHex} />
          <circle cx="21.5" cy="30" r="2.2" fill="#FFFFFF" fillOpacity="0.45" />
          <circle cx="36.5" cy="30" r="2.2" fill="#FFFFFF" fillOpacity="0.45" />
          <circle cx="29.5" cy="39" r="2.4" fill="#FFFFFF" fillOpacity="0.45" />
        </g>
      )}

      {meshKind === 'herbs' && (
        <g>
          <path d="M32 50V22" stroke="#15803D" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M32 39C20 38 15 28 19 20C27 22 32 29 32 39Z" fill={colorHex} />
          <path d="M32 35C44 34 49 24 45 16C37 18 32 25 32 35Z" fill={colorHex} />
          <path d="M32 28C26 20 28 12 32 10C36 12 38 20 32 28Z" fill="#4ADE80" />
        </g>
      )}

      {meshKind === 'mushroom' && (
        <g>
          <path d="M25 34H39L41 49C41 51.5 37 53 32 53C27 53 23 51.5 23 49L25 34Z" fill="#F3EAD8" />
          <ellipse cx="32" cy="34" rx="8" ry="2.6" fill="#D6C7B2" />
          <path d="M13 33C13 20 21.5 12 32 12C42.5 12 51 20 51 33C51 36 42.5 37 32 37C21.5 37 13 36 13 33Z" fill={colorHex} />
          <circle cx="24" cy="24" r="3.2" fill="#FFFDF5" fillOpacity="0.9" />
          <circle cx="37" cy="20" r="2.5" fill="#FFFDF5" fillOpacity="0.9" />
          <circle cx="42" cy="28" r="2.2" fill="#FFFDF5" fillOpacity="0.85" />
          <circle cx="29" cy="29" r="1.8" fill="#FFFDF5" fillOpacity="0.85" />
        </g>
      )}

      {meshKind === 'flower' && (
        <g>
          <path d="M32 52V30" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 45C24 44 21 39 23 35C28 36 32 40 32 45Z" fill="#22C55E" />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse
              key={deg}
              cx="32"
              cy="17"
              rx="4.8"
              ry="7.5"
              transform={`rotate(${deg} 32 26)`}
              fill={colorHex}
            />
          ))}
          <circle cx="32" cy="26" r="5.5" fill="#FACC15" />
        </g>
      )}

      {meshKind === 'potion' && (
        <g>
          <rect x="27" y="10" width="10" height="5" rx="1.5" fill="#B45309" />
          <rect x="26" y="15" width="12" height="7" rx="2" fill="#CBD5E1" fillOpacity="0.85" />
          <circle cx="32" cy="38" r="15" fill="#0F172A" fillOpacity="0.35" stroke="#E2E8F0" strokeOpacity="0.55" strokeWidth="1.6" />
          <path d="M18.5 39A13.5 13.5 0 0 0 45.5 39C45.5 35 39 34 32 34C25 34 18.5 35 18.5 39Z" fill={colorHex} />
          <circle cx="27" cy="33" r="3" fill="#FFFFFF" fillOpacity="0.45" />
          <circle cx="36" cy="41" r="1.8" fill="#FFFFFF" fillOpacity="0.6" />
        </g>
      )}

      {meshKind === 'hat' && (
        <g>
          <path d="M21 37L25 18C26 15 38 15 39 18L43 37Z" fill={colorHex} />
          <rect x="22.5" y="32" width="19" height="4" rx="1" fill="#FACC15" />
          <ellipse cx="32" cy="39" rx="21" ry="6.5" fill={colorHex} stroke="#0F172A" strokeOpacity="0.25" strokeWidth="1.2" />
          <path d="M40 28L49 16" stroke="#F59E0B" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      )}

      {meshKind === 'cloak' && (
        <g>
          <path d="M23 16L41 16L50 51C40 54 24 54 14 51L23 16Z" fill={colorHex} />
          <path d="M25 16L32 23L39 16" fill="#0F172A" fillOpacity="0.32" />
          <circle cx="32" cy="23" r="3.4" fill="#FACC15" />
        </g>
      )}

      {meshKind === 'armor' && (
        <g>
          <path d="M15 20L24 14L32 18L40 14L49 20L45 30L42 50H22L19 30L15 20Z" fill={colorHex} stroke="#E2E8F0" strokeWidth="1.4" />
          <path d="M25 15L32 22L39 15" fill="none" stroke="#FACC15" strokeWidth="2.2" />
          <path d="M32 22V48" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.8" />
        </g>
      )}

      {meshKind === 'amulet' && (
        <g>
          <path d="M22 14C22 24 42 24 42 14" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="32" cy="36" r="12" fill="none" stroke="#CBD5E1" strokeWidth="3.5" />
          <path d="M32 25L40 36L32 47L24 36L32 25Z" fill={colorHex} />
          <path d="M32 28L37 36L32 44" fill="#FFFFFF" fillOpacity="0.35" />
        </g>
      )}

      {meshKind === 'torch' && (
        <g>
          <rect x="29" y="29" width="6" height="24" rx="2.5" fill="#92400E" />
          <path d="M32 10C39 18 42 25 32 31C22 25 25 18 32 10Z" fill="#F97316" />
          <path d="M32 16C36 21 37 26 32 29C27 26 28 21 32 16Z" fill="#FACC15" />
        </g>
      )}

      {meshKind === 'staff' && (
        <g>
          <path d="M18 52L42 20" stroke="#78350F" strokeWidth="4" strokeLinecap="round" />
          <circle cx="44" cy="18" r="8" fill={colorHex} />
          <circle cx="42" cy="16" r="2.8" fill="#FFFFFF" fillOpacity="0.65" />
        </g>
      )}

      {meshKind === 'scroll' && (
        <g>
          <rect x="14" y="22" width="36" height="20" rx="5" fill="#F5E6C8" stroke="#D97706" strokeWidth="1.5" />
          <rect x="29" y="20" width="6" height="24" rx="2" fill={colorHex} />
          <circle cx="32" cy="32" r="4" fill="#FACC15" />
        </g>
      )}

      {meshKind === 'stone' && (
        <g>
          <path d="M15 39L21 21L38 18L50 30L46 46L23 48L15 39Z" fill={colorHex} />
          <path d="M21 21L38 18L34 32L15 39Z" fill="#FFFFFF" fillOpacity="0.22" />
        </g>
      )}

      {meshKind === 'moss' && (
        <g>
          <ellipse cx="26" cy="39" rx="13" ry="9" fill={colorHex} />
          <ellipse cx="39" cy="35" rx="11" ry="8" fill={colorHex} />
          <circle cx="23" cy="34" r="2.2" fill="#ECFDF5" />
          <circle cx="38" cy="31" r="2" fill="#ECFDF5" />
          <circle cx="32" cy="40" r="1.8" fill="#ECFDF5" />
        </g>
      )}

      {meshKind === 'bone' && (
        <g>
          <g transform="rotate(-32 32 32)">
            <rect x="16" y="28.5" width="32" height="7" rx="3" fill="#F1EDE4" />
            <circle cx="16" cy="27.5" r="4.5" fill="#F1EDE4" />
            <circle cx="16" cy="36.5" r="4.5" fill="#F1EDE4" />
            <circle cx="48" cy="27.5" r="4.5" fill="#F1EDE4" />
            <circle cx="48" cy="36.5" r="4.5" fill="#F1EDE4" />
          </g>
        </g>
      )}

      {meshKind === 'gem' && (
        <g>
          <path d="M32 12L48 26L32 52L16 26L32 12Z" fill={colorHex} />
          <path d="M32 12L48 26H16L32 12Z" fill="#FFFFFF" fillOpacity="0.32" />
          <path d="M32 12V52" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1.2" />
        </g>
      )}

      {meshKind === 'blanket' && (
        <g>
          {/* Cupped wind-filled sail blanket */}
          <path
            d="M11 35C14 17 24 12 32 12C40 12 50 17 53 35C46 29 39 27 32 27C25 27 18 29 11 35Z"
            fill={colorHex}
            stroke="#F7E8CF"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Woven sail stripe & underside shadow curve */}
          <path
            d="M17 31C21 20 27 17 32 17C37 17 43 20 47 31"
            stroke="#FDE68A"
            strokeOpacity="0.82"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M11 35C19 30 45 30 53 35C44 39 20 39 11 35Z"
            fill="#0F172A"
            fillOpacity="0.28"
          />
          {/* Reinforced corner grips & cords held overhead */}
          <path d="M12 35L21 51" stroke="#E2E8F0" strokeOpacity="0.75" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M52 35L43 51" stroke="#E2E8F0" strokeOpacity="0.75" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="35" r="2.6" fill="#92400E" stroke="#F7E8CF" strokeWidth="1" />
          <circle cx="52" cy="35" r="2.6" fill="#92400E" stroke="#F7E8CF" strokeWidth="1" />
        </g>
      )}

      {meshKind === 'shield' && (
        <g>
          <path
            d="M16 14L32 10L48 14V31C48 43 39 50 32 54C25 50 16 43 16 31V14Z"
            fill={colorHex}
            stroke="#E2E8F0"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M32 12V51"
            stroke="#0F172A"
            strokeOpacity="0.28"
            strokeWidth="2"
          />
          <path
            d="M18 26H46"
            stroke="#E2E8F0"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <circle cx="32" cy="29" r="5.2" fill="#CBD5E1" stroke="#475569" strokeWidth="1.4" />
          <circle cx="31" cy="28" r="1.8" fill="#FFFFFF" fillOpacity="0.7" />
        </g>
      )}
    </svg>
  );
};

import React from 'react';
import { PLATFORMER_MODULE_MAP, resolvePlatformerMovement } from '../../data/platformerCatalog';
import type { MakerStore } from '../../store/useMakerStore';
import type {
  GameLevel,
  LevelEntity,
  PlatformerAddonConfig,
  PlatformerMovementConfig,
} from '../../types/maker';
import { getSideScrollerConfig } from '../../utils/terrain';
import { FieldLabel, MakerCard } from '../shared/MakerUI';

export const PlatformerModuleInspector: React.FC<{
  store: MakerStore;
  entity: LevelEntity;
}> = ({ store, entity }) => {
  const cfg = entity.platformerAddon;
  if (!cfg) return null;
  const spec = PLATFORMER_MODULE_MAP[cfg.moduleId];

  const patchAddon = (
    label: string,
    patch: Partial<PlatformerAddonConfig>,
    recordUndo = true
  ) => {
    store.updateEntity(
      entity.id,
      label,
      (ent) => ({
        ...ent,
        platformerAddon: {
          ...(ent.platformerAddon ?? cfg),
          ...patch,
        },
        ...(patch.colorTag ? { styleTint: patch.colorTag } : {}),
        ...(patch.speed !== undefined ? { speed: patch.speed, platformSpeed: patch.speed } : {}),
      }),
      recordUndo
    );
  };

  const mod = cfg.moduleId;
  const isMovingPlat =
    mod === 'shuttlePlatform' ||
    mod === 'elevatorPlatform' ||
    mod === 'orbitPlatform' ||
    mod === 'splinePlatform';

  return (
    <MakerCard className="space-y-2.5 border border-[#20B46A]/30">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-[#20B46A]">
          {spec?.label ?? 'Platformer Add-On'}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {cfg.category}
        </span>
      </div>
      {spec?.shortDesc && (
        <p className="text-[11px] text-slate-500 dark:text-[#949BB0] leading-snug">
          {spec.shortDesc}
        </p>
      )}

      {/* Color tag / tint */}
      <label className="flex items-center justify-between text-xs font-semibold">
        <span>Accent Tint</span>
        <input
          type="color"
          value={cfg.colorTag ?? spec?.accent ?? '#20B46A'}
          onChange={(e) => patchAddon('tint platformer module', { colorTag: e.target.value }, false)}
          className="w-8 h-6 rounded border-0 bg-transparent cursor-pointer"
        />
      </label>

      {/* Dimensions when geometric */}
      {cfg.width !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Width / Span</span>
            <span className="tabular-nums text-slate-500">{cfg.width.toFixed(1)}m</span>
          </div>
          <input
            type="range"
            min={1.2}
            max={18}
            step={0.2}
            value={cfg.width}
            onChange={(e) => patchAddon('resize width', { width: Number(e.target.value) }, false)}
            className="w-full accent-[#20B46A]"
          />
        </div>
      )}

      {cfg.height !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Height</span>
            <span className="tabular-nums text-slate-500">{cfg.height.toFixed(1)}m</span>
          </div>
          <input
            type="range"
            min={0.3}
            max={14}
            step={0.1}
            value={cfg.height}
            onChange={(e) => patchAddon('resize height', { height: Number(e.target.value) }, false)}
            className="w-full accent-[#20B46A]"
          />
        </div>
      )}

      {/* Moving platform controls */}
      {isMovingPlat && (
        <>
          <div className="space-y-1">
            <FieldLabel text="Track Pattern" />
            <select
              value={cfg.motionPattern ?? 'shuttle'}
              onChange={(e) =>
                patchAddon('change track pattern', {
                  motionPattern: e.target.value as PlatformerAddonConfig['motionPattern'],
                })
              }
              className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
            >
              <option value="shuttle">Horizontal Shuttle</option>
              <option value="elevator">Vertical Elevator</option>
              <option value="circular">Circular Orbit</option>
              <option value="figure8">Figure-Eight</option>
              <option value="spline">Spline Waypoints</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Distance / Radius</span>
              <span className="tabular-nums text-slate-500">{(cfg.distance ?? 6).toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min={1}
              max={24}
              step={0.5}
              value={cfg.distance ?? 6}
              onChange={(e) => patchAddon('adjust travel distance', { distance: Number(e.target.value) }, false)}
              className="w-full accent-[#20B46A]"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Endpoint Pause</span>
              <span className="tabular-nums text-slate-500">{(cfg.pauseSec ?? 0.5).toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={cfg.pauseSec ?? 0.5}
              onChange={(e) => patchAddon('adjust pause duration', { pauseSec: Number(e.target.value) }, false)}
              className="w-full accent-[#20B46A]"
            />
          </div>
          <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
            <span>Trigger Only When Stepped On</span>
            <input
              type="checkbox"
              checked={Boolean(cfg.triggerOnStep)}
              onChange={(e) => patchAddon('toggle trigger on step', { triggerOnStep: e.target.checked })}
              className="accent-[#20B46A]"
            />
          </label>
        </>
      )}

      {/* Speed generic */}
      {cfg.speed !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Speed</span>
            <span className="tabular-nums text-slate-500">{cfg.speed.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={24}
            step={0.2}
            value={cfg.speed}
            onChange={(e) => patchAddon('adjust speed', { speed: Number(e.target.value) }, false)}
            className="w-full accent-[#20B46A]"
          />
        </div>
      )}

      {/* Crumble / Respawn */}
      {cfg.crumbleDelay !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Crumble Delay</span>
            <span className="tabular-nums text-slate-500">{cfg.crumbleDelay.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min={0.15}
            max={2.5}
            step={0.05}
            value={cfg.crumbleDelay}
            onChange={(e) => patchAddon('adjust crumble delay', { crumbleDelay: Number(e.target.value) }, false)}
            className="w-full accent-[#D97706]"
          />
        </div>
      )}

      {cfg.respawnSec !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Respawn Timer (0 = once)</span>
            <span className="tabular-nums text-slate-500">{cfg.respawnSec.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={cfg.respawnSec}
            onChange={(e) => patchAddon('adjust respawn', { respawnSec: Number(e.target.value) }, false)}
            className="w-full accent-[#D97706]"
          />
        </div>
      )}

      {/* Rhythm Platform */}
      {mod === 'rhythmPlatform' && (
        <>
          <div className="space-y-1">
            <FieldLabel text="Beat Division" />
            <div className="grid grid-cols-3 gap-1">
              {([1, 2, 4] as const).map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => patchAddon('change beat division', { beatDivision: div })}
                  className={`py-1 rounded-lg text-xs font-bold ${
                    (cfg.beatDivision ?? 2) === div
                      ? 'bg-[#EC4899] text-white'
                      : 'bg-slate-100 dark:bg-[#1F2430]'
                  }`}
                >
                  {div}× Beat
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
            <span>Flip Every Player Jump</span>
            <input
              type="checkbox"
              checked={Boolean(cfg.toggleOnJump)}
              onChange={(e) => patchAddon('toggle jump phase', { toggleOnJump: e.target.checked })}
              className="accent-[#EC4899]"
            />
          </label>
        </>
      )}

      {/* Conveyor / Speed Pad */}
      {cfg.conveyorSpeed !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Belt Push Velocity</span>
            <span className="tabular-nums text-slate-500">{cfg.conveyorSpeed.toFixed(1)} m/s</span>
          </div>
          <input
            type="range"
            min={-16}
            max={16}
            step={0.5}
            value={cfg.conveyorSpeed}
            onChange={(e) => patchAddon('adjust belt velocity', { conveyorSpeed: Number(e.target.value) }, false)}
            className="w-full accent-[#22D3EE]"
          />
        </div>
      )}

      {/* Breakable trigger */}
      {mod === 'breakableBlock' && (
        <div className="space-y-1">
          <FieldLabel text="Shatter Trigger" />
          <select
            value={cfg.breakBy ?? 'any'}
            onChange={(e) =>
              patchAddon('change shatter rule', {
                breakBy: e.target.value as PlatformerAddonConfig['breakBy'],
              })
            }
            className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
          >
            <option value="any">Any Impact (Bonk / Dash / Pound / Crate)</option>
            <option value="groundPound">Ground-Pound Only</option>
            <option value="dash">Air-Dash Only</option>
            <option value="headBonk">Upward Head-Bonk Only</option>
            <option value="giant">Enlarged / Giant Smash Only</option>
          </select>
        </div>
      )}

      {/* Barrel Cannon */}
      {mod === 'barrelCannon' && (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Aim Angle (0=Up, 90=Right)</span>
              <span className="tabular-nums text-slate-500">{Math.round(cfg.cannonAngleDeg ?? 45)}°</span>
            </div>
            <input
              type="range"
              min={-90}
              max={90}
              step={5}
              value={cfg.cannonAngleDeg ?? 45}
              onChange={(e) => patchAddon('aim cannon', { cannonAngleDeg: Number(e.target.value) }, false)}
              className="w-full accent-[#D97706]"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Blast Power</span>
              <span className="tabular-nums text-slate-500">{(cfg.cannonPower ?? 22).toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={10}
              max={38}
              step={1}
              value={cfg.cannonPower ?? 22}
              onChange={(e) => patchAddon('adjust cannon power', { cannonPower: Number(e.target.value) }, false)}
              className="w-full accent-[#D97706]"
            />
          </div>
          <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
            <span>Auto-Rotate Aim</span>
            <input
              type="checkbox"
              checked={Boolean(cfg.cannonAutoRotate)}
              onChange={(e) => patchAddon('toggle auto rotate cannon', { cannonAutoRotate: e.target.checked })}
              className="accent-[#D97706]"
            />
          </label>
        </>
      )}

      {/* Bounce force / angle */}
      {cfg.bounceForce !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Launch Impulse</span>
            <span className="tabular-nums text-slate-500">{cfg.bounceForce.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={8}
            max={34}
            step={0.5}
            value={cfg.bounceForce}
            onChange={(e) => patchAddon('adjust launch force', { bounceForce: Number(e.target.value) }, false)}
            className="w-full accent-[#EF4444]"
          />
        </div>
      )}

      {cfg.bounceAngleDeg !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Launch Angle</span>
            <span className="tabular-nums text-slate-500">{Math.round(cfg.bounceAngleDeg)}°</span>
          </div>
          <input
            type="range"
            min={-85}
            max={180}
            step={5}
            value={cfg.bounceAngleDeg}
            onChange={(e) => patchAddon('adjust launch angle', { bounceAngleDeg: Number(e.target.value) }, false)}
            className="w-full accent-[#EF4444]"
          />
        </div>
      )}

      {/* Rope length */}
      {cfg.ropeLength !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Rope / Pendulum Length</span>
            <span className="tabular-nums text-slate-500">{cfg.ropeLength.toFixed(1)}m</span>
          </div>
          <input
            type="range"
            min={2.5}
            max={12}
            step={0.5}
            value={cfg.ropeLength}
            onChange={(e) => patchAddon('adjust rope length', { ropeLength: Number(e.target.value) }, false)}
            className="w-full accent-[#16A34A]"
          />
        </div>
      )}

      {/* Wind Tunnel */}
      {mod === 'windTunnel' && (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Wind Force</span>
              <span className="tabular-nums text-slate-500">{(cfg.windForce ?? 26).toFixed(0)}</span>
            </div>
            <input
              type="range"
              min={8}
              max={48}
              step={1}
              value={cfg.windForce ?? 26}
              onChange={(e) => patchAddon('adjust wind force', { windForce: Number(e.target.value) }, false)}
              className="w-full accent-[#38BDF8]"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-0.5">
              <FieldLabel text="Dir X (-1..1)" />
              <input
                type="number"
                step={0.25}
                min={-1}
                max={1}
                value={cfg.windDirX ?? 0}
                onChange={(e) => patchAddon('adjust wind X', { windDirX: Number(e.target.value) })}
                className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
              />
            </div>
            <div className="space-y-0.5">
              <FieldLabel text="Dir Y (-1..1)" />
              <input
                type="number"
                step={0.25}
                min={-1}
                max={1}
                value={cfg.windDirY ?? 1}
                onChange={(e) => patchAddon('adjust wind Y', { windDirY: Number(e.target.value) })}
                className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
              />
            </div>
          </div>
        </>
      )}

      {/* Water Oxygen */}
      {mod === 'waterZone' && (
        <>
          <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
            <span>Oxygen Breath Meter</span>
            <input
              type="checkbox"
              checked={cfg.oxygenEnabled !== false}
              onChange={(e) => patchAddon('toggle oxygen meter', { oxygenEnabled: e.target.checked })}
              className="accent-[#0EA5E9]"
            />
          </label>
          {cfg.oxygenEnabled !== false && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Max Breath Time</span>
                <span className="tabular-nums text-slate-500">{cfg.oxygenMaxSec ?? 18}s</span>
              </div>
              <input
                type="range"
                min={6}
                max={45}
                step={1}
                value={cfg.oxygenMaxSec ?? 18}
                onChange={(e) => patchAddon('adjust O2 max', { oxygenMaxSec: Number(e.target.value) }, false)}
                className="w-full accent-[#0EA5E9]"
              />
            </div>
          )}
        </>
      )}

      {/* Gravity Zone */}
      {mod === 'lowGravityZone' && (
        <>
          <div className="space-y-1">
            <FieldLabel text="Gravity Mode" />
            <select
              value={cfg.gravityMode ?? 'lowG'}
              onChange={(e) =>
                patchAddon('change gravity mode', {
                  gravityMode: e.target.value as PlatformerAddonConfig['gravityMode'],
                })
              }
              className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
            >
              <option value="lowG">Low Gravity Bubble</option>
              <option value="zeroG">Zero-G Float Zone</option>
              <option value="flipCeiling">Ceiling Invert Zone</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>Gravity Scale</span>
              <span className="tabular-nums text-slate-500">{(cfg.gravityScale ?? 0.34).toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1.2}
              step={0.05}
              value={cfg.gravityScale ?? 0.34}
              onChange={(e) => patchAddon('adjust gravity scale', { gravityScale: Number(e.target.value) }, false)}
              className="w-full accent-[#8B5CF6]"
            />
          </div>
        </>
      )}

      {/* Channel linking & timer */}
      {cfg.channelId !== undefined && (
        <div className="space-y-1">
          <FieldLabel text="Channel Link ID (Pairs Switches, Gates, Portals & Keys)" />
          <input
            type="text"
            value={cfg.channelId}
            onChange={(e) => patchAddon('update channel link', { channelId: e.target.value })}
            placeholder="e.g. ch1 or warpA"
            className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
          />
        </div>
      )}

      {cfg.timerSec !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>{mod === 'ghostEchoPad' ? 'Clone Record Length' : 'Countdown Timer (0=Perm)'}</span>
            <span className="tabular-nums text-slate-500">{cfg.timerSec.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={15}
            step={0.5}
            value={cfg.timerSec}
            onChange={(e) => patchAddon('adjust timer', { timerSec: Number(e.target.value) }, false)}
            className="w-full accent-[#A855F7]"
          />
        </div>
      )}

      {/* Star / Token Gateway */}
      {mod === 'starGateway' && (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="space-y-0.5">
            <FieldLabel text="Token Type" />
            <select
              value={cfg.tokenType ?? 'stars'}
              onChange={(e) =>
                patchAddon('change gateway token', {
                  tokenType: e.target.value as PlatformerAddonConfig['tokenType'],
                })
              }
              className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
            >
              <option value="stars">Star Coins</option>
              <option value="coins">Coins</option>
              <option value="keys">Keys</option>
            </select>
          </div>
          <div className="space-y-0.5">
            <FieldLabel text="Required" />
            <input
              type="number"
              min={1}
              max={999}
              value={cfg.requiredTokens ?? 2}
              onChange={(e) =>
                patchAddon('change required tokens', { requiredTokens: Math.max(1, Number(e.target.value)) })
              }
              className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-bold"
            />
          </div>
        </div>
      )}

      {/* Firebar count */}
      {mod === 'firebar' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Fireball Chain Length</span>
            <span className="tabular-nums text-slate-500">{cfg.firebarCount ?? 5} orbs</span>
          </div>
          <input
            type="range"
            min={3}
            max={8}
            step={1}
            value={cfg.firebarCount ?? 5}
            onChange={(e) => patchAddon('adjust firebar length', { firebarCount: Number(e.target.value) }, false)}
            className="w-full accent-[#F97316]"
          />
        </div>
      )}

      {/* Size Shift */}
      {mod === 'sizeShiftGate' && (
        <div className="space-y-1">
          <FieldLabel text="Size Shift Effect" />
          <select
            value={cfg.sizeMode ?? 'toggle'}
            onChange={(e) =>
              patchAddon('change size mode', {
                sizeMode: e.target.value as PlatformerAddonConfig['sizeMode'],
              })
            }
            className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
          >
            <option value="toggle">Toggle Shrink / Normal / Giant</option>
            <option value="shrink">Shrink Hero (0.5× Vents & Light Grav)</option>
            <option value="grow">Enlarge Giant (1.6× Heavy Smash)</option>
          </select>
        </div>
      )}

      {/* Star Coin Index */}
      {mod === 'starCoin' && (
        <div className="space-y-1">
          <FieldLabel text="Stage Star Slot" />
          <div className="grid grid-cols-3 gap-1">
            {([1, 2, 3] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => patchAddon('set star coin slot', { starIndex: slot })}
                className={`py-1 rounded-lg text-xs font-bold ${
                  (cfg.starIndex ?? 1) === slot
                    ? 'bg-[#F59E0B] text-white'
                    : 'bg-slate-100 dark:bg-[#1F2430]'
                }`}
              >
                Star #{slot}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Goal Type */}
      {mod === 'finishGoal' && (
        <div className="space-y-1">
          <FieldLabel text="Goal Style" />
          <select
            value={cfg.goalType ?? 'flagpole'}
            onChange={(e) =>
              patchAddon('change goal style', {
                goalType: e.target.value as PlatformerAddonConfig['goalType'],
              })
            }
            className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-xs font-semibold"
          >
            <option value="flagpole">Classic Flagpole Finish</option>
            <option value="tape">Bonus Ribbon Tape Break</option>
            <option value="secretExit">Secret Multi-Exit Warp</option>
          </select>
        </div>
      )}
    </MakerCard>
  );
};

export const PlatformerMovementInspector: React.FC<{
  store: MakerStore;
  level: GameLevel;
}> = ({ store, level }) => {
  const tuning = resolvePlatformerMovement(level);

  const patchMovement = (
    label: string,
    patch: Partial<PlatformerMovementConfig>,
    recordUndo = true
  ) => {
    store.updateLevel(
      label,
      (lvl) => {
        const nextTuning: PlatformerMovementConfig = {
          ...resolvePlatformerMovement(lvl),
          ...patch,
        };
        return {
          ...lvl,
          platformerTuning: nextTuning,
          ...(lvl.environmentType === 'sideScroller' || lvl.sideScrollerConfig
            ? {
                sideScrollerConfig: {
                  ...getSideScrollerConfig(lvl),
                  movementTuning: nextTuning,
                },
              }
            : {}),
        };
      },
      recordUndo
    );
  };

  return (
    <MakerCard className="space-y-3 border border-[#7C5CFF]/25">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-[#7C5CFF]">
          Player Feel, Upgrades &amp; World Pulse
        </span>
      </div>

      {/* Forgiveness Sliders */}
      <div className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-white/[0.08]">
        <FieldLabel text="Core Forgiveness Tuning" />
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span>Coyote Time</span>
            <span className="tabular-nums text-slate-500">{tuning.coyoteMs} ms</span>
          </div>
          <input
            type="range"
            min={0}
            max={320}
            step={10}
            value={tuning.coyoteMs}
            onChange={(e) => patchMovement('adjust coyote time', { coyoteMs: Number(e.target.value) }, false)}
            className="w-full accent-[#7C5CFF]"
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span>Jump Buffering</span>
            <span className="tabular-nums text-slate-500">{tuning.jumpBufferMs} ms</span>
          </div>
          <input
            type="range"
            min={0}
            max={320}
            step={10}
            value={tuning.jumpBufferMs}
            onChange={(e) => patchMovement('adjust jump buffer', { jumpBufferMs: Number(e.target.value) }, false)}
            className="w-full accent-[#7C5CFF]"
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span>Variable Short-Hop Cut</span>
            <span className="tabular-nums text-slate-500">{Math.round(tuning.variableJumpCut * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1.0}
            step={0.05}
            value={tuning.variableJumpCut}
            onChange={(e) =>
              patchMovement('adjust variable jump', { variableJumpCut: Number(e.target.value) }, false)
            }
            className="w-full accent-[#7C5CFF]"
          />
        </div>
      </div>

      {/* Toggleable Abilities */}
      <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
        <FieldLabel text="Unlockable Movement Abilities" />
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ['doubleJump', 'Double Jump'],
              ['wallSlideJump', 'Wall Slide/Jump'],
              ['airDash', 'Air-Dash (Shift/C)'],
              ['groundPound', 'Ground-Pound (S)'],
              ['ledgeMantle', 'Ledge Mantle'],
              ['glideHover', 'Glide / Hover'],
            ] as const
          ).map(([key, label]) => {
            const on = tuning[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => patchMovement(`toggle ${label}`, { [key]: !on })}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-extrabold border text-left transition-colors ${
                  on
                    ? 'bg-[#20B46A]/15 border-[#20B46A] text-[#059669] dark:text-[#34D399]'
                    : 'bg-slate-100 dark:bg-[#1F2430] border-transparent text-slate-500'
                }`}
              >
                {on ? '✓ ' : ''}
                {label}
              </button>
            );
          })}
        </div>
        {tuning.airDash && (
          <div className="grid grid-cols-2 gap-1 pt-0.5">
            {(['omni', 'horizontal'] as const).map((dm) => (
              <button
                key={dm}
                type="button"
                onClick={() => patchMovement('change dash mode', { dashMode: dm })}
                className={`py-1 rounded-lg text-[10px] font-bold ${
                  tuning.dashMode === dm
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-slate-100 dark:bg-[#1F2430] text-slate-500'
                }`}
              >
                {dm === 'omni' ? '8-Dir Omni Dash' : 'Horizontal Dash'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rhythm-Synced World Pulse */}
      <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
        <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
          <span>Rhythm-Synced World Pulse</span>
          <input
            type="checkbox"
            checked={tuning.rhythmPulseEnabled}
            onChange={(e) =>
              patchMovement('toggle rhythm pulse', { rhythmPulseEnabled: e.target.checked })
            }
            className="accent-[#EC4899]"
          />
        </label>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span>Global Tempo (BPM)</span>
            <span className="tabular-nums text-slate-500">{tuning.bpm} BPM</span>
          </div>
          <input
            type="range"
            min={60}
            max={180}
            step={2}
            value={tuning.bpm}
            onChange={(e) => patchMovement('adjust bpm', { bpm: Number(e.target.value) }, false)}
            className="w-full accent-[#EC4899]"
          />
        </div>
      </div>

      {/* Rising Hazard Tide */}
      <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
        <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
          <span>Rising Lava / Toxic Tide</span>
          <input
            type="checkbox"
            checked={tuning.risingTideEnabled}
            onChange={(e) =>
              patchMovement('toggle rising tide', { risingTideEnabled: e.target.checked })
            }
            className="accent-[#EF4444]"
          />
        </label>
        {tuning.risingTideEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={tuning.risingTideType}
              onChange={(e) =>
                patchMovement('change tide hazard', {
                  risingTideType: e.target.value as PlatformerMovementConfig['risingTideType'],
                })
              }
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold"
            >
              <option value="lava">Rising Lava</option>
              <option value="toxic">Toxic Acid</option>
              <option value="water">Flood Water</option>
            </select>
            <input
              type="number"
              step={0.1}
              min={0.1}
              max={4}
              value={tuning.risingTideSpeed}
              onChange={(e) =>
                patchMovement('change tide speed', { risingTideSpeed: Number(e.target.value) })
              }
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1F2430] text-[10px] font-bold"
              title="Rise speed in m/s"
            />
          </div>
        )}
      </div>
    </MakerCard>
  );
};

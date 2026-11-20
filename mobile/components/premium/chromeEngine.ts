import { AccessibilityInfo, AppState, AppStateStatus, Platform } from 'react-native';
import * as Battery from 'expo-battery';
import { PREMIUM_MOTION } from './tokens';

/**
 * Single app-wide Liquid Chrome animation engine & resource governor.
 *
 * Ports the shared timing & budget model from `C:\Users\kente\Desktop\palitrento2\js\liquid-chrome.js`
 * (`LOOP = 30.0` from `js\premium-shader-config.js`, `TUBE_LOOP = 55.0`, `CHIP_ANGLE`,
 * 30fps cap, max 12 simultaneously animated visible rings, reduce-motion & visibility pause).
 *
 * Renders via the allowed layered champagne-bronze gradient fallback (expo-linear-gradient)
 * after the isolated Skia Android NDK C++ build failed on this host.
 */

export type ChromeSurfaceMode = 'banner' | 'ring';

export interface ChromeEngineSnapshot {
  bannerAngle: number;
  ringAngle: number;
  fallbackActive: boolean;
  renderFailed: boolean;
  reduceMotion: boolean;
  lowPowerMode: boolean;
  lowEndDevice: boolean;
  appActive: boolean;
  measuredFps: number;
}

type TickListener = () => void;

interface SurfaceRecord {
  id: number;
  mode: ChromeSurfaceMode;
  visible: boolean;
  still: boolean;
}

class PremiumChromeEngine {
  private renderFailed = false;
  private reduceMotion = false;
  private lowPowerMode = false;
  private lowEndDevice = false;
  private appActive = AppState.currentState === 'active';

  private initialized = false;
  private nextId = 1;
  private surfaces = new Map<number, SurfaceRecord>();
  private activeRingIds = new Set<number>();
  private listeners = new Set<TickListener>();

  private rafId: number | null = null;
  private lastTs: number | null = null;
  private lastDrawTs = 0;
  private bannerTime = 0;
  private ringTime = 0;
  private measuredFps = 0;

  private lowPowerUnsubscribe: (() => void) | null = null;

  public ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < 26) {
      this.lowEndDevice = true;
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (this.reduceMotion !== Boolean(enabled)) {
          this.reduceMotion = Boolean(enabled);
          this.syncClock();
          this.emit();
        }
      })
      .catch(() => {});

    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (this.reduceMotion !== Boolean(enabled)) {
        this.reduceMotion = Boolean(enabled);
        this.syncClock();
        this.emit();
      }
    });

    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const nextActive = nextState === 'active';
      if (this.appActive !== nextActive) {
        this.appActive = nextActive;
        this.syncClock();
        this.emit();
      }
    });

    // Battery Saver / Low Power Mode (expo-battery)
    this.attachLowPowerSource(
      () => Battery.isLowPowerModeEnabledAsync(),
      (cb) => {
        const sub = Battery.addLowPowerModeListener(({ lowPowerMode }) => {
          cb(Boolean(lowPowerMode));
        });
        return () => sub.remove();
      }
    );
  }

  public setLowPowerMode(enabled: boolean): void {
    const next = Boolean(enabled);
    if (this.lowPowerMode !== next) {
      this.lowPowerMode = next;
      this.syncClock();
      this.emit();
    }
  }

  public attachLowPowerSource(
    getInitial: () => Promise<boolean>,
    subscribe: (cb: (enabled: boolean) => void) => () => void
  ): void {
    if (this.lowPowerUnsubscribe) return;
    getInitial()
      .then((enabled) => this.setLowPowerMode(enabled))
      .catch(() => {});
    try {
      this.lowPowerUnsubscribe = subscribe((enabled) => this.setLowPowerMode(enabled));
    } catch {
      this.lowPowerUnsubscribe = null;
    }
  }

  public markRenderFailed(): void {
    if (this.renderFailed) return;
    this.renderFailed = true;
    this.syncClock();
    this.emit();
  }

  public registerSurface(mode: ChromeSurfaceMode, visible: boolean, still: boolean): number {
    this.ensureInitialized();
    const id = this.nextId++;
    this.surfaces.set(id, { id, mode, visible, still });
    this.recomputeRingBudget();
    this.syncClock();
    return id;
  }

  public updateSurface(id: number, mode: ChromeSurfaceMode, visible: boolean, still: boolean): void {
    const rec = this.surfaces.get(id);
    if (!rec) return;
    if (rec.mode === mode && rec.visible === visible && rec.still === still) return;
    rec.mode = mode;
    rec.visible = visible;
    rec.still = still;
    this.recomputeRingBudget();
    this.syncClock();
    this.emit();
  }

  public unregisterSurface(id: number): void {
    if (!this.surfaces.delete(id)) return;
    this.recomputeRingBudget();
    this.syncClock();
  }

  public isRingAllowedToAnimate(id: number): boolean {
    return this.activeRingIds.has(id);
  }

  public getActiveAnimatedRingCount(): number {
    return this.activeRingIds.size;
  }

  public subscribe(listener: TickListener): () => void {
    this.ensureInitialized();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isFallbackForced(): boolean {
    return this.reduceMotion || this.lowPowerMode || this.lowEndDevice || this.renderFailed;
  }

  public getSnapshot(): ChromeEngineSnapshot {
    const twoPi = Math.PI * 2;
    return {
      bannerAngle: (this.bannerTime / PREMIUM_MOTION.bannerLoopSeconds) * twoPi,
      ringAngle: (this.ringTime / PREMIUM_MOTION.ringLoopSeconds) * twoPi,
      fallbackActive: this.isFallbackForced(),
      renderFailed: this.renderFailed,
      reduceMotion: this.reduceMotion,
      lowPowerMode: this.lowPowerMode,
      lowEndDevice: this.lowEndDevice,
      appActive: this.appActive,
      measuredFps: this.measuredFps,
    };
  }

  private recomputeRingBudget(): void {
    this.activeRingIds.clear();
    let count = 0;
    for (const rec of this.surfaces.values()) {
      if (rec.mode === 'ring' && rec.visible && !rec.still) {
        if (count < PREMIUM_MOTION.maxAnimatedRings) {
          this.activeRingIds.add(rec.id);
          count++;
        }
      }
    }
  }

  private hasAnyAnimatingSurface(): boolean {
    if (this.isFallbackForced() || !this.appActive) return false;
    for (const rec of this.surfaces.values()) {
      if (!rec.visible || rec.still) continue;
      if (rec.mode === 'banner') return true;
      if (rec.mode === 'ring' && this.activeRingIds.has(rec.id)) return true;
    }
    return false;
  }

  private syncClock(): void {
    if (this.hasAnyAnimatingSurface()) {
      if (this.rafId === null) {
        this.lastTs = null;
        this.lastDrawTs = 0;
        this.rafId = requestAnimationFrame(this.tick);
      }
    } else if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.lastTs = null;
      this.measuredFps = 0;
    }
  }

  private tick = (timestamp: number): void => {
    this.rafId = null;
    if (!this.hasAnyAnimatingSurface()) {
      this.lastTs = null;
      this.measuredFps = 0;
      return;
    }

    if (this.lastDrawTs > 0 && timestamp - this.lastDrawTs < PREMIUM_MOTION.frameIntervalMs) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    const dtMs = this.lastTs === null ? 0 : timestamp - this.lastTs;
    const dtSec = Math.min(0.25, Math.max(0, dtMs / 1000));
    if (dtSec > 0) {
      this.measuredFps = Math.round(1 / dtSec);
    }

    this.bannerTime = (this.bannerTime + dtSec) % PREMIUM_MOTION.bannerLoopSeconds;
    this.ringTime = (this.ringTime + dtSec) % PREMIUM_MOTION.ringLoopSeconds;
    this.lastTs = timestamp;
    this.lastDrawTs = timestamp;

    this.emit();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private emit(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }
}

export const premiumChromeEngine = new PremiumChromeEngine();

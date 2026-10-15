// Offline still renderer (dev tooling): renders one art-directed frame of the model to a PNG data URL.
// Used by the image script in the agent scratchpad (puppeteer + SwiftShader); not imported by the app.
import { createStage, type StageFraming, type StudioTuning } from './stage';
import type { SmartColorway, SmartPart, SmartShape, SmartVariant } from './types';

export interface StillSpec {
  width: number;
  height: number;
  variant: SmartVariant;
  colorway: SmartColorway;
  shape?: SmartShape;
  background: 'light' | 'dark';
  yaw: number;
  pitch: number;
  exploded?: number;
  active?: SmartPart | null;
  hud?: number;
  led?: number;
  framing?: Partial<StageFraming>;
  tuning?: Partial<StudioTuning>;
}

export function renderStill(spec: StillSpec): string {
  const canvas = document.createElement('canvas');
  const stage = createStage(canvas, { antialias: true, preserveDrawingBuffer: true, shadowRes: 1024 });
  try {
    stage.setLook({ variant: spec.variant, colorway: spec.colorway, shape: spec.shape, background: spec.background });
    if (spec.tuning) stage.setTuning(spec.tuning);
    stage.setFraming({ ...spec.framing, restYaw: spec.yaw, restPitch: spec.pitch });
    stage.setSize(spec.width, spec.height, 1);
    const highlight = { camera: 0, led: 0, speaker: 0, mics: 0, touch: 0, battery: 0, display: 0, hinge: 0 };
    if (spec.active) highlight[spec.active] = 1;
    stage.apply({ yaw: spec.yaw, pitch: spec.pitch, lift: 0, exploded: spec.exploded ?? 0, highlight, hud: spec.hud ?? 0, led: spec.led ?? 0, time: 0, reduced: true });
    stage.render();
    return canvas.toDataURL('image/png');
  } finally {
    stage.dispose();
    stage.renderer.forceContextLoss();
  }
}

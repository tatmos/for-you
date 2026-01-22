/**
 * Breathing Oscillator for Internalized Mode
 * 
 * Provides slow, organic temporal modulation for perception.
 * Not animation time, but perceptual time.
 */

export type BreathState = {
  phase: number;        // [0, 1] current position in cycle
  derivative: number;   // rate of change (inhale/exhale direction)
  intensity: number;    // [0, 1] breath depth
};

export type BreathOscillator = {
  update: (delta: number) => void;
  getState: () => BreathState;
  reset: () => void;
};

export const createBreathOscillator = (period = 16.0): BreathOscillator => {
  let time = 0;
  let lastPhase = 0;

  const getState = (): BreathState => {
    // Smooth breathing cycle using sine wave
    // This feels more organic than linear triangle
    const rawPhase = (time % period) / period; // [0, 1]
    const phase = Math.sin(rawPhase * Math.PI * 2) * 0.5 + 0.5; // [0, 1] smoothed
    
    // Derivative: positive = inhale, negative = exhale
    const derivative = Math.cos(rawPhase * Math.PI * 2);
    
    // Intensity: how deep the breath is (could be modulated by coherence later)
    const intensity = 1.0;

    return { phase, derivative, intensity };
  };

  const update = (delta: number) => {
    time += delta;
  };

  const reset = () => {
    time = 0;
    lastPhase = 0;
  };

  return { update, getState, reset };
};

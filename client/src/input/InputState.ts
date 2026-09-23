/** Normalised, device-agnostic input snapshot consumed by the player controller. */
export interface InputState {
  /** -1 (left) .. 1 (right), camera-relative. */
  moveX: number;
  /** -1 (back) .. 1 (forward), camera-relative. */
  moveZ: number;
  /** The jump control, HELD: Space or the JUMP button. Only a fresh press jumps. */
  jump: boolean;
  /** A web shot was asked for this frame: a click on the world or the WEB button. */
  attack: boolean;
  /** The web control is being HELD (a held button keeps shooting). */
  attackHeld: boolean;
}

export const createInputState = (): InputState => ({ moveX: 0, moveZ: 0, jump: false, attack: false, attackHeld: false });

// Talking pilot portrait.
// Sprite sheet: columns = idle, talk_a, talk_b, blink; rows = moods (see MOODS).
export const MOODS = ["normal", "determined", "alarmed"];

export class Portrait {
  constructor(image, { size = 32 } = {}) {
    this.image = image;
    this.size = size;
    this.mood = "normal";
    this.talking = false;
    this.talkTimer = 0;
    this.talkFrame = 0;
    this.blinkTimer = 2 + Math.random() * 3;
    this.blinking = 0;
    this.shake = [0, 0];
  }

  // Call when a line of dialogue starts / ends.
  setTalking(on) {
    this.talking = on;
    this.talkTimer = 0;
  }

  setMood(mood) {
    // sheets without mood rows (single row) stay on row 0
    this.mood = mood;
  }

  moodRow() {
    const row = MOODS.indexOf(this.mood);
    return row * this.size < this.image.height ? Math.max(0, row) : 0;
  }

  update(dt) {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 0.12;
      // alarmed blinks more, determined stares
      const base = this.mood === "alarmed" ? 1 : this.mood === "determined" ? 3 : 2;
      this.blinkTimer = base + Math.random() * 3;
    }
    this.blinking = Math.max(0, this.blinking - dt);

    if (this.talking) {
      this.talkTimer -= dt;
      if (this.talkTimer <= 0) {
        // random mouth shape keeps it from looking like a metronome
        this.talkFrame = [0, 1, 2, 1][Math.floor(Math.random() * 4)];
        const pace = this.mood === "normal" ? 1 : 0.7;
        this.talkTimer = (0.07 + Math.random() * 0.06) * pace;
      }
    } else {
      this.talkFrame = 0;
    }

    // alarmed: jitter while shouting; determined holds steady
    const amp = this.mood === "alarmed" ? (this.talking ? 1 : 0.4) : 0;
    this.shake = Math.random() < amp
      ? [Math.round(Math.random() * 2 - 1), Math.round(Math.random() * 2 - 1)]
      : [0, 0];
  }

  frame() {
    // blink only wins while mouth is closed, so the face never looks broken
    if (this.blinking > 0 && this.talkFrame === 0) return 3;
    return this.talkFrame;
  }

  draw(ctx, x, y, scale = 1) {
    const s = this.size;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.image,
      this.frame() * s, this.moodRow() * s, s, s,
      x + this.shake[0] * scale, y + this.shake[1] * scale, s * scale, s * scale,
    );
  }
}

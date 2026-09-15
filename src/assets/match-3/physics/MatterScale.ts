/**
 * Matter.js's default solver tolerances (contact slop, resting/sleep thresholds) are tuned for
 * roughly pixel-scale worlds — shapes sized in the tens to low thousands of units, the way a
 * typical browser game's canvas works. Feeding it this game's native units directly (a marble
 * radius of 0.15) would make that slop comparable to a marble's own size, producing mushy,
 * imprecise collision response instead of the clean contact behavior Matter is actually built
 * for. Scaling every position and size up by this factor before handing it to Matter, then back
 * down when reading state out, keeps Matter operating in the numeric range it's tuned for while
 * the rest of the game keeps using its own small native units untouched — nothing outside the
 * physics/ folder needs to know this conversion happens at all.
 */
export const MATTER_SCALE = 100;

/**
 * Matter.js's own integration (position Verlet under the hood) assumes a fixed step between
 * Engine.update() calls — its velocity representation is "displacement per step," not literally
 * "per second," so a variable delta (as our real-time render loop naturally produces) would throw
 * off both gravity and any velocity we set directly. Stepping the engine at this fixed rate,
 * regardless of the actual frame delta, is the standard, robust way to use Matter.js; the
 * game can still run at whatever real frame rate it wants around that.
 */
export const PHYSICS_FIXED_DT_MS = 1000 / 60;

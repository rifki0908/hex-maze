/**
 * Maze Generator — Procedural maze with difficulty scaling
 * Uses recursive backtracker + post-processing for traps/keys/enemies/teleporters
 */

const MazeGenerator = (() => {
  // Tier definitions
  const TIERS = [
    { name: 'Rookie',      emoji: '🌱', levels: [1, 10] },
    { name: 'Apprentice',  emoji: '🌿', levels: [11, 25] },
    { name: 'Thinker',     emoji: '🧠', levels: [26, 40] },
    { name: 'Strategist',  emoji: '⚔️', levels: [41, 55] },
    { name: 'Infiltrator', emoji: '🔥', levels: [56, 70] },
    { name: 'Mastermind',  emoji: '💎', levels: [71, 85] },
    { name: 'Phantom',     emoji: '👻', levels: [86, 100] },
    { name: 'Infinite',    emoji: '♾️', levels: [101, 9999] },
  ];

  // Cell types
  const CELL = {
    WALL: 0,
    PATH: 1,
    PLAYER: 2,
    EXIT: 3,
    KEY: 4,
    TRAP: 5,
    TELEPORTER: 6,
    ENEMY: 7,
    FOG: 8,
  };

  function getTier(level) {
    for (const t of TIERS) {
      if (level >= t.levels[0] && level <= t.levels[1]) return t;
    }
    return TIERS[TIERS.length - 1];
  }

  function getLevelConfig(level) {
    const tier = getTier(level);
    const progress = Math.min(level / 100, 1);

    // Maze size scales with level
    const baseW = 7;
    const baseH = 5;
    const maxW = 25;
    const maxH = 17;
    const width = Math.min(maxW, baseW + Math.floor(level * 0.18));
    const height = Math.min(maxH, baseH + Math.floor(level * 0.12));

    // Timer (seconds)
    const timer = Math.max(20, 120 - Math.floor(level * 0.8));

    // Keys required
    const keys = level < 5 ? 0 : Math.min(5, Math.floor(level / 10) + 1);

    // Traps
    const traps = Math.min(12, Math.floor(level * 0.15));

    // Enemies (start at level 15)
    const enemies = level < 15 ? 0 : Math.min(6, Math.floor((level - 15) * 0.08));

    // Teleporters (pairs, start at level 8)
    const teleporterPairs = level < 8 ? 0 : Math.min(3, Math.floor((level - 8) / 12) + 1);

    // Fog of war (start at level 30)
    const fogRadius = level < 30 ? -1 : Math.max(2, 5 - Math.floor((level - 30) / 20));

    return { width, height, timer, keys, traps, enemies, teleporterPairs, fogRadius, tier };
  }

  function generate(level) {
    const config = getLevelConfig(level);
    const { width, height } = config;

    // Ensure odd dimensions for maze gen
    const w = width % 2 === 0 ? width + 1 : width;
    const h = height % 2 === 0 ? height + 1 : height;

    // Init grid with walls
    const grid = Array.from({ length: h }, () => Array(w).fill(CELL.WALL));

    // Recursive backtracker
    const stack = [];
    const startX = 1;
    const startY = 1;
    grid[startY][startX] = CELL.PATH;
    stack.push([startX, startY]);

    const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];

    while (stack.length > 0) {
      const [cx, cy] = stack[stack.length - 1];
      const neighbors = [];

      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && grid[ny][nx] === CELL.WALL) {
          neighbors.push([nx, ny, cx + dx / 2, cy + dy / 2]);
        }
      }

      if (neighbors.length === 0) {
        stack.pop();
      } else {
        const [nx, ny, mx, my] = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[ny][nx] = CELL.PATH;
        grid[my][mx] = CELL.PATH;
        stack.push([nx, ny]);
      }
    }

    // Place player at top-left area
    const playerPos = { x: startX, y: startY };
    grid[playerPos.y][playerPos.x] = CELL.PLAYER;

    // Place exit at bottom-right area (find furthest path cell)
    let exitPos = { x: w - 2, y: h - 2 };
    if (grid[exitPos.y][exitPos.x] !== CELL.PATH) {
      // Find nearest path cell to bottom-right
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const ey = h - 1 - dy;
          const ex = w - 1 - dx;
          if (grid[ey][ex] === CELL.PATH) {
            exitPos = { x: ex, y: ey };
            dy = h; break;
          }
        }
      }
    }
    grid[exitPos.y][exitPos.x] = CELL.EXIT;

    // Get all path cells (excluding player and exit)
    const pathCells = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] === CELL.PATH) {
          // Don't place stuff too close to player or exit
          const distPlayer = Math.abs(x - playerPos.x) + Math.abs(y - playerPos.y);
          const distExit = Math.abs(x - exitPos.x) + Math.abs(y - exitPos.y);
          if (distPlayer > 2 && distExit > 2) {
            pathCells.push({ x, y });
          }
        }
      }
    }

    // Shuffle path cells
    for (let i = pathCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pathCells[i], pathCells[j]] = [pathCells[j], pathCells[i]];
    }

    let idx = 0;

    // Place keys
    const keyPositions = [];
    for (let i = 0; i < config.keys && idx < pathCells.length; i++, idx++) {
      const { x, y } = pathCells[idx];
      grid[y][x] = CELL.KEY;
      keyPositions.push({ x, y });
    }

    // Place traps
    const trapPositions = [];
    for (let i = 0; i < config.traps && idx < pathCells.length; i++, idx++) {
      const { x, y } = pathCells[idx];
      grid[y][x] = CELL.TRAP;
      trapPositions.push({ x, y });
    }

    // Place enemies
    const enemyPositions = [];
    for (let i = 0; i < config.enemies && idx < pathCells.length; i++, idx++) {
      const { x, y } = pathCells[idx];
      grid[y][x] = CELL.ENEMY;
      enemyPositions.push({ x, y, dir: Math.floor(Math.random() * 4) });
    }

    // Place teleporters (pairs)
    const teleporters = [];
    for (let i = 0; i < config.teleporterPairs && idx + 1 < pathCells.length; i++) {
      const a = pathCells[idx++];
      const b = pathCells[idx++];
      grid[a.y][a.x] = CELL.TELEPORTER;
      grid[b.y][b.x] = CELL.TELEPORTER;
      teleporters.push({ a, b });
    }

    return {
      grid,
      width: w,
      height: h,
      playerPos,
      exitPos,
      keyPositions,
      trapPositions,
      enemyPositions,
      teleporters,
      config,
    };
  }

  return { generate, getLevelConfig, getTier, CELL, TIERS };
})();

if (typeof module !== 'undefined') module.exports = MazeGenerator;

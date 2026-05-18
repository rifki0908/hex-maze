/**
 * Game Engine — Rendering, input, game loop
 */

class HexMazeGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = 1;
    this.score = 0;
    this.moves = 0;
    this.keysCollected = 0;
    this.timeLeft = 0;
    this.timerInterval = null;
    this.maze = null;
    this.player = null;
    this.enemies = [];
    this.enemyInterval = null;
    this.state = 'idle'; // idle, playing, paused, complete, gameover
    this.cellSize = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.animFrame = null;
    this.highestLevel = parseInt(localStorage.getItem('hexmaze_highest') || '1');
    this.totalScore = parseInt(localStorage.getItem('hexmaze_score') || '0');
    this.hintsUsed = 0;
    this.maxHints = 3;
    this.currentTier = null;
    this.hintCooldown = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.maze) this.calculateLayout();
    if (this.state === 'playing') this.render();
  }

  calculateLayout() {
    const hudHeight = 50;
    const padding = 20;
    const controlsHeight = window.innerWidth <= 768 ? 200 : 0;
    const availW = this.canvas.width - padding * 2;
    const availH = this.canvas.height - hudHeight - padding * 2 - controlsHeight;

    const cellW = Math.floor(availW / this.maze.width);
    const cellH = Math.floor(availH / this.maze.height);
    this.cellSize = Math.min(cellW, cellH, 48);

    const mazePixelW = this.maze.width * this.cellSize;
    const mazePixelH = this.maze.height * this.cellSize;
    this.offsetX = Math.floor((this.canvas.width - mazePixelW) / 2);
    this.offsetY = Math.floor((this.canvas.height - mazePixelH) / 2) + hudHeight / 2;
  }

  startLevel(level) {
    this.level = level;
    this.moves = 0;
    this.keysCollected = 0;
    this.hintsUsed = 0;
    this.hintCooldown = false;
    this.maze = MazeGenerator.generate(level);
    this.player = { ...this.maze.playerPos };
    this.enemies = this.maze.enemyPositions.map(e => ({ ...e }));
    this.timeLeft = this.maze.config.timer;
    this.state = 'playing';

    // Check tier change for narration
    const newTier = this.maze.config.tier;
    if (!this.currentTier || this.currentTier.name !== newTier.name) {
      this.currentTier = newTier;
      this.fetchNarration(newTier.name, level);
    }

    this.calculateLayout();
    this.startTimer();
    this.startEnemies();
    this.updateHUD();
    this.render();
  }

  // AI Hint System
  async requestHint() {
    if (this.state !== 'playing') return;
    if (this.hintCooldown) return;
    if (this.hintsUsed >= this.maxHints) {
      this.showToast('No hints left!');
      return;
    }

    this.hintCooldown = true;
    this.hintsUsed++;
    this.score = Math.max(0, this.score - 100); // Hint costs 100 points
    this.updateHUD();

    const hintBtn = document.getElementById('btn-hint');
    if (hintBtn) hintBtn.textContent = '💡 Loading...';

    try {
      const keysLeft = this.maze.config.keys - this.keysCollected;
      const response = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grid: this.maze.grid,
          playerPos: this.player,
          exitPos: this.maze.exitPos,
          keysLeft,
          level: this.level,
        }),
      });
      const data = await response.json();
      this.showToast(data.hint || 'Try a different direction!', 5000);
    } catch (err) {
      this.showToast('Try exploring paths you haven\'t visited!', 3000);
    }

    if (hintBtn) hintBtn.textContent = `💡 Hint (${this.maxHints - this.hintsUsed})`;
    setTimeout(() => { this.hintCooldown = false; }, 3000);
  }

  // AI Narration System
  async fetchNarration(tierName, level) {
    try {
      const response = await fetch('/api/narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierName, level }),
      });
      const data = await response.json();
      if (data.narration) {
        this.showNarration(tierName, data.narration);
      }
    } catch (err) {
      // Fallback narration
      this.showNarration(tierName, `Welcome to ${tierName}. The maze grows deeper...`);
    }
  }

  showNarration(tierName, text) {
    const overlay = document.getElementById('narration-overlay');
    const title = document.getElementById('narration-title');
    const content = document.getElementById('narration-text');
    if (!overlay) return;

    title.textContent = `⚡ ${tierName}`;
    content.textContent = text;
    overlay.classList.remove('hidden');

    // Auto-dismiss after 5s or on click
    const dismiss = () => {
      overlay.classList.add('hidden');
      overlay.removeEventListener('click', dismiss);
    };
    overlay.addEventListener('click', dismiss);
    setTimeout(dismiss, 5000);
  }

  showToast(message, duration = 3000) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'game-toast';
      toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border:1px solid #00d4ff;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;z-index:100;max-width:80%;text-align:center;transition:opacity 0.3s;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, duration);
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state !== 'playing') return;
      this.timeLeft--;
      this.updateTimerDisplay();
      if (this.timeLeft <= 0) {
        this.gameOver("Time's up!");
      }
    }, 1000);
  }

  startEnemies() {
    if (this.enemyInterval) clearInterval(this.enemyInterval);
    if (this.enemies.length === 0) return;

    const speed = Math.max(300, 800 - this.level * 5);
    this.enemyInterval = setInterval(() => {
      if (this.state !== 'playing') return;
      this.moveEnemies();
      this.render();
    }, speed);
  }

  moveEnemies() {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const { CELL } = MazeGenerator;

    for (const enemy of this.enemies) {
      // Simple patrol: try current dir, if blocked pick random
      const [dx, dy] = dirs[enemy.dir];
      const nx = enemy.x + dx;
      const ny = enemy.y + dy;

      if (this.isWalkable(nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
      } else {
        // Pick new random direction
        const available = dirs.map((d, i) => i).filter(i => {
          const [ddx, ddy] = dirs[i];
          return this.isWalkable(enemy.x + ddx, enemy.y + ddy);
        });
        if (available.length > 0) {
          enemy.dir = available[Math.floor(Math.random() * available.length)];
        }
      }

      // Check collision with player
      if (enemy.x === this.player.x && enemy.y === this.player.y) {
        this.gameOver('Caught by enemy!');
        return;
      }
    }
  }

  isWalkable(x, y) {
    if (x < 0 || x >= this.maze.width || y < 0 || y >= this.maze.height) return false;
    const cell = this.maze.grid[y][x];
    const { CELL } = MazeGenerator;
    return cell !== CELL.WALL;
  }

  movePlayer(dx, dy) {
    if (this.state !== 'playing') return;

    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    const { CELL } = MazeGenerator;

    if (nx < 0 || nx >= this.maze.width || ny < 0 || ny >= this.maze.height) return;
    const targetCell = this.maze.grid[ny][nx];
    if (targetCell === CELL.WALL) return;

    // Move
    this.maze.grid[this.player.y][this.player.x] = CELL.PATH;
    this.player.x = nx;
    this.player.y = ny;
    this.moves++;

    // Handle cell interactions
    switch (targetCell) {
      case CELL.KEY:
        this.keysCollected++;
        this.score += 50;
        break;
      case CELL.TRAP:
        this.timeLeft = Math.max(0, this.timeLeft - 5);
        this.score = Math.max(0, this.score - 20);
        break;
      case CELL.TELEPORTER:
        this.handleTeleport(nx, ny);
        break;
      case CELL.EXIT:
        if (this.keysCollected >= this.maze.config.keys) {
          this.levelComplete();
          return;
        }
        break;
    }

    // Check enemy collision
    for (const enemy of this.enemies) {
      if (enemy.x === this.player.x && enemy.y === this.player.y) {
        this.gameOver('Caught by enemy!');
        return;
      }
    }

    this.maze.grid[this.player.y][this.player.x] = CELL.PLAYER;
    this.updateHUD();
    this.render();
  }

  handleTeleport(x, y) {
    for (const tp of this.maze.teleporters) {
      if (tp.a.x === x && tp.a.y === y) {
        this.player.x = tp.b.x;
        this.player.y = tp.b.y;
        return;
      }
      if (tp.b.x === x && tp.b.y === y) {
        this.player.x = tp.a.x;
        this.player.y = tp.a.y;
        return;
      }
    }
  }

  levelComplete() {
    this.state = 'complete';
    clearInterval(this.timerInterval);
    clearInterval(this.enemyInterval);

    const timeBonus = this.timeLeft * 10;
    const moveBonus = Math.max(0, 500 - this.moves * 2);
    const levelScore = 100 + timeBonus + moveBonus;
    this.score += levelScore;
    this.totalScore += levelScore;

    if (this.level >= this.highestLevel) {
      this.highestLevel = this.level + 1;
      localStorage.setItem('hexmaze_highest', this.highestLevel.toString());
    }
    localStorage.setItem('hexmaze_score', this.totalScore.toString());

    // Stars
    const maxTime = this.maze.config.timer;
    const timeRatio = this.timeLeft / maxTime;
    const stars = timeRatio > 0.6 ? 3 : timeRatio > 0.3 ? 2 : 1;

    // Show complete screen
    document.getElementById('complete-time').textContent = this.formatTime(maxTime - this.timeLeft);
    document.getElementById('complete-moves').textContent = this.moves;
    document.getElementById('complete-score').textContent = `+${levelScore}`;
    document.getElementById('complete-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    this.showScreen('complete-screen');
  }

  gameOver(reason) {
    this.state = 'gameover';
    clearInterval(this.timerInterval);
    clearInterval(this.enemyInterval);
    document.getElementById('gameover-reason').textContent = reason;
    this.showScreen('gameover-screen');
  }

  // Rendering
  render() {
    const ctx = this.ctx;
    const { CELL } = MazeGenerator;
    const cs = this.cellSize;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    for (let y = 0; y < this.maze.height; y++) {
      for (let x = 0; x < this.maze.width; x++) {
        const px = this.offsetX + x * cs;
        const py = this.offsetY + y * cs;
        const cell = this.maze.grid[y][x];

        // Fog of war
        if (this.maze.config.fogRadius > 0) {
          const dist = Math.abs(x - this.player.x) + Math.abs(y - this.player.y);
          if (dist > this.maze.config.fogRadius) {
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(px, py, cs, cs);
            continue;
          }
        }

        // Draw cell
        switch (cell) {
          case CELL.WALL:
            ctx.fillStyle = '#1a2a1a';
            ctx.fillRect(px, py, cs, cs);
            ctx.strokeStyle = '#2a4a2a';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, cs, cs);
            break;
          case CELL.PATH:
            ctx.fillStyle = 'rgba(0,255,136,0.03)';
            ctx.fillRect(px, py, cs, cs);
            ctx.strokeStyle = 'rgba(0,255,136,0.08)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, cs, cs);
            break;
          case CELL.PLAYER:
            ctx.fillStyle = 'rgba(0,212,255,0.15)';
            ctx.fillRect(px, py, cs, cs);
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
            // Player icon
            ctx.fillStyle = '#00d4ff';
            ctx.font = `${cs * 0.6}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏃', px + cs / 2, py + cs / 2);
            break;
          case CELL.EXIT:
            ctx.fillStyle = 'rgba(255,215,0,0.1)';
            ctx.fillRect(px, py, cs, cs);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
            ctx.font = `${cs * 0.5}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const locked = this.keysCollected < this.maze.config.keys;
            ctx.fillText(locked ? '🔒' : '🚪', px + cs / 2, py + cs / 2);
            break;
          case CELL.KEY:
            ctx.fillStyle = 'rgba(255,215,0,0.06)';
            ctx.fillRect(px, py, cs, cs);
            ctx.font = `${cs * 0.5}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔑', px + cs / 2, py + cs / 2);
            break;
          case CELL.TRAP:
            ctx.fillStyle = 'rgba(255,71,87,0.08)';
            ctx.fillRect(px, py, cs, cs);
            ctx.font = `${cs * 0.5}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡', px + cs / 2, py + cs / 2);
            break;
          case CELL.TELEPORTER:
            ctx.fillStyle = 'rgba(168,85,247,0.12)';
            ctx.fillRect(px, py, cs, cs);
            ctx.strokeStyle = 'rgba(168,85,247,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
            ctx.font = `${cs * 0.5}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🌀', px + cs / 2, py + cs / 2);
            break;
        }
      }
    }

    // Draw enemies
    for (const enemy of this.enemies) {
      const px = this.offsetX + enemy.x * cs;
      const py = this.offsetY + enemy.y * cs;

      // Fog check
      if (this.maze.config.fogRadius > 0) {
        const dist = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
        if (dist > this.maze.config.fogRadius) continue;
      }

      ctx.fillStyle = 'rgba(255,71,87,0.15)';
      ctx.fillRect(px, py, cs, cs);
      ctx.font = `${cs * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👾', px + cs / 2, py + cs / 2);
    }
  }

  // HUD
  updateHUD() {
    const tier = this.maze.config.tier;
    document.getElementById('hud-level').textContent = `Level ${this.level}`;
    document.getElementById('hud-tier').textContent = `${tier.emoji} Tier: ${tier.name}`;
    document.getElementById('hud-keys').textContent = `🔑 ${this.keysCollected}/${this.maze.config.keys}`;
    document.getElementById('hud-moves').textContent = `👣 ${this.moves}`;
    document.getElementById('hud-score').textContent = `⭐ ${this.score}`;
    this.updateTimerDisplay();
  }

  updateTimerDisplay() {
    const el = document.getElementById('hud-timer');
    el.textContent = this.formatTime(this.timeLeft);
    el.style.color = this.timeLeft <= 10 ? '#ff4757' : this.timeLeft <= 30 ? '#ffd700' : '#ff4757';
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.getElementById('pause-overlay').classList.remove('hidden');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    document.getElementById('pause-overlay').classList.add('hidden');
  }

  destroy() {
    clearInterval(this.timerInterval);
    clearInterval(this.enemyInterval);
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }
}

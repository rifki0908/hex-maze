/**
 * Main — App initialization, input handling, screen management
 */

(function () {
  const canvas = document.getElementById('game-canvas');
  const game = new HexMazeGame(canvas);

  // Update menu stats
  function updateMenuStats() {
    document.getElementById('menu-highest').textContent = `Highest: Level ${game.highestLevel}`;
    document.getElementById('menu-stars').textContent = `⭐ ${game.totalScore}`;
    if (game.highestLevel > 1) {
      document.getElementById('btn-continue').style.display = 'block';
    }
  }

  // Screen management
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // Start game
  function startGame(level) {
    showScreen('game-screen');
    game.startLevel(level || 1);
  }

  // Event: Play button
  document.getElementById('btn-play').addEventListener('click', () => startGame(1));

  // Event: Continue
  document.getElementById('btn-continue').addEventListener('click', () => {
    startGame(game.highestLevel);
  });

  // Event: Levels (just start from 1 for now)
  document.getElementById('btn-levels').addEventListener('click', () => startGame(1));

  // Event: Next level
  document.getElementById('btn-next').addEventListener('click', () => {
    showScreen('game-screen');
    game.startLevel(game.level + 1);
  });

  // Event: Retry
  document.getElementById('btn-retry').addEventListener('click', () => {
    showScreen('game-screen');
    game.startLevel(game.level);
  });

  // Event: Menu from gameover
  document.getElementById('btn-menu').addEventListener('click', () => {
    updateMenuStats();
    showScreen('menu-screen');
  });

  // Event: Pause/Resume
  document.getElementById('btn-resume').addEventListener('click', () => game.resume());
  document.getElementById('btn-quit').addEventListener('click', () => {
    game.state = 'idle';
    clearInterval(game.timerInterval);
    clearInterval(game.enemyInterval);
    updateMenuStats();
    showScreen('menu-screen');
  });

  // Keyboard input
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        game.movePlayer(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        game.movePlayer(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        game.movePlayer(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        game.movePlayer(1, 0);
        break;
      case 'Escape':
      case 'p':
      case 'P':
        if (game.state === 'playing') game.pause();
        else if (game.state === 'paused') game.resume();
        break;
    }
  });

  // Touch controls
  document.querySelectorAll('.touch-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const dir = btn.dataset.dir;
      switch (dir) {
        case 'up': game.movePlayer(0, -1); break;
        case 'down': game.movePlayer(0, 1); break;
        case 'left': game.movePlayer(-1, 0); break;
        case 'right': game.movePlayer(1, 0); break;
      }
    });
    btn.addEventListener('click', (e) => {
      const dir = btn.dataset.dir;
      switch (dir) {
        case 'up': game.movePlayer(0, -1); break;
        case 'down': game.movePlayer(0, 1); break;
        case 'left': game.movePlayer(-1, 0); break;
        case 'right': game.movePlayer(1, 0); break;
      }
    });
  });

  // Swipe support
  let touchStartX = 0;
  let touchStartY = 0;
  canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });
  canvas.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const threshold = 30;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > threshold) {
        game.movePlayer(dx > 0 ? 1 : -1, 0);
      }
    } else {
      if (Math.abs(dy) > threshold) {
        game.movePlayer(0, dy > 0 ? 1 : -1);
      }
    }
  });

  // Init
  updateMenuStats();
})();

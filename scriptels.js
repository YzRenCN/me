
/**
 * Tetris Game Logic
 * Implements core game mechanics: board management, piece movement, collision detection,
 * line clearing, scoring, and rendering.
 */

// --- Configuration & Constants ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24; // Internal logic size, scaled by canvas context
const COLORS = [
    null,
    '#FF0D72', // T - Magenta
    '#0DC2FF', // I - Cyan
    '#0DFF72', // S - Green
    '#F538FF', // Z - Purple (Custom)
    '#FF8E0D', // L - Orange
    '#FFE138', // O - Yellow
    '#3877FF', // J - Blue
];

// Shape Definitions (Matrices)
const SHAPES = [
    [],
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]], // T
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]], // I
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]], // S
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]], // Z
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]], // L
    [[1, 1], [1, 1]],                   // O
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]]  // J
];

// --- Game State ---
let canvas, ctx, nextCanvas, nextCtx;
let board = [];
let score = 0;
let lines = 0;
let level = 1;
let gameOver = false;
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let animationId = null;

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    colorIndex: 0
};

let nextPiece = {
    matrix: null,
    colorIndex: 0
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('tetris');
    ctx = canvas.getContext('2d');
    
    // Scale context to make blocks larger visually
    ctx.scale(20, 20); // 240/10 = 24, but we use 20 for simpler math in this demo, adjusted via CSS
    
    nextCanvas = document.getElementById('next-piece');
    nextCtx = nextCanvas.getContext('2d');
    nextCtx.scale(20, 20);

    resetGame();
    updateScore();
    loadHighScores();
    
    // Event Listeners
    document.addEventListener('keydown', handleKeyPress);
    document.getElementById('restart-btn').addEventListener('click', resetGame);
    document.getElementById('clear-scores-btn').addEventListener('click', clearHighScores);
    
    // Mobile Controls
    setupMobileControls();

    // Start Loop
    update();
});

function setupMobileControls() {
    const bindBtn = (id, action) => {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(); });
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); action(); });
    };

    bindBtn('btn-left', () => playerMove(-1));
    bindBtn('btn-right', () => playerMove(1));
    bindBtn('btn-down', () => playerDrop());
    bindBtn('btn-rotate', () => playerRotate(1));
    bindBtn('btn-drop', () => playerHardDrop());
    
    document.getElementById('mobile-pause-btn').addEventListener('click', togglePause);
}

// --- Core Game Logic ---

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function resetGame() {
    board = createMatrix(COLS, ROWS);
    score = 0;
    lines = 0;
    level = 1;
    gameOver = false;
    isPaused = false;
    dropInterval = 1000;
    
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    
    generateNextPiece();
    playerReset();
    updateScore();
    
    if (animationId) cancelAnimationFrame(animationId);
    lastTime = 0;
    dropCounter = 0;
    update();
}

function generateNextPiece() {
    const typeId = (Math.random() * (SHAPES.length - 1) | 0) + 1;
    nextPiece.matrix = SHAPES[typeId];
    nextPiece.colorIndex = typeId;
    drawNextPiece();
}

function playerReset() {
    // If we have a next piece, use it, otherwise generate random
    if (nextPiece.matrix) {
        player.matrix = nextPiece.matrix;
        player.colorIndex = nextPiece.colorIndex;
        generateNextPiece();
    } else {
        // Initial start
        const typeId = (Math.random() * (SHAPES.length - 1) | 0) + 1;
        player.matrix = SHAPES[typeId];
        player.colorIndex = typeId;
        generateNextPiece();
    }

    player.pos.y = 0;
    player.pos.x = (board[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    // Immediate collision check = Game Over
    if (collide(board, player)) {
        gameOver = true;
        showGameOver();
    }
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function draw() {
    // Clear Board
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Board State
    drawMatrix(board, { x: 0, y: 0 }, ctx);

    // Draw Active Piece
    drawMatrix(player.matrix, player.pos, ctx);
}

function drawMatrix(matrix, offset, context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                // Determine color
                let color = COLORS[value];
                // If value is just 1 (from board merge), we might need to store color info in board
                // For simplicity in this version, board stores the colorIndex directly
                if (typeof value === 'number' && value > 0) {
                     color = COLORS[value];
                }
                
                context.fillStyle = color;
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
                
                // Add bevel effect
                context.lineWidth = 0.05;
                context.strokeStyle = 'rgba(255,255,255,0.5)';
                context.strokeRect(x + offset.x, y + offset.y, 1, 1);
                
                // Inner shadow
                context.fillStyle = 'rgba(0,0,0,0.1)';
                context.fillRect(x + offset.x + 0.1, y + offset.y + 0.8, 0.8, 0.1);
                context.fillRect(x + offset.x + 0.8, y + offset.y + 0.1, 0.1, 0.8);
            }
        });
    });
}

function drawNextPiece() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    // Center the piece
    const xOffset = (5 - nextPiece.matrix[0].length) / 2;
    const yOffset = (5 - nextPiece.matrix.length) / 2;
    
    drawMatrix(nextPiece.matrix, {x: xOffset, y: yOffset}, nextCtx);
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = player.colorIndex;
            }
        });
    });
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    // Wall kick (basic)
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        arenaSweep();
        playerReset();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(board, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(board, player);
    arenaSweep();
    playerReset();
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(board, player)) {
        player.pos.x -= dir;
    }
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = board.length - 1; y > 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;
        rowCount++;
    }
    
    if (rowCount > 0) {
        // Scoring: 100, 300, 500, 800
        const lineScores = [0, 100, 300, 500, 800];
        score += lineScores[rowCount] * level;
        lines += rowCount;
        level = Math.floor(lines / 10) + 1;
        
        // Speed up
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        
        updateScore();
        saveHighScore();
    }
}

function updateScore() {
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = level;
    document.getElementById('lines').innerText = lines;
}

function showGameOver() {
    document.getElementById('final-score').innerText = score;
    const modal = document.getElementById('game-over-modal');
    modal.classList.remove('hidden');
    // Trigger animation
    setTimeout(() => modal.classList.add('modal-enter-active'), 10);
}

function togglePause() {
    if (gameOver) return;
    isPaused = !isPaused;
    const overlay = document.getElementById('pause-overlay');
    if (isPaused) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
        lastTime = performance.now(); // Reset time to prevent jump
        update();
    }
}

function update(time = 0) {
    if (gameOver) return;
    if (isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    animationId = requestAnimationFrame(update);
}

function handleKeyPress(event) {
    if (gameOver) return;
    
    // Prevent default scrolling for game keys
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].indexOf(event.code) > -1) {
        event.preventDefault();
    }

    if (event.keyCode === 80) { // P key
        togglePause();
        return;
    }

    if (isPaused) return;

    if (event.keyCode === 37) { // Left
        playerMove(-1);
    } else if (event.keyCode === 39) { // Right
        playerMove(1);
    } else if (event.keyCode === 40) { // Down
        playerDrop();
    } else if (event.keyCode === 38) { // Up (Rotate)
        playerRotate(1);
    } else if (event.keyCode === 32) { // Space (Hard Drop)
        playerHardDrop();
    }
}

// --- Local Storage for High Scores ---
function saveHighScore() {
    let highScores = JSON.parse(localStorage.getItem('tetrisHighScores')) || [];
    highScores.push({ score: score, date: new Date().toLocaleDateString() });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5); // Keep top 5
    localStorage.setItem('tetrisHighScores', JSON.stringify(highScores));
    loadHighScores();
}

function loadHighScores() {
    const list = document.getElementById('high-scores-list');
    const highScores = JSON.parse(localStorage.getItem('tetrisHighScores')) || [];
    
    if (highScores.length === 0) {
        list.innerHTML = '<li class="text-center text-gray-500 italic">No scores yet</li>';
        return;
    }
    
    list.innerHTML = highScores.map((entry, index) => `
        <li class="flex justify-between items-center bg-gray-700/50 p-2 rounded">
            <span class="font-bold text-yellow-500">#${index + 1}</span>
            <span class="text-white">${entry.score}</span>
            <span class="text-xs text-gray-400">${entry.date}</span>
        </li>
    `).join('');
}

function clearHighScores() {
    localStorage.removeItem('tetrisHighScores');
    loadHighScores();
}

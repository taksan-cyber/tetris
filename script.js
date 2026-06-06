const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const BOARD_COLOR = '#000000';
const GHOST_COLOR = 'rgba(255, 255, 255, 0.2)';

const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-board');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-board');
const holdCtx = holdCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');

const gameOverScreen = document.getElementById('game-over-screen');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

ctx.scale(BLOCK_SIZE, BLOCK_SIZE);
nextCtx.scale(BLOCK_SIZE, BLOCK_SIZE);
holdCtx.scale(BLOCK_SIZE, BLOCK_SIZE);

// Tetromino colors based on neon aesthetics
const COLORS = [
    null,
    '#00ffff', // I - Cyan
    '#0000ff', // J - Blue
    '#ff7f00', // L - Orange
    '#ffff00', // O - Yellow
    '#00ff00', // S - Green
    '#800080', // T - Purple
    '#ff0000'  // Z - Red
];

// 1 is I, 2 is J, 3 is L, 4 is O, 5 is S, 6 is T, 7 is Z
const SHAPES = [
    [],
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    [
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0]
    ],
    [
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0]
    ],
    [
        [4, 4],
        [4, 4]
    ],
    [
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0]
    ],
    [
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],
    [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0]
    ]
];

let board = [];
let piece = null;
let nextPieces = [];
let holdPiece = null;
let canHold = true;
let score = 0;
let lines = 0;
let level = 1;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isGameOver = false;
let isPlaying = false;
let animationId = null;

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function drawMatrix(matrix, offset, context = ctx, colorOverride = null) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                // Glow effect
                context.shadowBlur = 10;
                context.shadowColor = colorOverride || COLORS[value];
                context.fillStyle = colorOverride || COLORS[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
                
                // Block border
                context.shadowBlur = 0;
                context.fillStyle = 'rgba(0,0,0,0.4)';
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
                
                // Inner bright part
                context.fillStyle = colorOverride || COLORS[value];
                context.fillRect(x + offset.x + 0.1, y + offset.y + 0.1, 0.8, 0.8);
            }
        });
    });
}

function collide(board, piece) {
    const m = piece.matrix;
    const o = piece.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(board, piece) {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + piece.pos.y][x + piece.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    // Transpose
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    // Reverse rows format
    if (dir > 0) { // Clockwise
        matrix.forEach(row => row.reverse());
    } else { // Counter-clockwise
        matrix.reverse();
    }
}

function pieceRotate(dir) {
    const pos = piece.pos.x;
    let offset = 1;
    rotate(piece.matrix, dir);
    while (collide(board, piece)) {
        piece.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > piece.matrix[0].length) {
            rotate(piece.matrix, -dir);
            piece.pos.x = pos;
            return;
        }
    }
}

function pieceDrop() {
    piece.pos.y++;
    if (collide(board, piece)) {
        piece.pos.y--;
        merge(board, piece);
        playerReset();
        arenaSweep();
        updateScore();
        canHold = true;
    }
    dropCounter = 0;
}

function pieceHardDrop() {
    while (!collide(board, piece)) {
        piece.pos.y++;
    }
    piece.pos.y--;
    merge(board, piece);
    playerReset();
    arenaSweep();
    updateScore();
    canHold = true;
    dropCounter = 0;
}

function pieceMove(offset) {
    piece.pos.x += offset;
    if (collide(board, piece)) {
        piece.pos.x -= offset;
    }
}

function createPiece(type) {
    return {
        matrix: JSON.parse(JSON.stringify(SHAPES[type])),
        type: type,
        pos: {x: 0, y: 0}
    };
}

function getRandomPieceType() {
    return Math.floor(Math.random() * 7) + 1;
}

function spawnPiece() {
    const type = nextPieces.shift();
    nextPieces.push(getRandomPieceType());
    const p = createPiece(type);
    p.pos.y = 0;
    p.pos.x = Math.floor(COLS / 2) - Math.floor(p.matrix[0].length / 2);
    return p;
}

function playerReset() {
    piece = spawnPiece();
    if (collide(board, piece)) {
        gameOver();
    }
}

function hold() {
    if (!canHold) return;
    
    if (holdPiece === null) {
        holdPiece = piece.type;
        playerReset();
    } else {
        const temp = piece.type;
        piece = createPiece(holdPiece);
        piece.pos.y = 0;
        piece.pos.x = Math.floor(COLS / 2) - Math.floor(piece.matrix[0].length / 2);
        holdPiece = temp;
    }
    canHold = false;
    dropCounter = 0;
}

function arenaSweep() {
    let rowCount = 1;
    let linesCleared = 0;
    outer: for (let y = board.length - 1; y >= 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;
        linesCleared++;
    }

    if (linesCleared > 0) {
        lines += linesCleared;
        // Simple score system
        const lineScores = [0, 40, 100, 300, 1200];
        score += lineScores[linesCleared] * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
    }
}

function updateScore() {
    scoreElement.innerText = score;
    levelElement.innerText = level;
    linesElement.innerText = lines;
}

function getGhostPos() {
    const ghost = {
        matrix: piece.matrix,
        pos: { x: piece.pos.x, y: piece.pos.y }
    };
    while (!collide(board, ghost)) {
        ghost.pos.y++;
    }
    ghost.pos.y--;
    return ghost;
}

function drawGrid(context, cols, rows) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    context.lineWidth = 0.05;
    
    context.beginPath();
    for (let x = 0; x <= cols; x++) {
        context.moveTo(x, 0);
        context.lineTo(x, rows);
    }
    for (let y = 0; y <= rows; y++) {
        context.moveTo(0, y);
        context.lineTo(cols, y);
    }
    context.stroke();
}

function drawNextAndHold() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, 4, 12);
    
    // Draw Next Pieces (3 visible)
    for(let i=0; i<3; i++) {
        if(nextPieces[i]) {
            const nextP = createPiece(nextPieces[i]);
            const offsetX = 2 - nextP.matrix[0].length / 2;
            const offsetY = 1 + (i * 4);
            drawMatrix(nextP.matrix, {x: offsetX, y: offsetY}, nextCtx);
        }
    }

    holdCtx.fillStyle = '#000';
    holdCtx.fillRect(0, 0, 4, 4);
    
    if (holdPiece) {
        const hp = createPiece(holdPiece);
        const offsetX = 2 - hp.matrix[0].length / 2;
        const offsetY = 2 - hp.matrix.length / 2;
        drawMatrix(hp.matrix, {x: offsetX, y: offsetY}, holdCtx);
    }
}

function draw() {
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawGrid(ctx, COLS, ROWS);
    drawMatrix(board, {x: 0, y: 0});
    
    if (piece) {
        const ghost = getGhostPos();
        drawMatrix(ghost.matrix, ghost.pos, ctx, GHOST_COLOR); // Draw ghost
        drawMatrix(piece.matrix, piece.pos); // Draw active piece
    }
    
    drawNextAndHold();
}

function update(time = 0) {
    if(!isPlaying) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        pieceDrop();
    }

    draw();
    animationId = requestAnimationFrame(update);
}

function gameOver() {
    isPlaying = false;
    isGameOver = true;
    cancelAnimationFrame(animationId);
    gameOverScreen.classList.remove('hidden');
}

function resetGame() {
    board = createMatrix(COLS, ROWS);
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    nextPieces = [getRandomPieceType(), getRandomPieceType(), getRandomPieceType()];
    holdPiece = null;
    canHold = true;
    isGameOver = false;
    updateScore();
    playerReset();
    
    gameOverScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    
    isPlaying = true;
    lastTime = performance.now();
    update();
}

startBtn.addEventListener('click', () => {
    resetGame();
});

restartBtn.addEventListener('click', () => {
    resetGame();
});

document.addEventListener('keydown', event => {
    if (!isPlaying) return;
    
    switch(event.key) {
        case 'ArrowLeft':
            pieceMove(-1);
            break;
        case 'ArrowRight':
            pieceMove(1);
            break;
        case 'ArrowDown':
            pieceDrop();
            break;
        case 'ArrowUp':
        case 'x':
        case 'X':
            pieceRotate(1); // Clockwise
            break;
        case 'z':
        case 'Z':
            pieceRotate(-1); // Counter-clockwise
            break;
        case ' ': // Space
            pieceHardDrop();
            break;
        case 'c':
        case 'C':
        case 'Shift':
            hold();
            break;
    }
    
    // Prevent default scrolling for game keys
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(event.key)) {
        event.preventDefault();
    }
});

// Initial draw
board = createMatrix(COLS, ROWS);
drawGrid(ctx, COLS, ROWS);

let game = null;
let selectedSquare = null;
let moveHistory = [];
let isComputerGame = false;
let difficulty = 5;
let isComputerThinking = false;
let isBoardFlipped = false; // Добавлено состояние переворота
const stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');

function flipBoard() {
    const board = document.getElementById('board');
    const coordinates = document.querySelectorAll('.coordinates');
    const materials = document.querySelectorAll('.material');
    
    isBoardFlipped = !isBoardFlipped;
    
    board.style.transform = isBoardFlipped ? 'rotate(180deg)' : 'none';
    coordinates.forEach(coord => coord.style.transform = isBoardFlipped ? 'rotate(180deg)' : 'none');
    materials.forEach(material => material.style.transform = isBoardFlipped ? 'translateX(-50%) rotate(180deg)' : 'translateX(-50%)');
    
    updateBoard();
}

function initBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    for (let row = isBoardFlipped ? 0 : 7; isBoardFlipped ? row < 8 : row >= 0; isBoardFlipped ? row++ : row--) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.position = `${String.fromCharCode(97 + col)}${8 - row}`;
            square.addEventListener('click', handleSquareClick);
            board.appendChild(square);
        }
    }
    
    document.querySelector('.horizontal').innerHTML = ['A','B','C','D','E','F','G','H'].map(l => `<div class="coord">${l}</div>`).join('');
    document.querySelector('.vertical').innerHTML = Array.from({length: 8}, (_, i) => `<div class="coord">${i + 1}</div>`).join('');
}


function updateBoard() {
    const positions = game.board();
    
    document.querySelectorAll('.square').forEach(square => {
        square.innerHTML = '';
        square.classList.remove('selected');
        const [col, row] = square.dataset.position.split('');
        const x = col.charCodeAt(0) - 97;
        const y = 8 - parseInt(row);
        const piece = positions[y][x];
        
        if (piece) {
            const img = document.createElement('img');
            img.className = 'piece';
            img.src = `pieces/${piece.color === 'w' ? 'w' : 'b'}${piece.type.toUpperCase()}.svg`;
            square.appendChild(img);
        }
    });
    
    updateMaterial();
    checkGameStatus();
}

function handleSquareClick(e) {
    if (isComputerThinking || (isComputerGame && game.turn() === 'b')) return;
    const position = e.target.dataset.position;
    
    const moves = game.moves({square: position, verbose: true});
    
    if (selectedSquare === position) {
        clearDots();
        selectedSquare = null;
        return;
    }

    if (moves.length) {
        selectedSquare = position;
        document.querySelectorAll('.square').forEach(sq => sq.classList.remove('selected'));
        e.target.classList.add('selected');
        showMoves(moves);
    } else if (selectedSquare) {
        const move = game.move({
            from: selectedSquare,
            to: position,
            promotion: 'q'
        });
        
        if (move) {
            moveHistory.push(move);
            clearDots();
            selectedSquare = null;
            updateBoard();
            
            if (isComputerGame && !game.game_over()) {
                setTimeout(computerMove, 500);
            }
        }
    }
}

function showMoves(moves) {
    clearDots();
    moves.forEach(m => {
        const square = document.querySelector(`[data-position="${m.to}"]`);
        const dot = document.createElement('div');
        dot.className = 'dot';
        square.appendChild(dot);
    });
}

function clearDots() {
    document.querySelectorAll('.dot').forEach(d => d.remove());
}

function startGame(mode) {
    game = new Chess();
    moveHistory = [];
    isComputerGame = mode === 'computer';
    document.querySelector('.menu-overlay').classList.add('hidden');
    document.querySelector('.game-container').style.display = 'block';
    initBoard();
    updateBoard();
    
    if (mode === 'computer' && game.turn() === 'b') {
        computerMove();
    }
}

function showDifficulty() {
    document.getElementById('difficultySelect').style.display = 'flex';
}

document.getElementById('difficulty').addEventListener('input', function() {
    difficulty = parseInt(this.value);
    document.getElementById('level').textContent = difficulty;
});

async function computerMove() {
    if (!isComputerGame || game.game_over() || isComputerThinking) return;
    
    isComputerThinking = true;
    try {
        const move = await getComputerMove();
        game.move(move);
        moveHistory.push(move);
        updateBoard();
    } finally {
        isComputerThinking = false;
    }
}

function getComputerMove() {
    return new Promise((resolve) => {
        stockfish.postMessage('uci');
        stockfish.postMessage(`position fen ${game.fen()}`);
        stockfish.postMessage(`setoption name Skill Level value ${difficulty * 2}`);
        stockfish.postMessage('go movetime 1000');

        const timeout = setTimeout(() => {
            stockfish.removeEventListener('message', handler);
            resolve(null);
        }, 2000);

        const handler = (e) => {
            if (e.data.startsWith('bestmove')) {
                clearTimeout(timeout);
                const move = e.data.split(' ')[1];
                stockfish.removeEventListener('message', handler);
                resolve(move || null);
            }
        };
        
        stockfish.addEventListener('message', handler);
    });
}

function checkGameStatus() {
    if (game.in_checkmate()) {
        alert(game.turn() === 'w' ? 'Чёрные победили! Мат!' : 'Белые победили! Мат!');
    } else if (game.in_draw()) {
        alert('Ничья!');
    } else if (game.in_check()) {
        console.log('Шах!');
    }
}

function undoMove() {
    if (moveHistory.length < 1 || isComputerThinking) return;
    
    if (isComputerGame) {
        if (moveHistory.length >= 2) {
            game.undo();
            game.undo();
            moveHistory.pop();
            moveHistory.pop();
        }
    } else {
        game.undo();
        moveHistory.pop();
    }
    
    updateBoard();
}

function updateMaterial() {
    const pieces = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0 };
    let white = 0, black = 0;
    
    game.board().forEach(row => {
        row.forEach(piece => {
            if (piece) {
                const value = pieces[piece.type];
                piece.color === 'w' ? white += value : black += value;
            }
        });
    });
    
    const diff = white - black;
    document.querySelector('.material.white').textContent = diff > 0 ? `+${diff}` : '';
    document.querySelector('.material.black').textContent = diff < 0 ? `+${-diff}` : '';
}

document.querySelector('.menu-overlay').classList.remove('hidden');
initBoard();

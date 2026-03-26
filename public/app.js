const socket = io();

// ── State ──
let myId = null;
let myName = '';
let roomId = null;
let isDrawer = false;
let currentWord = '';
let guessedCorrectly = false;
let gameState = null;
let drawingEnabled = false;

// ── Canvas ──
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let lastX = 0, lastY = 0;
let currentColor = '#000000';
let brushSize = 6;
let currentTool = 'pen';

const COLORS = [
    '#000000','#ffffff','#ef4444','#f97316','#f59e0b','#22c55e',
    '#06b6d4','#3b82f6','#8b5cf6','#ec4899','#6b7280','#92400e',
    '#065f46','#1e3a5f','#7c3aed','#be185d'
];

// ── Pages ──
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ── Helpers ──
function avatarLetter(name) { return (name || '?')[0].toUpperCase(); }

function avatarColor(name) {
    const colors = ['#4f6ef7','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
    let h = 0;
    for (let c of (name || '')) h = (h * 31 + c.charCodeAt(0)) % colors.length;
    return colors[h];
}

function showError(elId, msg) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Landing ──
document.getElementById('create-room-btn').addEventListener('click', () => {
    const name = document.getElementById('player-name').value.trim();
    if (!name) return showError('landing-error', 'Please enter your name');
    myName = name;
    socket.emit('createRoom', name);
});

document.getElementById('join-room-btn').addEventListener('click', () => {
    const name = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!name) return showError('landing-error', 'Please enter your name');
    if (!code) return showError('landing-error', 'Please enter a room code');
    myName = name;
    socket.emit('joinRoom', { roomId: code, playerName: name });
});

document.getElementById('room-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('join-room-btn').click();
});
document.getElementById('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('create-room-btn').click();
});

// ── Lobby ──
document.getElementById('copy-code-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => {
        const btn = document.getElementById('copy-code-btn');
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '⧉', 1500);
    });
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    socket.emit('startGame');
});

document.getElementById('play-again-btn').addEventListener('click', () => {
    showPage('lobby-page');
    renderLobby(gameState);
});

// ── Word Select ──
function showWordOptions(options) {
    showPage('word-select-page');
    const container = document.getElementById('word-options');
    container.innerHTML = '';
    options.forEach(word => {
        const btn = document.createElement('button');
        btn.className = 'word-option-btn';
        btn.textContent = word;
        btn.addEventListener('click', () => {
            socket.emit('selectWord', word);
        });
        container.appendChild(btn);
    });
}

// ── Lobby Render ──
function renderLobby(state) {
    if (!state) return;
    document.getElementById('lobby-room-code').textContent = state.id;
    const list = document.getElementById('lobby-players');
    list.innerHTML = '';
    state.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item';
        const av = document.createElement('div');
        av.className = 'player-avatar';
        av.style.background = avatarColor(p.name);
        av.textContent = avatarLetter(p.name);
        const nm = document.createElement('span');
        nm.className = 'player-name';
        nm.textContent = p.name;
        div.appendChild(av);
        div.appendChild(nm);
        if (p.id === state.hostId) {
            const badge = document.createElement('span');
            badge.className = 'host-badge';
            badge.textContent = 'Host';
            div.appendChild(badge);
        }
        list.appendChild(div);
    });

    const startBtn = document.getElementById('start-game-btn');
    const statusEl = document.getElementById('lobby-status');

    const amHost = state.hostId === myId;

    if (amHost) {
        if (state.players.length >= 2) {
            startBtn.classList.remove('hidden');
            statusEl.textContent = `${state.players.length} players ready`;
        } else {
            startBtn.classList.add('hidden');
            statusEl.textContent = 'Waiting for at least 2 players...';
        }
    } else {
        startBtn.classList.add('hidden');
        statusEl.textContent = `${state.players.length} player${state.players.length !== 1 ? 's' : ''} in room`;
    }
}

// ── Game Render ──
function renderGame(state) {
    if (!state) return;

    // Round info
    document.getElementById('round-info').textContent = `Round ${state.currentRound + 1} / ${state.maxRounds}`;

    // Drawer info
    const drawerName = state.currentDrawer ? state.currentDrawer.name : '';
    if (isDrawer) {
        document.getElementById('drawer-info').textContent = 'You are drawing';
        document.getElementById('word-display').textContent = currentWord.split('').join(' ');
    } else {
        document.getElementById('drawer-info').textContent = drawerName ? `${drawerName} is drawing` : '';
        if (state.revealedWord) {
            document.getElementById('word-display').textContent = state.revealedWord.split('').join(' ');
        } else if (state.wordLength) {
            document.getElementById('word-display').textContent = Array(state.wordLength).fill('_').join(' ');
        }
    }

    // Players sidebar
    const sidebar = document.getElementById('players-sidebar');
    sidebar.innerHTML = '';
    state.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'sidebar-player';
        if (state.currentDrawer && p.id === state.currentDrawer.id) div.classList.add('drawing');

        const av = document.createElement('div');
        av.className = 'sidebar-avatar';
        av.style.background = avatarColor(p.name);
        av.textContent = avatarLetter(p.name);

        const nm = document.createElement('div');
        nm.className = 'sidebar-player-name';
        nm.textContent = p.name;

        const sc = document.createElement('div');
        sc.className = 'sidebar-player-score';
        sc.textContent = p.score + ' pts';

        div.appendChild(av);
        div.appendChild(nm);
        div.appendChild(sc);

        if (state.currentDrawer && p.id === state.currentDrawer.id) {
            const badge = document.createElement('div');
            badge.className = 'drawing-badge';
            badge.textContent = '✏️';
            div.appendChild(badge);
        }

        sidebar.appendChild(div);
    });

    // Drawing tools
    const tools = document.getElementById('drawing-tools');
    if (isDrawer) {
        tools.classList.remove('disabled');
        drawingEnabled = true;
    } else {
        tools.classList.add('disabled');
        drawingEnabled = false;
    }
}

// ── Timer ──
function updateTimer(t) {
    const el = document.getElementById('timer');
    const wrap = el.parentElement;
    el.textContent = t;
    if (t <= 10) {
        el.classList.add('urgent');
        wrap.classList.add('urgent');
    } else {
        el.classList.remove('urgent');
        wrap.classList.remove('urgent');
    }
}

// ── Chat ──
function addChatMsg(type, content) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';

    if (type === 'system') {
        div.classList.add('system');
        div.textContent = content;
    } else if (type === 'correct') {
        div.classList.add('correct-guess');
        div.textContent = content;
    } else {
        const name = document.createElement('span');
        name.className = 'msg-name';
        name.textContent = content.name + ':';
        const text = document.createElement('span');
        text.className = 'msg-text';
        text.textContent = ' ' + content.message;
        div.appendChild(name);
        div.appendChild(text);
    }

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

document.getElementById('chat-send-btn').addEventListener('click', sendGuess);
document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendGuess();
});

function sendGuess() {
    if (isDrawer || guessedCorrectly) return;
    const input = document.getElementById('chat-input');
    const val = input.value.trim();
    if (!val) return;
    socket.emit('guess', val);
    input.value = '';
}

// ── Canvas Setup ──
function resizeCanvas() {
    const area = document.querySelector('.canvas-area');
    const toolsH = document.getElementById('drawing-tools').offsetHeight + 10;
    const topbarH = document.querySelector('.game-topbar').offsetHeight;
    const maxW = area.clientWidth - 24;
    const maxH = window.innerHeight - topbarH - toolsH - 40;
    const size = Math.min(maxW, maxH, 700);
    canvas.width = size;
    canvas.height = size;
}

window.addEventListener('resize', resizeCanvas);

// ── Color Palette ──
function buildPalette() {
    const palette = document.getElementById('color-palette');
    COLORS.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch';
        sw.style.background = c;
        if (c === currentColor) sw.classList.add('active');
        sw.addEventListener('click', () => {
            currentColor = c;
            currentTool = 'pen';
            document.getElementById('tool-pen').classList.add('active');
            document.getElementById('tool-eraser').classList.remove('active');
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
        });
        palette.appendChild(sw);
    });
}

document.getElementById('tool-pen').addEventListener('click', () => {
    currentTool = 'pen';
    document.getElementById('tool-pen').classList.add('active');
    document.getElementById('tool-eraser').classList.remove('active');
});

document.getElementById('tool-eraser').addEventListener('click', () => {
    currentTool = 'eraser';
    document.getElementById('tool-eraser').classList.add('active');
    document.getElementById('tool-pen').classList.remove('active');
});

document.getElementById('brush-size').addEventListener('input', e => {
    brushSize = parseInt(e.target.value);
});

document.getElementById('clear-canvas-btn').addEventListener('click', () => {
    if (!drawingEnabled) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas');
});

// ── Drawing Events ──
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function startDraw(e) {
    if (!drawingEnabled) return;
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x; lastY = pos.y;
}

function draw(e) {
    if (!isDrawing || !drawingEnabled) return;
    e.preventDefault();
    const pos = getPos(e);
    const color = currentTool === 'eraser' ? '#ffffff' : currentColor;
    const size = currentTool === 'eraser' ? brushSize * 3 : brushSize;

    drawLine(ctx, lastX, lastY, pos.x, pos.y, color, size);

    socket.emit('draw', {
        x0: lastX / canvas.width,
        y0: lastY / canvas.height,
        x1: pos.x / canvas.width,
        y1: pos.y / canvas.height,
        color,
        size
    });

    lastX = pos.x; lastY = pos.y;
}

function stopDraw() { isDrawing = false; }

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseleave', stopDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', stopDraw);

function drawLine(context, x0, y0, x1, y1, color, size) {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
}

// ── Overlays ──
function showCorrectOverlay(text) {
    const ov = document.getElementById('correct-overlay');
    document.getElementById('correct-overlay-text').textContent = text;
    ov.classList.remove('hidden');
    setTimeout(() => ov.classList.add('hidden'), 2500);
}

function showWordReveal(word) {
    const ov = document.getElementById('word-reveal-overlay');
    document.getElementById('revealed-word-text').textContent = word;
    ov.classList.remove('hidden');
    setTimeout(() => ov.classList.add('hidden'), 3000);
}

// ── Results ──
function showResults(players) {
    showPage('results-page');
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const list = document.getElementById('results-list');
    list.innerHTML = '';
    const rankSymbols = ['🥇', '🥈', '🥉'];
    const rankClasses = ['gold', 'silver', 'bronze'];
    sorted.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'result-item';

        const rank = document.createElement('div');
        rank.className = 'result-rank ' + (rankClasses[i] || '');
        rank.textContent = rankSymbols[i] || (i + 1);

        const av = document.createElement('div');
        av.className = 'result-avatar';
        av.style.background = avatarColor(p.name);
        av.textContent = avatarLetter(p.name);

        const nm = document.createElement('div');
        nm.className = 'result-name';
        nm.textContent = p.name;

        const sc = document.createElement('div');
        sc.className = 'result-score';
        sc.textContent = p.score + ' pts';

        div.appendChild(rank);
        div.appendChild(av);
        div.appendChild(nm);
        div.appendChild(sc);
        list.appendChild(div);
    });
}

// ── Socket Events ──
socket.on('roomCreated', ({ roomId: id, playerId }) => {
    myId = playerId;
    roomId = id;
    document.getElementById('lobby-room-code').textContent = id;
});

socket.on('roomJoined', ({ roomId: id, playerId }) => {
    myId = playerId;
    roomId = id;
    document.getElementById('lobby-room-code').textContent = id;
});

socket.on('error', (msg) => {
    showError('landing-error', msg);
});

socket.on('gameState', (data) => {
    const state = data.room;
    gameState = state;

    if (state.gameState === 'waiting') {
        showPage('lobby-page');
        renderLobby(state);
        return;
    }

    if (state.gameState === 'finished') {
        showResults(state.players);
        return;
    }

    if (state.gameState === 'choosing') {
        // If I'm the drawer, word-select page is shown via wordOptions event
        // For others, show a waiting overlay in game page
        if (!isDrawer) {
            showPage('game-page');
            resizeCanvas();
            renderGame(state);
            document.getElementById('word-display').textContent = '...';
            document.getElementById('drawer-info').textContent =
                state.currentDrawer ? `${state.currentDrawer.name} is choosing a word` : '';
        }
        return;
    }

    if (state.gameState === 'drawing') {
        showPage('game-page');
        resizeCanvas();

        isDrawer = state.currentDrawer && state.currentDrawer.id === myId;

        if (state.selectedWord) {
            currentWord = state.selectedWord;
        }

        renderGame(state);
        updateTimer(state.timeLeft || 60);
    }
});

socket.on('wordOptions', (options) => {
    isDrawer = true;
    showWordOptions(options);
});

socket.on('timerUpdate', (t) => {
    updateTimer(t);
});

socket.on('letterReveal', (revealed) => {
    if (!isDrawer) {
        document.getElementById('word-display').textContent = revealed.split('').join(' ');
    }
});

socket.on('draw', (data) => {
    drawLine(
        ctx,
        data.x0 * canvas.width,
        data.y0 * canvas.height,
        data.x1 * canvas.width,
        data.y1 * canvas.height,
        data.color,
        data.size
    );
});

socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('correctGuess', (data) => {
    if (data.playerId === myId) {
        guessedCorrectly = true;
        showCorrectOverlay(`You guessed it! +${data.points} pts`);
        document.getElementById('chat-input').disabled = true;
        document.getElementById('chat-send-btn').disabled = true;

        // Mark player as guessed in sidebar
        const sidebar = document.getElementById('players-sidebar');
        sidebar.querySelectorAll('.sidebar-player').forEach(el => {
            const nameEl = el.querySelector('.sidebar-player-name');
            if (nameEl && nameEl.textContent === myName) {
                el.classList.add('guessed');
                const badge = document.createElement('div');
                badge.className = 'guessed-badge';
                badge.textContent = '✓';
                el.appendChild(badge);
            }
        });
    }
    addChatMsg('correct', `🎉 ${data.playerName} guessed the word! (+${data.points} pts)`);
});

socket.on('wordReveal', (word) => {
    showWordReveal(word);
    guessedCorrectly = false;
    document.getElementById('chat-input').disabled = false;
    document.getElementById('chat-send-btn').disabled = false;
    addChatMsg('system', `The word was: ${word}`);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isDrawer = false;
    currentWord = '';
});

socket.on('chatMessage', (data) => {
    addChatMsg('chat', { name: data.playerName, message: data.message });
});

// ── Init ──
buildPalette();
showPage('landing-page');

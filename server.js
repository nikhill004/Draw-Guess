const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Game state
const rooms = new Map();
const words = [
    'bird', 'chair', 'mountain', 'king', 'tree', 'house', 'car', 'dog', 'cat', 'fish',
    'sun', 'moon', 'star', 'flower', 'book', 'phone', 'computer', 'guitar', 'piano', 'drum',
    'apple', 'banana', 'pizza', 'cake', 'coffee', 'tea', 'bottle', 'glass', 'plate', 'spoon',
    'elephant', 'lion', 'tiger', 'bear', 'rabbit', 'horse', 'cow', 'sheep', 'chicken', 'duck',
    'airplane', 'train', 'boat', 'bicycle', 'motorcycle', 'bus', 'truck', 'helicopter', 'rocket', 'balloon',
    'castle', 'bridge', 'tower', 'church', 'school', 'hospital', 'store', 'restaurant', 'park', 'beach'
];

class GameRoom {
    constructor(roomId, hostId) {
        this.id = roomId;
        this.hostId = hostId;
        this.players = new Map();
        this.currentRound = 0;
        this.maxRounds = 3;
        this.currentDrawer = null;
        this.currentWord = '';
        this.wordOptions = [];
        this.gameState = 'waiting'; // waiting, choosing, drawing, finished
        this.timer = null;
        this.timeLeft = 60;
        this.guessedPlayers = new Set();
        this.drawingData = [];
    }

    addPlayer(playerId, playerName) {
        this.players.set(playerId, {
            id: playerId,
            name: playerName,
            score: 0,
            hasDrawn: false
        });
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.players.size === 0) {
            return true; // Room should be deleted
        }
        if (playerId === this.hostId && this.players.size > 0) {
            this.hostId = this.players.keys().next().value;
        }
        return false;
    }

    getNextDrawer() {
        const availablePlayers = Array.from(this.players.values())
            .filter(p => !p.hasDrawn);
        
        if (availablePlayers.length === 0) {
            // Reset for next round
            this.players.forEach(p => p.hasDrawn = false);
            this.currentRound++;
            if (this.currentRound >= this.maxRounds) {
                return null; // Game finished
            }
            return Array.from(this.players.values())[0];
        }
        
        return availablePlayers[0];
    }

    generateWordOptions() {
        const shuffled = [...words].sort(() => 0.5 - Math.random());
        this.wordOptions = shuffled.slice(0, 3);
        return this.wordOptions;
    }

    startDrawingPhase(word) {
        this.currentWord = word;
        this.gameState = 'drawing';
        this.timeLeft = 60;
        this.guessedPlayers.clear();
        this.drawingData = [];
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            
            // Emit timer update to all players
            io.to(this.id).emit('timerUpdate', this.timeLeft);
            
            // Reveal letters at 35, 30, 25, 20, 15 seconds
            const revealTimes = [35, 30, 25, 20, 15];
            if (revealTimes.includes(this.timeLeft)) {
                io.to(this.id).emit('letterReveal', this.getRevealedWord());
            }
            
            if (this.timeLeft <= 0) {
                this.endDrawingPhase();
            }
        }, 1000);
    }

    getRevealedWord() {
        const elapsed = 60 - this.timeLeft;
        let revealCount = 0;
        
        if (elapsed >= 25) revealCount = 1;
        if (elapsed >= 30) revealCount = 2;
        if (elapsed >= 35) revealCount = 3;
        if (elapsed >= 40) revealCount = 4;
        if (elapsed >= 45) revealCount = 5;
        
        let revealed = '';
        for (let i = 0; i < this.currentWord.length; i++) {
            if (i < revealCount) {
                revealed += this.currentWord[i];
            } else {
                revealed += '_';
            }
        }
        return revealed;
    }

    endDrawingPhase() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Reveal the word to everyone
        io.to(this.id).emit('wordReveal', this.currentWord);
        
        this.players.get(this.currentDrawer.id).hasDrawn = true;
        
        const nextDrawer = this.getNextDrawer();
        if (nextDrawer) {
            this.currentDrawer = nextDrawer;
            this.gameState = 'choosing';
        } else {
            this.gameState = 'finished';
        }
    }

    checkGuess(playerId, guess) {
        if (this.guessedPlayers.has(playerId) || playerId === this.currentDrawer.id) {
            return false;
        }
        
        if (guess.toLowerCase().trim() === this.currentWord.toLowerCase()) {
            this.guessedPlayers.add(playerId);
            
            // Award points based on order
            const points = [10, 8, 6, 4][this.guessedPlayers.size - 1] || 2;
            this.players.get(playerId).score += points;
            
            // If all players guessed, end the phase
            if (this.guessedPlayers.size === this.players.size - 1) {
                this.endDrawingPhase();
            }
            
            return true;
        }
        return false;
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (playerName) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = new GameRoom(roomId, socket.id);
        room.addPlayer(socket.id, playerName);
        rooms.set(roomId, room);
        
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, playerId: socket.id });
        socket.emit('gameState', {
            room: {
                id: room.id,
                players: Array.from(room.players.values()),
                gameState: room.gameState,
                currentRound: room.currentRound,
                maxRounds: room.maxRounds
            }
        });
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }
        
        if (room.players.size >= 7) {
            socket.emit('error', 'Room is full');
            return;
        }
        
        room.addPlayer(socket.id, playerName);
        socket.join(roomId);
        
        socket.emit('roomJoined', { roomId, playerId: socket.id });
        io.to(roomId).emit('gameState', {
            room: {
                id: room.id,
                players: Array.from(room.players.values()),
                gameState: room.gameState,
                currentRound: room.currentRound,
                maxRounds: room.maxRounds
            }
        });
    });

    socket.on('startGame', () => {
        const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
        if (!room || room.hostId !== socket.id || room.players.size < 2) {
            return;
        }
        
        room.currentDrawer = Array.from(room.players.values())[0];
        room.gameState = 'choosing';
        const wordOptions = room.generateWordOptions();
        
        io.to(room.id).emit('gameState', {
            room: {
                id: room.id,
                players: Array.from(room.players.values()),
                gameState: room.gameState,
                currentRound: room.currentRound,
                maxRounds: room.maxRounds,
                currentDrawer: room.currentDrawer
            }
        });
        
        socket.emit('wordOptions', wordOptions);
    });

    socket.on('selectWord', (word) => {
        const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
        if (!room || room.currentDrawer.id !== socket.id) {
            return;
        }
        
        room.startDrawingPhase(word);
        
        // Send different information to drawer vs other players
        const drawerInfo = {
            room: {
                id: room.id,
                players: Array.from(room.players.values()),
                gameState: room.gameState,
                currentRound: room.currentRound,
                maxRounds: room.maxRounds,
                currentDrawer: room.currentDrawer,
                timeLeft: room.timeLeft,
                selectedWord: room.currentWord // Only drawer sees the actual word
            }
        };
        
        const otherPlayersInfo = {
            room: {
                id: room.id,
                players: Array.from(room.players.values()),
                gameState: room.gameState,
                currentRound: room.currentRound,
                maxRounds: room.maxRounds,
                currentDrawer: room.currentDrawer,
                timeLeft: room.timeLeft,
                wordLength: room.currentWord.length,
                revealedWord: room.getRevealedWord()
            }
        };
        
        // Send to drawer
        socket.emit('gameState', drawerInfo);
        
        // Send to other players
        socket.to(room.id).emit('gameState', otherPlayersInfo);
    });

    socket.on('draw', (drawData) => {
        const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
        if (!room || room.currentDrawer.id !== socket.id) {
            return;
        }
        
        room.drawingData.push(drawData);
        socket.to(room.id).emit('draw', drawData);
    });

    socket.on('clearCanvas', () => {
        const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
        if (!room || room.currentDrawer.id !== socket.id) {
            return;
        }
        
        room.drawingData = [];
        socket.to(room.id).emit('clearCanvas');
    });

    socket.on('guess', (guess) => {
        const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
        if (!room || room.gameState !== 'drawing') {
            return;
        }
        
        const isCorrect = room.checkGuess(socket.id, guess);
        const player = room.players.get(socket.id);
        
        if (isCorrect) {
            io.to(room.id).emit('correctGuess', {
                playerId: socket.id,
                playerName: player.name,
                points: [10, 8, 6, 4][room.guessedPlayers.size - 1] || 2,
                word: room.currentWord
            });
            
            io.to(room.id).emit('gameState', {
                room: {
                    id: room.id,
                    players: Array.from(room.players.values()),
                    gameState: room.gameState,
                    currentRound: room.currentRound,
                    maxRounds: room.maxRounds,
                    currentDrawer: room.currentDrawer,
                    timeLeft: room.timeLeft,
                    wordLength: room.currentWord.length,
                    revealedWord: room.getRevealedWord()
                }
            });
        } else {
            // Only show chat message to other players, not the correct answer
            socket.to(room.id).emit('chatMessage', {
                playerId: socket.id,
                playerName: player.name,
                message: guess
            });
            
            // Send back to sender as well (but not if it's the drawer)
            if (socket.id !== room.currentDrawer.id) {
                socket.emit('chatMessage', {
                    playerId: socket.id,
                    playerName: player.name,
                    message: guess
                });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.has(socket.id)) {
                const shouldDelete = room.removePlayer(socket.id);
                
                if (shouldDelete) {
                    rooms.delete(roomId);
                } else {
                    io.to(roomId).emit('gameState', {
                        room: {
                            id: room.id,
                            players: Array.from(room.players.values()),
                            gameState: room.gameState,
                            currentRound: room.currentRound,
                            maxRounds: room.maxRounds,
                            currentDrawer: room.currentDrawer
                        }
                    });
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
# Scribble Game

A real-time multiplayer drawing and guessing game built with Node.js, Socket.IO, and HTML5 Canvas.

## Features

- **Multiplayer Support**: 2-7 players per room
- **Room System**: Create or join rooms with unique codes
- **Real-time Drawing**: HTML5 Canvas with real-time synchronization
- **Word Guessing**: Choose from 3 random words and draw for others to guess
- **Scoring System**: Points awarded based on guess order (10, 8, 6, 4, 2)
- **Letter Reveals**: Progressive letter hints after 25 seconds
- **3 Rounds**: Each player gets to draw once per round
- **Responsive Design**: Works on desktop and mobile devices

## Game Rules

1. **Room Creation**: One player creates a room and shares the code with friends
2. **Word Selection**: The drawer chooses from 3 random words
3. **Drawing Phase**: 60 seconds to draw while others guess
4. **Guessing**: Players type guesses in chat
5. **Scoring**: First correct guess gets 10 points, then 8, 6, 4, 2
6. **Letter Hints**: Letters are revealed progressively after 25 seconds
7. **Rounds**: 3 rounds total, each player draws once per round

## Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and go to `http://localhost:3000`

## Development

For development with auto-restart:
```bash
npm run dev
```

## How to Play

1. Enter your name on the welcome screen
2. **Create Room**: Click "Create Room" to start a new game and share the room code
3. **Join Room**: Click "Join Room" and enter a friend's room code
4. **Start Game**: Room creator clicks "Start Game" when ready (minimum 2 players)
5. **Draw**: When it's your turn, choose a word and draw it
6. **Guess**: When others are drawing, type your guesses in the chat
7. **Score**: Earn points for correct guesses and see final results

## Technical Details

- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: Vanilla JavaScript with HTML5 Canvas
- **Real-time Communication**: WebSocket connections via Socket.IO
- **Responsive Design**: CSS Grid and Flexbox for mobile compatibility

## Word List

The game includes 60 pre-defined words across various categories:
- Animals (bird, cat, dog, elephant, etc.)
- Objects (chair, phone, guitar, etc.)
- Nature (tree, mountain, sun, etc.)
- Food (apple, pizza, cake, etc.)
- Vehicles (car, airplane, boat, etc.)
- Buildings (house, castle, bridge, etc.)

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers with touch support

## Port Configuration

Default port is 3000. To use a different port, set the PORT environment variable:
```bash
PORT=8080 npm start
```
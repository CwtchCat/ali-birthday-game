import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const games = new Map();
const players = new Map();

const QUESTIONS = [
  "If Ali could have one animal follow her around for a week, what would it be and why?",
  "What are three types of happy skiing? (Bluebird powder, Backcountry adventure, Downhill tricks)",
  "Where would Ali most love to take her bike for a long, peaceful ride?",
  "If Ali were sitting by the ocean right now, what would she be doing?",
  "What is Ali most likely knitting while watching or listening to something cozy?",
  "What bread or dough creation makes Ali feel the most proud when it turns out just right?",
  "What is the official catchphrase of 'ALI 27'?",
  "What kind of scene does Ali most love to paint with watercolors?",
  "Surfed it. Climbed it. Biked it. Hiked it. What's Ali's next Adventure Badge?",
  "What does Ali like most about The Alchemist?",
  "If Ali could leave tomorrow for one place—no planning stress—where would she go?",
  "What small, ordinary thing brings Ali joy that other people might overlook?"
];

const TIEBREAKER = "How many books do you think Ali would ideally like to read in a perfect year?";

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
  socket.on('createGame', (callback) => {
    const code = generateCode();
    const game = { id: socket.id, code, hostId: socket.id, status: 'waiting', currentRound: 0, players: [], responses: {}, scores: {} };
    games.set(code, game);
    socket.join(code);
    callback({ success: true, code, game });
  });

  socket.on('joinGame', ({ code, name }, callback) => {
    const game = games.get(code);
    if (!game) return callback({ success: false, error: 'Game not found' });
    if (game.status !== 'waiting') return callback({ success: false, error: 'Game already started' });
    const player = { id: socket.id, name, score: 0 };
    game.players.push(player);
    game.scores[socket.id] = 0;
    players.set(socket.id, { code, name });
    socket.join(code);
    io.to(code).emit('playerJoined', { players: game.players });
    callback({ success: true, player, game });
  });

  socket.on('startGame', ({ code }) => {
    const game = games.get(code);
    if (game && game.hostId === socket.id) {
      game.status = 'playing';
      game.currentRound = 1;
      game.responses[1] = {};
      io.to(code).emit('gameStarted', { round: 1, question: QUESTIONS[0], totalRounds: 12 });
    }
  });

  socket.on('submitAnswer', ({ code, answer }) => {
    const game = games.get(code);
    if (game && game.status === 'playing') {
      if (!game.responses[game.currentRound]) game.responses[game.currentRound] = {};
      game.responses[game.currentRound][socket.id] = { playerId: socket.id, playerName: players.get(socket.id)?.name, text: answer, score: null };
      socket.emit('answerSubmitted');
      io.to(game.hostId).emit('newAnswer', { round: game.currentRound, responses: Object.values(game.responses[game.currentRound]) });
    }
  });

  socket.on('scoreAnswer', ({ code, playerId, score, isFunniest }) => {
    const game = games.get(code);
    if (game && game.hostId === socket.id) {
      const response = game.responses[game.currentRound][playerId];
      if (response) {
        let finalScore = score;
        if (isFunniest) finalScore += 25;
        response.score = finalScore;
        game.scores[playerId] = (game.scores[playerId] || 0) + finalScore;
        const allScored = Object.values(game.responses[game.currentRound]).every(r => r.score !== null);
        io.to(game.hostId).emit('scoreUpdated', { responses: Object.values(game.responses[game.currentRound]), allScored });
      }
    }
  });

  socket.on('showScoreboard', ({ code }) => {
    const game = games.get(code);
    if (game && game.hostId === socket.id) {
      const scoreboard = game.players.map(p => ({ name: p.name, score: game.scores[p.id] || 0 })).sort((a, b) => b.score - a.score);
      io.to(code).emit('scoreboard', { scoreboard, round: game.currentRound, totalRounds: 12 });
    }
  });

  socket.on('nextRound', ({ code }) => {
    const game = games.get(code);
    if (game && game.hostId === socket.id) {
      game.currentRound++;
      if (game.currentRound <= 12) {
        game.responses[game.currentRound] = {};
        io.to(code).emit('gameStarted', { round: game.currentRound, question: QUESTIONS[game.currentRound - 1], totalRounds: 12 });
      } else {
        game.status = 'tiebreaker';
        game.responses.tiebreaker = {};
        io.to(code).emit('tiebreaker', { question: TIEBREAKER });
      }
    }
  });

  socket.on('submitTiebreaker', ({ code, answer }) => {
    const game = games.get(code);
    if (game && game.status === 'tiebreaker') {
      game.responses.tiebreaker[socket.id] = { playerId: socket.id, playerName: players.get(socket.id)?.name, text: answer };
      socket.emit('answerSubmitted');
      io.to(game.hostId).emit('tiebreakerAnswers', { responses: Object.values(game.responses.tiebreaker) });
    }
  });

  socket.on('selectWinner', ({ code, playerId }) => {
    const game = games.get(code);
    if (game && game.hostId === socket.id) {
      game.scores[playerId] = (game.scores[playerId] || 0) + 200;
      game.status = 'finished';
      const finalScores = game.players.map(p => ({ name: p.name, score: game.scores[p.id] || 0 })).sort((a, b) => b.score - a.score);
      io.to(code).emit('gameFinished', { finalScores });
    }
  });
});

app.use(express.static(__dirname));
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

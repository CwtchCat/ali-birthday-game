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

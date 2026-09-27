// Compose and synthesise a film's score (audio/synth.ts + the film's arrangement in audio/scores/).
//   node audio/generate-score.ts                 → public/showcase/score.wav
//   node audio/generate-score.ts --film agentic  → public/agentic/score.wav
import { FILMS, filmFromArgv } from './films.ts';
import { createScore } from './synth.ts';

const film = FILMS[filmFromArgv()];
const score = createScore(film.duration);
film.arrange(score);
score.write(film.scorePath);

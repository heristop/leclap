// The narration script, English and French side by side. Every cut is narrated in English
// (src/film/narration.ts): `text.en` is what the neural voice (Kokoro) reads — it says "LeClap", "FFmpeg"
// and "JSON" correctly as written — and `text.fr` is the line's French subtitle, written as French rather
// than translated word for word. `say` overrides the English line for the macOS `say` fallback, spelled for
// its ear ("Le Clap", "eff eff em peg"). The voices honour `[[slnc N]]` pauses (N ms). `speed` is a line's
// Kokoro reading speed, for a line that has to read faster to fit its slot.
// `caption` is how an English line reads on screen (the website's WebVTT captions) where `text` is spelled
// for the voice: proper spellings (leclap.dev…), same words. A line without one is captioned from its
// `text`, `[[slnc N]]` pauses dropped.
// `start` is the second the line begins on the showcase clock (timeline.ts). audio/generate-voice.ts renders
// each line, measures it, and writes the durations to voice-manifest.json, which the composition uses to
// duck the score and the captions are timed by — in both cuts.
import type { Bilingual, Lang } from '../film/lang.tsx';

export interface VoiceLine {
  id: string;
  start: number;
  text: Bilingual;
  caption?: Partial<Record<Lang, string>>;
  say?: string;
  speed?: Partial<Record<Lang, number>>;
}

export const VOICE_LINES: readonly VoiceLine[] = [
  { id: 'vo-01', start: 0.9, text: { en: 'Every video starts as an idea.', fr: 'Toute vidéo commence par une idée.' } },
  {
    id: 'vo-02',
    start: 3.1,
    text: {
      en: 'What if that idea [[slnc 250]] was a template?',
      fr: 'Et si cette idée devenait un modèle ?',
    },
  },
  {
    id: 'vo-03',
    start: 6.8,
    text: {
      en: 'LeClap. [[slnc 350]] One template. Every screen.',
      fr: 'LeClap. Un seul modèle. Tous les écrans.',
    },
    say: 'Le Clap. [[slnc 350]] One template. Every screen.',
  },
  {
    id: 'vo-04',
    start: 10.5,
    text: {
      en: "Describe your video once, as a JSON template. LeClap's FFmpeg engine composes it into a finished film.",
      fr: 'Décrivez votre vidéo une seule fois, dans un modèle JSON. Le moteur FFmpeg de LeClap en fait un vrai film.',
    },
    say: "Describe your video once, as a JSON template. Le Clap's eff eff em peg engine composes it into a finished film.",
  },
  {
    id: 'vo-05',
    start: 18.3,
    text: {
      en: 'The same template renders in Node, in your browser, and right on your phone.',
      fr: 'Le même modèle tourne sous Node, dans votre navigateur, et jusque sur votre téléphone.',
    },
  },
  {
    id: 'vo-06',
    start: 24.3,
    text: {
      en: 'On desktop: pick a template. [[slnc 350]] Drop in your footage. [[slnc 350]] Trim the best take. [[slnc 350]] Build your scenes, right in the browser.',
      fr: 'Sur ordinateur : choisissez un modèle. Déposez vos vidéos. Gardez la meilleure prise. Montez vos scènes dans le navigateur.',
    },
  },
  { id: 'vo-07', start: 32.5, text: { en: "But here's the magic.", fr: 'Et maintenant, place à la magie.' } },
  {
    id: 'vo-08',
    start: 34.7,
    text: {
      en: 'Pick a template. [[slnc 200]] Shoot your clip.',
      fr: 'Choisissez un modèle. Filmez votre prise.',
    },
  },
  {
    id: 'vo-09',
    start: 37.4,
    text: { en: 'And the phone renders the video itself.', fr: 'Et c’est le téléphone qui monte la vidéo.' },
  },
  {
    id: 'vo-10',
    start: 42.3,
    text: {
      en: 'No server. [[slnc 150]] No upload. [[slnc 150]] It all stays on the device.',
      fr: 'Pas de serveur. Pas d’envoi. Tout reste sur votre téléphone.',
    },
  },
  {
    id: 'vo-11',
    start: 48.2,
    text: {
      en: 'Social stories. [[slnc 120]] Brand intros. [[slnc 120]] Product demos. [[slnc 120]] Personalised videos.',
      fr: 'Réseaux sociaux. Intros de marque. Démos produit. Vidéos personnalisées.',
    },
  },
  {
    id: 'vo-12',
    start: 54.4,
    text: {
      en: 'And for agentic development: your coding agent records the change, and LeClap renders the proof.',
      fr: 'En développement agentique, votre agent filme sa modification, et LeClap en apporte la preuve.',
    },
    say: 'And for agentic development: your coding agent records the change, and Le Clap renders the proof.',
  },
  {
    id: 'vo-12b',
    start: 60.0,
    text: {
      en: 'Before: [[slnc 150]] a faint link, and no feedback.',
      fr: 'Avant : un lien à peine visible, et rien ne se passe.',
    },
  },
  {
    id: 'vo-12c',
    start: 63.8,
    text: {
      en: 'After: [[slnc 150]] one button, and the cart opens.',
      fr: 'Après : un vrai bouton, et le panier s’ouvre.',
    },
  },
  {
    id: 'vo-13',
    start: 67.2,
    text: {
      en: "Don't describe the change. [[slnc 200]] Show it!",
      fr: 'Ne décrivez pas le changement. Montrez-le.',
    },
    // Read with a bang: two words alone after the pause, Kokoro lets "Show it." rise like a question.
    caption: { en: "Don't describe the change. Show it." },
  },
  {
    id: 'vo-14',
    start: 70.8,
    text: {
      en: 'LeClap. [[slnc 300]] One template. Every screen.',
      fr: 'LeClap. Un seul modèle. Tous les écrans.',
    },
    say: 'Le Clap. [[slnc 300]] One template. Every screen.',
  },
  {
    id: 'vo-15',
    start: 74.6,
    text: { en: 'Open source, at LeClap dot dev.', fr: 'En open source, sur leclap.dev.' },
    caption: { en: 'Open source, at leclap.dev.' },
    say: 'Open source, at Le Clap dot dev.',
  },
];

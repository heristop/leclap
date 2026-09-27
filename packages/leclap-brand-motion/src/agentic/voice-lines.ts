// The agentic film's narration, English and French side by side (same narrators and format as the showcase
// — see src/showcase/voice-lines.ts). Wording follows docs/launch/agentic-development-use-case.md and
// leclap.dev (#agentic): don't describe the change, show it; composition, not generation;
// LeClap renders the artifact and the surrounding workflow attaches it. Narrated in English in both cuts;
// `text.fr` is the French subtitle, written as French rather than translated word for word: "relecteur",
// "Du montage, pas de la génération.".
import type { VoiceLine } from '../showcase/voice-lines';

export const VOICE_LINES: readonly VoiceLine[] = [
  {
    id: 'ag-01',
    start: 0.8,
    text: { en: 'Your agent shipped the change.', fr: 'Votre agent a livré sa modification.' },
  },
  {
    id: 'ag-02',
    start: 2.9,
    text: { en: 'The reviewer still has to imagine it.', fr: 'Mais le relecteur doit encore l’imaginer.' },
  },
  {
    id: 'ag-03',
    start: 6.6,
    text: {
      en: "Don't describe the change. [[slnc 200]] Show it!",
      fr: 'Ne décrivez pas le changement. Montrez-le.',
    },
    // Read with a bang: two words alone after the pause, Kokoro lets "Show it." rise like a question.
    caption: { en: "Don't describe the change. Show it." },
  },
  {
    id: 'ag-04',
    start: 10.4,
    text: { en: 'The agent implements the change,', fr: 'L’agent code la modification,' },
  },
  {
    id: 'ag-05',
    start: 14.4,
    text: {
      en: 'collects real evidence: [[slnc 120]] the behavior before, [[slnc 120]] and after,',
      fr: 'réunit de vraies preuves : le comportement avant, et après,',
    },
  },
  {
    id: 'ag-06',
    start: 20.4,
    text: {
      en: 'then LeClap validates the template, and composes the video. [[slnc 250]] Composition, not generation.',
      fr: 'puis LeClap vérifie le modèle, et monte la vidéo. Du montage, pas de la génération.',
    },
    say: 'then Le Clap validates the template, and composes the video. [[slnc 250]] Composition, not generation.',
  },
  {
    id: 'ag-07',
    start: 28.4,
    text: { en: 'Your workflow attaches it to the pull request.', fr: 'Votre workflow l’ajoute à la pull request.' },
  },
  {
    id: 'ag-08',
    start: 33.0,
    text: {
      en: 'Before: [[slnc 150]] a faint link, and no feedback.',
      fr: 'Avant : un lien à peine visible, et rien ne se passe.',
    },
  },
  {
    id: 'ag-09',
    start: 36.7,
    text: {
      en: 'After: [[slnc 150]] one button, and the cart opens.',
      fr: 'Après : un vrai bouton, et le panier s’ouvre.',
    },
  },
  { id: 'ag-10', start: 40.1, text: { en: 'And one clear thing to review.', fr: 'Et un point précis à vérifier.' } },
  {
    id: 'ag-11',
    start: 43.5,
    text: {
      en: 'Lights, [[slnc 150]] camera, [[slnc 250]] merge.',
      fr: 'Silence, on merge.',
    },
    caption: { en: 'Lights, camera, merge.' },
  },
  { id: 'ag-12', start: 47.0, text: { en: 'LeClap.', fr: 'LeClap.' }, say: 'Le Clap.' },
];

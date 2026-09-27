// Everything the agentic film puts on screen, English and French side by side — edit both languages here.
// `satisfies CopyTree` makes a missing translation a type error. The narration lives in voice-lines.ts.
//
// Code and product artifacts stay in English and in the scenes: the agent's logs, the diff, file and branch
// names, URLs, the template JSON's keys, and the pull request's title and body (what the agent wrote). The
// template's values are the evidence's content, so they follow the language (EVIDENCE_COPY below).
//
// French runs ~20% longer. Where a line would overflow or crowd Clappy, the entry has a per-language
// `…Size` (English keeps its original size). `…Gradient` lists the words KineticWords sets in the brand
// gradient, per language.
import type { CopyTree } from '../film/lang.tsx';

export const COPY = {
  squint: { en: 'REVIEWER SQUINT', fr: 'PLISSOMÈTRE' },
  // The pull request's chrome, around its (English) title and body.
  pr: {
    tabs: [
      { en: 'Conversation', fr: 'Conversation' },
      { en: 'Commits', fr: 'Commits' },
      { en: 'Files changed', fr: 'Fichiers modifiés' },
    ],
    draft: { en: 'DRAFT', fr: 'BROUILLON' },
    ready: { en: 'READY FOR REVIEW', fr: 'PRÊTE POUR RELECTURE' },
    pending: { en: 'EVIDENCE VIDEO · PENDING', fr: 'VIDÉO DE PREUVE · EN ATTENTE' },
    attachment: {
      en: '▶ pr-evidence.mp4 · 10.8 s · rendered by LeClap',
      fr: '▶ pr-evidence.mp4 · 10,8 s · rendu par LeClap',
    },
    player: {
      en: '▶ pr-evidence.mp4 — attached to #482 · rendered by LeClap from before-after.json',
      fr: '▶ pr-evidence.mp4 — joint à la #482 · rendu par LeClap depuis before-after.json',
    },
  },
  // Each phrase is set on two lines.
  hook: {
    agent1: { en: 'Your agent', fr: 'Votre agent a livré' },
    agent2: { en: 'shipped the change.', fr: 'sa modification.' },
    reviewer1: { en: 'The reviewer still', fr: 'Le relecteur doit' },
    reviewer2: { en: 'has to imagine it.', fr: 'encore l’imaginer.' },
  },
  title: {
    kicker: { en: 'LECLAP · AGENTIC DEVELOPMENT', fr: 'LECLAP · DÉVELOPPEMENT AGENTIQUE' },
    dontDescribe: { en: 'Don’t describe the change.', fr: 'Ne décrivez pas le changement.' },
    /** At 120 the French line runs nearly edge to edge. */
    dontDescribeSize: { en: 120, fr: 110 },
    showIt: { en: 'Show it.', fr: 'Montrez-le.' },
    showItGradient: { en: ['Show', 'it.'], fr: ['Montrez-le.'] },
    /** "MONTREZ-LE." at 250 reaches for Clappy's corner. */
    showItSize: { en: 250, fr: 220 },
  },
  loop: {
    steps: {
      implement: { en: 'Implement', fr: 'Coder' },
      collect: { en: 'Collect evidence', fr: 'Réunir les preuves' },
      render: { en: 'Render', fr: 'Monter' },
      attach: { en: 'Attach', fr: 'Joindre' },
    },
    // Each step's one-line promise (the attach step's narrow column breaks after each sentence).
    captions: {
      implement: {
        en: 'The agent changes the product, with the review goal explicit.',
        fr: 'L’agent modifie le produit et dit clairement quoi vérifier.',
      },
      collect: {
        en: 'Real screen recordings, before and after, plus one review focus.',
        fr: 'De vrais enregistrements d’écran, avant et après, et le point à vérifier.',
      },
      render: {
        en: 'Validated, then composed. Composition, not generation.',
        fr: 'Vérifié, puis monté. Du montage, pas de la génération.',
      },
      attach: {
        en: 'LeClap renders the artifact. Your workflow attaches it.',
        fr: 'LeClap produit la vidéo. Votre workflow la joint.',
      },
    },
    before: { en: 'Before', fr: 'Avant' },
    after: { en: 'After', fr: 'Après' },
    /** The collect step's review-focus note: the French value outgrows the 720px box at 23. */
    focusSize: { en: 23, fr: 21 },
    valid: { en: '✓ VALID · 4 SECTIONS', fr: '✓ VALIDE · 4 SECTIONS' },
    waiting: { en: 'WAITING FOR THE TEMPLATE', fr: 'EN ATTENTE DU MODÈLE' },
    idle: { en: 'IDLE', fr: 'EN VEILLE' },
    composing: { en: 'COMPOSING', fr: 'MONTAGE' },
    composed: { en: 'COMPOSED', fr: 'MONTÉ' },
    // The render's section timeline — the evidence's own badges.
    sections: {
      intro: { en: 'INTRO', fr: 'INTRO' },
      before: { en: 'BEFORE', fr: 'AVANT' },
      after: { en: 'AFTER', fr: 'APRÈS' },
      review: { en: 'REVIEW', fr: 'À VÉRIFIER' },
    },
  },
  outro: {
    // "Lights, camera, merge." — the set call, with the merge as the take. French borrows its own set
    // call, "Silence, on tourne", and merges instead.
    line1: { en: 'Lights, camera,', fr: 'Silence,' },
    line1Gradient: { en: [], fr: [] },
    line2: { en: 'merge.', fr: 'on merge.' },
    line2Gradient: { en: ['merge.'], fr: ['merge.'] },
    size: { en: 150, fr: 150 },
    proofs: [
      { en: 'Real evidence, not generated footage', fr: 'De vraies preuves, pas des images générées' },
      { en: 'Validated before it renders', fr: 'Validé avant le rendu' },
      { en: 'LeClap renders · your workflow attaches', fr: 'LeClap monte · votre workflow joint' },
    ],
    tagline: { en: 'Don’t describe the change. Show it.', fr: 'Ne décrivez pas le changement. Montrez-le.' },
  },
} satisfies CopyTree;

/**
 * The evidence video: public/captures/pr-evidence.mp4 and pr-evidence.fr.mp4, rendered by
 * media/render-pr-evidence.ts [--lang fr] from examples/agentic-pr-video/before-after.json. `fields` fill
 * the template — the render step shows them being typed, the collect step the review focus. `template`
 * translates the template's own strings, matched on their English: the template ships English only, so
 * the French render adds these to its staged copy (same sections, so the same timing).
 */
export const EVIDENCE_COPY = {
  fields: {
    project: { en: 'Kiln & Co. — shop', fr: 'Kiln & Co. — boutique' },
    change: { en: 'Make Add to cart obvious', fr: 'Clarifier l’ajout au panier' },
    beforeCaption: { en: 'A faint link, and no feedback', fr: 'Un lien à peine visible, rien ne se passe' },
    afterCaption: { en: 'One button, instant cart drawer', fr: 'Un vrai bouton, le panier s’ouvre' },
    reviewFocus: { en: 'Button contrast and drawer focus', fr: 'Contraste du bouton et focus du tiroir' },
  },
  template: [
    { en: 'Before / after — recorded for review', fr: 'Avant / après — enregistré pour la relecture' },
    { en: 'BEFORE', fr: 'AVANT' },
    { en: 'Before the change', fr: 'Avant le changement' },
    { en: 'A recording of the behavior the change fixes', fr: 'Un enregistrement du comportement corrigé' },
    { en: 'AFTER', fr: 'APRÈS' },
    { en: 'After the change', fr: 'Après le changement' },
    { en: 'The same walkthrough on the branch under review', fr: 'Le même parcours, sur la branche à relire' },
    { en: 'WHAT TO REVIEW', fr: 'À VÉRIFIER' },
    { en: 'Watch the behavior, then read the diff', fr: 'Regardez le comportement, puis lisez le diff' },
  ],
} satisfies CopyTree;

/**
 * Picture cued off the narration, per language (frames, local to the scene). Measured on the generated
 * line with ffmpeg's silencedetect — `ffmpeg -i public/agentic/voice[-fr]/ag-03.wav -af
 * silencedetect=noise=-38dB:d=0.12 -f null -` — where the word's onset is the `silence_end` after the
 * [[slnc 200]]:
 *
 * - `showIt`: ag-03 (6.6 s, 0.6 s into the title scene) — "Show it." at 1.617 s. The type leads the word a
 *   touch: floor((0.6 + onset) × 30) − 4.
 * - `outroLine1` / `outroLine1Stagger` / `outroLine2`: ag-11 (43.5 s, 0.5 s into the outro; silencedetect
 *   d=0.08) — "Lights," on the line's start, "camera," at 0.951 s, "merge." at 1.958 s. Each word pops on
 *   its onset: floor((0.5 + onset) × 30). The French cut hears the same read (src/film/narration.ts):
 *   "Silence," pops on the line's start and "on merge." three frames ahead, so "merge." lands on the
 *   spoken "merge".
 *
 * Re-measure after changing the line's wording or speed.
 */
export const TIMING = {
  showIt: { en: 62, fr: 62 },
  outroLine1: { en: 15, fr: 15 },
  outroLine1Stagger: { en: 28, fr: 3 },
  outroLine2: { en: 73, fr: 70 },
} satisfies CopyTree;

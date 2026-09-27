// Everything the showcase puts on screen, English and French side by side — edit both languages here.
// `satisfies CopyTree` makes a missing translation a type error. The narration lives in voice-lines.ts.
//
// Code and product artifacts stay in English and in the scenes: the template JSON, terminal and agent
// logs, file names, URLs, CLI lines, the pull request's title and body, the rebuilt app camera screen and
// the Present Yourself title cards (both mirror real English UI).
//
// French runs ~20% longer. Where a line would overflow or crowd Clappy, the entry has a per-language
// `…Size` (English keeps its original size). French punctuation takes a no-break space ( ) before
// ? ! : ;  `…Gradient` lists the words KineticWords sets in the brand gradient, per language.
import type { CopyTree } from '../film/lang.tsx';

export const COPY = {
  curtain: {
    idea: { en: 'Every video starts as an idea.', fr: 'Toute vidéo commence par une idée.' },
    whatIf: { en: 'What if that idea', fr: 'Et si cette idée' },
    wasATemplate: { en: 'was a template?', fr: 'devenait un modèle ?' },
  },
  /** Under the wordmark, in the title and the finale. */
  tagline: { en: 'One template. Every screen.', fr: 'Un seul modèle. Tous les écrans.' },
  template: {
    in: { en: 'A JSON template in.', fr: 'Un modèle JSON en entrée.' },
    out: { en: 'A finished video out.', fr: 'Une vidéo finie en sortie.' },
    outGradient: { en: ['video', 'out.'], fr: ['vidéo', 'finie'] },
    chips: [
      { en: 'Zod-validated', fr: 'Validé par Zod' },
      { en: 'FFmpeg-composed', fr: 'Composé par FFmpeg' },
      { en: 'Reproducible', fr: 'Reproductible' },
    ],
    waiting: { en: 'WAITING FOR TEMPLATE', fr: 'EN ATTENTE DU MODÈLE' },
    program: { en: 'PROGRAM', fr: 'PROGRAMME' },
  },
  everywhere: {
    headline: { en: 'One template. Everywhere.', fr: 'Un modèle. Partout.' },
    headlineGradient: { en: ['Everywhere.'], fr: ['Partout.'] },
    // `code` is the yellow line at the foot of each card (the CLI line stays as typed).
    node: {
      title: { en: 'Node.js · CLI', fr: 'Node.js · CLI' },
      sub: { en: 'Render from a script or a terminal', fr: 'Rendu depuis un script ou un terminal' },
      code: { en: 'npx @leclap/cli render', fr: 'npx @leclap/cli render' },
    },
    browser: {
      title: { en: 'Browser', fr: 'Navigateur' },
      sub: { en: 'FFmpeg compiled to WebAssembly', fr: 'FFmpeg compilé en WebAssembly' },
      code: { en: 'in-browser, no install', fr: 'dans le navigateur, sans installation' },
    },
    phone: {
      title: { en: 'iOS · Android', fr: 'iOS · Android' },
      sub: { en: 'Native engine linked into the app', fr: 'Moteur natif intégré à l’app' },
      code: { en: 'on-device, offline', fr: 'sur l’appareil, hors ligne' },
    },
  },
  desktop: {
    kicker: { en: 'ON DESKTOP', fr: 'SUR ORDINATEUR' },
    builtIn: { en: 'Built in', fr: 'Monté dans' },
    theBrowser: { en: 'the browser.', fr: 'le navigateur.' },
    theBrowserGradient: { en: ['browser.'], fr: ['navigateur.'] },
    /** "NAVIGATEUR." alone is wider than the 560px column at 120. */
    headlineSize: { en: 92, fr: 80 },
    // The rail's steps, each spoken in vo-06 (their start frames are in TIMING below).
    steps: {
      pick: { en: 'Pick a template', fr: 'Choisissez un modèle' },
      drop: { en: 'Drop in your footage', fr: 'Déposez vos vidéos' },
      trim: { en: 'Trim the best take', fr: 'Gardez la meilleure prise' },
      build: { en: 'Build your scenes', fr: 'Montez vos scènes' },
    },
    /** The longest French step would run into the browser window at 40. */
    stepSize: { en: 40, fr: 36 },
  },
  mobile: {
    butHeres: { en: "But here's", fr: 'Place à' },
    theMagic: { en: 'the magic.', fr: 'la magie.' },
    // The numbered steps beside the phone, one entry per line.
    steps: {
      pick: { en: ['Pick a', 'template'], fr: ['Choisissez', 'un modèle'] },
      shoot: { en: ['Shoot your', 'clip'], fr: ['Filmez', 'votre prise'] },
      render: { en: ['Render it', 'on the phone'], fr: ['Lancez le rendu', 'sur le téléphone'] },
    },
    renderingOnDevice: { en: 'RENDERING ON DEVICE', fr: 'RENDU SUR L’APPAREIL' },
    noNetwork: { en: 'NO NETWORK · NO SERVER', fr: 'SANS RÉSEAU · SANS SERVEUR' },
    rendered: { en: 'Rendered', fr: 'Monté' },
    onYourPhone: { en: 'on your phone.', fr: 'sur votre téléphone.' },
    onYourPhoneGradient: { en: ['phone.'], fr: ['téléphone.'] },
    /** "TÉLÉPHONE." alone is wider than the 560px column at 120. */
    renderedSize: { en: 120, fr: 108 },
    proofs: {
      server: { en: 'No server', fr: 'Pas de serveur' },
      upload: { en: 'No upload', fr: 'Pas d’envoi' },
      device: { en: 'Stays on the device', fr: 'Tout reste sur le téléphone' },
    },
    /** The outline marquee behind the phone (set twice). */
    poster: { en: 'ON-DEVICE', fr: 'SUR L’APPAREIL' },
    /** The first phrase must sit whole in the frame; the French one is half again as long. */
    posterSize: { en: 300, fr: 220 },
  },
  useCases: {
    label: { en: 'USE CASE', fr: 'CAS D’USAGE' },
    // `title` is one entry per line, the last one in the gradient.
    social: {
      title: { en: ['Social', 'stories'], fr: ['Réseaux', 'sociaux'] },
      sub: { en: 'Vertical, captioned, graded', fr: 'Stories verticales, sous-titrées, étalonnées' },
    },
    brand: {
      title: { en: ['Brand', 'intros'], fr: ['Intros', 'de marque'] },
      sub: { en: 'Your logo, animated, on every video', fr: 'Votre logo, animé, sur chaque vidéo' },
    },
    demos: {
      title: { en: ['Product', 'demos'], fr: ['Démos', 'produit'] },
      sub: { en: 'Screen captures, framed and titled', fr: 'Captures d’écran, cadrées et titrées' },
    },
    personalised: {
      title: { en: ['Personalised', 'videos'], fr: ['Vidéos', 'personnalisées'] },
      sub: { en: 'One template, a name per render', fr: 'Un modèle, un prénom par vidéo' },
    },
    /** "PERSONNALISÉES" at 150 runs into the deck of title cards. */
    personalisedSize: { en: 150, fr: 124 },
    /** "DE MARQUE" at 150 runs into the brand intro's frame. */
    brandSize: { en: 150, fr: 128 },
    brandCaption: { en: 'kiln-brand-intro.json · rendered by LeClap', fr: 'kiln-brand-intro.json · rendu par LeClap' },
    demoCaption: { en: 'kiln-product-demo.json · rendered by LeClap', fr: 'kiln-product-demo.json · rendu par LeClap' },
  },
  agentic: {
    kicker: { en: 'AGENTIC DEVELOPMENT', fr: 'DÉVELOPPEMENT AGENTIQUE' },
    pipeline: [
      { en: 'Implement', fr: 'Coder' },
      { en: 'Record', fr: 'Enregistrer' },
      { en: 'Validate', fr: 'Valider' },
      { en: 'Render', fr: 'Monter' },
      { en: 'Attach', fr: 'Joindre' },
    ],
    // The pull request's chrome (its title and body stay English, as the agent wrote them).
    tabs: [
      { en: 'Conversation', fr: 'Conversation' },
      { en: 'Commits', fr: 'Commits' },
      { en: 'Files changed', fr: 'Fichiers modifiés' },
    ],
    draft: { en: 'DRAFT', fr: 'BROUILLON' },
    ready: { en: 'READY FOR REVIEW', fr: 'PRÊTE POUR RELECTURE' },
    pending: { en: 'EVIDENCE VIDEO · PENDING', fr: 'VIDÉO DE PREUVE · EN ATTENTE' },
    attachment: { en: '▶ pr-evidence.mp4 · rendered by LeClap', fr: '▶ pr-evidence.mp4 · rendu par LeClap' },
    player: {
      en: '▶ pr-evidence.mp4 — attached to #482 · rendered by LeClap from before-after.json',
      fr: '▶ pr-evidence.mp4 — joint à la #482 · rendu par LeClap depuis before-after.json',
    },
    squint: { en: 'REVIEWER SQUINT', fr: 'PLISSOMÈTRE' },
    dontDescribe: { en: 'Don’t describe the change.', fr: 'Ne décrivez pas le changement.' },
    showIt: { en: 'Show it.', fr: 'Montrez-le.' },
    showItGradient: { en: ['Show', 'it.'], fr: ['Montrez-le.'] },
    /** "MONTREZ-LE." at 230 reaches for Clappy's corner. */
    showItSize: { en: 230, fr: 200 },
    claim: {
      en: 'LeClap renders the artifact. Your workflow attaches it.',
      fr: 'LeClap produit la vidéo. Votre workflow la joint.',
    },
  },
  finale: {
    platforms: [
      { en: 'Node.js', fr: 'Node.js' },
      { en: 'Browser', fr: 'Navigateur' },
      { en: 'iOS', fr: 'iOS' },
      { en: 'Android', fr: 'Android' },
      { en: 'MCP', fr: 'MCP' },
    ],
    openSource: { en: 'OPEN SOURCE · GITHUB.COM/HERISTOP/LECLAP', fr: 'OPEN SOURCE · GITHUB.COM/HERISTOP/LECLAP' },
  },
} satisfies CopyTree;

/**
 * Picture cued off the narration, per language (frames, local to the scene). Measured on the generated
 * lines with ffmpeg's silencedetect — `ffmpeg -i public/showcase/voice[-fr]/<id>.wav -af
 * silencedetect=noise=-38dB:d=<d> -f null -` — where each phrase's onset is the `silence_end` before it:
 *
 * - `desktopSteps`: vo-06 (24.3 s, 0.3 s into the scene), d=0.2 — the [[slnc 350]] beats between its
 *   phrases. A step lands ~3 frames ahead of its phrase: round((0.3 + onset) × 30) − 3. English onsets
 *   2.185 / 3.831 / 5.339 s.
 * - `showIt`: vo-13 (67.2 s, 13.2 s into the agentic scene), d=0.12 — the onset of "Show it." (1.617 s)
 *   after the [[slnc 200]]. The type leads the word a touch: floor((13.2 + onset)
 *   × 30) − 4.
 *
 * The French cut plays the same English narration (src/film/narration.ts), so its cues are the English ones.
 * Re-measure after changing a line's wording or speed.
 */
export const TIMING = {
  desktopSteps: {
    pick: { en: 0, fr: 0 },
    drop: { en: 72, fr: 72 },
    trim: { en: 121, fr: 121 },
    build: { en: 166, fr: 166 },
  },
  showIt: { en: 440, fr: 440 },
} satisfies CopyTree;

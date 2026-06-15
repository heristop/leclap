// Single source of truth for the curated media library, shared by web + expo.
// Assets live under ./library/musics and ./library/backgrounds and are copied
// into each app's static dir by scripts/copy-core-assets.mjs at build/dev time.
export interface MediaCredit {
  id: string;
  title: string;
  author: string;
  license: string;
  sourceUrl: string;
  file: string; // filename only, e.g. 'go-by-ocean.mp3'
}

export const MUSIC_LIBRARY: MediaCredit[] = [
  {
    id: 'go-by-ocean',
    title: 'Go by Ocean',
    author: 'Ryan McCaffrey',
    license: 'Bundled sample',
    sourceUrl: 'https://github.com/heristop/ffmpeg-video-composer',
    file: 'go-by-ocean.mp3',
  },
  {
    id: 'americana',
    title: 'Americana',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100254',
    file: 'americana.mp3',
  },
  {
    id: 'arcadia',
    title: 'Arcadia',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100291',
    file: 'arcadia.mp3',
  },
  {
    id: 'anxiety',
    title: 'Anxiety',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100288',
    file: 'anxiety.mp3',
  },
  {
    id: 'air-prelude',
    title: 'Air Prelude',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100337',
    file: 'air-prelude.mp3',
  },
  {
    id: 'beachfront-celebration',
    title: 'Beachfront Celebration',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200022',
    file: 'beachfront-celebration.mp3',
  },
  {
    id: 'autumn-day',
    title: 'Autumn Day',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100765',
    file: 'autumn-day.mp3',
  },
  {
    id: 'monkeys-spinning-monkeys',
    title: 'Monkeys Spinning Monkeys',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3',
    file: 'monkeys-spinning-monkeys.mp3',
  },
  {
    id: 'fluffing-a-duck',
    title: 'Fluffing a Duck',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fluffing%20a%20Duck.mp3',
    file: 'fluffing-a-duck.mp3',
  },
  {
    id: 'sneaky-snitch',
    title: 'Sneaky Snitch',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3',
    file: 'sneaky-snitch.mp3',
  },
  {
    id: 'carefree',
    title: 'Carefree',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3',
    file: 'carefree.mp3',
  },
  {
    id: 'pixelland',
    title: 'Pixelland',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pixelland.mp3',
    file: 'pixelland.mp3',
  },
  {
    id: 'the-builder',
    title: 'The Builder',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Builder.mp3',
    file: 'the-builder.mp3',
  },
  {
    id: 'brain-dance',
    title: 'Brain Dance',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Brain%20Dance.mp3',
    file: 'brain-dance.mp3',
  },
  {
    id: 'local-forecast-elevator',
    title: 'Local Forecast - Elevator',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Local%20Forecast%20-%20Elevator.mp3',
    file: 'local-forecast-elevator.mp3',
  },
];

export const BACKGROUND_LIBRARY: MediaCredit[] = [
  {
    id: 'forest-sea',
    title: 'Forest & Sea',
    author: 'Paul Jarvis',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/6J--NXulQCs',
    file: 'forest-sea.jpg',
  },
  {
    id: 'desk-flatlay',
    title: 'Desk Flatlay',
    author: 'Aleks Dorohovich',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/nJdwUHmaY8A',
    file: 'desk-flatlay.jpg',
  },
  {
    id: 'green-forest',
    title: 'Green Forest',
    author: 'Jerry Adney',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/_WiFMBRT7Aw',
    file: 'green-forest.jpg',
  },
  {
    id: 'rocky-coast',
    title: 'Rocky Coast',
    author: 'Austin Neill',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/erTjj730fMk',
    file: 'rocky-coast.jpg',
  },
  {
    id: 'laptop-desk',
    title: 'Laptop Desk',
    author: 'Luke Chesser',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/1uxV8fAfhVM',
    file: 'laptop-desk.jpg',
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour',
    author: 'Alexander Shustov',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/2FrX56QL7P8',
    file: 'golden-hour.jpg',
  },
];

export const findMusic = (id: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.id === id);
export const findBackground = (id: string): MediaCredit | undefined => BACKGROUND_LIBRARY.find((m) => m.id === id);

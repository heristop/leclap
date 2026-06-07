// Curated, credited media served from /public. Picks are referenced by URL in
// the template descriptor, so they stay portable across devices.
export interface MediaCredit {
  id: string
  title: string
  author: string
  license: string
  sourceUrl: string
  url: string // same-origin path under /public
  cover?: string // optional cover-art image URL; the music card falls back to a generated cover
}

export const MUSIC_LIBRARY: MediaCredit[] = [
  {
    id: 'go-by-ocean',
    title: 'Go by Ocean',
    author: 'Ryan McCaffrey',
    license: 'Bundled sample',
    sourceUrl: 'https://github.com/heristop/ffmpeg-video-composer',
    url: '/musics/go-by-ocean.mp3',
  },
  {
    id: 'americana',
    title: 'Americana',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100254',
    url: '/musics/americana.mp3',
  },
  {
    id: 'arcadia',
    title: 'Arcadia',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100291',
    url: '/musics/arcadia.mp3',
  },
  {
    id: 'anxiety',
    title: 'Anxiety',
    author: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100288',
    url: '/musics/anxiety.mp3',
  },
]

export const BACKGROUND_LIBRARY: MediaCredit[] = [
  {
    id: 'forest-sea',
    title: 'Forest & Sea',
    author: 'Paul Jarvis',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/6J--NXulQCs',
    url: '/backgrounds/forest-sea.jpg',
  },
  {
    id: 'desk-flatlay',
    title: 'Desk Flatlay',
    author: 'Aleks Dorohovich',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/nJdwUHmaY8A',
    url: '/backgrounds/desk-flatlay.jpg',
  },
  {
    id: 'green-forest',
    title: 'Green Forest',
    author: 'Jerry Adney',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/_WiFMBRT7Aw',
    url: '/backgrounds/green-forest.jpg',
  },
  {
    id: 'rocky-coast',
    title: 'Rocky Coast',
    author: 'Austin Neill',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/erTjj730fMk',
    url: '/backgrounds/rocky-coast.jpg',
  },
  {
    id: 'laptop-desk',
    title: 'Laptop Desk',
    author: 'Luke Chesser',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/1uxV8fAfhVM',
    url: '/backgrounds/laptop-desk.jpg',
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour',
    author: 'Alexander Shustov',
    license: 'Unsplash (via Lorem Picsum)',
    sourceUrl: 'https://unsplash.com/photos/2FrX56QL7P8',
    url: '/backgrounds/golden-hour.jpg',
  },
]

export const findMusic = (id: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.id === id)
export const findBackground = (id: string): MediaCredit | undefined => BACKGROUND_LIBRARY.find((m) => m.id === id)
export const findMusicByUrl = (url: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.url === url)
export const findBackgroundByUrl = (url: string): MediaCredit | undefined =>
  BACKGROUND_LIBRARY.find((m) => m.url === url)

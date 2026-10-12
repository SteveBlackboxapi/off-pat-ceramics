import legacyPieces from './legacy-pieces.json';

export interface Piece {
  slug: string;
  title: string;
  kind: string;
  image: string;
  alt: string;
  description: string;
  width?: number;
  height?: number;
  thumbnail?: string;
}

// Descriptive captions, not assumed artwork titles, dates or dimensions.
// Selection and original upload names are recorded in docs/photo-selection.md.
export const selectedPieces: Piece[] = [
  {
    slug: 'blue-coast', title: 'Blue coastal wall piece', kind: 'Wall piece',
    image: '/images/selected/blue-coast.webp', width: 1600, height: 1200,
    alt: 'Blue and cream ceramic seascape with two white sails and a red navigation marker',
    description: 'Layers of blue and cream glaze, two white sails and a red marker bring a coastal scene into clay.',
  },
  {
    slug: 'rust-coast', title: 'Rust and cream seascape', kind: 'Wall piece',
    image: '/images/selected/rust-coast.webp', width: 1200, height: 1600,
    alt: 'Rust-coloured ceramic wall piece with cream textured waves and two white sails',
    description: 'Rust-coloured layers and textured cream waves surround two small white sails.',
  },
  {
    slug: 'crackle-bowl', title: 'Crackle-glazed bowl', kind: 'Bowl',
    image: '/images/selected/crackle-bowl.webp', width: 1600, height: 1200,
    alt: 'Rust-coloured ceramic bowl with a cream crackle-glazed interior and softly irregular rim',
    description: 'A rust-coloured bowl with a softly irregular rim and a cream crackle-glazed interior.',
  },
  {
    slug: 'turquoise-coast', title: 'Turquoise coastal wall piece', kind: 'Wall piece',
    image: '/images/selected/turquoise-coast.webp', width: 1200, height: 1600,
    alt: 'Turquoise and cream ceramic coastal scene in a white box frame',
    description: 'A pool of turquoise glaze sits within layered cream clay in a white box frame.',
  },
  {
    slug: 'architectural-wall-piece', title: 'Architecture in clay', kind: 'Wall piece',
    image: '/images/selected/architectural-wall-piece.webp', width: 1600, height: 1200,
    alt: 'Cream and grey ceramic buildings with pointed windows and rust-coloured printed details',
    description: 'Cream and grey facades, pointed windows and printed details form a layered architectural scene.',
  },
  {
    slug: 'ammonite-crackle', title: 'Ammonite and crackle glaze', kind: 'Surface detail',
    image: '/images/selected/ammonite-crackle.webp', width: 1200, height: 1600,
    alt: 'Close-up of an ammonite spiral crossed by a band of white crackle glaze on dark clay',
    description: 'A closer look at an ammonite spiral and the white crackle glaze crossing its surface.',
  },
].map(piece => ({ ...piece, thumbnail: `/images/selected/${piece.slug}-small.webp` }));

// Keep earlier preview links working without repeating them in the new selection.
export const allPieces: Piece[] = [...selectedPieces, ...legacyPieces];

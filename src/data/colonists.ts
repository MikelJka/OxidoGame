/** Datos de contenido para generar colonos. Ampliar aquí, no en la lógica. */

export const SKILLS = [
  'construccion',
  'mineria',
  'cultivo',
  'cocina',
  'combate',
  'investigacion',
  'medicina',
  'social',
  'supervivencia',
] as const;

export type Skill = (typeof SKILLS)[number];

export const SKILL_NAMES: Record<Skill, string> = {
  construccion: 'Construcción',
  mineria: 'Minería',
  cultivo: 'Cultivo',
  cocina: 'Cocina',
  combate: 'Combate',
  investigacion: 'Investigación',
  medicina: 'Medicina',
  social: 'Trato',
  supervivencia: 'Supervivencia',
};

export interface TraitDef {
  id: string;
  name: string;
  description: string;
  /** Multiplicador de velocidad al caminar. */
  walkSpeed?: number;
}

export const TRAITS: TraitDef[] = [
  { id: 'agil', name: 'Ágil', description: 'Camina más rápido.', walkSpeed: 1.2 },
  { id: 'lento', name: 'Lento', description: 'Camina más despacio.', walkSpeed: 0.8 },
  { id: 'duro', name: 'Duro', description: 'Aguanta mejor el dolor y las heridas.' },
  { id: 'optimista', name: 'Optimista', description: 'Su ánimo base es más alto.' },
  { id: 'pesimista', name: 'Pesimista', description: 'Su ánimo base es más bajo.' },
  { id: 'trabajador', name: 'Trabajador', description: 'Trabaja más rápido.' },
  { id: 'perezoso', name: 'Perezoso', description: 'Trabaja más despacio.' },
  { id: 'carroñero', name: 'Carroñero', description: 'Encuentra más botín en las ruinas.' },
  { id: 'nocturno', name: 'Nocturno', description: 'Prefiere trabajar de noche.' },
  { id: 'glotón', name: 'Glotón', description: 'Necesita comer más a menudo.' },
];

/** Pares de rasgos que no pueden coincidir. */
export const TRAIT_CONFLICTS: Array<[string, string]> = [
  ['agil', 'lento'],
  ['optimista', 'pesimista'],
  ['trabajador', 'perezoso'],
];

export const FIRST_NAMES = [
  'Ada', 'Bruno', 'Carmen', 'Dario', 'Elena', 'Fermín', 'Gala', 'Hugo', 'Inés', 'Jairo',
  'Lola', 'Marco', 'Nerea', 'Óscar', 'Paula', 'Quique', 'Rocío', 'Saúl', 'Tania', 'Unai',
  'Vera', 'Xabi', 'Yolanda', 'Zoe', 'Iker', 'Amaia', 'Leire', 'Gorka', 'Ane', 'Mikel',
];

export const NICKNAMES = [
  'Chispa', 'Óxido', 'Tuerca', 'Ceniza', 'Roña', 'Zorro', 'Cuervo', 'Mecha', 'Polvo', 'Chatarra',
  'Grieta', 'Brasa', 'Sal', 'Hueso', 'Lata', 'Niebla', 'Clavo', 'Musgo', 'Pólvora', 'Garra',
];

/** Colores de ropa para distinguir a los colonos (RGB hex). */
export const SHIRT_COLORS = [0xb5562d, 0x4f7a8c, 0x8a7a3a, 0x6b4a7a, 0x3f7a4f, 0x9a3d3d, 0x7a6a5a, 0x3d5a9a];
export const SKIN_COLORS = [0xe0b48a, 0xc68e62, 0x9a6640, 0x6e4628, 0xf0c8a0];
export const HAIR_COLORS = [0x2a1d14, 0x5a3a20, 0x8a6a3a, 0xb0a090, 0x1a1a1a, 0x7a2a1a];

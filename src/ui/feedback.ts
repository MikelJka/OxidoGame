// Formato de los avisos de Mikel (bugs, peticiones y cambios) y de la cola local.
// Sin DOM: se puede probar con Vitest.

export const REPO = 'MikelJka/OxidoGame';
/** GitHub corta las URL muy largas; dejamos margen. */
const MAX_URL_LENGTH = 7000;

export type FeedbackKind = 'bug' | 'peticion' | 'cambio';

export const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: 'Bug',
  peticion: 'Petición',
  cambio: 'Cambio',
};

export interface ErrorEntry {
  /** Hora en ISO. */
  at: string;
  /** Origen: excepción, promesa, consola o comprobación de la simulación. */
  source: 'error' | 'promesa' | 'consola' | 'simulación' | 'guardado';
  message: string;
  /** Veces que se ha repetido el mismo mensaje. */
  count: number;
}

export interface GameContext {
  url: string;
  clock: string;
  userAgent: string;
  viewport: string;
}

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  text: string;
  createdAt: string;
  context: GameContext;
  errors: ErrorEntry[];
  /** Se ha abierto ya el formulario de GitHub con este aviso. */
  sent: boolean;
}

/** Título corto: primera línea del texto, como mucho 70 caracteres. */
export function feedbackTitle(item: Pick<FeedbackItem, 'kind' | 'text'>): string {
  const first = item.text.trim().split('\n')[0].trim() || 'Sin descripción';
  const short = first.length > 70 ? `${first.slice(0, 67)}…` : first;
  return `[${KIND_LABELS[item.kind]}] ${short}`;
}

export function feedbackBody(item: FeedbackItem, maxErrors = 10): string {
  const lines = [
    item.text.trim() || '_Sin descripción_',
    '',
    '---',
    `- Tipo: ${KIND_LABELS[item.kind]}`,
    `- Fecha: ${item.createdAt}`,
    `- Partida: ${item.context.clock}`,
    `- URL: ${item.context.url}`,
    `- Pantalla: ${item.context.viewport}`,
    `- Navegador: ${item.context.userAgent}`,
  ];
  if (item.errors.length > 0 && maxErrors <= 0) {
    lines.push('', `**Errores detectados: ${item.errors.length}** (no caben en el enlace; usa «Copiar pendientes» del botón 🐞)`);
  } else if (item.errors.length > 0) {
    lines.push('', `**Errores detectados (${item.errors.length})**`, '', '```');
    for (const e of item.errors.slice(-maxErrors)) {
      const times = e.count > 1 ? ` ×${e.count}` : '';
      lines.push(`${e.at} [${e.source}]${times} ${e.message}`);
    }
    if (item.errors.length > maxErrors) lines.push(`… y ${item.errors.length - maxErrors} más`);
    lines.push('```');
  }
  lines.push('', '_Enviado desde el botón 🐞 del juego._');
  return lines.join('\n');
}

/** URL del formulario de nueva incidencia en GitHub, ya rellenado y con etiquetas. */
export function issueUrl(item: FeedbackItem): string {
  const build = (maxErrors: number, textLimit?: number) => {
    const shown = textLimit === undefined ? item : { ...item, text: `${item.text.slice(0, textLimit)}…` };
    const params = new URLSearchParams({
      title: feedbackTitle(item),
      body: feedbackBody(shown, maxErrors),
      labels: `feedback,${item.kind}`,
    });
    return `https://github.com/${REPO}/issues/new?${params.toString()}`;
  };
  for (const maxErrors of [10, 5, 2, 0]) {
    const url = build(maxErrors);
    if (url.length <= MAX_URL_LENGTH) return url;
  }
  return build(0, 1500);
}

/** Todos los avisos pendientes en un único texto, para copiar y pegar. */
export function queueAsMarkdown(items: FeedbackItem[]): string {
  return items.map((i) => `## ${feedbackTitle(i)}\n\n${feedbackBody(i, 5)}`).join('\n\n');
}

/** Añade un error al registro agrupando repeticiones del mismo mensaje. */
export function addError(log: ErrorEntry[], entry: Omit<ErrorEntry, 'count'>, max = 50): ErrorEntry[] {
  const existing = log.find((e) => e.source === entry.source && e.message === entry.message);
  if (existing) {
    existing.count++;
    existing.at = entry.at;
    return log;
  }
  log.push({ ...entry, count: 1 });
  while (log.length > max) log.shift();
  return log;
}

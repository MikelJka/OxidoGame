// Lee los documentos del proyecto (roadmap, diario de progreso y feedback) para el panel
// «Progreso del desarrollo». Sin DOM: se puede probar.

export interface RoadmapTask {
  text: string;
  done: boolean;
}

export interface Phase {
  title: string;
  /** Criterio de «terminado» de la fase, si lo tiene. */
  criterion: string;
  tasks: RoadmapTask[];
}

export interface ProgressEntry {
  title: string;
  items: string[];
}

export interface DevStatus {
  phases: Phase[];
  /** Índice de la fase en curso: la primera con tareas sin hacer. */
  current: number;
  done: number;
  total: number;
  nextTask: string | null;
  pendingFeedback: string[];
  /** Tareas que solo esperan a que Mikel confirme algo. */
  awaitingConfirmation: string[];
  entries: ProgressEntry[];
}

/** Tarea que no depende de programar, sino de que Mikel compruebe algo. */
export function isConfirmation(task: RoadmapTask): boolean {
  return /confirm/i.test(task.text);
}

/** Quita el formato Markdown en línea para mostrarlo como texto. */
export function plain(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRoadmap(md: string): Phase[] {
  const phases: Phase[] = [];
  let phase: Phase | null = null;
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      phase = { title: plain(heading[1]), criterion: '', tasks: [] };
      phases.push(phase);
      continue;
    }
    if (!phase) continue;
    const criterion = /^Terminado:\s*(.+)$/.exec(line);
    if (criterion) {
      phase.criterion = plain(criterion[1]);
      continue;
    }
    const task = /^- \[( |x|X)\]\s+(.+)$/.exec(line);
    if (task) phase.tasks.push({ done: task[1] !== ' ', text: plain(task[2]) });
  }
  return phases.filter((p) => p.tasks.length > 0);
}

export function parseProgress(md: string, limit = 6): ProgressEntry[] {
  const entries: ProgressEntry[] = [];
  let entry: ProgressEntry | null = null;
  for (const raw of md.split('\n')) {
    const heading = /^##\s+(.+)$/.exec(raw.trim());
    if (heading) {
      if (entries.length >= limit) break;
      entry = { title: plain(heading[1]), items: [] };
      entries.push(entry);
      continue;
    }
    const item = /^- (.+)$/.exec(raw);
    if (entry && item) entry.items.push(plain(item[1]));
  }
  return entries;
}

/** Puntos pendientes de FEEDBACK.md (solo los de primer nivel), por su título en negrita o su texto. */
export function parsePendingFeedback(md: string): string[] {
  const start = md.search(/^## Pendiente/m);
  if (start < 0) return [];
  const rest = md.slice(start).split('\n').slice(1);
  const out: string[] = [];
  for (const line of rest) {
    if (/^## /.test(line)) break;
    const item = /^- \[ \]\s+(.+)$/.exec(line);
    if (!item) continue;
    const bold = /\*\*(.+?)\*\*/.exec(item[1]);
    out.push(plain(bold ? bold[1] : item[1]).slice(0, 120));
  }
  return out;
}

export function buildStatus(roadmapMd: string, progressMd: string, feedbackMd: string): DevStatus {
  const phases = parseRoadmap(roadmapMd);
  let current = phases.findIndex((p) => p.tasks.some((t) => !t.done && !isConfirmation(t)));
  if (current < 0) current = Math.max(0, phases.length - 1);
  const all = phases.flatMap((p) => p.tasks);
  const pendingFeedback = parsePendingFeedback(feedbackMd);
  // Las sesiones hacen primero el feedback pendiente y después la siguiente tarea del roadmap.
  const nextRoadmap = phases[current]?.tasks.find((t) => !t.done && !isConfirmation(t))?.text ?? null;
  const awaitingConfirmation = phases.flatMap((p) =>
    p.tasks.filter((t) => !t.done && isConfirmation(t)).map((t) => `${p.title.split(' — ')[0]}: ${t.text}`));
  return {
    phases,
    current,
    done: all.filter((t) => t.done).length,
    total: all.length,
    nextTask: pendingFeedback[0] ?? nextRoadmap,
    pendingFeedback,
    awaitingConfirmation,
    entries: parseProgress(progressMd),
  };
}

/**
 * Próxima sesión automática a partir de `now` (hora local), dadas las horas y el minuto
 * de la programación. Devuelve la fecha.
 */
export function nextSession(now: Date, hours: readonly number[], minute: number): Date {
  for (let day = 0; day < 2; day++) {
    for (const h of [...hours].sort((a, b) => a - b)) {
      const d = new Date(now);
      d.setDate(d.getDate() + day);
      d.setHours(h, minute, 0, 0);
      if (d.getTime() > now.getTime()) return d;
    }
  }
  return now;
}

export function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

import { describe, expect, it } from 'vitest';
import { addError, ErrorEntry, FeedbackItem, feedbackTitle, issueUrl, queueAsMarkdown } from '../src/ui/feedback';

function item(over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: '1',
    kind: 'bug',
    text: 'El colono se queda quieto\nAl cruzar el río',
    createdAt: '2026-10-16T22:00:00Z',
    context: { url: 'https://mikeljka.github.io/OxidoGame/?seed=5', clock: 'Día 1 · 08:00', userAgent: 'test', viewport: '380×800' },
    errors: [],
    sent: false,
    ...over,
  };
}

describe('feedback', () => {
  it('usa la primera línea como título con el tipo delante', () => {
    expect(feedbackTitle(item())).toBe('[Bug] El colono se queda quieto');
    expect(feedbackTitle(item({ kind: 'peticion', text: '   ' }))).toBe('[Petición] Sin descripción');
    expect(feedbackTitle(item({ text: 'x'.repeat(100) })).length).toBeLessThanOrEqual(80);
  });

  it('genera la URL de GitHub con etiquetas y el texto completo', () => {
    const url = new URL(issueUrl(item({ kind: 'cambio' })));
    expect(url.pathname).toBe('/MikelJka/OxidoGame/issues/new');
    expect(url.searchParams.get('labels')).toBe('feedback,cambio');
    expect(url.searchParams.get('body')).toContain('Al cruzar el río');
    expect(url.searchParams.get('body')).toContain('seed=5');
  });

  it('recorta la URL cuando hay muchos errores largos', () => {
    const errors: ErrorEntry[] = Array.from({ length: 50 }, (_, i) => ({
      at: 'hora', source: 'error', message: `fallo ${i} ${'detalle '.repeat(40)}`, count: 1,
    }));
    const url = issueUrl(item({ errors, text: 'texto '.repeat(2000) }));
    expect(url.length).toBeLessThanOrEqual(7000 * 1.2);
    expect(new URL(url).searchParams.get('title')).toContain('[Bug]');
  });

  it('agrupa errores repetidos y limita el registro', () => {
    const log: ErrorEntry[] = [];
    addError(log, { at: 'a', source: 'error', message: 'X' });
    addError(log, { at: 'b', source: 'error', message: 'X' });
    expect(log).toHaveLength(1);
    expect(log[0].count).toBe(2);
    expect(log[0].at).toBe('b');
    for (let i = 0; i < 60; i++) addError(log, { at: 'c', source: 'consola', message: `m${i}` }, 50);
    expect(log).toHaveLength(50);
  });

  it('exporta la cola en un único texto', () => {
    const md = queueAsMarkdown([item(), item({ id: '2', kind: 'peticion', text: 'Vista 3D' })]);
    expect(md).toContain('## [Bug]');
    expect(md).toContain('## [Petición] Vista 3D');
  });
});

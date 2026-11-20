import { describe, expect, it } from 'vitest';
import { dietProblems, parseDiet, type PdfItem, type PdfPage } from '@/lib/diet-parse';
import pages from './fixtures/webdiet-exemplo.json';

/*
 * PDFs personalizados: monta páginas "de mentira" a partir de linhas (cada linha = células com posição x),
 * imitando o que o leitor de PDF entrega. Cobre layouts que não seguem o padrão do WebDiet.
 */
type Cell = string | { s: string; x?: number; bold?: boolean };
function page(rows: (Cell | Cell[])[], o: { w?: number; h?: number; footer?: string } = {}): PdfPage {
  const w = o.w ?? 595, h = o.h ?? 842, items: PdfItem[] = [];
  let y = 60;
  for (const row of rows) {
    const cells = Array.isArray(row) ? row : [row];
    let x = 40;
    for (const c of cells) {
      const cell = typeof c === 'string' ? { s: c } : c;
      const cx = cell.x ?? x;
      items.push({ s: cell.s, x: cx, y, w: cell.s.length * 5, h: 10, bold: cell.bold });
      x = cx + cell.s.length * 5 + 120;
    }
    y += 18;
  }
  if (o.footer) items.push({ s: o.footer, x: 260, y: h - 30, w: 60, h: 8 });
  return { w, h, items };
}

describe('PDF do WebDiet personalizado (layout próprio)', () => {
  const d = parseDiet([page([
    'Dra. Carla Mendes - Nutricionista', 'CRN 12345',
    'Paciente: João Silva', 'Data: 05/11/2026',
    { s: 'PLANO ALIMENTAR', x: 250, bold: true },
    'CAFÉ DA MANHÃ - 07h00',
    [{ s: 'Alimento', x: 40 }, { s: 'Quantidade', x: 300 }, { s: 'Medida caseira', x: 420 }],
    [{ s: 'Pão integral', x: 40 }, { s: '50g', x: 300 }, { s: '2 fatias', x: 420 }],
    [{ s: 'Ovo cozido', x: 40 }, { s: '100g', x: 300 }, { s: '2 unidades', x: 420 }],
    'Pode substituir por:',
    'Tapioca - 60g - ou - Cuscuz - 100g',
    'Lanche da manhã (10:00) - 150 kcal',
    'Opção 1',
    [{ s: 'Iogurte natural', x: 40 }, { s: '170g', x: 300 }, { s: '1 pote', x: 420 }],
    'Opção 2',
    [{ s: 'Banana', x: 40 }, { s: '100g', x: 300 }, { s: '1 unidade', x: 420 }],
    'ALMOÇO 12h30',
    '• 4 colheres de sopa de arroz integral',
    '• 1 concha de feijão',
    '• 120g de frango grelhado',
    'ou 120g de patinho moído',
    [{ s: 'Jantar', x: 40 }, { s: '19:30', x: 470 }],
    [{ s: 'Salada verde', x: 40 }, { s: 'à vontade', x: 300 }],
  ], { footer: 'Página 1 de 1' })]);
  const m = (name: string) => d.meals.find((x) => x.name === name)!;

  it('acha as refeições pelo nome, com o horário em qualquer posição', () => {
    expect(d.meals.map((x) => `${x.time} ${x.name} (${x.variants.length})`)).toEqual([
      '07:00 Café da manhã (1)', '10:00 Lanche da manhã (2)', '12:30 Almoço (1)', '19:30 Jantar (1)',
    ]);
    expect(dietProblems(d, [])).not.toContain('nomeals');
  });
  it('tabela com cabeçalho e colunas de gramas e medida caseira', () => {
    expect(m('Café da manhã').variants[0]!.foods.map((f) => [f.name, f.qty])).toEqual([['Pão integral', '2 fatias (50g)'], ['Ovo cozido', '2 unidades (100g)']]);
  });
  it('"Pode substituir por" e "ou …" viram trocas', () => {
    expect(m('Café da manhã').variants[0]!.foods[1]!.subs).toEqual([{ name: 'Tapioca', qty: '60g' }, { name: 'Cuscuz', qty: '100g' }]);
    expect(m('Almoço').variants[0]!.foods.at(-1)!.subs).toEqual([{ name: 'Patinho moído', qty: '120g' }]);
  });
  it('"Opção 1 / Opção 2" como subtítulo viram opções da refeição', () => {
    expect(m('Lanche da manhã').variants.map((v) => [v.label, v.foods[0]!.name])).toEqual([['Opção 1', 'Iogurte natural'], ['Opção 2', 'Banana']]);
  });
  it('lista com a quantidade antes do alimento', () => {
    expect(m('Almoço').variants[0]!.foods.map((f) => [f.name, f.qty])).toEqual([['Arroz integral', '4 colheres de sopa'], ['Feijão', '1 concha'], ['Frango grelhado', '120g']]);
  });
  it('cabeçalho do PDF: paciente, data e título; dados não viram orientação nem rodapé entra', () => {
    expect(d.patientName).toBe('João Silva');
    expect(d.prescribedAt).toBe('2026-11-05');
    expect(d.title).toBe('PLANO ALIMENTAR');
    expect(d.sections).toEqual([]);
    expect(JSON.stringify(d)).not.toMatch(/Página 1|CRN 12345/);
  });
});

describe('PDF em lista simples, sem horários', () => {
  const d = parseDiet([page([
    { s: 'Desjejum', bold: true }, '• 1 copo de leite desnatado', '• 2 torradas integrais',
    { s: 'Colação', bold: true }, '• 1 maçã',
    { s: 'Almoço', bold: true }, '- Arroz branco: 100g', '- Peito de frango - 120g',
  ])]);
  it('mantém a ordem do PDF e lê as quantidades', () => {
    expect(d.meals.map((x) => `${x.time} ${x.name}`)).toEqual(['null Desjejum', 'null Colação', 'null Almoço']);
    expect(d.meals[0]!.variants[0]!.foods.map((f) => [f.name, f.qty])).toEqual([['Leite desnatado', '1 copo'], ['Torradas integrais', '2']]);
    expect(d.meals[1]!.variants[0]!.foods.map((f) => [f.name, f.qty])).toEqual([['Maçã', '1']]);
    expect(d.meals[2]!.variants[0]!.foods.map((f) => [f.name, f.qty])).toEqual([['Arroz branco', '100g'], ['Peito de frango', '120g']]);
  });
});

describe('sem nenhum título de refeição reconhecível', () => {
  it('os alimentos não se perdem: entram numa refeição para o nutricionista ajustar', () => {
    const d = parseDiet([page([[{ s: 'Aveia em flocos', x: 40 }, { s: '30g', x: 300 }], [{ s: 'Whey protein', x: 40 }, { s: '1 scoop (30g)', x: 300 }]])]);
    expect(d.meals).toHaveLength(1);
    expect(d.meals[0]!.variants[0]!.foods.map((f) => f.name)).toEqual(['Aveia em flocos', 'Whey protein']);
  });
});

describe('o PDF padrão do WebDiet continua igual', () => {
  it('mesmas refeições do exemplo', () => {
    expect(parseDiet(pages as PdfPage[]).meals.map((x) => `${x.time} ${x.name}`)).toEqual(['09:30 Café da manhã', '12:30 Almoço', '16:30 Lanche', '20:00 Jantar', '22:00 Ceia']);
  });
});

import { describe, expect, it } from 'vitest';
import { parseDiet, type PdfItem, type PdfPage } from '@/lib/diet-parse';
import pages from './fixtures/tabela-exemplo.json';
import webdiet from './fixtures/webdiet-exemplo.json';

/* PDF em tabela (Preparação | Alimento | Quantidades | Medidas caseiras), com bordas, "OU", "+" e células que passam de página */
describe('plano alimentar em tabela', () => {
  const d = parseDiet(pages as PdfPage[]);
  const m = (name: string) => d.meals.find((x) => x.name === name)!;
  const v0 = (name: string) => m(name).variants[0]!;

  it('refeições pelo título da tabela, com horário e observação', () => {
    expect(d.title).toBe('Planejamento alimentar');
    expect(d.meals.map((x) => `${x.time} ${x.name}`)).toEqual(['08:00 Café da manhã', '11:30 Almoço', '15:00 Lanche da tarde', '19:00 Jantar', '22:30 Ceia']);
    expect(v0('Café da manhã').notes).toBe('Pré treino musculação\nHorário: entre 08:00 e 08:30');
  });
  it('linhas "OU" viram trocas do alimento; "+" separa os grupos', () => {
    const [carbo] = v0('Café da manhã').foods;
    expect([carbo!.name, carbo!.qty]).toEqual(['Pão francês', '50g']);
    expect(carbo!.subs).toEqual([{ name: 'Cuscuz de milho', detail: 'Indicação de marca: mano velho', qty: '100g' }, { name: 'Tapioca fininha', qty: '60g' }]);
    expect(v0('Café da manhã').foods.map((f) => f.name)).toEqual(['Pão francês', 'Ovo de galinha', 'Café', 'Leite proteico', 'Melão / melancia / mamão']);
  });
  it('célula que continua na outra página é juntada', () => {
    const leite = v0('Café da manhã').foods[3]!;
    expect(leite.qty).toBe('100ml');
    expect(leite.detail).toMatch(/^Itambé pro .* piracanjuba pro$/);
    expect(v0('Almoço').foods[2]!.subs.map((s) => s.name)).toEqual(['Abacaxi', 'Laranja', 'Uvas', 'Melancia']);
  });
  it('"ESCOLHER:" com opções na medida caseira', () => {
    const ovo = v0('Café da manhã').foods[1]!;
    expect(ovo.qty).toBe('4 ovos');
    expect(ovo.subs.map((s) => s.name)).toEqual(['3 ovos + 30g de queijo', '2 ovos + 60g de queijo']);
    expect(v0('Jantar').foods.slice(1, 3).map((f) => [f.name, f.qty])).toEqual([['Frango desfiado / filé trinchado / carne moída / carne do sol desfiada / camarão / hamburguer bovino', '150g'], ['Queijo tipo coalho', '30g']]);
  });
  it('quantidade e medida caseira juntas; observação do grupo vira nota', () => {
    expect(v0('Jantar').foods[0]!.qty).toBe('2 unidades (100g)');
    expect(v0('Almoço').notes).toContain('Carboidratos: pode mesclar as fontes de carboidrato');
  });
  it('"(OPÇÃO 1 …)" e "(OPÇÃO 2 …)" na coluna preparação viram opções da refeição', () => {
    const l = m('Lanche da tarde');
    expect(l.variants.map((v) => v.label)).toEqual(['Dias de treino de muay thai', 'Dias sem treino de muay thai']);
    expect(l.variants[0]!.foods.map((f) => [f.name, f.qty])).toEqual([
      ['Massa de pizza de frigideira integral / rap 10 integral', '1 unidade'],
      ['Molho de tomate / ketchup / mostarda / requeijão light', '1 colher de sopa'],
      ['Frango desfiado temperado / carne moída / carne do sol magra', '4 colheres de sopa (80g)'],
    ]);
    const whey = l.variants[1]!.foods[1]!;
    expect([whey.name, whey.qty, whey.subs.map((s) => s.name)]).toEqual(['Itambé pro whey', '1 unidade', ['Yopro high protein', 'Natural whey']]);
  });
});

describe('tabela sem bordas desenhadas', () => {
  const page = (rows: [number, string, number][]): PdfPage => ({ w: 595, h: 842, items: rows.map(([y, s, x]): PdfItem => ({ s, x, y, w: s.length * 5, h: 10 })) });
  it('separa pelas linhas OU e pelas quantidades', () => {
    const d = parseDiet([page([
      [100, 'ALMOÇO 12:00', 240],
      [120, 'ALIMENTO', 150], [120, 'QUANTIDADE', 330], [120, 'MEDIDA CASEIRA', 450],
      [140, 'ARROZ', 160], [140, '100g', 340], [140, '4 COLHERES', 450],
      [160, 'OU', 340],
      [180, 'BATATA', 160], [180, '150g', 340],
      [190, '+', 300],
      [200, 'FEIJÃO', 160], [200, '80g', 340], [200, '1 CONCHA', 450],
    ])]);
    expect(d.meals.map((x) => `${x.time} ${x.name}`)).toEqual(['12:00 Almoço']);
    expect(d.meals[0]!.variants[0]!.foods.map((f) => [f.name, f.qty, f.subs.map((s) => s.name)])).toEqual([['Arroz', '4 colheres (100g)', ['Batata']], ['Feijão', '1 concha (80g)', []]]);
  });
});

describe('PDFs que não são tabela continuam no leitor antigo', () => {
  it('WebDiet', () => {
    expect(parseDiet(webdiet as PdfPage[]).meals.map((x) => x.name)).toEqual(['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Ceia']);
  });
});

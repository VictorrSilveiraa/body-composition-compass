import { describe, expect, it } from 'vitest';
import { currentMeal, dietStats, foodCat, mealKind, normTime, parseDiet, qtyParts, shoppingList, splitName, type PdfPage } from '@/lib/diet-parse';
import pages from './fixtures/webdiet-exemplo.json';

const d = parseDiet(pages as PdfPage[]);
const meal = (name: string) => d.meals.find((m) => m.name === name)!;

describe('leitor do PDF do WebDiet', () => {
  it('lê título, paciente, data e quem prescreveu (ignorando rodapé e marca-d’água)', () => {
    expect(d.title).toBe('Planejamento Alimentar Exemplo');
    expect(d.subtitle).toBe('Planejamento alimentar');
    expect(d.patientName).toBe('Paciente Exemplo');
    expect(d.prescribedAt).toBe('2026-11-17');
    expect(d.prescriber).toBe('Ana Maria Nutri Exemplo');
    expect(d.source).toBe('webdiet');
    expect(JSON.stringify(d)).not.toMatch(/FEITO POR ESTUDANTE|Acesse o|Página \d/);
  });

  it('agrupa as refeições por horário, com as opções juntas', () => {
    expect(d.meals.map((m) => `${m.time} ${m.name} (${m.variants.length})`)).toEqual([
      '09:30 Café da manhã (1)', '12:30 Almoço (1)', '16:30 Lanche (2)', '20:00 Jantar (2)', '22:00 Ceia (1)',
    ]);
    expect(meal('Lanche').variants.map((v) => v.label)).toEqual(['Opção 1', 'Opção 2']);
    expect(meal('Jantar').variants.map((v) => v.label)).toEqual(['Principal', 'Opção 1']);
  });

  it('lê alimentos, quantidades, substituições e observações', () => {
    const cafe = meal('Café da manhã').variants[0]!;
    expect(cafe.foods.map((f) => [f.name, f.qty])).toEqual([
      ['Pão francês', '1 Unidade(s) (50g)'], ['Ovo de galinha', '2 Unidade(s) (100g)'], ['Queijo muçarela/mussarela', '1 Fatia(s) média(s) (20g)'], ['Mamão', '200g'],
    ]);
    expect(cafe.foods[0]!.detail).toBe('Pão de sal, pão carequinha');
    expect(cafe.foods[3]!.subs).toEqual([{ name: 'Melão', qty: '240g' }]);
    const almoco = meal('Almoço').variants[0]!;
    expect(almoco.foods.find((f) => f.name === 'Tangerina Ponkã')!.subs.map((s) => s.name)).toEqual(['Laranja', 'Abacaxi', 'Uva']);
    expect(almoco.foods.find((f) => f.name === 'Arroz branco cozido')!.subs).toEqual([{ name: 'Macarrão cozido', qty: '150g' }]);
    expect(almoco.notes).toMatch(/^Quando quiser adicionar feijão/);
    expect(meal('Lanche').variants[0]!.foods[1]!.name).toBe('Doce De Leite');
    expect(meal('Lanche').variants[0]!.foods[1]!.detail).toBe('Aviação');
    expect(meal('Ceia').variants[0]!.foods.map((f) => f.qty)).toEqual(['250ml', '1 Unidade(s) média(s) (130g)']);
  });

  it('lê lista de compras e receitas', () => {
    expect(d.shopping).toHaveLength(18);
    expect(d.shopping[0]).toBe('Abacaxi');
    expect(d.shopping.at(-1)).toBe('Doce de leite avia');
    expect(d.recipes).toHaveLength(1);
    expect(d.recipes[0]).toMatchObject({ name: 'Frango grelhado', yield: '3 porção(ões)', ingredients: ['Peito de frango cru - 2 Porção Média (240g)', 'Azeite de oliva extravirgem - 1 Colher(es) de sopa (8ml)'] });
    expect(d.recipes[0]!.steps).toHaveLength(3);
    expect(d.sections).toEqual([]);
  });

  it('conta o plano', () => {
    const s = dietStats(d);
    expect(s).toMatchObject({ meals: 5, options: 2, foods: 17, subs: 10, recipes: 1, shopping: 18 });
  });
});

describe('detalhes do plano', () => {
  it('quantidade: medida caseira + gramas', () => {
    expect(qtyParts('1 Unidade(s) média(s) (135g)')).toEqual({ measure: '1 unidade média', amount: 135, unit: 'g' });
    expect(qtyParts('2 Unidade(s) (100g)')).toEqual({ measure: '2 unidades', amount: 100, unit: 'g' });
    expect(qtyParts('200g')).toEqual({ measure: '', amount: 200, unit: 'g' });
    expect(qtyParts('250ml')).toEqual({ measure: '', amount: 250, unit: 'ml' });
    expect(qtyParts('1 Colher De Sopa (20g)')).toEqual({ measure: '1 colher de sopa', amount: 20, unit: 'g' });
    expect(qtyParts('1 Emgalagem (250g)').measure).toBe('1 embalagem');
    expect(qtyParts('à vontade')).toEqual({ measure: 'à vontade', amount: null, unit: null });
  });
  it('nome e detalhe', () => {
    expect(splitName('Pão de hambúrguer (Pullman)')).toEqual({ name: 'Pão de hambúrguer', detail: 'Pullman' });
    expect(splitName('Mamão')).toEqual({ name: 'Mamão' });
  });
  it('grupos de alimentos', () => {
    expect(foodCat('Pão de hambúrguer')).toBe('carbo');
    expect(foodCat('Patinho Moido')).toBe('prot');
    expect(foodCat('Iogurte desnatado de frutas')).toBe('leite');
    expect(foodCat('YoPro 15g')).toBe('leite');
    expect(foodCat('Tangerina Ponkã')).toBe('fruta');
    expect(foodCat('Doce De Leite')).toBe('doce');
    expect(foodCat('Azeite de oliva')).toBe('gord');
    expect(foodCat('Feijão carioca')).toBe('legum');
    expect(foodCat('Alface')).toBe('veg');
    expect(foodCat('Xyz')).toBe('outro');
  });
  it('tipo de refeição e horário', () => {
    expect(mealKind('Café da manhã', '09:30')).toBe('cafe');
    expect(mealKind('Refeição 3', '20:00')).toBe('jantar');
    expect(mealKind('Pré-treino', '17:00')).toBe('treino');
    expect(normTime('7h30')).toBe('07:30');
    expect(normTime('7:05')).toBe('07:05');
  });
  it('refeição de agora e a próxima', () => {
    expect(currentMeal(d, 12 * 60 + 40)).toMatchObject({ state: 'now', meal: { name: 'Almoço' } });
    expect(currentMeal(d, 14 * 60)).toMatchObject({ state: 'next', meal: { name: 'Lanche' } });
    expect(currentMeal(d, 23 * 60 + 30)).toMatchObject({ state: 'next', meal: { name: 'Café da manhã' } });
  });
  it('lista de compras montada quando o PDF não tem', () => {
    const list = shoppingList({ ...d, shopping: [] });
    expect(list).toContain('Melão');
    expect(list).toContain('Pão francês');
  });
});

import { describe, expect, it } from 'vitest';
import { base64ToBlob, blobToBase64, makeBackup, matchPatients, planImport, readBackup, type BResponse, type ExportSource, type PartKey } from '@/lib/backup';
import type { LegacyDB } from '@/lib/cloud-data';
import type { DietRecord } from '@/lib/diets';

const P = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, sex: 'F', birth: '1990-05-01', height: 165, ...extra });
const A = (id: string, pid: string, date: string, weight: number) => ({ id, profileId: pid, date, weight, height: 165, protocol: 'jp3', multi: false, circ: {}, folds: {}, extra: {} });
const diet = (id: string, pid: string, aid: string | null): DietRecord => ({ id, profileId: pid, assessmentId: aid, title: 'Plano', prescribedAt: '2026-11-01', data: { title: 'Plano', meals: [] } as never, visible: true, createdAt: 1, updatedAt: 1 });
const ALL = new Set<PartKey>(['patients', 'assessments', 'plans', 'diets', 'photos', 'responses', 'nutri']);

const src: ExportSource = {
  db: { activeId: 'p1', profiles: [P('p1', 'Ana Lima', { phone: '119', plan: { goals: [{ id: 'g', k: 'weight', to: 60, from: 65, fromDate: '2026-10-01' }] } }), P('p2', 'Bia Souza')],
    assessments: [A('a1', 'p1', '2026-10-01', 65), A('a2', 'p1', '2026-11-01', 63), A('a3', 'p2', '2026-11-02', 70)] } as LegacyDB,
  nutri: { name: 'Carla Nutri', crn: 'CRN 1', tourSeen: true, returnDays: 21 },
  diets: [diet('d1', 'p1', 'a2'), diet('d2', 'p2', null)],
  responses: [{ patientId: 'p1', kind: 'pre_consulta', data: { adesao: 4 }, read: true, createdAt: '2026-10-30T10:00:00Z' }] as BResponse[],
};
const photo = { profileId: 'p1', assessmentId: 'a2', pose: 'front' as const, w: 10, h: 20, type: 'image/jpeg', data: 'x'.repeat(200) };

describe('Backup: exportar', () => {
  it('leva só os pacientes e as partes escolhidos', () => {
    const b = makeBackup(src, { parts: ALL, ids: new Set(['p1']) }, [photo]);
    expect(b.version).toBe(2);
    expect(b.profiles.map((p) => p.id)).toEqual(['p1']);
    expect(b.assessments.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(b.diets?.map((d) => d.id)).toEqual(['d1']);
    expect(b.photos).toHaveLength(1);
    expect(b.responses).toHaveLength(1);
    expect(b.nutri).toEqual({ name: 'Carla Nutri', crn: 'CRN 1', returnDays: 21 }); // tourSeen não vai
  });
  it('sem "metas e anamnese", o plano sai do paciente; partes desmarcadas não vão', () => {
    const b = makeBackup(src, { parts: new Set<PartKey>(['patients', 'assessments']), ids: new Set(['p1', 'p2']) });
    expect(b.profiles[0]!.plan).toBeUndefined();
    expect(b.diets).toBeUndefined(); expect(b.photos).toBeUndefined(); expect(b.nutri).toBeUndefined();
    expect(b.parts).toEqual(['patients', 'assessments']);
  });
});

describe('Backup: ler o arquivo', () => {
  it('lê o formato antigo (versão 1) e conta as partes', () => {
    const r = readBackup({ app: 'avaliacao-fisica', version: 1, profiles: src.db.profiles, assessments: src.db.assessments, activeId: 'p1' });
    expect(r.file.parts).toEqual(['patients', 'assessments', 'plans']);
    expect(r.counts.assessments).toBe(3);
  });
  it('registros com defeito são pulados com aviso, sem recusar o arquivo', () => {
    const r = readBackup({ profiles: [P('p1', 'Ana'), { id: 'x', name: 'Sem data', sex: 'F', birth: '' }, { id: 'y', name: '' }],
      assessments: [A('a1', 'p1', '2026-10-01', 60), A('a2', 'p1', '', 60), A('a3', 'x', '2026-10-01', 60), { ...A('a4', 'p1', '2026-10-02', 61), protocol: 'zz' }] });
    expect(r.file.profiles.map((p) => p.id)).toEqual(['p1']);
    expect(r.file.assessments.map((a) => a.id)).toEqual(['a1', 'a4']);
    expect(r.file.assessments[1]!.protocol).toBe('jp7');
    expect(r.warnings.length).toBe(3);
  });
  it('recusa arquivo que não é backup', () => {
    expect(() => readBackup({ foo: 1 })).toThrow();
    expect(() => readBackup(null)).toThrow();
  });
});

describe('Backup: importar', () => {
  const file = readBackup(makeBackup(src, { parts: ALL, ids: new Set(['p1', 'p2']) }, [photo])).file;
  let n = 0; const id = () => 'n' + ++n;
  it('em conta vazia: tudo novo, com ids novos e vínculos refeitos', () => {
    n = 0;
    const r = planImport({ db: { profiles: [], assessments: [], activeId: null }, diets: [], responses: [], photoPoses: () => [] }, file, { parts: ALL, ids: new Set(['p1', 'p2']), existing: 'keep' }, id);
    expect(r.report).toMatchObject({ newPatients: 2, assessments: 3, diets: 2, photos: 1, responses: 1, plans: 1 });
    const ana = r.db.profiles.find((p) => p.name === 'Ana Lima')!;
    expect(ana.id).not.toBe('p1');
    const a2 = r.db.assessments.find((a) => a.date === '2026-11-01')!;
    expect(r.diets.find((d) => d.profileId === ana.id)!.assessmentId).toBe(a2.id);
    expect(r.photos[0]).toMatchObject({ assessmentId: a2.id, profileId: ana.id });
    expect(r.nutri?.name).toBe('Carla Nutri');
  });
  it('sem duplicar: paciente e avaliação que já existem são reaproveitados', () => {
    const cur: LegacyDB = { activeId: 'c1', profiles: [P('c1', 'ana lima', { phone: '', goal: 'emagrecer' })], assessments: [A('c-a1', 'c1', '2026-10-01', 65)] } as LegacyDB;
    expect(matchPatients(cur, file).get('p1')).toBe('c1');
    const r = planImport({ db: cur, diets: [], responses: [], photoPoses: () => [] }, file, { parts: ALL, ids: new Set(['p1']), existing: 'keep' }, id);
    expect(r.db.profiles).toHaveLength(1);
    expect(r.report).toMatchObject({ newPatients: 0, updatedPatients: 1, assessments: 1, sameAssessments: 1 });
    const c = r.db.profiles[0]!;
    expect(c.phone).toBe('119'); // completou o que faltava
    expect(c.goal).toBe('emagrecer'); // manteve o desta conta
    expect(c.plan?.goals).toHaveLength(1);
  });
  it('"atualizar com o arquivo" troca a ficha; partes e pacientes desmarcados não entram', () => {
    const cur = { activeId: 'c1', profiles: [P('c1', 'Ana Lima', { goal: 'emagrecer' })], assessments: [] } as unknown as LegacyDB;
    const f2 = { ...file, profiles: file.profiles.map((p) => (p.id === 'p1' ? { ...p, goal: 'hipertrofia' } : p)) };
    const r = planImport({ db: cur, diets: [], responses: [], photoPoses: () => [] }, f2, { parts: new Set<PartKey>(['patients']), ids: new Set(['p1']), existing: 'update' }, id);
    expect(r.db.profiles[0]!.goal).toBe('hipertrofia');
    expect(r.db.assessments).toHaveLength(0);
    expect(r.diets).toHaveLength(0); expect(r.photos).toHaveLength(0); expect(r.nutri).toBeNull();
    expect(r.db.profiles.some((p) => p.name === 'Bia Souza')).toBe(false);
  });
  it('importar duas vezes não duplica nada', () => {
    const empty = { db: { profiles: [], assessments: [], activeId: null }, diets: [], responses: [], photoPoses: () => [] };
    const r1 = planImport(empty, file, { parts: ALL, ids: new Set(['p1', 'p2']), existing: 'keep' }, id);
    const r2 = planImport({ db: r1.db, diets: r1.diets, responses: r1.responses, photoPoses: (aid) => r1.photos.filter((x) => x.assessmentId === aid).map((x) => x.pose) }, file, { parts: ALL, ids: new Set(['p1', 'p2']), existing: 'keep' }, id);
    expect(r2.report).toMatchObject({ newPatients: 0, assessments: 0, diets: 0, photos: 0, responses: 0 });
    expect(r2.db.profiles).toHaveLength(2);
  });
  it('fotos: base64 vai e volta', async () => {
    const b = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' });
    const s = await blobToBase64(b);
    expect(s).toBe('AQID+g==');
    expect(await blobToBase64(base64ToBlob(s))).toBe(s);
  });
});

// Tipos do gerador de relatórios em PDF (report.js)
export type ReportKind = 'assessment' | 'summary' | 'compare' | 'evolution' | 'full' | 'form';
export function exportPdf(kind: ReportKind, data: Record<string, unknown>): void;
export function reportHtml(kind: ReportKind, data: Record<string, unknown>): string;
export function reportTitle(kind: ReportKind, data: Record<string, unknown>): string;
export function buildReport(data: Record<string, unknown>, o?: Record<string, unknown>): string;
export function buildEvolution(data: Record<string, unknown>, o?: Record<string, unknown>): string;
export function buildCompare(data: Record<string, unknown>): string;

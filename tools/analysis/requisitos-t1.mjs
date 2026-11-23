// Critério C2 do artigo na tarefa T1: requisitos atendidos, por tipo.
//
//   node tools/analysis/requisitos-t1.mjs           # relatório em markdown
//   node tools/analysis/requisitos-t1.mjs --json    # os mesmos números, para figuras.py
//
// Acrescentado em 23/11/2026, depois do artigo: até então os números de C2
// (48% -> 100%, Fig. 2) existiam só no artigo, sem script por trás.
//
// A regra. Cada uma das sete regras da suíte oculta de T1
// (hidden-tests/T1/run.mjs, o segundo argumento de cada check) é um
// requisito, e um requisito está atendido numa sessão quando TODAS as
// asserções daquela regra passam -- lido de `hidden.byRule` em
// sessions/<id>/result.json, que o runner grava. Os tipos são os da
// seção III-F, f.2, do artigo:
//
//   explícito            regra 1  sobreposição (a única que o enunciado cita)
//   implícito inferível  regra 2  reserva cancelada libera o horário
//                        regra 5  fim depois do início
//                        regra 6  sala ou usuário inexistente -> 404
//                        regra 7  erro no formato que o sistema já usa
//   implícito de domínio regra 3  nada no passado
//                        regra 4  duração entre 30 min e 8 h
//
// "Sem guia" é P0; "com guia" é P1 e P2, de todos os modelos -- o recorte
// da Fig. 2 (n = 8 e n = 12). O percentual é sobre pares (sessão,
// requisito): 8 sessões x 4 inferíveis = 32 pares, e assim por diante.
//
// Só lê. Nunca escreve.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRows } from '../../runner/lib/dataset.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export const TYPES = [
  { key: 'explicito', label: 'Explícito', rules: [1] },
  { key: 'inferivel', label: 'Implícito inferível', rules: [2, 5, 6, 7] },
  { key: 'dominio', label: 'Implícito de domínio', rules: [3, 4] },
];

export const GROUPS = [
  { key: 'sem_guia', label: 'Sem guia (P0)', levels: ['P0'] },
  { key: 'com_guia', label: 'Com guia (P1 e P2)', levels: ['P1', 'P2'] },
];

export function ruleMet(byRule, rule) {
  const entry = byRule?.[String(rule)];
  if (!entry || entry.total === 0) {
    throw new Error(`regra ${rule} ausente de byRule; a sessão não tem o detalhe da suíte oculta`);
  }
  return entry.passed === entry.total;
}

// rows: linhas do dataset. loadByRule: session_id -> byRule. Separado da
// leitura de arquivo para ser testável com fixtures.
export function analyze(rows, loadByRule) {
  const t1 = rows.filter((row) => row.task === 'T1' && row.status === 'valid');
  const groups = GROUPS.map((group) => {
    const sessions = t1.filter((row) => group.levels.includes(row.p_level));
    const byRules = sessions.map((row) => loadByRule(row.session_id));
    const types = TYPES.map((type) => {
      let met = 0;
      let total = 0;
      for (const byRule of byRules) {
        for (const rule of type.rules) {
          total += 1;
          if (ruleMet(byRule, rule)) met += 1;
        }
      }
      return { key: type.key, label: type.label, met, total, ratio: total === 0 ? 0 : met / total };
    });
    const implicit = types.filter((type) => type.key !== 'explicito');
    const implicitMet = implicit.reduce((sum, type) => sum + type.met, 0);
    const implicitTotal = implicit.reduce((sum, type) => sum + type.total, 0);
    return {
      key: group.key,
      label: group.label,
      n: sessions.length,
      types,
      implicito: { met: implicitMet, total: implicitTotal, ratio: implicitTotal === 0 ? 0 : implicitMet / implicitTotal },
    };
  });
  return { groups };
}

const percent = (ratio) => `${Math.round(ratio * 100)}%`;

export function formatReport({ groups }) {
  const lines = ['# C2 em T1: requisitos atendidos por tipo', ''];
  lines.push(`| Tipo | ${groups.map((g) => `${g.label}, n = ${g.n}`).join(' | ')} |`);
  lines.push(`|---|${groups.map(() => '---').join('|')}|`);
  for (const [index, type] of TYPES.entries()) {
    const cells = groups.map((g) => `${percent(g.types[index].ratio)} (${g.types[index].met}/${g.types[index].total})`);
    lines.push(`| ${type.label} (regras ${type.rules.join(', ')}) | ${cells.join(' | ')} |`);
  }
  const implicit = groups.map((g) => `${percent(g.implicito.ratio)} (${g.implicito.met}/${g.implicito.total})`);
  lines.push(`| Implícitos, somados | ${implicit.join(' | ')} |`);
  return `${lines.join('\n')}\n`;
}

function loadByRuleFromDisk(sessionId) {
  const path = join(REPO_ROOT, 'sessions', sessionId, 'result.json');
  if (!existsSync(path)) throw new Error(`sem result.json para ${sessionId}`);
  return JSON.parse(readFileSync(path, 'utf8')).hidden?.byRule;
}

function main() {
  const rows = readRows(join(REPO_ROOT, 'resultados.csv'));
  const result = analyze(rows, loadByRuleFromDisk);
  process.stdout.write(process.argv.includes('--json')
    ? `${JSON.stringify(result, null, 2)}\n`
    : formatReport(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

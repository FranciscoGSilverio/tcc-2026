// The composition of the collection grid, declared as data in one place,
// for the same reason runner/lib/capabilities.mjs exists: a label and the
// thing it stands for must not have two sources.
//
// Protocol section 4.1 is the main grid; 4.2 the model cells. Section
// 4.3's drift control is deliberately absent: it exists only if
// collection happens in two windows separated in time, and the decision
// is to collect in one. If that changes it comes back, and that is the
// only reason it would be out.
export const GRID = {
  principal: {
    models: ['claude-sonnet-5'],
    cells: [['P0', 'O1'], ['P0', 'O2'], ['P1', 'O1'], ['P1', 'O2'], ['P2', 'O1'], ['P2', 'O2']],
  },
  modelo: {
    models: ['claude-haiku-4-5', 'claude-opus-5'],
    cells: [['P0', 'O1'], ['P2', 'O2']],
  },
};

// T1 is scored by the hidden suite, so two runs are enough to see the
// cell. T2 is scored by convergence between runs, which needs three.
export const REPETITIONS = { T1: 2, T2: 3 };

// A cell of the collection is the quadruple. The repetition number is
// what distinguishes sessions inside it, and it is never part of a
// planned session: it is derived from the dataset at the moment of
// launching, by nextRunNumber.
export const cellKey = ({ task, pLevel, oLevel, model }) =>
  `${task}|${pLevel}|${oLevel}|${model}`;

const rowCellKey = (row) => `${row.task}|${row.p_level}|${row.o_level}|${row.model}`;

export function targetSessions() {
  const sessions = [];
  for (const [block, { models, cells }] of Object.entries(GRID)) {
    for (const model of models) {
      for (const [pLevel, oLevel] of cells) {
        for (const [task, times] of Object.entries(REPETITIONS)) {
          for (let repetition = 0; repetition < times; repetition += 1) {
            sessions.push({ block, task, pLevel, oLevel, model });
          }
        }
      }
    }
  }
  return sessions;
}

// Only `valid` rows count. An invalid row is a failed attempt: it stays
// in the dataset as evidence, and the session it stands for is still
// missing. Counting it would leave a hole nobody notices until analysis.
export function collectedCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (row.status !== 'valid') continue;
    const key = rowCellKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function missingSessions(rows) {
  const remaining = collectedCounts(rows);
  const missing = [];
  for (const session of targetSessions()) {
    const key = cellKey(session);
    const already = remaining.get(key) ?? 0;
    if (already > 0) {
      remaining.set(key, already - 1);
      continue;
    }
    missing.push(session);
  }
  return missing;
}

export function nextRunNumber(rows, session) {
  return (collectedCounts(rows).get(cellKey(session)) ?? 0) + 1;
}

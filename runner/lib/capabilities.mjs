export class UnsupportedSessionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedSessionError';
  }
}

// The single source for what a session's labels mean. Every label the
// dataset records comes from here, and so does the behaviour it stands
// for. When the two had separate sources they diverged in silence:
// `--task T2` recorded T2 and delivered T1's statement, `--o O2`
// recorded O2 and ran a single call, `--p P1` recorded P1 and ran bare.
// A session that cannot be run exactly as it is labelled must not run.
//
// `hiddenSuite: false` on T2 is NOT a gap waiting to be filled, and
// filling it would damage the study. T1 is the well-specified task: it
// has a contract, so assertions can say pass or fail. T2 is ambiguous
// on purpose -- returning free slots alongside the conflict error,
// adding an availability endpoint, accepting bulk bookings, or simply
// improving the error message are all defensible readings of the same
// ticket. A suite asserting one of them would assert a preference, not
// a contract, and would measure whether the agent guessed the author's
// opinion. T2 is measured by convergence between repeated runs instead,
// classified by the blind evaluator (protocol section 5.1:
// taxa_aceitacao is T1 only, decisoes is T2 only). Writing a hidden
// suite for T2 would turn it into a second well-specified task and cost
// the work half its research question.
export const TASKS = {
  T1: { statement: 'tasks/T1-validacao-de-reservas.md', hiddenSuite: true, decisionPoints: false },
  T2: { statement: 'tasks/T2-res-142.md', hiddenSuite: false, decisionPoints: true },
};

// P0 gets nothing. P1 gets the context file. P2 gets the same file plus
// a plugin directory, loaded with --plugin-dir. The plugin is copied
// outside /app on purpose -- inside, it would appear in the session diff.
export const CONTEXTS = {
  P0: null,
  P1: { file: 'contexts/P1/CLAUDE.md' },
  P2: {
    file: 'contexts/P2/CLAUDE.md',
    pluginDir: 'contexts/P2/plugin',
    pluginName: 'meeting-rooms-conventions',
  },
};

// O1 is one call with the statement. O2 is the four chained calls of
// protocol section 3.3, frozen in files so the sequence that runs and the
// sequence that gets published come from the same place. Only step 1
// carries the statement.
export const ORDERS = {
  O1: { calls: 1, steps: null },
  O2: {
    calls: 4,
    steps: [
      'orders/O2/1-explorar.md',
      'orders/O2/2-planejar.md',
      'orders/O2/3-implementar.md',
      'orders/O2/4-verificar.md',
    ],
  },
};

export function resolveSession({ task, pLevel, oLevel }) {
  const missing = [];
  if (!(task in TASKS)) {
    missing.push(`task ${task} (available: ${Object.keys(TASKS).join(', ')})`);
  }
  if (!(pLevel in CONTEXTS)) {
    missing.push(`context level ${pLevel} (available: ${Object.keys(CONTEXTS).join(', ')})`);
  }
  if (!(oLevel in ORDERS)) {
    missing.push(`order level ${oLevel} (available: ${Object.keys(ORDERS).join(', ')})`);
  }
  if (missing.length > 0) {
    throw new UnsupportedSessionError(
      `this session cannot be run as labelled, so it will not run at all: ${missing.join('; ')}`,
    );
  }

  return {
    statement: TASKS[task].statement,
    hiddenSuite: TASKS[task].hiddenSuite,
    decisionPoints: TASKS[task].decisionPoints,
    context: CONTEXTS[pLevel],
    calls: ORDERS[oLevel].calls,
    steps: ORDERS[oLevel].steps,
  };
}

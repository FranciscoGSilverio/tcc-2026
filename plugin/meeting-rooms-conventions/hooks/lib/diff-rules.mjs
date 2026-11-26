// Implements protocol section 2.6, rules that are detectable purely from
// the session diff: production files created outside the canonical
// folders, configuration files touched, missing tests, seed test files
// weakened, and skipped/only/todo test markers.
//
// Rules 2, 4 and 7 are not computed here: rule 2 needs the manifest, not
// the diff, and rules 4 and 7 need the ESLint run inside the container.
// See check.mjs.

const ALLOWED_NEW_PRODUCTION = [/^src\/modules\/[^/]+\//, /^src\/shared\//, /^src\/plugins\//];
const CONFIG_FILES = [
  'tsconfig.json', 'eslint.config.js', '.prettierrc', 'vitest.config.ts',
  'Makefile', 'Dockerfile', '.dockerignore', 'docker-compose.yml',
  '.editorconfig', '.gitignore', 'prisma/schema.prisma',
];
const SEED_TEST_FILES = [
  'tests/health.test.ts', 'tests/database.test.ts', 'tests/shared.test.ts',
  'tests/rooms.test.ts', 'tests/users.test.ts', 'tests/bookings.test.ts',
  'tests/amenities.test.ts',
];
const SKIP_MARKERS = ['.skip(', '.only(', '.todo('];

// Groups a unified diff by file, because rules 6 and 8 need to know which
// file an added or removed line landed in, not just that the line exists
// somewhere in the diff.
function parseDiffByFile(diffText) {
  const files = [];
  let current = null;

  for (const line of diffText.split('\n')) {
    // A file boundary is a "diff " header line, whatever tool produced the
    // diff: git emits "diff --git a/X b/Y", and the reference patch
    // (generated with `diff -ruN`, to stay independent of git) emits
    // "diff -ruN <flags...> a/X b/Y". Anchoring on "diff --git" only would
    // silently see zero files in the second format, which is exactly the
    // input reference/T1/reference.patch's validation run uses.
    if (line.startsWith('diff ')) {
      current = { path: null, isNew: false, added: [], removed: [] };
      files.push(current);
      continue;
    }
    if (!current) continue;

    if (line.startsWith('new file mode')) {
      current.isNew = true;
      continue;
    }
    // `diff -ruN` appends a tab-separated timestamp after the path
    // ("+++ b/X/Y.ts\t2026-09-15 23:33:21.000000000 -0300"); git diff never
    // does. Cutting at the first tab keeps both formats working.
    if (line.startsWith('+++ ')) {
      const target = line.slice('+++ '.length).split('\t')[0];
      const path = target.startsWith('b/') ? target.slice(2) : target;
      if (path !== '/dev/null') current.path = path;
      continue;
    }
    if (line.startsWith('--- ')) {
      const source = line.slice('--- '.length).split('\t')[0];
      const path = source.startsWith('a/') ? source.slice(2) : source;
      if (path === '/dev/null') {
        current.isNew = true;
      } else if (!current.path) {
        current.path = path;
      }
      continue;
    }
    if (line.startsWith('+')) {
      current.added.push(line.slice(1));
      continue;
    }
    if (line.startsWith('-')) {
      current.removed.push(line.slice(1));
      continue;
    }
  }

  return files;
}

function checkRule1(files) {
  for (const file of files) {
    if (!file.isNew || !file.path) continue;
    if (!file.path.startsWith('src/') || !file.path.endsWith('.ts')) continue;
    const allowed = ALLOWED_NEW_PRODUCTION.some((pattern) => pattern.test(file.path));
    if (!allowed) return { violated: true, detail: file.path };
  }
  return { violated: false, detail: '' };
}

function checkRule3(files) {
  for (const file of files) {
    if (file.path && CONFIG_FILES.includes(file.path)) {
      return { violated: true, detail: file.path };
    }
  }
  return { violated: false, detail: '' };
}

function checkRule5(files) {
  const wroteTest = files.some((file) => file.path?.startsWith('tests/') && file.added.length > 0);
  return wroteTest
    ? { violated: false, detail: '' }
    : { violated: true, detail: 'no lines added under tests/' };
}

function checkRule6(files) {
  for (const file of files) {
    if (file.path && SEED_TEST_FILES.includes(file.path) && file.removed.length > 0) {
      return { violated: true, detail: file.path };
    }
  }
  return { violated: false, detail: '' };
}

function checkRule8(files) {
  for (const file of files) {
    for (const line of file.added) {
      const marker = SKIP_MARKERS.find((candidate) => line.includes(candidate));
      if (marker) return { violated: true, detail: `${file.path ?? '?'}: ${line.trim()}` };
    }
  }
  return { violated: false, detail: '' };
}

export function diffRules(diffText) {
  const files = parseDiffByFile(diffText ?? '');
  return {
    1: checkRule1(files),
    3: checkRule3(files),
    5: checkRule5(files),
    6: checkRule6(files),
    8: checkRule8(files),
  };
}

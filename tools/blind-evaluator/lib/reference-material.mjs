// Reads the frozen contents of src/shared/ and src/plugins/ straight
// from the research repository's own commit -- the same git-show pattern
// tools/convention-check/check.mjs already uses for the frozen ESLint
// config -- never from a session container. This is what makes the
// content identical across every session regardless of P, O or model
// (D9): it does not depend on anything a session did.
//
// The file list comes from `git ls-tree`, not a hardcoded array, so a
// file added to the seed later is picked up without editing this module.
// Explicit sorting makes the byte-identical guarantee independent of
// whatever order git happens to return.
import { execFileSync } from 'node:child_process';

export function readReferenceMaterial(repoRoot) {
  const listing = execFileSync('git', [
    '-C', repoRoot, 'ls-tree', '-r', '--name-only', 'HEAD',
    '--', 'seed/src/shared', 'seed/src/plugins',
  ]).toString().trim();

  const paths = listing.split('\n').filter(Boolean).sort();

  return paths.map((path) => {
    const content = execFileSync('git', ['-C', repoRoot, 'show', `HEAD:${path}`]).toString();
    const label = path.replace(/^seed\/src\//, '');
    return `--- ${label} ---\n${content}`;
  }).join('\n\n');
}

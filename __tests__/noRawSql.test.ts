import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** Recursively collects every .ts file under `dir` (skips .test.ts and .d.ts). */
function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('No raw SQL / RPC calls in the app source (SQL-injection surface stays at zero)', () => {
  const targetDirs = [join(__dirname, '..', 'features'), join(__dirname, '..', 'lib')];
  const files = targetDirs.flatMap(collectTsFiles);

  it('scans at least the known API files (sanity check the scan itself works)', () => {
    // Normalize to forward slashes -- `join()` uses the OS separator, which is
    // a backslash on Windows, so a plain endsWith('categories/api.ts') would
    // never match there.
    const normalized = files.map((f) => f.replace(/\\/g, '/'));
    expect(normalized.some((f) => f.endsWith('categories/api.ts'))).toBe(true);
    expect(normalized.some((f) => f.endsWith('movements/api.ts'))).toBe(true);
  });

  it.each(files.map((f) => [f] as const))('%s does not call supabase.rpc(...)', (file) => {
    const content = readFileSync(file, 'utf8');
    expect(content).not.toMatch(/\.rpc\s*\(/);
  });

  it.each(files.map((f) => [f] as const))('%s does not build a .from(...) table name via string concatenation', (file) => {
    const content = readFileSync(file, 'utf8');
    // Flags `.from(` followed by anything other than an immediate single- or
    // double-quoted literal -- e.g. `.from(userInput)` or `.from('x' + y)`
    // would match and fail; `.from('movements')` does not. Excludes
    // `Array.from(...)`, which is unrelated to Supabase's query builder and
    // is the only non-literal `.from(` call in this codebase (iconSuggestion.ts).
    const suspicious = /(?<!Array)\.from\(\s*(?!['"][^'"]*['"]\s*\))/;
    expect(content).not.toMatch(suspicious);
  });
});

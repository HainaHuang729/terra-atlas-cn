import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = resolve(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const files = walk(root);
let references = 0;
for (const file of files.filter(path => /\.(?:html|css)$/.test(path))) {
  const text = readFileSync(file, 'utf8');
  const urls = [
    ...text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g),
    ...text.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)
  ];
  for (const [, url] of urls) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) continue;
    if (url.startsWith('/')) throw new Error('Root-relative URL breaks project Pages: ' + url);
    const path = resolve(dirname(file), decodeURIComponent(url.split(/[?#]/)[0]));
    if (relative(root, path).startsWith('..' + sep) || !existsSync(path)) {
      throw new Error('Missing or unsafe local asset in ' + relative(root, file) + ': ' + url);
    }
    references++;
  }
}
const scripts = files.filter(path => path.endsWith('.js'));
for (const file of scripts) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
if (!existsSync(resolve(root, '.nojekyll'))) throw new Error('Missing Pages .nojekyll marker.');
console.log(`Static checks passed: ${files.length} files, ${references} relative references, ${scripts.length} JavaScript syntax checks.`);

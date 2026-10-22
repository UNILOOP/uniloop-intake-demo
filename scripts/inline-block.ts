// Joins a custom block entry and the local modules it imports into the single file the portal's block editor accepts.
// Usage: bun scripts/inline-block.ts <entry.tsx> <out.tsx>
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

// The portal accepts these imports only (docs/block-development.md, "What the portal accepts").
export const ALLOWED_IMPORT =
  /^(react|lucide-react|@\/packages\/survey-form-package\/src(\/.*)?)$/;

interface ImportSpec {
  defaultName?: string;
  namespace?: string;
  values: Set<string>;
  types: Set<string>;
}

interface Module {
  path: string;
  body: string;
  locals: string[];
}

const IMPORT = /^import\s+(type\s+)?([\s\S]*?)\s+from\s+'([^']+)';?[ \t]*\n/gm;
const DECLARATION =
  /^(?:export\s+)?(?:declare\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;

const fail = (message: string): never => {
  console.error(`inline-block: ${message}`);
  process.exit(1);
};

const resolveLocal = (from: string, source: string): string => {
  const base = resolve(dirname(from), source);
  const found = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
  ].find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  return found ?? fail(`cannot resolve '${source}' from ${from}`);
};

const parseSpecifiers = (
  clause: string,
  typeOnly: boolean,
  spec: ImportSpec,
  where: string,
) => {
  let rest = clause.trim();
  const named = rest.match(/\{([\s\S]*)\}/);
  if (named) rest = rest.replace(named[0], '').trim();
  for (const part of rest
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const namespace = part.match(/^\*\s+as\s+(\w+)$/);
    if (namespace && spec.namespace && spec.namespace !== namespace[1])
      fail(`two namespace names for one module in ${where}`);
    if (namespace) spec.namespace = namespace[1];
    else if (typeOnly) fail(`default type import in ${where} is not supported`);
    else if (spec.defaultName && spec.defaultName !== part)
      fail(`two default names for one module in ${where}`);
    else spec.defaultName = part;
  }
  for (const raw of (named?.[1] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const isType = typeOnly || raw.startsWith('type ');
    const name = raw.replace(/^type\s+/, '');
    if (/\sas\s/.test(name))
      fail(`renamed import '${name}' in ${where} is not supported`);
    (isType ? spec.types : spec.values).add(name);
  }
};

export const inlineBlock = (entryPath: string): string => {
  const entry = resolve(entryPath);
  const external = new Map<string, ImportSpec>();
  const ordered: Module[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();
  let header = '';

  const visit = (path: string) => {
    if (done.has(path)) return;
    if (visiting.has(path)) fail(`import cycle through ${path}`);
    visiting.add(path);
    let text = readFileSync(path, 'utf8');
    const where = relative(process.cwd(), path);
    const banner = text.match(/^\/\*[\s\S]*?\*\/\n/);
    if (banner) {
      if (!header.includes(banner[0])) header += banner[0];
      text = text.slice(banner[0].length);
    }
    const locals: string[] = [];
    text = text.replace(
      IMPORT,
      (
        _all,
        typeKeyword: string | undefined,
        clause: string,
        source: string,
      ) => {
        if (source.startsWith('.')) {
          locals.push(resolveLocal(path, source));
          return '';
        }
        if (!ALLOWED_IMPORT.test(source))
          fail(`'${source}' in ${where} is not an import the portal allows`);
        const spec = external.get(source) ?? {
          values: new Set<string>(),
          types: new Set<string>(),
        };
        parseSpecifiers(clause, Boolean(typeKeyword), spec, where);
        external.set(source, spec);
        return '';
      },
    );
    if (/^import\s/m.test(text))
      fail(`an import in ${where} has a form this script does not read`);
    // Forms the joined file can't keep: a re-export would leave a dangling `from`, and a destructured declaration
    // escapes the duplicate-name check.
    if (/^export\s+(?:\*|\{[^}]*\})\s*from\s/m.test(text))
      fail(
        `a re-export in ${where} is not supported; import and declare instead`,
      );
    if (/^(?:export\s+)?(?:const|let|var)\s+[{[]/m.test(text))
      fail(`a destructured top-level declaration in ${where} is not supported`);
    if (path !== entry && /^export\s+default\s+(?!\w+;?\s*$)/m.test(text))
      fail(
        `an inline default export in ${where} is not supported; declare it, then export its name`,
      );
    for (const local of locals) visit(local);
    if (path !== entry) {
      // Only the entry keeps its exports: everything else becomes a plain top-level declaration.
      text = text
        .replace(/^export\s+default\s+[\w$]+;?[ \t]*\n?/gm, '')
        .replace(/^export\s+\{[^}]*\};?[ \t]*\n?/gm, '')
        .replace(
          /^export\s+(?=(?:declare\s+)?(?:const|let|var|function|class|type|interface|enum)\s)/gm,
          '',
        );
    }
    const names = [...text.matchAll(DECLARATION)].map((match) => match[1]);
    ordered.push({ path, body: text.trim(), locals: names });
    visiting.delete(path);
    done.add(path);
  };

  visit(entry);

  const owners = new Map<string, string>();
  for (const module of ordered) {
    for (const name of module.locals) {
      const owner = owners.get(name);
      if (owner)
        fail(
          `'${name}' is declared in both ${relative(process.cwd(), owner)} and ${relative(process.cwd(), module.path)}`,
        );
      owners.set(name, module.path);
    }
  }
  for (const [source, spec] of external) {
    if (spec.namespace && spec.namespace === spec.defaultName)
      fail(
        `'${spec.namespace}' is both the namespace and the default import of '${source}'`,
      );
    for (const name of [
      ...spec.values,
      ...spec.types,
      spec.defaultName,
      spec.namespace,
    ]) {
      if (name && owners.has(name))
        fail(`'${name}' is both imported and declared`);
    }
    for (const name of spec.values) spec.types.delete(name);
  }

  const importLines: string[] = [];
  for (const [source, spec] of external) {
    const values = [...spec.values].sort((a, b) => a.localeCompare(b));
    const types = [...spec.types].sort((a, b) => a.localeCompare(b));
    if (spec.namespace)
      importLines.push(`import * as ${spec.namespace} from '${source}';`);
    const named = values.length ? `{ ${values.join(', ')} }` : '';
    const head = [spec.defaultName, named].filter(Boolean).join(', ');
    if (head) importLines.push(`import ${head} from '${source}';`);
    if (types.length)
      importLines.push(`import type { ${types.join(', ')} } from '${source}';`);
  }

  return `${header}\n${importLines.join('\n')}\n\n${ordered.map((module) => module.body).join('\n\n')}\n`;
};

if (import.meta.main) {
  const [entry, out] = process.argv.slice(2);
  if (!entry || !out)
    fail('usage: bun scripts/inline-block.ts <entry.tsx> <out.tsx>');
  writeFileSync(out, inlineBlock(entry));
  console.log(`inline-block: ${relative(process.cwd(), out)}`);
}

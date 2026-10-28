// Checks a generated block file against the portal's Validate Code rules before it is pasted into the block editor.
// Usage: bun scripts/check-block-rules.ts <block.tsx> [...]
import { readFileSync } from 'node:fs';
import { ALLOWED_IMPORT } from './inline-block';

export const blockRuleProblems = (text: string): string[] => {
  const problems: string[] = [];
  // Validate Code matches plain text, comments included.
  const hex = text.match(/#[0-9a-fA-F]{3,8}\b/g);
  if (hex) problems.push(`hex colours: ${[...new Set(hex)].join(', ')}`);
  if (/rgba\(/.test(text)) problems.push('an rgba( colour');
  if (!/\btheme\.[A-Za-z]/.test(text))
    problems.push('no property read from a variable named `theme`');
  if (!/\btype:\s*'[A-Za-z][\w-]*'/.test(text))
    problems.push("no `type: '<literal>'` in the block definition");
  for (const match of text.matchAll(/^import\s[\s\S]*?\sfrom\s+'([^']+)'/gm)) {
    if (!ALLOWED_IMPORT.test(match[1]))
      problems.push(`import outside the allowed list: '${match[1]}'`);
  }
  return problems;
};

// Bun sets import.meta.main when the file is run directly; Next's DOM typings don't declare it.
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const files = process.argv.slice(2);
  let failed = false;
  for (const file of files) {
    const problems = blockRuleProblems(readFileSync(file, 'utf8'));
    for (const problem of problems) console.error(`${file}: ${problem}`);
    failed ||= problems.length > 0;
  }
  if (failed) process.exit(1);
  console.log(`check-block-rules: ${files.length} file(s) pass`);
}

// Builds each portal block from its entry and shared pieces into portal-blocks/, then checks the portal's rules.
// Usage: bun scripts/build-portal-blocks.ts   (typecheck the output with tsconfig.blocks.json)
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { blockRuleProblems } from './check-block-rules';
import { inlineBlock } from './inline-block';

const ENTRIES = [
  'src/app/emr-demo/custom-blocks/SinglePageCheckoutBlock.tsx',
  'src/app/emr-demo/custom-blocks/CheckoutSelectionBlock.tsx',
  'src/app/emr-demo/custom-blocks/CheckoutShippingBlock.tsx',
  'src/app/emr-demo/custom-blocks/CheckoutPaymentBlock.tsx',
  'src/app/emr-demo/custom-blocks/UpsellOfferBlock.tsx',
];

mkdirSync('portal-blocks', { recursive: true });
let failed = false;
for (const entry of ENTRIES) {
  const out = `portal-blocks/${basename(entry)}`;
  const text = inlineBlock(entry);
  writeFileSync(out, text);
  const problems = blockRuleProblems(text);
  for (const problem of problems) console.error(`${out}: ${problem}`);
  failed ||= problems.length > 0;
  console.log(`${out}: ${text.split('\n').length} lines`);
}
if (failed) process.exit(1);

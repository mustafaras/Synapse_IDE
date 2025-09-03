#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const datasetPath = process.argv[2] || 'src/eval/datasets/examples/basic.yaml';
const outDir = process.argv[3] || 'eval_reports';

function requireHarness() {
  try {
    return require('../../dist/eval/harness');
  } catch (e) {
    console.error('Eval harness not found in dist. Run "npm run build" first.');
    process.exit(2);
  }
}

const { runDataset } = requireHarness();

const opts = {
  provider: process.env.EVAL_PROVIDER || 'openai',
  model: process.env.EVAL_MODEL || 'gpt-4o-mini',
  temperature: 0,
  maxTokens: 512,
  languageId: process.env.EVAL_LANG || 'typescript',
  live: process.env.EVAL_LIVE === '1',
  cassetteDir: '.eval_cassettes',
};

const yaml = fs.readFileSync(datasetPath, 'utf8');
runDataset(yaml, opts)
  .then(({ result, junit, md }) => {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'junit.xml'), junit);
    fs.writeFileSync(path.join(outDir, 'summary.md'), md);
    console.log(md);
    const minPass = Number(process.env.EVAL_MIN_PASS || '0.85');
    const hardFails = (process.env.EVAL_HARD_FAILS || '').split(',').filter(Boolean);
    const ratio = result.passed / result.total;
    const hasHardFail = hardFails.some((id) => result.failIds.includes(id));
    if (ratio < minPass || hasHardFail) {
      console.error(`Quality gate failed: pass=${(ratio * 100).toFixed(1)}% hardFail=${hasHardFail}`);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

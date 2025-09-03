#!/usr/bin/env node
process.env.EVAL_LIVE = '1';
process.env.EVAL_MIN_PASS = '0';
require('./run.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('question form options textarea refreshes answer candidates on input', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../static/index.html'), 'utf8');
  const textareaMatch = html.match(/<textarea[^>]*id="qform-options"[^>]*>/);

  assert.ok(textareaMatch, 'qform-options textarea should exist');
  assert.match(textareaMatch[0], /oninput="onQFormTypeChange\(\)"/);
});

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const report = JSON.parse(await readFile(new URL('../audit/report.json', import.meta.url), 'utf8'));
const index = JSON.parse(await readFile(new URL('../.unspa.json', import.meta.url), 'utf8')).index;
const files = new Map();
for (const [file, baseline] of Object.entries(report.sourceManifest)) {
  const content = await readFile(new URL('../' + file, import.meta.url), 'utf8');
  assert.equal(createHash('sha256').update(content).digest('hex'), baseline.sha256, file + ' changed since the audit. Review and resync its evidence.');
  files.set(file, content);
}
for (const [key, entry] of Object.entries(index)) {
  assert.equal(entry.status, 'implemented', key + ' is not mapped.');
  assert.ok(entry.signature && entry.specVersion, key + ' has no captured code or specification version.');
  const primary = files.get(entry.file);
  assert.ok(primary?.split('\n')[entry.line - 1]?.trim().startsWith(entry.signature.trim()), key + ' has a stale primary signature.');
  assert.ok(entry.locations.length, key + ' has no evidence.');
  for (const location of entry.locations) {
    const content = files.get(location.file);
    assert.ok(content !== undefined, key + ' references a file outside the audited baseline.');
    assert.ok(location.startOffset >= 0 && location.endOffset > location.startOffset && location.endOffset <= content.length, key + ' has an invalid code span.');
    assert.equal(content.slice(0, location.startOffset).split('\n').length, location.line, key + ' has a stale line number.');
    assert.ok(location.sourceId, key + ' has no captured Studio source.');
    assert.equal(createHash('sha256').update(content.slice(location.startOffset, location.endOffset)).digest('hex'), location.spanSha256, key + ' has stale snippet evidence.');
  }
}
for (const entry of report.codeToSpec.inventory) {
  assert.ok(['mapped', 'architecture', 'verification', 'pending_spec'].includes(entry.disposition), 'Unclassified implementation entry: ' + entry.name);
  if (entry.disposition === 'mapped') assert.ok(entry.featureIds.length, entry.name + ' has no feature mapping.');
  if (entry.disposition === 'pending_spec') assert.ok(entry.reason, entry.name + ' needs an explicit reason for pending specification.');
}
console.log('Audit evidence is current: ' + files.size + ' source hashes, ' + Object.keys(index).length + ' index entries, ' + report.codeToSpec.count + ' classified implementation entries.');
console.log('This checks evidence freshness and completeness; run npm test and the browser smoke script to verify behavior.');
if (report.remoteSync?.status !== 'synced') console.log('Studio specification sync is pending: ' + (report.remoteSync?.reason || 'not verified') + '. Local reference validity does not prove remote specification coverage.');

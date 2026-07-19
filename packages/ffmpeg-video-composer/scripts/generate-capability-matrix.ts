import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCapabilityMatrix } from './capability-sources';
// Side-effecting import: writes device-filters.generated.ts, so one `generate:capabilities` run
// refreshes both the doc and the TS device filter set.
import './generate-device-filters';

const here = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.resolve(here, '../../../docs/runtime-capabilities.md');

fs.writeFileSync(docPath, renderCapabilityMatrix());
console.log(`wrote ${docPath}`);

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function verifyLatestWindow(label, source, table) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const queryPattern = new RegExp(
    `\\.from\\(["']${escapedTable}["']\\)[\\s\\S]*?` +
      `\\.order\\(["']created_at["'],\\s*\\{\\s*ascending:\\s*false\\s*\\}\\)` +
      `[\\s\\S]*?\\.limit\\(250\\)`,
  );

  if (!queryPattern.test(source)) {
    failures.push(`${label} must fetch the newest 250 messages from the server.`);
  }

  if (!/const nextMessages = \(\(data \?\? \[\]\) as MessageRow\[\]\)\.slice\(\)\.reverse\(\);/.test(source)) {
    failures.push(`${label} must restore chronological display order after the newest-first query.`);
  }
}

verifyLatestWindow('Crew Chat', read('app/crew-chat.tsx'), 'crew_messages');
verifyLatestWindow('Event Chat', read('app/event-chat.tsx'), 'event_messages');

if (failures.length) {
  console.error('NOXA chat latest-window contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('NOXA chat latest-window contract passed.');

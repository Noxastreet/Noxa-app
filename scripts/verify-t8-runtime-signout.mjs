import fs from 'node:fs';

const rootLayout = fs.readFileSync('app/_layout.tsx', 'utf8');

const required = [
  "supabase.auth.onAuthStateChange",
  "event !== 'SIGNED_OUT'",
  'resetToSignedOutHome()',
  '<AuthSessionBoundary />',
];

for (const snippet of required) {
  if (!rootLayout.includes(snippet)) {
    console.error(`T8 runtime signout contract: FAIL — missing ${snippet}`);
    process.exit(1);
  }
}

if (!rootLayout.includes('return () => subscription.unsubscribe();')) {
  console.error('T8 runtime signout contract: FAIL — auth subscription is not cleaned up');
  process.exit(1);
}

console.log('T8 runtime signout contract: PASS');

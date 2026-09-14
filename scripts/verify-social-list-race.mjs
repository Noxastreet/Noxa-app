import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const source = fs.readFileSync('app/social-list.tsx', 'utf8');

assert(source.includes('useRef'), 'Social list must use a stable request-generation ref.');
assert(source.includes('const loadRequestIdRef = useRef(0);'), 'Social list must keep a request generation counter.');
assert(source.includes('const requestId = ++loadRequestIdRef.current;'), 'Every social load must receive a new request id.');
assert(source.includes('const requestedTab = activeTab;'), 'Each social load must snapshot the requested tab.');
assert(source.includes('const isCurrentRequest = () => requestId === loadRequestIdRef.current;'), 'Social list must expose a current-request guard.');
assert((source.match(/if \(!isCurrentRequest\(\)\) return;/g) ?? []).length >= 4, 'Social list must guard state commits after each awaited network stage.');
assert(source.includes('requestedTab === "followers"'), 'Follow queries and row mapping must use the tab snapshot, not mutable UI state.');
assert(!/return activeTab === "followers"\s*\? followRow\.follower_id/.test(source), 'Profile id mapping must not read mutable activeTab after network waits.');

if (!process.exitCode) {
  console.log('Social list stale-response contract passed.');
}

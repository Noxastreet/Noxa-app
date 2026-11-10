import assert from 'node:assert/strict';
import { driverBroadcastFixtureSql } from '../lib/driver-broadcast-fixture.mjs';

assert.equal(process.env.NOXA_BROADCAST_TEST_ISOLATED, '1');
// SQL goes to a file inside RUNNER_TEMP, then to the disposable local stack.
process.stdout.write(driverBroadcastFixtureSql({ realRealtime: true }));

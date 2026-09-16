#!/usr/bin/env node
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const HOUR = 3_600_000;
const MINUTE = 60_000;

const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const hours = (h) => at(h * HOUR);
const minutes = (m) => at(m * MINUTE);

let sequence = 0;
const unique = () =>
  `${Date.now().toString(36)}-${(sequence++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  return { status: response.status, body: parsed };
}

async function fixture() {
  const room = await call('POST', '/rooms', { name: `room-${unique()}`, capacity: 6 });
  const user = await call('POST', '/users', {
    name: 'Audit',
    email: `audit-${unique()}@example.com`,
  });
  return { roomId: room.body?.id, userId: user.body?.id };
}

async function book(ids, fromHours, toHours, title = 'Audit') {
  return call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title,
    startsAt: hours(fromHours),
    endsAt: hours(toHours),
  });
}

const checks = [];
const check = (id, rule, name, fn) => checks.push({ id, rule, name, fn });

const hasErrorEnvelope = (body) =>
  Boolean(
    body &&
      typeof body === 'object' &&
      body.error &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string' &&
      body.error.details !== undefined,
  );

check('1.1', 1, 'new start falls inside an existing booking', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 24.5, 25.5);
  return { expected: 409, actual: response.status };
});

check('1.2', 1, 'new end falls inside an existing booking', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 23.5, 24.5);
  return { expected: 409, actual: response.status };
});

check('1.3', 1, 'new booking engulfs an existing one', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 23, 26);
  return { expected: 409, actual: response.status };
});

check('1.4', 1, 'new booking contained in an existing one', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 24.1, 24.85);
  return { expected: 409, actual: response.status };
});

check('1.5', 1, 'new booking starts exactly when another ends', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 25, 26);
  return { expected: 201, actual: response.status };
});

check('1.6', 1, 'new booking ends exactly when another starts', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 23, 24);
  return { expected: 201, actual: response.status };
});

check('1.7', 1, 'same period in a different room', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const other = await call('POST', '/rooms', { name: `room-${unique()}`, capacity: 4 });
  const response = await call('POST', '/bookings', {
    roomId: other.body?.id,
    userId: ids.userId,
    title: 'Audit',
    startsAt: hours(24),
    endsAt: hours(25),
  });
  return { expected: 201, actual: response.status };
});

check('1.8', 1, 'update moves a booking on top of another', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const moved = await book(ids, 30, 31);
  const response = await call('PATCH', `/bookings/${moved.body?.id}`, {
    startsAt: hours(24.1),
    endsAt: hours(24.85),
  });
  return { expected: 409, actual: response.status };
});

check('1.9', 1, 'update that does not move the times', async () => {
  const ids = await fixture();
  const created = await book(ids, 24, 25);
  const response = await call('PATCH', `/bookings/${created.body?.id}`, { title: 'Renamed' });
  return { expected: 200, actual: response.status };
});

check('1.10', 1, 'update moves a booking to a free slot', async () => {
  const ids = await fixture();
  const created = await book(ids, 24, 25);
  const response = await call('PATCH', `/bookings/${created.body?.id}`, {
    startsAt: hours(40),
    endsAt: hours(41),
  });
  return { expected: 200, actual: response.status };
});

async function main() {
  try {
    await fetch(`${BASE}/health`);
  } catch (error) {
    process.stderr.write(`cannot reach ${BASE}: ${error.message}\n`);
    process.exit(2);
  }

  const results = [];
  for (const { id, rule, name, fn } of checks) {
    let expected = null;
    let actual = null;
    try {
      ({ expected, actual } = await fn());
    } catch (error) {
      actual = `threw: ${error.message}`;
    }
    const passed = JSON.stringify(expected) === JSON.stringify(actual);
    results.push({ id, rule, name, expected, actual, passed });
  }

  const byRule = {};
  for (const result of results) {
    byRule[result.rule] ??= { passed: 0, total: 0 };
    byRule[result.rule].total += 1;
    if (result.passed) byRule[result.rule].passed += 1;
  }

  const passed = results.filter((result) => result.passed).length;
  const summary = {
    task: 'T1',
    total: results.length,
    passed,
    rate: results.length === 0 ? 0 : Number((passed / results.length).toFixed(4)),
    byRule,
    failures: results
      .filter((result) => !result.passed)
      .map(({ id, rule, name, expected, actual }) => ({ id, rule, name, expected, actual })),
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(0);
}

await main();

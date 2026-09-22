#!/usr/bin/env node
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const HOUR = 3_600_000;
const MINUTE = 60_000;

const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const hours = (h) => at(h * HOUR);
const minutes = (m) => at(m * MINUTE);
// Same as `hours`, but offset from a caller-supplied anchor instant instead
// of a fresh Date.now() read. Two checks (1.5 and 1.6) need a second
// booking's boundary to land on the exact millisecond of a first booking's
// boundary; computing each independently races against the real network and
// database latency between the two HTTP calls, which shifts the boundary by
// a few milliseconds in whichever direction the calls happen to drift.
const hoursFrom = (anchor, h) => new Date(anchor + h * HOUR).toISOString();

let sequence = 0;
const unique = () =>
  `${Date.now().toString(36)}-${(sequence++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    // Only set the JSON content-type when there is a body. Sending it on a
    // bodyless request (e.g. the cancel endpoint) trips an unrelated seed
    // defect: an empty body with this header is rejected by Fastify's
    // default JSON parser with an error the seed's error handler does not
    // recognise, so it falls through to a 500 that has nothing to do with
    // the rule under test.
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
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

async function book(ids, fromHours, toHours, title = 'Audit', anchor) {
  return call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title,
    startsAt: anchor === undefined ? hours(fromHours) : hoursFrom(anchor, fromHours),
    endsAt: anchor === undefined ? hours(toHours) : hoursFrom(anchor, toHours),
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
  const anchor = Date.now();
  await book(ids, 24, 25, 'Audit', anchor);
  const response = await book(ids, 25, 26, 'Audit', anchor);
  return { expected: 201, actual: response.status };
});

check('1.6', 1, 'new booking ends exactly when another starts', async () => {
  const ids = await fixture();
  const anchor = Date.now();
  await book(ids, 24, 25, 'Audit', anchor);
  const response = await book(ids, 23, 24, 'Audit', anchor);
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

check('2.1', 2, 'create over the range of a cancelled booking', async () => {
  const ids = await fixture();
  const first = await book(ids, 24, 25);
  await call('POST', `/bookings/${first.body?.id}/cancel`);
  const response = await book(ids, 24.5, 25.5);
  return { expected: 201, actual: response.status };
});

check('2.2', 2, 'update into the range of a cancelled booking', async () => {
  const ids = await fixture();
  const first = await book(ids, 24, 25);
  await call('POST', `/bookings/${first.body?.id}/cancel`);
  const moved = await book(ids, 40, 41);
  const response = await call('PATCH', `/bookings/${moved.body?.id}`, {
    startsAt: hours(24.1),
    endsAt: hours(24.85),
  });
  return { expected: 200, actual: response.status };
});

check('3.1', 3, 'create a booking that starts in the past', async () => {
  const ids = await fixture();
  const response = await book(ids, -48, -47);
  return { expected: 400, actual: response.status };
});

check('3.2', 3, 'update a booking to start in the past', async () => {
  const ids = await fixture();
  const created = await book(ids, 24, 25);
  const response = await call('PATCH', `/bookings/${created.body?.id}`, {
    startsAt: hours(-48),
    endsAt: hours(-47),
  });
  return { expected: 400, actual: response.status };
});

check('3.3', 3, 'create a booking that starts in the future', async () => {
  const ids = await fixture();
  const response = await book(ids, 24, 25);
  return { expected: 201, actual: response.status };
});

check('4.1', 4, 'exactly thirty minutes is accepted', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: minutes(24 * 60),
    endsAt: minutes(24 * 60 + 30),
  });
  return { expected: 201, actual: response.status };
});

check('4.2', 4, 'twenty-nine minutes is rejected', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: minutes(24 * 60),
    endsAt: minutes(24 * 60 + 29),
  });
  return { expected: 400, actual: response.status };
});

check('4.3', 4, 'exactly eight hours is accepted', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: minutes(24 * 60),
    endsAt: minutes(24 * 60 + 8 * 60),
  });
  return { expected: 201, actual: response.status };
});

check('4.4', 4, 'eight hours and one minute is rejected', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: minutes(24 * 60),
    endsAt: minutes(24 * 60 + 8 * 60 + 1),
  });
  return { expected: 400, actual: response.status };
});

check('5.1', 5, 'end before start is rejected', async () => {
  const ids = await fixture();
  const response = await book(ids, 25, 24);
  return { expected: 400, actual: response.status };
});

check('5.2', 5, 'end equal to start is rejected', async () => {
  const ids = await fixture();
  const response = await book(ids, 24, 24);
  return { expected: 400, actual: response.status };
});

check('6.1', 6, 'create referencing a room that does not exist', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: `missing-${unique()}`,
    userId: ids.userId,
    title: 'Audit',
    startsAt: hours(24),
    endsAt: hours(25),
  });
  return { expected: 404, actual: response.status };
});

check('6.2', 6, 'create referencing a user that does not exist', async () => {
  const ids = await fixture();
  const response = await call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: `missing-${unique()}`,
    title: 'Audit',
    startsAt: hours(24),
    endsAt: hours(25),
  });
  return { expected: 404, actual: response.status };
});

check('6.3', 6, 'update referencing a room that does not exist', async () => {
  const ids = await fixture();
  const created = await book(ids, 24, 25);
  const response = await call('PATCH', `/bookings/${created.body?.id}`, {
    roomId: `missing-${unique()}`,
  });
  return { expected: 404, actual: response.status };
});

check('7.1', 7, 'the conflict error keeps the existing envelope and code', async () => {
  const ids = await fixture();
  await book(ids, 24, 25);
  const response = await book(ids, 24.5, 25.5);
  return {
    expected: { status: 409, envelope: true, code: 'BOOKING_CONFLICT' },
    actual: {
      status: response.status,
      envelope: hasErrorEnvelope(response.body),
      code: response.body?.error?.code ?? null,
    },
  };
});

check('7.2', 7, 'a rule 3 or 4 rejection keeps the existing envelope', async () => {
  const ids = await fixture();
  const response = await book(ids, -48, -47);
  return {
    expected: { status: 400, envelope: true },
    actual: { status: response.status, envelope: hasErrorEnvelope(response.body) },
  };
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

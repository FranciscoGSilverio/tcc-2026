import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const HOUR = 3_600_000;

const at = (hours) => new Date(Date.now() + hours * HOUR).toISOString();

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const unique = () => Math.random().toString(36).slice(2, 10);

async function fixture() {
  const room = await call('POST', '/rooms', { name: `Room-${unique()}`, capacity: 6 });
  const user = await call('POST', '/users', {
    name: 'Audit',
    email: `audit-${unique()}@example.com`,
  });
  return { roomId: room.body.id, userId: user.body.id };
}

const book = (ids, from, to) =>
  call('POST', '/bookings', {
    roomId: ids.roomId,
    userId: ids.userId,
    title: 'Audit',
    startsAt: at(from),
    endsAt: at(to),
  });

const checks = [
  ['end falls inside an existing booking and start is before it', async () => {
    const ids = await fixture();
    await book(ids, 24, 25);
    assert.equal((await book(ids, 23.5, 24.5)).status, 201);
  }],
  ['new booking engulfs an existing one', async () => {
    const ids = await fixture();
    await book(ids, 24, 25);
    assert.equal((await book(ids, 23, 26)).status, 201);
  }],
  ['update moves a booking on top of another', async () => {
    const ids = await fixture();
    await book(ids, 24, 25);
    const moved = await book(ids, 30, 31);
    const response = await call('PATCH', `/bookings/${moved.body.id}`, {
      startsAt: at(24.25),
      endsAt: at(24.75),
    });
    assert.equal(response.status, 200);
  }],
  ['booking that starts in the past', async () => {
    const ids = await fixture();
    assert.equal((await book(ids, -48, -47)).status, 201);
  }],
  ['booking shorter than thirty minutes', async () => {
    const ids = await fixture();
    assert.equal((await book(ids, 24, 24.1)).status, 201);
  }],
  ['booking longer than eight hours', async () => {
    const ids = await fixture();
    assert.equal((await book(ids, 24, 34)).status, 201);
  }],
  ['booking whose end is before its start', async () => {
    const ids = await fixture();
    assert.equal((await book(ids, 25, 24)).status, 201);
  }],
  ['booking that points at a room that does not exist', async () => {
    const ids = await fixture();
    const response = await call('POST', '/bookings', {
      roomId: 'missing-room',
      userId: ids.userId,
      title: 'Audit',
      startsAt: at(24),
      endsAt: at(25),
    });
    assert.equal(response.status, 500);
  }],
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

console.log(failed === 0 ? '\nall expected gaps are present' : `\n${failed} expected gaps missing`);
process.exit(failed === 0 ? 0 : 1);

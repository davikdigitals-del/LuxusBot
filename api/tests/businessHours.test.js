import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();

const { isBusinessHours, formatBusinessHours, formatNextBusinessOpening } = await import('../src/utils/helpers.js');
const { default: AIEngine } = await import('../src/core/ai/aiEngine.js');

// A fixed, known moment for deterministic assertions: Wednesday, 10:00 UTC
const WEDNESDAY_10AM_UTC = new Date('2026-09-23T10:00:00Z'); // 2026-09-23 is a Wednesday

const withFixedClock = async (date, fn) => {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(date);
      return new RealDate(...args);
    }
    static now() { return date.getTime(); }
  }
  global.Date = FixedDate;
  try {
    await fn();
  } finally {
    global.Date = RealDate;
  }
};

test('tenant shape: disabled hours are always "available" (never blocks the AI)', async () => {
  await withFixedClock(WEDNESDAY_10AM_UTC, () => {
    assert.equal(isBusinessHours({ enabled: false, timezone: 'UTC', schedule: {} }), true);
  });
});

test('tenant shape: enabled hours - inside today\'s window is business hours, outside is not', async () => {
  await withFixedClock(WEDNESDAY_10AM_UTC, () => {
    const inHours = {
      enabled: true,
      timezone: 'UTC',
      schedule: { wednesday: { start: '09:00', end: '18:00', enabled: true } },
    };
    assert.equal(isBusinessHours(inHours), true);

    const outOfHours = {
      enabled: true,
      timezone: 'UTC',
      schedule: { wednesday: { start: '12:00', end: '18:00', enabled: true } },
    };
    assert.equal(isBusinessHours(outOfHours), false);
  });
});

test('tenant shape: a day with enabled:false, or no entry at all, is treated as closed', async () => {
  await withFixedClock(WEDNESDAY_10AM_UTC, () => {
    assert.equal(isBusinessHours({ enabled: true, timezone: 'UTC', schedule: { wednesday: { start: '09:00', end: '18:00', enabled: false } } }), false);
    assert.equal(isBusinessHours({ enabled: true, timezone: 'UTC', schedule: {} }), false);
  });
});

test('legacy flat shape still works unchanged (platform default fallback)', async () => {
  await withFixedClock(WEDNESDAY_10AM_UTC, () => {
    // Wed = day 3; '1,2,3,4,5' = Mon-Fri
    assert.equal(isBusinessHours({ start: '09:00', end: '18:00', timezone: 'UTC', days: '1,2,3,4,5' }), true);
    assert.equal(isBusinessHours({ start: '09:00', end: '18:00', timezone: 'UTC', days: '0,6' }), false); // weekends only
    assert.equal(isBusinessHours({ start: '12:00', end: '18:00', timezone: 'UTC', days: '1,2,3,4,5' }), false); // right day, wrong time
  });
});

test('formatBusinessHours describes both shapes in plain language, matching isBusinessHours', async () => {
  await withFixedClock(WEDNESDAY_10AM_UTC, () => {
    assert.equal(formatBusinessHours({ enabled: false, timezone: 'UTC', schedule: {} }), 'no fixed hours');
    assert.match(
      formatBusinessHours({ enabled: true, timezone: 'UTC', schedule: { wednesday: { start: '09:00', end: '18:00', enabled: true } } }),
      /09:00 - 18:00 UTC/
    );
    assert.match(
      formatBusinessHours({ enabled: true, timezone: 'UTC', schedule: {} }),
      /closed today/
    );
    assert.equal(formatBusinessHours({ start: '09:00', end: '18:00', timezone: 'UTC', days: '1,2,3,4,5' }), '09:00 - 18:00 UTC');
  });
});

test('next opening notice uses today or the next enabled business day and its configured start time', async () => {
  await withFixedClock(new Date('2026-09-23T19:00:00Z'), () => {
    const tomorrowSchedule = {
      thursday: { start: '09:15', end: '17:00', enabled: true },
    };
    assert.equal(
      formatNextBusinessOpening({ enabled: true, timezone: 'UTC', schedule: tomorrowSchedule }),
      "We're closed for today. Please come back tomorrow at 9:15 AM (UTC)."
    );

    const schedule = {
      wednesday: { start: '09:00', end: '17:00', enabled: true },
      thursday: { start: '09:00', end: '17:00', enabled: false },
      friday: { start: '10:30', end: '18:00', enabled: true },
    };
    assert.equal(
      formatNextBusinessOpening({ enabled: true, timezone: 'UTC', schedule }),
      "We're closed today. Please come back Friday at 10:30 AM (UTC)."
    );
  });

  await withFixedClock(new Date('2026-09-23T10:00:00Z'), () => {
    const schedule = { wednesday: { start: '12:00', end: '18:00', enabled: true } };
    assert.equal(
      formatNextBusinessOpening({ enabled: true, timezone: 'UTC', schedule }),
      "We're currently closed. We open today at 12:00 PM (UTC)."
    );
  });
});

test('AI response appends the business custom after-hours message', async () => {
  await withFixedClock(WEDNESDAY_10AM_UTC, () => {
    const engine = new AIEngine();
    const response = engine.processResponse(
      { text: 'Thanks for contacting us.', provider: 'anthropic' },
      {},
      {
        enabled: true,
        timezone: 'UTC',
        schedule: { wednesday: { start: '12:00', end: '18:00', enabled: true } },
        outOfHoursMessage: 'Our team opens at noon. We will reply as soon as we are back.',
      }
    );

    assert.equal(
      response.text,
      "Thanks for contacting us.\n\nOur team opens at noon. We will reply as soon as we are back.\n\nWe're currently closed. We open today at 12:00 PM (UTC)."
    );
  });
});

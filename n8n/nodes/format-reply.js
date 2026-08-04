// ─────────────────────────────────────────────────────────────────────────────
// Format Reply — turns the API response into a Telegram message and updates
// the session (tokens after login, numbered lists after every listing).
// n8n Code node · mode "Run Once for All Items" · JavaScript
// ─────────────────────────────────────────────────────────────────────────────

const store = $getWorkflowStaticData('global');
if (!store.sessions) store.sessions = {};

const plan = $('Router').first().json;
const response = $input.first().json || {};
const status = Number(response.statusCode) || 0;
const payload = response.body || {};
const result = payload.result;

const session = store.sessions[plan.chatId] || { stage: 'idle', draft: {} };
if (!session.draft) session.draft = {};

const esc = (value) =>
  String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const money = (value) => Number(value || 0).toLocaleString('en-US');

// Drops the conditional `null` entries while keeping '' — those are the blank
// lines that give the message its paragraphs.
const lines = (parts) =>
  parts.filter((part) => part !== null && part !== undefined).join('\n');

const shortDate = (value) => String(value || '').slice(0, 10);

const done = (reply) => {
  store.sessions[plan.chatId] = session;
  return [{ json: { chatId: plan.chatId, intent: plan.intent, reply } }];
};

// ── Errors ───────────────────────────────────────────────────────────────────
// No status at all means the HTTP node never got a reply — API down, wrong host.
if (!status) {
  return done('📡 I could not reach the booking service. Please try again in a moment.');
}

if (status < 200 || status >= 300) {
  const meta = payload.meta || {};

  // Errors are rendered through HttpDetailResponse, which folds `message` into
  // `meta` — so the human-readable text is at meta.message, not the top level.
  const apiMessage =
    meta.message || payload.message || 'The booking service refused that.';

  // 422 from ValidationMiddleware carries meta.payload; a raw ZodError carries meta.errors.
  const fieldErrors = meta.payload && typeof meta.payload === 'object' ? meta.payload : null;
  const details = fieldErrors
    ? Object.entries(fieldErrors)
        .map(([field, errors]) => '• ' + field + ': ' + [].concat(errors).join(', '))
        .filter(Boolean)
    : Array.isArray(meta.errors)
      ? meta.errors.map(
          (issue) =>
            '• ' +
            (Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') + ': ' : '') +
            issue.message
        )
      : [];

  // errorKinds.notAuthorized maps to 401 but invalidToken maps to 403, and a
  // plain permission denial is 403 too — so tell them apart by the message.
  const sessionDead =
    status === 401 || (status === 403 && /token|not authenticated/i.test(apiMessage));

  if (sessionDead) {
    delete session.accessToken;
    delete session.refreshToken;
    delete session.expiresAt;
    delete session.user;
    session.stage = 'idle';
    return done('🔒 ' + esc(apiMessage) + '\nPlease /login again.');
  }

  if (status === 429) {
    return done('🐢 Too many requests — the API allows 100 per 15 minutes. Try again shortly.');
  }

  const heading =
    status === 403 ? '⛔ ' : status === 404 ? '🔍 ' : status === 409 ? '🚫 ' : status >= 500 ? '💥 ' : '⚠️ ';

  // A 409 on a booking is an availability clash, not a mistake in their input.
  const hint =
    status === 409 && plan.intent === 'bookings.create'
      ? 'Those dates are taken. Run /hotel again and book with different dates.'
      : null;

  return done(
    lines(
      [heading + esc(apiMessage)]
        .concat(details.length ? [''].concat(details.map(esc)) : [])
        .concat(hint ? ['', hint] : [])
    )
  );
}

// ── Auth ─────────────────────────────────────────────────────────────────────
if (plan.intent === 'auth.login' || plan.intent === 'auth.register') {
  session.accessToken = result.accessToken;
  session.refreshToken = result.refreshToken;
  session.expiresAt = Date.now() + (plan.accessTokenTtlMs || 14 * 60 * 1000);
  session.user = result.user;
  session.stage = 'idle';
  session.draft = {};

  const verb = plan.intent === 'auth.register' ? 'Account created' : 'Signed in';
  return done(
    lines([
      '✅ <b>' + verb + '</b> — welcome, ' + esc(result.user.firstName) + '!',
      'Role: <code>' + esc(result.user.role) + '</code>',
      '',
      'Next: /hotels to browse, /mybookings to review what you have.',
    ])
  );
}

if (plan.intent === 'auth.me') {
  session.user = result;
  return done(
    lines([
      '👤 <b>' + esc(result.firstName) + ' ' + esc(result.lastName) + '</b>',
      '📧 ' + esc(result.email),
      '🔖 role <code>' + esc(result.role) + '</code>',
      result.phoneNumber ? '📞 ' + esc(result.phoneNumber) : null,
    ])
  );
}

// ── Hotels ───────────────────────────────────────────────────────────────────
if (plan.intent === 'hotels.list') {
  const hotels = Array.isArray(result) ? result : [];
  session.hotels = hotels.map((hotel) => ({
    id: hotel.id,
    name: hotel.name,
    city: hotel.city,
  }));

  if (!hotels.length) {
    return done(
      plan.ctx.city
        ? '🔍 No hotels in <b>' + esc(plan.ctx.city) + '</b>. Try /hotels with no filter.'
        : '🔍 No hotels yet.'
    );
  }

  const total = Number(payload.count || hotels.length);
  const pageSize = plan.ctx.pageSize || hotels.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const hotelLines = hotels.map((hotel, i) => {
    const stars = hotel.rating ? ' ⭐ ' + hotel.rating : '';
    return (
      i + 1 + '. <b>' + esc(hotel.name) + '</b>' + stars +
      '\n    ' + esc(hotel.city) + ', ' + esc(hotel.country)
    );
  });

  return done(
    lines([
      '🏨 <b>Hotels</b> — page ' + plan.ctx.page + ' of ' + lastPage + ' (' + total + ' total)',
      plan.ctx.city ? '<i>filtered by city: ' + esc(plan.ctx.city) + '</i>' : null,
      '',
      hotelLines.join('\n'),
      '',
      'Open one with <code>/hotel 1</code>' +
        (plan.ctx.page < lastPage
          ? ', next page <code>/hotels ' +
            esc([plan.ctx.city, plan.ctx.page + 1].filter(Boolean).join(' ')) +
            '</code>'
          : ''),
    ])
  );
}

if (plan.intent === 'hotel.detail') {
  const hotel = result;
  const typesById = {};
  for (const type of hotel.roomTypes || []) typesById[type.id] = type;

  const rooms = (hotel.rooms || [])
    .slice()
    .sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), 'en', { numeric: true }))
    .slice(0, 10)
    .map((room) => {
      const type = typesById[room.roomTypeId] || {};
      return {
        id: room.id,
        hotelId: hotel.id,
        hotelName: hotel.name,
        label: 'Room ' + room.roomNumber + (type.name ? ' · ' + type.name : ''),
        price: type.basePrice,
        occupancy: type.maxOccupancy,
        status: room.status,
      };
    });

  session.rooms = rooms;

  const amenities = (hotel.amenities || [])
    .map((link) => link.amenity && link.amenity.name)
    .filter(Boolean);

  const roomLines = rooms.length
    ? rooms.map((room, i) => {
        const flag = room.status && room.status !== 'AVAILABLE' ? ' · ' + room.status : '';
        return (
          i + 1 + '. <b>' + esc(room.label) + '</b>' + esc(flag) +
          '\n    from ' + money(room.price) + ' / night · up to ' + esc(room.occupancy) + ' guests'
        );
      })
    : ['<i>No rooms listed for this hotel.</i>'];

  return done(
    lines([
      '🏨 <b>' + esc(hotel.name) + '</b>' + (hotel.rating ? ' ⭐ ' + hotel.rating : ''),
      '📍 ' + esc(hotel.addressLine) + ', ' + esc(hotel.city) + ', ' + esc(hotel.country),
      hotel.description ? '\n' + esc(hotel.description) : null,
      amenities.length ? '\n✨ ' + esc(amenities.join(', ')) : null,
      '',
      '<b>Rooms</b>',
      roomLines.join('\n'),
      '',
      'Book with <code>/book 1</code> — I will ask for the dates.',
      '<i>Prices shown are the base rate; seasonal rates may apply at booking.</i>',
    ])
  );
}

// ── Bookings ─────────────────────────────────────────────────────────────────
if (plan.intent === 'bookings.create') {
  const booking = result;
  const stay = (booking.rooms || [])[0] || {};
  const payment = (booking.payments || [])[0];

  session.draft = {};
  session.stage = 'idle';

  return done(
    lines([
      '🎉 <b>Booking created</b>',
      '',
      'Code: <code>' + esc(booking.bookingCode) + '</code>',
      'Hotel: ' + esc((booking.hotel && booking.hotel.name) || plan.ctx.hotelName),
      'Room: ' + esc(plan.ctx.roomLabel),
      'Stay: ' + esc(shortDate(stay.checkInDate)) + ' → ' + esc(shortDate(stay.checkOutDate)),
      'Total: <b>' + money(booking.totalAmount) + '</b>',
      'Status: <code>' + esc(booking.status) + '</code>',
      payment ? 'Payment: ' + esc(payment.paymentMethod) + ' · ' + esc(payment.status) : null,
      '',
      'Reception confirms it and settles the payment. Track it with /mybookings.',
    ])
  );
}

if (plan.intent === 'bookings.list') {
  const bookings = Array.isArray(result) ? result : [];
  session.bookings = bookings.map((booking) => ({
    id: booking.id,
    code: booking.bookingCode,
    status: booking.status,
    hotelName: booking.hotel && booking.hotel.name,
  }));

  if (!bookings.length) {
    return done('📭 No bookings yet. Start with /hotels.');
  }

  const bookingLines = bookings.map((booking, i) => {
    const stay = (booking.rooms || [])[0] || {};
    const payment = (booking.payments || [])[0];
    return lines([
      i + 1 + '. <code>' + esc(booking.bookingCode) + '</code> · <b>' + esc(booking.status) + '</b>',
      '    ' + esc((booking.hotel && booking.hotel.name) || 'Unknown hotel'),
      '    ' + esc(shortDate(stay.checkInDate)) + ' → ' + esc(shortDate(stay.checkOutDate)) +
        ' · ' + money(booking.totalAmount),
      payment ? '    💳 ' + esc(payment.paymentMethod) + ' · ' + esc(payment.status) : null,
    ]);
  });

  return done(
    lines([
      '🧾 <b>Your bookings</b> (' + Number(payload.count || bookings.length) + ')',
      '',
      bookingLines.join('\n\n'),
      '',
      'Cancel with <code>/cancel 1</code> · review a finished stay with <code>/review 1 5</code>',
    ])
  );
}

if (plan.intent === 'bookings.cancel') {
  const cancelled = (session.bookings || []).find((b) => b.id === result.id);
  if (cancelled) cancelled.status = result.status;

  return done(
    lines([
      '🚫 <b>Booking cancelled</b>',
      'Code: <code>' + esc(result.bookingCode) + '</code>',
      'Status: <code>' + esc(result.status) + '</code>',
      '',
      'The room is bookable again straight away.',
    ])
  );
}

// ── Reviews ──────────────────────────────────────────────────────────────────
if (plan.intent === 'review.create') {
  session.draft = {};
  session.stage = 'idle';

  const hotel = result.hotel || {};
  return done(
    lines([
      '⭐ <b>Thanks for the review!</b>',
      'Rating: ' + esc(result.rating) + '/5',
      result.comment ? 'Comment: ' + esc(result.comment) : null,
      hotel.name ? '\n' + esc(hotel.name) + ' now averages ⭐ ' + esc(hotel.rating) : null,
    ])
  );
}

// ── Fallback ─────────────────────────────────────────────────────────────────
return done('✅ ' + esc((payload.meta && payload.meta.message) || payload.message || 'Done.'));

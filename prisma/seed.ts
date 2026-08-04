import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as data from '../src/data';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
}

const roomRates = data.roomRatesData.map((r) => ({
  ...r,
  startDate: toDate(r.startDate)!,
  endDate: toDate(r.endDate)!,
}));

const bookingRooms = data.bookingRoomsData.map((r) => ({
  ...r,
  checkInDate: toDate(r.checkInDate)!,
  checkOutDate: toDate(r.checkOutDate)!,
}));

const payments = data.paymentsData.map((p) => ({
  ...p,
  paidAt: toDate(p.paidAt),
}));

async function main() {
  // Wipe tables in FK-safe order (children first)
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookingGuest.deleteMany();
  await prisma.bookingRoom.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.roomTypeAmenity.deleteMany();
  await prisma.hotelAmenity.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomRate.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({ data: data.usersData });
  await prisma.hotel.createMany({ data: data.hotelsData });
  await prisma.roomType.createMany({ data: data.roomTypesData });
  await prisma.roomRate.createMany({ data: roomRates });
  await prisma.room.createMany({ data: data.roomsData });
  await prisma.amenity.createMany({ data: data.amenitiesData });
  await prisma.hotelAmenity.createMany({ data: data.hotelAmenitiesData });
  await prisma.roomTypeAmenity.createMany({ data: data.roomTypeAmenitiesData });
  await prisma.booking.createMany({ data: data.bookingsData });
  await prisma.bookingRoom.createMany({ data: bookingRooms });
  await prisma.bookingGuest.createMany({ data: data.bookingGuestsData });
  await prisma.payment.createMany({ data: payments });
  await prisma.review.createMany({ data: data.reviewsData });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

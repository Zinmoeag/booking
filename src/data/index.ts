import type {
  Amenity,
  Booking,
  BookingGuest,
  BookingRoom,
  Hotel,
  HotelAmenity,
  Payment,
  Review,
  Room,
  RoomRate,
  RoomType,
  RoomTypeAmenity,
  User,
} from '@/types/database';

import amenities from './amenities.json';
import bookingGuests from './booking_guests.json';
import bookingRooms from './booking_rooms.json';
import bookings from './bookings.json';
import hotelAmenities from './hotel_amenities.json';
import hotels from './hotels.json';
import payments from './payments.json';
import reviews from './reviews.json';
import roomRates from './room_rates.json';
import roomTypeAmenities from './room_type_amenities.json';
import roomTypes from './room_types.json';
import rooms from './rooms.json';
import users from './users.json';

export const usersData = users as User[];
export const hotelsData = hotels as Hotel[];
export const roomTypesData = roomTypes as RoomType[];
export const roomRatesData = roomRates as RoomRate[];
export const roomsData = rooms as Room[];
export const amenitiesData = amenities as Amenity[];
export const hotelAmenitiesData = hotelAmenities as HotelAmenity[];
export const roomTypeAmenitiesData = roomTypeAmenities as RoomTypeAmenity[];
export const bookingsData = bookings as Booking[];
export const bookingRoomsData = bookingRooms as BookingRoom[];
export const bookingGuestsData = bookingGuests as BookingGuest[];
export const paymentsData = payments as Payment[];
export const reviewsData = reviews as Review[];

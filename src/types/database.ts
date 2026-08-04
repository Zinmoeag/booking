// ============================================================================
// Enum types (mirror PostgreSQL ENUM types from the DDL)
// ============================================================================

export type UserRole = 'GUEST' | 'HOTEL_STAFF' | 'ADMIN';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type PaymentMethod =
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'PAYPAL'
  | 'BANK_TRANSFER'
  | 'CASH';

// Runtime values (useful for validation / dropdowns in dummy code)
export const USER_ROLES: UserRole[] = ['GUEST', 'HOTEL_STAFF', 'ADMIN'];

export const ROOM_STATUSES: RoomStatus[] = [
  'AVAILABLE',
  'OCCUPIED',
  'MAINTENANCE',
  'CLEANING',
];

export const BOOKING_STATUSES: BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
];

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PAYPAL',
  'BANK_TRANSFER',
  'CASH',
];

// ============================================================================
// Core table types (mirror PostgreSQL tables from the DDL)
// ============================================================================

// users table
export interface User {
  id: string; // UUID
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phoneNumber?: string | null;
  role: UserRole;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// hotels table
export interface Hotel {
  id: string; // UUID
  name: string;
  description?: string | null;
  addressLine: string;
  city: string;
  country: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating: number; // 0.0 - 5.0
  createdAt: string; // ISO timestamp
}

// room_types table
export interface RoomType {
  id: string; // UUID
  hotelId: string; // FK -> hotels.id
  name: string; // e.g. Deluxe Suite, Standard King
  description?: string | null;
  basePrice: number;
  maxOccupancy: number;
  bedCount: number;
  createdAt: string; // ISO timestamp
}

// room_rates table (dynamic / seasonal pricing)
export interface RoomRate {
  id: string; // UUID
  roomTypeId: string; // FK -> room_types.id
  startDate: string; // ISO date (yyyy-mm-dd)
  endDate: string; // ISO date (yyyy-mm-dd)
  pricePerNight: number;
}

// rooms table
export interface Room {
  id: string; // UUID
  hotelId: string; // FK -> hotels.id
  roomTypeId: string; // FK -> room_types.id
  roomNumber: string;
  floor?: number | null;
  status: RoomStatus;
}

// amenities table
export interface Amenity {
  id: string; // UUID
  name: string;
  category?: string | null; // e.g. 'HOTEL' or 'ROOM'
}

// hotel_amenities junction table
export interface HotelAmenity {
  hotelId: string; // FK -> hotels.id
  amenityId: string; // FK -> amenities.id
}

// room_type_amenities junction table
export interface RoomTypeAmenity {
  roomTypeId: string; // FK -> room_types.id
  amenityId: string; // FK -> amenities.id
}

// bookings table
export interface Booking {
  id: string; // UUID
  bookingCode: string;
  userId: string; // FK -> users.id
  hotelId: string; // FK -> hotels.id
  totalAmount: number;
  status: BookingStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// booking_rooms table
export interface BookingRoom {
  id: string; // UUID
  bookingId: string; // FK -> bookings.id
  roomId: string; // FK -> rooms.id
  checkInDate: string; // ISO date (yyyy-mm-dd)
  checkOutDate: string; // ISO date (yyyy-mm-dd)
  pricePerNight: number; // snapshot price at booking time
}

// booking_guests table
export interface BookingGuest {
  id: string; // UUID
  bookingRoomId: string; // FK -> booking_rooms.id
  fullName: string;
  email?: string | null;
  isPrimary: boolean;
  idProofNumber?: string | null;
}

// payments table
export interface Payment {
  id: string; // UUID
  bookingId: string; // FK -> bookings.id
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string | null;
  paidAt?: string | null; // ISO timestamp
}

// reviews table
export interface Review {
  id: string; // UUID
  bookingId: string; // FK -> bookings.id (unique)
  userId: string; // FK -> users.id
  hotelId: string; // FK -> hotels.id
  rating: number; // 1 - 5
  comment?: string | null;
  createdAt: string; // ISO timestamp
}

// ============================================================================
// Aggregate / joined types (convenience for API responses)
// ============================================================================

export interface BookingRoomWithDetails extends BookingRoom {
  room?: Room;
  roomType?: RoomType;
  guests?: BookingGuest[];
}

export interface BookingWithDetails extends Booking {
  user?: User;
  hotel?: Hotel;
  rooms?: BookingRoomWithDetails[];
  payments?: Payment[];
}

export interface HotelWithDetails extends Hotel {
  roomTypes?: RoomType[];
  amenities?: Amenity[];
  rooms?: Room[];
}

import { IUser } from '@/utils/auth/IUser';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: Pick<
    IUser,
    'id' | 'email' | 'role' | 'firstName' | 'lastName' | 'phoneNumber'
  >;
}

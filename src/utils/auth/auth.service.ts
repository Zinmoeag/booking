import { IUser } from './IUser';
import { signAccessToken, signRefreshToken } from './jwt';

export const generateTokens = (user: IUser) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return { accessToken, refreshToken };
};

export const generateAccessToken = (user: IUser) => signAccessToken(user);

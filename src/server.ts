import 'reflect-metadata'; // Ensure decorators work
import dotenv from 'dotenv';
dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development',
});

import Bootstrap from './app/bootstrap';

Bootstrap.init();

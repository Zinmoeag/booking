import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application } from 'express';

import AppConfig, { Configs } from '@/app/config/app.config';
import { catchError } from '@/utils/error-handling';

import { getEnvVariable } from './config/env/custom-env';
import { HttpLogger, SysLogger } from './config/logger';
import { AppError, errorKinds } from './error';
import rateLimit from 'express-rate-limit';
import rateLimitConfig from './config/rate-limit';

class Bootstrap {
  private static _instance: Bootstrap;
  private static httpLogger: HttpLogger;
  private static sysLogger: SysLogger;

  get expressApp() {
    return this.app;
  }

  private app: Application;

  private constructor() {
    const safeEnvironment = getEnvVariable();
    // Register configuration
    const [error] = catchError(() =>
      AppConfig.register(
        Object.fromEntries(
          Object.entries(safeEnvironment).map(([key, value]) => {
            if (value === undefined) {
              throw AppError.new(
                errorKinds.internalServerError,
                `env load error: ${key} is undefined`
              );
            }
            return [key, String(value)];
          })
        ) as Configs
      )
    );

    if (error) {
      throw AppError.new(errorKinds.internalServerError, 'env load error');
    }

    // Initialize Express app
    this.app = express();
    Bootstrap.httpLogger = new HttpLogger({ service: 'BOOTSTRAP' });
    Bootstrap.sysLogger = new SysLogger({ service: 'BOOTSTRAP' });
  }

  static init() {
    if (!this._instance) {
      // Initialize Express app
      this._instance = new Bootstrap();
      // setup middlewares
      this._instance.configureApp();
      // register routes
      this._instance.registerRoutes();
      // start server
      this._instance.startServer();
    }
    return this._instance;
  }

  async registerRoutes() {
    const router = (await import('@/routes')).default;
    this.app.use(router);
  }

  private configureApp() {
    // Rate limit middleware
    this.app.use(
      rateLimit({
        ...rateLimitConfig,
      })
    );

    // CORS must be first to handle preflight requests
    this.app.use(
      cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      })
    );

    // Body parsers
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    // Other middlewares
    this.app.use(cookieParser());

    // Request logging middleware
    this.app.use((req, res, next) => {
      Bootstrap.httpLogger.customeLog(
        req.method,
        req.path,
        res.statusCode,
        'Incoming Request',
        {
          hello: 'mello',
          requestId: req.headers['x-request-id'],
          userId: req.headers['x-user-id'],
        }
      );
      next();
    });
  }

  private startServer() {
    const port = AppConfig.getConfig('PORT');
    this.app.listen(port, () => {
      console.log(`Server is running on ${port}`);
      Bootstrap.sysLogger.info(
        `Server is running on ${port}`,
        'Server is running'
      );
    });
  }

  private startWorkers() {
    // Promise.all(Bootstrap.workers.map((worker) => worker.run()));
  }
}

export default Bootstrap;

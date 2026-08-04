import { Router } from 'express';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import AppConfig from '@/app/config/app.config';
import { HttpLogger, SysLogger } from '@/app/config/logger';
import { createSwaggerRouter } from '@/app/core/openapi/swagger';
import { HttpDetailResponse } from '@/app/core/Response/HttpResponse';
import { AppError, ErrorBase, errorKinds, SysError } from '@/app/error';
import { AmenityController } from '@/modules/amenity/amenity.controller';
import { AuthController } from '@/modules/auth/auth.controller';
import { BookingController } from '@/modules/booking/booking.controller';
import { HotelController } from '@/modules/hotel/hotel.controller';
import { PaymentController } from '@/modules/payment/payment.controller';
import { ReviewController } from '@/modules/review/review.controller';
import { RoomController } from '@/modules/room/room.controller';
import { RoomRateController } from '@/modules/roomRate/roomRate.controller';
import { RoomTypeController } from '@/modules/roomType/roomType.controller';
import { UserController } from '@/modules/user/user.controller';

const router = Router();

const mountController = (controller: object): Router =>
  (controller as { router: Router }).router;

router.use(mountController(new AuthController()));
router.use(mountController(new UserController()));
router.use(mountController(new HotelController()));
router.use(mountController(new RoomTypeController()));
router.use(mountController(new RoomRateController()));
router.use(mountController(new RoomController()));
router.use(mountController(new AmenityController()));
router.use(mountController(new BookingController()));
router.use(mountController(new PaymentController()));
router.use(mountController(new ReviewController()));

// Must come after every controller so the routing table is complete
router.use(createSwaggerRouter());

router.get(
  '/health-check',
  async (req: Request, res: Response, next: NextFunction) => {
    // next(
    //   AppError.new(
    //     errorKinds.internalServerError,
    //     'Health check internal server error'
    //   )
    // );
    const port = AppConfig.getConfig('PORT');
    res.json(
      HttpDetailResponse.json({
        message: 'Health check successful',
        result: {
          port,
        },
        status: 200,
      })
    );
  }
);

//register routes

//404 handler
router.use((req: Request, res: Response, next: NextFunction) => {
  // send 404 error
  return next(AppError.new(errorKinds.notFound, 'Not Found'));
});

// eslint-disable-next-line no-unused-vars
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  let response;
  let logger;

  if (err instanceof ZodError) {
    response = res.status(422).json(
      HttpDetailResponse.json({
        message:
          err.errors
            .map((error: any) => `${error.path.join('.')}: ${error.message}`)
            .join(', ') ?? 'Validation failed',
        meta: {
          errors: err.errors,
        },
        result: {},
        status: 422,
      })
    );
  }

  if (err instanceof ErrorBase) {
    response = res.status(err.getStatus()).json(
      HttpDetailResponse.json({
        message: err.message,
        meta: {
          payload: err.payload,
        },
        result: {},
        status: err.getStatus(),
      })
    );

    if (err instanceof AppError) {
      logger = new HttpLogger({ service: err.service ?? 'Unknown' });
    } else if (err instanceof SysError) {
      logger = new SysLogger({ service: err.service ?? 'Unknown' });
    } else {
      logger = new SysLogger({ service: 'Unknown' });
    }
  } else {
    response = res.status(500).json(
      HttpDetailResponse.json({
        message: err.message,
        meta: {
          payload: err.payload,
        },
        result: {},
        status: 500,
      })
    );
    logger = new SysLogger({ service: 'Unknown' });
  }
  if (logger) {
    logger.error(
      `${req.method} ${req.originalUrl}`,
      err.message,
      err.payload ?? {}
    );
  }
  response.end();
});

export default router;

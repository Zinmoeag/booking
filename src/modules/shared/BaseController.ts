import { Request, Response } from 'express';

import { ApiRouter } from '@/app/core/ApiRoute';
import {
  HttpDetailResponse,
  HttpGenericResponse,
  HttpListResponse,
} from '@/app/core/Response/HttpResponse';
import { PaginationType } from '@/app/core/schema';

export abstract class BaseController extends ApiRouter {
  protected sendDetail<T>(res: Response, message: string, result: T, status = 200) {
    return res.status(status).json(
      HttpDetailResponse.json({
        message,
        result,
        status,
      })
    );
  }

  protected sendList<T>(res: Response, message: string, result: T[], count: number, status = 200) {
    return res.status(status).json(
      HttpListResponse.json({
        count,
        meta: { message },
        result,
        status,
      })
    );
  }

  protected sendMessage(res: Response, message: string, status = 200) {
    return res.status(status).json(
      HttpGenericResponse.json({
        message,
        status,
      })
    );
  }

  protected getPagination(req: Request): PaginationType {
    return this.getQueryPagination(req);
  }
}

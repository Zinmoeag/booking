/* eslint-disable no-unused-vars */
import express from 'express';
import { z, ZodObject } from 'zod';

import {
  validateQueryFilter,
  validateQueryOrderBy,
  validateQueryPagination,
} from './validate_query';

export abstract class ApiRouter {
  static validateRequest<Schema extends ZodObject<any, any, any, any, any>>({
    type,
    zodParser,
  }: {
    type: 'body' | 'params' | 'query';
    zodParser: Schema;
  }) {
    return async function (
      req: express.Request,
      _: express.Response,
      next: express.NextFunction
    ) {
      zodParser.parse(req[type]);
      return next();
    };
  }

  getParsedBody<ZodSchema extends ZodObject<any, any, any, any, any>>(
    req: express.Request,
    {
      defaultValue,
      zodParser,
    }: { defaultValue?: Partial<z.infer<ZodSchema>>; zodParser: ZodSchema }
  ): z.infer<ZodSchema> {
    const value = zodParser.parse(req.body);
    return { ...defaultValue, ...value };
  }

  getParsedParams<ZodSchema extends ZodObject<any, any, any, any, any>>(
    req: express.Request,
    {
      defaultValue,
      zodParser,
    }: { defaultValue?: Partial<z.infer<ZodSchema>>; zodParser: ZodSchema }
  ): z.infer<ZodSchema> {
    const value = zodParser.parse(req.params);
    return { ...defaultValue, ...value };
  }

  getParsedQuery<ZodSchema extends ZodObject<any, any, any, any, any>>(
    req: express.Request,
    {
      defaultValue,
      zodParser,
    }: { defaultValue?: Partial<z.infer<ZodSchema>>; zodParser: ZodSchema }
  ): z.infer<ZodSchema> {
    const value = zodParser.parse(req.query);
    return { ...defaultValue, ...value };
  }

  getQueryFilter<ZodSchema extends ZodObject<any, any, any, any, any>>(
    req: express.Request,
    {
      defaultValue,
      zodParser,
    }: { defaultValue?: Partial<z.infer<ZodSchema>>; zodParser: ZodSchema }
  ) {
    const value = validateQueryFilter(req, { zodParser });
    return { ...defaultValue, ...value };
  }

  getQueryOrderBy<ZodSchema extends ZodObject<any, any, any, any, any>>(
    req: express.Request,
    {
      defaultValue,
      zodParser,
    }: {
      defaultValue?: Partial<{
        [K in keyof z.infer<ZodSchema>]?: 'asc' | 'desc';
      }>;
      zodParser: ZodSchema;
    }
  ) {
    const value = validateQueryOrderBy(req, { zodParser }) as {
      [K in keyof z.infer<ZodSchema>]: 'asc' | 'desc' | undefined;
    };
    return { ...defaultValue, ...value };
  }

  getQueryPagination(req: express.Request) {
    const { page, size } = validateQueryPagination(req);

    return {
      page,
      size,
      skip: (page - 1) * size,
      take: size,
    };
  }
}

import express from 'express';
import _ from 'lodash';
import z from 'zod';

import { makeFilterQuerySchema, paginationSchema } from './schema';

export function validateQueryFilter<
  T extends z.ZodObject<any, any, any, any, any>
>(req: express.Request, { zodParser }: { zodParser: T }) {
  const input = req.query as Record<string, any>;
  const output: any = {};

  for (const [key, value] of Object.entries(input)) {
    let _value;
    const valueList = Array.isArray(value) ? value : value?.split(',');

    if (valueList?.length === 1) _value = valueList[0];
    else _value = valueList;

    _.set(output, key, _value);
  }

  return makeFilterQuerySchema(zodParser)
    .default({})
    .parse(output?.filter ?? {});
}

export function validateQueryOrderBy<
  T extends z.ZodObject<any, any, any, any, any>
>(req: express.Request, { zodParser }: { zodParser: T }) {
  const input = req.query as Record<string, any>;
  const output: any = {};

  const latestInputEntry = Object.entries(input).pop();

  if (latestInputEntry) {
    for (const [key, value] of [latestInputEntry]) {
      if (['', 'asc', 'desc', undefined].includes(value))
        _.set(output, key, value ?? 'asc');
    }
  }
  return zodParser.parse(output?.orderBy ?? {});
}

export function validateQueryPagination(req: express.Request) {
  const input = req.query as Record<string, any>;
  const output: any = {};

  for (const [key, value] of Object.entries(input)) {
    _.set(output, key, value);
  }
  return paginationSchema.parse(output?.pagination);
}

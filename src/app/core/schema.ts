import z from 'zod';
import dayjs from 'dayjs';

const parseLocalDateTime = (dateTimeStr: string) => {
  return new Date(dayjs(dateTimeStr).format('YYYY-MM-DD HH:mm:ss'));
};

export const stringToNullValueSchema = z
  .string()
  .transform((val) => stringToNullValue(val))
  .optional();

export const stringToNumberSchema = z
  .string()
  .refine((val) => !isNaN(+val))
  .transform((val) => parseFloat(val));

export const stringToDateSchema = z
  .string()
  .refine((val) => !isNaN(new Date(val).getDate()))
  .transform((val) => parseLocalDateTime(val));

export const stringToBooleanSchema = z
  .string()
  .refine((val) => /^(true|false|1|0)$/i.test(val))
  .transform((val) => val.toLowerCase() === 'true' || val === '1');

export const uuidFilterQuerySchema = z.union([
  z.string(),
  z
    .object({
      gt: z.string(),
      gte: z.string(),
      lt: z.string(),
      lte: z.string(),
    })
    .partial(),
]);

export const stringFilterQuerySchema = z.union([
  z.array(z.string()).transform((val) => val.join(',')),
  z.string(),
  z
    .object({
      contains: z.string(),
      endsWith: z.string(),
      equals: z.string(),
      gt: z.string(),
      gte: z.string(),
      lt: z.string(),
      lte: z.string(),
      not: z.string(),
      search: z.string(),
      startsWith: z.string(),
    })
    .partial(),
]);

export const numberFilterQuerySchema = z.union([
  stringToNumberSchema,
  z
    .object({
      gt: stringToNumberSchema,
      gte: stringToNumberSchema,
      lt: stringToNumberSchema,
      lte: stringToNumberSchema,
    })
    .partial(),
]);

export const booleanFilterQuerySchema = z.union([
  stringToBooleanSchema,
  z
    .object({
      equals: stringToBooleanSchema,
    })
    .partial(),
]);

export const dateFilterQuerySchema = z.union([
  stringToDateSchema,
  z
    .object({
      gt: stringToDateSchema,
      gte: stringToDateSchema,
      lt: stringToDateSchema,
      lte: stringToDateSchema,
    })
    .partial(),
]);

export function makeArrayFilterQuerySchema<T extends z.ZodArray<any, any>>(
  schema: T
) {
  let newSchema = z.object({});

  if (schema.element instanceof z.ZodString) {
    newSchema = newSchema.extend({ hasSome: z.array(stringFilterQuerySchema) });
  }
  if (schema.element instanceof z.ZodNumber) {
    newSchema = newSchema.extend({ hasSome: z.array(numberFilterQuerySchema) });
  }
  if (schema.element instanceof z.ZodBoolean) {
    newSchema = newSchema.extend({
      hasSome: z.array(booleanFilterQuerySchema),
    });
  }

  return z
    .any()
    .transform((val) => {
      if (!Array.isArray(val)) return [val];
      return val;
    })
    .transform((val) => ({ hasSome: val }))
    .transform((val) => newSchema.parse(val));
}

export function makeFilterQuerySchema<T extends z.ZodObject<any>>(schema: T) {
  let newSchema: z.ZodObject<any> = schema;

  const ignoreFields = ['_count'];

  Object.entries(schema.shape).forEach(([key, value]) => {
    if (!ignoreFields.includes(key)) {
      if (value instanceof z.ZodString)
        newSchema = newSchema.extend({ [key]: stringFilterQuerySchema });
      if (value instanceof z.ZodString)
        newSchema = newSchema.extend({ [key]: uuidFilterQuerySchema });
      if (value instanceof z.ZodNumber)
        newSchema = newSchema.extend({ [key]: numberFilterQuerySchema });
      if (value instanceof z.ZodBoolean)
        newSchema = newSchema.extend({ [key]: booleanFilterQuerySchema });
      if (value instanceof z.ZodArray)
        newSchema = newSchema.extend({
          [key]: makeArrayFilterQuerySchema(value),
        });
      if (value instanceof z.ZodDate)
        newSchema = newSchema.extend({ [key]: dateFilterQuerySchema });
      if (value instanceof z.ZodObject)
        newSchema = newSchema.extend({ [key]: makeFilterQuerySchema(value) });
    }
  });

  return newSchema.partial();
}

export function makeOrderByQuerySchema<T extends z.ZodObject<any>>(schema: T) {
  let newSchema: z.ZodObject<any> = z.object({});

  Object.entries(schema.shape).forEach(([key, value]) => {
    if (value instanceof z.ZodObject) {
      newSchema = newSchema.extend({
        [key]: makeOrderByQuerySchema(value).optional(),
      });
      return;
    }

    newSchema = newSchema.extend({ [key]: z.enum(['asc', 'desc']).optional() });
  });

  return newSchema.partial();
}

export const paginationSchema = z
  .object({
    page: stringToNumberSchema
      .refine(
        (val) => z.number().int().gte(1).safeParse(val).success,
        'schema.onlyPositive'
      )
      .default('1'),
    size: stringToNumberSchema
      .refine(
        (val) => z.number().int().lt(100).safeParse(val).success,
        'schema.fit64bitint'
      )
      .default('100'),
  })
  .default({ page: '1', size: '100' });

export interface PaginationType {
  page: number;
  size: number;
  skip: number;
  take: number;
}

export function stringToNullValue(
  value: null | string | undefined
): null | string {
  if (
    value === undefined ||
    value === null ||
    value.trim().toLowerCase() === 'null'
  ) {
    return null;
  }
  return value;
}

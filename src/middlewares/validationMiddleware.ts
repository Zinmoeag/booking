import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { describeValidation } from '@/app/core/openapi/metadata';
import { AppError, errorKinds } from '@/app/error';

interface ValidateProps {
  schema: z.Schema;
  target: 'BODY' | 'QUERY';
}

export class ValidationMiddleware {
  validateRequestBody(schema: z.Schema) {
    return this.validate({
      schema,
      target: 'BODY',
    });
  }

  validateRequestQuery(schema: z.Schema) {
    return this.validate({
      schema,
      target: 'QUERY',
    });
  }

  private validate(props: ValidateProps) {
    const handler = (req: Request, res: Response, next: NextFunction) => {
      const { schema, target } = props;
      const validation = schema.safeParse(
        target === 'BODY' ? req.body ?? {} : req.query ?? {}
      );

      if (!validation.success) {
        return next(
          AppError.new(
            errorKinds.validationFailed,
            'validation Failed',
            Object.fromEntries(
              Object.entries(validation.error?.formErrors.fieldErrors).map(
                ([key, value]) => [key, value ?? []]
              )
            )
          )
        );
      }

      // Set validated data to correct target
      if (target === 'BODY') {
        req.body = validation.data;
      }

      next();
    };

    // Tag the handler so the OpenAPI generator can recover the zod schema
    return describeValidation(handler, props.target, props.schema);
  }
}

export default new ValidationMiddleware();

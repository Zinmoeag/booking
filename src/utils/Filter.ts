/* eslint-disable no-unused-vars */
import { isBoolean } from 'lodash';

import { AppError, errorKinds } from '@/app/error';

export type IAppliedFlterOption<T> = {
  [key in keyof T]: string;
};

export interface IApplyFiltersInput<T> {
  appliedFilters: IAppliedFlterOption<T>;
  availableFilters: IAvailableFlter<T>;
  defaultFilters?: IDefaultFilter<T>;
}

export type IAvailableFlter<T> = {
  [key in keyof T]: (params: IAvailableFlterInput) => T;
};

export interface IAvailableFlterInput {
  filter: unknown;
}

export interface IAvailableFlterOutput<T> {
  where: T;
}

export type IDefaultFilter<T> = {
  [key in keyof T]: () => T;
};

export const ApplyFilter = <T extends object>(
  params: IApplyFiltersInput<T>
) => {
  try {
    const { appliedFilters, availableFilters, defaultFilters } = params;
    const whereBuilder: T = {} as T;

    if (defaultFilters) {
      for (const [key] of Object.entries(defaultFilters)) {
        const where = defaultFilters[key as keyof T]();
        Object.assign(whereBuilder, where);
      }
    }

    for (const [key, value] of Object.entries(appliedFilters)) {
      if ((availableFilters[key as keyof T] && value) || isBoolean(value)) {
        const where = availableFilters[key as keyof T]({
          filter: value,
        });
        Object.assign(whereBuilder, where);
      }
    }

    return {
      result: whereBuilder,
    };
  } catch (error) {
    throw AppError.new(errorKinds.internalServerError, 'Failed To Filter');
  }
};

export class FilterHelper<T extends object> {
  static sort<T extends object>(params: IApplyFiltersInput<T>) {
    const { result } = ApplyFilter(params);
    return result;
  }

  static where<T extends object>(params: IApplyFiltersInput<T>) {
    const { result } = ApplyFilter(params);
    return result;
  }
}

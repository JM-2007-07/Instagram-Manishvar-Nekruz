import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { validationError } from '../validation';

// Как ParseUUIDPipe, но ошибка в формате API_CONTRACT §1.2: VALIDATION_ERROR + details с именем параметра.
@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (typeof value === 'string' && isUUID(value)) return value;
    const field = metadata.data ?? 'id';
    throw validationError(field, `${field} must be a UUID`);
  }
}

import { Global, Module } from '@nestjs/common';
import { VisibilityService } from './visibility.service';

// Глобальный: VisibilityService используют все модули с выдачей, импортировать модуль не нужно.
@Global()
@Module({ providers: [VisibilityService], exports: [VisibilityService] })
export class PrivacyModule {}

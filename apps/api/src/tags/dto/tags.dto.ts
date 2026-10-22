import { ApiProperty } from '@nestjs/swagger';

export class HashtagDto {
  @ApiProperty({ description: 'Без «#», в нижнем регистре' })
  name!: string;

  @ApiProperty({ description: 'Число публикаций (до T1.B4 всегда 0)' })
  postCount!: number;
}

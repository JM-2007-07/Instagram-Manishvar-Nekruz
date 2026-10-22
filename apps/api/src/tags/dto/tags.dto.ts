import { ApiProperty } from '@nestjs/swagger';

export class HashtagDto {
  @ApiProperty({ description: 'Без «#», в нижнем регистре' })
  name!: string;

  @ApiProperty({ description: 'Число опубликованных публикаций с хэштегом' })
  postCount!: number;
}

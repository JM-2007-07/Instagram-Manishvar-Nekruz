import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { decodeOffsetCursor, encodeOffsetCursor } from '@/common/pagination/cursor';
import type { Page } from '@/common/pagination/cursor';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  CreateLocationDto,
  LocationDetailsDto,
  LocationDto,
  LocationsQueryDto,
  UpdateLocationDto,
} from './dto/locations.dto';

// Поля места для ответов; используется и модулем posts.
export const locationSelect = {
  id: true,
  name: true,
  slug: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.LocationSelect;

type LocationRow = Prisma.LocationGetPayload<{ select: typeof locationSelect }>;

export function toLocationDto(row: LocationRow): LocationDto {
  return { ...row };
}

// "Times Square" + "New York" -> "times-square-new-york"
function makeSlug(name: string, city: string): string {
  return `${name} ${city}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Курсор — смещение: выдача отсортирована по названию (ADR 0017).
  async search(query: LocationsQueryDto): Promise<Page<LocationDto>> {
    const offset = query.cursor ? decodeOffsetCursor(query.cursor) : 0;
    const q = query.q?.trim();
    const where: Prisma.LocationWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.state ? { state: { equals: query.state, mode: 'insensitive' } } : {}),
      ...(query.zipCode ? { zipCode: query.zipCode } : {}),
      ...(query.country ? { country: { equals: query.country, mode: 'insensitive' } } : {}),
    };
    const rows = await this.prisma.location.findMany({
      where,
      select: locationSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    return {
      items: rows.slice(0, query.limit).map(toLocationDto),
      nextCursor: hasMore ? encodeOffsetCursor(offset + query.limit) : null,
    };
  }

  // Для общего поиска /search (T1.A6).
  async searchForGlobal(query: string, limit: number): Promise<LocationDto[]> {
    const rows = await this.prisma.location.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: locationSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map(toLocationDto);
  }

  async findById(id: string): Promise<LocationDetailsDto> {
    const row = await this.prisma.location.findUnique({ where: { id }, select: locationSelect });
    if (!row) throw new NotFoundException('Location not found');
    // TODO(T1.B4): считать публикации места, когда появится модель Post.
    return { ...toLocationDto(row), postCount: 0 };
  }

  async create(role: string, dto: CreateLocationDto): Promise<LocationDto> {
    this.assertAdmin(role);
    const slug = makeSlug(dto.name, dto.city);
    if (await this.prisma.location.findUnique({ where: { slug }, select: { id: true } })) {
      throw new ConflictException('Location already exists');
    }
    const row = await this.prisma.location.create({
      data: { ...dto, slug },
      select: locationSelect,
    });
    return toLocationDto(row);
  }

  async update(role: string, id: string, dto: UpdateLocationDto): Promise<LocationDto> {
    this.assertAdmin(role);
    const current = await this.prisma.location.findUnique({
      where: { id },
      select: { name: true, city: true },
    });
    if (!current) throw new NotFoundException('Location not found');
    const slug = makeSlug(dto.name ?? current.name, dto.city ?? current.city);
    const clash = await this.prisma.location.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== id) throw new ConflictException('Location already exists');
    const row = await this.prisma.location.update({
      where: { id },
      data: { ...dto, slug },
      select: locationSelect,
    });
    return toLocationDto(row);
  }

  // Когда появятся posts/stories, их locationId станет null через onDelete: SetNull в схеме.
  async remove(role: string, id: string): Promise<void> {
    this.assertAdmin(role);
    const result = await this.prisma.location.deleteMany({ where: { id } });
    if (result.count === 0) throw new NotFoundException('Location not found');
  }

  private assertAdmin(role: string): void {
    if (role !== 'ADMIN') throw new ForbiddenException();
  }
}

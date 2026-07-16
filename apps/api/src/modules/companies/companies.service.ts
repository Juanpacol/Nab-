import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AddCompanyMemberInput, CreateCompanyInput, UpdateCompanyInput } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea la empresa y deja al creador como OWNER, en la misma transacción. */
  async create(userId: string, input: CreateCompanyInput) {
    const slugTaken = await this.prisma.company.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (slugTaken) throw new ConflictException('Ese identificador de empresa ya está en uso');

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: input.name,
          slug: input.slug,
          website: input.website ?? null,
          description: input.description ?? null,
        },
      });
      await tx.companyMember.create({
        data: { companyId: company.id, userId, role: 'OWNER' },
      });
      return company;
    });
  }

  /** Empresas de las que el usuario es miembro (switcher candidato↔recruiter). */
  async listMine(userId: string) {
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, company: true },
    });
    return memberships.map((m) => ({ ...m.company, role: m.role }));
  }

  async getById(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }

  async update(companyId: string, input: UpdateCompanyInput) {
    return this.prisma.company.update({ where: { id: companyId }, data: input });
  }

  async listMembers(companyId: string) {
    return this.prisma.companyMember.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  async addMember(companyId: string, input: AddCompanyMemberInput) {
    const email = input.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new NotFoundException('No existe una cuenta Nab con ese correo');

    const existing = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Ese usuario ya es miembro de la empresa');

    return this.prisma.companyMember.create({
      data: { companyId, userId: user.id, role: input.role },
      select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
    });
  }

  /**
   * Elimina un miembro. Si es el último OWNER, la transacción revierte el
   * delete (aceptamos una ventana de carrera teórica entre dos bajas
   * concurrentes de distintos OWNERs bajo READ COMMITTED — es una acción de
   * administración infrecuente, no un flujo de dinero; no amerita locking
   * explícito).
   */
  async removeMember(companyId: string, targetUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: targetUserId } },
        select: { id: true, role: true },
      });
      if (!member) throw new NotFoundException('Miembro no encontrado');

      await tx.companyMember.delete({ where: { id: member.id } });

      if (member.role === 'OWNER') {
        const remainingOwners = await tx.companyMember.count({ where: { companyId, role: 'OWNER' } });
        if (remainingOwners === 0) {
          throw new ConflictException('La empresa debe tener al menos un dueño');
        }
      }
      return { removed: true };
    });
  }
}

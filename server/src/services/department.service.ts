import { Department, Prisma } from '@prisma/client';
import { departmentRepository, auditLogRepository, CreateDepartmentData, UpdateDepartmentData } from '../data-access/index.js';
import { prisma } from '../data-access/prisma.js';

class DepartmentService {
    // Create department (Super Admin only)
    async create(data: CreateDepartmentData, actorId: number): Promise<Department> {
        // Check if code already exists within the same tenant
        const existing = await departmentRepository.findByCode(data.code, data.tenantId);
        if (existing) {
            throw new Error(`Department with code "${data.code}" already exists`);
        }

        const department = await departmentRepository.create(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_DEPARTMENT',
            entityType: 'Department',
            entityId: department.id,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return department;
    }

    // Update department
    async update(id: number, data: UpdateDepartmentData, actorId: number): Promise<Department> {
        const existing = await departmentRepository.findById(id);
        if (!existing) {
            throw new Error('Department not found');
        }

        // If updating code, check for duplicates
        if (data.code && data.code !== existing.code) {
            const codeExists = await departmentRepository.findByCode(data.code);
            if (codeExists) {
                throw new Error(`Department with code "${data.code}" already exists`);
            }
        }

        const department = await departmentRepository.update(id, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_DEPARTMENT',
            entityType: 'Department',
            entityId: id,
            oldValue: { name: existing.name, code: existing.code, description: existing.description } as Prisma.JsonValue,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return department;
    }

    // Delete department
    async delete(id: number, actorId: number): Promise<void> {
        const existing = await departmentRepository.findById(id);
        if (!existing) {
            throw new Error('Department not found');
        }

        // Check if department has users
        const deptWithCount = existing as Department & { _count?: { users: number } };
        if (deptWithCount._count && deptWithCount._count.users > 0) {
            throw new Error('Cannot delete department with existing users');
        }

        await departmentRepository.delete(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'DELETE_DEPARTMENT',
            entityType: 'Department',
            entityId: id,
            oldValue: { name: existing.name, code: existing.code } as Prisma.JsonValue,
        });
    }

    // Get department by ID
    async getById(id: number): Promise<Department | null> {
        return departmentRepository.findById(id);
    }

    // Get all departments
    async getAll(): Promise<Department[]> {
        return departmentRepository.findAll();
    }

    // Get all departments scoped to tenant
    async getAllByTenant(tenantId: number): Promise<Department[]> {
        return departmentRepository.findAll(tenantId);
    }

    // Get cycle departments (PHY/CHEM) for a tenant
    async getCycleDepartments(tenantId: number): Promise<Department[]> {
        return prisma.department.findMany({
            where: { isCycleDepartment: true, tenantId },
            orderBy: { name: 'asc' },
        });
    }

    // Get opted (non-cycle) departments for a tenant
    async getOptedDepartments(tenantId: number): Promise<Department[]> {
        return prisma.department.findMany({
            where: { isCycleDepartment: false, tenantId },
            orderBy: { name: 'asc' },
        });
    }

    // Create department with an admin user in one transaction
    async createWithAdmin(
        departmentData: CreateDepartmentData,
        adminData: { name: string; email: string },
        actorId: number,
        tenantId: number
    ): Promise<{ department: Department; admin: { email: string; password: string } }> {
        // First create the department
        const department = await this.create(departmentData, actorId);

        // Import user service dynamically to avoid circular dependency
        const { userService } = await import('./user.service.js');

        // Create the department admin with email notification
        const result = await userService.createWithEmailNotification(
            {
                name: adminData.name,
                email: adminData.email,
                role: 'DEPARTMENT_ADMIN',
                departmentId: department.id,
                tenantId,
            },
            actorId
        );

        return {
            department,
            admin: {
                email: result.user.email,
                password: result.password,
            },
        };
    }
}

export const departmentService = new DepartmentService();

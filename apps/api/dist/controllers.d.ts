import { Request, Response } from "express";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
export declare class HealthController {
    health(): {
        status: string;
        service: string;
        alignment: string;
        time: string;
    };
}
export declare class AuthController {
    private readonly service;
    private readonly prisma;
    constructor(service: AppService, prisma: PrismaService);
    login(body: any, request: Request, response: Response): Promise<{
        id: string;
        username: string;
        fullName: string;
        mustChangePassword: boolean;
        roles: string[];
        permissions: string[];
        unit: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            code: string;
            slug: string;
            active: boolean;
        } | null;
        unitId: string | null;
        isUnitApprover: boolean;
    }>;
    me(user: any): {
        id: any;
        username: any;
        fullName: any;
        mustChangePassword: any;
        roles: any;
        permissions: any;
        unitId: any;
        isUnitApprover: any;
    };
    logout(user: any, response: Response): Promise<{
        ok: boolean;
    }>;
    changePassword(user: any, body: any): Promise<{
        ok: boolean;
    }>;
}
export declare class UsersController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query?: string): import(".prisma/client").Prisma.PrismaPromise<{
        unit: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            code: string;
            slug: string;
            active: boolean;
        } | null;
        id: string;
        username: string;
        fullName: string;
        email: string | null;
        status: import(".prisma/client").$Enums.AccountStatus;
        mustChangePassword: boolean;
        isUnitApprover: boolean;
        roles: ({
            role: {
                id: string;
                name: string;
                code: string;
            };
        } & {
            userId: string;
            roleId: string;
        })[];
    }[]>;
    create(body: any): Promise<{
        id: string;
        username: string;
    }>;
    one(id: string): import(".prisma/client").Prisma.Prisma__UserClient<{
        unit: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            code: string;
            slug: string;
            active: boolean;
        } | null;
        roles: ({
            role: {
                id: string;
                name: string;
                code: string;
            };
        } & {
            userId: string;
            roleId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        username: string;
        fullName: string;
        email: string | null;
        passwordHash: string;
        status: import(".prisma/client").$Enums.AccountStatus;
        mustChangePassword: boolean;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
        unitId: string | null;
        isUnitApprover: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, body: any): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        createdAt: Date;
        username: string;
        fullName: string;
        email: string | null;
        passwordHash: string;
        status: import(".prisma/client").$Enums.AccountStatus;
        mustChangePassword: boolean;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
        unitId: string | null;
        isUnitApprover: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    status(id: string, body: any): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        createdAt: Date;
        username: string;
        fullName: string;
        email: string | null;
        passwordHash: string;
        status: import(".prisma/client").$Enums.AccountStatus;
        mustChangePassword: boolean;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
        unitId: string | null;
        isUnitApprover: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        username: string;
        fullName: string;
        email: string | null;
        passwordHash: string;
        status: import(".prisma/client").$Enums.AccountStatus;
        mustChangePassword: boolean;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
        unitId: string | null;
        isUnitApprover: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
}
export declare class MasterController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    roles(): import(".prisma/client").Prisma.PrismaPromise<({
        permissions: ({
            permission: {
                id: string;
                name: string;
                code: string;
            };
        } & {
            roleId: string;
            permissionId: string;
        })[];
    } & {
        id: string;
        name: string;
        code: string;
    })[]>;
    permissions(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        code: string;
    }[]>;
    units(): import(".prisma/client").Prisma.PrismaPromise<({
        functions: {
            id: string;
            unitId: string;
            code: string;
            active: boolean;
            riskLevel: string | null;
            description: string;
            sourceRef: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        slug: string;
        active: boolean;
    })[]>;
    unit(body: any): import(".prisma/client").Prisma.Prisma__UnitClient<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        slug: string;
        active: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    standards(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string;
        active: boolean;
        title: string;
        source: string;
        standardType: string;
        regulationReference: string | null;
        description: string | null;
    }[]>;
    isoClauses(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string;
        active: boolean;
        title: string;
        description: string | null;
    }[]>;
    questions(module?: string, dimension?: string, query?: string, pageValue?: string, limitValue?: string): Promise<{
        data: ({
            standard: {
                id: string;
                code: string;
                active: boolean;
                title: string;
                source: string;
                standardType: string;
                regulationReference: string | null;
                description: string | null;
            } | null;
            isoClause: {
                id: string;
                code: string;
                active: boolean;
                title: string;
                description: string | null;
            } | null;
            unitMaps: ({
                unit: {
                    id: string;
                    createdAt: Date;
                    name: string;
                    updatedAt: Date;
                    code: string;
                    slug: string;
                    active: boolean;
                };
            } & {
                unitId: string;
                questionId: string;
            })[];
            functionMaps: ({
                function: {
                    id: string;
                    unitId: string;
                    code: string;
                    active: boolean;
                    riskLevel: string | null;
                    description: string;
                    sourceRef: string | null;
                };
            } & {
                questionId: string;
                functionId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            active: boolean;
            moduleCode: string;
            dimension: import(".prisma/client").$Enums.QuestionDimension;
            criterionSource: string;
            question: string;
            auditObjective: string | null;
            expectedEvidence: string | null;
            testMethod: string | null;
            regulatoryReference: string | null;
            regulatorySummary: string | null;
            internalRequirement: string | null;
            businessProcess: string | null;
            riskLevel: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            required: boolean;
            version: number;
            standardId: string | null;
            isoClauseId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    createQuestion(body: any): import(".prisma/client").Prisma.Prisma__MasterQuestionClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        active: boolean;
        moduleCode: string;
        dimension: import(".prisma/client").$Enums.QuestionDimension;
        criterionSource: string;
        question: string;
        auditObjective: string | null;
        expectedEvidence: string | null;
        testMethod: string | null;
        regulatoryReference: string | null;
        regulatorySummary: string | null;
        internalRequirement: string | null;
        businessProcess: string | null;
        riskLevel: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        required: boolean;
        version: number;
        standardId: string | null;
        isoClauseId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    updateQuestion(id: string, body: any): import(".prisma/client").Prisma.Prisma__MasterQuestionClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        active: boolean;
        moduleCode: string;
        dimension: import(".prisma/client").$Enums.QuestionDimension;
        criterionSource: string;
        question: string;
        auditObjective: string | null;
        expectedEvidence: string | null;
        testMethod: string | null;
        regulatoryReference: string | null;
        regulatorySummary: string | null;
        internalRequirement: string | null;
        businessProcess: string | null;
        riskLevel: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        required: boolean;
        version: number;
        standardId: string | null;
        isoClauseId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    deactivateQuestion(id: string): import(".prisma/client").Prisma.Prisma__MasterQuestionClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        active: boolean;
        moduleCode: string;
        dimension: import(".prisma/client").$Enums.QuestionDimension;
        criterionSource: string;
        question: string;
        auditObjective: string | null;
        expectedEvidence: string | null;
        testMethod: string | null;
        regulatoryReference: string | null;
        regulatorySummary: string | null;
        internalRequirement: string | null;
        businessProcess: string | null;
        riskLevel: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        required: boolean;
        version: number;
        standardId: string | null;
        isoClauseId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    questionTemplate(response: Response): Promise<void>;
}
export declare class DashboardController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    data(user: any): Promise<{
        units: number;
        workspaces: number;
        openFindings: number;
        overdueActions: number;
        unreadNotifications: number;
        roles: any;
        tasks: {
            type: string;
            label: string;
            count: number;
            href: string;
        }[];
    }>;
}

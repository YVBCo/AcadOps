// Prisma's $extends singleton and transaction client expose different generic
// model signatures. The helper only needs these two delegates, so keep that
// boundary structural without coupling it to either client type.
type EnrollmentSyncClient = {
    studentProfile: { findMany: (args: any) => Promise<{ userId: number }[]> };
    nodueSubjectEnrollment: {
        createMany: (args: any) => Promise<unknown>;
        updateMany: (args: any) => Promise<unknown>;
    };
};

/** Create or update the No-Due faculty review rows for students enrolled in a subject. */
export async function syncNoDueSubjectEnrollments(
    db: EnrollmentSyncClient,
    input: {
        tenantId: number;
        subjectId: number;
        studentProfileIds: number[];
        teacherUserId?: number;
    },
): Promise<number> {
    const profileIds = [...new Set(input.studentProfileIds)];
    if (profileIds.length === 0) return 0;

    // Resolve profile IDs to login IDs while enforcing the tenant boundary.
    const profiles = await db.studentProfile.findMany({
        where: { id: { in: profileIds }, user: { tenantId: input.tenantId } },
        select: { userId: true },
    });
    const studentIds = profiles.map(profile => profile.userId);
    if (studentIds.length === 0) return 0;

    await db.nodueSubjectEnrollment.createMany({
        data: studentIds.map(studentId => ({
            tenantId: input.tenantId,
            studentId,
            subjectId: input.subjectId,
            teacherId: input.teacherUserId ?? null,
        })),
        skipDuplicates: true,
    });

    // If HOD assigns or reassigns the subject after students were enrolled,
    // route their still-pending reviews to the newly assigned teacher.
    if (input.teacherUserId !== undefined) {
        await db.nodueSubjectEnrollment.updateMany({
            where: {
                tenantId: input.tenantId,
                subjectId: input.subjectId,
                studentId: { in: studentIds },
                status: 'PENDING',
                isFacultyCleared: false,
            },
            data: { teacherId: input.teacherUserId },
        });
    }

    return studentIds.length;
}

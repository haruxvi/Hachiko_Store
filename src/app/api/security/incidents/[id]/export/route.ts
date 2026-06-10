import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/src/lib/auth/session';
import { requireRole } from '@/src/lib/auth/rbac';
import { buildIncidentReport } from '@/src/lib/services/security.service';
import { writeAudit } from '@/src/lib/services/audit.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const roleError = requireRole(session, ['SELLER']);
  if (roleError) return roleError;

  const { id } = await params;
  const report = await buildIncidentReport(id);
  if (!report) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Incidencia no encontrada' } },
      { status: 404 },
    );
  }

  // Toda exportación queda auditada: quién, cuándo y desde qué IP
  await writeAudit({
    actorId: session!.sub,
    actorRole: session!.role,
    action: 'SECURITY_REPORT_EXPORTED',
    targetType: 'SecurityIncident',
    targetId: id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="incidencia-${report.incidencia.numero}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}

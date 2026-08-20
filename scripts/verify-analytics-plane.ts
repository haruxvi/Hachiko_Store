/**
 * Verificación puntual (Fase 0): confirma que las tablas del plano analítico
 * existen y son consultables. Solo cuenta filas (0 al inicio). Ejecutar con:
 *   pnpm tsx scripts/verify-analytics-plane.ts
 */
import { db } from '../src/lib/db';

async function main() {
  const checks = {
    OrderStatusHistory: db.orderStatusHistory.count(),
    AnalyticsEvent: db.analyticsEvent.count(),
    ModelRun: db.modelRun.count(),
    KpiSnapshot: db.kpiSnapshot.count(),
    DemandForecast: db.demandForecast.count(),
    RestockSuggestion: db.restockSuggestion.count(),
    ProductRecommendation: db.productRecommendation.count(),
    CustomerSegment: db.customerSegment.count(),
    RiskScore: db.riskScore.count(),
  };

  const entries = Object.entries(checks);
  const results = await Promise.all(entries.map(([, p]) => p));

  console.log('\nPlano analítico — tablas creadas:\n');
  entries.forEach(([name], i) => {
    console.log(`  ✓ ${name.padEnd(24)} ${results[i]} filas`);
  });
  console.log('\nTodo consultable desde Prisma. Fase 0 (esquema) lista.\n');
}

main()
  .catch((e) => {
    console.error('✗ Falló la verificación:', e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

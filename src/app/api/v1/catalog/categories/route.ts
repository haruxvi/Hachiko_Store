import { getCategories } from '@/src/lib/services/catalog.service';
import { api, ok, options } from '@/src/lib/api/v1';

export { options as OPTIONS };

export const GET = api(async () => {
  const categories = await getCategories(true);
  return ok(categories.filter((c) => !c.archivedAt).map((c) => ({ slug: c.slug, name: c.name, description: c.description })));
});

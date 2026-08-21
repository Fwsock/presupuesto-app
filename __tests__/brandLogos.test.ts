import { BRAND_IDS } from '../lib/brands/brandCatalog';
import { BRAND_LOGOS } from '../lib/brands/brandLogos';

describe('BRAND_LOGOS', () => {
  it('has a logo (real or placeholder) entry for every brand in the catalog', () => {
    const missing = BRAND_IDS.filter((id) => BRAND_LOGOS[id] == null);
    expect(missing).toEqual([]);
  });

  it('has no leftover entries for an id that no longer exists in the catalog', () => {
    const orphaned = Object.keys(BRAND_LOGOS).filter((id) => !BRAND_IDS.includes(id));
    expect(orphaned).toEqual([]);
  });
});

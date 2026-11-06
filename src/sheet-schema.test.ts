import { describe, expect, it } from 'vitest';
import { HEADERS, TAB_NAMES, validateGrids, type Grids } from './sheet-schema';
export function fixture(): Grids {
  const grids = Object.fromEntries(TAB_NAMES.map(tab => [tab, [[...HEADERS[tab]]]])) as Grids;
  grids.WorkoutPlans.push(
    ['home-mon', 1, 'home', '居家徒手訓練', 20, 30, 'https://www.youtube.com/results?search_query=徒手訓練', true, '2026-11-06T00:00:00Z'],
    ['walk-wed', 3, 'walk', '健身房上坡快走', 30, 60, '', true, '2026-11-06T00:00:00Z'],
    ['home-sat', 6, 'home', '居家徒手訓練', 20, 30, 'https://www.youtube.com/results?search_query=徒手訓練', true, '2026-11-06T00:00:00Z'],
  );
  return grids;
}
describe('Google Sheets v1 contract', () => {
  it('accepts a clean five-tab template without real health records', () => {
    const result = validateGrids(fixture());
    expect(result.ok).toBe(true);
    expect(result.counts).toEqual({ HealthMetrics: 0, DailySteps: 0, WorkoutLogs: 0, WorkoutPlans: 3, SyncLogs: 0 });
  });
  it('rejects translated or reordered API headers', () => { const grids = fixture(); grids.DailySteps[0][0] = '編號'; expect(validateGrids(grids).ok).toBe(false); });
  it('requires a genuine boolean and all three default plans', () => { const grids = fixture(); grids.WorkoutPlans[1][7] = 'TRUE'; expect(validateGrids(grids).ok).toBe(false); });
  it('rejects malformed dates, duplicate IDs and duplicate daily steps', () => {
    const grids = fixture();
    const row = ['a', '2026-02-30', 'Asia/Taipei', 1000, 'health', 'phone', 1, '2026-11-06T00:00:00Z'];
    grids.DailySteps.push(row, row);
    const result = validateGrids(grids);
    expect(result.errors.some(e => e.includes('date'))).toBe(true);
    expect(result.errors.some(e => e.includes('ID'))).toBe(true);
    expect(result.errors.some(e => e.includes('canonical'))).toBe(true);
  });
  it('rejects wrong units and percentage scaling', () => {
    const grids = fixture();
    grids.HealthMetrics.push(['m1', 'sample1', '2026-11-06T00:00:00Z', '2026-11-06', 'Asia/Taipei', 'bodyFat', 2300, '%', 'health', 'phone', '2026-11-06T00:00:00Z', '']);
    expect(validateGrids(grids).ok).toBe(false);
  });
  it('rejects unknown timezones and non-YouTube or javascript links', () => {
    const grids = fixture(); grids.WorkoutPlans[1][6] = 'javascript:alert(1)';
    grids.DailySteps.push(['steps', '2026-11-06', 'Made/Up', 100, 'health', 'phone', 1, '2026-11-06T00:00:00Z']);
    expect(validateGrids(grids).errors.length).toBeGreaterThanOrEqual(2);
  });
  it('validates the local day at a timezone boundary', () => {
    const grids = fixture();
    grids.HealthMetrics.push(['m1', 'sample1', '2026-11-05T17:00:00Z', '2026-11-05', 'Asia/Taipei', 'weight', 68.5, 'kg', 'health', 'phone', '2026-11-06T00:00:00Z']);
    expect(validateGrids(grids).errors.some(e => e.includes('日期不一致'))).toBe(true);
    grids.HealthMetrics[1][3] = '2026-11-06';
    expect(validateGrids(grids).ok).toBe(true);
  });
  it('accepts optional empty cells without fabricating measurements', () => {
    const grids = fixture(); grids.HealthMetrics.push(['m1', 'sample1', '2026-11-06T00:00:00Z', '2026-11-06', 'Asia/Taipei', 'weight', 68.5, 'kg', 'health', 'phone', '2026-11-06T00:00:00Z']);
    grids.WorkoutLogs.push(['w1', '2026-11-06', 'Asia/Taipei', 'home', 25, 100, '', 'manual', 1, '2026-11-06T00:00:00Z']);
    expect(validateGrids(grids).ok).toBe(true);
  });
});

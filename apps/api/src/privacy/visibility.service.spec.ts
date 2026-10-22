import { VisibilityService } from './visibility.service';

// До задачи T1.A5 это заглушка: всё видно всем. Тест фиксирует сигнатуры, от которых зависят модули B.
describe('VisibilityService (заглушка)', () => {
  const service = new VisibilityService();

  it('canViewProfile и canViewContent разрешают просмотр', async () => {
    await expect(service.canViewProfile('viewer', 'owner')).resolves.toBe(true);
    await expect(service.canViewContent('viewer', 'owner')).resolves.toBe(true);
  });

  it('assertCanViewProfile и assertCanViewContent не бросают', async () => {
    await expect(service.assertCanViewProfile('viewer', 'owner')).resolves.toBeUndefined();
    await expect(service.assertCanViewContent('viewer', 'owner')).resolves.toBeUndefined();
  });

  it('getHiddenUserIds возвращает пустой список', async () => {
    await expect(service.getHiddenUserIds('viewer')).resolves.toEqual([]);
  });

  it('visibleUserWhere возвращает пустое условие', () => {
    expect(service.visibleUserWhere('viewer')).toEqual({});
  });
});

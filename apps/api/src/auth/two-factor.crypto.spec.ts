import {
  decryptSecret,
  encryptSecret,
  generateSecret,
  totp,
  verifyTotp,
} from './two-factor.crypto';

describe('two-factor.crypto', () => {
  // Тестовый вектор RFC 6238 (SHA-1, секрет "12345678901234567890"), t = 59 с: 94287082 -> 6 цифр 287082.
  const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('totp совпадает с вектором RFC 6238', () => {
    expect(totp(RFC_SECRET, 59_000)).toBe('287082');
  });

  it('verifyTotp принимает соседний шаг и отклоняет далёкий и неверный формат', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 59_000 + 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '287082', 59_000 + 120_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abc123', 59_000)).toBe(false);
  });

  it('шифрование туда-обратно; чужой ключ не расшифровывает', () => {
    const secret = generateSecret();
    const encrypted = encryptSecret(secret, 'k'.repeat(32));
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, 'k'.repeat(32))).toBe(secret);
    expect(() => decryptSecret(encrypted, 'x'.repeat(32))).toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { PasswordSchema } from '@/src/lib/validation/schemas';

const ok = (pw: string) => PasswordSchema.safeParse(pw).success;

describe('PasswordSchema — política de contraseñas', () => {
  it('acepta una contraseña fuerte sin números consecutivos', () => {
    expect(ok('Hachiko2487')).toBe(true);
    expect(ok('Perro2580kg')).toBe(true);
  });

  it('exige mínimo 8 caracteres', () => {
    expect(ok('Ab2cdfg')).toBe(false); // 7 caracteres
  });

  it('rechaza más de 128 caracteres', () => {
    expect(ok('A' + 'b'.repeat(130) + '2')).toBe(false);
  });

  it('exige mayúscula, minúscula y número', () => {
    expect(ok('hachiko2487')).toBe(false); // sin mayúscula
    expect(ok('HACHIKO2487')).toBe(false); // sin minúscula
    expect(ok('HachikoPerro')).toBe(false); // sin número
  });

  it('rechaza 3+ números en secuencia ascendente o descendente', () => {
    expect(ok('Hachiko123x')).toBe(false); // 123
    expect(ok('Hachiko321x')).toBe(false); // 321
    expect(ok('Hachiko7890')).toBe(false); // 789 dentro de 7890
  });

  it('rechaza 3+ números repetidos', () => {
    expect(ok('Hachiko111x')).toBe(false); // 111
  });

  it('permite pares o secuencias cortas que no llegan a 3 dígitos seguidos', () => {
    expect(ok('Hachiko12x')).toBe(true); // solo 2 dígitos juntos
    expect(ok('Ab12cd34ef')).toBe(true); // dígitos separados por letras
  });
});

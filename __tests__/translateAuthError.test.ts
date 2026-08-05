import { translateAuthError } from '../features/auth/errors';

describe('translateAuthError', () => {
  it('translates known Supabase Auth messages', () => {
    expect(translateAuthError(new Error('Invalid login credentials'))).toBe('Email o contraseña incorrectos');
    expect(translateAuthError(new Error('User already registered'))).toBe('El correo ya está registrado');
    expect(translateAuthError(new Error('Token has expired or is invalid'))).toBe(
      'El código es incorrecto o ya expiró. Solicita uno nuevo.'
    );
  });

  it('never surfaces a raw JSON/Response dump to the user (500/SMTP-flavored)', () => {
    // The exact shape reported in production: a stringified fetch Response
    // object as the Error's own .message, from a failed signup request.
    const rawResponseDump = JSON.stringify({
      type: 'default',
      status: 500,
      ok: false,
      statusText: '',
      headers: { map: { 'content-type': 'application/json' } },
      url: 'https://odiyxrinzimdzsklgrct.supabase.co/auth/v1/signup',
      bodyUsed: false,
    });
    const result = translateAuthError(new Error(rawResponseDump));
    expect(result).not.toContain('{');
    expect(result).not.toContain('supabase.co');
    expect(result).toBe('No se pudo enviar el correo de confirmación. Inténtalo de nuevo más tarde.');
  });

  it('never surfaces a raw JSON dump with no recognizable pattern either (generic catch-all)', () => {
    const rawJsonDump = JSON.stringify({ foo: 'bar', nested: { a: 1, b: [1, 2, 3] } });
    const result = translateAuthError(new Error(rawJsonDump));
    expect(result).not.toContain('{');
    expect(result).toBe('Ocurrió un error inesperado. Inténtalo de nuevo más tarde.');
  });

  it('gives a specific message for a 500 / SMTP failure sending the confirmation email', () => {
    expect(translateAuthError(new Error('Error sending confirmation email: unexpected_failure'))).toBe(
      'No se pudo enviar el correo de confirmación. Inténtalo de nuevo más tarde.'
    );
  });

  it('gives a specific message for a network failure', () => {
    expect(translateAuthError(new Error('Network request failed'))).toBe(
      'Error de conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    );
  });

  it('passes through a short, unrecognized message as-is', () => {
    expect(translateAuthError(new Error('Something specific went wrong'))).toBe('Something specific went wrong');
  });

  it('handles non-Error values without throwing', () => {
    expect(translateAuthError('plain string error')).toBe('plain string error');
  });
});

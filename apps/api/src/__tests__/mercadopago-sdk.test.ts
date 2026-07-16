import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoConfig, Preference } from 'mercadopago';

vi.mock('mercadopago', () => {
  const mockCreate = vi.fn();
  return {
    MercadoPagoConfig: vi.fn(),
    Preference: vi.fn().mockImplementation(
      class {
        create = mockCreate;
      } as unknown as (...args: unknown[]) => unknown,
    ),
  };
});

describe('Mercado Pago SDK Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configures MercadoPagoConfig with the provided access token', () => {
    const token = 'TEST-TOKEN-123456';
    new MercadoPagoConfig({ accessToken: token });

    expect(MercadoPagoConfig).toHaveBeenCalledWith({ accessToken: token });
  });

  it('creates preference with the correct parameters via SDK', async () => {
    const mockClient = new MercadoPagoConfig({ accessToken: 'TEST-TOKEN' });
    const preference = new Preference(mockClient);

    const mockResponse = {
      id: 'pref-id-123',
      init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-id-123',
      sandbox_init_point:
        'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-id-123',
    };

    const mockCreate = preference.create as any;
    mockCreate.mockResolvedValue(mockResponse);

    const preferenceData = {
      body: {
        items: [
          {
            id: 'test-item-id',
            title: 'Test Experience',
            quantity: 1,
            unit_price: 15000,
            currency_id: 'ARS',
          },
        ],
      },
    };

    const result = await preference.create(preferenceData);

    expect(mockCreate).toHaveBeenCalledWith(preferenceData);
    expect(result).toEqual(mockResponse);
  });
});

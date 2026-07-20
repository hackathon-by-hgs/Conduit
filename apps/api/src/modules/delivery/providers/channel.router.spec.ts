import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../../config/config.service';
import { ResendProvider } from '../email/resend.provider';
import { SmsProvider } from '../sms/sms.provider';
import { ChannelRouter } from './channel.router';

/** No Resend key ⇒ simulated email; zero fail rate ⇒ deterministic results. */
const config = {
  resendApiKey: '',
  emailFrom: 'conduit@example.dev',
  deliveryFailRate: 0,
} as AppConfigService;

const router = new ChannelRouter(new ResendProvider(config), new SmsProvider(config));

describe('ChannelRouter · channel resolution', () => {
  it('defaults to email when the payload does not ask for a channel', () => {
    expect(router.resolveChannel({})).toBe('email');
  });

  it('honours a supported channel from the payload', () => {
    expect(router.resolveChannel({ channel: 'sms' })).toBe('sms');
    expect(router.resolveChannel({ channel: 'email' })).toBe('email');
  });

  /**
   * The event is already durably stored by this point. Dropping it because of an unknown
   * channel would violate the product's whole premise, so an unusable value degrades to
   * email rather than failing.
   */
  it('falls back to email for unknown or unregistered channels', () => {
    expect(router.resolveChannel({ channel: 'carrier-pigeon' })).toBe('email');
    expect(router.resolveChannel({ channel: 42 })).toBe('email');
    // 'webhook' is a valid Channel in the contract but has no provider registered yet.
    expect(router.resolveChannel({ channel: 'webhook' })).toBe('email');
  });
});

describe('ChannelRouter · recipient resolution', () => {
  it('prefers an explicit recipient', () => {
    expect(router.resolveRecipient({ to: 'a@b.com' }, 'email', 'stripe')).toBe('a@b.com');
    expect(router.resolveRecipient({ to: '+15551234567' }, 'sms', 'stripe')).toBe('+15551234567');
  });

  it('falls back to a per-source sink for email so the pipeline still flows', () => {
    expect(router.resolveRecipient({}, 'email', 'stripe')).toBe('stripe@webhooks.conduit.dev');
    expect(router.resolveRecipient({ to: '' }, 'email', 'github')).toBe(
      'github@webhooks.conduit.dev',
    );
  });

  it('has no sensible SMS default, so an absent number stays empty and fails validation', () => {
    expect(router.resolveRecipient({}, 'sms', 'stripe')).toBe('');
  });
});

describe('ChannelRouter · dispatch', () => {
  it('routes email to the (simulated) Resend provider', async () => {
    const result = await router.send('email', { to: 'a@b.com', type: 'invoice.paid', payload: {} });
    expect(result.ok).toBe(true);
    expect(result.providerId).toMatch(/^sim_/);
  });

  it('routes SMS to the stub provider and returns a receipt', async () => {
    const result = await router.send('sms', {
      to: '+15551234567',
      type: 'invoice.paid',
      payload: {},
    });
    expect(result.ok).toBe(true);
    expect(result.providerId).toMatch(/^sms_stub_/);
  });

  it('rejects a non-E.164 SMS recipient as non-retryable, so it dead-letters at once', async () => {
    for (const bad of ['not-a-number', '5551234567', '+0123', '']) {
      const result = await router.send('sms', { to: bad, type: 't', payload: {} });
      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(422);
    }
  });

  it('reports an unsupported channel as a terminal fault rather than throwing', async () => {
    const result = await router.send('webhook', { to: 'x', type: 't', payload: {} });
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('unsupported_channel');
  });
});

describe('SmsProvider · injected failures', () => {
  it('honours DELIVERY_FAIL_RATE so SMS exercises the same retry path as email', async () => {
    const always = new SmsProvider({ ...config, deliveryFailRate: 1 } as AppConfigService);
    const result = await always.send({ to: '+15551234567', type: 't', payload: {} });
    expect(result.ok).toBe(false);
    // Injected outages are transient, so they must remain retryable.
    expect(result.retryable).toBe(true);
  });
});

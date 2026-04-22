import { defineCommand } from '../../command';
import { resolveCredential } from '../../auth/resolver';
import { loadCredentials } from '../../auth/credentials';
import { formatOutput, detectOutputFormat } from '../../output/formatter';
import { requestJson } from '../../client/http';
import { quotaEndpoint } from '../../client/endpoints';
import { renderQuotaTable } from '../../output/quota-table';
import { maskToken } from '../../utils/token';
import { modelsByProvider } from '../../providers/registry';
import type { Config } from '../../config/schema';
import type { GlobalFlags } from '../../types/flags';
import type { QuotaResponse } from '../../types/api';

export default defineCommand({
  name: 'auth status',
  description: 'Show current authentication state and quota snapshot',
  usage: 'pimx auth status',
  examples: [
    'pimx auth status',
    'pimx auth status --output json',
  ],
  async run(config: Config, _flags: GlobalFlags) {
    const format = detectOutputFormat(config.output);

    let minimaxCred: Awaited<ReturnType<typeof resolveCredential>> | null = null;
    let minimaxError: string | undefined;
    try {
      minimaxCred = await resolveCredential(config);
    } catch (e) {
      minimaxError = (e as Error).message;
    }

    const piapiKey = config.providers?.piapi?.apiKey;
    const piapiConfigured = !!piapiKey;

    if (format !== 'text') {
      const providers: Record<string, unknown> = {};
      if (minimaxCred) {
        const p: Record<string, unknown> = {
          method: minimaxCred.method,
          source: minimaxCred.source,
          key: maskToken(minimaxCred.token),
          models: modelsByProvider('minimax').map(m => m.model),
        };
        if (minimaxCred.method === 'oauth') {
          const creds = await loadCredentials();
          if (creds) {
            p.token_expires = creds.expires_at;
            if (creds.account) p.account = creds.account;
          }
        }
        providers.minimax = p;
      } else {
        providers.minimax = { configured: false, error: minimaxError };
      }
      providers.piapi = piapiConfigured
        ? {
            source: 'config.providers.piapi',
            key: maskToken(piapiKey!),
            models: modelsByProvider('piapi').map(m => m.model),
          }
        : { configured: false };
      console.log(formatOutput({ providers }, format));
      return;
    }

    // Text format
    console.log('Authentication Status:');
    console.log('');
    console.log('MiniMax:');
    if (minimaxCred) {
      console.log(`  Method: ${minimaxCred.method}`);
      console.log(`  Source: ${minimaxCred.source}`);
      console.log(`  Key:    ${maskToken(minimaxCred.token)}`);
      if (minimaxCred.method === 'oauth') {
        const creds = await loadCredentials();
        if (creds) {
          if (creds.account) console.log(`  Account: ${creds.account}`);
          const expiresAt = new Date(creds.expires_at);
          const minutesLeft = Math.round((expiresAt.getTime() - Date.now()) / 60000);
          console.log(`  Expires in: ${minutesLeft} minutes`);
        }
      }
      console.log(`  Models: ${modelsByProvider('minimax').map(m => m.model).join(', ')}`);
    } else {
      console.log('  Not authenticated. Run: pimx auth login');
    }

    console.log('');
    console.log('PiAPI:');
    if (piapiConfigured) {
      console.log(`  Source: config.providers.piapi`);
      console.log(`  Key:    ${maskToken(piapiKey!)}`);
      console.log(`  Models: ${modelsByProvider('piapi').map(m => m.model).join(', ')}`);
    } else {
      console.log('  Not configured. Run: pimx auth login --provider piapi --api-key <key>');
    }

    if (minimaxCred) {
      console.log('');
      process.stderr.write('Fetching MiniMax quota snapshot...\n');
      try {
        const url = quotaEndpoint(config.baseUrl);
        const quota = await requestJson<QuotaResponse>(config, { url, method: 'GET' });
        renderQuotaTable(quota.model_remains || [], config);
      } catch (e) {
        console.log(`  Quota fetch failed: ${(e as Error).message}`);
      }
    }
  },
});

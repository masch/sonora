import { eq } from 'drizzle-orm';
import { createDbClient } from '../db';
import { experiences } from '../db/schema';

import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not defined.');
}

const apiPort = 8787;
const apiBaseUrl = `http://localhost:${apiPort}`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }
  const isNeon = databaseUrl.includes('neon.tech');
  const db = isNeon
    ? createDbClient('neon', databaseUrl)
    : createDbClient('pg', new Pool({ connectionString: databaseUrl }));

  try {
    console.log('1. Fetching or seeding a test experience in the database...');
    let [experience] = await db
      .select()
      .from(experiences)
      .where(eq(experiences.free, false))
      .limit(1);

    if (!experience) {
      console.log('No paid experiences found. Seeding a test experience...');
      const [newExp] = await db
        .insert(experiences)
        .values({
          id: crypto.randomUUID(),
          slug: `polling-test-${crypto.randomUUID()}`,
          title: 'Sonora Polling Test Experience',
          description: 'A paid experience created for testing the Mercado Pago integration.',
          format: 'trip',
          themeKey: 'landscapes',
          price: 15000,
          free: false,
          audioUrl: 'https://example.com/audio.mp3',
          durationSeconds: 120,
          latitude: -32.211913,
          longitude: -64.73809,
          imageKey: 'trips-deriva-centro-cover',
        })
        .returning();
      experience = newExp;
      console.log(`Seeded experience: ${experience.title} (ID: ${experience.id})`);
    } else {
      console.log(`Using existing experience: ${experience.title} (ID: ${experience.id})`);
    }

    console.log('\n2. Calling local Hono API /payments/create endpoint...');
    const createResponse = await fetch(`${apiBaseUrl}/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        experienceId: experience.id,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create payment via API: ${createResponse.status} - ${errorText}`);
    }

    const createData = (await createResponse.json()) as {
      purchaseId: string;
      checkoutUrl: string;
    };

    console.log('\n==================================================');
    console.log('Purchase ID (Local DB):', createData.purchaseId);
    console.log('Checkout URL (Sandbox):');
    console.log(createData.checkoutUrl);
    console.log('==================================================\n');

    console.log('👉 INSTRUCTIONS:');
    console.log('1. Open the Sandbox URL in your browser.');
    console.log('2. Log in using your test buyer account:');
    console.log('   Email: test_user_XXXX@testuser.com | Password: XXXX');
    console.log('3. Complete the payment using "Dinero en Cuenta" (account money).');
    console.log(
      '4. Once you complete the payment, this script will detect it by polling the local API.',
    );

    console.log(
      '\nWaiting for transaction to be processed (polling local Hono API every 5 seconds)...',
    );

    let approvedPaymentFound = false;
    const maxAttempts = 30; // 2.5 minutes

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      process.stdout.write(`\rPolling local API attempt ${attempt}/${maxAttempts}... `);

      const statusResponse = await fetch(
        `${apiBaseUrl}/payments/status/${createData.purchaseId}?sync=true`,
      );
      if (!statusResponse.ok) {
        console.error(`\nError: Failed to query status endpoint: ${statusResponse.status}`);
        await sleep(5000);
        continue;
      }

      const statusData = (await statusResponse.json()) as {
        status: string;
        email?: string;
      };

      if (statusData.status === 'approved') {
        console.log(
          `\nDetected status: approved (accredited for ${statusData.email || 'unknown email'})`,
        );
        console.log(
          '\n✅ SUCCESS: Payment approved! Local API database synchronized and verified.',
        );
        approvedPaymentFound = true;
        break;
      } else if (statusData.status === 'rejected') {
        console.log('\n❌ FAILED: Payment was rejected/cancelled.');
        break;
      }

      await sleep(5000);
    }

    if (!approvedPaymentFound) {
      console.log('\n⏱️ Timeout: No approved payment was detected within 2.5 minutes.');
    }
  } catch (error) {
    console.error('\nError during polling test execution:', error);
  } finally {
    process.exit(0);
  }
}

run();

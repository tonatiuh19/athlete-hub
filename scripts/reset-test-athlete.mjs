#!/usr/bin/env node
/**
 * reset-test-athlete.mjs
 *
 * Cleans a test athlete completely for local / staging QA:
 *   1. Reverts event sold counts for their confirmed registrations
 *   2. Removes DB rows (registrations, payments, sessions, OTP, waitlist, …)
 *   3. Deletes the Stripe customer (cancels open PaymentIntents first)
 *   4. Deletes the Clerk user (by primary email)
 *
 * Usage:
 *   node scripts/reset-test-athlete.mjs <email>
 *   node scripts/reset-test-athlete.mjs <email> --dry-run
 *   node scripts/reset-test-athlete.mjs <email> --skip-stripe --skip-clerk
 *
 * Reads credentials from .env in the project root.
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import Stripe from "stripe";
import { createClerkClient } from "@clerk/backend";

// Seed / demo athletes from mock data — require --force to wipe
const PROTECTED_EMAILS = new Set(
  [
    "felix.gomez@example.com",
    "maria.lopez@example.com",
    "carlos.ruiz@example.com",
    "ana.torres@example.com",
    "diego.martinez@example.com",
    "lucia.herrera@example.com",
  ].map((e) => e.toLowerCase()),
);

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const emailArg = positional[0]?.trim().toLowerCase();
const dryRun = flags.has("--dry-run");
const skipStripe = flags.has("--skip-stripe");
const skipClerk = flags.has("--skip-clerk");
const force = flags.has("--force");

if (!emailArg) {
  console.error(`
Usage:
  node scripts/reset-test-athlete.mjs <email> [options]

Options:
  --dry-run       Show what would be deleted without making changes
  --skip-stripe   Skip Stripe customer cleanup
  --skip-clerk    Skip Clerk user deletion
  --force         Allow deleting seed/demo athletes from mock data

Examples:
  node scripts/reset-test-athlete.mjs axgoomez@gmail.com
  npm run reset:test-athlete -- axgoomez@gmail.com --dry-run
`);
  process.exit(1);
}

if (PROTECTED_EMAILS.has(emailArg) && !force) {
  console.error(
    `Refusing to delete protected seed athlete "${emailArg}". Pass --force to override.`,
  );
  process.exit(1);
}

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "false" ? undefined : { minVersion: "TLSv1.2" },
};

const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripe = stripeKey ? new Stripe(stripeKey) : null;

const clerkKey = process.env.CLERK_SECRET_KEY?.trim();
const clerk = clerkKey ? createClerkClient({ secretKey: clerkKey }) : null;

function log(icon, message) {
  console.log(`${icon} ${message}`);
}

async function revertSoldCounts(db, athleteId) {
  const [rows] = await db.execute(
    `SELECT event_id, event_category_id, status
     FROM registrations
     WHERE athlete_id = ? AND status = 'confirmed' AND deleted_at IS NULL`,
    [athleteId],
  );

  if (rows.length === 0) {
    log("➖", "No confirmed registrations to revert counts for");
    return;
  }

  for (const row of rows) {
    if (dryRun) {
      log(
        "🔍",
        `[dry-run] Would decrement sold_count for category ${row.event_category_id} and registration_count for event ${row.event_id}`,
      );
      continue;
    }
    await db.execute(
      `UPDATE event_categories
       SET sold_count = GREATEST(0, sold_count - 1)
       WHERE id = ?`,
      [row.event_category_id],
    );
    await db.execute(
      `UPDATE events
       SET registration_count = GREATEST(0, registration_count - 1)
       WHERE id = ?`,
      [row.event_id],
    );
  }

  log("✅", `Reverted sold counts for ${rows.length} confirmed registration(s)`);
}

async function cleanupStripe(stripeCustomerId) {
  if (skipStripe) {
    log("⏭️ ", "Skipping Stripe (--skip-stripe)");
    return;
  }
  if (!stripe) {
    log("⚠️ ", "STRIPE_SECRET_KEY not set — skipping Stripe cleanup");
    return;
  }
  if (!stripeCustomerId) {
    log("➖", "No Stripe customer on record");
    return;
  }

  log("💳", "Stripe…");

  if (dryRun) {
    log("🔍", `[dry-run] Would cancel open PIs and delete customer ${stripeCustomerId}`);
    return;
  }

  try {
    const intents = await stripe.paymentIntents.list({
      customer: stripeCustomerId,
      limit: 100,
    });
    for (const pi of intents.data) {
      if (
        ["requires_payment_method", "requires_confirmation", "requires_action"].includes(
          pi.status,
        )
      ) {
        await stripe.paymentIntents.cancel(pi.id);
        log("   ✅", `Canceled PaymentIntent ${pi.id}`);
      }
    }

    await stripe.customers.del(stripeCustomerId);
    log("   ✅", `Customer deleted: ${stripeCustomerId}`);
  } catch (err) {
    if (err.code === "resource_missing") {
      log("   ⚠️ ", "Customer not found in Stripe, skipping");
    } else {
      console.warn(`   ❌ Stripe error: ${err.message}`);
    }
  }
}

async function cleanupClerk(email) {
  if (skipClerk) {
    log("⏭️ ", "Skipping Clerk (--skip-clerk)");
    return;
  }
  if (!clerk) {
    log("⚠️ ", "CLERK_SECRET_KEY not set — skipping Clerk cleanup");
    return;
  }

  log("🔐", "Clerk…");

  const { data: users } = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 10,
  });

  if (users.length === 0) {
    log("   ➖", "No Clerk user for this email");
    return;
  }

  for (const user of users) {
    if (dryRun) {
      log("🔍", `[dry-run] Would delete Clerk user ${user.id}`);
      continue;
    }
    await clerk.users.deleteUser(user.id);
    log("   ✅", `Deleted Clerk user ${user.id}`);
  }
}

async function cleanupDatabase(db, athlete) {
  const tag = `[${athlete.email} | id=${athlete.id}]`;
  log("🗄️ ", `Database ${tag}`);

  const [regCount] = await db.execute(
    `SELECT COUNT(*) AS c FROM registrations WHERE athlete_id = ? AND deleted_at IS NULL`,
    [athlete.id],
  );
  const [payCount] = await db.execute(
    `SELECT COUNT(*) AS c FROM payments WHERE athlete_id = ?`,
    [athlete.id],
  );

  log(
    "   ℹ️ ",
    `${regCount[0].c} registration(s), ${payCount[0].c} payment(s), sessions/OTP cascade on athlete delete`,
  );

  if (dryRun) {
    await revertSoldCounts(db, athlete.id);
    log("🔍", "[dry-run] Would delete invoice_requests, payments, registrations, athlete");
    return;
  }

  await db.beginTransaction();
  try {
    await revertSoldCounts(db, athlete.id);

    const [invoiceResult] = await db.execute(
      `DELETE FROM invoice_requests WHERE athlete_id = ?`,
      [athlete.id],
    );
    if (invoiceResult.affectedRows > 0) {
      log("   ✅", `Deleted ${invoiceResult.affectedRows} invoice request(s)`);
    }

    await db.execute(
      `UPDATE registrations SET payment_id = NULL WHERE athlete_id = ?`,
      [athlete.id],
    );

    const [payResult] = await db.execute(
      `DELETE FROM payments WHERE athlete_id = ?`,
      [athlete.id],
    );
    if (payResult.affectedRows > 0) {
      log("   ✅", `Deleted ${payResult.affectedRows} payment(s)`);
    }

    await db.execute(
      `DELETE FROM registration_transfers
       WHERE from_athlete_id = ? OR to_athlete_id = ?`,
      [athlete.id, athlete.id],
    );

    const [regResult] = await db.execute(
      `DELETE FROM registrations WHERE athlete_id = ?`,
      [athlete.id],
    );
    if (regResult.affectedRows > 0) {
      log("   ✅", `Deleted ${regResult.affectedRows} registration(s)`);
    }

    const [athleteResult] = await db.execute(`DELETE FROM athletes WHERE id = ?`, [
      athlete.id,
    ]);
    log("   ✅", `Athlete deleted (affected: ${athleteResult.affectedRows})`);

    await db.commit();
  } catch (err) {
    await db.rollback();
    throw err;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = await mysql.createConnection(DB_CONFIG);

try {
  const [rows] = await db.execute(
    `SELECT id, email, stripe_customer_id, google_id, apple_id, first_name, last_name
     FROM athletes
     WHERE LOWER(email) = ? AND deleted_at IS NULL
     LIMIT 1`,
    [emailArg],
  );

  if (rows.length === 0) {
    log("⚠️ ", `No athlete in DB for ${emailArg} — will still try Clerk/Stripe by email`);
    await cleanupClerk(emailArg);

    if (stripe && !skipStripe) {
      log("💳", "Stripe (lookup by email)…");
      const customers = await stripe.customers.list({ email: emailArg, limit: 5 });
      for (const customer of customers.data) {
        await cleanupStripe(customer.id);
      }
      if (customers.data.length === 0) {
        log("   ➖", "No Stripe customer with this email");
      }
    }

    console.log("\n🎉 Done (no DB athlete row).\n");
    process.exit(0);
  }

  const athlete = rows[0];

  console.log(`\n🔄 Resetting test athlete: ${athlete.email}${dryRun ? " (dry-run)" : ""}\n`);

  await cleanupDatabase(db, athlete);
  await cleanupStripe(athlete.stripe_customer_id);
  await cleanupClerk(athlete.email);

  console.log("\n🎉 All done! Sign up / register again with a fresh slate.\n");
} finally {
  await db.end();
}

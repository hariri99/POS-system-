import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message) {
  console.error(`\n[create:admin] ${message}\n`);
  process.exit(1);
}

const email = readArg("--email");
const password = readArg("--password");
const fullName = readArg("--name") ?? "Store Admin";

if (!url || !serviceRoleKey) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local. Add your real Supabase project keys first.",
  );
}

if (!email || !password) {
  fail(
    "Usage: npm run create:admin -- --email owner@example.com --password YourStrongPassword123! --name \"Owner Name\"",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data: branch, error: branchError } = await admin
    .from("branches")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (branchError || !branch) {
    throw new Error(
      "No branch found. Run the migration and seed first so the first admin can be attached to a branch.",
    );
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "admin",
    },
  });

  if (createError || !createdUser.user) {
    throw new Error(createError?.message ?? "Unable to create admin user.");
  }

  const profilePayload = {
    id: createdUser.user.id,
    email,
    full_name: fullName,
    role: "admin",
    branch_id: branch.id,
    status: "active",
  };

  const { error: profileError } = await admin.from("profiles").upsert(profilePayload, {
    onConflict: "id",
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  console.log("\n[create:admin] Admin user created successfully.\n");
  console.log(`[create:admin] email: ${email}`);
  console.log(`[create:admin] branch: ${branch.name}`);
  console.log("[create:admin] role: admin");
  console.log("\n[create:admin] You can now sign in on /login with this account.\n");
}

main().catch((error) => fail(error instanceof Error ? error.message : "Unknown admin creation error."));

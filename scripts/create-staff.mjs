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
  console.error(`\n[create:staff] ${message}\n`);
  process.exit(1);
}

function normalizeLoginName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const role = readArg("--role") ?? "employee";
const loginName = normalizeLoginName(readArg("--login") ?? "");
const password = readArg("--password");
const fullName = readArg("--name") ?? "Staff Member";
const email =
  readArg("--email") ??
  (loginName ? `${loginName.replace(/\s+/g, ".")}@staff.proteinos.local` : undefined);

if (!url || !serviceRoleKey) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local. Add your real Supabase project keys first.",
  );
}

if (!["admin", "employee"].includes(role)) {
  fail("Role must be either admin or employee.");
}

if (!loginName || loginName.length < 3 || !password) {
  fail(
    "Usage: npm run create:staff -- --role employee --login omar.cashier --password StrongPassword123! --name \"Omar Cashier\"",
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
      "No branch found. Run the migration and seed first so staff accounts can be attached to a branch.",
    );
  }

  const { data: existingProfiles, error: existingProfileError } = await admin
    .from("profiles")
    .select("id, full_name");

  if (existingProfileError) {
    throw new Error(existingProfileError.message);
  }

  const existingProfile = (existingProfiles ?? []).find(
    (profile) => normalizeLoginName(String(profile.full_name ?? "")) === loginName,
  );

  if (existingProfile) {
    throw new Error(`Staff name "${loginName}" is already in use.`);
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
    },
  });

  if (createError || !createdUser.user) {
    throw new Error(createError?.message ?? "Unable to create staff user.");
  }

  const profilePayload = {
    id: createdUser.user.id,
    email,
    full_name: loginName,
    role,
    branch_id: branch.id,
    status: "active",
  };

  const { error: profileError } = await admin.from("profiles").upsert(profilePayload, {
    onConflict: "id",
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  console.log("\n[create:staff] Staff account created successfully.\n");
  console.log(`[create:staff] staff name: ${loginName}`);
  console.log(`[create:staff] role: ${role}`);
  console.log(`[create:staff] branch: ${branch.name}`);
  console.log(
    "\n[create:staff] The user can now sign in on /login with the staff name and password.\n",
  );
}

main().catch((error) => fail(error instanceof Error ? error.message : "Unknown staff creation error."));

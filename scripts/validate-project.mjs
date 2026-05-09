import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "README.md",
  ".env.example",
  "package.json",
  "app/page.tsx",
  "app/create/page.tsx",
  "components/QuestionBuilder.tsx",
  "lib/questions.ts",
  "lib/supabase/client.ts",
  "lib/supabase/admin.ts",
  "lib/gooddollar/identity.ts",
  "lib/gooddollar/identity.local.example.ts",
  "docs/local-identity.md",
  "components/identity/GoodDollarIdentityGate.tsx",
  "app/api/identity/status/route.ts",
  "supabase/migrations/001_initial_schema.sql",
  "contracts/GoodLearnExam.sol",
  "contracts/GoodLearnRewardPool.sol",
];

for (const file of requiredFiles) {
  await access(file);
}

const envExample = await readFile(".env.example", "utf8");
if (!envExample.includes("SUPABASE_SERVICE_ROLE_KEY=") || !envExample.includes("NEXT_PUBLIC_GOODDOLLAR_TOKEN_ADDRESS=") || !envExample.includes("NEXT_PUBLIC_GOODDOLLAR_IDENTITY_ENV=")) {
  throw new Error(".env.example is missing required project variables");
}

const gitignore = await readFile(".gitignore", "utf8");
if (!gitignore.includes("lib/gooddollar/identity.local.ts")) {
  throw new Error(".gitignore must ignore local identity overrides");
}

const examContract = await readFile("contracts/GoodLearnExam.sol", "utf8");
if (!examContract.includes("revealCorrectAnswers") || !examContract.includes("revealUserAnswers")) {
  throw new Error("GoodLearnExam.sol is missing reveal flow functions");
}

console.log("Project structure validated.");

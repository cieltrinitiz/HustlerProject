# Local identity config

`lib/gooddollar/identity.ts` is committed because the app imports it. It contains types, environment parsing, and wallet normalization only.

For local-only overrides:

```bash
cp lib/gooddollar/identity.local.example.ts lib/gooddollar/identity.local.ts
```

Runtime values belong in `.env.local`:

```env
NEXT_PUBLIC_GOODDOLLAR_IDENTITY_ENV=development
```

`lib/gooddollar/identity.local.ts` is ignored by Git.

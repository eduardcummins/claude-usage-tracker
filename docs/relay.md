# Cluse relay

The relay is a small Cloudflare Worker. It stores the latest encrypted usage snapshot for about 12 hours and then deletes it. It never sees the encryption key, so it cannot read the percentages.

The public URL lives in one file: `relay/public.json`. After the first deploy, set `url` there to the `workers.dev` address Wrangler prints, then run `node helper/cli.js --init` on the computer. That prints a new pairing code and keeps the existing ntfy topic.

## Credential

One Cloudflare API token. In the Cloudflare dashboard, open **My Profile → API Tokens → Create Token** and start from the **Edit Cloudflare Workers** template.

That template includes:

- Account / Workers Scripts / Edit
- Account / Workers KV Storage / Edit
- Account / Account Settings / Read
- User / User Details / Read

Name the token something like `cluse-relay`. Put it in the environment as `CLOUDFLARE_API_TOKEN`. Do not commit it, and do not put it in `relay/public.json`.

## Command

From the repository root, with that token set:

```bash
npm run deploy --prefix relay
```

The script creates the KV namespace on the first run, writes its id into `relay/wrangler.jsonc`, and deploys the Worker. The free Workers and KV limits are enough for one household checking every 10 minutes.

Local checks, without a token:

```bash
npm test --prefix relay
```

That runs the Worker in Miniflare, publishes a snapshot with the helper, and decrypts it with the phone code.

# SONORA

SONORA is a browser based music guessing game. Create a room, share its code with friends, and identify songs from short previews. The interface supports English and Thai.

## Features

- **Classic:** guess songs together across timed rounds.
- **Song Bomb:** name a song or artist before the timer runs out; players have limited lives.
- **Solo Play:** play on your own.
- Multiplayer rooms with shareable room codes, live scoreboards, and synchronized rounds.
- Song catalogs grouped by genre, with difficulty and answer choice settings.
- Song previews and artwork are looked up from the Apple iTunes catalog.
- Cloudflare Worker APIs and WebSockets, with Durable Objects for room state.

## Run locally

You’ll need Node.js and npm. From the project directory, install dependencies and start the local Cloudflare development server

The `dev` script starts Wrangler with the project’s Worker and local Durable Object support. It also stores Wrangler’s local state in a temporary directory.

## Deploy to Cloudflare

1. Create or select a Cloudflare account with Workers enabled.
2. Authenticate Wrangler from your terminal:

   ```sh
   npx wrangler login
   ```

3. Deploy the Worker and static assets:

   ```sh
   npm run deploy
   ```

The deployment configuration is in [`wrangler.toml`](wrangler.toml). The Worker serves the site assets and handles `/api/*` and `/ws/*`; room state uses the `GAME_ROOMS` Durable Object binding.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Main page and app shell |
| `room.html` | Room setup and join page |
| `styles.css` | Site, room, and game styles |
| `app.js` | Interface, game logic, song catalog loading, and language switching |
| `multiplayer.js` | Room creation and joining, multiplayer game state, and lobby UI |
| `worker.js` | Cloudflare Worker API, WebSocket handling, and Durable Object room logic |
| `favicon.svg` | Record icon shown in browser tabs |
| `package.json` | Project scripts and Wrangler dependency declaration |
| `package-lock.json` | Locked npm dependency versions |
| `wrangler.toml` | Cloudflare Worker, static asset, and Durable Object configuration |
| `scripts/dev.js` | Local Wrangler development server setup |
| `scripts/deploy-with-retry.js` | Cloudflare deployment script with retries for transient API errors |
| `.github/workflows/node.js.yml` | GitHub Actions static site file check |
| `.assetsignore` | Files excluded from Cloudflare static asset uploads |
| `.gitignore` | Local dependencies and Wrangler state excluded from Git |

## GitHub Actions

The repository includes a GitHub Actions workflow that checks for the main static site files on pushes and pull requests.

## License

No license is currently specified. Contact the repository owner before reusing or redistributing this project.

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
| `styles.css` | Site and game styles |
| `app.js` | Interface, game logic, catalog loading, and language switching |
| `multiplayer.js` | Room creation, joining, live game state, and multiplayer UI |
| `worker.js` | Cloudflare Worker APIs, WebSockets, and Durable Object room logic |
| `wrangler.toml` | Wrangler, asset, and Durable Object configuration |
| `scripts/dev.js` | Local Wrangler development command |
| `scripts/deploy-with-retry.js` | Wrangler deployment command with retry for transient API errors |

## GitHub Actions

The repository includes a GitHub Actions workflow that checks for the main static site files on pushes and pull requests.

## License

No license is currently specified. Contact the repository owner before reusing or redistributing this project.

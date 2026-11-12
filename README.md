# SpeakBubble

SpeakBubble is a chat app with a React client and an Express API.

## Setup

Requires Node.js 20.19+ (or 22.12+).

1. Copy `.env.example` to `.env` and replace the example usernames and passwords.
   The `id` values must remain `1`, `2`, and `3` for the sample room memberships.
2. Install and start the API:

   ```sh
   npm install
   npm start
   ```

3. In a separate terminal, install and start the client:

   ```sh
   cd client
   npm install
   npm run dev
   ```

The API listens on `http://localhost:5000` and the client runs on
`http://localhost:5173`.

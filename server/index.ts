import { readEnv } from './config/env.js';
import { connect } from './db/connect.js';
import { createApp } from './app.js';
const config = readEnv(process.env);
const { client, db } = await connect(config);
const server = createApp({ client, db, config }).listen(config.port, '0.0.0.0', () => console.log(`PressTrack listening on ${config.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await client.close(); process.exit(0); }));

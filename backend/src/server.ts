import { env } from "./config/env.js";
import "./db/runMigrations.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

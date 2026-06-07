// Central config from env. No secrets hardcoded.
const required = (k: string, fallback?: string): string => {
  const v = process.env[k] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${k}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/rs'),
  jwtSecret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtTtlSeconds: Number(process.env.JWT_TTL_SECONDS ?? 60 * 60 * 24 * 7),
  // path to the built client (Dockerfile copies it here); empty disables static serving in dev.
  clientDir: process.env.CLIENT_DIR ?? '',
  // raised per-session for the recommendation query (large in-memory sort).
  recommendWorkMem: process.env.RECOMMEND_WORK_MEM ?? '64MB',
};

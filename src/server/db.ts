import { Pool, PoolClient } from 'pg';
import {
  MonitoredProduct,
  CVEItem,
  AlertRule,
  AlertNotification,
  WebhookConfig,
  ScanLog,
  AiConfig,
  Project,
  EmailNotificationConfig,
  Ticket,
  ScheduleConfig,
  TeamsNotificationConfig,
} from '../types.js';

// SentinelCVE persists its application state in PostgreSQL instead of a local JSON file.
// Each in-memory collection (products, cvesDatabase, rules, ...) is mirrored to its own
// table. The full object is stored as JSONB (`data`) so the existing in-memory data model
// in server.ts does not need to be re-mapped field by field; a small number of columns are
// extracted purely to make ad-hoc SQL inspection/queries possible. The original array order
// is preserved via a `position` column, since some collections rely on insertion order
// (e.g. logs/notifications are always unshifted so the newest entry is first).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DATABASE_URL ? undefined : (process.env.PGHOST || 'localhost'),
  port: process.env.DATABASE_URL ? undefined : Number(process.env.PGPORT || 5432),
  user: process.env.DATABASE_URL ? undefined : (process.env.PGUSER || 'postgres'),
  password: process.env.DATABASE_URL ? undefined : (process.env.PGPASSWORD || 'postgres'),
  database: process.env.DATABASE_URL ? undefined : (process.env.PGDATABASE || 'sentinel_cve'),
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export type PersistedState = {
  products: MonitoredProduct[];
  cvesDatabase: CVEItem[];
  rules: AlertRule[];
  notifications: AlertNotification[];
  webhooks: WebhookConfig[];
  logs: ScanLog[];
  projects: Project[];
  emailConfig: EmailNotificationConfig;
  tickets: Ticket[];
  scheduleConfig: ScheduleConfig;
  teamsConfig: TeamsNotificationConfig;
  currentAiConfig: AiConfig;
};

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      position INT NOT NULL,
      id TEXT PRIMARY KEY,
      name TEXT,
      criticality TEXT,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cves (
      position INT NOT NULL,
      id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      severity TEXT,
      cvss_score NUMERIC,
      cisa_kev BOOLEAN,
      data JSONB NOT NULL,
      PRIMARY KEY (id, product_name)
    );
    CREATE TABLE IF NOT EXISTS rules (
      position INT NOT NULL,
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      position INT NOT NULL,
      id TEXT PRIMARY KEY,
      cve_id TEXT,
      status TEXT,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS webhooks (
      position INT NOT NULL,
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS logs (
      position INT NOT NULL,
      id TEXT PRIMARY KEY,
      type TEXT,
      level TEXT,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      position INT NOT NULL,
      id TEXT PRIMARY KEY,
      code TEXT,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tickets (
      position INT NOT NULL,
      id TEXT PRIMARY KEY,
      status TEXT,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves (severity);
    CREATE INDEX IF NOT EXISTS idx_cves_cisa_kev ON cves (cisa_kev);
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
  `);
}

async function replaceCollection<T extends Record<string, any>>(
  client: PoolClient,
  table: string,
  items: T[],
  extraColumns: (item: T) => Record<string, any>,
) {
  await client.query(`DELETE FROM ${table}`);
  for (let position = 0; position < items.length; position++) {
    const item = items[position];
    const extra = extraColumns(item);
    const columns = ['position', ...Object.keys(extra), 'data'];
    const values = [position, ...Object.values(extra), JSON.stringify(item)];
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
    await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
  }
}

export async function persistState(state: PersistedState): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await replaceCollection(client, 'products', state.products, (p) => ({ id: p.id, name: p.name, criticality: p.criticality }));
    await replaceCollection(client, 'cves', state.cvesDatabase, (c) => ({
      id: c.id,
      product_name: c.productName,
      severity: c.cvss?.severity,
      cvss_score: c.cvss?.baseScore,
      cisa_kev: Boolean(c.cisaKev),
    }));
    await replaceCollection(client, 'rules', state.rules, (r) => ({ id: r.id }));
    await replaceCollection(client, 'notifications', state.notifications, (n) => ({ id: n.id, cve_id: n.cveId, status: n.status }));
    await replaceCollection(client, 'webhooks', state.webhooks, (w) => ({ id: w.id }));
    await replaceCollection(client, 'logs', state.logs, (l) => ({ id: l.id, type: l.type, level: l.level }));
    await replaceCollection(client, 'projects', state.projects, (p) => ({ id: p.id, code: p.code }));
    await replaceCollection(client, 'tickets', state.tickets, (t) => ({ id: t.id, status: t.status }));

    await client.query(
      `INSERT INTO app_config (key, value) VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [
        'emailConfig', JSON.stringify(state.emailConfig),
        'scheduleConfig', JSON.stringify(state.scheduleConfig),
        'teamsConfig', JSON.stringify(state.teamsConfig),
        'currentAiConfig', JSON.stringify(state.currentAiConfig),
      ],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function loadCollection<T>(table: string): Promise<T[]> {
  const result = await pool.query(`SELECT data FROM ${table} ORDER BY position ASC`);
  return result.rows.map((row) => row.data as T);
}

export async function loadPersistedState(): Promise<Partial<PersistedState>> {
  const [products, cvesDatabase, rules, notifications, webhooks, logs, projects, tickets, configRows] = await Promise.all([
    loadCollection<MonitoredProduct>('products'),
    loadCollection<CVEItem>('cves'),
    loadCollection<AlertRule>('rules'),
    loadCollection<AlertNotification>('notifications'),
    loadCollection<WebhookConfig>('webhooks'),
    loadCollection<ScanLog>('logs'),
    loadCollection<Project>('projects'),
    loadCollection<Ticket>('tickets'),
    pool.query('SELECT key, value FROM app_config'),
  ]);

  const config: Record<string, any> = {};
  for (const row of configRows.rows) config[row.key] = row.value;

  return {
    products,
    cvesDatabase,
    rules,
    notifications,
    webhooks,
    logs,
    projects,
    tickets,
    emailConfig: config.emailConfig,
    scheduleConfig: config.scheduleConfig,
    teamsConfig: config.teamsConfig,
    currentAiConfig: config.currentAiConfig,
  };
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

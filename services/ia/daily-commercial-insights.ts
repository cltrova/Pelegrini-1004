import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DailyInsightSnapshot, CommercialInsight, InsightsBranch } from './daily-insight-types.ts';

const branches: readonly InsightsBranch[] = ['transmissao', 'chevrolet'];
const reviewIntervalMs = 60_000;
const retryAfterMs = 30 * 60_000;
const scheduleHour = 7;
const saoPauloClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

export function getDailyInsightSlot(now: Date): Omit<DailyInsightSnapshot, 'insights'> | null {
  const clock = Object.fromEntries(saoPauloClock.formatToParts(now).map(({ type, value }) => [type, value]));
  if (Number(clock.hour) < scheduleHour) return null;
  const dia = `${clock.year}-${clock.month}-${clock.day}`;
  const yesterday = new Date(`${dia}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const fim = yesterday.toISOString().slice(0, 10);
  return { dia, periodo: { inicio: `${fim.slice(0, 7)}-01`, fim } };
}

const insightTypes = new Set(['alerta', 'oportunidade', 'info', 'sucesso']);

export async function readGeneratedInsights(response: Response): Promise<CommercialInsight[]> {
  if (!response.ok) throw new Error(`Provedor de análises respondeu HTTP ${response.status}`);
  const { insights, error } = await response.json();
  if (error || !Array.isArray(insights) || insights.length < 1 || insights.length > 6) {
    throw new Error('Provedor de análises não retornou recomendações válidas');
  }
  return insights.map((item) => {
    if (!insightTypes.has(item?.tipo) || typeof item.titulo !== 'string' || typeof item.descricao !== 'string') {
      throw new Error('Recomendação inválida');
    }
    const titulo = item.titulo.trim();
    const descricao = item.descricao.trim();
    if (!titulo || !descricao || titulo.length > 100 || descricao.length > 300) throw new Error('Recomendação inválida');
    return { tipo: item.tipo, titulo, descricao };
  });
}

type ScheduleOptions = {
  dataDir: string;
  generate: (branch: InsightsBranch, period: DailyInsightSnapshot['periodo']) => Promise<CommercialInsight[]>;
  log?: Pick<Console, 'info' | 'warn'>;
};

export function createDailyCommercialInsights({ dataDir, generate, log = console }: ScheduleOptions) {
  const retryAt = new Map<InsightsBranch, number>();
  let running: Promise<void> | undefined;
  const fileFor = (branch: InsightsBranch) => join(dataDir, `${branch}.json`);

  async function read(branch: InsightsBranch): Promise<DailyInsightSnapshot | null> {
    try {
      return JSON.parse(await readFile(fileFor(branch), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async function save(branch: InsightsBranch, snapshot: DailyInsightSnapshot) {
    await mkdir(dataDir, { recursive: true });
    const file = fileFor(branch);
    const pending = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(pending, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
      await rename(pending, file);
    } catch (error) {
      await rm(pending, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async function generateDue(now: Date) {
    const slot = getDailyInsightSlot(now);
    if (!slot) return;
    for (const branch of branches) {
      if (now.getTime() < (retryAt.get(branch) ?? 0)) continue;
      try {
        const snapshot = await read(branch).catch((error) => {
          if (error instanceof SyntaxError) return null;
          throw error;
        });
        if (snapshot && snapshot.dia >= slot.dia) continue;
        const insights = await generate(branch, slot.periodo);
        await save(branch, { ...slot, insights });
        retryAt.delete(branch);
        log.info(`[metas-diarias] ${branch} ${slot.dia}: ${insights.length} análises salvas`);
      } catch (error) {
        retryAt.set(branch, now.getTime() + retryAfterMs);
        log.warn(`[metas-diarias] ${branch} ${slot.dia}: ${error instanceof Error ? error.message : 'falha na geração'}`);
      }
    }
  }

  function runDue(now = new Date()) {
    running ??= generateDue(now).finally(() => { running = undefined; });
    return running;
  }

  function start() {
    void runDue();
    const timer = setInterval(() => { void runDue(); }, reviewIntervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }

  return { read, runDue, start };
}

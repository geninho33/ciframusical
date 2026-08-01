import { Injectable } from "@nestjs/common";

type CounterMap = Map<string, number>;

@Injectable()
export class MetricsService {
  private readonly counters: CounterMap = new Map();
  private readonly startedAt = Date.now();

  incr(name: string, by = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  get(name: string) {
    return this.counters.get(name) ?? 0;
  }

  snapshot() {
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      counters: Object.fromEntries(this.counters.entries()),
    };
  }

  toPrometheus(): string {
    const lines: string[] = [
      "# HELP cifratrack_uptime_seconds Process uptime",
      "# TYPE cifratrack_uptime_seconds gauge",
      `cifratrack_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`,
    ];
    for (const [name, value] of this.counters) {
      const metric = name.replace(/[^a-zA-Z0-9_:]/g, "_");
      lines.push(`# TYPE ${metric} counter`);
      lines.push(`${metric} ${value}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

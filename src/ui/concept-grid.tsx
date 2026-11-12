import {
  BookOpen,
  Box,
  ChartColumn,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Globe,
  Layers,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
  Zap,
} from "lucide-react";
import type { ConceptIcon, CoreConcept } from "@/ai/schemas";
import { Card } from "@/ui/components/card";

const ICONS: Record<ConceptIcon, typeof Lightbulb> = {
  lightbulb: Lightbulb,
  layers: Layers,
  workflow: Workflow,
  shield: ShieldCheck,
  zap: Zap,
  target: Target,
  book: BookOpen,
  database: Database,
  clock: Clock,
  chart: ChartColumn,
  box: Box,
  "git-branch": GitBranch,
  globe: Globe,
  cpu: Cpu,
  check: CheckCircle2,
};

export function ConceptGrid({
  concepts,
  courseConcepts,
  title = "Core concepts",
}: {
  concepts: CoreConcept[];
  courseConcepts?: CoreConcept[];
  title?: string;
}) {
  if (concepts.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          {title}
        </h2>
        <span className="text-[10px] text-zinc-600">
          {concepts.length} idea{concepts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {concepts.map((concept) => {
          const Icon = ICONS[concept.icon] ?? Sparkles;
          const index = courseConcepts
            ? courseConcepts.findIndex((item) => item.id === concept.id)
            : -1;
          return (
            <Card key={concept.id ?? concept.title} className="p-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-800/50 bg-violet-950/40">
                  <Icon className="h-4 w-4 text-violet-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h3 className="text-sm font-medium text-zinc-100">
                      {concept.title}
                    </h3>
                    {index !== -1 && courseConcepts && (
                      <span className="text-[9px] uppercase tracking-wider text-zinc-600">
                        concept {index + 1} of {courseConcepts.length}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {concept.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

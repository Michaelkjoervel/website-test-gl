interface StepperProps {
  current: number;
  steps: { id: number; label: string }[];
}

export function Stepper({ current, steps }: StepperProps) {
  return (
    <ol className="flex items-center gap-2 mb-6 overflow-x-auto">
      {steps.map((s, i) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <li key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap text-xs font-semibold border transition-all
              ${
                active
                  ? "bg-brand-500 text-white border-brand-500 shadow-glow"
                  : done
                  ? "bg-brand-50 text-brand-700 border-brand-100"
                  : "bg-white text-ink-mute border-surface-line"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold
                ${
                  active
                    ? "bg-white text-brand-600"
                    : done
                    ? "bg-brand-500 text-white"
                    : "bg-surface-soft text-ink-mute"
                }`}
              >
                {done ? "✓" : s.id}
              </span>
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <span className="h-px flex-1 bg-surface-line hidden sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

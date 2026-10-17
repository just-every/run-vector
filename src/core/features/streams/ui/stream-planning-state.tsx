import { createContext, useCallback, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { IssueEditTarget } from "../../issues/ui/issue-keyboard-actions";

type PlanningState = { selection: Map<string, IssueEditTarget>; focused: string };
type Surface = "current" | "my-work";
type State = Record<Surface, PlanningState>;
const empty = (): State => ({
  current: { selection: new Map(), focused: "" },
  "my-work": { selection: new Map(), focused: "" },
});
const Planning = createContext<{ state: State; setState: Dispatch<SetStateAction<State>> } | null>(null);

/** Stream routes share planning state while opening and closing their inspector. */
export function StreamPlanningProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(empty);
  useEffect(() => {
    const clear = () => setState(empty());
    window.addEventListener("vector:auth-lost", clear);
    return () => window.removeEventListener("vector:auth-lost", clear);
  }, []);
  return <Planning.Provider value={{ state, setState }}>{children}</Planning.Provider>;
}

export function useStreamPlanningState(surface: Surface) {
  const context = useContext(Planning);
  if (!context) throw new Error("Stream planning needs the signed-in workspace.");
  const { setState } = context;
  const setSelection: Dispatch<SetStateAction<Map<string, IssueEditTarget>>> = useCallback((update) => setState(current => ({
    ...current, [surface]: { ...current[surface], selection: typeof update === "function" ? update(current[surface].selection) : update },
  })), [setState, surface]);
  const setFocused = useCallback((focused: string) => setState(current => current[surface].focused === focused ? current : ({
    ...current, [surface]: { ...current[surface], focused },
  })), [setState, surface]);
  return { ...context.state[surface], setSelection, setFocused };
}

import { createContext, useContext, type ReactNode } from "react";
import { useApiResource } from "../../../app/api-client";
import { mentionOptionsSchema } from "./data";
type OperatorsResource = ReturnType<
  typeof useApiResource<typeof mentionOptionsSchema>
>;
const Context = createContext<OperatorsResource | null>(null);
export function MentionOperatorsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const resource = useApiResource(
    "/api/mentions/options",
    mentionOptionsSchema,
    4000,
  );
  return <Context.Provider value={resource}>{children}</Context.Provider>;
}
export function useMentionOperators() {
  return useContext(Context);
}

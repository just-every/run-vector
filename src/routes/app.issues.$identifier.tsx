import { createFileRoute, notFound } from "@tanstack/react-router";
export const Route = createFileRoute("/app/issues/$identifier")({
  beforeLoad: ({ params }) => {
    if (!/^[A-Z]{2,10}-[1-9][0-9]*$/.test(params.identifier)) throw notFound();
  },
});

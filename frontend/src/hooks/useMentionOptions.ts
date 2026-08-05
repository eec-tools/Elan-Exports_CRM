import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";

export interface MentionOption {
  id: string;
  label: string;
  type: "supplier" | "buyer";
  source: string;
}

// Pipelines that have a real standalone detail page. Old suppliers and
// vault contacts (sourcing vault / buyer vault) live inside list/folder
// views with no linkable id route, so mentions from those sources render
// as plain colored text instead of a link.
const DETAIL_ROUTE_BY_SOURCE: Record<string, (id: string) => string> = {
  supplier: (id) => `/suppliers/signed-contract/${id}`,
  newSupplier: (id) => `/suppliers/new/${id}`,
  sourcingSupplier: (id) => `/suppliers/sourcing/${id}`,
  buyer: (id) => `/buyers/${id}`,
  sourcingBuyer: (id) => `/buyers/sourcing/${id}`,
};

export const mentionDetailPath = (option: MentionOption): string | null => {
  const build = DETAIL_ROUTE_BY_SOURCE[option.source];
  return build ? build(option.id) : null;
};

export function useMentionOptions() {
  return useQuery({
    queryKey: ["daily-tasks-mention-options"],
    queryFn: () =>
      api
        .get("/daily-tasks/mention-options")
        .then((r) => r.data as { suppliers: MentionOption[]; buyers: MentionOption[] }),
    staleTime: 5 * 60 * 1000,
  });
}

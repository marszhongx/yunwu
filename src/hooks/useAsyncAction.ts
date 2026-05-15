import { useCallback, useState } from "react";
import { toast } from "sonner";

export function useAsyncAction() {
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async <T>(action: () => Promise<T>, errorMessage = "操作失败"): Promise<T> => {
      setLoading(true);

      try {
        return await action();
      } catch (error: unknown) {
        const message =
          error instanceof Error && error.message !== "" ? error.message : errorMessage;
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, run };
}

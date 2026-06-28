/**
 * Modal Helpers — Shared utilities for wired modal components.
 *
 * Provides standardized error mapping and mutation toast handlers
 * used across all 182 modal wiring implementations.
 *
 * Requirements: 5 (Error Handling), 6 (Success Handling), 10 (Consistent Pattern)
 */

import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import type { QueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/core/api/apiClient";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ToastFn = (props: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

export interface MutationToastHandlersOptions<TForm extends FieldValues> {
  /** Toast function from useToast() */
  toast: ToastFn;
  /** TanStack Query client for cache invalidation */
  queryClient: QueryClient;
  /** Query keys to invalidate on success */
  keys: readonly (readonly string[])[];
  /** Callback to close the modal */
  onClose: () => void;
  /** React Hook Form instance for field error mapping and reset */
  form: UseFormReturn<TForm>;
  /** Custom success message (title) */
  successTitle?: string;
  /** Custom success description */
  successDescription?: string;
}

// ─── mapFieldErrors ────────────────────────────────────────────────────────────

/**
 * Maps HTTP 422 field-level validation errors from the backend onto
 * React Hook Form fields using `form.setError`.
 *
 * The error is expected to be an `ApiError` whose `data` property may contain
 * a `fieldErrors` object of shape `Record<string, string>`.
 *
 * @param error - The error thrown by apiRequest (ApiError instance)
 * @param form  - The React Hook Form instance to apply errors to
 *
 * @example
 * ```ts
 * onError: (error) => {
 *   mapFieldErrors(error, form);
 * }
 * ```
 */
export function mapFieldErrors<TForm extends FieldValues>(
  error: unknown,
  form: UseFormReturn<TForm>
): void {
  const apiError = error as ApiError | undefined;
  const fieldErrors: Record<string, string> | undefined =
    apiError?.data?.fieldErrors;

  if (!fieldErrors || typeof fieldErrors !== "object") return;

  Object.entries(fieldErrors).forEach(([field, message]) => {
    if (typeof message === "string") {
      form.setError(field as Path<TForm>, { message });
    }
  });
}

// ─── getMutationToastHandlers ──────────────────────────────────────────────────

/**
 * Returns standardized `onSuccess` and `onError` handlers for useMutation.
 *
 * - **onSuccess**: shows success toast, invalidates query cache, resets form, closes modal
 * - **onError**: shows destructive toast with error message, maps field errors if present
 *
 * @example
 * ```ts
 * const mutation = useMutation({
 *   mutationFn: (data) => apiRequest(...),
 *   ...getMutationToastHandlers({
 *     toast,
 *     queryClient,
 *     keys: [["retail", "devices"]],
 *     onClose,
 *     form,
 *     successTitle: "Device Registered",
 *     successDescription: "The device has been added successfully.",
 *   }),
 * });
 * ```
 */
export function getMutationToastHandlers<TForm extends FieldValues>(
  options: MutationToastHandlersOptions<TForm>
) {
  const {
    toast,
    queryClient,
    keys,
    onClose,
    form,
    successTitle = "Success",
    successDescription = "Operation completed successfully.",
  } = options;

  return {
    onSuccess: () => {
      toast({
        title: successTitle,
        description: successDescription,
      });
      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] });
      });
      form.reset();
      onClose();
    },
    onError: (error: unknown) => {
      const apiError = error as ApiError | undefined;
      const message =
        apiError?.message || "An unexpected error occurred. Please try again.";

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });

      mapFieldErrors(error, form);
    },
  };
}

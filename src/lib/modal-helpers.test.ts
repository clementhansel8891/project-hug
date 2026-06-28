/**
 * Unit tests for modal-helpers utility functions.
 */

import { describe, it, expect, vi } from "vitest";
import { mapFieldErrors, getMutationToastHandlers } from "./modal-helpers";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

function createMockForm() {
  return {
    setError: vi.fn(),
    reset: vi.fn(),
    handleSubmit: vi.fn(),
    watch: vi.fn(),
    getValues: vi.fn(),
    setValue: vi.fn(),
    trigger: vi.fn(),
    clearErrors: vi.fn(),
    formState: { errors: {}, isSubmitting: false },
    register: vi.fn(),
    unregister: vi.fn(),
    control: {} as any,
    getFieldState: vi.fn(),
    setFocus: vi.fn(),
    resetField: vi.fn(),
  } as any;
}

function createMockQueryClient() {
  return {
    invalidateQueries: vi.fn(),
  } as any;
}

// ─── mapFieldErrors ────────────────────────────────────────────────────────────

describe("mapFieldErrors", () => {
  it("maps field errors from ApiError.data.fieldErrors to form.setError", () => {
    const form = createMockForm();
    const error = {
      message: "Validation failed",
      status: 422,
      data: {
        fieldErrors: {
          name: "Name is required",
          email: "Invalid email format",
        },
      },
    };

    mapFieldErrors(error, form);

    expect(form.setError).toHaveBeenCalledTimes(2);
    expect(form.setError).toHaveBeenCalledWith("name", { message: "Name is required" });
    expect(form.setError).toHaveBeenCalledWith("email", { message: "Invalid email format" });
  });

  it("does nothing when error has no fieldErrors", () => {
    const form = createMockForm();
    const error = {
      message: "Server error",
      status: 500,
      data: {},
    };

    mapFieldErrors(error, form);

    expect(form.setError).not.toHaveBeenCalled();
  });

  it("does nothing when error is null/undefined", () => {
    const form = createMockForm();

    mapFieldErrors(null, form);
    mapFieldErrors(undefined, form);

    expect(form.setError).not.toHaveBeenCalled();
  });

  it("does nothing when fieldErrors is not an object", () => {
    const form = createMockForm();
    const error = {
      message: "Bad request",
      status: 400,
      data: { fieldErrors: "not an object" },
    };

    mapFieldErrors(error, form);

    expect(form.setError).not.toHaveBeenCalled();
  });

  it("skips non-string error messages in fieldErrors", () => {
    const form = createMockForm();
    const error = {
      message: "Validation failed",
      status: 422,
      data: {
        fieldErrors: {
          name: "Name is required",
          age: 42, // not a string — should be skipped
        },
      },
    };

    mapFieldErrors(error, form);

    expect(form.setError).toHaveBeenCalledTimes(1);
    expect(form.setError).toHaveBeenCalledWith("name", { message: "Name is required" });
  });
});

// ─── getMutationToastHandlers ──────────────────────────────────────────────────

describe("getMutationToastHandlers", () => {
  it("returns onSuccess and onError handlers", () => {
    const form = createMockForm();
    const toast = vi.fn();
    const queryClient = createMockQueryClient();
    const onClose = vi.fn();

    const handlers = getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "devices"]],
      onClose,
      form,
    });

    expect(handlers).toHaveProperty("onSuccess");
    expect(handlers).toHaveProperty("onError");
    expect(typeof handlers.onSuccess).toBe("function");
    expect(typeof handlers.onError).toBe("function");
  });

  describe("onSuccess", () => {
    it("shows success toast with default message", () => {
      const form = createMockForm();
      const toast = vi.fn();
      const queryClient = createMockQueryClient();
      const onClose = vi.fn();

      const { onSuccess } = getMutationToastHandlers({
        toast,
        queryClient,
        keys: [["retail", "devices"]],
        onClose,
        form,
      });

      onSuccess();

      expect(toast).toHaveBeenCalledWith({
        title: "Success",
        description: "Operation completed successfully.",
      });
    });

    it("shows success toast with custom message", () => {
      const form = createMockForm();
      const toast = vi.fn();
      const queryClient = createMockQueryClient();
      const onClose = vi.fn();

      const { onSuccess } = getMutationToastHandlers({
        toast,
        queryClient,
        keys: [["retail", "devices"]],
        onClose,
        form,
        successTitle: "Device Registered",
        successDescription: "The device was added.",
      });

      onSuccess();

      expect(toast).toHaveBeenCalledWith({
        title: "Device Registered",
        description: "The device was added.",
      });
    });

    it("invalidates all provided query keys", () => {
      const form = createMockForm();
      const toast = vi.fn();
      const queryClient = createMockQueryClient();
      const onClose = vi.fn();

      const { onSuccess } = getMutationToastHandlers({
        toast,
        queryClient,
        keys: [["retail", "devices"], ["retail", "stores"]],
        onClose,
        form,
      });

      onSuccess();

      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["retail", "devices"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["retail", "stores"],
      });
    });

    it("resets form and closes modal", () => {
      const form = createMockForm();
      const toast = vi.fn();
      const queryClient = createMockQueryClient();
      const onClose = vi.fn();

      const { onSuccess } = getMutationToastHandlers({
        toast,
        queryClient,
        keys: [["retail", "devices"]],
        onClose,
        form,
      });

      onSuccess();

      expect(form.reset).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("onError", () => {
    it("shows destructive toast with error message", () => {
      const form = createMockForm();
      const toast = vi.fn();
      const queryClient = createMockQueryClient();
      const onClose = vi.fn();

      const { onError } = getMutationToastHandlers({
        toast,
        queryClient,
        keys: [["retail", "devices"]],
        onClose,
        form,
      });

      const error = {
        message: "Duplicate device code",
        status: 422,
        data: {},
      };

      onError(error);

      expect(toast).toHaveBeenCalledWith({
        title: "Error",
        description: "Duplicate device code",
        variant: "destructive",
      });
    });

    it("shows fallback message when error has no message", () => {
      const form = createMockForm();
      const toast = vi.fn();
      const queryClient = createMockQueryClient();
      const onClose = vi.fn();

      const { onError } = getMutationToastHandlers({
        toast,
        queryClient,
        keys: [["retail", "devices"]],
        onClose,
        form,
      });

      onError({});

      expect(toast).toHaveBeenCalledWith({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    });

    it("maps field errors when present", () => {
      const form = createMockForm();
      const toast = vi.fn();
      const queryClient = createMockQueryClient();
      const onClose = vi.fn();

      const { onError } = getMutationToastHandlers({
        toast,
        queryClient,
        keys: [["retail", "devices"]],
        onClose,
        form,
      });

      const error = {
        message: "Validation failed",
        status: 422,
        data: {
          fieldErrors: {
            code: "Code already exists",
          },
        },
      };

      onError(error);

      expect(form.setError).toHaveBeenCalledWith("code", {
        message: "Code already exists",
      });
    });

    it("does not close modal on error", () => {
      const form = createMockForm();
      const toast = vi.fn();
      const queryClient = createMockQueryClient();
      const onClose = vi.fn();

      const { onError } = getMutationToastHandlers({
        toast,
        queryClient,
        keys: [["retail", "devices"]],
        onClose,
        form,
      });

      onError({ message: "Error", status: 500, data: {} });

      expect(onClose).not.toHaveBeenCalled();
      expect(form.reset).not.toHaveBeenCalled();
    });
  });
});

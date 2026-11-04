"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/ToastContext";

// A button for async actions: while onClick's promise runs it is disabled and
// shows a spinner. Errors thrown by onClick are shown as a toast.
const LoadingButton = ({
  children,
  onClick,
  disabled = false,
  showErrorToast = true,
  errorMessage = "Something went wrong. Please try again.",
  loading: externalLoading = false,
  loadingText,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const busy = externalLoading || isLoading;

  const handleClick = async (e) => {
    if (!onClick || busy || disabled) return;
    setIsLoading(true);
    try {
      await onClick(e);
    } catch (err) {
      console.error("Button action failed:", err);
      if (showErrorToast) {
        toast.error(err?.response?.data?.error || err?.message || errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      {...props}
      disabled={disabled || busy}
      loading={busy}
      onClick={handleClick}
      aria-busy={busy}
    >
      {busy && loadingText ? loadingText : children}
    </Button>
  );
};

export default LoadingButton;

"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionState } from "@/app/app/settings/actions";

/**
 * <form> bound to a server action with useActionState, toasting success/error.
 * Error codes are looked up in settings.errors.* and fall back to the raw message.
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  resetOnSuccess = false,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  onSuccess?: (state: NonNullable<ActionState>) => void;
  resetOnSuccess?: boolean;
}) {
  const t = useTranslations("settings");
  const ref = React.useRef<HTMLFormElement>(null);
  const [state, formAction] = React.useActionState(action, undefined);
  const onSuccessRef = React.useRef(onSuccess);
  React.useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  React.useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error);
    else if (state.ok) {
      toast.success(t("saved"));
      onSuccessRef.current?.(state);
      if (resetOnSuccess) ref.current?.reset();
    }
  }, [state, t, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
    </form>
  );
}

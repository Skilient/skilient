"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui";
import { changePassword } from "@/lib/actions/auth";
import type { ActionError } from "@/lib/actions/result";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ActionError | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await changePassword(form);
      if (!result.ok) return setError(result);
      setCurrent("");
      setPassword("");
      setConfirm("");
      setDone(true);
    });
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-5" data-testid="change-password-form">
      {error && !error.fields ? <FormAlert requestId={error.requestId}>{error.message}</FormAlert> : null}
      {done ? (
        <p role="status" className="text-body text-text-primary" data-testid="password-changed">
          Password changed. Every other device has been signed out.
        </p>
      ) : null}
      <PasswordField id="current" name="current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" error={error?.fields?.current} />
      <PasswordField id="new-password" name="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" meter error={error?.fields?.password} />
      <PasswordField id="confirm" name="confirm" label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" error={error?.fields?.confirm} />
      <div>
        <Button type="submit" loading={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}

"use client";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  huaweiRequest,
  HuaweiRequestError,
  type HuaweiConnection,
} from "@/lib/huawei-carts/client";

export function HuaweiConnectionForm({
  onConnected,
  onCancel,
}: {
  onConnected: (connection: HuaweiConnection) => void;
  onCancel?: () => void;
}) {
  const [account, setAccount] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  const [iam, setIam] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [verification, setVerification] = useState(false),
    [code, setCode] = useState(""),
    [userId, setUserId] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const result = await huaweiRequest<HuaweiConnection>("connection", {
            account,
            username: iam ? username : account,
            password,
            ...(verification ? { verificationCode: code, userId } : {}),
          });
          setPassword("");
          setCode("");
          onConnected(result);
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Unable to connect.",
          );
          if (error instanceof HuaweiRequestError && error.verificationRequired)
            setVerification(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-zinc-500">
        Your password is used to sign in and is not saved.
      </p>
      <label className="block space-y-1.5 text-sm font-medium">
        {iam ? "Huawei account name" : "Huawei account ID"}
        <Input
          name="huawei-account"
          autoComplete="username"
          value={account}
          onChange={(event) => setAccount(event.target.value)}
          required
          maxLength={200}
          disabled={busy}
        />
      </label>
      {iam && (
        <label className="block space-y-1.5 text-sm font-medium">
          IAM username
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            maxLength={200}
            disabled={busy}
          />
        </label>
      )}
      <label className="block space-y-1.5 text-sm font-medium">
        Password
        <div className="relative">
          <Input
            name="huawei-password"
            aria-label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={1000}
            disabled={busy}
            className="pr-11"
          />
          <button
            type="button"
            className="absolute top-0 right-0 flex h-full w-10 items-center justify-center text-zinc-500"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-600">
        <input
          type="checkbox"
          checked={iam}
          disabled={busy}
          onChange={(event) => setIam(event.target.checked)}
        />
        Sign in as an IAM user
      </label>
      {verification && (
        <div className="space-y-3 rounded-xl border bg-zinc-50 p-3">
          <label className="block space-y-1 text-sm">
            IAM user ID
            <Input
              aria-label="IAM user ID"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              required
              disabled={busy}
            />
            <span className="text-xs text-zinc-500">
              Find this on Huawei’s My Credentials page.
            </span>
          </label>
          <label className="block space-y-1 text-sm">
            Authenticator code
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              disabled={busy}
            />
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
        )}
        <Button disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}{" "}
          {busy ? "Connecting…" : "Connect Huawei Cloud"}
        </Button>
      </div>
    </form>
  );
}

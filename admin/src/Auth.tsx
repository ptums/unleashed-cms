// Sign-in for the CMS. Only people invited in the Clerk dashboard can sign in.
// Signed out: the Clerk sign-in box. Signed in: the editor, and every API call sends a token.

import type { ReactNode } from "react";
import { ClerkProvider, Show, SignIn, useAuth } from "@clerk/react";
import { setTokenGetter } from "./api";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Add VITE_CLERK_PUBLISHABLE_KEY to admin/.env.local");
}

// The Clerk JWT template that adds aud: "unleashed-cms". The API Gateway authorizer checks aud.
const TOKEN_TEMPLATE = "cms";

// Gives api.ts a way to get a fresh token. It runs during render, before the editor's
// first API call (child effects run before parent effects, so an effect here is too late).
function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  setTokenGetter(() => getToken({ template: TOKEN_TEMPLATE }));
  return children;
}

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <Show when="signed-out">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unleashed Potential Therapy Group</p>
            <h1 className="text-lg font-semibold">Content</h1>
          </div>
          <SignIn />
        </div>
      </Show>
      <Show when="signed-in">
        <TokenBridge>{children}</TokenBridge>
      </Show>
    </ClerkProvider>
  );
}

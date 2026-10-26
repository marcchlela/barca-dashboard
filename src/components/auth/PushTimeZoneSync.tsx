"use client";

import { useEffect } from "react";

/** Refreshes the time zone for an existing opt-in without asking permission. */
export default function PushTimeZoneSync() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistration("/")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (!subscription) return;
        return fetch("/api/notifications", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        });
      }).catch(() => {});
  }, []);
  return null;
}

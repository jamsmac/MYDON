import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";

export interface SubscriptionEvent {
  plan: string;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  timestamp: number;
}

export interface PaymentEvent {
  invoiceId: string;
  amount?: number;
  currency?: string;
  timestamp: number;
}

interface UseSubscriptionStatusOptions {
  /** Enable polling mode (for SubscriptionSuccess page) */
  polling?: boolean;
  /** Polling interval in ms (default: 2000) */
  pollingInterval?: number;
  /** Max polling attempts before giving up (default: 30 = 60 seconds) */
  maxPollingAttempts?: number;
  /** Callback when subscription becomes active */
  onSubscriptionActive?: (event: SubscriptionEvent) => void;
  /** Callback when payment completes */
  onPaymentCompleted?: (event: PaymentEvent) => void;
  /** Callback when payment fails */
  onPaymentFailed?: (event: PaymentEvent) => void;
}

export function useSubscriptionStatus(options: UseSubscriptionStatusOptions = {}) {
  const {
    polling = false,
    pollingInterval = 2000,
    maxPollingAttempts = 30,
    onSubscriptionActive,
    onPaymentCompleted,
    onPaymentFailed,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingCountRef = useRef(0);
  const callbacksRef = useRef({ onSubscriptionActive, onPaymentCompleted, onPaymentFailed });
  
  // Keep callbacks ref up to date
  callbacksRef.current = { onSubscriptionActive, onPaymentCompleted, onPaymentFailed };

  const [subscriptionConfirmed, setSubscriptionConfirmed] = useState(false);
  const [pollingExhausted, setPollingExhausted] = useState(false);
  const [latestEvent, setLatestEvent] = useState<SubscriptionEvent | null>(null);

  const utils = trpc.useUtils();

  // Query subscription status (used for polling)
  const subscriptionQuery = trpc.stripe.getSubscriptionStatus.useQuery(undefined, {
    enabled: polling && !subscriptionConfirmed,
    refetchInterval: polling && !subscriptionConfirmed ? pollingInterval : false,
    refetchOnWindowFocus: true,
  });

  // Invalidate all subscription-related caches
  const invalidateSubscriptionCaches = useCallback(() => {
    utils.stripe.getSubscriptionStatus.invalidate();
    utils.stripe.getPaymentHistory.invalidate();
    utils.stripe.getUpcomingInvoice.invalidate();
    utils.auth.me.invalidate();
  }, [utils]);

  // Handle socket-based real-time subscription updates
  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[SubscriptionStatus] Socket connected");
    });

    socket.on("subscription:updated", (event: SubscriptionEvent) => {
      console.log("[SubscriptionStatus] Received subscription:updated", event);
      setLatestEvent(event);

      if (event.status === "active" || event.status === "trialing") {
        setSubscriptionConfirmed(true);
        callbacksRef.current.onSubscriptionActive?.(event);
      }

      // Invalidate all caches to reflect the new state
      invalidateSubscriptionCaches();
    });

    socket.on("payment:completed", (event: PaymentEvent) => {
      console.log("[SubscriptionStatus] Received payment:completed", event);
      callbacksRef.current.onPaymentCompleted?.(event);
      invalidateSubscriptionCaches();
    });

    socket.on("payment:failed", (event: PaymentEvent) => {
      console.log("[SubscriptionStatus] Received payment:failed", event);
      callbacksRef.current.onPaymentFailed?.(event);
      invalidateSubscriptionCaches();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [invalidateSubscriptionCaches]);

  // Polling-based fallback: check if subscription became active
  useEffect(() => {
    if (!polling || subscriptionConfirmed) return;

    if (subscriptionQuery.data?.status === "active" || subscriptionQuery.data?.status === "trialing") {
      setSubscriptionConfirmed(true);
      const event: SubscriptionEvent = {
        plan: subscriptionQuery.data.plan,
        status: subscriptionQuery.data.status,
        timestamp: Date.now(),
      };
      setLatestEvent(event);
      callbacksRef.current.onSubscriptionActive?.(event);
      invalidateSubscriptionCaches();
    }
  }, [polling, subscriptionConfirmed, subscriptionQuery.data, invalidateSubscriptionCaches]);

  // Track polling attempts
  useEffect(() => {
    if (!polling || subscriptionConfirmed) return;

    pollingCountRef.current += 1;
    if (pollingCountRef.current >= maxPollingAttempts) {
      setPollingExhausted(true);
    }
  }, [polling, subscriptionConfirmed, maxPollingAttempts, subscriptionQuery.dataUpdatedAt]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return {
    /** Whether the subscription has been confirmed as active */
    subscriptionConfirmed,
    /** Whether polling has exhausted all attempts without confirmation */
    pollingExhausted,
    /** The latest subscription event received */
    latestEvent,
    /** Current subscription data from the server */
    subscriptionData: subscriptionQuery.data,
    /** Whether the query is loading */
    isLoading: subscriptionQuery.isLoading,
    /** Force refresh subscription status */
    refresh: invalidateSubscriptionCaches,
  };
}

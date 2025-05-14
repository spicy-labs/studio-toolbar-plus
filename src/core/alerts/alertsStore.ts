import { Result } from "typescript-result";
import type { Set, Get, Store } from "../appStore/storeTypes";

export type Alert = {
  id: string;
  message: string;
  timestamp: number;
};

type AlertsState = {
  alerts: Map<string, Alert>;
};

type AlertsActions = {
  raiseAlert: (errorOrResult: Error | Result<any, Error>) => void;
  dismissAlert: (id: string) => void;
};

export type AlertsStore = {
  state: {
    alerts: AlertsState;
  };
  actions: {
    alerts: AlertsActions;
  };
};

export function initAlertsStore<T extends Store>(
  set: Set,
  get: Get,
  store: T
): T & AlertsStore {
  if ("alerts" in store.state && "alerts" in store.actions) {
    return store as T & AlertsStore;
  }

  const updatedStore = {
    state: {
      ...store.state,
      alerts: initAlertsState(),
    },
    actions: {
      ...store.actions,
      alerts: initAlertsActions(set, get),
    },
  };

  return updatedStore as T & AlertsStore;
}

function initAlertsState(): AlertsState {
  return {
    alerts: new Map<string, Alert>(),
  };
}

function initAlertsActions(set: Set, get: Get): AlertsActions {
  // During hot-reloading (which we don't use) this could lead to orphaned timeouts
  const timeoutMap = new Map<string, number>();
  
  return {
    raiseAlert: (errorOrResult) => {
      const id = generateRandomId();
      const message = extractErrorMessage(errorOrResult);
      const timestamp = Date.now();
      
      // Set the alert in the store
      set((store) => {
        store.state.alerts.alerts.set(id, { id, message, timestamp });
      });

      console.log("ARASIE")
      
      // Create a single timeout for this alert
      const timeout = window.setTimeout(() => {
        console.log("TIMEY")
        if (get().state.alerts.alerts.has(id)) {
          set((store) => {
            store.state.alerts.alerts.delete(id);
          });
        }
        // Clean up the timeout reference
        timeoutMap.delete(id);
      }, 9000);
      
      // Store the timeout reference
      timeoutMap.set(id, timeout);
    },
    dismissAlert: (id) => {
      // Clear the timeout when manually dismissed
      if (timeoutMap.has(id)) {
        window.clearTimeout(timeoutMap.get(id));
        timeoutMap.delete(id);
      }
      
      set((store) => {
        store.state.alerts.alerts.delete(id);
      });
    },
  };
}

function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function extractErrorMessage(
  errorOrResult: Error | Result<any, Error>
): string {
  if (errorOrResult instanceof Error) {
    return errorOrResult.message || "Unknown Error - Error message is empty";
  } else if (errorOrResult.isError()) {
    return (
      errorOrResult.error.message || "Unknown Error - Error message is empty"
    );
  } else {
    return "Unknown Error - Unable to extract message from error";
  }
}

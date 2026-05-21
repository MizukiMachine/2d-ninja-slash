export type StoreListener<T> = (state: T) => void;
export type Unsubscribe = () => void;

export interface StoreSubscriptionOptions {
  readonly immediate?: boolean;
}

export interface ReadableStore<T> {
  get(): T;
  subscribe(listener: StoreListener<T>, options?: StoreSubscriptionOptions): Unsubscribe;
}

export interface WritableStore<T> extends ReadableStore<T> {
  set(nextState: T): void;
  update(updater: (state: T) => T): void;
}

export function createStore<T>(initialState: T): WritableStore<T> {
  let state = initialState;
  const listeners = new Set<StoreListener<T>>();

  const notify = (): void => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  return {
    get: () => state,
    set: (nextState) => {
      if (Object.is(nextState, state)) {
        return;
      }

      state = nextState;
      notify();
    },
    update: (updater) => {
      const nextState = updater(state);

      if (Object.is(nextState, state)) {
        return;
      }

      state = nextState;
      notify();
    },
    subscribe: (listener, options = {}) => {
      listeners.add(listener);

      if (options.immediate === true) {
        listener(state);
      }

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

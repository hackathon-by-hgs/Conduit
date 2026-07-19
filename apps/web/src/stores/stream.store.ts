import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type StreamStatus = 'connected' | 'reconnecting' | 'polling' | 'disabled';

/** SSE connection status for the reconciliation health strip. */
interface StreamState {
  status: StreamStatus;
  setStatus: (status: StreamStatus) => void;
}

export const useStreamStore = create<StreamState>()(
  devtools((set) => ({
    status: 'disabled',
    setStatus: (status) => set({ status }),
  })),
);

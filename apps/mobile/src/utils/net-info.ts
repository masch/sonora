import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Subscribe to network state changes.
 *
 * Wrapped in a helper so the subscription callee is a plain identifier:
 * React Doctor can prove the returned unsubscribe is returned as an effect
 * cleanup, which it cannot do for member-object `addEventListener` callees
 * (`NetInfo.addEventListener` is a false positive in any cleanup shape).
 */
export function subscribeToNetwork(callback: (state: NetInfoState) => void): () => void {
  return NetInfo.addEventListener(callback);
}

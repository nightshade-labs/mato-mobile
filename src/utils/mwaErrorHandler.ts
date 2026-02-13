// src/utils/mwaErrorHandler.ts
import {
  SolanaMobileWalletAdapterError,
  SolanaMobileWalletAdapterProtocolError,
} from '@solana-mobile/mobile-wallet-adapter-protocol';

export interface MWAErrorResult {
  userMessage: string;
  shouldRetry: boolean;
  isUserCancellation: boolean;
  originalError: Error;
}

const ERROR_MESSAGES: Record<string, string> = {
  ERROR_AUTHORIZATION_FAILED: 'Wallet connection cancelled',
  ERROR_NOT_SIGNED: 'Transaction signing declined',
  ERROR_NOT_SUBMITTED: 'Could not submit transaction. Check your connection.',
  ERROR_TOO_MANY_PAYLOADS: 'Too many transactions. Try sending fewer.',
  ERROR_INVALID_PAYLOADS: 'Invalid transaction format',
  ERROR_ATTEST_ORIGIN_ANDROID: 'App verification failed. Please reinstall.',
};

export function handleMWAError(error: unknown): MWAErrorResult {
  // Not an MWA error
  if (!(error instanceof Error)) {
    return {
      userMessage: 'An unexpected error occurred',
      shouldRetry: true,
      isUserCancellation: false,
      originalError: new Error(String(error)),
    };
  }

  // Protocol-level error (wallet response)
  if (error instanceof SolanaMobileWalletAdapterProtocolError) {
    const message = ERROR_MESSAGES[error.code] ?? error.message;
    const isUserCancellation = error.code === 'ERROR_AUTHORIZATION_FAILED' || error.code === 'ERROR_NOT_SIGNED';

    return {
      userMessage: message,
      shouldRetry: !isUserCancellation,
      isUserCancellation,
      originalError: error,
    };
  }

  // SDK-level error (association, session)
  if (error instanceof SolanaMobileWalletAdapterError) {
    // Common: no wallet installed
    if (error.message.includes('Found no installed wallet')) {
      return {
        userMessage: 'No Solana wallet found. Please install a wallet app.',
        shouldRetry: false,
        isUserCancellation: false,
        originalError: error,
      };
    }

    // Session timeout
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return {
        userMessage: 'Wallet connection timed out. Please try again.',
        shouldRetry: true,
        isUserCancellation: false,
        originalError: error,
      };
    }

    // Generic SDK error
    return {
      userMessage: 'Could not connect to wallet. Please try again.',
      shouldRetry: true,
      isUserCancellation: false,
      originalError: error,
    };
  }

  // Standard Error (network issues, etc.)
  if (error.message.includes('Network') || error.message.includes('fetch')) {
    return {
      userMessage: 'Network error. Check your connection.',
      shouldRetry: true,
      isUserCancellation: false,
      originalError: error,
    };
  }

  return {
    userMessage: error.message || 'An error occurred',
    shouldRetry: true,
    isUserCancellation: false,
    originalError: error,
  };
}

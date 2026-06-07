import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

function getDevBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5000`;
  }
  return 'http://10.0.2.2:5000';
}

export async function getBaseUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem('settings.baseUrl');
  return stored ?? getDevBaseUrl();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string
): Promise<T> {
  const baseUrl = await getBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export interface LoginResponse {
  sessionToken: string;
  tokenId: string;
  role: string;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export interface User {
  tokenId: string;
  username: string;
  balance: number;
  role: string;
}

export function getUsers(sessionToken: string): Promise<User[]> {
  return request<User[]>('/users', {}, sessionToken);
}

export interface PaymentV1Body {
  payerTokenId: string;
  merchantTokenId: string;
  amount: number;
  captureMethod: string;
}

export function payV1(body: PaymentV1Body): Promise<unknown> {
  return request<unknown>('/payments/v1', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface NonceResponse {
  nonce: string;
}

export function getNonce(sessionToken: string): Promise<NonceResponse> {
  return request<NonceResponse>('/payments/v2/nonce', { method: 'POST' }, sessionToken);
}

export interface PaymentV2Body {
  payerTokenId: string;
  merchantTokenId: string;
  amount: number;
  captureMethod: string;
  nonce: string;
  signature: string;
}

export function payV2(body: PaymentV2Body, sessionToken: string): Promise<unknown> {
  return request<unknown>('/payments/v2', {
    method: 'POST',
    body: JSON.stringify(body),
  }, sessionToken);
}

export function getTransactions(sessionToken: string): Promise<unknown[]> {
  return request<unknown[]>('/payments', {}, sessionToken);
}

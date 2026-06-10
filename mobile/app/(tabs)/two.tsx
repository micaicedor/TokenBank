import { useAuth } from '@/context/AuthContext';
import { getNonce, getUsers, payV1, payV2, User } from '@/services/api';
import { signPayment } from '@/utils/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Step = 'recipient' | 'amount' | 'confirm' | 'result';

const NUMPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '←'];

export default function PayScreen() {
  const { sessionToken, tokenId } = useAuth();

  const [step, setStep] = useState<Step>('recipient');
  const [search, setSearch] = useState('');
  const [recipient, setRecipient] = useState<User | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);

  const [amount, setAmount] = useState('');
  const [protocol, setProtocol] = useState<'v1' | 'v2'>('v2');

  const [loading, setLoading] = useState(false);
  const [resultOk, setResultOk] = useState(false);
  const [resultError, setResultError] = useState('');

  async function handleSearch() {
    if (!search.trim()) return;
    setSearchError('');
    setSearching(true);
    try {
      const users = await getUsers(sessionToken!);
      const found = users.find(
        (u) => u.username === search.trim() && u.tokenId !== tokenId
      );
      if (!found) setSearchError('No se encontró ninguna cuenta.');
      else setRecipient(found);
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setSearching(false);
    }
  }

  function handleNumpad(key: string) {
    if (key === '←') { setAmount((a) => a.slice(0, -1)); return; }
    if (key === '.' && amount.includes('.')) return;
    if (amount === '0' && key !== '.') { setAmount(key); return; }
    if (amount.length >= 9) return;
    setAmount((a) => a + key);
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const amt = parseFloat(amount);
      if (protocol === 'v2') {
        const privateKeyPem = await AsyncStorage.getItem('settings.privateKey');
        if (!privateKeyPem) {
          setResultOk(false);
          setResultError('Falta la clave privada RSA. Configúrala en Ajustes (pestaña Perfil).');
          setStep('result');
          return;
        }
        const { nonce } = await getNonce(sessionToken!);
        const signature = signPayment(
          privateKeyPem,
          tokenId!,
          recipient!.tokenId,
          amt,
          'manual',
          nonce
        );
        await payV2({
          payerTokenId: tokenId!,
          merchantTokenId: recipient!.tokenId,
          amount: amt,
          captureMethod: 'manual',
          nonce,
          signature,
        }, sessionToken!);
      } else {
        await payV1({
          payerTokenId: tokenId!,
          merchantTokenId: recipient!.tokenId,
          amount: amt,
          captureMethod: 'manual',
        });
      }
      setResultOk(true);
    } catch (e: unknown) {
      setResultOk(false);
      setResultError(e instanceof Error ? e.message : 'Error al pagar');
    } finally {
      setLoading(false);
      setStep('result');
    }
  }

  function reset() {
    setStep('recipient');
    setSearch('');
    setRecipient(null);
    setAmount('');
    setResultOk(false);
    setResultError('');
  }

  const initials = (name: string) =>
    name.split('_').map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);

  if (step === 'recipient') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>PAGAR</Text>
        <Text style={styles.sectionLabel}>USUARIO DESTINO</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre de usuario"
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={(t) => { setSearch(t); setRecipient(null); setSearchError(''); }}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

        {recipient && (
          <View style={styles.accountCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(recipient.username)}</Text>
            </View>
            <View>
              <Text style={styles.accountLabel}>CUENTA ENCONTRADA</Text>
              <Text style={styles.accountName}>{recipient.username}</Text>
            </View>
          </View>
        )}

        <Pressable
          style={[styles.btnPrimary, searching && styles.btnDisabled]}
          onPress={recipient ? () => setStep('amount') : handleSearch}
          disabled={searching}
        >
          {searching
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>{recipient ? 'CONTINUAR' : 'BUSCAR'}</Text>}
        </Pressable>
      </ScrollView>
    );
  }

  if (step === 'amount') {
    return (
      <View style={styles.amountContainer}>
        <Text style={styles.header}>INGRESAR MONTO</Text>

        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(recipient!.username)}</Text>
          </View>
          <View>
            <Text style={styles.accountLabel}>PAGANDO A</Text>
            <Text style={styles.accountName}>{recipient!.username}</Text>
          </View>
        </View>

        <Text style={styles.amountLabel}>MONTO A PAGAR (COP)</Text>
        <Text style={styles.amountDisplay}>${amount || '0'}</Text>

        <View style={styles.numpad}>
          {NUMPAD.map((key) => (
            <Pressable key={key} style={styles.numKey} onPress={() => handleNumpad(key)}>
              <Text style={styles.numKeyText}>{key}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.btnPrimary}
          onPress={() => { setProtocol('v2'); setStep('confirm'); }}
          disabled={!amount || parseFloat(amount) <= 0}
        >
          <Text style={styles.btnPrimaryText}>PAGAR SEGURO</Text>
        </Pressable>
        <Pressable
          style={styles.btnInsecure}
          onPress={() => { setProtocol('v1'); setStep('confirm'); }}
          disabled={!amount || parseFloat(amount) <= 0}
        >
          <Text style={styles.btnInsecureText}>PAGAR INSEGURO</Text>
        </Pressable>
        <Text style={styles.demoNote}>Demo académico — "Inseguro" envía sin nonce.</Text>
      </View>
    );
  }

  if (step === 'confirm') {
    const isV2 = protocol === 'v2';
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>CONFIRMAR PAGO</Text>

        <View style={[styles.protocolBanner, isV2 ? styles.bannerSecure : styles.bannerInsecure]}>
          <Text style={[styles.bannerTitle, isV2 ? styles.bannerSecureText : styles.bannerInsecureText]}>
            {isV2 ? 'CONEXIÓN SEGURA' : 'CONEXIÓN SIN PROTECCIÓN'}
          </Text>
          <Text style={styles.bannerDesc}>
            {isV2
              ? 'Esta solicitud incluye un nonce único firmado. Si alguien la captura y la reenvía, el servidor la rechazará.'
              : 'Esta solicitud puede ser capturada y reenviada por un atacante. El destinatario podría ser cobrado más de una vez.'}
          </Text>
        </View>

        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(recipient!.username)}</Text>
          </View>
          <View>
            <Text style={styles.accountLabel}>PAGANDO A</Text>
            <Text style={styles.accountName}>{recipient!.username}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          {[
            ['DESTINATARIO', recipient!.username],
            ['MONTO', `$ ${parseFloat(amount).toLocaleString('es-CO')} COP`],
            ['PROTOCOLO', isV2 ? 'V2 — NONCE INCLUIDO' : 'V1 — SIN NONCE'],
          ].map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={[styles.detailValue, label === 'PROTOCOLO' && (isV2 ? styles.v2Badge : styles.v1Badge)]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          style={[isV2 ? styles.btnPrimary : styles.btnInsecureConfirm, loading && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>
                {isV2 ? 'CONFIRMAR PAGO SEGURO' : 'CONFIRMAR PAGO INSEGURO'}
              </Text>}
        </Pressable>
        <Pressable style={styles.btnCancel} onPress={() => setStep('amount')}>
          <Text style={styles.btnCancelText}>CANCELAR</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === 'result') {
    return (
      <View style={styles.container}>
        <View style={[styles.resultIcon, resultOk ? styles.resultIconOk : styles.resultIconErr]}>
          <Text style={styles.resultIconText}>{resultOk ? '✓' : '✕'}</Text>
        </View>
        <Text style={styles.resultTitle}>{resultOk ? 'Pago enviado' : 'Error'}</Text>
        <Text style={styles.resultDesc}>
          {resultOk
            ? 'La transacción se completó correctamente.'
            : resultError}
        </Text>
        <Pressable style={[styles.btnPrimary, { marginTop: 32 }]} onPress={reset}>
          <Text style={styles.btnPrimaryText}>VOLVER AL INICIO</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#fff',
  },
  amountContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#888',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
    color: '#000',
    backgroundColor: '#fff',
  },
  errorText: { color: 'red', fontSize: 13, marginBottom: 8 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    width: '100%',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  accountLabel: { fontSize: 10, color: '#888', letterSpacing: 0.5 },
  accountName: { fontSize: 16, fontWeight: '600', color: '#111' },
  amountLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: '#888', marginTop: 16 },
  amountDisplay: { fontSize: 52, fontWeight: '700', marginVertical: 8, color: '#111' },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    marginVertical: 12,
  },
  numKey: {
    width: '33.33%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  numKeyText: { fontSize: 24, fontWeight: '400', color: '#111' },
  btnPrimary: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  btnInsecure: {
    borderWidth: 1.5,
    borderColor: '#cc0000',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  btnInsecureConfirm: {
    backgroundColor: '#cc0000',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  btnInsecureText: { color: '#cc0000', fontSize: 15, fontWeight: '700' },
  btnCancel: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  btnCancelText: { color: '#555', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  demoNote: { fontSize: 12, color: '#aaa', marginTop: 6, textAlign: 'center' },
  protocolBanner: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    width: '100%',
  },
  bannerSecure: { backgroundColor: '#e8f5e9' },
  bannerInsecure: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffcc02' },
  bannerTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  bannerSecureText: { color: '#2e7d32' },
  bannerInsecureText: { color: '#e65100' },
  bannerDesc: { fontSize: 13, color: '#555', lineHeight: 18 },
  detailsCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    marginVertical: 12,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: { fontSize: 11, color: '#888', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  v2Badge: { color: '#2e7d32' },
  v1Badge: { color: '#cc0000' },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultIconOk: { borderColor: '#2e7d32' },
  resultIconErr: { borderColor: '#cc0000' },
  resultIconText: { fontSize: 36, fontWeight: '700' },
  resultTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8, color: '#111' },
  resultDesc: { fontSize: 15, color: '#555', textAlign: 'center', paddingHorizontal: 24 },
});

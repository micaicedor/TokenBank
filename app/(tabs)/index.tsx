import { useAuth } from '@/context/AuthContext';
import { getTransactions, getUsers, User } from '@/services/api';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface Transaction {
  _id?: string;
  id?: string;
  payerTokenId?: string;
  payer_token_id?: string;
  merchantTokenId?: string;
  merchant_token_id?: string;
  amount: number;
  captureMethod?: string;
  capture_method?: string;
  protocol?: string;
  createdAt?: string;
  created_at?: string;
}

function initials(name: string) {
  if (!name) return '?';
  return name.split('_').map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
}

function TxRow({ tx, myTokenId }: { tx: Transaction; myTokenId: string }) {
  const payerId = tx.payerTokenId ?? tx.payer_token_id ?? '';
  const merchantId = tx.merchantTokenId ?? tx.merchant_token_id ?? '';
  const isSent = payerId === myTokenId;
  const counterpart = (isSent ? merchantId : payerId) || 'Desconocido';
  const shortId = counterpart.split('_').slice(0, 2).join(' ') || counterpart.slice(0, 12);
  const protocol = (tx.protocol ?? 'v1').toUpperCase();
  const date = tx.createdAt ?? tx.created_at;
  return (
    <View style={txStyles.row}>
      <View style={txStyles.avatar}>
        <Text style={txStyles.avatarText}>
          {counterpart.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={txStyles.info}>
        <Text style={txStyles.name}>{shortId}</Text>
        <View style={txStyles.meta}>
          <Text style={txStyles.date}>
            {date ? new Date(date).toLocaleDateString() : 'Reciente'}
          </Text>
          <View style={[txStyles.badge, protocol === 'V2' ? txStyles.badgeV2 : txStyles.badgeV1]}>
            <Text style={txStyles.badgeText}>{protocol}</Text>
          </View>
        </View>
      </View>
      <Text style={[txStyles.amount, isSent ? txStyles.sent : txStyles.received]}>
        {isSent ? '−' : '+'}${(tx.amount ?? 0).toFixed(2)}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { sessionToken, tokenId } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken || !tokenId) return;
    Promise.all([
      getUsers(sessionToken),
      getTransactions(sessionToken),
    ])
      .then(([users, transactions]) => {
        setUser(users.find((u) => u.tokenId === tokenId) ?? null);
        setTxs((transactions as Transaction[]).slice(0, 3));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionToken, tokenId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={{ color: 'red' }}>{error}</Text></View>;
  }

  const firstName = user?.username.split('_')[0] ?? '—';
  const ini = user ? initials(user.username) : '?';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* Header oscuro */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola,</Text>
          <Text style={styles.name}>{firstName}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{ini}</Text>
        </View>
      </View>

      {/* Card de saldo */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo disponible</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceCurrency}>$</Text>
          <Text style={styles.balanceAmount}>
            {user?.balance?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) ?? '0.00'}
          </Text>
          <Text style={styles.balanceMXN}>MXN</Text>
        </View>

        {/* Botones PAGAR / COBRAR */}
        <View style={styles.actions}>
          <Pressable style={styles.btnPagar} onPress={() => router.push('/(tabs)/two')}>
            <Text style={styles.btnPagarArrow}>↑</Text>
            <Text style={styles.btnPagarText}>PAGAR</Text>
          </Pressable>
          <Pressable style={styles.btnCobrar} onPress={() => router.push('/(tabs)/three')}>
            <Text style={styles.btnCobrarArrow}>↓</Text>
            <Text style={styles.btnCobrarText}>COBRAR</Text>
          </Pressable>
        </View>
      </View>

      {/* Movimientos recientes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MOVIMIENTOS RECIENTES</Text>
          <Pressable onPress={() => router.push('/(tabs)/two')}>
            <Text style={styles.seeAll}>Ver todos</Text>
          </Pressable>
        </View>

        {txs.length === 0 ? (
          <Text style={styles.emptyTx}>Sin movimientos aún.</Text>
        ) : (
          txs.map((tx, i) => (
            <TxRow key={tx._id ?? tx.id ?? i} tx={tx} myTokenId={tokenId ?? ''} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: '#555', fontSize: 13 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#111' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  date: { fontSize: 12, color: '#aaa' },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeV2: { backgroundColor: '#e3f2fd' },
  badgeV1: { backgroundColor: '#fce4ec' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#333' },
  amount: { fontSize: 15, fontWeight: '700', color: '#111' },
  sent: { color: '#333' },
  received: { color: '#2e7d32' },
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' },
  scroll: { flex: 1, backgroundColor: '#f4f4f8' },
  scrollContent: { flexGrow: 1 },
  header: {
    backgroundColor: '#1a1a2e',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 24,
  },
  greeting: { color: '#aaa', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  balanceCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: -1,
    borderRadius: 20,
    padding: 24,
    paddingTop: 0,
    marginBottom: 16,
  },
  balanceLabel: { color: '#888', fontSize: 13, marginBottom: 4 },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 20 },
  balanceCurrency: { color: '#fff', fontSize: 28, fontWeight: '300', paddingBottom: 4 },
  balanceAmount: { color: '#fff', fontSize: 42, fontWeight: '700', lineHeight: 50 },
  balanceMXN: { color: '#888', fontSize: 14, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 12 },
  btnPagar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
  },
  btnPagarArrow: { color: '#fff', fontSize: 16 },
  btnPagarText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  btnCobrar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
  },
  btnCobrarArrow: { color: '#4f46e5', fontSize: 16 },
  btnCobrarText: { color: '#4f46e5', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#888' },
  seeAll: { fontSize: 13, color: '#4f46e5', fontWeight: '600' },
  emptyTx: { color: '#aaa', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});

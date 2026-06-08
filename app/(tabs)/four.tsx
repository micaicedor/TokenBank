import { useAuth } from '@/context/AuthContext';
import { getUsers, User } from '@/services/api';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function Row({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { sessionToken, tokenId, logout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken || !tokenId) return;
    getUsers(sessionToken)
      .then((users) => setUser(users.find((u) => u.tokenId === tokenId) ?? null))
      .finally(() => setLoading(false));
  }, [sessionToken, tokenId]);

  const initials = user
    ? user.username.split('_').map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)
    : '?';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>PERFIL</Text>

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.username}>{user?.username ?? '—'}</Text>
        <Text style={styles.tokenId}>{tokenId ?? '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>CUENTA</Text>
        <Row label="Cambiar contraseña" />
        <Row label="Historial de pagos" />
      </View>

      <Pressable style={styles.logoutRow} onPress={logout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>

      <Text style={styles.footer}>SecurePay · Demo académico · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    flexGrow: 1,
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#333',
    marginBottom: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  username: { fontSize: 20, fontWeight: '700' },
  tokenId: { fontSize: 13, color: '#888' },
  card: {
    width: '100%',
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#888',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  rowLabel: { fontSize: 15, color: '#1a1a2e' },
  rowArrow: { fontSize: 20, color: '#bbb' },
  logoutRow: {
    width: '100%',
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  logoutText: { color: '#cc0000', fontSize: 15, fontWeight: '500' },
  footer: {
    fontSize: 11,
    color: '#bbb',
    marginTop: 32,
    textAlign: 'center',
  },
});

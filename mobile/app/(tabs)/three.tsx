import { useAuth } from '@/context/AuthContext';
import React from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function CobrarScreen() {
  const { tokenId } = useAuth();

  const initials = tokenId
    ? tokenId.split('_').map((w: string) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)
    : 'SP';

  async function handleShare() {
    try {
      await Share.share({
        message: `Mi ID de cobro SecurePay: ${tokenId}`,
        title: 'Cobrar con SecurePay',
      });
    } catch {
      // cancelled
    }
  }

  function handleCopy() {
    Alert.alert('Copiado', `ID: ${tokenId}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>COBRAR</Text>
      <Text style={styles.subheader}>COMPARTE CON QUIEN TE VA A PAGAR</Text>

      <View style={styles.qrBox}>
        <View style={styles.qrInner}>
          <View style={styles.qrAvatar}>
            <Text style={styles.qrAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.qrLabel}>Tu ID de cuenta</Text>
          <Text style={styles.qrTokenId}>{tokenId ?? '—'}</Text>
        </View>
        <View style={styles.qrCornerTL} />
        <View style={styles.qrCornerTR} />
        <View style={styles.qrCornerBL} />
        <View style={styles.qrCornerBR} />
      </View>

      <Text style={styles.idLabel}>TU ID DE CUENTA</Text>
      <Text style={styles.idValue}>{tokenId ?? '—'}</Text>

      <View style={styles.actions}>
        <Pressable style={styles.btnOutline} onPress={handleCopy}>
          <Text style={styles.btnOutlineText}>COPIAR</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={handleShare}>
          <Text style={styles.btnPrimaryText}>COMPARTIR</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Tu ID es único — quien lo use puede pagarte directamente.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    padding: 24,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#333',
    marginBottom: 4,
  },
  subheader: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#888',
    marginBottom: 28,
    textAlign: 'center',
  },
  qrBox: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: '#1a1a2e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  qrInner: {
    alignItems: 'center',
    gap: 8,
  },
  qrAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrAvatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  qrLabel: { fontSize: 11, color: '#888', letterSpacing: 0.5 },
  qrTokenId: { fontSize: 13, fontWeight: '600', color: '#1a1a2e', textAlign: 'center', paddingHorizontal: 12 },
  qrCornerTL: { position: 'absolute', top: 8, left: 8, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#1a1a2e' },
  qrCornerTR: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#1a1a2e' },
  qrCornerBL: { position: 'absolute', bottom: 8, left: 8, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#1a1a2e' },
  qrCornerBR: { position: 'absolute', bottom: 8, right: 8, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#1a1a2e' },
  idLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#888',
    marginBottom: 4,
  },
  idValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 24,
    color: '#111',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnOutlineText: { fontWeight: '700', color: '#1a1a2e', fontSize: 14 },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  note: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
});

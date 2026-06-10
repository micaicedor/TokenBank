import { useAuth } from '@/context/AuthContext';
import { getBaseUrl } from '@/services/api';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';


export default function LoginScreen() {

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, sessionToken } = useAuth();

    if (sessionToken) {
        return <Redirect href="/(tabs)" />
    }

    async function handleLogin() {
        setError('');
        setLoading(true);
        try {
            const baseUrl = await getBaseUrl();
            const res = await fetch(`${baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'Error al iniciar sesión');
            await login(data.sessionToken, data.tokenId, data.role, data.privateKey);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error de conexión');
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.card}>
                <Text style={styles.title}>SecurePay</Text>
                <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

                <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Usuario"
                    placeholderTextColor="#888"
                    autoCapitalize="none"
                    editable={!loading}
                />
                <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Contraseña"
                    placeholderTextColor="#888"
                    secureTextEntry
                    editable={!loading}
                    onSubmitEditing={handleLogin}
                    returnKeyType="done"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.buttonText}>Entrar</Text>
                    }
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 16,
        padding: 28,
        gap: 12,
    },
    title: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        color: '#999',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#1a1a2e',
        color: '#ffffff',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#2a2a4e',
    },
    error: {
        color: '#ff8a80',
        fontSize: 13,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#4f46e5',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
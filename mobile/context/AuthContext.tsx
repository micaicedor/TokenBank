import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

interface AuthState {
    sessionToken: string | null;
    tokenId: string | null;
    role: string | null;
}

interface AuthContextValue extends AuthState {
    isLoading: boolean;
    login: (sessionToken: string, tokenId: string, role: string, privateKey?: string | null) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode}) {
    // TODO: estado inicial con los tres campos en null
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [tokenId, setTokenId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // TODO: useEffect que lea AsyncStorage y actualice el estado
    useEffect(() => {
        // leer AsyncStorage aqui
        AsyncStorage.multiGet(['auth.sessionToken','auth.tokenId', 'auth.role'])
            .then((pairs) => {
                setSessionToken(pairs[0][1]);
                setTokenId(pairs[1][1]);
                setRole(pairs[2][1]);
                setIsLoading(false);
            });
        // Actualizar sessionToken, tokenId, role
        // setIsLoading(false) al final
    }, []);
    // TODO: función login que guarde en AsyncStorage y actualice estado
    async function login(sessionToken: string, tokenId: string, role: string, privateKey?: string | null) {
        const pairs: [string, string][] = [
            ['auth.sessionToken', sessionToken],
            ['auth.tokenId', tokenId],
            ['auth.role', role],
        ];
        if (privateKey) pairs.push(['settings.privateKey', privateKey]);
        await AsyncStorage.multiSet(pairs);
        setSessionToken(sessionToken);
        setTokenId(tokenId);
        setRole(role);
    }

    async function logout() {
        await AsyncStorage.multiRemove(['auth.sessionToken', 'auth.tokenId', 'auth.role', 'settings.privateKey']);
        setSessionToken(null);
        setTokenId(null);
        setRole(null);
    }
    return (
        <AuthContext.Provider value={{ sessionToken, tokenId, role, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    // TODO: useContext + throw si es null
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

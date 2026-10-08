import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, IconButton, Txt, tap } from '@/ui/core';
import { TextField } from '@/ui/TextField';
import { Paper } from '@/ui/brand';
import { useSession } from '@/lib/session';
import { SITE_URL } from '@/lib/api';

// Inicio de sesión. Si la cuenta tiene doble factor, aparece el campo del código.
export default function Login() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const login = useSession((s) => s.login);
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pass = useRef<TextInput>(null);
  const code = useRef<TextInput>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    if (needsTotp && !/^\d{6}$/.test(totp)) {
      setError('El código tiene 6 dígitos.');
      return;
    }
    setBusy(true);
    setError(null);
    const r = await login(email.trim(), password, needsTotp ? totp : undefined);
    setBusy(false);
    if (r.ok) {
      tap('success');
      void qc.invalidateQueries();
      const role = useSession.getState().user?.role;
      if (router.canGoBack()) router.back();
      if (role === 'SELLER') router.replace('/hoy');
      return;
    }
    if (r.totpRequired) {
      setNeedsTotp(true);
      setTimeout(() => code.current?.focus(), 100);
      return;
    }
    tap('warning');
    setError(r.message === 'Credenciales inválidas' ? 'El correo o la contraseña no coinciden.' : r.message);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <IconButton icon="close" label="Cerrar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
        <Paper radius={shape.xl} style={{ padding: 24 }}>
          <Txt variant="bodyM" color={c.onPaper} style={{ opacity: 0.75 }}>하치코</Txt>
          <Txt variant="headlineM" color={c.onPaper} accessibilityRole="header" style={{ marginTop: 16 }}>Hola de nuevo</Txt>
          <Txt variant="bodyL" color={c.onPaper} style={{ opacity: 0.85, marginTop: 4 }}>Entra para seguir tus pedidos.</Txt>
        </Paper>

        <TextField label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pass.current?.focus()} leading="mail" editable={!needsTotp} />
        <TextField ref={pass} label="Contraseña" value={password} onChangeText={setPassword} secure autoComplete="current-password" textContentType="password" returnKeyType={needsTotp ? 'next' : 'go'} onSubmitEditing={needsTotp ? () => code.current?.focus() : submit} leading="lock" editable={!needsTotp} />
        {needsTotp && (
          <TextField ref={code} label="Código de 6 dígitos" helper="Ábrelo en tu app de autenticación." value={totp} onChangeText={(t) => setTotp(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" returnKeyType="go" onSubmitEditing={submit} />
        )}
        {error && <Txt variant="bodyM" color={c.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Txt>}

        <Button label={needsTotp ? 'Verificar código' : 'Iniciar sesión'} size="lg" block loading={busy} onPress={submit} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button variant="text" label="¿Olvidaste tu contraseña?" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/recuperar`)} />
          <Button variant="text" label="Crear cuenta" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/registro`)} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

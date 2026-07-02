import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { useRouter } from "expo-router";
import { getStoredTrustToken, loadSession, loginWithPassword, resendOtp, saveSession, verifyOtp } from "../lib/auth";

const OTP_LENGTH = 6;

export default function LoginPage() {
  const router = useRouter();
  const otpRefs = useRef<(TextInput | null)[]>([]);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"credentials" | "otp">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(Array.from({ length: OTP_LENGTH }, () => ""));
  const [tempToken, setTempToken] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [trustToken, setTrustToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now());

  const otpValue = useMemo(() => otp.join(""), [otp]);
  const resendSecondsLeft = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const canResend = mode === "otp" && resendSecondsLeft === 0 && !loading;

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [session, storedTrustToken] = await Promise.all([loadSession(), getStoredTrustToken()]);
        if (cancelled) return;

        setTrustToken(storedTrustToken);
        if (session?.authToken) {
          router.replace("/pages/plantlist");
          return;
        }

        setReady(true);
      } finally {
        if (!cancelled) {
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function startLogin() {
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      const result = await loginWithPassword({
        username: username.trim(),
        password,
        trustToken,
      });

      if (result.kind === "success") {
        await saveSession(result.session);
        router.replace("/pages/plantlist");
        return;
      }

      setMode("otp");
      setTempToken(result.tempToken);
      if (result.trustToken) {
        setTrustToken(result.trustToken);
      }
      setEmailHint(result.emailHint || "");
      setInfo(result.emailHint ? `OTP sent to ${result.emailHint}.` : "Enter the verification code from your email.");
      setOtp(Array.from({ length: OTP_LENGTH }, () => ""));
      setResendAt(Date.now() + 30_000);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp() {
    if (otpValue.length !== OTP_LENGTH) {
      setError("Enter the full 6-digit verification code.");
      return;
    }

    if (!tempToken) {
      setError("Your OTP session expired. Please sign in again.");
      setMode("credentials");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      const result = await verifyOtp({
        otp: otpValue,
        verificationToken: tempToken,
        trustToken,
      });

      if (result.kind === "success") {
        await saveSession(result.session);
        router.replace("/pages/plantlist");
        return;
      }

      setTempToken(result.tempToken || tempToken);
      if (result.trustToken) {
        setTrustToken(result.trustToken);
      }
      if (result.emailHint) {
        setEmailHint(result.emailHint);
      }
      setInfo(result.message || "Enter the verification code from your email.");
      setOtp(Array.from({ length: OTP_LENGTH }, () => ""));
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (!canResend) return;

    setLoading(true);
    setError("");
    setInfo("");

    try {
      await resendOtp({
        verificationToken: tempToken,
      });
      setResendAt(Date.now() + 30_000);
      setInfo(emailHint ? `OTP resent to ${emailHint}.` : "A new verification code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, nextValue: string) {
    const digits = nextValue.replace(/\D/g, "");
    if (!digits) {
      setOtp((current) => {
        const next = [...current];
        next[index] = "";
        return next;
      });
      return;
    }

    if (digits.length > 1) {
      const next = Array.from({ length: OTP_LENGTH }, (_, offset) => digits[offset] || "");
      setOtp(next);
      otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    setOtp((current) => {
      const next = [...current];
      next[index] = digits;
      return next;
    });

    if (index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(index: number, key: string) {
    if (key !== "Backspace" || otp[index]) return;
    if (index > 0) {
      otpRefs.current[index - 1]?.focus();
      setOtp((current) => {
        const next = [...current];
        next[index - 1] = "";
        return next;
      });
    }
  }

  function resetToCredentials() {
    setMode("credentials");
    setOtp(Array.from({ length: OTP_LENGTH }, () => ""));
    setTempToken("");
    setEmailHint("");
    setInfo("");
    setError("");
  }

  if (!ready) {
    return (
      <View style={styles.loadingShell}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2BD25A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.shell}>
            <View style={styles.phoneTopShade} />

            <View style={styles.brandPanel}>
              <Image source={require("../../assets/images/Logo/logo.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandSubcaption}>Industrial Control &amp; Monitoring System</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{mode === "credentials" ? "Sign In" : "Enter OTP"}</Text>
              {mode === "otp" ? (
                <Text style={styles.cardSubtitle}>
                  {emailHint
                    ? `Enter the 6-digit code sent to ${emailHint}.`
                    : "Enter the 6-digit code sent to your email."}
                </Text>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {!error && info ? <Text style={styles.infoText}>{info}</Text> : null}

              {mode === "credentials" ? (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Username</Text>
                    <View style={styles.inputShell}>
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="default"
                        placeholder="Enter your username"
                        placeholderTextColor="#8A8A8A"
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputShell}>
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="Enter your password"
                        placeholderTextColor="#8A8A8A"
                        secureTextEntry={!showPassword}
                        style={[styles.input, styles.passwordInput]}
                        value={password}
                        onChangeText={setPassword}
                        returnKeyType="done"
                        onSubmitEditing={startLogin}
                      />
                      <Pressable hitSlop={12} style={styles.eyeButton} onPress={() => setShowPassword((current) => !current)}>
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#A9A9A9" />
                      </Pressable>
                    </View>
                  </View>

                  <Pressable style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]} onPress={startLogin}>
                    {loading ? <ActivityIndicator color="#0D160F" /> : <Text style={styles.loginButtonText}>Login</Text>}
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                      <TextInput
                        key={`otp-${index}`}
                        ref={(node) => {
                          otpRefs.current[index] = node;
                        }}
                        value={digit}
                        onChangeText={(value) => handleOtpChange(index, value)}
                        onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                        keyboardType="number-pad"
                        maxLength={index === 0 ? OTP_LENGTH : 1}
                        placeholder="•"
                        placeholderTextColor="#5F5F5F"
                        style={styles.otpInput}
                        textAlign="center"
                      />
                    ))}
                  </View>

                  <Pressable style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]} onPress={submitOtp}>
                    {loading ? <ActivityIndicator color="#0D160F" /> : <Text style={styles.loginButtonText}>Verify Code</Text>}
                  </Pressable>

                  <View style={styles.secondaryActions}>
                    <Pressable onPress={handleResendCode} disabled={!canResend}>
                      <Text style={[styles.secondaryLink, !canResend && styles.secondaryLinkDisabled]}>
                        {canResend ? "Resend code" : `Resend in ${resendSecondsLeft}s`}
                      </Text>
                    </Pressable>

                    <Pressable onPress={resetToCredentials}>
                      <Text style={styles.secondaryLink}>Use different account</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            <Text style={styles.footer}>© 2026 Sentinel Intelligence Systems. All rights reserved.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0B0B",
  },
  loadingShell: {
    flex: 1,
    backgroundColor: "#0B0B0B",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    justifyContent: "center",
  },
  shell: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 14,
  },
  phoneTopShade: {
    height: 22,
  },
  brandPanel: {
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  logo: {
    width: 228,
    height: 76,
  },
  brandSubcaption: {
    color: "#A7A7A7",
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#0F0F0F",
    borderColor: "#2A2A2A",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardTitle: {
    color: "#FCFCFC",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  cardSubtitle: {
    color: "#A7A7A7",
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: "#F87171",
    backgroundColor: "rgba(248, 113, 113, 0.10)",
    borderColor: "rgba(248, 113, 113, 0.22)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  infoText: {
    color: "#FCFCFC",
    backgroundColor: "#1D1D1D",
    borderColor: "#2A2A2A",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: 7,
  },
  label: {
    color: "#A7A7A7",
    fontSize: 14,
    fontWeight: "700",
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#2A2A2A",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#111111",
    minHeight: 58,
  },
  input: {
    flex: 1,
    color: "#FCFCFC",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButton: {
    minHeight: 56,
    backgroundColor: "#31CB63",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  loginButtonText: {
    color: "#0D160F",
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  otpRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  otpInput: {
    flex: 1,
    minWidth: 44,
    backgroundColor: "#111111",
    color: "#FCFCFC",
    borderColor: "#2A2A2A",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },
  secondaryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  secondaryLink: {
    color: "#FCFCFC",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryLinkDisabled: {
    color: "#7A7A7A",
  },
  footer: {
    color: "#7D7D7D",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 4,
  },
});

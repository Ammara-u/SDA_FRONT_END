import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native"

export default function HomePage() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Unifi</Text>

      <TextInput placeholder="Username" style={styles.input} />
      <TextInput placeholder="Password" style={styles.input} secureTextEntry />

      {/* FIX: Wrap in View so text-align right works correctly */}
      <View style={styles.forgotWrapper}>
        <Text style={styles.forgot}>Forgot password?</Text>
      </View>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Log in</Text>
      </TouchableOpacity>

      {/* FIX: OR divider with lines */}
      <View style={styles.orWrapper}>
        <View style={styles.line} />
        <Text style={styles.or}>OR</Text>
        <View style={styles.line} />
      </View>

      <Text style={styles.signup}>
        Don't have an account?{" "}
        <Text style={{ color: "#40a6d8" }}>Sign up.</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    alignItems: "center",
    paddingTop: 120,
  },
  logo: {
    color: "black",
    fontSize: 40,
    fontWeight: "bold",
    fontStyle: "italic",       // FIX: logo looks italic/script in design
    marginBottom: 50,
  },
  input: {
    width: "85%",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
  },
  // FIX: wrapper View makes textAlign work correctly
  forgotWrapper: {
    width: "85%",
    alignItems: "flex-end",    // aligns the Text child to the right
    marginBottom: 10,
    marginTop: -2,
  },
  forgot: {
    color: "#40a6d8",
  },
  button: {
    backgroundColor: "#8ec5ff",
    width: "85%",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  // FIX: OR with horizontal lines on both sides
  orWrapper: {
    flexDirection: "row",
    alignItems: "center",
    width: "85%",
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  or: {
    color: "#888",
    marginHorizontal: 12,
    fontSize: 13,
  },
  signup: {
    color: "#555",
  },
})
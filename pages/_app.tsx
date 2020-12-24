import "../styles/globals.css";
import { GeistProvider, CssBaseline } from "@geist-ui/react";

function MyApp({ Component, pageProps }) {
  return (
    <GeistProvider
      theme={{
        palette: {
          accents_1: "#111",
          accents_2: "#333",
          accents_3: "#444",
          accents_4: "#666",
          accents_5: "#888",
          accents_6: "#999",
          accents_7: "#eaeaea",
          accents_8: "#fafafa",
          background: "#000",
          foreground: "#fff",
          selection: "#93C2DB",
          secondary: "#888",
          code: "#93C2DB",
          border: "#333",
          link: "#93C2DB",
          success: "#00D46E",
          warning: "#FFD336",
          error: "#FF375D",
        },
        expressiveness: {
          dropdownBoxShadow: "0 0 0 1px #333",
          shadowSmall: "0 0 0 1px #333",
          shadowMedium: "0 0 0 1px #333",
          shadowLarge: "0 0 0 1px #333",
          portalOpacity: 0.75,
        },
      }}
    >
      <CssBaseline />
      <Component {...pageProps} />
    </GeistProvider>
  );
}

export default MyApp;

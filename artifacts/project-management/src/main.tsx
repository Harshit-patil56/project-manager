import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/themes";
import { Provider, useSelector } from "react-redux";
import { store } from "./app/store.js";
import App from "./App.jsx";
import "./index.css";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const sharedVariables = {
  colorPrimary: "#3b82f6",
  colorDanger: "#ef4444",
  fontFamily: "'Outfit', sans-serif",
  borderRadius: "0.5rem",
};

const lightAppearance = {
  variables: {
    ...sharedVariables,
    colorBackground: "#ffffff",
    colorInputBackground: "#f9fafb",
    colorText: "#111827",
    colorTextSecondary: "#6b7280",
    colorNeutral: "#e5e7eb",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg bg-white",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
  },
};

const darkAppearance = {
  baseTheme: dark,
  variables: {
    ...sharedVariables,
    colorBackground: "#18181b",
    colorInputBackground: "#27272a",
    colorText: "#f4f4f5",
    colorTextOnPrimaryBackground: "#ffffff",
    colorTextSecondary: "#a1a1aa",
    colorNeutral: "#ffffff",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg bg-zinc-900",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
  },
};

function ClerkWithRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const theme = useSelector((state: any) => state.theme.theme);
  const appearance = theme === "dark" ? darkAppearance : lightAppearance;

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
      appearance={appearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={basePath || "/"}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={basePath || "/"}>
    <Provider store={store}>
      <ClerkWithRouter>
        <App />
      </ClerkWithRouter>
    </Provider>
  </BrowserRouter>,
);
